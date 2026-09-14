import { ApiKey, type IApiKey, type ApiPermissionScope } from '../models/ApiKey.js';
import { IntegrationAuditLog } from '../models/IntegrationAuditLog.js';
import { generateApiKey, hashApiKey } from '../utils/encryption.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors/AppError.js';

export class ApiKeyService {
  /**
   * Generates a new API key for a tenant with scoped permissions.
   * Returns the raw key secret ONCE for the user to copy.
   */
  public static async createApiKey(
    tenantId: string,
    payload: {
      name: string;
      permissions?: ApiPermissionScope[];
      rateLimitPerMinute?: number;
      expiresInDays?: number;
    },
    createdBy: string
  ): Promise<{ apiKey: IApiKey; rawKey: string }> {
    if (!payload.name) {
      throw new ValidationError('API key name is required.');
    }

    const { rawKey, keyId, hashedSecret, prefix } = generateApiKey();

    const expiresAt = payload.expiresInDays
      ? new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey = await ApiKey.create({
      tenantId,
      name: payload.name,
      keyId,
      hashedSecret,
      prefix,
      permissions: payload.permissions || ['products:read', 'inventory:read', 'orders:read'],
      rateLimitPerMinute: payload.rateLimitPerMinute || 60,
      expiresAt,
      createdBy,
    });

    await IntegrationAuditLog.create({
      tenantId,
      action: 'API_KEY_CREATED',
      resourceId: apiKey._id.toString(),
      details: { keyId, name: payload.name, permissions: apiKey.permissions },
      performedBy: createdBy,
    });

    return { apiKey, rawKey };
  }

  /**
   * Lists all API keys for a tenant (never exposes raw keys or hashed secrets).
   */
  public static async listApiKeys(tenantId: string): Promise<IApiKey[]> {
    return ApiKey.find({ tenantId }).select('-hashedSecret').sort({ createdAt: -1 });
  }

  /**
   * Revokes an active API key immediately.
   */
  public static async revokeApiKey(
    tenantId: string,
    keyId: string,
    revokedBy: string
  ): Promise<IApiKey> {
    const apiKey = await ApiKey.findOne({ tenantId, keyId });
    if (!apiKey) {
      throw new NotFoundError('API key not found.');
    }

    apiKey.revokedAt = new Date();
    apiKey.revokedBy = revokedBy;
    await apiKey.save();

    await IntegrationAuditLog.create({
      tenantId,
      action: 'API_KEY_REVOKED',
      resourceId: apiKey._id.toString(),
      details: { keyId, name: apiKey.name },
      performedBy: revokedBy,
    });

    return apiKey;
  }

  /**
   * Rotates an API key: revokes existing key and returns a newly minted key with same permissions.
   */
  public static async rotateApiKey(
    tenantId: string,
    keyId: string,
    performedBy: string
  ): Promise<{ apiKey: IApiKey; rawKey: string }> {
    const oldKey = await ApiKey.findOne({ tenantId, keyId });
    if (!oldKey) {
      throw new NotFoundError('API key not found.');
    }

    oldKey.revokedAt = new Date();
    oldKey.revokedBy = performedBy;
    await oldKey.save();

    const newKeyResult = await this.createApiKey(
      tenantId,
      {
        name: `${oldKey.name} (Rotated)`,
        permissions: oldKey.permissions,
        rateLimitPerMinute: oldKey.rateLimitPerMinute,
      },
      performedBy
    );

    await IntegrationAuditLog.create({
      tenantId,
      action: 'API_KEY_ROTATED',
      resourceId: newKeyResult.apiKey._id.toString(),
      details: { oldKeyId: keyId, newKeyId: newKeyResult.apiKey.keyId },
      performedBy,
    });

    return newKeyResult;
  }

  /**
   * Validates an incoming API key string, verifies expiration, and checks scope.
   */
  public static async authenticateApiKey(
    rawKey: string,
    requiredScope?: ApiPermissionScope
  ): Promise<{ tenantId: string; apiKey: IApiKey }> {
    if (!rawKey || !rawKey.startsWith('sk_live_')) {
      throw new AuthorizationError('Invalid API key format.');
    }

    const hashed = hashApiKey(rawKey);
    const apiKey = await ApiKey.findOne({ hashedSecret: hashed });

    if (!apiKey) {
      throw new AuthorizationError('API key is invalid or unrecognized.');
    }

    if (apiKey.revokedAt) {
      throw new AuthorizationError('API key has been revoked.');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new AuthorizationError('API key has expired.');
    }

    if (requiredScope && !apiKey.permissions.includes(requiredScope)) {
      throw new AuthorizationError(`API key lacks required permission scope [${requiredScope}].`);
    }

    // Update last used asynchronously
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).exec();

    return { tenantId: apiKey.tenantId, apiKey };
  }
}
