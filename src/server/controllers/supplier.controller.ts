import type { Response, NextFunction } from 'express';
import { Supplier } from '../models/Supplier.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class SupplierController {
  public static async getSuppliers(
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

      const suppliers = await Supplier.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      res.json(suppliers);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getSupplier(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const supplier = await Supplier.findOne(query).lean();
      if (!supplier) {
        return next(new NotFoundError('Supplier not found.'));
      }
      res.json(supplier);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createSupplier(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { name, code, contactPerson, email, phone, address, ...rest } = req.body;

    if (!name || !code || !contactPerson || !email || !phone || !address) {
      return next(
        new ValidationError('Name, code, contactPerson, email, phone, and address are required.')
      );
    }

    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId || 'default';
      const codeQuery: Record<string, unknown> = { code: code.toUpperCase() };
      if (tenantId) codeQuery.tenantId = tenantId;

      const existing = await Supplier.findOne(codeQuery);
      if (existing) {
        return next(new ValidationError(`Supplier code [${code}] already exists.`));
      }

      const supplier = await Supplier.create({
        tenantId,
        name,
        code: code.toUpperCase(),
        contactPerson,
        email,
        phone,
        address,
        ...rest,
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'Supplier',
        targetId: supplier._id.toString(),
        newValues: supplier.toObject(),
      });

      res.status(201).json(supplier);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateSupplier(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const supplier = await Supplier.findOne(query);
      if (!supplier) {
        return next(new NotFoundError('Supplier not found.'));
      }

      const oldValues = supplier.toObject();

      const { code } = req.body;
      const updatableData = { ...req.body };
      delete updatableData.code;
      delete updatableData._id;
      delete updatableData.id;
      delete updatableData.createdAt;
      delete updatableData.updatedAt;
      delete updatableData.__v;

      if (code && code.toUpperCase() !== supplier.code) {
        const codeQuery: Record<string, unknown> = { code: code.toUpperCase() };
        if (tenantId) codeQuery.tenantId = tenantId;
        const existing = await Supplier.findOne(codeQuery);
        if (existing) {
          return next(new ValidationError(`Supplier code [${code}] already exists.`));
        }
        supplier.code = code.toUpperCase();
      }

      Object.assign(supplier, updatableData);
      await supplier.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'Supplier',
        targetId: supplier._id.toString(),
        priorValues: oldValues,
        newValues: supplier.toObject(),
      });

      res.json(supplier);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async deleteSupplier(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const supplier = await Supplier.findOne(query);
      if (!supplier) {
        return next(new NotFoundError('Supplier not found.'));
      }

      const oldValues = supplier.toObject();
      supplier.isActive = false;
      await supplier.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'DELETE',
        targetModel: 'Supplier',
        targetId: supplier._id.toString(),
        priorValues: oldValues,
        newValues: supplier.toObject(),
      });

      res.json({ message: 'Supplier deactivated successfully.', supplier });
    } catch (err: unknown) {
      next(err);
    }
  }
}
