/**
 * Centralized Client URL & Safe External Navigation Utility
 */

/**
 * Returns the configured public frontend URL.
 * Falls back to the current browser origin if in browser context.
 */
export const getPublicFrontendUrl = (): string => {
  const envUrl =
    (import.meta as any).env?.VITE_PUBLIC_URL || (import.meta as any).env?.VITE_FRONTEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3050';
};

/**
 * Returns the base URL for WebSocket / Socket.IO connections.
 */
export const getSocketBaseUrl = (): string => {
  const envSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL;
  if (envSocketUrl && typeof envSocketUrl === 'string' && envSocketUrl.trim().length > 0) {
    return envSocketUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
};

/**
 * Safely performs an external redirect to a trusted third-party service (e.g. Stripe, Paystack checkout).
 * Guards against javascript:, data:, and other malicious URL schemes to prevent Open Redirect / XSS vulnerabilities.
 */
export const safeExternalRedirect = (targetUrl: string): boolean => {
  if (!targetUrl || typeof targetUrl !== 'string') {
    console.error('[Security] Attempted external redirect with invalid or empty URL.');
    return false;
  }

  const trimmed = targetUrl.trim();

  try {
    const parsed = new URL(
      trimmed,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    const protocol = parsed.protocol.toLowerCase();

    // Enforce strict HTTP/HTTPS protocol whitelist
    if (protocol !== 'https:' && protocol !== 'http:') {
      console.error(
        `[Security] Blocked external redirect with disallowed protocol "${protocol}": ${trimmed}`
      );
      return false;
    }

    if (typeof window !== 'undefined') {
      window.location.assign(parsed.href);
      return true;
    }
  } catch (err) {
    console.error('[Security] Failed to parse target redirect URL:', err);
    return false;
  }

  return false;
};
