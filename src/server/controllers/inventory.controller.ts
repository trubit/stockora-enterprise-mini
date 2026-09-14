import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { SocketManager } from '../sockets/manager.js';
import { redis } from '../database/redis.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const io = SocketManager.getInstance();

export const STANDARDIZED_ADJUSTMENT_REASONS = [
  'Incorrect stock entry',
  'Counting error',
  'Damaged goods',
  'Lost goods',
  'Found goods',
  'Receiving correction',
  'Data correction',
  'Warehouse correction',
  'Other',
] as const;

export type StandardAdjustmentReason = (typeof STANDARDIZED_ADJUSTMENT_REASONS)[number];

export class InventoryController {
  /**
   * POST /api/v1/inventory/adjust
   * Authoritative, tenant-isolated stock adjustment with atomic concurrency,
   * negative stock prevention, idempotency, and auditable ledger persistence.
   */
  public static async adjustStock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const {
      productId,
      variantSku,
      warehouseId,
      type,
      reason,
      quantity,
      targetQuantity,
      quantityDelta: explicitDelta,
      notes,
      idempotencyKey,
    } = req.body;

    const tenantId = req.tenantId || req.user?.tenantId || 'default';

    // 1. Basic validation
    if (!productId) {
      return next(new ValidationError('Product ID is required.'));
    }
    if (!type) {
      return next(
        new ValidationError(
          'Adjustment type is required (ADD, REMOVE, SET, RELATIVE, or SET_QUANTITY).'
        )
      );
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return next(new ValidationError('A valid adjustment reason is required.'));
    }

    const trimmedReason = reason.trim();
    const isOther = trimmedReason.toLowerCase() === 'other';
    if (isOther && (!notes || typeof notes !== 'string' || notes.trim().length < 3)) {
      return next(
        new ValidationError(
          'When reason is "Other", an explanatory note of at least 3 characters is required.'
        )
      );
    }

    try {
      // 2. Idempotency check: prevent duplicate accidental double-submissions
      if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
        const existingAdjustment = await StockAdjustment.findOne({
          tenantId,
          idempotencyKey: idempotencyKey.trim(),
        })
          .populate('productId', 'name sku category price')
          .populate('warehouseId', 'name code')
          .lean();

        if (existingAdjustment) {
          res.status(200).json({
            message: 'Stock adjustment already processed (idempotent replay).',
            adjustment: existingAdjustment,
            idempotent: true,
          });
          return;
        }
      }

      // 3. Multi-tenant product ownership verification
      const productQuery: Record<string, unknown> = { _id: productId };
      if (tenantId && tenantId !== 'default') {
        productQuery.tenantId = tenantId;
      }

      const product = await Product.findOne(productQuery);
      if (!product) {
        return next(new NotFoundError('Product not found or access denied for this tenant.'));
      }

