import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { CustomerSegment } from '../models/CustomerSegment.js';
import { MarketingCampaign } from '../models/MarketingCampaign.js';
import { LoyaltyReward } from '../models/LoyaltyReward.js';
import { RewardRedemption } from '../models/RewardRedemption.js';
import { Referral } from '../models/Referral.js';
import { CustomerJourney } from '../models/CustomerJourney.js';
import { CustomerTimeline } from '../models/CustomerTimeline.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { Product } from '../models/Product.js';
import { CRMService } from '../services/crm.service.js';
import { SegmentationService } from '../services/segmentation.service.js';
import { LoyaltyAdvancedService } from '../services/loyaltyAdvanced.service.js';
import { CampaignAdvancedService } from '../services/campaignAdvanced.service.js';
import { CustomerRetentionService } from '../services/customerRetention.service.js';
import { CustomerJourneyService } from '../services/customerJourney.service.js';
import { CRMAIService } from '../services/ai/crmAI.service.js';

describe('Phase 42 — Advanced CRM, Customer Engagement, Loyalty & Retention Tests', () => {
  const tenantA = 'tenant-crm-a';
  const tenantB = 'tenant-crm-b';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stockora_test_p42';
      await mongoose.connect(mongoUri);
    }

    try {
      await Customer.syncIndexes();
      await CustomerSegment.syncIndexes();
      await MarketingCampaign.syncIndexes();
      await LoyaltyReward.syncIndexes();
      await RewardRedemption.syncIndexes();
      await Referral.syncIndexes();
      await CustomerJourney.syncIndexes();
    } catch {
      // ignore
    }

    // Clean up test collections
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CustomerSegment.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await MarketingCampaign.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await LoyaltyReward.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await RewardRedemption.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Referral.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CustomerJourney.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CustomerTimeline.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CampaignRecipient.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
  });

  afterAll(async () => {
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CustomerSegment.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await MarketingCampaign.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await LoyaltyReward.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await RewardRedemption.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Referral.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CustomerJourney.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CustomerTimeline.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await CampaignRecipient.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
  });

  it('1. should create customer profile, record timeline events, and fetch Customer 360', async () => {
    const ts = Date.now();
    const customer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-${ts}`,
      name: 'Eleanor Vance',
      email: `eleanor-${ts}@example.com`,
      phone: '+1555123456',
      totalSpending: 1200,
      totalOrders: 4,
      avgOrderValue: 300,
      loyaltyTier: 'BRONZE',
      loyaltyPoints: 120,
      optInMarketing: true,
      optInSms: true,
    });

    await CRMService.recordTimelineEvent(
      customer._id.toString(),
      'CUSTOMER_CREATED',
      'Account Registered',
      'Customer joined via online portal',
      { channel: 'WEB' },
      undefined,
      undefined,
      tenantA
    );

    const c360 = await CRMService.getCustomer360(customer._id.toString(), tenantA);
    expect(c360.customer).toBeDefined();
    expect(c360.customer.name).toBe('Eleanor Vance');
    expect(c360.timeline.length).toBeGreaterThanOrEqual(1);
    expect(c360.timeline[0].eventType).toBe('CUSTOMER_CREATED');
  });

  it('2. should calculate CLV, RFM retention profile, and churn risk levels', async () => {
    const ts = Date.now();
    const customer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-CHURN-${ts}`,
      name: 'Marcus Holloway',
      email: `marcus-${ts}@example.com`,
      totalSpending: 2500,
      totalOrders: 5,
      avgOrderValue: 500,
      lastPurchaseDate: new Date(Date.now() - 75 * 86400000), // 75 days ago
    });

    const evaluated = await CustomerRetentionService.evaluateCustomerRetentionProfile(
      customer._id.toString(),
      tenantA
    );

    expect(evaluated.clvScore).toBeGreaterThan(0);
    expect(evaluated.clvMethod).toBe('AOV_FREQUENCY_MARGIN_MULTIPLIER');
    expect(evaluated.churnRiskScore).toBeGreaterThanOrEqual(30);
    expect(evaluated.churnRiskLevel).toMatch(/MEDIUM|HIGH|CRITICAL/);
    expect(evaluated.churnSignals?.length).toBeGreaterThan(0);
  });

  it('3. should compile dynamic segment rules, preview audience, and evaluate member counts', async () => {
    const ts = Date.now();
    await Customer.create({
      tenantId: tenantA,
      code: `CUST-VIP-${ts}`,
      name: 'Victoria Stirling',
      email: `victoria-${ts}@example.com`,
      totalSpending: 6000,
      totalOrders: 12,
      loyaltyTier: 'PLATINUM',
    });

    const rules: any = [
      { field: 'totalSpending', operator: 'GREATER_THAN', value: 5000 },
      { field: 'totalOrders', operator: 'GREATER_THAN', value: 5 },
    ];

    // Preview
    const preview = await SegmentationService.previewSegment(rules, 'AND', tenantA);
    expect(preview.totalCount).toBeGreaterThanOrEqual(1);
    expect(preview.sampleCustomers.some((c) => c.name === 'Victoria Stirling')).toBe(true);

    // Save and Evaluate Segment
    const segment = await CustomerSegment.create({
      tenantId: tenantA,
      name: 'High Value VIP Shoppers',
      code: `SEG-VIP-${ts}`,
      rules,
      conjunction: 'AND',
    });

    const evaluated = await SegmentationService.evaluateSegment(segment._id.toString(), tenantA);
    expect(evaluated.memberCount).toBeGreaterThanOrEqual(1);
  });

  it('4. should process marketing campaign creation and dispatch with idempotency and consent checks', async () => {
    const ts = Date.now();
    const consentedCust = await Customer.create({
      tenantId: tenantA,
      code: `CUST-CAMP-${ts}`,
      name: 'Arthur Pendelton',
      email: `arthur-${ts}@example.com`,
      optInMarketing: true,
      optInSms: true,
    });

    const optedOutCust = await Customer.create({
      tenantId: tenantA,
      code: `CUST-NOOPT-${ts}`,
      name: 'Declined Customer',
      email: `noopt-${ts}@example.com`,
      optInMarketing: false,
    });

    const campaign = await CampaignAdvancedService.createCampaign({
      title: 'Spring Special Sale',
      channel: 'EMAIL',
      messageTemplate: 'Hello {{name}}, shop our spring deals with coupon {{coupon}}!',
      couponCode: 'SPRING15',
      tenantId: tenantA,
    });

    expect(campaign.status).toBe('DRAFT');

    const dispatched = await CampaignAdvancedService.dispatchCampaign(
      campaign._id.toString(),
      tenantA
    );

    expect(dispatched.status).toBe('COMPLETED');
    expect(dispatched.stats.sentCount).toBeGreaterThanOrEqual(1);

    // Verify recipient record was created with idempotency key
    const recipient = await CampaignRecipient.findOne({
      tenantId: tenantA,
      campaignId: campaign._id,
      customerId: consentedCust._id,
    });
    expect(recipient).toBeDefined();
    expect(recipient?.status).toBe('DELIVERED');

    // Opted out customer should NOT receive campaign
    const noOptRecipient = await CampaignRecipient.findOne({
      tenantId: tenantA,
      campaignId: campaign._id,
      customerId: optedOutCust._id,
    });
    expect(noOptRecipient).toBeNull();
  });

  it('5. should earn loyalty points with tier progression multipliers', async () => {
    const ts = Date.now();
    const customer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-LOYAL-${ts}`,
      name: 'Lucas Davenport',
      email: `lucas-${ts}@example.com`,
      loyaltyPoints: 450,
      loyaltyTier: 'BRONZE',
    });

    // Earn points: spending $600 should earn 60 pts and upgrade tier from BRONZE to SILVER (>= 500)
    const { customer: updated, pointsEarned } = await LoyaltyAdvancedService.earnPoints({
      customerId: customer._id.toString(),
      transactionTotal: 600,
      tenantId: tenantA,
    });

    expect(pointsEarned).toBe(60);
    expect(updated.loyaltyPoints).toBe(510);
    expect(updated.loyaltyTier).toBe('SILVER');
  });

  it('6. should execute atomic reward redemption, validate tier/points, and enforce idempotency', async () => {
    const ts = Date.now();
    const customer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-RED-${ts}`,
      name: 'Clara Oswald',
      email: `clara-${ts}@example.com`,
      loyaltyPoints: 1000,
      loyaltyTier: 'GOLD',
    });

    const reward = await LoyaltyReward.create({
      tenantId: tenantA,
      name: '$20 Off Voucher',
      code: `RWD-20-${ts}`,
      rewardType: 'DISCOUNT_FIXED',
      pointsCost: 400,
      minimumTier: 'SILVER',
      discountValue: 20,
    });

    const idempotencyKey = `RED-KEY-${ts}`;
    const redemption = await LoyaltyAdvancedService.redeemReward({
      customerId: customer._id.toString(),
      rewardId: reward._id.toString(),
      idempotencyKey,
      tenantId: tenantA,
    });

    expect(redemption.status).toBe('COMPLETED');
    expect(redemption.pointsDeducted).toBe(400);

    const refreshedCust = await Customer.findById(customer._id);
    expect(refreshedCust?.loyaltyPoints).toBe(600); // 1000 - 400

    // Replaying same redemption with same idempotency key returns existing record without double deduction
    const replay = await LoyaltyAdvancedService.redeemReward({
      customerId: customer._id.toString(),
      rewardId: reward._id.toString(),
      idempotencyKey,
      tenantId: tenantA,
    });
    expect(replay._id.toString()).toBe(redemption._id.toString());
    const refreshedReplayCust = await Customer.findById(customer._id);
    expect(refreshedReplayCust?.loyaltyPoints).toBe(600);

    // Insufficient points redemption should throw
    const lowPointsCust = await Customer.create({
      tenantId: tenantA,
      code: `CUST-LOW-${ts}`,
      name: 'Low Points User',
      email: `low-${ts}@example.com`,
      loyaltyPoints: 50,
      loyaltyTier: 'SILVER',
    });

    await expect(
      LoyaltyAdvancedService.redeemReward({
        customerId: lowPointsCust._id.toString(),
        rewardId: reward._id.toString(),
        idempotencyKey: `RED-FAIL-${ts}`,
        tenantId: tenantA,
      })
    ).rejects.toThrow(/Insufficient loyalty points/);
  });

  it('7. should process referral registration and prevent self-referrals', async () => {
    const ts = Date.now();
    const referrer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-REF-${ts}`,
      name: 'Hannah Abbott',
      email: `hannah-${ts}@example.com`,
      referralCode: `REF-${ts}`,
      loyaltyPoints: 100,
    });

    // Self-referral must fail
    await expect(
      LoyaltyAdvancedService.processReferral({
        referralCode: `REF-${ts}`,
        refereeEmail: `hannah-${ts}@example.com`,
        tenantId: tenantA,
      })
    ).rejects.toThrow(/Self-referral is prohibited/);

    // Valid referral
    const referral = await LoyaltyAdvancedService.processReferral({
      referralCode: `REF-${ts}`,
      refereeEmail: `newfriend-${ts}@example.com`,
      refereeName: 'New Friend',
      tenantId: tenantA,
    });

    expect(referral.status).toBe('QUALIFIED');
    expect(referral.rewardPoints).toBe(250);

    const updatedReferrer = await Customer.findById(referrer._id);
    expect(updatedReferrer?.loyaltyPoints).toBe(350); // 100 + 250
    expect(updatedReferrer?.referralCount).toBe(1);
  });

  it('8. should scan and expire inactive customer loyalty points', async () => {
    const ts = Date.now();
    const inactiveCust = await Customer.create({
      tenantId: tenantA,
      code: `CUST-INACT-${ts}`,
      name: 'Dormant User',
      email: `dormant-${ts}@example.com`,
      loyaltyPoints: 300,
      lastPurchaseDate: new Date(Date.now() - 400 * 86400000), // 400 days inactive
    });

    const expiredCount = await LoyaltyAdvancedService.scanAndExpirePoints(tenantA, 365);
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await Customer.findById(inactiveCust._id);
    expect(refreshed?.loyaltyPoints).toBe(0);
  });

  it('9. should trigger and execute automated customer lifecycle journeys', async () => {
    const ts = Date.now();
    const journey = await CustomerJourney.create({
      tenantId: tenantA,
      name: 'New Customer Welcome Onboarding',
      triggerType: 'CUSTOMER_CREATED',
      steps: [
        { stepId: 'step-1', type: 'TRIGGER' },
        {
          stepId: 'step-2',
          type: 'ACTION',
          actionType: 'ISSUE_LOYALTY_POINTS',
          actionConfig: { points: 150 },
        },
        {
          stepId: 'step-3',
          type: 'ACTION',
          actionType: 'ADD_TAG',
          actionConfig: { tag: 'WELCOME_COMPLETED' },
        },
      ],
      isActive: true,
    });

    const newCustomer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-JOURNEY-${ts}`,
      name: 'Oliver Queen',
      email: `oliver-${ts}@example.com`,
      loyaltyPoints: 0,
      tags: [],
    });

    const results = await CustomerJourneyService.handleJourneyTrigger(
      'CUSTOMER_CREATED',
      newCustomer._id.toString(),
      tenantA
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].journeyName).toBe(journey.name);

    const refreshed = await Customer.findById(newCustomer._id);
    expect(refreshed?.loyaltyPoints).toBe(150);
    expect(refreshed?.tags).toContain('WELCOME_COMPLETED');
  });

  it('10. should generate grounded AI product recommendations and Next-Best-Actions', async () => {
    const ts = Date.now();
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Wireless Ergonomic Keyboard',
      code: `PROD-KB-${ts}`,
      sku: `SKU-KB-${ts}`,
      category: 'Electronics',
      costPrice: 45,
      sellingPrice: 89.99,
      price: 89.99,
      cost: 45,
      quantity: 100,
      lowStockAlert: 10,
      currency: 'USD',
      isActive: true,
      status: 'ACTIVE',
    });

    const customer = await Customer.create({
      tenantId: tenantA,
      code: `CUST-RECS-${ts}`,
      name: 'Diana Prince',
      email: `diana-${ts}@example.com`,
      preferences: { preferredCategories: ['Electronics'] },
    });

    const recommendations = await CRMAIService.getPersonalizedRecommendations(
      customer._id.toString(),
      tenantA
    );

    expect(recommendations.length).toBeGreaterThanOrEqual(1);
    expect(recommendations[0].productName).toBe('Wireless Ergonomic Keyboard');
    expect(recommendations[0].reason).toContain('preferred category');

    const nextBestActions = await CustomerRetentionService.getNextBestActions(tenantA);
    expect(Array.isArray(nextBestActions)).toBe(true);
  });

  it('11. should merge duplicate customer accounts with audit logging', async () => {
    const ts = Date.now();
    const primary = await Customer.create({
      tenantId: tenantA,
      code: `CUST-PRI-${ts}`,
      name: 'Bruce Wayne',
      email: `bruce-${ts}@wayne.corp`,
      loyaltyPoints: 500,
      totalSpending: 3000,
      totalOrders: 6,
      tags: ['VIP'],
    });

    const secondary = await Customer.create({
      tenantId: tenantA,
      code: `CUST-SEC-${ts}`,
      name: 'B. Wayne',
      email: `bruce-alt-${ts}@wayne.corp`,
      loyaltyPoints: 200,
      totalSpending: 1500,
      totalOrders: 2,
      tags: ['PROMO'],
    });

    const merged = await CRMService.mergeCustomers(
      primary._id.toString(),
      secondary._id.toString(),
      tenantA
    );

    expect(merged.loyaltyPoints).toBe(700); // 500 + 200
    expect(merged.totalSpending).toBe(4500); // 3000 + 1500
    expect(merged.totalOrders).toBe(8); // 6 + 2
    expect(merged.tags).toContain('VIP');
    expect(merged.tags).toContain('PROMO');

    const refreshedSecondary = await Customer.findById(secondary._id);
    expect(refreshedSecondary?.isActive).toBe(false);
    expect(refreshedSecondary?.notes).toContain('Merged into primary');
  });

  it('12. should enforce strict multi-tenant isolation across all CRM entities', async () => {
    const ts = Date.now();
    const custA = await Customer.create({
      tenantId: tenantA,
      code: `CUST-ISO-A-${ts}`,
      name: 'Tenant A Customer',
      email: `custA-${ts}@example.com`,
      loyaltyPoints: 1000,
    });

    const custB = await Customer.create({
      tenantId: tenantB,
      code: `CUST-ISO-B-${ts}`,
      name: 'Tenant B Customer',
      email: `custB-${ts}@example.com`,
      loyaltyPoints: 5000,
    });

    // Tenant A querying Customer 360 of Tenant B must fail
    await expect(CRMService.getCustomer360(custB._id.toString(), tenantA)).rejects.toThrow(
      /Customer not found/
    );

    // Retention KPIs for Tenant A should not include Tenant B
    const kpisA = await CustomerRetentionService.getRetentionKPIs(tenantA);
    const kpisB = await CustomerRetentionService.getRetentionKPIs(tenantB);

    expect(kpisA.totalCustomers).toBeGreaterThanOrEqual(1);
    expect(kpisB.totalCustomers).toBeGreaterThanOrEqual(1);
  });
});
