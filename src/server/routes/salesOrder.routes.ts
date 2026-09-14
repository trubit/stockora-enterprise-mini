import { Router } from 'express';
import { SalesOrderController } from '../controllers/salesOrder.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAnyPermission } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const salesOrderRouter = Router();

salesOrderRouter.use(authMiddleware);

salesOrderRouter.get(
  '/',
  requireAnyPermission([SYSTEM_PERMISSIONS.TRANSACTIONS_READ, SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesOrderController.listOrders
);
salesOrderRouter.post(
  '/',
  requireAnyPermission([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE, SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesOrderController.createOrder
);
salesOrderRouter.post(
  '/:id/ship',
  requireAnyPermission([
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.WAREHOUSES_WRITE,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
  ]),
  SalesOrderController.dispatchShipment
);
