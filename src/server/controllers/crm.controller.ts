import type { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/Customer.js';
import { CustomerSegment } from '../models/CustomerSegment.js';
import { MarketingCampaign } from '../models/MarketingCampaign.js';
import { LoyaltyReward } from '../models/LoyaltyReward.js';
import { RewardRedemption } from '../models/RewardRedemption.js';
import { CustomerJourney } from '../models/CustomerJourney.js';
import { Coupon } from '../models/Coupon.js';
import { CRMService } from '../services/crm.service.js';
import { SegmentationService } from '../services/segmentation.service.js';
import { LoyaltyAdvancedService } from '../services/loyaltyAdvanced.service.js';
import { CampaignAdvancedService } from '../services/campaignAdvanced.service.js';
import { CustomerRetentionService } from '../services/customerRetention.service.js';
import { CRMAIService } from '../services/ai/crmAI.service.js';

export class CRMController {
  /**
   * 1. GET /api/v1/crm/dashboard
   */
  public static async getDashboardData(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const retentionKpis = await CustomerRetentionService.getRetentionKPIs(tenantId);
      const totalSegments = await CustomerSegment.countDocuments({ tenantId, isActive: true });
      const activeCampaigns = await MarketingCampaign.countDocuments({
        tenantId,
        status: 'ACTIVE',
      });
      const totalRewards = await LoyaltyReward.countDocuments({ tenantId, isActive: true });
      const totalRedemptions = await RewardRedemption.countDocuments({ tenantId });

      const topCustomers = await Customer.find({ tenantId, isActive: true })
        .sort({ totalSpending: -1 })
        .limit(6)
        .lean();

      res.json({
        success: true,
        data: {
          kpis: {
            ...retentionKpis,
            totalSegments,
            activeCampaigns,
            totalRewards,
            totalRedemptions,
          },
          topCustomers,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. GET /api/v1/crm/customers/:id/360
   */
  public static async getCustomer360(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CRMService.getCustomer360(id as string, tenantId);
      res.json({ success: true, data });
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }

  /**
   * 3. POST /api/v1/crm/customers/:id/recalculate
   */
  public static async recalculateMetrics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const customer = await CRMService.recalculateCustomerMetrics(id as string, tenantId);
      res.json({ success: true, data: customer });
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }

  /**
   * 4. GET & POST /api/v1/crm/segments
   */
  public static async getSegments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const segments = await CustomerSegment.find({ tenantId }).sort({ createdAt: -1 });
      res.json({ success: true, data: segments });
    } catch (err) {
      next(err);
    }
  }

  public static async createSegment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const { name, code, description, rules, isDynamic, conjunction, tags } = req.body;

      const segment = await CustomerSegment.create({
        tenantId,
        name,
        code: code || `SEG-${Date.now()}`,
        description,
        rules: rules || [],
        isDynamic: isDynamic ?? true,
        conjunction: conjunction || 'AND',
        tags: tags || [],
      });

      // Initial evaluation
      await SegmentationService.evaluateSegment(segment._id.toString(), tenantId);

      res.status(201).json({ success: true, data: segment });
    } catch (err) {
      next(err);
    }
  }

  public static async previewSegment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const { rules, conjunction } = req.body;
      const preview = await SegmentationService.previewSegment(
        rules || [],
        conjunction || 'AND',
        tenantId
      );
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. GET & POST /api/v1/crm/campaigns
   */
  public static async getCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const campaigns = await MarketingCampaign.find({ tenantId }).sort({ createdAt: -1 });
      res.json({ success: true, data: campaigns });
    } catch (err) {
      next(err);
    }
  }

  public static async createCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const userId = (req as any).user?.id;
      const campaign = await CampaignAdvancedService.createCampaign({
        ...req.body,
        tenantId,
        userId,
      });
      res.status(201).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }

  public static async dispatchCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await CampaignAdvancedService.dispatchCampaign(id as string, tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. Loyalty Rewards & Redemptions
   */
  public static async getLoyaltyRewards(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const rewards = await LoyaltyReward.find({ tenantId }).sort({ pointsCost: 1 });
      res.json({ success: true, data: rewards });
    } catch (err) {
      next(err);
    }
  }

  public static async createLoyaltyReward(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const reward = await LoyaltyReward.create({
        ...req.body,
        tenantId,
      });
      res.status(201).json({ success: true, data: reward });
    } catch (err) {
      next(err);
    }
  }

  public static async earnLoyaltyPoints(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const { customerId, transactionTotal, referenceId } = req.body;
      const result = await LoyaltyAdvancedService.earnPoints({
        customerId,
        transactionTotal: Number(transactionTotal),
        referenceId,
        tenantId,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async redeemLoyaltyPoints(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const { customerId, rewardId, pointsToRedeem, points, rewardReason, idempotencyKey } =
        req.body;
      const redemption = await LoyaltyAdvancedService.redeemReward({
        customerId,
        rewardId,
        pointsToRedeem:
          pointsToRedeem !== undefined
            ? Number(pointsToRedeem)
            : points !== undefined
              ? Number(points)
              : undefined,
        rewardReason,
        idempotencyKey:
          idempotencyKey || `RED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
      });
      res.json({ success: true, data: redemption });
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('Insufficient') ||
          err.message.includes('not found') ||
          err.message.includes('must be greater'))
      ) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }

  public static async processReferral(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const result = await LoyaltyAdvancedService.processReferral({
        ...req.body,
        tenantId,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. Retention Radar & Next-Best-Action
   */
  public static async getRetentionRadar(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const [kpis, winBackCandidates, nextBestActions] = await Promise.all([
        CustomerRetentionService.getRetentionKPIs(tenantId),
        CustomerRetentionService.getWinBackCandidates(tenantId, 45),
        CustomerRetentionService.getNextBestActions(tenantId),
      ]);

      res.json({
        success: true,
        data: {
          kpis,
          winBackCandidates,
          nextBestActions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 8. AI Recommendations & Grounded Assistant
   */
  public static async getRecommendations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const recs = await CRMAIService.getPersonalizedRecommendations(id as string, tenantId);
      res.json({ success: true, data: recs });
    } catch (err) {
      next(err);
    }
  }

  public static async askCRMAssistant(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const { prompt, customerId } = req.body;
      const result = await CRMAIService.askCRMAssistant(
        prompt || 'Provide CRM overview',
        customerId,
        tenantId
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 9. Customer Journeys
   */
  public static async getJourneys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const journeys = await CustomerJourney.find({ tenantId }).sort({ createdAt: -1 });
      res.json({ success: true, data: journeys });
    } catch (err) {
      next(err);
    }
  }

  public static async createJourney(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const journey = await CustomerJourney.create({
        ...req.body,
        tenantId,
      });
      res.status(201).json({ success: true, data: journey });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 10. Data Export & Merging
   */
  public static async exportCustomerData(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const exported = await CRMService.exportCustomerData(id as string, tenantId);
      res.json({ success: true, data: exported });
    } catch (err) {
      next(err);
    }
  }

  public static async mergeCustomers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const { primaryId, secondaryId } = req.body;
      const merged = await CRMService.mergeCustomers(primaryId, secondaryId, tenantId);
      res.json({ success: true, data: merged });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 11. Promotional Coupons & Discounts
   */
  public static async getCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const coupons = await Coupon.find({
        ...(tenantId
          ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
          : {}),
      }).sort({ createdAt: -1 });
      res.json({ success: true, data: coupons });
    } catch (err) {
      next(err);
    }
  }

  public static async createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const {
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount,
        maxDiscountAmount,
        usageLimit,
        validUntil,
      } = req.body;

      if (!code || discountValue === undefined) {
        res.status(400).json({ success: false, message: 'Code and discount value are required.' });
        return;
      }

      const expiry = validUntil
        ? new Date(validUntil)
        : new Date(Date.now() + 30 * 24 * 3600 * 1000);

      const coupon = await Coupon.create({
        tenantId,
        companyId: 'default',
        code: code.toUpperCase().trim(),
        description,
        discountType: discountType || 'PERCENTAGE',
        discountValue: Number(discountValue),
        minPurchaseAmount: Number(minPurchaseAmount) || 0,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        validFrom: new Date(),
        validUntil: expiry,
        isActive: true,
      });

      res.status(201).json({ success: true, data: coupon });
    } catch (err) {
      next(err);
    }
  }

  public static async toggleCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const coupon =
        (await Coupon.findOne({
          _id: id,
          ...(tenantId
            ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
            : {}),
        })) || (await Coupon.findById(id));

      if (!coupon) {
        res.status(404).json({ success: false, message: 'Coupon not found' });
        return;
      }

      coupon.isActive = !coupon.isActive;
      await coupon.save();
      res.json({ success: true, data: coupon });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = (req as any).user?.tenantId || 'default';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await Coupon.deleteOne({
        _id: id,
        ...(tenantId
          ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
          : {}),
      });
      res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
