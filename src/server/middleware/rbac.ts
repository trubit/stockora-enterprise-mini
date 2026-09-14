import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { Role } from '../models/Role.js';
import { AuthorizationError } from '../errors/AppError.js';
import { memoryCache } from '../utils/cache.js';
import { logger } from '../logger.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  normalizeRoleName,
  type SystemRole,
} from '../../shared/permissions.js';
import mongoose from 'mongoose';
import { config } from '../../config/environment.js';

/**
 * Resolves effective permissions for a role name, combining static defaults with DB custom roles.
 */
export async function resolveRolePermissions(roleName: string): Promise<string[]> {
  const normalizedRole = normalizeRoleName(roleName) || roleName;
  const cacheKey = `role:permissions:${normalizedRole}`;
  const cached = memoryCache.get<string[]>(cacheKey);
  if (cached !== null) return cached;

  // Check static defaults first (instant in-memory resolution for all standard system roles)
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[normalizedRole as SystemRole];
  if (defaultPerms && defaultPerms.length > 0) {
    const perms = Array.from(defaultPerms);
    memoryCache.set(cacheKey, perms, 5 * 60_000);
    return perms;
  }

  // Lookup in DB for customized or dynamic roles created by tenants
  let dbPerms: string[] = [];
  if (mongoose.connection?.readyState === 1) {
    try {
      const roleDoc = await Role.findOne({
        $or: [{ name: roleName }, { name: normalizedRole }],
      })
        .select('permissions')
        .lean();
      if (roleDoc?.permissions) {
        dbPerms = roleDoc.permissions as string[];
      }
    } catch {
      dbPerms = [];
    }
  }

  const effective = Array.from(new Set([...(defaultPerms || []), ...dbPerms]));
  memoryCache.set(cacheKey, effective, 5 * 60_000); // 5 minutes TTL
  return effective;
}

/**
 * Invalidate cached role permissions when an admin updates a role definition.
 */
export function invalidateRolePermissionsCache(roleName?: string): void {
  if (roleName) {
    const normalizedRole = normalizeRoleName(roleName) || roleName;
    memoryCache.delete(`role:permissions:${roleName}`);
    memoryCache.delete(`role:permissions:${normalizedRole}`);
  }
}

/**
 * rbacMiddleware
 * Enforces that the authenticated user possesses ALL required permissions.
 */
export function rbacMiddleware(requiredPermissions: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required.'));
    }

    const {
      roleName,
      role,
      isPlatformAdmin,
      permissions: userCustomPermissions,
      id: userId,
      tenantId,
    } = req.user as any;
    const rawRole = roleName || role;
    const normalizedRole = normalizeRoleName(rawRole);

    const isPlatformLevelReq = requiredPermissions.some(
      (p) =>
        p === SYSTEM_PERMISSIONS.PLATFORM_COMPANIES_VIEW || p === SYSTEM_PERMISSIONS.SECURITY_WRITE
    );

    // Platform Super Admins have global platform administrative rights
    if (isPlatformAdmin || normalizedRole === SYSTEM_ROLES.SUPER_ADMIN) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} (platform admin bypass) | required=[${requiredPermissions.join(', ')}] | decision=ALLOW`
        );
      }
      return next();
    }

    // Company Owners have administrative rights within their tenant scope, but NOT platform-level scope
    if (
      !isPlatformLevelReq &&
      (normalizedRole === SYSTEM_ROLES.COMPANY_OWNER || rawRole === 'admin' || rawRole === 'ADMIN')
    ) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} (tenant admin bypass) | required=[${requiredPermissions.join(', ')}] | decision=ALLOW`
        );
      }
      return next();
    }

    if (!rawRole) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=NONE | required=[${requiredPermissions.join(', ')}] | decision=DENY (no role assigned)`
        );
      }
      return next(new AuthorizationError('Access Denied: No role assigned to user account.'));
    }

    try {
      const rolePermissions = await resolveRolePermissions(rawRole);
      const allUserPermissions = new Set([
        ...rolePermissions,
        ...(Array.isArray(userCustomPermissions) ? userCustomPermissions : []),
      ]);

      const hasAll = requiredPermissions.every((perm) => allUserPermissions.has(perm));
      if (!hasAll) {
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(
            `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} tenant=${tenantId} | required=[${requiredPermissions.join(', ')}] | effective=[${Array.from(allUserPermissions).join(', ')}] | decision=DENY (missing required permissions)`
          );
        }
        return next(
          new AuthorizationError(
            `Role [${rawRole}] lacks required permission(s): [${requiredPermissions.join(', ')}].`
          )
        );
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} tenant=${tenantId} | required=[${requiredPermissions.join(', ')}] | decision=ALLOW`
        );
      }
      next();
    } catch (err: unknown) {
      next(err);
    }
  };
}

/**
 * requireAnyPermission
 * Enforces that the authenticated user possesses AT LEAST ONE of the specified permissions.
 */
