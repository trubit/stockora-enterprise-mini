import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.ts';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  isPlatformSuperAdmin,
} from '../../shared/permissions.js';

export interface ProtectedRouteProps {
  allowedRoles?: string[];
  requiredPermission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  requirePlatformAdmin?: boolean;
}

export function ProtectedRoute({
  allowedRoles,
  requiredPermission,
  anyPermission,
  allPermissions,
  requirePlatformAdmin,
}: ProtectedRouteProps) {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (user) {
    // 0. Strict Platform Super Admin check
    if (requirePlatformAdmin && !isPlatformSuperAdmin(user)) {
      return <Navigate to="/access-denied" replace />;
    }

    // 1. Single permission check
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      return <Navigate to="/access-denied" replace />;
    }

    // 2. Any permission check (requires at least one)
    if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(user, anyPermission)) {
      return <Navigate to="/access-denied" replace />;
    }

    // 3. All permissions check (requires all)
    if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(user, allPermissions)) {
      return <Navigate to="/access-denied" replace />;
    }

    // 4. Role-based check
    if (allowedRoles && allowedRoles.length > 0 && !hasRole(user, allowedRoles)) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return <Outlet />;
}
