import { Router } from 'express';
import { TenantController } from '../controllers/tenant.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { rbacMiddleware, requireAnyPermission, requireRole } from '../middleware/rbac.js';
import { requirePlanLimit } from '../middleware/billing.middleware.js';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from '../../shared/constants.js';

export const tenantRouter = Router();

// 1. User Tenant & Switcher Routes
tenantRouter.get('/user-tenants', authMiddleware, TenantController.getUserTenants);
tenantRouter.post('/switch', authMiddleware, TenantController.switchTenant);

// 2. Onboarding Route
tenantRouter.post('/onboard', authMiddleware, TenantController.onboard);

// 3. Invitations Flow
// 3a. Public Validation & Direct Registration from Link
tenantRouter.get('/invitations/validate/:token', TenantController.validateInvitation);
tenantRouter.post('/invitations/accept-and-register', TenantController.acceptAndRegister);

// 3b. Authenticated Invitation Acceptance
tenantRouter.post('/invitations/accept', authMiddleware, TenantController.acceptInvitation);

// 4. Current Tenant Profile & Configuration
// GET /current is accessible to any authenticated user who has valid tenant membership (enforced by resolveTenantContext)
tenantRouter.get(
  '/current',
  authMiddleware,
  resolveTenantContext,
  TenantController.getCurrentTenant
);
tenantRouter.put(
  '/current/profile',
  authMiddleware,
  resolveTenantContext,
  rbacMiddleware([SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  TenantController.updateProfile
);
tenantRouter.put(
  '/current/branding',
  authMiddleware,
  resolveTenantContext,
  rbacMiddleware([SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  TenantController.updateBranding
);
tenantRouter.put(
  '/current/features',
  authMiddleware,
  resolveTenantContext,
  rbacMiddleware([SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  TenantController.updateFeatures
);
tenantRouter.put(
  '/current/limits',
  authMiddleware,
  resolveTenantContext,
  rbacMiddleware([SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  TenantController.updateLimits
);

// 5. Tenant Team Invitations Management
tenantRouter.get(
  '/invitations',
  authMiddleware,
  resolveTenantContext,
  requireAnyPermission([SYSTEM_PERMISSIONS.USERS_READ, SYSTEM_PERMISSIONS.COMPANIES_READ]),
  TenantController.listInvitations
);
tenantRouter.post(
  '/invitations',
  authMiddleware,
  resolveTenantContext,
  requireAnyPermission([SYSTEM_PERMISSIONS.USERS_WRITE, SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  requirePlanLimit('users'),
  TenantController.createInvitation
);
tenantRouter.post(
  '/invitations/:id/resend',
  authMiddleware,
  resolveTenantContext,
  requireAnyPermission([SYSTEM_PERMISSIONS.USERS_WRITE, SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  TenantController.resendInvitation
);
tenantRouter.delete(
  '/invitations/:id',
  authMiddleware,
  resolveTenantContext,
  requireAnyPermission([SYSTEM_PERMISSIONS.USERS_WRITE, SYSTEM_PERMISSIONS.COMPANIES_WRITE]),
  TenantController.revokeInvitation
);

// 6. Platform Super Admin Operations
tenantRouter.get(
  '/admin/all',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  TenantController.adminListAllTenants
);
tenantRouter.get(
  '/admin/companies',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  TenantController.adminListAllTenants
);
tenantRouter.get(
  '/admin/tenants',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  TenantController.adminListAllTenants
);
tenantRouter.patch(
  '/admin/:id/status',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  TenantController.adminUpdateTenantStatus
);
