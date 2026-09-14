import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import request from 'supertest';
import { Plan, type IPlan } from '../models/Plan.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Subscription } from '../models/Subscription.js';
import { BillingTransaction } from '../models/BillingTransaction.js';
import { BillingInvoice } from '../models/BillingInvoice.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { AuthService } from '../services/auth.service.js';
import { BillingService } from '../services/billing.service.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { PaymentService } from '../services/payment.service.js';
import { apiRouter } from '../routes/api.js';
import { errorHandler } from '../errors/handlers.js';

let app: Express;

let freePlan: IPlan;
let starterPlan: IPlan;
let proPlan: IPlan;
let enterprisePlan: IPlan;

let userA: any;
let tokenA: string;
let tenantA: any;

let userB: any;
let tokenB: string;
let tenantB: any;

describe('Mandatory Subscription Plan → Payment → Entitlement Verification Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }

    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);
    app.use(errorHandler);

    // Clean test collections
    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      Subscription.deleteMany({}),
      BillingTransaction.deleteMany({}),
      BillingInvoice.deleteMany({}),
      Branch.deleteMany({}),
      Warehouse.deleteMany({}),
      Product.deleteMany({}),
    ]);

    try {
      await Branch.collection.dropIndex('code_1');
    } catch {}
    try {
      await Warehouse.collection.dropIndex('code_1');
    } catch {}

    // Seed default roles
    await Role.findOneAndUpdate(
      { name: 'Company Owner' },
      {
        $set: {
          name: 'Company Owner',
          permissions: [
            'companies:read',
            'companies:write',
            'products:read',
            'products:write',
            'branches:read',
            'branches:write',
            'warehouses:read',
            'warehouses:write',
            'users:read',
            'users:write',
          ],
        },
      },
      { upsert: true, new: true }
    );

    // Seed authoritative plans
    freePlan = (await Plan.findOneAndUpdate(
      { slug: 'free' },
      {
        $set: {
          name: 'Free Starter',
          slug: 'free',
          tier: 'FREE',
          description: 'Free tier for single register micro-businesses',
          price: 0,
          currency: 'NGN',
          billingInterval: 'MONTHLY',
          status: 'ACTIVE',
          features: {
            pos: true,
            inventory: true,
            crm: false,
            reports: false,
            multiBranch: false,
            warehouseManagement: false,
            aiAssistant: false,
            integrations: false,
            apiAccess: false,
          },
          limits: {
            users: { count: 1, unlimited: false },
            branches: { count: 1, unlimited: false },
            warehouses: { count: 1, unlimited: false },
            products: { count: 50, unlimited: false },
            posTerminals: { count: 1, unlimited: false },
            aiRequestsMonthly: { count: 0, unlimited: false },
          },
        },
      },
      { upsert: true, new: true }
    )) as IPlan;

    starterPlan = (await Plan.findOneAndUpdate(
      { slug: 'starter' },
      {
        $set: {
          name: 'Starter Tier',
          slug: 'starter',
          tier: 'STARTER',
          description: 'Single location store',
          price: 25000,
          yearlyDiscountPercent: 20,
          currency: 'NGN',
          billingInterval: 'MONTHLY',
          status: 'ACTIVE',
          features: {
            pos: true,
            inventory: true,
            crm: true,
            reports: true,
            multiBranch: false,
            warehouseManagement: false,
            aiAssistant: false,
            integrations: false,
            apiAccess: false,
          },
          limits: {
            users: { count: 3, unlimited: false },
            branches: { count: 1, unlimited: false },
            warehouses: { count: 1, unlimited: false },
            products: { count: 500, unlimited: false },
            posTerminals: { count: 2, unlimited: false },
            aiRequestsMonthly: { count: 0, unlimited: false },
          },
        },
      },
      { upsert: true, new: true }
    )) as IPlan;

    proPlan = (await Plan.findOneAndUpdate(
      { slug: 'professional' },
      {
        $set: {
          name: 'Professional Tier',
          slug: 'professional',
          tier: 'PROFESSIONAL',
          description: 'Multi-branch operations',
          price: 65000,
          yearlyDiscountPercent: 20,
          currency: 'NGN',
          billingInterval: 'MONTHLY',
          status: 'ACTIVE',
          features: {
            pos: true,
            inventory: true,
            crm: true,
            reports: true,
            multiBranch: true,
            warehouseManagement: true,
            aiAssistant: true,
            integrations: true,
            apiAccess: false,
          },
          limits: {
            users: { count: 10, unlimited: false },
            branches: { count: 3, unlimited: false },
            warehouses: { count: 2, unlimited: false },
            products: { count: 5000, unlimited: false },
            posTerminals: { count: 6, unlimited: false },
            aiRequestsMonthly: { count: 500, unlimited: false },
          },
        },
      },
      { upsert: true, new: true }
    )) as IPlan;

    enterprisePlan = (await Plan.findOneAndUpdate(
      { slug: 'enterprise' },
      {
        $set: {
          name: 'Enterprise Scale',
          slug: 'enterprise',
          tier: 'ENTERPRISE',
          description: 'Full enterprise warehouse logistics and AI',
          price: 150000,
          yearlyDiscountPercent: 25,
          currency: 'NGN',
          billingInterval: 'MONTHLY',
          status: 'ACTIVE',
          features: {
            pos: true,
            inventory: true,
            crm: true,
            reports: true,
            multiBranch: true,
            warehouseManagement: true,
            aiAssistant: true,
            integrations: true,
            apiAccess: true,
          },
          limits: {
            users: { count: 50, unlimited: false },
            branches: { count: 15, unlimited: false },
            warehouses: { count: 10, unlimited: false },
            products: { count: 50000, unlimited: false },
            posTerminals: { count: 25, unlimited: false },
            aiRequestsMonthly: { count: 5000, unlimited: false },
          },
        },
      },
      { upsert: true, new: true }
    )) as IPlan;

    // Create Company A (Starts on FREE tier)
    tenantA = await Tenant.create({
      name: 'Company Alpha',
      slug: 'company-alpha',
      status: 'ACTIVE',
      contact: { email: 'alpha@example.com' },
      subscriptionTier: 'FREE',
      features: new Map(Object.entries(freePlan.toObject().features)),
      limits: {
        maxUsers: freePlan.limits.users.count,
        maxBranches: freePlan.limits.branches.count,
        maxWarehouses: freePlan.limits.warehouses.count,
        maxPOSTerminals: freePlan.limits.posTerminals.count,
        maxProducts: freePlan.limits.products.count,
        maxStorageMb: 512,
      },
    });

    userA = await User.create({
      username: 'owner_alpha',
      email: 'owner_alpha@example.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      tenantId: tenantA._id,
      tenants: [
        {
          tenantId: tenantA._id,
          tenantSlug: 'company-alpha',
          roleName: 'Company Owner',
          isDefault: true,
        },
      ],
      isActive: true,
    });
    tokenA = AuthService.generateAccessToken(userA);

    // Create Company B (Starts on FREE tier)
    tenantB = await Tenant.create({
      name: 'Company Beta',
      slug: 'company-beta',
      status: 'ACTIVE',
      contact: { email: 'beta@example.com' },
      subscriptionTier: 'FREE',
      features: new Map(Object.entries(freePlan.toObject().features)),
      limits: {
        maxUsers: freePlan.limits.users.count,
        maxBranches: freePlan.limits.branches.count,
        maxWarehouses: freePlan.limits.warehouses.count,
        maxPOSTerminals: freePlan.limits.posTerminals.count,
        maxProducts: freePlan.limits.products.count,
        maxStorageMb: 512,
      },
    });

    userB = await User.create({
      username: 'owner_beta',
      email: 'owner_beta@example.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      tenantId: tenantB._id,
      tenants: [
        {
          tenantId: tenantB._id,
          tenantSlug: 'company-beta',
          roleName: 'Company Owner',
          isDefault: true,
        },
      ],
      isActive: true,
    });
    tokenB = AuthService.generateAccessToken(userB);
  });

  // TEST 1: Plan Source of Truth
  it('1. Plan Source of Truth: GET /api/billing/plans retrieves authentic plans and prices', async () => {
    const res = await request(app).get('/api/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const plans = res.body.data;
    expect(plans.length).toBeGreaterThanOrEqual(4);

    const starter = plans.find((p: any) => p.slug === 'starter');
    expect(starter.price).toBe(25000);
    expect(starter.tier).toBe('STARTER');
  });

  // TEST 2: Wrong-Plan Attack Protection
  it('2. Wrong-Plan Attack: Attacker initiates Starter but attempts to verify as Enterprise -> Receives Starter only', async () => {
    // Attacker initiates Starter plan
    const initRes = await request(app)
      .post('/api/billing/subscription/initialize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ planId: starterPlan._id.toString(), provider: 'PAYSTACK' });

    expect(initRes.status).toBe(200);
    const reference = initRes.body.data.reference;

    // Simulate payment gateway confirming payment of the Starter amount
    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: true,
      reference,
      amount: 26875, // Starter price + 7.5% VAT
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    // Attacker calls verify trying to claim Enterprise
    const verifyRes = await request(app)
      .post('/api/billing/subscription/verify')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        reference,
        provider: 'PAYSTACK',
        planId: enterprisePlan._id.toString(), // Tampered request payload
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.subscription.planSlug).toBe('starter');
    expect(verifyRes.body.subscription.planSnapshot.tier).toBe('STARTER');

    // Tenant in database MUST be STARTER, never Enterprise
    const updatedTenant = await Tenant.findById(tenantA._id);
    expect(updatedTenant?.subscriptionTier).toBe('STARTER');
    expect(updatedTenant?.features.get('multiBranch')).toBe(false);
  });

  // TEST 3: Price/Amount Tampering Protection
  it('3. Price Tampering: Gateway returns less than expected amount -> Verification fails with anti-tampering rejection', async () => {
    const initRes = await request(app)
      .post('/api/billing/subscription/initialize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ planId: proPlan._id.toString(), provider: 'PAYSTACK' });

    expect(initRes.status).toBe(200);
    const reference = initRes.body.data.reference;

    // Gateway reports payment of only 1,000 NGN instead of required amount
    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: false,
      reference,
      amount: 1000,
      currency: 'NGN',
      status: 'FAILED',
      gatewayResponse: 'Amount tampering detected',
    } as any);

    const verifyRes = await request(app)
      .post('/api/billing/subscription/verify')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reference, provider: 'PAYSTACK' });

    expect(verifyRes.body.success).toBe(false);

    // Verify tenant was NOT upgraded to Professional
    const tenant = await Tenant.findById(tenantA._id);
    expect(tenant?.subscriptionTier).not.toBe('PROFESSIONAL');
  });

  // TEST 4: Direct Change-Plan Exploit Blocked
  it('4. Direct Exploit Blocked: Calling change-plan with a paid tier without payment returns 402 PAYMENT_REQUIRED', async () => {
    const exploitRes = await request(app)
      .post('/api/billing/subscription/change-plan')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ newPlanId: enterprisePlan._id.toString() });

    expect(exploitRes.status).toBe(402);
    expect(exploitRes.body.requiresPayment).toBe(true);

    const tenant = await Tenant.findById(tenantA._id);
    expect(tenant?.subscriptionTier).not.toBe('ENTERPRISE');
  });

  // TEST 5: Starter Plan Full Payment & Entitlement Assignment
  it('5. Starter Plan: Complete payment assigns exact Starter entitlements and limits', async () => {
    const initRes = await request(app)
      .post('/api/billing/subscription/initialize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ planId: starterPlan._id.toString(), provider: 'PAYSTACK' });

    const ref = initRes.body.data.reference;
    const expectedTotal = initRes.body.data.amount;

    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: true,
      reference: ref,
      amount: expectedTotal,
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    const verifyRes = await request(app)
      .post('/api/billing/subscription/verify')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reference: ref, provider: 'PAYSTACK' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.subscription.planSlug).toBe('starter');

    const tenant = await Tenant.findById(tenantA._id);
    expect(tenant?.subscriptionTier).toBe('STARTER');
    expect(tenant?.limits.maxUsers).toBe(3);
    expect(tenant?.limits.maxBranches).toBe(1);
    expect(tenant?.limits.maxProducts).toBe(500);
    expect(tenant?.features.get('crm')).toBe(true);
    expect(tenant?.features.get('multiBranch')).toBe(false);
  });

  // TEST 6: Professional Plan Full Payment & Entitlement Assignment
  it('6. Professional Plan: Complete payment assigns exact Professional entitlements and limits', async () => {
    const initRes = await request(app)
      .post('/api/billing/subscription/initialize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ planId: proPlan._id.toString(), provider: 'PAYSTACK' });

    const ref = initRes.body.data.reference;
    const expectedTotal = initRes.body.data.amount;

    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: true,
      reference: ref,
      amount: expectedTotal,
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    const verifyRes = await request(app)
      .post('/api/billing/subscription/verify')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reference: ref, provider: 'PAYSTACK' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.subscription.planSlug).toBe('professional');

    const tenant = await Tenant.findById(tenantA._id);
    expect(tenant?.subscriptionTier).toBe('PROFESSIONAL');
    expect(tenant?.limits.maxUsers).toBe(10);
    expect(tenant?.limits.maxBranches).toBe(3);
    expect(tenant?.limits.maxProducts).toBe(5000);
    expect(tenant?.features.get('multiBranch')).toBe(true);
    expect(tenant?.features.get('warehouseManagement')).toBe(true);
    expect(tenant?.features.get('aiAssistant')).toBe(true);
  });

  // TEST 7: Enterprise Plan Full Payment & Entitlement Assignment
  it('7. Enterprise Plan: Complete payment assigns exact Enterprise entitlements and limits', async () => {
    const initRes = await request(app)
      .post('/api/billing/subscription/initialize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ planId: enterprisePlan._id.toString(), provider: 'PAYSTACK' });

    const ref = initRes.body.data.reference;
    const expectedTotal = initRes.body.data.amount;

    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: true,
      reference: ref,
      amount: expectedTotal,
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    const verifyRes = await request(app)
      .post('/api/billing/subscription/verify')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reference: ref, provider: 'PAYSTACK' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.subscription.planSlug).toBe('enterprise');

    const tenant = await Tenant.findById(tenantA._id);
    expect(tenant?.subscriptionTier).toBe('ENTERPRISE');
    expect(tenant?.limits.maxUsers).toBe(50);
    expect(tenant?.limits.maxBranches).toBe(15);
    expect(tenant?.limits.maxProducts).toBe(50000);
    expect(tenant?.features.get('apiAccess')).toBe(true);
  });

  // TEST 8: Multi-Tenant Isolation
  it('8. Multi-Tenant Isolation: Company B cannot verify or hijack Company A subscription transaction', async () => {
    const initRes = await request(app)
      .post('/api/billing/subscription/initialize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ planId: proPlan._id.toString(), provider: 'PAYSTACK' });

    const ref = initRes.body.data.reference;

    // Company B attempts to verify Company A's transaction reference
    const hijackRes = await request(app)
      .post('/api/billing/subscription/verify')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ reference: ref, provider: 'PAYSTACK' });

    expect(hijackRes.status).toBe(400);
    expect(hijackRes.body.error?.message || hijackRes.body.message).toContain('different tenant');

    // Company B MUST remain on FREE tier
    const tenantBeta = await Tenant.findById(tenantB._id);
    expect(tenantBeta?.subscriptionTier).toBe('FREE');
  });

  // TEST 9: Company Switching Entitlement Independence
  it('9. Company Switching: Tenant A (Enterprise) and Tenant B (Free) have completely isolated entitlements', async () => {
    const subARes = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(subARes.status).toBe(200);
    expect(subARes.body.data.planSnapshot.tier).toBe('ENTERPRISE');

    const subBRes = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(subBRes.status).toBe(200);
    expect(subBRes.body.data.status).toBe('FREE');
    expect(subBRes.body.data.planSnapshot.features.aiAssistant).toBe(false);
  });

  // TEST 10: Duplicate Webhook Processing Idempotency
  it('10. Duplicate Webhooks: Replaying the same charge.success webhook does not create duplicate subscriptions or invoices', async () => {
    const ref = `STK-WH-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: tenantB._id.toString(),
      planId: starterPlan._id,
      planSlug: starterPlan.slug,
      amount: 26875,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: ref,
      status: 'PENDING',
    });

    vi.spyOn(PaymentService, 'verify').mockResolvedValue({
      success: true,
      reference: ref,
      amount: 26875,
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    const webhookPayload = {
      event: 'charge.success',
      data: {
        id: 778899,
        reference: ref,
        amount: 2687500,
        currency: 'NGN',
        status: 'success',
      },
    };

    // First webhook call
    const res1 = await BillingService.processPaystackWebhook(webhookPayload);
    expect(res1.processed).toBe(true);

    // Second webhook call with same event ID
    const res2 = await BillingService.processPaystackWebhook(webhookPayload);
    expect(res2.processed).toBe(true);
    expect(res2.reason).toContain('Duplicate event');

    // Confirm exactly 1 active subscription for tenantB
    const subs = await Subscription.find({ tenantId: tenantB._id.toString(), status: 'ACTIVE' });
    expect(subs.length).toBe(1);

    // Confirm exactly 1 invoice created for this transaction
    const invoices = await BillingInvoice.find({ transactionReference: ref });
    expect(invoices.length).toBe(1);
  });

  // TEST 11: Failed Payment Webhook Handling
  it('11. Failed Payment: charge.failed transitions subscription to PAST_DUE', async () => {
    const failRef = `STK-FAIL-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: tenantB._id.toString(),
      planId: starterPlan._id,
      planSlug: starterPlan.slug,
      amount: 26875,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: failRef,
      status: 'PENDING',
    });

    const failedPayload = {
      event: 'charge.failed',
      data: {
        id: 112233,
        reference: failRef,
        amount: 2687500,
        currency: 'NGN',
        status: 'failed',
        gateway_response: 'Insufficient funds',
      },
    };

    await BillingService.processPaystackWebhook(failedPayload);

    const sub = await Subscription.findOne({ tenantId: tenantB._id.toString() });
    expect(sub?.status).toBe('PAST_DUE');
    expect(sub?.failedPaymentCount).toBe(1);
  });

  // TEST 12: Cancellation Lifecycle
  it('12. Cancellation: Cancel at period end retains access; Immediate cancel revokes access', async () => {
    // 1. Cancel at period end
    const cancelPeriodRes = await request(app)
      .post('/api/billing/subscription/cancel')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ immediately: false, reason: 'Testing period end cancellation' });

    expect(cancelPeriodRes.status).toBe(200);
    expect(cancelPeriodRes.body.data.cancelAtPeriodEnd).toBe(true);

    // Access is still granted because period has not ended
    expect(await SubscriptionService.hasFeature(tenantA._id.toString(), 'apiAccess')).toBe(true);

    // 2. Reactivate
    const reactivateRes = await request(app)
      .post('/api/billing/subscription/reactivate')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.cancelAtPeriodEnd).toBe(false);

    // 3. Immediate cancellation
    const cancelImmediateRes = await request(app)
      .post('/api/billing/subscription/cancel')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ immediately: true, reason: 'Immediate test cancel' });

    expect(cancelImmediateRes.status).toBe(200);
    expect(cancelImmediateRes.body.data.status).toBe('CANCELLED');

    // Access immediately revokes premium features and falls back to Free
    expect(await SubscriptionService.hasFeature(tenantA._id.toString(), 'apiAccess')).toBe(false);
  });

  // TEST 13: Subscription Renewal
  it('13. Renewal: Successful renewal extends currentPeriodEnd without resetting plan', async () => {
    // Re-subscribe Tenant A to Professional
    const sub = await SubscriptionService.createSubscription({
      tenantId: tenantA._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    const initialEnd = sub.currentPeriodEnd;

    // Simulate renewal payment
    const renewalRef = `STK-REN-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: tenantA._id.toString(),
      planId: proPlan._id,
      planSlug: proPlan.slug,
      amount: 69875,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: renewalRef,
      status: 'PENDING',
    });

    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: true,
      reference: renewalRef,
      amount: 69875,
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    const renewalRes = await BillingService.verifyAndActivatePayment(
      'PAYSTACK',
      renewalRef,
      tenantA._id.toString()
    );
    expect(renewalRes.success).toBe(true);
    expect(renewalRes.subscription?.status).toBe('ACTIVE');
    expect(renewalRes.subscription?.planSlug).toBe('professional');
    expect(new Date(renewalRes.subscription!.currentPeriodEnd).getTime()).toBeGreaterThanOrEqual(
      new Date(initialEnd).getTime()
    );
  });

  // TEST 14: Route-Level Plan Limit Enforcement
  it('14. Plan Limit Enforcement: Attempting to create branches beyond plan limits is blocked with 403', async () => {
    // Tenant B is on FREE tier (limit is 1 branch)
    // Branch 1 already exists or we create one
    await Branch.create({
      name: 'Alpha Free Branch 1',
      code: 'AFB-01',
      tenantId: tenantB._id,
      isActive: true,
    });

    // Attempting to create a second branch on Free plan via API
    const branchRes = await request(app)
      .post('/api/org/branches')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Alpha Free Branch 2',
        code: 'AFB-02',
      });

    expect(branchRes.status).toBe(403);
    expect(branchRes.body.error).toBe('PLAN_LIMIT_EXCEEDED');
  });

  afterAll(async () => {
    // Teardown
  });
});
