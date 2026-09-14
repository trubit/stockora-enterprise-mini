import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { ApiKeyService } from '../services/apiKey.service.js';
import { ApiKey } from '../models/ApiKey.js';

describe('Phase 45 — API Key Lifecycle & Scoped Permissions Tests', () => {
  const tenantId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }
    await ApiKey.deleteMany({ tenantId });
  });

  afterAll(async () => {
    await ApiKey.deleteMany({ tenantId });
  });

  it('creates an API key, reveals secret once, and verifies scoped authentication', async () => {
    const { apiKey, rawKey } = await ApiKeyService.createApiKey(
      tenantId,
      {
        name: 'ERP Ingest Token',
        permissions: ['products:read', 'products:write', 'inventory:read'],
        expiresInDays: 30,
      },
      'admin@tenant.com'
    );

    expect(rawKey.startsWith('sk_live_')).toBe(true);
    expect(apiKey.keyId).toBeDefined();
    expect(apiKey.hashedSecret).not.toBe(rawKey);

    // Verify valid authentication with allowed scope
    const authResult = await ApiKeyService.authenticateApiKey(rawKey, 'products:read');
    expect(authResult.tenantId).toBe(tenantId);
    expect(authResult.apiKey.name).toBe('ERP Ingest Token');

    // Verify denial when requesting unassigned scope
    await expect(ApiKeyService.authenticateApiKey(rawKey, 'finance:read')).rejects.toThrow(
      'API key lacks required permission scope [finance:read].'
    );
  });

  it('revokes an API key and blocks subsequent authentication attempts', async () => {
    const { apiKey, rawKey } = await ApiKeyService.createApiKey(
      tenantId,
      {
        name: 'Temporary Token',
        permissions: ['orders:read'],
      },
      'admin@tenant.com'
    );

    await ApiKeyService.revokeApiKey(tenantId, apiKey.keyId, 'admin@tenant.com');

    await expect(ApiKeyService.authenticateApiKey(rawKey, 'orders:read')).rejects.toThrow(
      'API key has been revoked.'
    );
  });

  it('rotates an API key: invalidates old key and issues new secret with same permissions', async () => {
    const { apiKey: oldKey, rawKey: oldRawKey } = await ApiKeyService.createApiKey(
      tenantId,
      {
        name: 'Rotating Token',
        permissions: ['customers:read'],
      },
      'admin@tenant.com'
    );

    const { apiKey: newKey, rawKey: newRawKey } = await ApiKeyService.rotateApiKey(
      tenantId,
      oldKey.keyId,
      'admin@tenant.com'
    );

    // Old key fails
    await expect(ApiKeyService.authenticateApiKey(oldRawKey, 'customers:read')).rejects.toThrow(
      'API key has been revoked.'
    );

    // New key succeeds
    const newAuth = await ApiKeyService.authenticateApiKey(newRawKey, 'customers:read');
    expect(newAuth.apiKey.keyId).toBe(newKey.keyId);
    expect(newAuth.apiKey.permissions).toContain('customers:read');
  });
});
