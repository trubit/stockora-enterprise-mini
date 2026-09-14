import toast, { type ToastOptions } from 'react-hot-toast';

// Cache recent toast messages to prevent duplicate spam within a window (1500ms)
const recentNotifications = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 1500;

function shouldThrottle(message: string): boolean {
  const now = Date.now();
  const lastTime = recentNotifications.get(message);
  if (lastTime && now - lastTime < DEDUPLICATION_WINDOW_MS) {
    return true;
  }
  recentNotifications.set(message, now);
  // Periodically clean up old entries
  if (recentNotifications.size > 100) {
    for (const [key, timestamp] of recentNotifications.entries()) {
      if (now - timestamp > DEDUPLICATION_WINDOW_MS * 2) {
        recentNotifications.delete(key);
      }
    }
  }
  return false;
}

/**
 * Normalizes any error object, string, or unknown value into a clean, safe, human-readable message.
 * Never exposes raw MongoDB errors, stack traces, or [object Object].
 */
export function normalizeErrorMessage(
  err: unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  if (!err) return fallbackMessage;

  if (typeof err === 'string') {
    // Strip common technical prefixes if present
    const cleaned = err.trim();
    if (cleaned.startsWith('Error:')) {
      return cleaned.replace(/^Error:\s*/, '');
    }
    return cleaned || fallbackMessage;
  }

  // Axios or API error structures
  const axiosError = err as {
    response?: {
      status?: number;
      data?:
        | {
            error?: { message?: string; details?: unknown } | string;
            message?: string;
          }
        | string;
    };
    message?: string;
  };

  if (axiosError.response?.data) {
    const data = axiosError.response.data;
    if (typeof data === 'string') {
      if (data.length < 200 && !data.includes('<!DOCTYPE')) {
        return data;
      }
    } else if (data && typeof data === 'object') {
      if (typeof data.error === 'string') {
        return data.error;
      }
      if (
        data.error &&
        typeof data.error === 'object' &&
        'message' in data.error &&
        typeof data.error.message === 'string'
      ) {
        return data.error.message;
      }
      if (typeof data.message === 'string') {
        return data.message;
      }
    }
  }

  // Map common HTTP status codes
  const status = axiosError.response?.status;
  if (status === 400) return 'Invalid request. Please verify your inputs.';
  if (status === 401) return 'Session expired or authentication failed. Please sign in again.';
  if (status === 403) return 'Access denied. You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'A conflict occurred. This record may already exist.';
  if (status === 422) return 'Validation failed. Please review your information and try again.';
  if (status === 429) return 'Too many requests. Please slow down and try again shortly.';
  if (status && status >= 500)
    return 'Server error encountered. Our team has been notified. Please try again later.';

  // Standard JS Error object
  if (err instanceof Error) {
    if (
      err.message &&
      err.message !== '[object Object]' &&
      !err.message.includes('Network Error')
    ) {
      return err.message;
    }
  }

  return fallbackMessage;
}

/**
 * Production-ready notification system for Stockora Enterprise.
 * Provides accessible, deduplicated, theme-styled feedback.
 */
export const notify = {
  success: (message: string, options?: ToastOptions) => {
    if (shouldThrottle(message)) return '';
    return toast.success(message, {
      duration: 3500,
      ariaProps: { role: 'status', 'aria-live': 'polite' },
      ...options,
    });
  },

  error: (errOrMessage: unknown, options?: ToastOptions & { fallback?: string }) => {
    const message =
      typeof errOrMessage === 'string' && !errOrMessage.includes('[object')
        ? errOrMessage
        : normalizeErrorMessage(errOrMessage, options?.fallback);

    if (shouldThrottle(message)) return '';
    return toast.error(message, {
      duration: 4500,
      ariaProps: { role: 'alert', 'aria-live': 'assertive' },
      ...options,
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    if (shouldThrottle(message)) return '';
    return toast(message, {
      icon: '⚠️',
      duration: 4000,
      style: {
        borderColor: 'rgba(245, 158, 11, 0.4)',
      },
      ariaProps: { role: 'status', 'aria-live': 'polite' },
      ...options,
    });
  },

  info: (message: string, options?: ToastOptions) => {
    if (shouldThrottle(message)) return '';
    return toast(message, {
      icon: 'ℹ️',
      duration: 3500,
      style: {
        borderColor: 'rgba(59, 130, 246, 0.4)',
      },
      ariaProps: { role: 'status', 'aria-live': 'polite' },
      ...options,
    });
  },

  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      ariaProps: { role: 'status', 'aria-live': 'polite' },
      ...options,
    });
  },

  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },
};

export default notify;
