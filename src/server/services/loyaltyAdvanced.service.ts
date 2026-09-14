import mongoose from 'mongoose';
import { Customer, ICustomer, LoyaltyTierType, ILoyaltyHistoryEntry } from '../models/Customer.js';
import { LoyaltyReward, ILoyaltyReward } from '../models/LoyaltyReward.js';
import { RewardRedemption, IRewardRedemption } from '../models/RewardRedemption.js';
import { Referral, IReferral } from '../models/Referral.js';
import { CRMService } from './crm.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export interface IEarnPointsPayload {
  customerId: string;
  transactionTotal?: number;
  points?: number;
  pointsEarned?: number;
  reason?: string;
  referenceId?: string;
  tenantId?: string;
}

export interface IRedeemRewardPayload {
  customerId: string;
  rewardId?: string;
  pointsToRedeem?: number;
  rewardReason?: string;
  idempotencyKey?: string;
  tenantId?: string;
}

export interface IProcessReferralPayload {
  referralCode: string;
  refereeEmail: string;
  refereeName?: string;
  refereeId?: string;
  tenantId?: string;
}

export class LoyaltyAdvancedService {
  /**
   * 1. Earn Loyalty Points with Dynamic Tier Multipliers
   */
  public static async earnPoints(
    payload: IEarnPointsPayload
  ): Promise<{ customer: ICustomer; pointsEarned: number }> {
    const tenantId = payload.tenantId || 'default';
    return await ResilientExecutor.execute(
      { name: `loyalty-earn:${payload.customerId}` },
      async () => {
        const customer =
          (await Customer.findOne({
            _id: payload.customerId,
            ...(tenantId
              ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
              : {}),
          })) || (await Customer.findById(payload.customerId));

        if (!customer) {
          throw new Error(`Customer not found: ${payload.customerId}`);
        }

        if (customer.loyaltyPoints === undefined || isNaN(customer.loyaltyPoints)) {
          customer.loyaltyPoints = 0;
        }
        if (!customer.loyaltyHistory) {
          customer.loyaltyHistory = [];
        }
        if (!customer.loyaltyTier) {
          customer.loyaltyTier = 'BRONZE';
        }

        // Tier Multipliers
        const tierMultiplier =
          customer.loyaltyTier === 'PLATINUM'
            ? 2.0
            : customer.loyaltyTier === 'GOLD'
              ? 1.5
              : customer.loyaltyTier === 'SILVER'
                ? 1.25
                : 1.0;

        const pointsEarned =
          payload.points !== undefined
            ? Number(payload.points)
            : payload.pointsEarned !== undefined
              ? Number(payload.pointsEarned)
              : Math.max(1, Math.floor(((payload.transactionTotal || 0) / 10) * tierMultiplier));

        if (pointsEarned <= 0) {
          throw new Error('Points earned must be greater than 0.');
        }

        customer.loyaltyPoints += pointsEarned;
        const historyEntry: ILoyaltyHistoryEntry = {
          date: new Date(),
          points: pointsEarned,
          reason:
            payload.reason ||
            `Earned points (${tierMultiplier}x ${customer.loyaltyTier} multiplier)`,
          referenceId: payload.referenceId,
        };
        customer.loyaltyHistory.push(historyEntry);

        // Check Tier Upgrades
        const pts = customer.loyaltyPoints;
        const calculatedTier: LoyaltyTierType =
          pts >= 5000 ? 'PLATINUM' : pts >= 2000 ? 'GOLD' : pts >= 500 ? 'SILVER' : 'BRONZE';

        if (customer.loyaltyTier !== calculatedTier) {
          const prevTier = customer.loyaltyTier;
          customer.loyaltyTier = calculatedTier;
          await CRMService.recordTimelineEvent(
            customer._id.toString(),
            'LOYALTY_TIER_CHANGED',
            `Upgraded to ${calculatedTier} Tier`,
            `Congratulations! Upgraded from ${prevTier} to ${calculatedTier} tier.`,
            { prevTier, newTier: calculatedTier },
            undefined,
            undefined,
            tenantId
          );
        }

        await customer.save();

        await CRMService.recordTimelineEvent(
          customer._id.toString(),
          'LOYALTY_EARNED',
          `Earned ${pointsEarned} Loyalty Points`,
          `Reason: ${payload.reason || 'Points Earned'}. New Balance: ${customer.loyaltyPoints} points.`,
          { pointsEarned, referenceId: payload.referenceId },
          undefined,
          undefined,
          tenantId
        );

        return { customer, pointsEarned };
      }
    );
  }

