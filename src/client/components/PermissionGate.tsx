import React from 'react';
import { useAuthStore } from '../store/auth.ts';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
} from '../../shared/permissions.js';

export interface PermissionGateProps {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  role?: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * PermissionGate
 * Declarative component for action/button/table/widget visibility based on permissions.
 * If unauthorized, renders nothing (or the optional fallback).
 */
export function PermissionGate({
  permission,
  anyPermission,
  allPermissions,
  role,
  fallback = null,
  children,
}: PermissionGateProps): React.ReactElement | null {
  const { user } = useAuthStore();

  if (permission && !hasPermission(user, permission)) {
    return <>{fallback}</>;
  }

  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(user, anyPermission)) {
    return <>{fallback}</>;
  }

  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(user, allPermissions)) {
    return <>{fallback}</>;
  }

  if (role && !hasRole(user, role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export interface RoleGateProps {
  role: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * RoleGate
 * Declarative component for role-scoped visibility.
 */
export function RoleGate({
  role,
  fallback = null,
  children,
}: RoleGateProps): React.ReactElement | null {
  const { user } = useAuthStore();

  if (!hasRole(user, role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
