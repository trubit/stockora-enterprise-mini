import type { Request, Response, NextFunction } from 'express';
import { ProcurementService } from '../services/procurement.service.js';
import { GoodsReceivingService } from '../services/goods-receiving.service.js';
import { ThreeWayMatchingService } from '../services/three-way-matching.service.js';
import { ProcurementCopilotService } from '../services/procurement-copilot.service.js';

export class ProcurementController {
  // --- Suppliers ---
  static async getSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const suppliers = await ProcurementService.getSuppliers({ ...req.query, tenantId });
      res.json(suppliers);
    } catch (err) {
      next(err);
    }
  }

  static async getSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const supplier = await ProcurementService.getSupplierById(id);
      res.json(supplier);
    } catch (err) {
      next(err);
    }
  }

  static async createSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const supplier = await ProcurementService.createSupplier({ ...req.body, tenantId });
      res.status(201).json(supplier);
    } catch (err) {
      next(err);
    }
  }

  static async addSupplierProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const userId = (req as any).user?.id;
      const product = await ProcurementService.addOrUpdateSupplierProduct({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = Array.isArray(req.params.supplierId)
        ? req.params.supplierId[0]
        : req.params.supplierId;
      const products = await ProcurementService.getSupplierProducts(supplierId);
      res.json(products);
    } catch (err) {
      next(err);
    }
  }

  // --- Purchase Requisitions & Orders ---
  static async getRequisitions(req: Request, res: Response, next: NextFunction) {
    try {
      const requisitions = await ProcurementService.getPurchaseRequisitions(req.query);
      res.json(requisitions);
    } catch (err) {
      next(err);
    }
  }

  static async createRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const userId = (req as any).user?.id || 'user-1';
      const requisition = await ProcurementService.createPurchaseRequisition({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json(requisition);
    } catch (err) {
      next(err);
    }
  }

  static async getPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const orders = await ProcurementService.getPurchaseOrders({ ...req.query, tenantId });
      res.json(orders);
    } catch (err) {
      next(err);
    }
  }

  static async createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const userId = (req as any).user?.id || 'user-1';
      const order = await ProcurementService.createPurchaseOrder({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  }

  static async approvePurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const userId = (req as any).user?.id || 'user-1';
      const order = await ProcurementService.approvePurchaseOrder(id, userId);
      res.json(order);
    } catch (err) {
      next(err);
    }
  }

  static async sendPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await ProcurementService.sendPurchaseOrderToSupplier(id);
      res.json(order);
    } catch (err) {
      next(err);
    }
  }

  static async confirmPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const tenantId = (req as any).user?.companyId?.toString();
      const confirmation = await ProcurementService.recordSupplierConfirmation({
        ...req.body,
        poId: id,
        tenantId,
      });
      res.json(confirmation);
    } catch (err) {
      next(err);
    }
  }

  // --- Goods Receiving & Quality Inspection ---
  static async getGoodsReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const receipts = await GoodsReceivingService.getGoodsReceipts({ ...req.query, tenantId });
      res.json(receipts);
    } catch (err) {
      next(err);
    }
  }

  static async receiveGoods(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const userId = (req as any).user?.id || 'user-1';
      const receipt = await GoodsReceivingService.receiveGoods({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json(receipt);
    } catch (err) {
      next(err);
    }
  }

  static async submitInspection(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const userId = (req as any).user?.id || 'user-1';
      const inspection = await GoodsReceivingService.submitQualityInspection({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json(inspection);
    } catch (err) {
      next(err);
    }
  }

  static async getSupplierReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const returns = await GoodsReceivingService.getSupplierReturns({ ...req.query, tenantId });
      res.json(returns);
    } catch (err) {
      next(err);
    }
  }

  static async createSupplierReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const userId = (req as any).user?.id || 'user-1';
      const supplierReturn = await GoodsReceivingService.createSupplierReturn({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json(supplierReturn);
    } catch (err) {
      next(err);
    }
  }

  // --- Three-Way Matching ---
  static async getInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const invoices = await ThreeWayMatchingService.getInvoices({ ...req.query, tenantId });
      res.json(invoices);
    } catch (err) {
      next(err);
    }
  }

  static async submitInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = (req as any).user?.companyId?.toString();
      const invoice = await ThreeWayMatchingService.submitAndMatchInvoice({
        ...req.body,
        tenantId,
      });
      res.status(201).json(invoice);
    } catch (err) {
      next(err);
    }
  }

  // --- AI Procurement Intelligence ---
  static async compareSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = Array.isArray(req.params.productId)
        ? req.params.productId[0]
        : req.params.productId;
      const comparison = await ProcurementCopilotService.compareSuppliersForProduct(productId);
      res.json(comparison);
    } catch (err) {
      next(err);
    }
  }

  static async getReorderRecommendations(_req: Request, res: Response, next: NextFunction) {
    try {
      const recommendations = await ProcurementCopilotService.getReorderRecommendations();
      res.json(recommendations);
    } catch (err) {
      next(err);
    }
  }

  static async queryCopilot(req: Request, res: Response, next: NextFunction) {
    try {
      const { prompt } = req.body;
      const response = await ProcurementCopilotService.askProcurementCopilot(prompt || '');
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