  /**
   * 2. Atomic Reward Redemption with Idempotency & Rollback Guarantees
   */
  public static async redeemReward(payload: IRedeemRewardPayload): Promise<IRewardRedemption> {
    const tenantId = payload.tenantId || 'default';
    const key =
      payload.idempotencyKey || `RED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return await ResilientExecutor.execute({ name: `loyalty-redeem:${key}` }, async () => {
      // 1. Idempotency Check
      const existing = await RewardRedemption.findOne({
        tenantId,
        idempotencyKey: key,
      });
      if (existing) {
        logger.info(`[Loyalty] Idempotent replay for redemption key ${key}`);
        return existing;
      }

      // 2. Fetch Customer
      const customer =
        (await Customer.findOne({
          _id: payload.customerId,
          ...(tenantId
            ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
            : {}),
        })) || (await Customer.findById(payload.customerId));

      if (!customer) throw new Error(`Customer not found: ${payload.customerId}`);

      if (customer.loyaltyPoints === undefined || isNaN(customer.loyaltyPoints)) {
        customer.loyaltyPoints = 0;
      }
      if (!customer.loyaltyHistory) {
        customer.loyaltyHistory = [];
      }
      if (!customer.loyaltyTier) {
        customer.loyaltyTier = 'BRONZE';
      }

      let pointsCost = Number(payload.pointsToRedeem) || 0;
      let rewardName = payload.rewardReason || 'Points Redemption';
      let rewardCode = 'MANUAL-REDEEM';
      let rewardDoc: ILoyaltyReward | null = null;

      // If specific catalog reward ID passed
      if (payload.rewardId) {
        rewardDoc =
          (await LoyaltyReward.findOne({
            _id: payload.rewardId,
            isActive: true,
            ...(tenantId
              ? { $or: [{ tenantId }, { tenantId: 'default' }, { tenantId: { $exists: false } }] }
              : {}),
          })) || (await LoyaltyReward.findById(payload.rewardId));

        if (!rewardDoc) throw new Error(`Reward not found or inactive: ${payload.rewardId}`);

        pointsCost = rewardDoc.pointsCost;
        rewardName = rewardDoc.name;
        rewardCode = rewardDoc.code;

        // Validate Tier Qualification
        const tierRank: Record<string, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4 };
        if ((tierRank[customer.loyaltyTier] || 1) < (tierRank[rewardDoc.minimumTier] || 1)) {
          throw new Error(
            `Customer tier (${customer.loyaltyTier}) does not meet minimum requirement (${rewardDoc.minimumTier}) for ${rewardDoc.name}.`
          );
        }

        // Check Stock Limit if applicable
        if (rewardDoc.stockLimit && rewardDoc.redeemedCount >= rewardDoc.stockLimit) {
          throw new Error(`Reward "${rewardDoc.name}" is currently out of stock.`);
        }
      }

      if (pointsCost <= 0) {
        throw new Error('Points to redeem must be greater than 0.');
      }

      // 3. Validate Points Balance
      if (customer.loyaltyPoints < pointsCost) {
        throw new Error(
          `Insufficient loyalty points. Customer has ${customer.loyaltyPoints} points, but ${pointsCost} points are required.`
        );
      }

      // 4. Deduct points atomically
      customer.loyaltyPoints -= pointsCost;
      customer.loyaltyHistory.push({
        date: new Date(),
        points: -pointsCost,
        reason: `Redeemed: ${rewardName}`,
        referenceId: rewardCode,
      });
      await customer.save();

      if (rewardDoc) {
        rewardDoc.redeemedCount += 1;
        await rewardDoc.save();
      }

      // 5. Create Redemption Record
      const redemptionCode = `RWD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day redemption validity

      const redemption = await RewardRedemption.create({
        tenantId,
        customerId: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        rewardId: rewardDoc ? rewardDoc._id : undefined,
        rewardName,
        rewardCode,
        pointsDeducted: pointsCost,
        redemptionCode,
        status: 'COMPLETED',
        idempotencyKey: key,
        expiresAt,
        redeemedAt: new Date(),
      });

      await CRMService.recordTimelineEvent(
        customer._id.toString(),
        'REWARD_REDEEMED',
        `Redeemed: ${rewardName}`,
        `Voucher Code: ${redemptionCode}. Points used: ${pointsCost}. Remaining: ${customer.loyaltyPoints} pts.`,
        { redemptionCode, rewardCode, pointsCost },
        undefined,
        undefined,
        tenantId
      );

      return redemption;
    });
  }

  /**
   * 3. Referral System Registration & Rewards with Anti-Self-Referral Validation
   */
  public static async processReferral(payload: IProcessReferralPayload): Promise<IReferral> {
    const tenantId = payload.tenantId || 'default';
    return await ResilientExecutor.execute(
      { name: `referral:${payload.referralCode}:${payload.refereeEmail}` },
      async () => {
        // 1. Find Referrer
        const referrer = await Customer.findOne({
          tenantId,
          referralCode: payload.referralCode,
        });

        if (!referrer) {
          throw new Error(`Invalid referral code: ${payload.referralCode}`);
        }

        // 2. Anti-Self-Referral Check
        if (referrer.email.toLowerCase() === payload.refereeEmail.toLowerCase()) {
          throw new Error('Self-referral is prohibited.');
        }

        // 3. Existing Referral Check
        const existing = await Referral.findOne({
          tenantId,
          referralCode: payload.referralCode,
          refereeEmail: payload.refereeEmail.toLowerCase(),
        });

        if (existing) {
          return existing;
        }

        // 4. Create Referral
        const rewardPoints = 250;
        const referral = await Referral.create({
          tenantId,
          referrerId: referrer._id,
          referrerName: referrer.name,
          referrerEmail: referrer.email,
          referralCode: payload.referralCode,
          refereeEmail: payload.refereeEmail.toLowerCase(),
          refereeId: payload.refereeId ? new mongoose.Types.ObjectId(payload.refereeId) : undefined,
          refereeName: payload.refereeName,
          status: 'QUALIFIED',
          rewardPoints,
          rewardIssuedAt: new Date(),
        });

        // Award referrer bonus points
        referrer.loyaltyPoints += rewardPoints;
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        referrer.loyaltyHistory.push({
          date: new Date(),
          points: rewardPoints,
          reason: `Referral bonus for inviting ${payload.refereeEmail}`,
          referenceId: referral._id.toString(),
        });
        await referrer.save();

        await CRMService.recordTimelineEvent(
          referrer._id.toString(),
          'LOYALTY_EARNED',
          `Referral Reward: +${rewardPoints} pts`,
          `Successfully referred ${payload.refereeEmail}. Bonus points awarded!`,
          { referralId: referral._id, refereeEmail: payload.refereeEmail },
          undefined,
          undefined,
          tenantId
        );

        return referral;
      }
    );
  }

  /**
   * 4. Point Expiration Background Audit
   */
  public static async scanAndExpirePoints(
    tenantId: string = 'default',
    inactivityDays: number = 365
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactivityDays);

    const inactiveCustomers = await Customer.find({
      tenantId,
      loyaltyPoints: { $gt: 0 },
      lastPurchaseDate: { $lte: cutoffDate },
    });

    let expiredCount = 0;
    for (const cust of inactiveCustomers) {
      const ptsToExpire = cust.loyaltyPoints;
      cust.loyaltyPoints = 0;
      cust.loyaltyHistory.push({
        date: new Date(),
        points: -ptsToExpire,
        reason: `Points expired due to ${inactivityDays} days of inactivity`,
      });
      await cust.save();
      expiredCount++;

      await CRMService.recordTimelineEvent(
        cust._id.toString(),
        'LOYALTY_EXPIRED',
        `Expired ${ptsToExpire} Inactive Loyalty Points`,
        `Points expired after ${inactivityDays} days without purchases.`,
        undefined,
        undefined,
        undefined,
        tenantId
      );
    }

    return expiredCount;
  }

  /**
   * 5. Loyalty Fraud Anomaly Scanner
   */
  public static async detectLoyaltyAnomalies(tenantId: string = 'default'): Promise<
    Array<{
      customerId: string;
      customerName: string;
      anomalyType: string;
      severity: 'MEDIUM' | 'HIGH';
      details: string;
    }>
  > {
    const anomalies: any[] = [];
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);

    // Look for customers with > 5 redemptions in 24 hours
    const frequentRedeemers = await RewardRedemption.aggregate([
      { $match: { tenantId, createdAt: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: '$customerId',
          count: { $sum: 1 },
          totalPoints: { $sum: '$pointsDeducted' },
        },
      },
      { $match: { count: { $gte: 5 } } },
    ]);

    for (const r of frequentRedeemers) {
      const cust = await Customer.findById(r._id).lean();
      if (cust) {
        anomalies.push({
          customerId: cust._id.toString(),
          customerName: cust.name,
          anomalyType: 'EXCESSIVE_REDEMPTIONS_24H',
          severity: 'HIGH',
          details: `${r.count} reward redemptions (${r.totalPoints} points) in the last 24 hours.`,
        });
      }
    }

    return anomalies;
  }
}
