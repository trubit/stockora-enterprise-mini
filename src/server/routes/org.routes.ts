import { Router } from 'express';
import { OrgController } from '../controllers/org.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { requirePlanFeature, requirePlanLimit } from '../middleware/billing.middleware.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const orgRouter = Router();

orgRouter.use(authMiddleware);
orgRouter.use(resolveTenantContext);

orgRouter.get('/company', OrgController.getCompany);
orgRouter.get('/branches', OrgController.listBranches);
orgRouter.get('/warehouses', OrgController.listWarehouses);
orgRouter.get('/master-data', OrgController.listMasterData);

orgRouter.post(
  '/company',
  rbacMiddleware([SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  OrgController.createCompany
);
orgRouter.put(
  '/company',
  rbacMiddleware([SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  OrgController.updateCompany
);

orgRouter.post(
  '/branches',
  rbacMiddleware([SYSTEM_PERMISSIONS.BRANCHES_WRITE]),
  requirePlanLimit('branches'),
  OrgController.createBranch
);
orgRouter.post(
  '/warehouses',
  rbacMiddleware([SYSTEM_PERMISSIONS.WAREHOUSES_WRITE]),
  requirePlanFeature('warehouseManagement'),
  requirePlanLimit('warehouses'),
  OrgController.createWarehouse
);
orgRouter.post(
  '/master-data',
  rbacMiddleware([SYSTEM_PERMISSIONS.MASTER_DATA_WRITE]),
  OrgController.createMasterData
);