export function requireAnyPermission(permissionsList: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required.'));
    }

    const {
      roleName,
      role,
      isPlatformAdmin,
      permissions: userCustomPermissions,
      id: userId,
      tenantId,
    } = req.user as any;
    const rawRole = roleName || role;
    const normalizedRole = normalizeRoleName(rawRole);

    const isPlatformLevelReq = permissionsList.some(
      (p) =>
        p === SYSTEM_PERMISSIONS.PLATFORM_COMPANIES_VIEW || p === SYSTEM_PERMISSIONS.SECURITY_WRITE
    );

    if (isPlatformAdmin || normalizedRole === SYSTEM_ROLES.SUPER_ADMIN) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} (platform admin bypass) | requiredAny=[${permissionsList.join(', ')}] | decision=ALLOW`
        );
      }
      return next();
    }

    if (
      !isPlatformLevelReq &&
      (normalizedRole === SYSTEM_ROLES.COMPANY_OWNER || rawRole === 'admin' || rawRole === 'ADMIN')
    ) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} (tenant admin bypass) | requiredAny=[${permissionsList.join(', ')}] | decision=ALLOW`
        );
      }
      return next();
    }

    if (!rawRole) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=NONE | requiredAny=[${permissionsList.join(', ')}] | decision=DENY (no role assigned)`
        );
      }
      return next(new AuthorizationError('Access Denied: No role assigned to user account.'));
    }

    try {
      const rolePermissions = await resolveRolePermissions(rawRole);
      const allUserPermissions = new Set([
        ...rolePermissions,
        ...(Array.isArray(userCustomPermissions) ? userCustomPermissions : []),
      ]);

      const hasAny = permissionsList.some((perm) => allUserPermissions.has(perm));
      if (!hasAny) {
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(
            `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} tenant=${tenantId} | requiredAny=[${permissionsList.join(', ')}] | effective=[${Array.from(allUserPermissions).join(', ')}] | decision=DENY (missing required permissions)`
          );
        }
        return next(
          new AuthorizationError(
            `Role [${rawRole}] requires at least one of: [${permissionsList.join(', ')}].`
          )
        );
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug(
          `[AUTHORIZATION DEBUG] ${req.method} ${req.baseUrl}${req.path} | user=${userId} role=${rawRole} tenant=${tenantId} | requiredAny=[${permissionsList.join(', ')}] | decision=ALLOW`
        );
      }
      next();
    } catch (err: unknown) {
      next(err);
    }
  };
}

/**
 * abacMiddleware
 * Attribute-Based Access Control middleware for branch scoping.
 */
export function abacMiddleware() {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required.'));
    }

    const { roleName, role, branchId, allowedBranches, isPlatformAdmin } = req.user as {
      roleName?: string;
      role?: string;
      branchId?: string;
      allowedBranches?: string[];
      isPlatformAdmin?: boolean;
    };
    const rawRole = roleName || role;
    const normalizedRole = normalizeRoleName(rawRole);

    // Admin roles have global bypass permission
    if (
      isPlatformAdmin ||
      rawRole === 'admin' ||
      rawRole === 'ADMIN' ||
      normalizedRole === SYSTEM_ROLES.SUPER_ADMIN ||
      normalizedRole === SYSTEM_ROLES.COMPANY_OWNER
    ) {
      return next();
    }

    // Determine targeted branch ID from request body, query parameters, or route params
    const targetBranchId =
      (req.body?.branchId as string) ||
      (req.query?.branchId as string) ||
      (req.params?.branchId as string);

    if (!targetBranchId) {
      // No branchId specified — let request through; route-level guards handle scoping
      return next();
    }

    // Evaluate: check if user is authorized to access targetBranchId
    const permitted =
      (branchId && branchId === targetBranchId) ||
      (allowedBranches && allowedBranches.includes(targetBranchId));

    if (!permitted) {
      return next(
        new AuthorizationError(
          `Access Denied: You do not have permission to access branch [${targetBranchId}].`
        )
      );
    }

    next();
  };
}

// Export aliases to support all route import styles
export const rbac = rbacMiddleware;
export const checkPermissions = rbacMiddleware;
export const requirePermission = rbacMiddleware;

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required.'));
    }
    const { roleName, role, isPlatformAdmin } = req.user as any;
    const rawRole = roleName || role;
    const normalizedUserRole = normalizeRoleName(rawRole);

    // ONLY Platform Super Administrators bypass role restrictions
    if (isPlatformAdmin || normalizedUserRole === SYSTEM_ROLES.SUPER_ADMIN) {
      return next();
    }

    const normalizedAllowed = allowedRoles.map((r) => normalizeRoleName(r) || r);
    if (
      (rawRole && allowedRoles.includes(rawRole)) ||
      (normalizedUserRole && normalizedAllowed.includes(normalizedUserRole))
    ) {
      return next();
    }

    return next(
      new AuthorizationError(`Access denied: Requires one of roles [${allowedRoles.join(', ')}].`)
    );
  };
}

/**
 * requirePlatformAdmin
 * Strictly enforces that the authenticated user is a Platform Super Administrator,
 * optionally cross-verifying against the single authoritative platform admin email.
 */
export function requirePlatformAdmin() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthorizationError('Authentication required.'));
    }
    const { roleName, role, isPlatformAdmin, email } = req.user as any;
    const rawRole = roleName || role;
    const normalizedUserRole = normalizeRoleName(rawRole);

    const isDesignatedEmail = Boolean(
      config.platformAdminEmail &&
      email &&
      email.toLowerCase().trim() === config.platformAdminEmail.toLowerCase().trim()
    );

    const hasPlatformPrivileges = Boolean(
      isPlatformAdmin || normalizedUserRole === SYSTEM_ROLES.SUPER_ADMIN
    );

    // If a platformAdminEmail is configured, require both the role/flag AND matching email
    if (config.platformAdminEmail) {
      if (hasPlatformPrivileges && isDesignatedEmail) {
        return next();
      }
      return next(
        new AuthorizationError('Access denied: Platform Super Administrator privilege required.')
      );
    }

    // Fallback if no specific platformAdminEmail configured
    if (hasPlatformPrivileges) {
      return next();
    }

    return next(
      new AuthorizationError('Access denied: Platform Super Administrator privilege required.')
    );
  };
}
