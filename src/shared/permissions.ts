import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  type SystemPermission,
  type SystemRole,
} from './constants.js';

export { SYSTEM_PERMISSIONS, SYSTEM_ROLES, type SystemPermission, type SystemRole };

/**
 * Normalizes any role representation (e.g. 'SALES_MANAGER', 'sales_manager', 'Sales Manager', 'admin', 'MANAGER')
 * to its canonical SystemRole value.
 */
export function normalizeRoleName(role?: string | null): SystemRole | string | undefined {
  if (!role) return undefined;
  const trimmed = role.trim();
  const normalizedKey = trimmed.toUpperCase().replace(/[-\s]+/g, '_');

  // 1. Direct match on SYSTEM_ROLES enum keys (e.g. SUPER_ADMIN, COMPANY_OWNER, BRANCH_MANAGER, CASHIER, etc.)
  if (normalizedKey in SYSTEM_ROLES) {
    return SYSTEM_ROLES[normalizedKey as keyof typeof SYSTEM_ROLES];
  }

  // 2. Direct match on SYSTEM_ROLES enum display values (e.g. 'Super Administrator', 'Company Owner', etc.)
  const matchingValue = Object.values(SYSTEM_ROLES).find(
    (val) => val.toLowerCase() === trimmed.toLowerCase()
  );
  if (matchingValue) {
    return matchingValue;
  }

  // 3. Normalized alias mappings
  const simplified = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (simplified) {
    case 'superadmin':
    case 'superadministrator':
      return SYSTEM_ROLES.SUPER_ADMIN;
    case 'owner':
    case 'companyowner':
    case 'companyadmin':
    case 'admin':
    case 'administrator':
      return SYSTEM_ROLES.COMPANY_OWNER;
    case 'manager':
    case 'branchmanager':
      return SYSTEM_ROLES.BRANCH_MANAGER;
    case 'warehouse':
    case 'warehousemanager':
      return SYSTEM_ROLES.WAREHOUSE_MANAGER;
    case 'inventory':
    case 'inventorymanager':
      return SYSTEM_ROLES.INVENTORY_MANAGER;
    case 'purchasing':
    case 'purchasingmanager':
    case 'procurement':
    case 'procurementmanager':
      return SYSTEM_ROLES.PURCHASING_MANAGER;
    case 'sales':
    case 'salesmanager':
    case 'salesrep':
    case 'salesrepresentative':
      return SYSTEM_ROLES.SALES_MANAGER;
    case 'cashier':
    case 'pos':
      return SYSTEM_ROLES.CASHIER;
    case 'accountant':
    case 'accounting':
    case 'finance':
      return SYSTEM_ROLES.ACCOUNTANT;
    case 'auditor':
    case 'readonly':
    case 'readonlyauditor':
      return SYSTEM_ROLES.AUDITOR;
    case 'employee':
    case 'staff':
    case 'user':
      return SYSTEM_ROLES.EMPLOYEE;
    default:
      return trimmed;
  }
}

