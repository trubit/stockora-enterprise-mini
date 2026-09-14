import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller.js';
import { authMiddleware, authenticate } from '../middleware/auth.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/rbac.js';
import { SYSTEM_ROLES } from '../../shared/constants.js';

export const billingRouter = Router();

// Public Catalog
billingRouter.get('/plans', BillingController.getPublicPlans);
billingRouter.get('/plans/:id', BillingController.getPlanById);

// Webhook (Public, secured with HMAC signature)
billingRouter.post('/webhooks/paystack', BillingController.handlePaystackWebhook);
billingRouter.post('/webhooks/stripe', BillingController.handleStripeWebhook);

// Tenant-Scoped Subscription & Billing Operations
billingRouter.get(
  '/subscription',
  authMiddleware,
  resolveTenantContext,
  BillingController.getSubscription
);

billingRouter.get(
  '/entitlements',
  authMiddleware,
  resolveTenantContext,
  BillingController.getEntitlements
);

billingRouter.post(
  '/subscription/initialize',
  authMiddleware,
  resolveTenantContext,
  BillingController.initializePayment
);

billingRouter.post(
  '/subscription/verify',
  authMiddleware,
  resolveTenantContext,
  BillingController.verifyPayment
);

billingRouter.post(
  '/subscription/change-plan',
  authMiddleware,
  resolveTenantContext,
  BillingController.changePlan
);

billingRouter.post(
  '/subscription/cancel',
  authMiddleware,
  resolveTenantContext,
  BillingController.cancelSubscription
);

billingRouter.post(
  '/subscription/reactivate',
  authMiddleware,
  resolveTenantContext,
  BillingController.reactivateSubscription
);

billingRouter.get(
  '/transactions',
  authMiddleware,
  resolveTenantContext,
  BillingController.getTransactions
);

billingRouter.get('/invoices', authMiddleware, resolveTenantContext, BillingController.getInvoices);

billingRouter.get(
  '/invoices/:id',
  authMiddleware,
  resolveTenantContext,
  BillingController.getInvoiceById
);

billingRouter.get('/usage', authMiddleware, resolveTenantContext, BillingController.getUsage);

billingRouter.get('/limits', authMiddleware, resolveTenantContext, BillingController.getLimits);

billingRouter.post(
  '/usage/reconcile',
  authMiddleware,
  resolveTenantContext,
  BillingController.reconcileUsage
);

// Platform Admin Routes
billingRouter.get(
  '/admin/plans',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  BillingController.adminListPlans
);

billingRouter.post(
  '/admin/plans',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  BillingController.adminCreatePlan
);

billingRouter.put(
  '/admin/plans/:id',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  BillingController.adminUpdatePlan
);

billingRouter.get(
  '/admin/subscriptions',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  BillingController.adminListSubscriptions
);

billingRouter.get(
  '/admin/metrics',
  authMiddleware,
  requireRole([SYSTEM_ROLES.SUPER_ADMIN]),
  BillingController.adminGetMetrics
);
