import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const supplierRouter = Router();

supplierRouter.use(authMiddleware);

supplierRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_READ]),
  SupplierController.getSuppliers
);
supplierRouter.get(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_READ]),
  SupplierController.getSupplier
);
supplierRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_WRITE]),
  SupplierController.createSupplier
);
supplierRouter.put(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_WRITE]),
  SupplierController.updateSupplier
);
supplierRouter.delete(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.SUPPLIERS_WRITE]),
  SupplierController.deleteSupplier
);