/**
 * Standard default permissions mapped to each system role.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, readonly string[]> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: Object.values(SYSTEM_PERMISSIONS),
  [SYSTEM_ROLES.COMPANY_OWNER]: Object.values(SYSTEM_PERMISSIONS).filter(
    (perm) =>
      perm !== SYSTEM_PERMISSIONS.PLATFORM_COMPANIES_VIEW &&
      perm !== SYSTEM_PERMISSIONS.SECURITY_WRITE
  ),
  [SYSTEM_ROLES.BRANCH_MANAGER]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
    SYSTEM_PERMISSIONS.INVENTORY_ADJUST,
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.WAREHOUSES_READ,
    SYSTEM_PERMISSIONS.USERS_READ,
    SYSTEM_PERMISSIONS.CUSTOMERS_READ,
    SYSTEM_PERMISSIONS.CUSTOMERS_WRITE,
    SYSTEM_PERMISSIONS.SUPPLIERS_READ,
    SYSTEM_PERMISSIONS.REPORTS_READ,
    SYSTEM_PERMISSIONS.RETURNS_READ,
    SYSTEM_PERMISSIONS.RETURNS_WRITE,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_ANALYZE,
    SYSTEM_PERMISSIONS.AI_INVENTORY,
    SYSTEM_PERMISSIONS.AI_SALES,
    SYSTEM_PERMISSIONS.AI_RECOMMENDATIONS,
    SYSTEM_PERMISSIONS.AI_REPORTS,
  ],
  [SYSTEM_ROLES.WAREHOUSE_MANAGER]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
    SYSTEM_PERMISSIONS.INVENTORY_ADJUST,
    SYSTEM_PERMISSIONS.WAREHOUSES_READ,
    SYSTEM_PERMISSIONS.WAREHOUSES_WRITE,
    SYSTEM_PERMISSIONS.SUPPLIERS_READ,
    SYSTEM_PERMISSIONS.RETURNS_READ,
    SYSTEM_PERMISSIONS.RETURNS_WRITE,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_ANALYZE,
    SYSTEM_PERMISSIONS.AI_INVENTORY,
    SYSTEM_PERMISSIONS.AI_RECOMMENDATIONS,
  ],
  [SYSTEM_ROLES.INVENTORY_MANAGER]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
    SYSTEM_PERMISSIONS.INVENTORY_ADJUST,
    SYSTEM_PERMISSIONS.WAREHOUSES_READ,
    SYSTEM_PERMISSIONS.WAREHOUSES_WRITE,
    SYSTEM_PERMISSIONS.SUPPLIERS_READ,
    SYSTEM_PERMISSIONS.SUPPLIERS_WRITE,
    SYSTEM_PERMISSIONS.REPORTS_READ,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_ANALYZE,
    SYSTEM_PERMISSIONS.AI_INVENTORY,
    SYSTEM_PERMISSIONS.AI_FORECASTING,
    SYSTEM_PERMISSIONS.AI_RECOMMENDATIONS,
    SYSTEM_PERMISSIONS.AI_REPORTS,
  ],
  [SYSTEM_ROLES.PURCHASING_MANAGER]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.SUPPLIERS_READ,
    SYSTEM_PERMISSIONS.SUPPLIERS_WRITE,
    SYSTEM_PERMISSIONS.REPORTS_READ,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_ANALYZE,
    SYSTEM_PERMISSIONS.AI_INVENTORY,
    SYSTEM_PERMISSIONS.AI_RECOMMENDATIONS,
    SYSTEM_PERMISSIONS.AI_FORECASTING,
  ],
  [SYSTEM_ROLES.SALES_MANAGER]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.CUSTOMERS_READ,
    SYSTEM_PERMISSIONS.CUSTOMERS_WRITE,
    SYSTEM_PERMISSIONS.PROMOTIONS_READ,
    SYSTEM_PERMISSIONS.PROMOTIONS_WRITE,
    SYSTEM_PERMISSIONS.REPORTS_READ,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_ANALYZE,
    SYSTEM_PERMISSIONS.AI_SALES,
    SYSTEM_PERMISSIONS.AI_FORECASTING,
    SYSTEM_PERMISSIONS.AI_REPORTS,
  ],
  [SYSTEM_ROLES.CASHIER]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.CUSTOMERS_READ,
    SYSTEM_PERMISSIONS.CUSTOMERS_WRITE,
    SYSTEM_PERMISSIONS.GIFTCARDS_READ,
    SYSTEM_PERMISSIONS.GIFTCARDS_WRITE,
  ],
  [SYSTEM_ROLES.ACCOUNTANT]: [
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.FINANCE_READ,
    SYSTEM_PERMISSIONS.FINANCE_WRITE,
    SYSTEM_PERMISSIONS.REPORTS_READ,
    SYSTEM_PERMISSIONS.REPORTS_WRITE,
    SYSTEM_PERMISSIONS.AUDIT_READ,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_REPORTS,
    SYSTEM_PERMISSIONS.AI_SALES,
  ],
  [SYSTEM_ROLES.AUDITOR]: [
    SYSTEM_PERMISSIONS.USERS_READ,
    SYSTEM_PERMISSIONS.ROLES_READ,
    SYSTEM_PERMISSIONS.COMPANIES_READ,
    SYSTEM_PERMISSIONS.BRANCHES_READ,
    SYSTEM_PERMISSIONS.WAREHOUSES_READ,
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.AUDIT_READ,
    SYSTEM_PERMISSIONS.CUSTOMERS_READ,
    SYSTEM_PERMISSIONS.SUPPLIERS_READ,
    SYSTEM_PERMISSIONS.REPORTS_READ,
    SYSTEM_PERMISSIONS.FINANCE_READ,
    SYSTEM_PERMISSIONS.AI_VIEW,
    SYSTEM_PERMISSIONS.AI_REPORTS,
  ],
  [SYSTEM_ROLES.EMPLOYEE]: [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.NOTIFICATIONS_READ,
  ],
};

export interface UserPermissionContext {
  roleName?: string;
  role?: string;
  isPlatformAdmin?: boolean;
  permissions?: string[];
}

/**
 * Checks if a user has platform-level super administrator rights.
 */
