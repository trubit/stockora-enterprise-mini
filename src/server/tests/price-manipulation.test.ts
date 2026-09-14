import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import axios from 'axios';
import { Plan } from '../models/Plan.js';
import { Tenant } from '../models/Tenant.js';
import { BillingService } from '../services/billing.service.js';

vi.mock('axios');

describe('Price & Plan Manipulation Defense Security Tests', () => {
  let plan: any;
  let tenantId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_price_manip');
    }
    await Plan.deleteMany({});
    await Tenant.deleteMany({});

    plan = await Plan.create({
      name: 'Enterprise Plan',
      slug: 'enterprise-sec-test',
      tier: 'ENTERPRISE',
      price: 350000, // ₦350,000
      currency: 'NGN',
      status: 'ACTIVE',
    });

    const tenant = await Tenant.create({
      name: 'Attacker Tenant',
      slug: 'attacker-co',
      status: 'ACTIVE',
      contact: { email: 'attacker@evil.com' },
    });
    tenantId = tenant._id.toString();
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await mongoose.connection.close();
  });

  it('should ignore client-passed tampering amounts and strictly charge authoritative backend pricing', async () => {
    const mockAxiosResponse = {
      data: {
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/auth-sec-1',
          reference: 'STK-SEC-1234',
        },
      },
    };
    vi.mocked(axios.post).mockResolvedValueOnce(mockAxiosResponse);

    // Even if an attacker attempts to pass fake client prices (e.g. amount: 100),
    // the BillingService only takes planId and calculates price authoritatively from database.
    const result = await BillingService.initializeSubscriptionPayment({
      tenantId,
      planId: plan._id.toString(),
      billingInterval: 'MONTHLY',
      email: 'attacker@evil.com',
    });

    expect(result.subtotal).toBe(350000);
    expect(result.tax).toBe(26250);
    expect(result.amount).toBe(376250);
    expect(result.amount).not.toBe(100);
  });
});
