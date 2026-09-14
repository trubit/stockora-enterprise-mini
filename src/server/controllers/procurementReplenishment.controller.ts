import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SupplierContract } from '../models/SupplierContract.js';
import { ReplenishmentRule } from '../models/ReplenishmentRule.js';
import { ReorderRecommendation } from '../models/ReorderRecommendation.js';
import { LandedCostAllocation } from '../models/LandedCostAllocation.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { ProcurementBudget } from '../models/ProcurementBudget.js';
import { SupplierManagementAdvancedService } from '../services/supplierManagementAdvanced.service.js';
import { ReplenishmentEngineAdvancedService } from '../services/replenishmentEngineAdvanced.service.js';
import { PurchaseOrderVersioningService } from '../services/purchaseOrderVersioning.service.js';
import { LandedCostAdvancedService } from '../services/landedCostAdvanced.service.js';

function buildTenantQuery(user: any): any {
  const query: any = {};
  if (user?.tenantId) {
    query.tenantId = user.tenantId;
  }
  if (user?.companyId && mongoose.isValidObjectId(user.companyId)) {
    query.companyId = new mongoose.Types.ObjectId(user.companyId);
  }
  return query;
}

export class ProcurementReplenishmentController {
  // Contracts
  public static async listContracts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const contracts = await SupplierContract.find(buildTenantQuery(user))
        .populate('supplierId')
        .sort({ endDate: 1 })
        .lean();
      res.json(contracts);
    } catch (err) {
      next(err);
    }
  }

  public static async createContract(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const contract = await SupplierContract.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId:
          user?.companyId && mongoose.isValidObjectId(user.companyId) ? user.companyId : undefined,
        createdBy: user?.id,
      });
      res.status(201).json(contract);
    } catch (err) {
      next(err);
    }
  }

  // Supplier Ranking
  public static async rankSuppliers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const productId = Array.isArray(req.params.productId)
        ? req.params.productId[0]
        : req.params.productId || '';
      const qty = req.query.quantity ? Number(req.query.quantity) : 1;
      const ranking = await SupplierManagementAdvancedService.rankSuppliersForProduct(
        productId,
        qty,
        user?.tenantId
      );
      res.json(ranking);
    } catch (err) {
      next(err);
    }
  }

  // Replenishment Rules & Recommendations
  public static async listReplenishmentRules(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const rules = await ReplenishmentRule.find(buildTenantQuery(user))
        .populate('productId warehouseId')
        .lean();
      res.json(rules);
    } catch (err) {
      next(err);
    }
  }

  public static async createOrUpdateReplenishmentRule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const rule = await ReplenishmentRule.findOneAndUpdate(
        {
          tenantId: user?.tenantId || 'default',
          productId: req.body.productId,
          warehouseId: req.body.warehouseId || null,
        },
        {
          ...req.body,
          tenantId: user?.tenantId || 'default',
          companyId:
            user?.companyId && mongoose.isValidObjectId(user.companyId)
              ? user.companyId
              : undefined,
        },
        { upsert: true, new: true }
      );
      res.status(200).json(rule);
    } catch (err) {
      next(err);
    }
  }

  public static async listRecommendations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const recs = await ReorderRecommendation.find(buildTenantQuery(user))
        .populate('productId supplierId warehouseId')
        .sort({ createdAt: -1 })
        .lean();
      res.json(recs);
    } catch (err) {
      next(err);
    }
  }

  public static async calculateProductReplenishment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const rec = await ReplenishmentEngineAdvancedService.calculateProductReplenishment({
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        warehouseId: req.body.warehouseId,
        productId: req.body.productId,
      });
      res.status(201).json(rec);
    } catch (err) {
      next(err);
    }
  }

  public static async convertRecommendationToPR(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const pr = await ReplenishmentEngineAdvancedService.convertRecommendationToPurchaseRequest(
        id,
        user?.id,
        user?.username
      );
      res.status(201).json(pr);
    } catch (err) {
      next(err);
    }
  }

  // PO Versioning & Supplier Acknowledgements
  public static async revisePO(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const po = await PurchaseOrderVersioningService.revisePurchaseOrder(id, {
        ...req.body,
        userId: user?.id,
        userName: user?.username,
      });
      res.json(po);
    } catch (err) {
      next(err);
    }
  }

  public static async acknowledgePO(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const po = await PurchaseOrderVersioningService.recordSupplierAcknowledgement(
        id,
        req.body.status,
        req.body.counterProposal
      );
      res.json(po);
    } catch (err) {
      next(err);
    }
  }

  public static async resolveCounterProposal(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const po = await PurchaseOrderVersioningService.resolveSupplierCounterProposal(
        id,
        req.body.action,
        user?.id,
        user?.username
      );
      res.json(po);
    } catch (err) {
      next(err);
    }
  }

  // Landed Costs
  public static async listLandedCosts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const costs = await LandedCostAllocation.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(costs);
    } catch (err) {
      next(err);
    }
  }

  public static async applyLandedCost(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const allocation = await LandedCostAdvancedService.createAndApplyLandedCost({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        appliedBy: user?.id,
      });
      res.status(201).json(allocation);
    } catch (err) {
      next(err);
    }
  }

  // Procurement Budgets
  public static async listBudgets(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const budgets = await ProcurementBudget.find(buildTenantQuery(user))
        .sort({ fiscalYear: -1 })
        .lean();
      res.json(budgets);
    } catch (err) {
      next(err);
    }
  }

  public static async createBudget(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const budget = await ProcurementBudget.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId:
          user?.companyId && mongoose.isValidObjectId(user.companyId) ? user.companyId : undefined,
      });
      res.status(201).json(budget);
    } catch (err) {
      next(err);
    }
  }
}
