import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SalesReturn } from '../models/SalesReturn.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { redis } from '../database/redis.js';
import { ValidationError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SocketManager } from '../sockets/manager.js';

const io = SocketManager.getInstance();

export class SalesReturnController {
  public static async listReturns(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const returns = await SalesReturn.find()
        .populate('customerId', 'name code email')
        .populate('orderId', 'orderNumber totalAmount')
        .populate('items.productId', 'name sku price')
        .sort({ createdAt: -1 })
        .lean();
      res.json(returns);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { customerId, orderId, items, reason } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0 || !reason) {
      return next(new ValidationError('customerId, items array, and reason are required.'));
    }

    try {
      const returnNumber = `RT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const formattedItems = [];

      for (const item of items) {
        const qty = Number(item.quantity || 0);
        const prc = Number(item.price || 0);
        const refAmt = Number(item.refundAmount || 0);

        const product = await Product.findById(item.productId);
        if (product) {
          // Increment stock count (item returned back to warehouse)
          product.quantity += qty;
          await product.save();

          io.emitGlobal('product:stock-updated', {
            productId: product._id,
            quantity: product.quantity,
          });

          // Log stock entry back to ledger
          await StockMovement.create({
            productId: product._id,
            type: 'RETURN',
            quantity: qty,
            costPrice: product.costPrice || product.cost || 0,
            sellingPrice: prc,
            referenceId: returnNumber,
            userId: req.user?.id,
            notes: `Customer return processed under return: ${returnNumber}. Reason: ${reason}`,
          });
        }

        formattedItems.push({
          productId: new mongoose.Types.ObjectId(item.productId),
          quantity: qty,
          price: prc,
          refundAmount: refAmt,
        });
      }

      const salesReturn = await SalesReturn.create({
        returnNumber,
        orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
        customerId: new mongoose.Types.ObjectId(customerId),
        items: formattedItems,
        reason,
        status: 'COMPLETED',
      });

      await redis.del('products:all');

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'SalesReturn',
        targetId: salesReturn._id.toString(),
        newValues: salesReturn.toObject(),
      });

      res.status(201).json(salesReturn);
    } catch (err: unknown) {
      next(err);
    }
  }
}