      // 4. Warehouse validation (if provided)
      let verifiedWarehouse: any = null;
      if (warehouseId) {
        if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
          return next(new ValidationError('Invalid warehouse ID format.'));
        }
        const whQuery: Record<string, unknown> = { _id: warehouseId };
        if (tenantId && tenantId !== 'default') {
          whQuery.tenantId = tenantId;
        }
        verifiedWarehouse = await Warehouse.findOne(whQuery);
        if (!verifiedWarehouse) {
          return next(new NotFoundError('Warehouse not found or access denied for this tenant.'));
        }
      }

      // 5. Determine variant if specified
      let targetVariant: any = null;
      if (variantSku && typeof variantSku === 'string') {
        targetVariant = product.variants?.find(
          (v: any) => v.sku?.toLowerCase() === variantSku.trim().toLowerCase()
        );
        if (!targetVariant) {
          return next(
            new NotFoundError(`Product variant with SKU [${variantSku}] not found on this product.`)
          );
        }
      }

      // 6. Calculate current stock and signed delta
      const priorProductQty = Number(product.quantity || 0);
      const priorVariantQty = targetVariant ? Number(targetVariant.quantity || 0) : null;
      const effectiveCurrentQty = targetVariant ? priorVariantQty! : priorProductQty;

      let signedDelta = 0;
      const normalizedType = String(type).toUpperCase().trim();

      if (normalizedType === 'ADD') {
        const rawVal = Number(quantity);
        if (isNaN(rawVal) || !isFinite(rawVal) || rawVal <= 0) {
          return next(new ValidationError('ADD adjustment requires a positive numeric quantity.'));
        }
        signedDelta = rawVal;
      } else if (normalizedType === 'REMOVE') {
        const rawVal = Number(quantity);
        if (isNaN(rawVal) || !isFinite(rawVal) || rawVal <= 0) {
          return next(
            new ValidationError('REMOVE adjustment requires a positive numeric quantity.')
          );
        }
        signedDelta = -rawVal;
      } else if (normalizedType === 'SET' || normalizedType === 'SET_QUANTITY') {
        const targetVal = Number(targetQuantity !== undefined ? targetQuantity : quantity);
        if (isNaN(targetVal) || !isFinite(targetVal) || targetVal < 0) {
          return next(
            new ValidationError('SET adjustment requires a valid non-negative target quantity.')
          );
        }
        signedDelta = targetVal - effectiveCurrentQty;
      } else if (normalizedType === 'RELATIVE') {
        const deltaVal = Number(explicitDelta !== undefined ? explicitDelta : quantity);
        if (isNaN(deltaVal) || !isFinite(deltaVal)) {
          return next(new ValidationError('RELATIVE adjustment requires a valid numeric delta.'));
        }
        signedDelta = deltaVal;
      } else {
        return next(
          new ValidationError(
            `Unsupported adjustment type [${type}]. Must be ADD, REMOVE, SET, RELATIVE, or SET_QUANTITY.`
          )
        );
      }

      // 7. Quantity sanity checks
      if (signedDelta === 0) {
        return next(
          new ValidationError(
            'Adjustment delta is zero. Current stock is already equal to target stock.'
          )
        );
      }

      if (Math.abs(signedDelta) > 1_000_000_000) {
        return next(new ValidationError('Adjustment quantity exceeds maximum allowed threshold.'));
      }

      const resultingQty = Number((effectiveCurrentQty + signedDelta).toFixed(4));

      // 8. Negative stock rule enforcement
      if (resultingQty < 0) {
        return next(
          new ValidationError(
            `Adjustment would result in negative stock. Current: ${effectiveCurrentQty}, Adjustment: ${signedDelta > 0 ? `+${signedDelta}` : signedDelta}, Result: ${resultingQty}. Negative stock is prohibited.`
          )
        );
      }

      // 9. Atomic Concurrency Stock Update
      // For decrements, conditionally ensure quantity is at least the decrement amount to prevent race-condition overdrafts.
      let updatedProduct: any = null;

      if (signedDelta < 0) {
        const decrementCondition: Record<string, unknown> = {
          _id: product._id,
          quantity: { $gte: -signedDelta },
        };
        if (tenantId && tenantId !== 'default') {
          decrementCondition.tenantId = tenantId;
        }

        updatedProduct = await Product.findOneAndUpdate(
          decrementCondition,
          {
            $inc: { quantity: signedDelta },
            $set: {
              status: resultingQty === 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
            },
          },
          { new: true }
        );

        if (!updatedProduct) {
          return next(
            new ValidationError(
              'Insufficient stock or concurrent inventory transaction detected. Please refresh and retry.'
            )
          );
        }
      } else {
        const incrementCondition: Record<string, unknown> = { _id: product._id };
        if (tenantId && tenantId !== 'default') {
          incrementCondition.tenantId = tenantId;
        }

        updatedProduct = await Product.findOneAndUpdate(
          incrementCondition,
          {
            $inc: { quantity: signedDelta },
            $set: { status: 'ACTIVE' },
          },
          { new: true }
        );

        if (!updatedProduct) {
          return next(new NotFoundError('Product could not be updated or access was revoked.'));
        }
      }

      // If variant was specified, atomically update variant quantity as well
      if (targetVariant) {
        await Product.updateOne(
          { _id: product._id, 'variants.sku': targetVariant.sku },
          { $inc: { 'variants.$.quantity': signedDelta } }
        );
      }

      // Track damaged / expired stock if applicable
      const upperReason = trimmedReason.toUpperCase();
      if (upperReason.includes('DAMAGED') || upperReason.includes('EXPIRED')) {
        await Product.updateOne(
          { _id: product._id },
          { $inc: { damagedQuantity: Math.abs(signedDelta) } }
        ).catch(() => {});
      }

      // 10. Create StockAdjustment Record (Immutable History)
      const adjustmentNumber = `ADJ-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const adjustment = await StockAdjustment.create({
        tenantId,
        companyId: (req.user as any)?.companyId || (req.user as any)?.tenantId,
        warehouseId: verifiedWarehouse?._id,
        productId: product._id,
        variantSku: targetVariant?.sku,
        adjustmentNumber,
        type: normalizedType,
        reason: trimmedReason,
        quantity: Math.abs(signedDelta),
        quantityDelta: signedDelta,
        previousQuantity: effectiveCurrentQty,
        newQuantity: resultingQty,
        notes: notes ? String(notes).trim() : undefined,
        idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
        userId: req.user?.id,
      });

      // 11. Create StockMovement Record (Unified Stock Ledger)
      const movement = await StockMovement.create({
        tenantId,
        companyId: (req.user as any)?.companyId,
        warehouseId: verifiedWarehouse?._id,
        productId: product._id,
        type: 'ADJUSTMENT',
        quantity: signedDelta,
        costPrice: product.costPrice || product.cost || 0,
        sellingPrice: product.sellingPrice || product.price || 0,
        referenceId: adjustment.adjustmentNumber,
        referenceType: 'StockAdjustment',
        userId: req.user?.id,
        notes: `Stock Adjustment [${trimmedReason}]${notes ? `: ${notes}` : ''}`.trim(),
      });

      // 12. Invalidate Cache
      if (tenantId && tenantId !== 'default') {
        await redis.del([`tenant:${tenantId}:products:all`, 'products:all']).catch(() => {});
      } else {
        await redis.del('products:all').catch(() => {});
      }

      // 13. Audit Log Entry
      await AuditLog.create({
        userId: req.user?.id,
        tenantId,
        action: 'ADJUST_STOCK',
        targetModel: 'Product',
        targetId: product._id.toString(),
        priorValues: {
          quantity: priorProductQty,
          variantSku: targetVariant?.sku,
          variantQuantity: priorVariantQty,
        },
        newValues: {
          quantity: updatedProduct.quantity,
          variantSku: targetVariant?.sku,
          adjustmentDelta: signedDelta,
          adjustmentNumber,
          reason: trimmedReason,
        },
      }).catch(() => {});

      // 14. Real-time Notifications via Sockets
      if (tenantId && tenantId !== 'default') {
        io.emitToRoom(`tenant:${tenantId}`, 'inventory:adjusted', {
          productId: product._id,
          productName: product.name,
          previousQuantity: effectiveCurrentQty,
          adjustmentDelta: signedDelta,
          newQuantity: resultingQty,
          adjustmentNumber,
          warehouseId: verifiedWarehouse?._id,
        });
      }
      io.emitGlobal('inventory:adjusted', {
        productId: product._id,
        productName: product.name,
        previousQuantity: effectiveCurrentQty,
        adjustmentDelta: signedDelta,
        newQuantity: resultingQty,
        adjustmentNumber,
      });

      if (updatedProduct.quantity <= (updatedProduct.lowStockAlert || 5)) {
        io.emitGlobal('notification:low-stock', {
          name: updatedProduct.name,
          quantity: updatedProduct.quantity,
        });
      }

      res.status(201).json({
        success: true,
        message: `Stock adjusted successfully. ${product.name}: ${effectiveCurrentQty} → ${resultingQty} (${signedDelta > 0 ? `+${signedDelta}` : signedDelta})`,
        previousQuantity: effectiveCurrentQty,
        adjustmentDelta: signedDelta,
        newQuantity: resultingQty,
        product: updatedProduct,
        adjustment,
        movement,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * GET /api/v1/inventory/adjustments
   * Returns list of stock adjustments filtered strictly by active tenant.
   */
  public static async getAdjustments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || 'default';
      const query: Record<string, unknown> = {};

      if (tenantId && tenantId !== 'default') {
        query.tenantId = tenantId;
      }

      if (req.query.productId && mongoose.Types.ObjectId.isValid(req.query.productId as string)) {
        query.productId = req.query.productId;
      }

      if (
        req.query.warehouseId &&
        mongoose.Types.ObjectId.isValid(req.query.warehouseId as string)
      ) {
        query.warehouseId = req.query.warehouseId;
      }

      if (req.query.reason) {
        query.reason = req.query.reason;
      }

      if (req.query.startDate || req.query.endDate) {
        const dateQuery: Record<string, Date> = {};
        if (req.query.startDate) dateQuery.$gte = new Date(req.query.startDate as string);
        if (req.query.endDate) dateQuery.$lte = new Date(req.query.endDate as string);
        query.createdAt = dateQuery;
      }

      const limit = Math.min(Number(req.query.limit) || 100, 500);

      const adjustments = await StockAdjustment.find(query)
        .populate('productId', 'name sku brand category uom price costPrice quantity')
        .populate('warehouseId', 'name code city address')
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      res.json(adjustments);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * GET /api/v1/inventory/movements
   * Returns stock movements filtered strictly by active tenant.
   */
  public static async getMovements(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || 'default';
      const query: Record<string, unknown> = {};

      if (tenantId && tenantId !== 'default') {
        query.tenantId = tenantId;
      }

      if (req.query.productId && mongoose.Types.ObjectId.isValid(req.query.productId as string)) {
        query.productId = req.query.productId;
      }

      if (
        req.query.warehouseId &&
        mongoose.Types.ObjectId.isValid(req.query.warehouseId as string)
      ) {
        query.warehouseId = req.query.warehouseId;
      }

      if (req.query.type) {
        query.type = req.query.type;
      }

      const limit = Math.min(Number(req.query.limit) || 100, 500);

      const movements = await StockMovement.find(query)
        .populate('productId', 'name sku brand category uom')
        .populate('warehouseId', 'name code')
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      res.json(movements);
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * GET /api/v1/inventory/valuation
   * Calculates FIFO, LIFO, and weighted average valuation scoped to active tenant.
   */
  public static async getValuation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || 'default';
      const prodQuery: Record<string, unknown> = { isActive: true };
      if (tenantId && tenantId !== 'default') {
        prodQuery.tenantId = tenantId;
      }

      const products = await Product.find(prodQuery).lean();

      let totalWeightedAverage = 0;
      let totalFIFO = 0;
      let totalLIFO = 0;

      for (const product of products) {
        const Q = product.quantity || 0;
        const defaultCost = product.costPrice || product.cost || 0;

        totalWeightedAverage += Q * defaultCost;

        if (Q <= 0) continue;

        const movQuery: Record<string, unknown> = {
          productId: product._id,
          quantity: { $gt: 0 },
        };
        if (tenantId && tenantId !== 'default') {
          movQuery.tenantId = tenantId;
        }

        const movements = await StockMovement.find(movQuery).sort({ createdAt: -1 }).lean();

        let fifoVal = 0;
        let fifoRemaining = Q;
        for (const mov of movements) {
          const qty = mov.quantity;
          const cost = mov.costPrice || defaultCost;
          if (fifoRemaining <= qty) {
            fifoVal += fifoRemaining * cost;
            fifoRemaining = 0;
            break;
          } else {
            fifoVal += qty * cost;
            fifoRemaining -= qty;
          }
        }
        if (fifoRemaining > 0) {
          fifoVal += fifoRemaining * defaultCost;
        }
        totalFIFO += fifoVal;

        const lifoMovements = [...movements].reverse();
        let lifoVal = 0;
        let lifoRemaining = Q;
        for (const mov of lifoMovements) {
          const qty = mov.quantity;
          const cost = mov.costPrice || defaultCost;
          if (lifoRemaining <= qty) {
            lifoVal += lifoRemaining * cost;
            lifoRemaining = 0;
            break;
          } else {
            lifoVal += qty * cost;
            lifoRemaining -= qty;
          }
        }
        if (lifoRemaining > 0) {
          lifoVal += lifoRemaining * defaultCost;
        }
        totalLIFO += lifoVal;
      }

      res.json({
        weightedAverage: totalWeightedAverage,
        fifo: totalFIFO,
        lifo: totalLIFO,
        totalItemsCount: products.reduce((acc, p) => acc + (p.quantity || 0), 0),
        productsCount: products.length,
      });
    } catch (err: unknown) {
      next(err);
    }
  }
}
