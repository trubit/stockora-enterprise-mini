import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan.js';
import { Tenant } from '../models/Tenant.js';
import { Subscription } from '../models/Subscription.js';
import { Branch } from '../models/Branch.js';
import { SubscriptionService } from '../services/subscription.service.js';

describe('Subscription Full Lifecycle & Downgrade Conflict Integration Tests', () => {
  let tenantId: string;
  let starterPlan: any;
  let proPlan: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_sub_integration');
    }
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await Subscription.deleteMany({});
    await Branch.deleteMany({});

    starterPlan = await Plan.create({
      name: 'Starter Plan',
      slug: 'starter-int-test',
      tier: 'STARTER',
      price: 15000,
      currency: 'NGN',
      status: 'ACTIVE',
      features: { pos: true, inventory: true, crm: false },
      limits: { branches: { count: 1, unlimited: false } },
    });

    proPlan = await Plan.create({
      name: 'Professional Plan',
      slug: 'pro-int-test',
      tier: 'PROFESSIONAL',
      price: 45000,
      currency: 'NGN',
      status: 'ACTIVE',
      features: { pos: true, inventory: true, crm: true },
      limits: { branches: { count: 5, unlimited: false } },
    });

    const tenant = await Tenant.create({
      name: 'Full Lifecycle Tenant',
      slug: 'full-lifecycle-co',
      status: 'ACTIVE',
      contact: { email: 'admin@lifecycle.com' },
    });
    tenantId = tenant._id.toString();
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Tenant.deleteMany({});
    await Subscription.deleteMany({});
    await Branch.deleteMany({});
    await mongoose.connection.close();
  });

  it('should run complete upgrade and evaluate downgrade conflicts without destroying data', async () => {
    // 1. Initial subscription on Pro Plan
    await SubscriptionService.createSubscription({
      tenantId,
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // 2. Tenant creates 3 branches (allowed under Pro limit of 5)
    for (let i = 1; i <= 3; i++) {
      await Branch.create({
        tenantId,
        name: `Branch ${i}`,
        code: `BR-LIFE-${i}`,
        address: `${i} High Street`,
        phone: `080${i}`,
        email: `b${i}@life.com`,
      });
    }

    // 3. Evaluate downgrade to Starter Plan (which only allows 1 branch)
    const impact = await SubscriptionService.evaluateDowngradeImpact(
      tenantId,
      starterPlan._id.toString()
    );
    expect(impact.hasConflicts).toBe(true);
    expect(impact.conflicts.length).toBe(1);
    expect(impact.conflicts[0].resource).toBe('branches');
    expect(impact.conflicts[0].used).toBe(3);
    expect(impact.conflicts[0].newLimit).toBe(1);

    // 4. Perform downgrade -> Existing 3 branches are preserved in DB
    const changeResult = await SubscriptionService.changePlan({
      tenantId,
      newPlanId: starterPlan._id.toString(),
      force: true,
    });

    expect(changeResult.changeType).toBe('DOWNGRADE');
    const branchesCount = await Branch.countDocuments({ tenantId });
    expect(branchesCount).toBe(3); // Preserved!
  });
});
