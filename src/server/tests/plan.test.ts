import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Plan } from '../models/Plan.js';

describe('Plan Catalog & Model Unit Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_plans');
    }
    await Plan.deleteMany({});
    await Plan.syncIndexes();
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await mongoose.connection.close();
  });

  it('should successfully create a configurable SaaS plan with explicit unlimited limits', async () => {
    const plan = await Plan.create({
      name: 'Enterprise Test Tier',
      slug: 'enterprise-test',
      tier: 'ENTERPRISE',
      description: 'Full unlimited power for mega-retailers',
      price: 350000,
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
        advancedAnalytics: true,
        multiBranch: true,
        warehouseManagement: true,
        employeeManagement: true,
        reports: true,
        apiAccess: true,
        integrations: true,
        automation: true,
        customBranding: true,
        prioritySupport: true,
      },
      limits: {
        users: { count: 0, unlimited: true },
        branches: { count: 0, unlimited: true },
        warehouses: { count: 0, unlimited: true },
        posTerminals: { count: 0, unlimited: true },
        products: { count: 0, unlimited: true },
        customers: { count: 0, unlimited: true },
        orders: { count: 0, unlimited: true },
        storageMb: { count: 0, unlimited: true },
        apiRequestsMonthly: { count: 0, unlimited: true },
        aiRequestsMonthly: { count: 0, unlimited: true },
        automations: { count: 0, unlimited: true },
      },
      trialConfiguration: {
        trialDays: 30,
        isTrialEnabled: true,
      },
      version: 1,
    });

    expect(plan._id).toBeDefined();
    expect(plan.slug).toBe('enterprise-test');
    expect(plan.limits.users.unlimited).toBe(true);
    expect(plan.limits.products.unlimited).toBe(true);
    expect(plan.features.aiAssistant).toBe(true);
    expect(plan.version).toBe(1);
  });

  it('should enforce unique slugs for plans', async () => {
    let duplicateError = false;
    try {
      await Plan.create({
        name: 'Enterprise Test Duplicate',
        slug: 'enterprise-test',
        tier: 'ENTERPRISE',
        price: 500000,
        currency: 'NGN',
      });
    } catch {
      duplicateError = true;
    }
    expect(duplicateError).toBe(true);
  });
});
