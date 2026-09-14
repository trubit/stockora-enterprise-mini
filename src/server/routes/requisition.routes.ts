import { Router } from 'express';
import { RequisitionController } from '../controllers/requisition.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const requisitionRouter = Router();

requisitionRouter.use(authMiddleware);

requisitionRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  RequisitionController.listRequisitions
);
requisitionRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  RequisitionController.createRequisition
);
requisitionRouter.put(
  '/:id/approve',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  RequisitionController.approveRequisition
);
requisitionRouter.put(
  '/:id/reject',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  RequisitionController.rejectRequisition
);
