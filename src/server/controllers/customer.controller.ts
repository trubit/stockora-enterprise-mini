import type { Response, NextFunction } from 'express';
import { Customer } from '../models/Customer.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class CustomerController {
  public static async getCustomers(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customers = await Customer.find().lean();
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
      const customer = await Customer.findById(id).lean();
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
      const existingCode = await Customer.findOne({ code: code.toUpperCase() });
      if (existingCode) {
        return next(new ValidationError(`Customer code [${code}] already exists.`));
      }

      const existingEmail = await Customer.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return next(new ValidationError(`Customer email [${email}] is already registered.`));
      }

      const customer = await Customer.create({
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
      const customer = await Customer.findById(id);
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
        const existingCode = await Customer.findOne({ code: code.toUpperCase() });
        if (existingCode) {
          return next(new ValidationError(`Customer code [${code}] already exists.`));
        }
        customer.code = code.toUpperCase();
      }

      if (email && email.toLowerCase() !== customer.email) {
        const existingEmail = await Customer.findOne({ email: email.toLowerCase() });
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
      const customer = await Customer.findById(id);
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
