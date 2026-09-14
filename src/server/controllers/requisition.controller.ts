import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class RequisitionController {
  public static async listRequisitions(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requisitions = await PurchaseRequisition.find()
        .populate('requestedBy', 'username email')
        .populate('items.productId', 'name sku uom')
        .populate('approvedBy', 'username email')
        .sort({ createdAt: -1 })
        .lean();
      res.json(requisitions);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createRequisition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new ValidationError('A non-empty items array is required.'));
    }

    try {
      const requisitionNumber = `REQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const requisition = await PurchaseRequisition.create({
        requisitionNumber,
        requestedBy: new mongoose.Types.ObjectId(req.user?.id),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          estimatedCost: Number(i.estimatedCost || 0),
        })),
        notes,
        status: 'PENDING_APPROVAL',
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'PurchaseRequisition',
        targetId: requisition._id.toString(),
        newValues: requisition.toObject(),
      });

      res.status(201).json(requisition);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async approveRequisition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const requisition = await PurchaseRequisition.findById(id);
      if (!requisition) {
        return next(new NotFoundError('Requisition not found.'));
      }

      if (requisition.status !== 'PENDING_APPROVAL') {
        return next(new ValidationError(`Requisition status is already ${requisition.status}.`));
      }

      const oldValues = requisition.toObject();
      requisition.status = 'APPROVED';
      requisition.approvedBy = new mongoose.Types.ObjectId(req.user?.id);
      await requisition.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'PurchaseRequisition',
        targetId: requisition._id.toString(),
        priorValues: oldValues,
        newValues: requisition.toObject(),
      });

      res.json(requisition);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async rejectRequisition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const requisition = await PurchaseRequisition.findById(id);
      if (!requisition) {
        return next(new NotFoundError('Requisition not found.'));
      }

      if (requisition.status !== 'PENDING_APPROVAL') {
        return next(new ValidationError(`Requisition status is already ${requisition.status}.`));
      }

      const oldValues = requisition.toObject();
      requisition.status = 'REJECTED';
      requisition.approvedBy = new mongoose.Types.ObjectId(req.user?.id);
      await requisition.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'PurchaseRequisition',
        targetId: requisition._id.toString(),
        priorValues: oldValues,
        newValues: requisition.toObject(),
      });

      res.json(requisition);
    } catch (err: unknown) {
      next(err);
    }
  }
}
