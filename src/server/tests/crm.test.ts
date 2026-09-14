import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { CustomerSegment } from '../models/CustomerSegment.js';
import { MarketingCampaign } from '../models/MarketingCampaign.js';
import { Coupon } from '../models/Coupon.js';
import { CRMService } from '../services/crm.service.js';
import { LoyaltyService } from '../services/loyalty.service.js';
import { CampaignService } from '../services/campaign.service.js';

describe('Phase 30 — Enterprise CRM & Customer Intelligence Tests', () => {
  let sampleCustomer: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }

    sampleCustomer = await Customer.create({
      name: 'Alice Johnson',
      code: `CUST-TEST-${Date.now()}`,
      email: `alice-${Date.now()}@example.com`,
      group: 'RETAIL',
      totalSpending: 1500,
      totalOrders: 5,
      avgOrderValue: 300,
      loyaltyPoints: 100,
      loyaltyTier: 'BRONZE',
    });
  });

  afterAll(async () => {
    if (sampleCustomer?._id) {
      await Customer.deleteOne({ _id: sampleCustomer._id });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('Customer 360 & Analytics', () => {
    it('should retrieve Customer 360 profile and timeline', async () => {
      const data = await CRMService.getCustomer360(sampleCustomer._id.toString());
      expect(data).toBeDefined();
      expect(data.customer._id.toString()).toBe(sampleCustomer._id.toString());
      expect(Array.isArray(data.timeline)).toBe(true);
    });

    it('should recalculate customer CLV and churn risk metrics', async () => {
      const updated = await CRMService.recalculateCustomerMetrics(sampleCustomer._id.toString());
      expect(updated.clvScore).toBeGreaterThanOrEqual(0);
      expect(updated.churnRiskLevel).toBeDefined();
    });
  });

  describe('Loyalty Points Engine', () => {
    it('should earn loyalty points based on transaction total and tier multiplier', async () => {
      const updated = await LoyaltyService.earnPoints(
        sampleCustomer._id.toString(),
        200,
        'TX-1001'
      );
      expect(updated.loyaltyPoints).toBe(120); // 100 + 20
    });

    it('should reject points redemption when balance is insufficient', async () => {
      await expect(
        LoyaltyService.redeemPoints(sampleCustomer._id.toString(), 5000, 'Free Laptop')
      ).rejects.toThrow('Insufficient loyalty points');
    });

    it('should redeem points successfully when balance is sufficient', async () => {
      const updated = await LoyaltyService.redeemPoints(
        sampleCustomer._id.toString(),
        50,
        '$5 Voucher'
      );
      expect(updated.loyaltyPoints).toBe(70);
    });
  });

  describe('Coupons & Marketing Campaigns', () => {
    it('should validate percentage discount coupon', async () => {
      const coupon = await Coupon.create({
        code: `PROMO${Date.now()}`,
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minPurchaseAmount: 50,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 86400000),
      });

      const res = await CampaignService.validateCoupon(coupon.code, 100);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(15);

      await Coupon.deleteOne({ _id: coupon._id });
    });
  });
});
