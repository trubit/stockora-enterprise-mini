import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from './auth.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { AuthenticationError, AuthorizationError, NotFoundError } from '../errors/AppError.js';
import { memoryCache } from '../utils/cache.js';

/**
 * resolveTenantContext
 * Authoritative middleware that resolves and verifies the active tenant for every request.
 * Tenant context is cached per (userId, tenantId) for 2 minutes to eliminate cascading DB queries.
 *
 * Security Rules:
 * 1. Never trust tenantId from body or url query parameters blindly.
 * 2. Active tenant is determined by:
 *    a) x-tenant-id or x-tenant-slug header, verified against user's authorized memberships.
 *    b) User's primary tenantId from JWT / User record.
 * 3. Cross-tenant access without authorized membership returns 403 Forbidden.
 * 4. Platform administrators can inspect any tenant when explicitly requested.
 */
export async function resolveTenantContext(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required to resolve tenant context.'));
    }

    const requestedTenantHeader =
      (req.headers['x-tenant-id'] as string) || (req.headers['x-tenant-slug'] as string);

    let targetTenantId: string | undefined = undefined;
    let targetTenantSlug: string | undefined = undefined;

    if (requestedTenantHeader) {
      if (mongoose.Types.ObjectId.isValid(requestedTenantHeader)) {
        targetTenantId = requestedTenantHeader;
      } else {
        targetTenantSlug = requestedTenantHeader.toLowerCase().trim();
      }
    } else if (req.user.tenantId) {
      targetTenantId = req.user.tenantId.toString();
    } else if (req.user.tenantSlug) {
      targetTenantSlug = req.user.tenantSlug;
    }

    // Cache key for this user+tenant combination (2-minute TTL)
    const cacheKey = `tenant_ctx:${req.user.id}:${targetTenantId ?? targetTenantSlug ?? 'default'}`;

    type CachedTenantCtx = {
      resolvedTenantId: string;
      tenantSlug: string;
      tenantStatus: string;
      tenantName: string;
    };

    const cached = memoryCache.get<CachedTenantCtx>(cacheKey);
    if (cached) {
      // Rebuild minimal tenant shape from cache to attach to request
      req.tenantId = cached.resolvedTenantId;
      req.tenantSlug = cached.tenantSlug;
      // Attach a minimal tenant proxy for feature-flag checks
      req.tenant = {
        _id: new mongoose.Types.ObjectId(cached.resolvedTenantId),
        slug: cached.tenantSlug,
        name: cached.tenantName,
        status: cached.tenantStatus,
      } as unknown as typeof req.tenant;
      return next();
    }

    // 1. Fetch user record to verify full tenant memberships
    const userDoc: any = await User.findById(req.user.id)
      .select('tenantId tenants roleName isPlatformAdmin')
      .lean();
    if (!userDoc) {
      return next(new AuthenticationError('User account not found. Please log in again.'));
    }

    let tenantDoc: Awaited<ReturnType<typeof Tenant.findById>> | null = null;

    if (targetTenantId) {
      tenantDoc = await Tenant.findById(targetTenantId).lean();
    } else if (targetTenantSlug) {
      tenantDoc = await Tenant.findOne({ slug: targetTenantSlug }).lean();
    }

    // Fallback: user's primary tenant
    if (!tenantDoc && userDoc.tenantId) {
      tenantDoc = await Tenant.findById(userDoc.tenantId).lean();
    }

    // Final fallback: first active tenant the user owns or is a member of
    if (!tenantDoc) {
      const userTenantIds = (userDoc.tenants || [])
        .map((t: any) => t.tenantId)
        .filter((id: any) => mongoose.Types.ObjectId.isValid(id));
      tenantDoc = await Tenant.findOne({
        $or: [
          { ownerUserId: userDoc._id },
          ...(userTenantIds.length > 0 ? [{ _id: { $in: userTenantIds } }] : []),
        ],
        status: { $ne: 'DELETED' },
      })
        .sort({ createdAt: 1 })
        .lean();
    }

    if (!tenantDoc) {
      return next(
        new NotFoundError('Active tenant could not be resolved. Please complete company setup.')
      );
    }

    const resolvedTenantId = (tenantDoc as any)._id.toString();

    // 2. Validate tenant membership (unless platform admin or Super Administrator)
    const isSuperAdmin = Boolean(
      userDoc.isPlatformAdmin || userDoc.roleName === 'Super Administrator'
    );
    if (!isSuperAdmin) {
      const isPrimaryTenant = userDoc.tenantId && userDoc.tenantId.toString() === resolvedTenantId;
      const isMember =
        userDoc.tenants &&
        userDoc.tenants.some((m: any) => m.tenantId && m.tenantId.toString() === resolvedTenantId);
      const isOwner =
        (tenantDoc as any).ownerUserId &&
        (tenantDoc as any).ownerUserId.toString() === userDoc._id.toString();

      if (!isPrimaryTenant && !isMember && !isOwner) {
        return next(
          new AuthorizationError(
            `Access Denied: You do not have membership access to tenant [${(tenantDoc as any).name || resolvedTenantId}].`
          )
        );
      }
    }

    // 3. Attach verified context to request
    req.tenantId = resolvedTenantId;
    req.tenantSlug = (tenantDoc as any).slug;
    req.tenant = tenantDoc as unknown as typeof req.tenant;

    // Cache the resolved context for 2 minutes
    memoryCache.set<CachedTenantCtx>(
      cacheKey,
      {
        resolvedTenantId,
        tenantSlug: (tenantDoc as any).slug,
        tenantStatus: (tenantDoc as any).status,
        tenantName: (tenantDoc as any).name,
      },
      2 * 60_000
    );

    next();
  } catch (err: unknown) {
    next(err);
  }
}

/**
 * requireActiveTenant
 * Ensures the tenant is in ACTIVE or TRIAL status.
 */
export function requireActiveTenant(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.tenant) {
    return next(new AuthorizationError('Tenant context is missing.'));
  }

  if (req.tenant.status === 'SUSPENDED') {
    return next(
      new AuthorizationError('This company account has been suspended. Please contact support.')
    );
  }

  if (req.tenant.status === 'CANCELLED') {
    return next(new AuthorizationError('This company account has been cancelled.'));
  }

  next();
}

/**
 * requireTenantFeature
 * Enforces tenant-level feature flags at the API level.
 */
export function requireTenantFeature(featureKey: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      return next(new AuthorizationError('Tenant context required for feature check.'));
    }

    const features = req.tenant.features;
    let isEnabled = true;
    if (features instanceof Map) {
      isEnabled = features.get(featureKey) ?? true;
    } else if (typeof features === 'object' && features !== null) {
      isEnabled = (features as Record<string, boolean>)[featureKey] ?? true;
    }

    if (!isEnabled) {
      return next(
        new AuthorizationError(
          `Feature [${featureKey}] is not enabled for company "${req.tenant.name}". Upgrade your plan to access this feature.`
        )
      );
    }

    next();
  };
}

/**
 * Helper: builds standard tenant query filter for scoped DB queries.
 */
export function getTenantFilter(req: AuthenticatedRequest): { tenantId: string } {
  return { tenantId: req.tenantId || 'default' };
}
