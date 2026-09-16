import type { Response, NextFunction } from 'express';
import { Product } from '../models/Product.js';
import { AuditLog } from '../models/AuditLog.js';
import { redis } from '../database/redis.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class ProductController {
  public static async getProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      if (!tenantId) {
        res.json([]);
        return;
      }
      const search = req.query.search as string;
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * limit;

      if (search && search.trim() !== '') {
        // Escape regex special characters to prevent ReDoS attacks
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        const filter: Record<string, unknown> = {
          tenantId,
          $or: [{ name: regex }, { sku: regex }, { category: regex }, { barcode: regex }],
        };

        const products = await Product.find(filter).skip(skip).limit(limit).lean();
        res.json(products);
        return;
      }

      if (req.query.page || req.query.limit) {
        const products = await Product.find({ tenantId }).skip(skip).limit(limit).lean();
        res.json(products);
        return;
      }

      const cacheKey = `tenant:${tenantId}:products:all`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }

      const products = await Product.find({ tenantId }).limit(200).lean();
      await redis.setex(cacheKey, 300, JSON.stringify(products));
      res.json(products);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const product = await Product.findOne(query).lean();
      if (!product) {
        return next(new NotFoundError('Product not found or access denied.'));
      }
      res.json(product);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const {
      name,
      category,
      costPrice,
      sellingPrice,
      price,
      cost,
      sku,
      barcode,
      retailPrice,
      wholesalePrice,
      ...rest
    } = req.body;

    const finalCostPrice = Number(
      costPrice !== undefined ? costPrice : cost !== undefined ? cost : 0
    );
    const finalRetailPrice = Number(
      retailPrice !== undefined
        ? retailPrice
        : sellingPrice !== undefined
          ? sellingPrice
          : price !== undefined
            ? price
            : 0
    );
    const finalWholesalePrice =
      wholesalePrice !== undefined && Number(wholesalePrice) > 0
        ? Number(wholesalePrice)
        : finalRetailPrice;

    if (!name || !category) {
      return next(new ValidationError('Name and category are required.'));
    }

    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;

      let finalSku = sku;
      if (!finalSku) {
        const cleanName = name
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 4)
          .toUpperCase();
        const cleanCat = category
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 3)
          .toUpperCase();
        finalSku = `PRD-${cleanCat}-${cleanName}-${Math.round(Math.random() * 1e5)}`;
      }

      const skuQuery: Record<string, unknown> = { sku: finalSku };
      if (tenantId) skuQuery.tenantId = tenantId;

      const existingSku = await Product.findOne(skuQuery);
      if (existingSku) {
        return next(new ValidationError(`Product SKU [${finalSku}] already exists.`));
      }

      const initialQuantity = Number(rest.quantity || 0);
      const initialAlert = Number(rest.lowStockAlert !== undefined ? rest.lowStockAlert : 10);
      const initialStatus =
        initialQuantity > 0 ? rest.status || 'ACTIVE' : rest.status || 'OUT_OF_STOCK';
      const finalBarcode =
        barcode && String(barcode).trim() !== '' ? String(barcode).trim() : undefined;

      let finalCurrency = req.body.currency ? String(req.body.currency).toUpperCase().trim() : '';
      if (!finalCurrency) {
        if (tenantId) {
          const { RegionalSettings } = await import('../models/RegionalSettings.js');
          const regional = await RegionalSettings.findOne({ tenantId }).lean();
          if (regional?.currency) {
            finalCurrency = String(regional.currency).toUpperCase().trim();
          }
        }
        if (!finalCurrency) {
          finalCurrency = 'NGN';
        }
      }

      const product = await Product.create({
        tenantId,
        name,
        category,
        costPrice: finalCostPrice,
        sellingPrice: finalRetailPrice,
        price: finalRetailPrice,
        retailPrice: finalRetailPrice,
        wholesalePrice: finalWholesalePrice,
        currency: finalCurrency,
        cost: finalCostPrice,
        sku: finalSku,
        barcode: finalBarcode,
        quantity: initialQuantity,
        lowStockAlert: initialAlert,
        status: initialStatus,
        ...rest,
      });

      if (tenantId) {
        await redis.del([`tenant:${tenantId}:products:all`, 'products:all']);
      } else {
        await redis.del('products:all');
      }

      await AuditLog.create({
        userId: req.user?.id,
        tenantId,
        action: 'CREATE',
        targetModel: 'Product',
        targetId: product._id.toString(),
        newValues: product.toObject(),
      });

      res.status(201).json(product);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const product = await Product.findOne(query);
      if (!product) {
        return next(new NotFoundError('Product not found or access denied.'));
      }

      const oldValues = product.toObject();

      const {
        sku,
        costPrice,
        sellingPrice,
        cost,
        price,
        retailPrice,
        wholesalePrice,
        addQuantity,
        quantity,
        lowStockAlert,
      } = req.body;
      const updatableData = { ...req.body };
      delete updatableData.sku;
      delete updatableData.costPrice;
      delete updatableData.sellingPrice;
      delete updatableData.cost;
      delete updatableData.price;
      delete updatableData.retailPrice;
      delete updatableData.wholesalePrice;
      delete updatableData.addQuantity;
      delete updatableData.quantity;
      delete updatableData.lowStockAlert;
      delete updatableData._id;
      delete updatableData.id;
      delete updatableData.tenantId;
      delete updatableData.createdAt;
      delete updatableData.updatedAt;
      delete updatableData.__v;

      if (sku && sku !== product.sku) {
        const skuQuery: Record<string, unknown> = { sku };
        if (tenantId) skuQuery.tenantId = tenantId;

        const existingSku = await Product.findOne(skuQuery);
        if (existingSku) {
          return next(new ValidationError(`SKU [${sku}] is already assigned to another product.`));
        }
        product.sku = sku;
      }

      if (costPrice !== undefined) {
        product.costPrice = Number(costPrice);
        product.cost = Number(costPrice);
      } else if (cost !== undefined) {
        product.costPrice = Number(cost);
        product.cost = Number(cost);
      }

      if (retailPrice !== undefined) {
        const parsedRetail = Number(retailPrice);
        product.retailPrice = parsedRetail;
        product.sellingPrice = parsedRetail;
        product.price = parsedRetail;
      } else if (sellingPrice !== undefined) {
        const parsedSelling = Number(sellingPrice);
        product.retailPrice = parsedSelling;
        product.sellingPrice = parsedSelling;
        product.price = parsedSelling;
      } else if (price !== undefined) {
        const parsedPrice = Number(price);
        product.retailPrice = parsedPrice;
        product.sellingPrice = parsedPrice;
        product.price = parsedPrice;
      }

      if (wholesalePrice !== undefined) {
        product.wholesalePrice = Number(wholesalePrice);
      }

      if (req.body.currency !== undefined && String(req.body.currency).trim() !== '') {
        product.currency = String(req.body.currency).toUpperCase().trim();
      }

      // Handle stock adjustments & restocking
      if (addQuantity !== undefined && Number(addQuantity) !== 0) {
        const addQty = Number(addQuantity);
        product.quantity = Math.max(0, (product.quantity || 0) + addQty);
        if (product.quantity > 0 && product.status === 'OUT_OF_STOCK') {
          product.status = 'ACTIVE';
        }
      } else if (quantity !== undefined) {
        product.quantity = Math.max(0, Number(quantity));
        if (product.quantity > 0 && product.status === 'OUT_OF_STOCK') {
          product.status = 'ACTIVE';
        } else if (product.quantity === 0 && product.status === 'ACTIVE') {
          product.status = 'OUT_OF_STOCK';
        }
      }

      if (lowStockAlert !== undefined) {
        product.lowStockAlert = Math.max(0, Number(lowStockAlert));
      }

      Object.assign(product, updatableData);
      await product.save();

      if (tenantId) {
        await redis.del([`tenant:${tenantId}:products:all`, 'products:all']);
      } else {
        await redis.del('products:all');
      }

      await AuditLog.create({
        userId: req.user?.id,
        tenantId,
        action: 'UPDATE',
        targetModel: 'Product',
        targetId: product._id.toString(),
        priorValues: oldValues,
        newValues: product.toObject(),
      });

      res.json(product);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async deleteProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const product = await Product.findOne(query);
      if (!product) {
        return next(new NotFoundError('Product not found or access denied.'));
      }

      const oldValues = product.toObject();
      product.isActive = false;
      product.status = 'INACTIVE';
      await product.save();

      if (tenantId) {
        await redis.del([`tenant:${tenantId}:products:all`, 'products:all']);
      } else {
        await redis.del('products:all');
      }

      await AuditLog.create({
        userId: req.user?.id,
        tenantId,
        action: 'DELETE',
        targetModel: 'Product',
        targetId: product._id.toString(),
        priorValues: oldValues,
        newValues: product.toObject(),
      });

      res.json({ message: 'Product deactivated successfully.', product });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async restockProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const { quantity, addQuantity, costPrice, reason } = req.body;

    if (!id || id === 'undefined') {
      return next(new ValidationError('Valid product ID is required.'));
    }

    const qtyToAdd = Number(
      addQuantity !== undefined ? addQuantity : quantity !== undefined ? quantity : 0
    );
    if (qtyToAdd <= 0) {
      return next(new ValidationError('Restock quantity must be greater than 0.'));
    }

    try {
      const tenantId = req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const product = await Product.findOne(query);
      if (!product) {
        return next(new NotFoundError('Product not found or access denied.'));
      }

      const oldValues = product.toObject();
      product.quantity = (product.quantity || 0) + qtyToAdd;
      if (product.quantity > 0 && product.status === 'OUT_OF_STOCK') {
        product.status = 'ACTIVE';
      }
      if (costPrice !== undefined && Number(costPrice) > 0) {
        product.costPrice = Number(costPrice);
        product.cost = Number(costPrice);
      }

      await product.save();

      if (tenantId) {
        await redis.del([`tenant:${tenantId}:products:all`, 'products:all']);
      } else {
        await redis.del('products:all');
      }

      await AuditLog.create({
        userId: req.user?.id,
        tenantId,
        action: 'RESTOCK',
        targetModel: 'Product',
        targetId: product._id.toString(),
        priorValues: oldValues,
        newValues: {
          ...product.toObject(),
          restockReason: reason || 'Quick Restock',
          addedQuantity: qtyToAdd,
        },
      });

      res.json({
        message: 'Product restocked successfully.',
        product,
      });
    } catch (err: unknown) {
      next(err);
    }
  }
}
