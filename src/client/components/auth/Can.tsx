import React from 'react';
import { useAuthStore } from '../../store/auth.ts';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
} from '../../../shared/permissions.js';

export interface CanProps {
  /** Single required permission (e.g., 'products:write') */
  permission?: string;
  /** At least one of these permissions is required */
  anyPermission?: string[];
  /** All of these permissions are required */
  allPermissions?: string[];
  /** Allowed role(s) */
  role?: string | string[];
  /** Optional fallback component to render when unauthorized (defaults to null) */
  fallback?: React.ReactNode;
  /** Children to render if authorized */
  children: React.ReactNode;
}

/**
 * Declarative component for granular permission-based and role-based UI rendering.
 * Renders `children` ONLY if the current authenticated user meets the authorization criteria.
 * Otherwise renders `fallback` (or nothing).
 */
export const Can: React.FC<CanProps> = ({
  permission,
  anyPermission,
  allPermissions,
  role,
  fallback = null,
  children,
}) => {
  const { user } = useAuthStore();

  if (!user) {
    return <>{fallback}</>;
  }

  // 1. Single permission check
  if (permission && !hasPermission(user, permission)) {
    return <>{fallback}</>;
  }

  // 2. Any permission check (requires at least one)
  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(user, anyPermission)) {
    return <>{fallback}</>;
  }

  // 3. All permissions check (requires all)
  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(user, allPermissions)) {
    return <>{fallback}</>;
  }

  // 4. Role-based check
  if (role && !hasRole(user, role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default Can;
