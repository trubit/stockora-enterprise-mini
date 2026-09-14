/**
 * Centralized secret redaction utility to ensure credentials, tokens,
 * passwords, and sensitive headers are never logged or exposed.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'clientsecret',
  'client_secret',
  'webhooksecret',
  'webhook_secret',
  'authorization',
  'credentials',
  'privatekey',
  'private_key',
  'auth',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
  'hashedsecret',
  'hashed_secret',
]);

/**
 * Recursively redacts sensitive fields from objects, arrays, and strings.
 */
export function redactSecrets<T = unknown>(target: T, depth = 0): T {
  if (depth > 10 || target === null || target === undefined) {
    return target;
  }

  if (typeof target === 'string') {
    let result: string = target;
    // Redact bearer tokens or basic auth strings
    if (/bearer\s+[a-zA-Z0-9._~+/-]+=*/i.test(result)) {
      result = result.replace(/bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
    }
    // Redact sk_live_... API keys
    if (/sk_live_[a-zA-Z0-9_]+/i.test(result)) {
      result = result.replace(/sk_live_[a-zA-Z0-9_]+/gi, 'sk_live_[REDACTED]');
    }
    return result as unknown as T;
  }

  if (Array.isArray(target)) {
    return target.map((item) => redactSecrets(item, depth + 1)) as unknown as T;
  }

  if (typeof target === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSecrets(value, depth + 1);
      }
    }
    return sanitized as unknown as T;
  }

  return target;
}
