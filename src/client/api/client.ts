import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { notify, normalizeErrorMessage } from '../utils/notify.ts';
import { useAuthStore } from '../store/auth.ts';
import { appNavigate, getCurrentPath } from '../utils/navigation.ts';
import { STORAGE_KEYS } from '../constants/storage.ts';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = apiClient;

// Track ongoing refresh to prevent multiple parallel refresh calls
let isRefreshing = false;
interface PendingPromise {
  resolve: (token: string) => void;
  reject: (err: any) => void;
}
let pendingRequests: PendingPromise[] = [];

function resolvePending(newToken: string) {
  pendingRequests.forEach((req) => req.resolve(newToken));
  pendingRequests = [];
}

function rejectPending(error: any) {
  pendingRequests.forEach((req) => req.reject(error));
  pendingRequests = [];
}

function isPublicAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/verify-reset-otp') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/verify-email') ||
    url.includes('/auth/resend-verification-otp') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/invitations/accept')
  );
}

// Request Interceptor: Attach JWT bearer token automatically for authenticated endpoints
apiClient.interceptors.request.use(
  (config) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {} as any;
    }

    const isPublicAuth = isPublicAuthEndpoint(config.url);
    const isLogout = config.url?.includes('/auth/logout');

    if (!isPublicAuth || isLogout) {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const activeTenantId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
      if (activeTenantId && !config.headers['x-tenant-id']) {
        config.headers['x-tenant-id'] = activeTenantId;
      }
    } else {
      // Never send stale Authorization header to public auth endpoints
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function isPublicAuthPage(): boolean {
  const path = getCurrentPath();
  return (
    path === '/login' ||
    path === '/signup' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/verify-email' ||
    path === '/landing' ||
    path.startsWith('/invitations/')
  );
}

// Response Interceptor: Silent token refresh on 401 for authenticated routes, toast on other errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
      _skipGlobalErrorToast?: boolean;
    };
    const status = error.response?.status;
    const safeMessage = normalizeErrorMessage(error);
    const isPublicAuth = isPublicAuthEndpoint(originalRequest.url);

    const isUserNotFound =
      status === 403 &&
      (safeMessage.toLowerCase().includes('user account not found') ||
        error?.response?.data?.message?.toLowerCase()?.includes('user account not found') ||
        error?.response?.data?.error?.message?.toLowerCase()?.includes('user account not found'));

    if (isUserNotFound) {
      useAuthStore.getState().clearSession();
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
      if (!isPublicAuthPage()) {
        appNavigate('/login', { replace: true });
        notify.error('User account not found or session invalid. Please log in again.');
      }
      return Promise.reject(error);
    }

    // Attempt silent refresh on 401 (expired access token), but NEVER for unauthenticated/auth endpoints
    if (status === 401 && !originalRequest._retry && !isPublicAuth) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        // No refresh token available — clear and redirect safely if on a protected route
        useAuthStore.getState().clearSession();
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
        if (!isPublicAuthPage()) {
          appNavigate('/login', { replace: true });
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the in-flight refresh finishes
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (newToken: string) => {
              if (originalRequest.headers) {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              }
              resolve(apiClient(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            },
          });
          // Timeout safety: if pending too long, reject
          setTimeout(() => reject(error), 10000);
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken: newToken, refreshToken: newRefreshToken, user } = data;

        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
        const currentUser = user || useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setSession(currentUser, newToken, newRefreshToken);
        }

        resolvePending(newToken);
        isRefreshing = false;

        // Retry the original request with the new token
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        rejectPending(refreshErr);
        useAuthStore.getState().clearSession();
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
        if (!isPublicAuthPage()) {
          appNavigate('/login', { replace: true });
          notify.error('Session expired. Please log in again.');
        }
        return Promise.reject(refreshErr);
      }
    }

    if (!originalRequest._skipGlobalErrorToast) {
      if (status === 403) {
        // Only show 403 toast for authenticated/protected routes
        if (!isPublicAuth) {
          notify.error('Access denied. You do not have permissions for this action.');
        }
      } else if (status === 401) {
        // CRITICAL FIX: Only redirect & toast for authenticated routes.
        // Public auth endpoints (OTP, forgot-password, reset-password, verify-email) handle
        // their own errors in component-level catch blocks. Firing a global
        // "Session expired" toast here for a wrong-OTP 401 is what was causing
        // users to believe they had been redirected to login.
        if (!isPublicAuth) {
          useAuthStore.getState().clearSession();
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT_ID);
          if (!isPublicAuthPage()) {
            appNavigate('/login', { replace: true });
          }
          notify.error('Session expired. Please log in again.');
        }
        // For public auth endpoints: do nothing globally — the component catch block handles it.
      } else if (status && status >= 500) {
        notify.error('Internal server error. Please try again later.');
      } else if (status !== 404 && !isPublicAuth) {
        // Suppress 404 toasts and public auth toasts — they are handled by individual components
        notify.error(safeMessage);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
