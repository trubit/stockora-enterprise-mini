import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller.js';
import { OrgController } from '../controllers/org.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);
inventoryRouter.use(resolveTenantContext);

inventoryRouter.get(
  '/movements',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryController.getMovements
);
inventoryRouter.get(
  '/adjustments',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryController.getAdjustments
);
inventoryRouter.post(
  '/adjust',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  InventoryController.adjustStock
);
inventoryRouter.get(
  '/valuation',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  InventoryController.getValuation
);
inventoryRouter.get('/warehouses', OrgController.listWarehouses);
