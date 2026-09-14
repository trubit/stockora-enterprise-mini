import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import {
  encryptSecret,
  decryptSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../utils/encryption.js';
import { redactSecrets } from '../utils/redact.js';
import { sanitizeCsvCell, generateSafeCsv } from '../utils/csvSecurity.js';
import { IntegrationService } from '../services/integration.service.js';
import { Integration } from '../models/Integration.js';
import { AdapterRegistry } from '../services/integrations/adapterRegistry.js';

describe('Phase 45 — Cryptography, Security & Integration Hub Unit & Service Tests', () => {
  const tenantA = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_integrations');
    }
    await Integration.deleteMany({});
  });

  afterAll(async () => {
    await Integration.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('1. AES-256-GCM Encryption Vault', () => {
    it('encrypts and decrypts sensitive secrets symmetrically and losslessly', () => {
      const plainSecret = 'sk_live_super_secret_oauth_refresh_token_xyz_9988!';
      const encrypted = encryptSecret(plainSecret);

      expect(encrypted).not.toBe(plainSecret);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(plainSecret);
    });

    it('throws error if payload format is tampered or corrupted', () => {
      expect(() => decryptSecret('invalid_payload_format')).toThrow();
    });
  });

  describe('2. Secret Redaction Engine', () => {
    it('redacts sensitive keys from objects and nested arrays', () => {
      const sensitiveData = {
        name: 'QuickBooks Integration',
        apiKey: 'sk_live_sensitive_key_123',
        clientSecret: 'secret_value_xyz',
        headers: {
          authorization: 'Bearer token_abc_123',
          normalHeader: 'application/json',
        },
      };

      const redacted = redactSecrets(sensitiveData);
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.clientSecret).toBe('[REDACTED]');
      expect(redacted.headers.authorization).toBe('[REDACTED]');
      expect(redacted.headers.normalHeader).toBe('application/json');
    });

    it('redacts inline tokens and API keys from raw strings', () => {
      const rawLog =
        'Connecting to external provider with sk_live_secret123456789 and Bearer my_jwt_token_999';
      const sanitized = redactSecrets(rawLog);

      expect(sanitized).toContain('sk_live_[REDACTED]');
      expect(sanitized).toContain('Bearer [REDACTED]');
    });
  });

  describe('3. CSV Formula Injection Defense', () => {
    it('prepends single quote to dangerous spreadsheet formula triggers', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
      expect(sanitizeCsvCell('+123456')).toBe(`"'+123456"`);
      expect(sanitizeCsvCell('-cmd|"/C calc"!A0')).toBe(`"'-cmd|""/C calc""!A0"`);
      expect(sanitizeCsvCell('@HYPERLINK("http://attacker.com")')).toBe(
        `"'@HYPERLINK(""http://attacker.com"")"`
      );
      expect(sanitizeCsvCell('Normal Product Name')).toBe('Normal Product Name');
    });

    it('generates completely sanitized CSV content for data export', () => {
      const headers = ['id', 'name', 'price'];
      const rows = [
        { id: '1', name: '=cmd|evil()', price: '100' },
        { id: '2', name: 'Safe Item', price: '250' },
      ];

      const csv = generateSafeCsv(headers, rows);
      expect(csv).toContain(`"\'=cmd|evil()"`);
      expect(csv).toContain('Safe Item');
    });
  });

  describe('4. Adapter Registry & Integration Service', () => {
    it('lists all available provider adapters in catalog', async () => {
      const catalog = AdapterRegistry.getAvailableCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(5);
      expect(catalog.some((c) => c.provider === 'quickbooks')).toBe(true);
      expect(catalog.some((c) => c.provider === 'shopify')).toBe(true);
      expect(catalog.some((c) => c.provider === 'slack')).toBe(true);
    });

    it('configures, tests, syncs, and disconnects integration for a tenant', async () => {
      // 1. Configure
      const configured = await IntegrationService.configureIntegration(
        tenantA,
        'quickbooks',
        {
          configuration: { realmId: 'realm-test-101', environment: 'sandbox' },
          credentials: 'qb-access-token-live',
        },
        'admin@tenanta.com'
      );

      expect(configured.status).toBe('CONNECTED');
      expect(configured.credentialsEncrypted).toBeDefined();

      // 2. Test Connection
      const testRes = await IntegrationService.testConnection(tenantA, 'quickbooks');
      expect(testRes.success).toBe(true);
      expect(testRes.statusCode).toBe(200);

      // 3. Sync
      const syncRes = await IntegrationService.triggerSync(
        tenantA,
        'quickbooks',
        ['products', 'inventory'],
        'admin@tenanta.com'
      );
      expect(syncRes.success).toBe(true);
      expect(syncRes.entitiesSynced.products).toBeDefined();

      // 4. Disconnect
      await IntegrationService.disconnectIntegration(tenantA, 'quickbooks', 'admin@tenanta.com');
      const updated = await Integration.findOne({ tenantId: tenantA, provider: 'quickbooks' });
      expect(updated?.status).toBe('DISABLED');
      expect(updated?.credentialsEncrypted).toBeUndefined();
    });
  });

  describe('5. Webhook HMAC SHA-256 Signatures', () => {
    it('signs and verifies webhook payload cryptographically', () => {
      const payload = JSON.stringify({ id: 'evt_101', event: 'order.created', total: 5000 });
      const secret = 'whsec_my_super_secret_signing_key_456';

      const signature = signWebhookPayload(payload, secret);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');

      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);

      const isInvalid = verifyWebhookSignature(
        payload,
        'wrong_signature_hex_1234567890abcdef',
        secret
      );
      expect(isInvalid).toBe(false);
    });
  });
});
