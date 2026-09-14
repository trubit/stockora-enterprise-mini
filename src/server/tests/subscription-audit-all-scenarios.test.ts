import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant.js';
import { Plan, type IPlan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { BillingTransaction } from '../models/BillingTransaction.js';
import { BillingInvoice } from '../models/BillingInvoice.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { BillingService } from '../services/billing.service.js';
import { UsageMeteringService } from '../services/usageMetering.service.js';
import { PaymentService } from '../services/payment.service.js';

describe('Production Subscription System & Entitlement Enforcement Audit (20 Scenarios)', () => {
  let freePlan: IPlan;
  let starterPlan: IPlan;
  let proPlan: IPlan;
  let entPlan: IPlan;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_audit_suite');
    }

    // Clean test database
    await Tenant.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await BillingTransaction.deleteMany({});
    await BillingInvoice.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});

    // Seed Authoritative Plans
    freePlan = await Plan.create({
      name: 'Free Starter',
      slug: 'free',
      tier: 'FREE',
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
        prioritySupport: false,
        advancedAnalytics: false,
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
    });

    starterPlan = await Plan.create({
      name: 'Starter Tier',
      slug: 'starter',
      tier: 'STARTER',
      price: 25000,
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
        prioritySupport: false,
        advancedAnalytics: false,
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
    });

    proPlan = await Plan.create({
      name: 'Professional Tier',
      slug: 'professional',
      tier: 'PROFESSIONAL',
      price: 65000,
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
        aiAssistant: false,
        integrations: true,
        prioritySupport: false,
        advancedAnalytics: true,
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
    });

    entPlan = await Plan.create({
      name: 'Enterprise Scale',
      slug: 'enterprise',
      tier: 'ENTERPRISE',
      price: 150000,
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
        prioritySupport: true,
        advancedAnalytics: true,
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
    });
  });

  afterAll(async () => {
    await Tenant.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await BillingTransaction.deleteMany({});
    await BillingInvoice.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await mongoose.connection.close();
  });

  // TEST 1: New company -> receives ONLY baseline Free tier entitlements
  it('TEST 1: New company without subscription receives ONLY Free tier entitlements and baseline limits', async () => {
    const tenant = await Tenant.create({
      name: 'New Company Co',
      slug: 'new-co-1',
      contact: { email: 'owner@newco1.com' },
    });

    expect(tenant.subscriptionTier).toBe('FREE');
    expect(tenant.features.get('pos')).toBe(true);
    expect(tenant.features.get('aiAssistant')).toBe(false);
    expect(tenant.features.get('multiBranch')).toBe(false);
    expect(tenant.features.get('warehousing')).toBe(false);

    // Backend feature checks must fail closed
    const hasAI = await SubscriptionService.hasFeature(tenant._id.toString(), 'aiAssistant');
    const hasBranch = await SubscriptionService.hasFeature(tenant._id.toString(), 'multiBranch');
    const hasPOS = await SubscriptionService.hasFeature(tenant._id.toString(), 'pos');

    expect(hasAI).toBe(false);
    expect(hasBranch).toBe(false);
    expect(hasPOS).toBe(true);

    const limits = await UsageMeteringService.getTenantLimits(tenant._id.toString());
    expect(limits.products.count).toBe(50);
    expect(limits.branches.count).toBe(1);
  });

  // TEST 2: Company purchases Starter -> receives ONLY Starter
  it('TEST 2: Company purchases Starter receives ONLY Starter features and limits', async () => {
    const tenant = await Tenant.create({
      name: 'Starter Retailer',
      slug: 'starter-ret',
      contact: { email: 'starter@retail.com' },
    });

    const sub = await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: starterPlan._id.toString(),
      billingInterval: 'MONTHLY',
      isTrial: false,
    });

    expect(sub.status).toBe('ACTIVE');
    expect(sub.planSlug).toBe('starter');

    const hasCRM = await SubscriptionService.hasFeature(tenant._id.toString(), 'crm');
    const hasWarehouses = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'warehouseManagement'
    );
    const hasAI = await SubscriptionService.hasFeature(tenant._id.toString(), 'aiAssistant');

    expect(hasCRM).toBe(true);
    expect(hasWarehouses).toBe(false); // Pro only
    expect(hasAI).toBe(false); // Enterprise only

    const limits = await UsageMeteringService.getTenantLimits(tenant._id.toString());
    expect(limits.products.count).toBe(500);
  });

  // TEST 3: Company purchases Professional -> receives ONLY Pro
  it('TEST 3: Company purchases Professional receives ONLY Professional features', async () => {
    const tenant = await Tenant.create({
      name: 'Pro Merchant',
      slug: 'pro-merch',
      contact: { email: 'pro@merch.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    const hasMultiBranch = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'multiBranch'
    );
    const hasWarehousing = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'warehouseManagement'
    );
    const hasAI = await SubscriptionService.hasFeature(tenant._id.toString(), 'aiAssistant');

    expect(hasMultiBranch).toBe(true);
    expect(hasWarehousing).toBe(true);
    expect(hasAI).toBe(false); // Enterprise only

    const limits = await UsageMeteringService.getTenantLimits(tenant._id.toString());
    expect(limits.products.count).toBe(5000);
  });

  // TEST 4: Company purchases Enterprise -> receives Enterprise features and limits
  it('TEST 4: Company purchases Enterprise receives Enterprise features', async () => {
    const tenant = await Tenant.create({
      name: 'Enterprise Corp',
      slug: 'ent-corp',
      contact: { email: 'ent@corp.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: entPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    const hasAI = await SubscriptionService.hasFeature(tenant._id.toString(), 'aiAssistant');
    const hasAPI = await SubscriptionService.hasFeature(tenant._id.toString(), 'apiAccess');

    expect(hasAI).toBe(true);
    expect(hasAPI).toBe(true);

    const limits = await UsageMeteringService.getTenantLimits(tenant._id.toString());
    expect(limits.products.count).toBe(50000);
  });

  // TEST 5: Basic/Free user attempts Pro-only API -> denied
  it('TEST 5: Free/Starter user attempts Pro-only feature -> denied', async () => {
    const tenant = await Tenant.create({
      name: 'Basic Only Co',
      slug: 'basic-only',
      contact: { email: 'basic@co.com' },
    });

    const isWarehousingAllowed = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'warehouseManagement'
    );
    expect(isWarehousingAllowed).toBe(false);
  });

  // TEST 6: User reaches usage limit -> operation denied
  it('TEST 6: Free user reaches product usage limit -> operation denied with error', async () => {
    const tenant = await Tenant.create({
      name: 'Limit Test Co',
      slug: 'limit-co',
      contact: { email: 'limit@co.com' },
    });

    // Seed 50 products for this tenant to hit limit
    const products = Array.from({ length: 50 }).map((_, i) => ({
      tenantId: tenant._id.toString(),
      name: `Product ${i}`,
      sku: `SKU-LMT-${i}`,
      price: 100,
    }));
    await Product.insertMany(products);

    // Attempting to add 1 more product must fail limit check
    const check = await UsageMeteringService.checkLimit(tenant._id.toString(), 'products', 1);
    expect(check.allowed).toBe(false);
    expect(check.current).toBe(50);
    expect(check.limit).toBe(50);
    expect(check.message).toContain('Plan limit exceeded');
  });

  // TEST 7: Pro user within limit -> operation succeeds
  it('TEST 7: Pro user within limit -> operation succeeds', async () => {
    const tenant = await Tenant.create({
      name: 'Pro Limit Co',
      slug: 'pro-limit-co',
      contact: { email: 'prolimit@co.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Pro limit is 5000 products, currently using 0
    const check = await UsageMeteringService.checkLimit(tenant._id.toString(), 'products', 1);
    expect(check.allowed).toBe(true);
    expect(check.limit).toBe(5000);
  });

  // TEST 8: Subscription expires -> premium access revoked / falls back to Free plan
  it('TEST 8: Subscription expires -> status changes to EXPIRED and premium features revoked', async () => {
    const tenant = await Tenant.create({
      name: 'Expiring Co',
      slug: 'exp-co',
      contact: { email: 'exp@co.com' },
    });

    const sub = await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Manually set currentPeriodEnd to yesterday
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    sub.currentPeriodEnd = pastDate;
    await sub.save();

    // Querying subscription should detect expiration
    const activeSub = await SubscriptionService.getTenantSubscription(tenant._id.toString());
    expect(activeSub).toBeNull();

    // Premium feature must be revoked
    const hasWarehousing = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'warehouseManagement'
    );
    expect(hasWarehousing).toBe(false);
  });

  // TEST 9: Subscription renews -> correct plan remains active
  it('TEST 9: Subscription renews -> correct plan remains active with extended period', async () => {
    const tenant = await Tenant.create({
      name: 'Renewing Co',
      slug: 'renew-co',
      contact: { email: 'renew@co.com' },
    });

    const sub = await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    const originalEnd = new Date(sub.currentPeriodEnd);

    // Mock successful renewal payment verification
    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: true,
      reference: 'REF-RENEW-123',
      amount: 65000,
      currency: 'NGN',
      status: 'COMPLETED',
      paidAt: new Date(),
    } as any);

    // Create a transaction for renewal
    await BillingTransaction.create({
      tenantId: tenant._id.toString(),
      planId: proPlan._id,
      planSlug: proPlan.slug,
      subtotal: 65000,
      amount: 69875,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: 'REF-RENEW-123',
      status: 'PENDING',
      type: 'SUBSCRIPTION_PAYMENT',
    });

    await BillingService.verifyAndActivatePayment(
      'PAYSTACK',
      'REF-RENEW-123',
      tenant._id.toString()
    );

    const renewedSub = await SubscriptionService.getTenantSubscription(tenant._id.toString());
    expect(renewedSub?.status).toBe('ACTIVE');
    expect(renewedSub?.planSlug).toBe('professional');
    expect(new Date(renewedSub!.currentPeriodEnd).getTime()).toBeGreaterThanOrEqual(
      originalEnd.getTime()
    );
  });

  // TEST 10: Subscription cancellation -> correct access behavior
  it('TEST 10: Subscription cancellation -> status changes to CANCELLED and falls back to Free', async () => {
    const tenant = await Tenant.create({
      name: 'Cancelling Co',
      slug: 'cancel-co',
      contact: { email: 'cancel@co.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    await SubscriptionService.cancelSubscription(
      tenant._id.toString(),
      true,
      'Testing immediate cancellation'
    );

    const activeSub = await SubscriptionService.getTenantSubscription(tenant._id.toString());
    expect(activeSub).toBeNull();

    const hasWarehousing = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'warehouseManagement'
    );
    expect(hasWarehousing).toBe(false);
  });

  // TEST 11: Upgrade Starter -> Pro
  it('TEST 11: Upgrade Starter to Pro unlocks new limits and features', async () => {
    const tenant = await Tenant.create({
      name: 'Upgrading Co',
      slug: 'upg-co',
      contact: { email: 'upg@co.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: starterPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    expect(await SubscriptionService.hasFeature(tenant._id.toString(), 'multiBranch')).toBe(false);

    const upgradeResult = await SubscriptionService.changePlan({
      tenantId: tenant._id.toString(),
      newPlanId: proPlan._id.toString(),
    });

    expect(upgradeResult.changeType).toBe('UPGRADE');
    expect(upgradeResult.subscription.planSlug).toBe('professional');

    expect(await SubscriptionService.hasFeature(tenant._id.toString(), 'multiBranch')).toBe(true);
    const limits = await UsageMeteringService.getTenantLimits(tenant._id.toString());
    expect(limits.products.count).toBe(5000);
  });

  // TEST 12: Downgrade Pro -> Starter evaluates conflict without data loss
  it('TEST 12: Downgrade Pro to Starter evaluates conflict without data destruction', async () => {
    const tenant = await Tenant.create({
      name: 'Downgrade Co',
      slug: 'down-co',
      contact: { email: 'down@co.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Seed 600 products (exceeds Starter limit of 500)
    const products = Array.from({ length: 600 }).map((_, i) => ({
      tenantId: tenant._id.toString(),
      name: `Product ${i}`,
      sku: `SKU-DOWN-${i}`,
      price: 100,
    }));
    await Product.insertMany(products);

    const impact = await SubscriptionService.evaluateDowngradeImpact(
      tenant._id.toString(),
      starterPlan._id.toString()
    );

    expect(impact.hasConflicts).toBe(true);
    expect(impact.conflicts.some((c) => c.resource === 'products')).toBe(true);

    // Product records must still exist intact
    const count = await Product.countDocuments({ tenantId: tenant._id.toString() });
    expect(count).toBe(600);
  });

  // TEST 13: Multi-tenant isolation: Company A subscription does not affect Company B
  it('TEST 13: Company A subscription does not leak or affect Company B', async () => {
    const companyA = await Tenant.create({
      name: 'Company A Pro',
      slug: 'comp-a-iso',
      contact: { email: 'a@iso.com' },
    });

    const companyB = await Tenant.create({
      name: 'Company B Free',
      slug: 'comp-b-iso',
      contact: { email: 'b@iso.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: companyA._id.toString(),
      planId: proPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Company A has Pro features
    expect(await SubscriptionService.hasFeature(companyA._id.toString(), 'multiBranch')).toBe(true);
    // Company B has Free baseline
    expect(await SubscriptionService.hasFeature(companyB._id.toString(), 'multiBranch')).toBe(
      false
    );

    const limitsA = await UsageMeteringService.getTenantLimits(companyA._id.toString());
    const limitsB = await UsageMeteringService.getTenantLimits(companyB._id.toString());

    expect(limitsA.products.count).toBe(5000);
    expect(limitsB.products.count).toBe(50);
  });

  // TEST 14: Same user owning multiple companies receives isolated subscription per selected company
  it('TEST 14: Same user owning multiple companies receives correct subscription per company', async () => {
    const user = await User.create({
      username: 'multiowner',
      email: 'multiowner@stockora.com',
      password: 'Password123!',
      name: 'Multi Owner',
      role: 'ADMIN',
    });

    const companyEnterprise = await Tenant.create({
      name: 'Owner Enterprise Business',
      slug: 'owner-ent-biz',
      ownerUserId: user._id,
      contact: { email: 'multiowner@stockora.com' },
    });

    const companyStarter = await Tenant.create({
      name: 'Owner Starter Boutique',
      slug: 'owner-start-boutique',
      ownerUserId: user._id,
      contact: { email: 'multiowner@stockora.com' },
    });

    await SubscriptionService.createSubscription({
      tenantId: companyEnterprise._id.toString(),
      planId: entPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    await SubscriptionService.createSubscription({
      tenantId: companyStarter._id.toString(),
      planId: starterPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Switch context to Enterprise
    const entAccess = await SubscriptionService.hasFeature(
      companyEnterprise._id.toString(),
      'aiAssistant'
    );
    expect(entAccess).toBe(true);

    // Switch context to Starter
    const startAccess = await SubscriptionService.hasFeature(
      companyStarter._id.toString(),
      'aiAssistant'
    );
    expect(startAccess).toBe(false);
  });

  // TEST 15: Modified planId cannot grant a higher plan (server looks up authoritative plan)
  it('TEST 15: Checkout initialization looks up authoritative plan from server, not trusting client', async () => {
    const tenant = await Tenant.create({
      name: 'Tamper Co',
      slug: 'tamper-co-15',
      contact: { email: 'tamper@co.com' },
    });

    // Initialize payment with Starter plan
    const init = await BillingService.initializeSubscriptionPayment({
      tenantId: tenant._id.toString(),
      planId: starterPlan._id.toString(),
      billingInterval: 'MONTHLY',
      email: 'tamper@co.com',
      provider: 'PAYSTACK',
    });

    // Server recorded the transaction with Starter's authoritative price and 0% tax (25,000 + 0 = 25,000)
    expect(init.subtotal).toBe(25000);
    expect(init.tax).toBe(0);
    expect(init.amount).toBe(25000);
    const tx = await BillingTransaction.findById(init.transactionId);
    expect(tx?.subtotal).toBe(25000);
    expect(tx?.tax).toBe(0);
    expect(tx?.amount).toBe(25000);
    expect(tx?.planSlug).toBe('starter');
  });

  // TEST 16: Modified amount cannot buy a higher plan (gateway amount mismatch verification fails)
  it('TEST 16: Modified payment amount fails gateway verification and does not activate plan', async () => {
    const tenant = await Tenant.create({
      name: 'Amount Tamper Co',
      slug: 'tamper-amt-co',
      contact: { email: 'amt@tamper.com' },
    });

    const ref = `STK-TAMPER-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: tenant._id.toString(),
      planId: entPlan._id,
      planSlug: entPlan.slug,
      subtotal: 150000,
      amount: 161250,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: ref,
      status: 'PENDING',
      type: 'SUBSCRIPTION_PAYMENT',
    });

    // Gateway reports user paid only 1,000 instead of 161,250
    vi.spyOn(PaymentService, 'verify').mockResolvedValueOnce({
      success: false,
      reference: ref,
      amount: 1000,
      currency: 'NGN',
      status: 'FAILED',
      gatewayResponse: 'Amount mismatch',
    } as any);

    const result = await BillingService.verifyAndActivatePayment(
      'PAYSTACK',
      ref,
      tenant._id.toString()
    );
    expect(result.success).toBe(false);

    // Subscription must NOT be active
    const sub = await SubscriptionService.getTenantSubscription(tenant._id.toString());
    expect(sub).toBeNull();
  });

  // TEST 17: Modified tenantId cannot access another company's subscription
  it('TEST 17: Tampered tenantId during verification rejects with ValidationError', async () => {
    const victim = await Tenant.create({
      name: 'Victim Corp',
      slug: 'victim-corp',
      contact: { email: 'victim@corp.com' },
    });

    const attacker = await Tenant.create({
      name: 'Attacker Corp',
      slug: 'attacker-corp',
      contact: { email: 'attacker@corp.com' },
    });

    const ref = `STK-SEC-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: victim._id.toString(),
      planId: proPlan._id,
      planSlug: proPlan.slug,
      amount: 69875,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: ref,
      status: 'PENDING',
    });

    // Attacker tries to verify victim's transaction for attacker's tenantId
    await expect(
      BillingService.verifyAndActivatePayment('PAYSTACK', ref, attacker._id.toString())
    ).rejects.toThrow('Access denied');
  });

  // TEST 18: Duplicated Paystack webhook cannot create duplicate subscription (idempotency)
  it('TEST 18: Duplicated Paystack webhook is idempotent and prevents duplicate subscriptions', async () => {
    const tenant = await Tenant.create({
      name: 'Webhook Idempotency Co',
      slug: 'webhook-idem-co',
      contact: { email: 'idem@webhook.com' },
    });

    const ref = `STK-HOOK-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: tenant._id.toString(),
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

    const eventPayload = {
      event: 'charge.success',
      data: {
        id: 998877,
        reference: ref,
        amount: 2687500, // Paystack kobo
        currency: 'NGN',
        status: 'success',
      },
    };

    // First webhook call
    const res1 = await BillingService.processPaystackWebhook(eventPayload);
    expect(res1.processed).toBe(true);

    // Second duplicate webhook call
    const res2 = await BillingService.processPaystackWebhook(eventPayload);
    expect(res2.processed).toBe(true);
    expect(res2.reason).toContain('Duplicate event');

    // Verify exactly 1 subscription created
    const subs = await Subscription.find({ tenantId: tenant._id.toString(), status: 'ACTIVE' });
    expect(subs.length).toBe(1);
  });

  // TEST 19: Repeated payment verification is idempotent
  it('TEST 19: Repeated payment verification is idempotent', async () => {
    const tenant = await Tenant.create({
      name: 'Verify Idempotency Co',
      slug: 'ver-idem-co',
      contact: { email: 'ver@idem.com' },
    });

    const ref = `STK-VER-${Date.now()}`;
    await BillingTransaction.create({
      tenantId: tenant._id.toString(),
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

    const call1 = await BillingService.verifyAndActivatePayment(
      'PAYSTACK',
      ref,
      tenant._id.toString()
    );
    expect(call1.success).toBe(true);

    const call2 = await BillingService.verifyAndActivatePayment(
      'PAYSTACK',
      ref,
      tenant._id.toString()
    );
    expect(call2.success).toBe(true);
    expect(call2.message).toContain('already processed');
  });

  // TEST 20: Expired subscription cannot access premium backend APIs
  it('TEST 20: Expired subscription cannot access premium backend feature', async () => {
    const tenant = await Tenant.create({
      name: 'Expired API Co',
      slug: 'exp-api-co',
      contact: { email: 'expapi@co.com' },
    });

    const sub = await SubscriptionService.createSubscription({
      tenantId: tenant._id.toString(),
      planId: entPlan._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Sub initially has AI Assistant
    expect(await SubscriptionService.hasFeature(tenant._id.toString(), 'aiAssistant')).toBe(true);

    // Expire subscription
    const past = new Date();
    past.setHours(past.getHours() - 1);
    sub.currentPeriodEnd = past;
    await sub.save();

    // After expiration, aiAssistant must return false
    const hasAccessAfterExpiry = await SubscriptionService.hasFeature(
      tenant._id.toString(),
      'aiAssistant'
    );
    expect(hasAccessAfterExpiry).toBe(false);
  });
});
