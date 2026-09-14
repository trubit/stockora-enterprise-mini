import { Router } from 'express';
import { ProcurementAdvancedController } from '../controllers/procurementAdvanced.controller.js';
import { authenticate } from '../middleware/auth.js';

export const procurementAdvancedRouter = Router();

// External supplier webhook (public with HMAC verification)
procurementAdvancedRouter.post(
  '/webhooks/:supplierId',
  ProcurementAdvancedController.handleExternalSupplierWebhook
);

procurementAdvancedRouter.use(authenticate);

// Suppliers & Scorecards
procurementAdvancedRouter.get('/suppliers', ProcurementAdvancedController.listSuppliers);
procurementAdvancedRouter.post('/suppliers', ProcurementAdvancedController.createSupplier);
procurementAdvancedRouter.get(
  '/suppliers/:id/scorecard',
  ProcurementAdvancedController.getSupplierScorecard
);

// Supplier Products
procurementAdvancedRouter.get(
  '/supplier-products',
  ProcurementAdvancedController.listSupplierProducts
);
procurementAdvancedRouter.post(
  '/supplier-products',
  ProcurementAdvancedController.addSupplierProduct
);

// Requisitions
procurementAdvancedRouter.get('/requests', ProcurementAdvancedController.listRequisitions);
procurementAdvancedRouter.post('/requests', ProcurementAdvancedController.createRequisition);
procurementAdvancedRouter.post(
  '/requests/:id/approve',
  ProcurementAdvancedController.approveRequisition
);

// Purchase Orders
procurementAdvancedRouter.get('/purchase-orders', ProcurementAdvancedController.listPurchaseOrders);
procurementAdvancedRouter.post(
  '/purchase-orders',
  ProcurementAdvancedController.createPurchaseOrder
);
procurementAdvancedRouter.post(
  '/purchase-orders/:id/revise',
  ProcurementAdvancedController.revisePurchaseOrder
);
procurementAdvancedRouter.post(
  '/purchase-orders/:id/confirm',
  ProcurementAdvancedController.confirmSupplierPO
);

// Goods Receiving
procurementAdvancedRouter.get('/receiving', ProcurementAdvancedController.listReceiving);
procurementAdvancedRouter.post('/receiving', ProcurementAdvancedController.processReceiving);

// Quality Inspections
procurementAdvancedRouter.get('/inspections', ProcurementAdvancedController.listInspections);
procurementAdvancedRouter.post('/inspections', ProcurementAdvancedController.processInspection);

// Supplier Returns
procurementAdvancedRouter.get('/returns', ProcurementAdvancedController.listReturns);
procurementAdvancedRouter.post('/returns', ProcurementAdvancedController.createReturn);

// 3-Way Matching & Invoices
procurementAdvancedRouter.get('/invoices', ProcurementAdvancedController.listInvoices);
procurementAdvancedRouter.post('/match-invoice', ProcurementAdvancedController.matchInvoice);
procurementAdvancedRouter.post(
  '/matches/:id/approve',
  ProcurementAdvancedController.approveMatchException
);

// Analytics
procurementAdvancedRouter.get('/analytics', ProcurementAdvancedController.getAnalytics);

// Budgets
import { ProcurementReplenishmentController } from '../controllers/procurementReplenishment.controller.js';
procurementAdvancedRouter.get('/budgets', ProcurementReplenishmentController.listBudgets);
procurementAdvancedRouter.post('/budgets', ProcurementReplenishmentController.createBudget);
