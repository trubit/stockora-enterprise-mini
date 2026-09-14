import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { AuthorizationError } from '../errors/AppError.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { UsageMeteringService, type TenantResourceKey } from '../services/usageMetering.service.js';

/**
 * Middleware: requirePlanFeature
 * Checks whether tenant's active subscription tier enables this feature.
 */
export function requirePlanFeature(featureKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId =
        req.tenantId || (req.user?.tenantId ? req.user.tenantId.toString() : undefined);
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required for plan feature check.'));
      }

      // Check if user is Super Admin or Platform Admin (bypass feature gates for system operations)
      if (req.user?.isPlatformAdmin || req.user?.roleName === 'Super Administrator') {
        return next();
      }

      const isAllowed = await SubscriptionService.hasFeature(tenantId, featureKey);
      if (!isAllowed) {
        res.status(403).json({
          success: false,
          error: 'FEATURE_LOCKED',
          code: 'FEATURE_NOT_IN_PLAN',
          message: `Feature [${featureKey}] is locked for your current plan. Please upgrade your subscription to unlock this feature.`,
          feature: featureKey,
          upgradeUrl: '/pricing',
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: requirePlanLimit
 * Checks if tenant has remaining quota for creating or scaling a resource.
 */
export function requirePlanLimit(resourceKey: TenantResourceKey, requestedIncrement: number = 1) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId =
        req.tenantId || (req.user?.tenantId ? req.user.tenantId.toString() : undefined);
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required for limit check.'));
      }

      // Platform admins bypass limits for debugging/maintenance
      if (req.user?.isPlatformAdmin || req.user?.roleName === 'Super Administrator') {
        return next();
      }

      const limitCheck = await UsageMeteringService.checkLimit(
        tenantId,
        resourceKey,
        requestedIncrement
      );
      if (!limitCheck.allowed) {
        res.status(403).json({
          success: false,
          error: 'PLAN_LIMIT_EXCEEDED',
          code: 'LIMIT_EXCEEDED',
          message: limitCheck.message,
          resource: resourceKey,
          current: limitCheck.current,
          limit: limitCheck.limit,
          upgradeUrl: '/pricing',
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
