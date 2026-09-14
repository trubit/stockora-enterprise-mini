import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { Tenant } from '../models/Tenant.js';
import { SubscriptionService } from '../services/subscription.service.js';

describe('Subscription Lifecycle & Plan Change Unit Tests', () => {
  let tenantId: string;
  let starterPlan: any;
  let proPlan: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_sub');
    }
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await Tenant.deleteMany({});

    starterPlan = await Plan.create({
      name: 'Starter Plan',
      slug: 'starter-sub-test',
      tier: 'STARTER',
      price: 15000,
      yearlyDiscountPercent: 20,
      currency: 'NGN',
      status: 'ACTIVE',
      features: {
        pos: true,
        inventory: true,
        advancedInventory: false,
        crm: false,
        loyalty: false,
        aiAssistant: false,
      },
      limits: {
        users: { count: 5, unlimited: false },
        branches: { count: 1, unlimited: false },
      },
      trialConfiguration: { trialDays: 14, isTrialEnabled: true },
    });

    proPlan = await Plan.create({
      name: 'Professional Plan',
      slug: 'pro-sub-test',
      tier: 'PROFESSIONAL',
      price: 45000,
      yearlyDiscountPercent: 20,
      currency: 'NGN',
      status: 'ACTIVE',
      features: {
        pos: true,
        inventory: true,
        advancedInventory: true,
        crm: true,
        loyalty: true,
        aiAssistant: true,
      },
      limits: {
        users: { count: 20, unlimited: false },
        branches: { count: 5, unlimited: false },
      },
      trialConfiguration: { trialDays: 14, isTrialEnabled: true },
    });

    const tenant = await Tenant.create({
      name: 'Sub Test Tenant',
      slug: 'sub-test-co',
      status: 'ACTIVE',
      contact: { email: 'test@subco.com' },
    });
    tenantId = tenant._id.toString();
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await Tenant.deleteMany({});
    await mongoose.connection.close();
  });

  it('should initialize a trialing subscription with immutable plan snapshot', async () => {
    const sub = await SubscriptionService.createSubscription({
      tenantId,
      planId: starterPlan._id.toString(),
      billingInterval: 'MONTHLY',
      isTrial: true,
    });

    expect(sub._id).toBeDefined();
    expect(sub.status).toBe('TRIALING');
    expect(sub.planSlug).toBe('starter-sub-test');
    expect(sub.planSnapshot.features.pos).toBe(true);
    expect(sub.planSnapshot.features.crm).toBe(false);
  });

  it('should upgrade plan instantly and update snapshot and feature access', async () => {
    const upgradeResult = await SubscriptionService.changePlan({
      tenantId,
      newPlanId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    expect(upgradeResult.changeType).toBe('UPGRADE');
    expect(upgradeResult.subscription.planSlug).toBe('pro-sub-test');
    expect(upgradeResult.subscription.price).toBe(45000);

    const hasAI = await SubscriptionService.hasFeature(tenantId, 'aiAssistant');
    expect(hasAI).toBe(true);
  });

  it('should handle cancellation at period end and subsequent reactivation', async () => {
    // 1. Cancel at period end
    const cancelled = await SubscriptionService.cancelSubscription(
      tenantId,
      false,
      'Testing cancellation'
    );
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(cancelled.cancellationReason).toBe('Testing cancellation');

    // 2. Reactivate
    const reactivated = await SubscriptionService.reactivateSubscription(tenantId);
    expect(reactivated.cancelAtPeriodEnd).toBe(false);
    expect(reactivated.cancellationReason).toBeUndefined();
  });
});
