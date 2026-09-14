import { create } from 'zustand';
import { apiClient } from '../api/client.ts';
import { useAuthStore } from './auth.ts';

export interface ITenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  invoiceHeader?: string;
  invoiceFooter?: string;
  posBannerUrl?: string;
}

export interface ITenantContact {
  email: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ITenantFiscalConfig {
  fiscalYearStartMonth?: number;
  currency: string;
  currencySymbol?: string;
  timezone: string;
  locale: string;
  dateFormat?: string;
  numberFormat?: string;
}

export interface ITenantLimits {
  maxUsers: number;
  maxBranches: number;
  maxWarehouses: number;
  maxPOSTerminals: number;
  maxProducts: number;
  maxStorageMb: number;
}

export interface TenantInfo {
  _id: string;
  id?: string;
  name: string;
  legalName?: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PENDING' | 'CANCELLED';
  businessType: string;
  industry?: string;
  logoUrl?: string;
  branding: ITenantBranding;
  contact: ITenantContact;
  fiscalConfig: ITenantFiscalConfig;
  features: Record<string, boolean>;
  limits: ITenantLimits;
  subscriptionTier: 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
  onboardingCompleted: boolean;
}

export interface UserTenantItem {
  tenantId: string;
  tenantSlug?: string;
  tenantName?: string;
  roleName: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PENDING' | 'CANCELLED';
  branchId?: string;
  allowedBranches?: string[];
  isDefault?: boolean;
}

interface TenantState {
  activeTenant: TenantInfo | null;
  activeTenantId: string | null;
  activeTenantSlug: string | null;
  userTenants: UserTenantItem[];
  isLoading: boolean;
  error: string | null;

  setActiveTenant: (tenant: TenantInfo) => void;
  setUserTenants: (tenants: UserTenantItem[]) => void;
  fetchCurrentTenant: () => Promise<TenantInfo | null>;
  fetchUserTenants: () => Promise<UserTenantItem[]>;
  switchTenant: (targetTenantIdOrSlug: string) => Promise<boolean>;
  updateBranding: (branding: Partial<ITenantBranding>) => void;
  clearTenantState: () => void;
}

import { STORAGE_KEYS } from '../constants/storage.js';

export const useTenantStore = create<TenantState>((set, get) => ({
  activeTenant: null,
  activeTenantId:
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT_ID) : null,
  activeTenantSlug:
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT_SLUG) : null,
  userTenants: [],
  isLoading: false,
  error: null,

  setActiveTenant: (tenant) => {
    const tenantId = tenant._id || tenant.id || '';
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT_ID, tenantId);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT_SLUG, tenant.slug);
    }
    set({
      activeTenant: tenant,
      activeTenantId: tenantId,
      activeTenantSlug: tenant.slug,
      error: null,
    });
  },

  setUserTenants: (userTenants) => set({ userTenants }),

  fetchCurrentTenant: async () => {
    set({ isLoading: true });
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) {
        set({ isLoading: false });
        return null;
      }

      const activeTenantId = get().activeTenantId;
      const headers: Record<string, string> = {};
      if (activeTenantId) {
        headers['x-tenant-id'] = activeTenantId;
      }

      const res = await apiClient.get('/tenants/current', { headers });
      const tenant = res.data;
      if (tenant) {
        get().setActiveTenant(tenant);
      }
      set({ isLoading: false });
      return tenant;
    } catch (err: any) {
      const status = err?.response?.status;
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string' ? err.response.data : err.message);

      const isInvalidTenant =
        status === 401 ||
        status === 404 ||
        status === 403 ||
        (typeof errorMsg === 'string' &&
          (errorMsg.toLowerCase().includes('user account not found') ||
            errorMsg.toLowerCase().includes('not authorized') ||
            errorMsg.toLowerCase().includes('not found')));

      if (isInvalidTenant) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_SLUG);
        }
        set({
          activeTenant: null,
          activeTenantId: null,
          activeTenantSlug: null,
          isLoading: false,
          error: null,
        });
        return null;
      }

      console.warn('Failed to fetch active tenant profile:', errorMsg);
      set({ isLoading: false, error: typeof errorMsg === 'string' ? errorMsg : null });
      return null;
    }
  },

  fetchUserTenants: async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) return [];
      const res = await apiClient.get('/tenants/user-tenants');
      const list = res.data || [];
      set({ userTenants: list });
      return list;
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        console.error('Failed to fetch user tenants:', err);
      }
      return [];
    }
  },

  switchTenant: async (targetTenantIdOrSlug: string) => {
    set({ isLoading: true });
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!token) return false;
      const res = await apiClient.post('/tenants/switch', { tenantId: targetTenantIdOrSlug });

      const { token: newToken, activeTenant, user } = res.data;
      if (newToken) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
      }
      if (activeTenant) {
        get().setActiveTenant(activeTenant);
      }
      if (user) {
        useAuthStore.getState().setUser(user);
      }

      set({ isLoading: false });
      return true;
    } catch (err: any) {
      console.error('Failed to switch tenant:', err);
      set({
        isLoading: false,
        error: err?.response?.data?.message || 'Tenant switch failed',
      });
      return false;
    }
  },

  updateBranding: (branding) => {
    set((state) => {
      if (!state.activeTenant) return state;
      return {
        activeTenant: {
          ...state.activeTenant,
          branding: { ...state.activeTenant.branding, ...branding },
        },
      };
    });
  },

  clearTenantState: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_SLUG);
    }
    set({
      activeTenant: null,
      activeTenantId: null,
      activeTenantSlug: null,
      userTenants: [],
      error: null,
    });
  },
}));
