import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { TenantController } from '../controllers/tenant.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { SYSTEM_ROLES } from '../../shared/constants.js';

const router = Router();

router.use(authenticate);

// Platform System Configuration & Maintenance
router.get('/settings', requireRole([SYSTEM_ROLES.SUPER_ADMIN]), AdminController.getSettings);
router.post('/settings', requireRole([SYSTEM_ROLES.SUPER_ADMIN]), AdminController.updateSettings);
router.get('/audit-logs', requireRole([SYSTEM_ROLES.SUPER_ADMIN]), AdminController.listAuditLogs);

// Platform Cross-Tenant Company Directory
router.get(
  '/companies',
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  TenantController.adminListAllTenants
);
router.get(
  '/tenants',
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  TenantController.adminListAllTenants
);

export { router as adminRouter };
