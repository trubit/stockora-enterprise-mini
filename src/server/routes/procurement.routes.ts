import { Router } from 'express';
import { ProcurementController } from '../controllers/procurement.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const procurementRouter = Router();

procurementRouter.use(authMiddleware);

// Supplier Management
procurementRouter.get('/suppliers', ProcurementController.getSuppliers);
procurementRouter.post('/suppliers', ProcurementController.createSupplier);
procurementRouter.get('/suppliers/:id', ProcurementController.getSupplier);
procurementRouter.get('/suppliers/:supplierId/products', ProcurementController.getSupplierProducts);
procurementRouter.post('/suppliers/products', ProcurementController.addSupplierProduct);

// Requisitions & Purchase Orders
procurementRouter.get('/requisitions', ProcurementController.getRequisitions);
procurementRouter.post('/requisitions', ProcurementController.createRequisition);
procurementRouter.get('/purchase-orders', ProcurementController.getPurchaseOrders);
procurementRouter.post('/purchase-orders', ProcurementController.createPurchaseOrder);
procurementRouter.post('/purchase-orders/:id/approve', ProcurementController.approvePurchaseOrder);
procurementRouter.post('/purchase-orders/:id/send', ProcurementController.sendPurchaseOrder);
procurementRouter.post('/purchase-orders/:id/confirm', ProcurementController.confirmPurchaseOrder);

// Goods Receiving & Quality Inspection
procurementRouter.get('/goods-receipts', ProcurementController.getGoodsReceipts);
procurementRouter.post('/goods-receipts', ProcurementController.receiveGoods);
procurementRouter.post('/quality-inspections', ProcurementController.submitInspection);
procurementRouter.get('/supplier-returns', ProcurementController.getSupplierReturns);
procurementRouter.post('/supplier-returns', ProcurementController.createSupplierReturn);

// Three-Way Matching & Invoices
procurementRouter.get('/invoices', ProcurementController.getInvoices);
procurementRouter.post('/invoices', ProcurementController.submitInvoice);

// AI Supply Chain & Procurement Intelligence
procurementRouter.get('/ai/compare-suppliers/:productId', ProcurementController.compareSuppliers);
procurementRouter.get(
  '/ai/reorder-recommendations',
  ProcurementController.getReorderRecommendations
);
procurementRouter.post('/ai/copilot', ProcurementController.queryCopilot);
