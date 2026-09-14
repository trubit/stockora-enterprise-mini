import type { Response, NextFunction } from 'express';
import { Company } from '../models/Company.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { MasterData } from '../models/MasterData.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export class OrgController {
  // --- Company ---
  public static async getCompany(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const filter = tenantId ? { tenantId } : {};
      let company = await Company.findOne(filter);
      if (!company && !tenantId) {
        company = await Company.findOne();
      }
      res.json(company || null);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createCompany(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { name, currency, timeZone, address, phone, legalName, email, website } = req.body;
    if (!name) {
      return next(new ValidationError('Company name is required.'));
    }

    try {
      const tenantId = req.tenantId;
      if (tenantId) {
        const existing = await Company.findOne({ tenantId });
        if (existing) {
          return next(new ValidationError('Company profile already exists for this tenant.'));
        }
      }

      const company = await Company.create({
        tenantId: tenantId || undefined,
        name,
        legalName: legalName || name,
        currency: currency || 'USD',
        timeZone: timeZone || 'UTC',
        address,
        phone,
        email,
        website,
      });

      await AuditLog.create({
        userId: req.user?.id,
        tenantId: req.tenantId,
        action: 'CREATE',
        targetModel: 'Company',
        targetId: company._id.toString(),
        newValues: company.toObject(),
      });

      res.status(201).json(company);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async updateCompany(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const filter = tenantId ? { tenantId } : {};
      let company = await Company.findOne(filter);
      if (!company) {
        company = await Company.findOne();
      }
      if (!company) {
        return next(new NotFoundError('Company not found.'));
      }

      const prevObj = company.toObject();
      const updatableData = { ...req.body };
      delete updatableData._id;
      delete updatableData.id;
      delete updatableData.createdAt;
      delete updatableData.updatedAt;
      delete updatableData.__v;
      Object.assign(company, updatableData);
      await company.save();

      await AuditLog.create({
        userId: req.user?.id,
        tenantId: req.tenantId,
        action: 'UPDATE',
        targetModel: 'Company',
        targetId: company._id.toString(),
        previousValues: prevObj,
        newValues: company.toObject(),
      });

      res.json(company);
    } catch (err: unknown) {
      next(err);
    }
  }

  // --- Branch ---
  public static async listBranches(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const filter = tenantId ? { tenantId } : {};
      const branches = await Branch.find(filter).sort({ name: 1 });
      res.json(branches);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createBranch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { companyId, name, code, address, phone, email, timezone } = req.body;
    if (!name || !code) {
      return next(new ValidationError('Name and branch code are required.'));
    }

    try {
      const tenantId = req.tenantId;
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId && tenantId) {
        const company = await Company.findOne({ tenantId });
        resolvedCompanyId = company?._id;
      }

      const existingBranch = await Branch.findOne({
        ...(tenantId ? { tenantId } : {}),
        code: code.toUpperCase(),
      });
      if (existingBranch) {
        return next(new ValidationError(`Branch code [${code.toUpperCase()}] already exists.`));
      }

      const branch = await Branch.create({
        tenantId: tenantId || undefined,
        companyId: resolvedCompanyId,
        name,
        code: code.toUpperCase(),
        address,
        phone,
        email,
        timezone: timezone || 'UTC',
      });

      await AuditLog.create({
        userId: req.user?.id,
        tenantId: req.tenantId,
        action: 'CREATE',
        targetModel: 'Branch',
        targetId: branch._id.toString(),
        newValues: branch.toObject(),
      });

      res.status(201).json(branch);
    } catch (err: unknown) {
      next(err);
    }
  }

  // --- Warehouse ---
  public static async listWarehouses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const filter = tenantId ? { tenantId } : {};
      const warehouses = await Warehouse.find(filter).sort({ name: 1 });
      res.json(warehouses);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createWarehouse(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { branchId, name, code, zones, capacity, warehouseType } = req.body;
    if (!branchId || !name || !code) {
      return next(new ValidationError('Branch ID, name, and code are required.'));
    }

    try {
      const tenantId = req.tenantId;
      const existingWarehouse = await Warehouse.findOne({
        ...(tenantId ? { tenantId } : {}),
        code: code.toUpperCase(),
      });
      if (existingWarehouse) {
        return next(new ValidationError(`Warehouse code [${code.toUpperCase()}] already exists.`));
      }

      const warehouse = await Warehouse.create({
        tenantId: tenantId || undefined,
        branchId,
        name,
        code: code.toUpperCase(),
        warehouseType: warehouseType || 'MAIN',
        zones,
        capacity,
      });

      await AuditLog.create({
        userId: req.user?.id,
        tenantId: req.tenantId,
        action: 'CREATE',
        targetModel: 'Warehouse',
        targetId: warehouse._id.toString(),
        newValues: warehouse.toObject(),
      });

      res.status(201).json(warehouse);
    } catch (err: unknown) {
      next(err);
    }
  }

  // --- Master Data ---
  public static async listMasterData(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { type } = req.query;
    const filter: Record<string, unknown> = type ? { type: String(type).toUpperCase() } : {};
    try {
      const masterList = await MasterData.find(filter);
      res.json(masterList);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createMasterData(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { type, name, code, value } = req.body;
    if (!type || !name || !code) {
      return next(new ValidationError('Type, name, and code are required.'));
    }

    try {
      const data = await MasterData.create({ type: type.toUpperCase(), name, code, value });

      await AuditLog.create({
        userId: req.user?.id,
        tenantId: req.tenantId,
        action: 'CREATE',
        targetModel: 'MasterData',
        targetId: data._id.toString(),
        newValues: data.toObject(),
      });

      res.status(201).json(data);
    } catch (err: unknown) {
      next(err);
    }
  }
}
