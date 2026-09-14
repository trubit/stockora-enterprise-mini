import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const invoiceRouter = Router();

invoiceRouter.use(authMiddleware);

invoiceRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InvoiceController.listInvoices
);
invoiceRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InvoiceController.createInvoice
);
invoiceRouter.put(
  '/:id/pay',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InvoiceController.payInvoice
);
