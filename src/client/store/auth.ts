import { create } from 'zustand';
import type { User } from '../../shared/types.js';

import { STORAGE_KEYS } from '../constants/storage.js';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: User, accessToken: string, refreshToken?: string) => void;
  clearSession: () => void;
  updateUser: (user: Partial<User>) => void;
  setUser: (user: User | null) => void;
}

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  accessToken: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TOKEN) : null,
  refreshToken:
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) : null,
  setSession: (user, accessToken, refreshToken) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    set({
      user,
      accessToken,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
    });
  },
  clearSession: () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_SLUG);
    try {
      import('./tenant.js')
        .then((m) => m.useTenantStore.getState().clearTenantState())
        .catch(() => {});
    } catch {}
    set({ user: null, accessToken: null, refreshToken: null });
  },
  updateUser: (updatedFields) =>
    set((state) => {
      const updated = state.user ? { ...state.user, ...updatedFields } : null;
      if (updated && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      }
      return { user: updated };
    }),
  setUser: (user) => {
    if (user && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else if (!user && typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
    set({ user });
  },
}));
