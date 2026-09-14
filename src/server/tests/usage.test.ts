import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { Tenant } from '../models/Tenant.js';
import { Product } from '../models/Product.js';
import { Branch } from '../models/Branch.js';
import { UsageMeteringService } from '../services/usageMetering.service.js';
import { SubscriptionService } from '../services/subscription.service.js';

describe('Usage Metering & Server Limits Unit Tests', () => {
  let tenantId: string;
  let starterPlan: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_usage');
    }
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await Tenant.deleteMany({});
    await Product.deleteMany({});
    await Branch.deleteMany({});

    // Create Starter Plan with 2 branches limit
    starterPlan = await Plan.create({
      name: 'Starter Tier',
      slug: 'starter-usage-test',
      tier: 'STARTER',
      price: 15000,
      currency: 'NGN',
      status: 'ACTIVE',
      limits: {
        users: { count: 5, unlimited: false },
        branches: { count: 2, unlimited: false },
        warehouses: { count: 1, unlimited: false },
        posTerminals: { count: 2, unlimited: false },
        products: { count: 10, unlimited: false },
        customers: { count: 100, unlimited: false },
        orders: { count: 100, unlimited: false },
        storageMb: { count: 512, unlimited: false },
        apiRequestsMonthly: { count: 1000, unlimited: false },
        aiRequestsMonthly: { count: 50, unlimited: false },
        automations: { count: 2, unlimited: false },
      },
    });

    const tenant = await Tenant.create({
      name: 'Usage Test Tenant',
      slug: 'usage-test-co',
      status: 'ACTIVE',
      contact: { email: 'admin@usagetest.com' },
      subscriptionTier: 'STARTER',
    });
    tenantId = tenant._id.toString();

    // Create subscription
    await SubscriptionService.createSubscription({
      tenantId,
      planId: starterPlan._id.toString(),
      billingInterval: 'MONTHLY',
      isTrial: false,
    });
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await Tenant.deleteMany({});
    await Product.deleteMany({});
    await Branch.deleteMany({});
    await mongoose.connection.close();
  });

  it('should accurately reconcile tenant resource counts from database collections', async () => {
    // Add 1 branch and 3 products
    await Branch.create({
      tenantId,
      name: 'Branch Alpha',
      code: 'BR-A1',
      address: '123 Test St',
      phone: '123',
      email: 'a@test.com',
    });

    await Product.create({
      tenantId,
      name: 'Product 1',
      sku: 'SKU-U-1',
      price: 100,
      cost: 50,
      quantity: 10,
    });

    await Product.create({
      tenantId,
      name: 'Product 2',
      sku: 'SKU-U-2',
      price: 200,
      cost: 100,
      quantity: 20,
    });

    const metrics = await UsageMeteringService.reconcileTenantUsage(tenantId);
    expect(metrics.branches).toBe(1);
    expect(metrics.products).toBe(2);
  });

  it('should allow resource creation when below plan limit', async () => {
    const check = await UsageMeteringService.checkLimit(tenantId, 'branches', 1);
    expect(check.allowed).toBe(true);
    expect(check.current).toBe(1);
    expect(check.limit).toBe(2);
  });

  it('should block resource creation and calculate warning level when exceeding plan limit', async () => {
    // Add second branch to hit the limit of 2
    await Branch.create({
      tenantId,
      name: 'Branch Beta',
      code: 'BR-B1',
      address: '456 Test St',
      phone: '456',
      email: 'b@test.com',
    });

    // Now current = 2. Attempting to add 1 more should be blocked.
    const check = await UsageMeteringService.checkLimit(tenantId, 'branches', 1);
    expect(check.allowed).toBe(false);
    expect(check.current).toBe(2);
    expect(check.limit).toBe(2);
    expect(check.message).toContain('Plan limit exceeded');

    // Usage summary should show warning level
    const summary = await UsageMeteringService.getTenantUsageSummary(tenantId);
    expect(summary.branches.percentage).toBe(100);
    expect(summary.branches.warningLevel).toBe('EXCEEDED_100');
    expect(summary.branches.isExceeded).toBe(true);
  });
});
