import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import type { ApiPermissionScope } from '../models/ApiKey.js';
import { ApiKeyService } from '../services/apiKey.service.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { AuthorizationError } from '../errors/AppError.js';
import { Tenant } from '../models/Tenant.js';

/**
 * Middleware: requireApiKeyAuth
 * Authenticates an external API request using an API key (e.g. Authorization: Bearer sk_live_... or X-API-Key: sk_live_...)
 * Resolves tenant securely, verifies non-revocation, checks scope, and enforces Phase 44 plan-based API permissions.
 */
export function requireApiKeyAuth(requiredScope?: ApiPermissionScope) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const xApiKeyHeader = req.headers['x-api-key'] as string | undefined;

      let rawKey = '';
      if (xApiKeyHeader && xApiKeyHeader.startsWith('sk_live_')) {
        rawKey = xApiKeyHeader;
      } else if (authHeader && authHeader.startsWith('Bearer sk_live_')) {
        rawKey = authHeader.replace('Bearer ', '').trim();
      }

      if (!rawKey) {
        return next(
          new AuthorizationError(
            'API Key is missing or invalid. Use X-API-Key: sk_live_... or Authorization: Bearer sk_live_...'
          )
        );
      }

      const { tenantId, apiKey } = await ApiKeyService.authenticateApiKey(rawKey, requiredScope);

      // Phase 44 Plan-based verification: API access must be enabled in active subscription tier
      const hasApiFeature = await SubscriptionService.hasFeature(tenantId, 'apiAccess');
      if (!hasApiFeature) {
        return next(
          new AuthorizationError(
            'API Access feature is disabled for your subscription tier. Please upgrade to Pro or Enterprise plan.'
          )
        );
      }

      const tenant = await Tenant.findById(tenantId);

      req.tenantId = tenantId;
      req.tenant = tenant || undefined;
      req.user = {
        id: apiKey._id.toString(),
        username: `apikey-${apiKey.name}`,
        email: `apikey-${apiKey.keyId}@api.internal`,
        roleName: 'API Client',
        tenantId,
        tenantSlug: tenant?.slug || '',
        permissions: apiKey.permissions,
        isPlatformAdmin: false,
      } as any;

      next();
    } catch (err) {
      next(err);
    }
  };
}
