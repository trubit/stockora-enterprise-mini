import { useAuthStore } from '../store/auth.ts';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  hasRole as checkRole,
  getEffectivePermissions,
} from '../../shared/permissions.js';

export function usePermission(permission?: string): boolean {
  const { user } = useAuthStore();
  return checkPermission(user, permission);
}

export function useAnyPermission(permissions: string[]): boolean {
  const { user } = useAuthStore();
  return checkAnyPermission(user, permissions);
}

export function useAllPermissions(permissions: string[]): boolean {
  const { user } = useAuthStore();
  return checkAllPermissions(user, permissions);
}

export function useRole(allowedRoles: string | string[]): boolean {
  const { user } = useAuthStore();
  return checkRole(user, allowedRoles);
}

export function useEffectivePermissions(): string[] {
  const { user } = useAuthStore();
  return getEffectivePermissions(user);
}
