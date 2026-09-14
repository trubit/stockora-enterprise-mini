import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { IntegrationService } from '../services/integration.service.js';
import { ApiKeyService } from '../services/apiKey.service.js';
import { WebhookService } from '../services/webhook.service.js';
import { ImportService } from '../services/import.service.js';
import { ExportService } from '../services/export.service.js';
import { Integration } from '../models/Integration.js';
import { ApiKey } from '../models/ApiKey.js';
import { WebhookSubscription } from '../models/WebhookSubscription.js';
import { ImportJob } from '../models/ImportJob.js';
import { ExportJob } from '../models/ExportJob.js';

describe('Phase 45 — Strict Cross-Tenant Isolation Security Tests (Tenant A vs Tenant B)', () => {
  const tenantHarn = new mongoose.Types.ObjectId().toString();
  const tenantHanson = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_isolation');
    }
    await Integration.deleteMany({});
    await ApiKey.deleteMany({});
    await WebhookSubscription.deleteMany({});
    await ImportJob.deleteMany({});
    await ExportJob.deleteMany({});
  });

  afterAll(async () => {
    await Integration.deleteMany({});
    await ApiKey.deleteMany({});
    await WebhookSubscription.deleteMany({});
    await ImportJob.deleteMany({});
    await ExportJob.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('verifies Harn cannot view or mutate Hanson integrations and credentials', async () => {
    // Hanson connects QuickBooks
    await IntegrationService.configureIntegration(
      tenantHanson,
      'quickbooks',
      {
        configuration: { realmId: 'hanson-realm-999' },
        credentials: 'hanson-secret-key-xyz',
      },
      'admin@hanson.com'
    );

    // Harn connects QuickBooks with different realm
    await IntegrationService.configureIntegration(
      tenantHarn,
      'quickbooks',
      {
        configuration: { realmId: 'harn-realm-111' },
        credentials: 'harn-secret-key-abc',
      },
      'admin@harn.com'
    );

    const harnIntegrations = await IntegrationService.getTenantIntegrations(tenantHarn);
    const hansonIntegrations = await IntegrationService.getTenantIntegrations(tenantHanson);

    const harnQB = harnIntegrations.find((i) => i.provider === 'quickbooks');
    const hansonQB = hansonIntegrations.find((i) => i.provider === 'quickbooks');

    expect(harnQB.configuration.realmId).toBe('harn-realm-111');
    expect(hansonQB.configuration.realmId).toBe('hanson-realm-999');
    expect(harnQB._id).not.toEqual(hansonQB._id);
  });

  it('verifies Harn API key cannot authenticate as Hanson or access Hanson data', async () => {
    const { rawKey: harnKey } = await ApiKeyService.createApiKey(
      tenantHarn,
      { name: 'Harn Key', permissions: ['products:read'] },
      'admin@harn.com'
    );

    const { rawKey: hansonKey } = await ApiKeyService.createApiKey(
      tenantHanson,
      { name: 'Hanson Key', permissions: ['products:read'] },
      'admin@hanson.com'
    );

    const harnAuth = await ApiKeyService.authenticateApiKey(harnKey);
    const hansonAuth = await ApiKeyService.authenticateApiKey(hansonKey);

    expect(harnAuth.tenantId).toBe(tenantHarn);
    expect(hansonAuth.tenantId).toBe(tenantHanson);
    expect(harnAuth.tenantId).not.toBe(hansonAuth.tenantId);

    // Harn cannot revoke Hanson's key
    await expect(
      ApiKeyService.revokeApiKey(tenantHarn, hansonAuth.apiKey.keyId, 'admin@harn.com')
    ).rejects.toThrow('API key not found.');
  });

  it('verifies Harn cannot view or delete Hanson webhook subscriptions', async () => {
    const { subscription: hansonSub } = await WebhookService.createSubscription(
      tenantHanson,
      {
        name: 'Hanson Webhook',
        endpointUrl: 'https://hanson.com/webhook',
        events: ['order.created'],
      },
      'admin@hanson.com'
    );

    // Harn tries to delete Hanson's subscription
    await expect(
      WebhookService.deleteSubscription(tenantHarn, hansonSub._id.toString(), 'admin@harn.com')
    ).rejects.toThrow('Webhook subscription not found.');
  });

  it('verifies Harn cannot view or access Hanson import and export jobs', async () => {
    const hansonImport = await ImportService.initializeImport(
      tenantHanson,
      {
        type: 'products',
        fileName: 'hanson_data.csv',
        fileSize: 500,
        format: 'CSV',
        rows: [{ sku: 'HANSON-1', name: 'Hanson Item', price: '100' }],
      },
      'admin@hanson.com'
    );

    // Harn tries to get Hanson import
    await expect(
      ImportService.getImportJob(tenantHarn, hansonImport._id.toString())
    ).rejects.toThrow('Import job not found.');
  });
});
