import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import axios from 'axios';
import crypto from 'crypto';
import { Plan } from '../models/Plan.js';
import { Tenant } from '../models/Tenant.js';
import { BillingTransaction } from '../models/BillingTransaction.js';
import { BillingService } from '../services/billing.service.js';
import { verifyPaystackSignature } from '../utils/paystack.js';
import { verifyStripeSignature } from '../utils/stripe.js';

vi.mock('axios');

describe('Payment Webhooks Cryptographic Verification & Idempotency Integration Tests', () => {
  let tenantId: string;
  let planId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_webhook');
    }
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await BillingTransaction.deleteMany({});

    const plan = await Plan.create({
      name: 'Webhook Plan',
      slug: 'webhook-plan',
      tier: 'STARTER',
      price: 15000,
      currency: 'NGN',
    });
    planId = plan._id.toString();

    const tenant = await Tenant.create({
      name: 'Webhook Tenant',
      slug: 'webhook-tenant',
      status: 'ACTIVE',
      contact: { email: 'hook@test.com' },
    });
    tenantId = tenant._id.toString();
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await BillingTransaction.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Paystack Webhook Verification', () => {
    it('should cryptographically verify Paystack HMAC SHA512 signatures using timingSafeEqual', () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        data: { reference: 'TEST-SIG-1' },
      });
      const secret = 'sk_test_secret_key_123';

      const validSignature = crypto.createHmac('sha512', secret).update(payload).digest('hex');

      const isValid = verifyPaystackSignature(payload, validSignature, secret);
      expect(isValid).toBe(true);

      const isInvalid = verifyPaystackSignature(payload, 'forged_fake_signature_abc', secret);
      expect(isInvalid).toBe(false);
    });

    it('should reject Paystack verification with missing or empty signatures', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      expect(verifyPaystackSignature(payload, '', 'secret_key')).toBe(false);
      expect(verifyPaystackSignature(payload, 'sig', '')).toBe(false);
    });
  });

  describe('Stripe Webhook Verification', () => {
    it('should cryptographically verify Stripe HMAC SHA256 timestamped signatures', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded', id: 'pi_test_123' });
      const secret = 'whsec_test_stripe_secret';
      const timestamp = Math.floor(Date.now() / 1000);

      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const header = `t=${timestamp},v1=${signature}`;

      const isValid = verifyStripeSignature(payload, header, secret);
      expect(isValid).toBe(true);

      const isInvalid = verifyStripeSignature(
        payload,
        `t=${timestamp},v1=forged_signature_123`,
        secret
      );
      expect(isInvalid).toBe(false);
    });

    it('should reject Stripe signatures that exceed the 5-minute replay tolerance window', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded', id: 'pi_test_123' });
      const secret = 'whsec_test_stripe_secret';
      // 10 minutes in the past (exceeds 300 second tolerance)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;

      const signedPayload = `${oldTimestamp}.${payload}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const header = `t=${oldTimestamp},v1=${signature}`;

      const isValid = verifyStripeSignature(payload, header, secret);
      expect(isValid).toBe(false);
    });
  });

  describe('Idempotency & Replay Protection', () => {
    it('should enforce idempotency by ignoring duplicate webhook event replays', async () => {
      const eventId = 'evt_unique_123456';
      const reference = 'REF_IDEMPOTENT_1';

      await BillingTransaction.create({
        tenantId,
        planId: new mongoose.Types.ObjectId(planId),
        amount: 15000,
        currency: 'NGN',
        provider: 'PAYSTACK',
        providerReference: reference,
        status: 'PENDING',
        type: 'SUBSCRIPTION_PAYMENT',
        metadata: { billingInterval: 'MONTHLY' },
      });

      const mockVerifyResponse = {
        data: {
          status: true,
          data: {
            status: 'success',
            amount: 1500000, // 15000 NGN in kobo
            currency: 'NGN',
            gateway_response: 'Successful',
            reference,
          },
        },
      };
      vi.mocked(axios.get).mockResolvedValue(mockVerifyResponse);

      const payload = {
        event: 'charge.success',
        data: {
          id: eventId,
          reference,
          amount: 1500000,
          currency: 'NGN',
          status: 'success',
        },
      };

      // 1st processing
      const firstResult = await BillingService.processPaystackWebhook(payload);
      expect(firstResult.processed).toBe(true);

      // Verify transaction status was updated to SUCCESS
      const updatedTx = await BillingTransaction.findOne({ providerReference: reference });
      expect(updatedTx?.status).toBe('SUCCESS');
      expect(updatedTx?.providerEventId).toBe(eventId);

      // 2nd processing with same eventId -> Must be detected as duplicate
      const secondResult = await BillingService.processPaystackWebhook(payload);
      expect(secondResult.processed).toBe(true);
      expect(secondResult.reason).toContain('Duplicate event (Idempotent)');
    });
  });
});