export function isPlatformSuperAdmin(user: UserPermissionContext | null | undefined): boolean {
  if (!user) return false;
  const rawRole = user.roleName || user.role;
  const normalizedRole = normalizeRoleName(rawRole);
  return Boolean(user.isPlatformAdmin || normalizedRole === SYSTEM_ROLES.SUPER_ADMIN);
}

/**
 * Computes the authoritative effective list of permissions for a user.
 */
export function getEffectivePermissions(user: UserPermissionContext | null | undefined): string[] {
  if (!user) return [];

  const rawRole = user.roleName || user.role;
  const normalizedRole = normalizeRoleName(rawRole);

  // ONLY verified Platform Super Administrators have all system permissions
  if (user.isPlatformAdmin || normalizedRole === SYSTEM_ROLES.SUPER_ADMIN) {
    return Object.values(SYSTEM_PERMISSIONS);
  }

  const roleName = normalizedRole as SystemRole;
  const roleDefaultPerms = (roleName && DEFAULT_ROLE_PERMISSIONS[roleName]) || [];
  const customUserPerms = user.permissions || [];

  // Merge and deduplicate
  return Array.from(new Set([...roleDefaultPerms, ...customUserPerms]));
}

/**
 * Checks if a user has a specific permission.
 */
export function hasPermission(
  user: UserPermissionContext | null | undefined,
  requiredPermission?: string
): boolean {
  if (!requiredPermission) return true; // No permission required
  if (!user) return false;

  const effective = getEffectivePermissions(user);
  return effective.includes(requiredPermission);
}

/**
 * Checks if a user has at least one of the required permissions.
 */
export function hasAnyPermission(
  user: UserPermissionContext | null | undefined,
  requiredPermissions: string[]
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!user) return false;

  const effective = getEffectivePermissions(user);
  return requiredPermissions.some((perm) => effective.includes(perm));
}

/**
 * Checks if a user has all of the required permissions.
 */
export function hasAllPermissions(
  user: UserPermissionContext | null | undefined,
  requiredPermissions: string[]
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!user) return false;

  const effective = getEffectivePermissions(user);
  return requiredPermissions.every((perm) => effective.includes(perm));
}

/**
 * Checks if a user has a specific role or administrative privilege.
 */
export function hasRole(
  user: UserPermissionContext | null | undefined,
  allowedRoles: string | string[]
): boolean {
  if (!user) return false;
  const rawRole = user.roleName || user.role;
  const normalizedUserRole = normalizeRoleName(rawRole);

  if (user.isPlatformAdmin || normalizedUserRole === SYSTEM_ROLES.SUPER_ADMIN) return true;

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = roles.map((r) => normalizeRoleName(r) || r);

  return Boolean(
    (rawRole && roles.includes(rawRole)) ||
    (normalizedUserRole && normalizedAllowed.includes(normalizedUserRole))
  );
}
