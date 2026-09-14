import { Integration, type IIntegration } from '../models/Integration.js';
import { IntegrationAuditLog } from '../models/IntegrationAuditLog.js';
import { AdapterRegistry } from './integrations/adapterRegistry.js';
import { encryptSecret, decryptSecret } from '../utils/encryption.js';
import { executeWithResiliency } from '../utils/resiliency/index.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors/AppError.js';
import { logger } from '../logger.js';

export class IntegrationService {
  /**
   * Retrieves all integrations for a given tenant.
   * Merges with available catalog so all supported providers appear as available or connected.
   */
  public static async getTenantIntegrations(tenantId: string): Promise<any[]> {
    const catalog = AdapterRegistry.getAvailableCatalog();
    const existing = await Integration.find({ tenantId }).lean();
    const existingMap = new Map(existing.map((item) => [item.provider.toLowerCase(), item]));

    return catalog.map((item) => {
      const active = existingMap.get(item.provider.toLowerCase());
      if (active) {
        return {
          ...item,
          _id: active._id,
          tenantId: active.tenantId,
          status: active.status,
          isConfigured: active.isConfigured,
          configuration: active.configuration || {},
          hasCredentials: Boolean(active.credentialsEncrypted),
          syncSettings: active.syncSettings,
          lastSyncAt: active.lastSyncAt,
          lastSyncStatus: active.lastSyncStatus,
          lastError: active.lastError,
          createdAt: active.createdAt,
          updatedAt: active.updatedAt,
        };
      }
      return {
        ...item,
        status: 'AVAILABLE',
        isConfigured: false,
        configuration: {},
        hasCredentials: false,
        syncSettings: {
          enabled: false,
          direction: 'STOCKORA_TO_EXTERNAL',
          frequencyMinutes: 60,
          autoSyncOnEvent: true,
          conflictResolution: 'STOCKORA_WINS',
          syncedEntities: [],
        },
      };
    });
  }

  /**
   * Connects / Configures an integration for a tenant.
   * Credentials are encrypted at rest before storing.
   */
  public static async configureIntegration(
    tenantId: string,
    provider: string,
    payload: {
      configuration: Record<string, any>;
      credentials?: string;
      syncSettings?: any;
    },
    performedBy: string
  ): Promise<IIntegration> {
    const adapter = AdapterRegistry.get(provider);
    if (!adapter) {
      throw new NotFoundError(`Integration provider [${provider}] is not supported.`);
    }

    // Encrypt credentials if provided
    let credentialsEncrypted: string | undefined;
    if (payload.credentials) {
      credentialsEncrypted = encryptSecret(payload.credentials);
    }

    let integration = await Integration.findOne({ tenantId, provider });
    if (!integration) {
      integration = new Integration({
        tenantId,
        provider,
        name: adapter.name,
        category: adapter.category,
        status: 'CONNECTED',
        isConfigured: true,
        configuration: payload.configuration || {},
        credentialsEncrypted,
        syncSettings: payload.syncSettings || {
          enabled: true,
          direction: 'STOCKORA_TO_EXTERNAL',
          frequencyMinutes: 60,
          autoSyncOnEvent: true,
          conflictResolution: 'STOCKORA_WINS',
          syncedEntities: ['products', 'orders', 'inventory'],
        },
      });
    } else {
      integration.configuration = { ...integration.configuration, ...payload.configuration };
      if (credentialsEncrypted) {
        integration.credentialsEncrypted = credentialsEncrypted;
      }
      if (payload.syncSettings) {
        integration.syncSettings = { ...integration.syncSettings, ...payload.syncSettings };
      }
      integration.status = 'CONNECTED';
      integration.isConfigured = true;
    }

    await integration.save();

    await IntegrationAuditLog.create({
      tenantId,
      action: 'CONNECTED',
      provider,
      resourceId: integration._id.toString(),
      details: { configurationKeys: Object.keys(payload.configuration || {}) },
      performedBy,
    });

    return integration;
  }

  /**
   * Tests connectivity to the external provider using the registered adapter.
   */
  public static async testConnection(
    tenantId: string,
    provider: string,
    testConfig?: Record<string, any>,
    testCredentials?: string
  ): Promise<any> {
    const adapter = AdapterRegistry.get(provider);
    if (!adapter) {
      throw new NotFoundError(`Integration provider [${provider}] not found.`);
    }

    let effectiveConfig = testConfig;
    let effectiveCredentials = testCredentials;

    if (!effectiveConfig) {
      const existing = await Integration.findOne({ tenantId, provider });
      if (!existing) {
        throw new ValidationError('Integration not configured yet.');
      }
      effectiveConfig = existing.configuration;
      effectiveCredentials = existing.credentialsEncrypted
        ? decryptSecret(existing.credentialsEncrypted)
        : undefined;
    }

    // Execute test through Resiliency Engine with circuit breaker & timeout
    const result = await executeWithResiliency(
      () => adapter.validateConnection(effectiveConfig || {}, effectiveCredentials),
      {
        name: `IntegrationTest-${provider}`,
        timeoutMs: 8000,
        retryCount: 1,
        useCircuitBreaker: true,
      }
    );

    return result;
  }

  /**
   * Disconnects / Disables an integration for a tenant.
   */
  public static async disconnectIntegration(
    tenantId: string,
    provider: string,
    performedBy: string
  ): Promise<void> {
    const integration = await Integration.findOne({ tenantId, provider });
    if (!integration) {
      throw new NotFoundError(`Integration [${provider}] not found.`);
    }

    integration.status = 'DISABLED';
    integration.isConfigured = false;
    integration.credentialsEncrypted = undefined;
    await integration.save();

    await IntegrationAuditLog.create({
      tenantId,
      action: 'DISCONNECTED',
      provider,
      resourceId: integration._id.toString(),
      details: { reason: 'User disconnected' },
      performedBy,
    });
  }

  /**
   * Triggers an on-demand sync for a tenant's integration.
   */
  public static async triggerSync(
    tenantId: string,
    provider: string,
    entities: string[] = ['products', 'orders', 'inventory'],
    performedBy: string
  ): Promise<any> {
    const integration = await Integration.findOne({ tenantId, provider });
    if (!integration || integration.status === 'DISABLED') {
      throw new ValidationError(`Integration [${provider}] is not active or configured.`);
    }

    const adapter = AdapterRegistry.get(provider);
    if (!adapter || !adapter.sync) {
      throw new ValidationError(`Provider [${provider}] does not support manual sync.`);
    }

    const credentials = integration.credentialsEncrypted
      ? decryptSecret(integration.credentialsEncrypted)
      : undefined;

    await IntegrationAuditLog.create({
      tenantId,
      action: 'SYNC_STARTED',
      provider,
      details: { entities },
      performedBy,
    });

    try {
      const syncResult = await adapter.sync(integration.configuration, credentials, {
        tenantId,
        entities,
      });

      integration.lastSyncAt = new Date();
      integration.lastSyncStatus = syncResult.success ? 'SUCCESS' : 'FAILED';
      await integration.save();

      await IntegrationAuditLog.create({
        tenantId,
        action: 'SYNC_COMPLETED',
        provider,
        details: syncResult,
        performedBy,
      });

      return syncResult;
    } catch (err: any) {
      integration.lastSyncAt = new Date();
      integration.lastSyncStatus = 'FAILED';
      integration.lastError = {
        message: err.message,
        timestamp: new Date(),
      };
      await integration.save();

      await IntegrationAuditLog.create({
        tenantId,
        action: 'SYNC_FAILED',
        provider,
        details: { error: err.message },
        performedBy,
      });

      throw err;
    }
  }
}
