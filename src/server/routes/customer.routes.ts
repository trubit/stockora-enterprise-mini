import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const customerRouter = Router();

customerRouter.use(authMiddleware);

customerRouter.get(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CustomerController.getCustomers
);
customerRouter.get(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  CustomerController.getCustomer
);
customerRouter.post(
  '/',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CustomerController.createCustomer
);
customerRouter.put(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CustomerController.updateCustomer
);
customerRouter.delete(
  '/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  CustomerController.deleteCustomer
);
