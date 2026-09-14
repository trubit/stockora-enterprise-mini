import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { WarehouseTransfer } from '../models/WarehouseTransfer.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { redis } from '../database/redis.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class TransferController {
  public static async listTransfers(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const transfers = await WarehouseTransfer.find()
        .populate('fromWarehouseId', 'name code')
        .populate('toWarehouseId', 'name code')
        .populate('items.productId', 'name sku uom')
        .populate('createdBy', 'username email')
        .populate('receivedBy', 'username email')
        .sort({ createdAt: -1 })
        .lean();
      res.json(transfers);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createTransfer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { fromWarehouseId, toWarehouseId, items, notes } = req.body;

    if (
      !fromWarehouseId ||
      !toWarehouseId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return next(
        new ValidationError(
          'fromWarehouseId, toWarehouseId, and a non-empty items array are required.'
        )
      );
    }

    if (fromWarehouseId === toWarehouseId) {
      return next(new ValidationError('Source and destination warehouses must be different.'));
    }

    try {
      // Validate item quantities and existence
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return next(new NotFoundError(`Product [${item.productId}] not found.`));
        }
        if (product.quantity < Number(item.quantity)) {
          return next(
            new ValidationError(
              `Insufficient stock for product [${product.name}]. Available: ${product.quantity}, Transfer request: ${item.quantity}`
            )
          );
        }
      }

      const transferNumber = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const transfer = await WarehouseTransfer.create({
        transferNumber,
        fromWarehouseId,
        toWarehouseId,
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        notes,
        status: 'PENDING',
        createdBy: req.user?.id,
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'WarehouseTransfer',
        targetId: transfer._id.toString(),
        newValues: transfer.toObject(),
      });

      res.status(201).json(transfer);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateTransferStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['IN_TRANSIT', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return next(
        new ValidationError('Valid status (IN_TRANSIT, COMPLETED, CANCELLED) is required.')
      );
    }

    try {
      const transfer = await WarehouseTransfer.findById(id);
      if (!transfer) {
        return next(new NotFoundError('Transfer order not found.'));
      }

      const oldValues = transfer.toObject();

      // Guard state transitions
      if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
        return next(new ValidationError(`Cannot change status of a ${transfer.status} transfer.`));
      }

      if (status === 'IN_TRANSIT') {
        if (transfer.status !== 'PENDING') {
          return next(new ValidationError('Transfers can only go IN_TRANSIT from PENDING.'));
        }

        // Deduct from standard quantity, add to reserved
        for (const item of transfer.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.quantity -= item.quantity;
            product.reservedQuantity += item.quantity;
            await product.save();

            await StockMovement.create({
              productId: product._id,
              type: 'TRANSFER',
              quantity: -item.quantity,
              costPrice: product.costPrice || product.cost || 0,
              sellingPrice: product.sellingPrice || product.price || 0,
              referenceId: transfer._id.toString(),
              userId: req.user?.id,
              notes: `Stock dispatched in-transit under transfer: ${transfer.transferNumber}`,
            });
          }
        }

        transfer.status = 'IN_TRANSIT';
        transfer.shippedAt = new Date();
      } else if (status === 'COMPLETED') {
        if (transfer.status !== 'IN_TRANSIT') {
          return next(new ValidationError('Transfers can only be completed from IN_TRANSIT.'));
        }

        // Remove from reserved, add to standard quantity
        for (const item of transfer.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.reservedQuantity -= item.quantity;
            product.quantity += item.quantity;
            await product.save();

            await StockMovement.create({
              productId: product._id,
              type: 'TRANSFER',
              quantity: item.quantity,
              costPrice: product.costPrice || product.cost || 0,
              sellingPrice: product.sellingPrice || product.price || 0,
              referenceId: transfer._id.toString(),
              userId: req.user?.id,
              notes: `Stock received at destination warehouse under transfer: ${transfer.transferNumber}`,
            });
          }
        }

        transfer.status = 'COMPLETED';
        transfer.receivedAt = new Date();
        transfer.receivedBy = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      } else if (status === 'CANCELLED') {
        // Rollback reserved stock if it was already IN_TRANSIT
        if (transfer.status === 'IN_TRANSIT') {
          for (const item of transfer.items) {
            const product = await Product.findById(item.productId);
            if (product) {
              product.reservedQuantity -= item.quantity;
              product.quantity += item.quantity;
              await product.save();

              await StockMovement.create({
                productId: product._id,
                type: 'TRANSFER',
                quantity: item.quantity,
                costPrice: product.costPrice || product.cost || 0,
                sellingPrice: product.sellingPrice || product.price || 0,
                referenceId: transfer._id.toString(),
                userId: req.user?.id,
                notes: `Transfer ${transfer.transferNumber} cancelled. Dispatched stock returned to inventory.`,
              });
            }
          }
        }

        transfer.status = 'CANCELLED';
      }

      await transfer.save();
      await redis.del('products:all');

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'WarehouseTransfer',
        targetId: transfer._id.toString(),
        priorValues: oldValues,
        newValues: transfer.toObject(),
      });

      res.json(transfer);
    } catch (err: unknown) {
      next(err);
    }
  }
}
