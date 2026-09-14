import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Supplier } from '../models/Supplier.js';
import { SupplierProduct } from '../models/SupplierProduct.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { QualityInspection } from '../models/QualityInspection.js';
import { SupplierReturn } from '../models/SupplierReturn.js';
import { SupplierInvoice } from '../models/SupplierInvoice.js';
import { ProcurementAdvancedService } from '../services/procurementAdvanced.service.js';
import { SupplierPerformanceService } from '../services/supplierPerformance.service.js';
import { ThreeWayMatchAdvancedService } from '../services/threeWayMatchAdvanced.service.js';
import { SupplierAdapterService } from '../services/supplierAdapter.service.js';
import { ProcurementAnalyticsService } from '../services/procurementAnalytics.service.js';

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

export class ProcurementAdvancedController {
  // Suppliers
  public static async listSuppliers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const suppliers = await Supplier.find(buildTenantQuery(user)).sort({ name: 1 }).lean();
      res.json(suppliers);
    } catch (err) {
      next(err);
    }
  }

  public static async createSupplier(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const companyId =
        user?.companyId && mongoose.isValidObjectId(user.companyId) ? user.companyId : undefined;
      const supplier = await Supplier.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId,
      });
      res.status(201).json(supplier);
    } catch (err) {
      next(err);
    }
  }

  public static async getSupplierScorecard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const supplierId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const scorecard = await SupplierPerformanceService.calculateSupplierScorecard(supplierId);
      res.json(scorecard);
    } catch (err) {
      next(err);
    }
  }

  // Supplier Products
  public static async listSupplierProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const products = await SupplierProduct.find(buildTenantQuery(user))
        .populate('supplierId productId')
        .lean();
      res.json(products);
    } catch (err) {
      next(err);
    }
  }

  public static async addSupplierProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const companyId =
        user?.companyId && mongoose.isValidObjectId(user.companyId) ? user.companyId : undefined;
      const sp = await SupplierProduct.create({
        ...req.body,
        tenantId: user?.tenantId || 'default',
        companyId,
      });
      res.status(201).json(sp);
    } catch (err) {
      next(err);
    }
  }

  // Requisitions
  public static async listRequisitions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const reqs = await PurchaseRequisition.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(reqs);
    } catch (err) {
      next(err);
    }
  }

  public static async createRequisition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const requisition = await ProcurementAdvancedService.createPurchaseRequest({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        userId: user?.id,
        userName: user?.username,
      });
      res.status(201).json(requisition);
    } catch (err) {
      next(err);
    }
  }

  public static async approveRequisition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reqDoc = await ProcurementAdvancedService.approvePurchaseRequest(
        id,
        user?.id || 'admin',
        user?.username || 'Admin'
      );
      res.json(reqDoc);
    } catch (err) {
      next(err);
    }
  }

  // Purchase Orders
  public static async listPurchaseOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const pos = await PurchaseOrder.find(buildTenantQuery(user)).sort({ createdAt: -1 }).lean();
      res.json(pos);
    } catch (err) {
      next(err);
    }
  }

  public static async createPurchaseOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const po = await ProcurementAdvancedService.createPurchaseOrder({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        userId: user?.id,
        userName: user?.username,
      });
      res.status(201).json(po);
    } catch (err) {
      next(err);
    }
  }

  public static async revisePurchaseOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const po = await ProcurementAdvancedService.revisePurchaseOrder(
        id,
        req.body,
        user?.id || 'admin',
        user?.username || 'Admin',
        req.body.reason
      );
      res.json(po);
    } catch (err) {
      next(err);
    }
  }

  public static async confirmSupplierPO(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const confirmation = await ProcurementAdvancedService.processSupplierConfirmation(
        id,
        req.body.status,
        req.body.confirmedDeliveryDate ? new Date(req.body.confirmedDeliveryDate) : undefined,
        req.body.notes
      );
      res.json(confirmation);
    } catch (err) {
      next(err);
    }
  }

  // Receiving
  public static async listReceiving(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const grns = await GoodsReceipt.find(buildTenantQuery(user)).sort({ createdAt: -1 }).lean();
      res.json(grns);
    } catch (err) {
      next(err);
    }
  }

  public static async processReceiving(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const grn = await ProcurementAdvancedService.processGoodsReceiving({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        receivedBy: user?.id || 'clerk',
        receivedByName: user?.username || 'Receiving Clerk',
      });
      res.status(201).json(grn);
    } catch (err) {
      next(err);
    }
  }

  // Inspections
  public static async listInspections(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const inspections = await QualityInspection.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(inspections);
    } catch (err) {
      next(err);
    }
  }

  public static async processInspection(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const qi = await ProcurementAdvancedService.processQualityInspection({
        ...req.body,
        inspectorId: user?.id || 'qa',
        inspectorName: user?.username || 'QA Inspector',
      });
      res.status(201).json(qi);
    } catch (err) {
      next(err);
    }
  }

  // Returns
  public static async listReturns(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const returnsDoc = await SupplierReturn.find({}).sort({ createdAt: -1 }).lean();
      res.json(returnsDoc);
    } catch (err) {
      next(err);
    }
  }

  public static async createReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const ret = await ProcurementAdvancedService.createSupplierReturn({
        ...req.body,
        createdById: user?.id || 'admin',
        createdByName: user?.username || 'Admin',
      });
      res.status(201).json(ret);
    } catch (err) {
      next(err);
    }
  }

  // 3-Way Matching
  public static async listInvoices(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const invoices = await SupplierInvoice.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(invoices);
    } catch (err) {
      next(err);
    }
  }

  public static async matchInvoice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const result = await ThreeWayMatchAdvancedService.processThreeWayMatch({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async approveMatchException(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const matchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const matchDoc = await ThreeWayMatchAdvancedService.approveMatchException(
        matchId,
        user?.id || 'admin',
        user?.username || 'Finance Approver',
        req.body.notes
      );
      res.json(matchDoc);
    } catch (err) {
      next(err);
    }
  }

  // Webhooks
  public static async handleExternalSupplierWebhook(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const supplierId = Array.isArray(req.params.supplierId)
        ? req.params.supplierId[0]
        : req.params.supplierId;
      const rawBody = JSON.stringify(req.body);
      const result = await SupplierAdapterService.processExternalSupplierWebhook(
        supplierId,
        rawBody,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Analytics
  public static async getAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const analytics = await ProcurementAnalyticsService.getProcurementAnalytics(
        user?.tenantId,
        user?.companyId
      );
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  }
}
