import { Router } from 'express';
import { PurchaseOrderController } from '../controllers/purchaseOrder.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const purchaseOrderRouter = Router();

purchaseOrderRouter.use(authMiddleware);

purchaseOrderRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  PurchaseOrderController.listPOs
);
purchaseOrderRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  PurchaseOrderController.createPO
);
purchaseOrderRouter.put(
  '/:id/approve',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  PurchaseOrderController.approvePO
);
purchaseOrderRouter.post(
  '/:id/receive',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  PurchaseOrderController.receiveGoods
);
