import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan.js';
import { Tenant } from '../models/Tenant.js';
import { Subscription } from '../models/Subscription.js';
import { POSTerminal } from '../models/POSTerminal.js';
import { UsageMeteringService } from '../services/usageMetering.service.js';
import { SubscriptionService } from '../services/subscription.service.js';

describe('Limit Concurrency & Bypass Defense Security Tests', () => {
  let tenantId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_limit_bypass');
    }
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await Subscription.deleteMany({});
    await POSTerminal.deleteMany({});

    const plan = await Plan.create({
      name: 'Starter Strict',
      slug: 'starter-strict',
      tier: 'STARTER',
      price: 15000,
      currency: 'NGN',
      limits: {
        posTerminals: { count: 3, unlimited: false },
      },
    });

    const tenant = await Tenant.create({
      name: 'Limit Strict Tenant',
      slug: 'limit-strict-co',
      status: 'ACTIVE',
      contact: { email: 'admin@limitstrict.com' },
    });
    tenantId = tenant._id.toString();

    await SubscriptionService.createSubscription({
      tenantId,
      planId: plan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Populate 3 terminals to reach the limit
    for (let i = 1; i <= 3; i++) {
      await POSTerminal.create({
        tenantId,
        branchId: new mongoose.Types.ObjectId(),
        name: `Terminal ${i}`,
        terminalCode: `POS-LIMIT-${i}`,
        ipAddress: `192.168.1.${i}`,
        macAddress: `00:1B:44:11:3A:0${i}`,
      });
    }
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await Subscription.deleteMany({});
    await POSTerminal.deleteMany({});
    await mongoose.connection.close();
  });

  it('should strictly reject creation of resource #4 when limit is 3', async () => {
    const check = await UsageMeteringService.checkLimit(tenantId, 'posTerminals', 1);
    expect(check.allowed).toBe(false);
    expect(check.current).toBe(3);
    expect(check.limit).toBe(3);
    expect(check.message).toContain('Plan limit exceeded');
  });

  it('should reject bulk requests that exceed remaining quota', async () => {
    // Attempting to add 2 more at once
    const bulkCheck = await UsageMeteringService.checkLimit(tenantId, 'posTerminals', 2);
    expect(bulkCheck.allowed).toBe(false);
  });
});
