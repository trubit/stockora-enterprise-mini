import type { Response, NextFunction } from 'express';
import { Customer } from '../models/Customer.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class CustomerController {
  public static async getCustomers(
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

      const customers = await Customer.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      res.json(customers);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const customer = await Customer.findOne(query).lean();
      if (!customer) {
        return next(new NotFoundError('Customer not found.'));
      }
      res.json(customer);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { name, code, email, phone, ...rest } = req.body;

    if (!name || !code || !email) {
      return next(new ValidationError('Name, code, and email are required.'));
    }

    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId || 'default';
      const codeQuery: Record<string, unknown> = { code: code.toUpperCase() };
      const emailQuery: Record<string, unknown> = { email: email.toLowerCase() };
      if (tenantId) {
        codeQuery.tenantId = tenantId;
        emailQuery.tenantId = tenantId;
      }

      const existingCode = await Customer.findOne(codeQuery);
      if (existingCode) {
        return next(new ValidationError(`Customer code [${code}] already exists.`));
      }

      const existingEmail = await Customer.findOne(emailQuery);
      if (existingEmail) {
        return next(new ValidationError(`Customer email [${email}] is already registered.`));
      }

      const customer = await Customer.create({
        tenantId,
        name,
        code: code.toUpperCase(),
        email: email.toLowerCase(),
        phone,
        ...rest,
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'Customer',
        targetId: customer._id.toString(),
        newValues: customer.toObject(),
      });

      res.status(201).json(customer);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const customer = await Customer.findOne(query);
      if (!customer) {
        return next(new NotFoundError('Customer not found.'));
      }

      const oldValues = customer.toObject();

      const { code, email } = req.body;
      const updatableData = { ...req.body };
      delete updatableData.code;
      delete updatableData.email;
      delete updatableData._id;
      delete updatableData.id;
      delete updatableData.createdAt;
      delete updatableData.updatedAt;
      delete updatableData.__v;

      if (code && code.toUpperCase() !== customer.code) {
        const codeQuery: Record<string, unknown> = { code: code.toUpperCase() };
        if (tenantId) codeQuery.tenantId = tenantId;
        const existingCode = await Customer.findOne(codeQuery);
        if (existingCode) {
          return next(new ValidationError(`Customer code [${code}] already exists.`));
        }
        customer.code = code.toUpperCase();
      }

      if (email && email.toLowerCase() !== customer.email) {
        const emailQuery: Record<string, unknown> = { email: email.toLowerCase() };
        if (tenantId) emailQuery.tenantId = tenantId;
        const existingEmail = await Customer.findOne(emailQuery);
        if (existingEmail) {
          return next(new ValidationError(`Customer email [${email}] is already registered.`));
        }
        customer.email = email.toLowerCase();
      }

      Object.assign(customer, updatableData);
      await customer.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'Customer',
        targetId: customer._id.toString(),
        priorValues: oldValues,
        newValues: customer.toObject(),
      });

      res.json(customer);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async deleteCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const tenantId = (req as any).tenantId || req.user?.tenantId;
      const query: Record<string, unknown> = { _id: id };
      if (tenantId) query.tenantId = tenantId;

      const customer = await Customer.findOne(query);
      if (!customer) {
        return next(new NotFoundError('Customer not found.'));
      }

      const oldValues = customer.toObject();
      customer.isActive = false;
      await customer.save();

      await AuditLog.create({
        userId: req.user?.id,
        action: 'DELETE',
        targetModel: 'Customer',
        targetId: customer._id.toString(),
        priorValues: oldValues,
        newValues: customer.toObject(),
      });

      res.json({ message: 'Customer deactivated successfully.', customer });
    } catch (err: unknown) {
      next(err);
    }
  }
}
