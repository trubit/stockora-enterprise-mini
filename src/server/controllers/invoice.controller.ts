import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SupplierInvoice } from '../models/SupplierInvoice.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class InvoiceController {
  public static async listInvoices(
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

      const invoices = await SupplierInvoice.find(filter)
        .populate('supplierId', 'name code email')
        .populate('poId', 'poNumber totalAmount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      res.json(invoices);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createInvoice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { invoiceNumber, poId, supplierId, amount, dueDate, paymentTerms, notes } = req.body;

    if (!invoiceNumber || !poId || !supplierId || amount === undefined || !dueDate) {
      return next(
        new ValidationError('invoiceNumber, poId, supplierId, amount, and dueDate are required.')
      );
    }

    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId || 'default';
      const poQuery: Record<string, unknown> = { _id: poId };
      if (tenantId) poQuery.tenantId = tenantId;

      const po = await PurchaseOrder.findOne(poQuery);
      if (!po) {
        return next(new NotFoundError('Purchase Order not found.'));
      }

      const invoiceQuery: Record<string, unknown> = { invoiceNumber };
      if (tenantId) invoiceQuery.tenantId = tenantId;

      const existingInvoice = await SupplierInvoice.findOne(invoiceQuery);
      if (existingInvoice) {
        return next(new ValidationError(`Invoice [${invoiceNumber}] already registered.`));
      }

      const invoice = await SupplierInvoice.create({
        tenantId,
        invoiceNumber,
        poId: new mongoose.Types.ObjectId(poId),
        supplierId: new mongoose.Types.ObjectId(supplierId),
        amount: Number(amount),
        dueDate: new Date(dueDate),
        paymentTerms: paymentTerms || 'NET 30',
        notes,
        status: 'UNPAID',
      });

      // Transition PO state to BILLED
      po.status = 'BILLED';
      await po.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'SupplierInvoice',
        targetId: invoice._id.toString(),
        newValues: invoice.toObject(),
      });

      res.status(201).json(invoice);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async payInvoice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const invoice = await SupplierInvoice.findOne(query);
      if (!invoice) {
        return next(new NotFoundError('Invoice not found.'));
      }

      if (invoice.status === 'PAID') {
        return next(new ValidationError('Invoice is already paid.'));
      }

      const oldValues = invoice.toObject();
      invoice.status = 'PAID';
      await invoice.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'SupplierInvoice',
        targetId: invoice._id.toString(),
        priorValues: oldValues,
        newValues: invoice.toObject(),
      });

      res.json(invoice);
    } catch (err: unknown) {
      next(err);
    }
  }
}
