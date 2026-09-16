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
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const filter: Record<string, unknown> = {};
      if (tenantId) {
        filter.tenantId = tenantId;
      }

      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * limit;

      const transfers = await WarehouseTransfer.find(filter)
        .populate('fromWarehouseId', 'name code')
        .populate('toWarehouseId', 'name code')
        .populate('items.productId', 'name sku uom')
        .populate('createdBy', 'username email')
        .populate('receivedBy', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
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
      const tenantId = (req as any).tenantId || req.user?.tenantId || 'default';

      // Validate item quantities and existence
      for (const item of items) {
        const productQuery: Record<string, unknown> = { _id: item.productId };
        if (tenantId) productQuery.tenantId = tenantId;
        const product = await Product.findOne(productQuery);
        if (!product) {
          return next(new NotFoundError(`Product [${item.productId}] not found.`));
        }
        if (product.quantity < item.quantity) {
          return next(
            new ValidationError(
              `Insufficient stock for ${product.name} (SKU: ${product.sku}). Available: ${product.quantity}, Requested: ${item.quantity}`
            )
          );
        }
      }

      const transferNumber = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const formattedItems = items.map((i) => ({
        productId: new mongoose.Types.ObjectId(i.productId),
        quantity: Number(i.quantity),
      }));

      const transfer = await WarehouseTransfer.create({
        tenantId,
        transferNumber,
        fromWarehouseId: new mongoose.Types.ObjectId(fromWarehouseId),
        toWarehouseId: new mongoose.Types.ObjectId(toWarehouseId),
        items: formattedItems,
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
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const transfer = await WarehouseTransfer.findOne(query);
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

        // Deduct from standard quantity, add to reserved atomically
        for (const item of transfer.items) {
          const updated = await Product.findOneAndUpdate(
            { _id: item.productId, quantity: { $gte: item.quantity } },
            { $inc: { quantity: -item.quantity, reservedQuantity: item.quantity } },
            { new: true }
          );

          if (!updated) {
            return next(
              new ValidationError(
                `Insufficient stock to dispatch item ${item.productId} for transfer.`
              )
            );
          }

          await StockMovement.create({
            tenantId: transfer.tenantId,
            productId: updated._id,
            type: 'TRANSFER',
            quantity: -item.quantity,
            costPrice: updated.costPrice || updated.cost || 0,
            sellingPrice: updated.sellingPrice || updated.price || 0,
            referenceId: transfer._id.toString(),
            userId: req.user?.id,
            notes: `Stock dispatched in-transit under transfer: ${transfer.transferNumber}`,
          });
        }

        transfer.status = 'IN_TRANSIT';
        transfer.shippedAt = new Date();
      } else if (status === 'COMPLETED') {
        if (transfer.status !== 'IN_TRANSIT') {
          return next(new ValidationError('Transfers can only be completed from IN_TRANSIT.'));
        }

        // Remove from reserved, add to destination standard quantity atomically
        for (const item of transfer.items) {
          const updated = await Product.findOneAndUpdate(
            { _id: item.productId },
            { $inc: { reservedQuantity: -item.quantity, quantity: item.quantity } },
            { new: true }
          );

          if (updated) {
            await StockMovement.create({
              tenantId: transfer.tenantId,
              productId: updated._id,
              type: 'TRANSFER',
              quantity: item.quantity,
              costPrice: updated.costPrice || updated.cost || 0,
              sellingPrice: updated.sellingPrice || updated.price || 0,
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
        // Rollback reserved stock atomically if it was already IN_TRANSIT
        if (transfer.status === 'IN_TRANSIT') {
          for (const item of transfer.items) {
            const updated = await Product.findOneAndUpdate(
              { _id: item.productId },
              { $inc: { reservedQuantity: -item.quantity, quantity: item.quantity } },
              { new: true }
            );

            if (updated) {
              await StockMovement.create({
                tenantId: transfer.tenantId,
                productId: updated._id,
                type: 'TRANSFER',
                quantity: item.quantity,
                costPrice: updated.costPrice || updated.cost || 0,
                sellingPrice: updated.sellingPrice || updated.price || 0,
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
      if (transfer.tenantId) {
        await redis.del(`tenant:${transfer.tenantId}:products:all`);
      }

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
