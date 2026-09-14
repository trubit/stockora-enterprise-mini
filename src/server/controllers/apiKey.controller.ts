import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ApiKeyService } from '../services/apiKey.service.js';
import { AuthorizationError } from '../errors/AppError.js';

export class ApiKeyController {
  /**
   * POST /api/v1/integrations/api-keys
   * Creates a new scoped API key for the tenant.
   */
  public static async createApiKey(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { name, permissions, rateLimitPerMinute, expiresInDays } = req.body;
      const createdBy = req.user?.email || req.user?.username || 'Unknown User';

      const result = await ApiKeyService.createApiKey(
        tenantId,
        { name, permissions, rateLimitPerMinute, expiresInDays },
        createdBy
      );

      res.status(201).json({
        success: true,
        message:
          'API Key generated successfully. Copy the secret now; it will not be displayed again.',
        data: {
          apiKey: result.apiKey,
          rawKey: result.rawKey,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/api-keys
   * Lists all API keys for the tenant.
   */
  public static async listApiKeys(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const keys = await ApiKeyService.listApiKeys(tenantId);
      res.json({ success: true, data: keys });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/api-keys/:keyId/revoke
   * Revokes an active API key immediately.
   */
  public static async revokeApiKey(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { keyId } = req.params;
      const revokedBy = req.user?.email || req.user?.username || 'Unknown User';

      const apiKey = await ApiKeyService.revokeApiKey(tenantId, String(keyId), revokedBy);
      res.json({
        success: true,
        message: 'API key revoked successfully.',
        data: apiKey,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/api-keys/:keyId/rotate
   * Rotates an API key.
   */
  public static async rotateApiKey(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { keyId } = req.params;
      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      const result = await ApiKeyService.rotateApiKey(tenantId, String(keyId), performedBy);
      res.json({
        success: true,
        message: 'API key rotated successfully. Copy your new secret key.',
        data: {
          apiKey: result.apiKey,
          rawKey: result.rawKey,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
