import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { redis } from '../database/redis.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class PurchaseOrderController {
  public static async listPOs(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pos = await PurchaseOrder.find()
        .populate('supplierId', 'name code email')
        .populate('items.productId', 'name sku uom')
        .populate('approvedBy', 'username email')
        .sort({ createdAt: -1 })
        .lean();
      res.json(pos);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createPO(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { supplierId, requisitionId, items, notes } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return next(new ValidationError('supplierId and items array are required.'));
    }

    try {
      let totalAmount = 0;
      const formattedItems = items.map((i) => {
        const costPrice = Number(i.costPrice || 0);
        const quantity = Number(i.quantity || 0);
        totalAmount += costPrice * quantity;
        return {
          productId: i.productId,
          quantity,
          costPrice,
          receivedQuantity: 0,
        };
      });

      const poNumber = `PO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const po = await PurchaseOrder.create({
        poNumber,
        requisitionId: requisitionId ? new mongoose.Types.ObjectId(requisitionId) : undefined,
        supplierId: new mongoose.Types.ObjectId(supplierId),
        items: formattedItems,
        totalAmount,
        notes,
        status: 'PENDING_APPROVAL',
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'PurchaseOrder',
        targetId: po._id.toString(),
        newValues: po.toObject(),
      });

      res.status(201).json(po);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async approvePO(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const po = await PurchaseOrder.findById(id);
      if (!po) {
        return next(new NotFoundError('Purchase Order not found.'));
      }

      if (po.status !== 'PENDING_APPROVAL') {
        return next(new ValidationError(`PO status is already ${po.status}.`));
      }

      const oldValues = po.toObject();
      po.status = 'APPROVED';
      po.approvedBy = new mongoose.Types.ObjectId(req.user?.id);
      await po.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'PurchaseOrder',
        targetId: po._id.toString(),
        priorValues: oldValues,
        newValues: po.toObject(),
      });

      res.json(po);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async receiveGoods(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const { items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new ValidationError('A non-empty items array is required.'));
    }

    try {
      const po = await PurchaseOrder.findById(id);
      if (!po) {
        return next(new NotFoundError('Purchase Order not found.'));
      }

      const validStatuses = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'];
      if (!validStatuses.includes(po.status)) {
        return next(
          new ValidationError(`Cannot receive goods for a Purchase Order in status: ${po.status}`)
        );
      }

      const oldPOValues = po.toObject();
      const grnNumber = `GRN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const grItems = [];

      for (const receiveItem of items) {
        const poItem = po.items.find((i: any) => i.productId.toString() === receiveItem.productId);
        if (!poItem) {
          return next(
            new ValidationError(
              `Product [${receiveItem.productId}] is not part of this Purchase Order.`
            )
          );
        }

        const qtyToReceive = Number(receiveItem.quantityReceived || 0);
        if (qtyToReceive <= 0) continue;

        const maxReceivable = poItem.quantity - poItem.receivedQuantity;
        if (qtyToReceive > maxReceivable) {
          return next(
            new ValidationError(
              `Cannot receive more than ordered. Ordered: ${poItem.quantity}, Already received: ${poItem.receivedQuantity}, Trying to receive: ${qtyToReceive}`
            )
          );
        }

        poItem.receivedQuantity += qtyToReceive;

        // Add to main product catalog inventory count
        const product = await Product.findById(receiveItem.productId);
        if (product) {
          product.quantity += qtyToReceive;
          // Set new product purchase costs to PO price dynamically
          product.costPrice = poItem.costPrice;
          product.cost = poItem.costPrice;
          await product.save();

          // Log inventory movement history
          await StockMovement.create({
            productId: product._id,
            type: 'PURCHASE',
            quantity: qtyToReceive,
            costPrice: poItem.costPrice,
            sellingPrice: product.sellingPrice || product.price || 0,
            referenceId: grnNumber,
            userId: req.user?.id,
            notes: `Received stock under PO: ${po.poNumber}. GRN: ${grnNumber}`,
          });
        }

        grItems.push({
          productId: new mongoose.Types.ObjectId(receiveItem.productId),
          quantityReceived: qtyToReceive,
        });
      }

      // Determine new PO status
      let allReceived = true;
      for (const poItem of po.items) {
        if (poItem.receivedQuantity < poItem.quantity) {
          allReceived = false;
          break;
        }
      }

      po.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      await po.save();

      const goodsReceipt = await GoodsReceipt.create({
        grnNumber,
        poId: po._id,
        items: grItems,
        receivedBy: new mongoose.Types.ObjectId(req.user?.id),
        notes,
      });

      await redis.del('products:all');

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'PurchaseOrder',
        targetId: po._id.toString(),
        priorValues: oldPOValues,
        newValues: po.toObject(),
      });

      res.status(201).json(goodsReceipt);
    } catch (err: unknown) {
      next(err);
    }
  }
}
