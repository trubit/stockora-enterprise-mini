import { Router } from 'express';
import { SalesReturnController } from '../controllers/salesReturn.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const salesReturnRouter = Router();

salesReturnRouter.use(authMiddleware);

salesReturnRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesReturnController.listReturns
);
salesReturnRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesReturnController.createReturn
);
