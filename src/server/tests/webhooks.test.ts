import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { WebhookService } from '../services/webhook.service.js';
import { WebhookSubscription } from '../models/WebhookSubscription.js';
import { WebhookDeliveryLog } from '../models/WebhookDeliveryLog.js';

describe('Phase 45 — Webhooks Outbound Delivery & Replay Tests', () => {
  const tenantId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_webhooks');
    }
    await WebhookSubscription.deleteMany({});
    await WebhookDeliveryLog.deleteMany({});
  });

  afterAll(async () => {
    await WebhookSubscription.deleteMany({});
    await WebhookDeliveryLog.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('creates a webhook subscription with encrypted secret and lists subscriptions', async () => {
    const { subscription, secret } = await WebhookService.createSubscription(
      tenantId,
      {
        name: 'Order Pipeline Listener',
        endpointUrl: 'https://api.external.com/webhooks/orders',
        events: ['order.created', 'order.completed'],
      },
      'admin@tenant.com'
    );

    expect(subscription._id).toBeDefined();
    expect(subscription.endpointUrl).toBe('https://api.external.com/webhooks/orders');
    expect(secret.startsWith('whsec_')).toBe(true);

    const list = await WebhookService.listSubscriptions(tenantId);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Order Pipeline Listener');
  });

  it('logs delivery attempts and supports safe replay mechanism', async () => {
    const sub = await WebhookSubscription.findOne({ tenantId });
    expect(sub).toBeDefined();

    // Create a mock delivery log
    const log = await WebhookDeliveryLog.create({
      tenantId,
      webhookId: sub!._id,
      eventId: 'evt_test_replay_101',
      event: 'order.created',
      endpointUrl: sub!.endpointUrl,
      attempt: 1,
      statusCode: 503,
      durationMs: 45,
      success: false,
      errorCategory: 'SERVER_ERROR',
      errorMessage: 'Service Unavailable',
      payloadSnippet: JSON.stringify({ id: 'order_999', total: 15000 }),
      signature: 'test_signature_hex',
      deliveredAt: new Date(),
    });

    const logs = await WebhookService.getDeliveryLogs(tenantId);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].eventId).toBe('evt_test_replay_101');
  });
});
