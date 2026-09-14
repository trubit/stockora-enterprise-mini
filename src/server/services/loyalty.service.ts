import mongoose from 'mongoose';
import { Customer, ILoyaltyHistoryEntry } from '../models/Customer.js';
import { CRMService } from './crm.service.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export class LoyaltyService {
  /**
   * Processes loyalty points earned from a transaction
   */
  public static async earnPoints(
    customerId: string,
    transactionTotal: number,
    referenceId?: string
  ) {
    return await ResilientExecutor.execute({ name: `loyalty-earn:${customerId}` }, async () => {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error(`Customer not found: ${customerId}`);
      }

      // Base rate: 1 point per $10 spent
      const tierMultiplier =
        customer.loyaltyTier === 'PLATINUM'
          ? 2.0
          : customer.loyaltyTier === 'GOLD'
            ? 1.5
            : customer.loyaltyTier === 'SILVER'
              ? 1.25
              : 1.0;

      const pointsEarned = Math.floor((transactionTotal / 10) * tierMultiplier);
      if (pointsEarned <= 0) return customer;

      customer.loyaltyPoints += pointsEarned;
      const entry: ILoyaltyHistoryEntry = {
        date: new Date(),
        points: pointsEarned,
        reason: `Earned from sale (${tierMultiplier}x ${customer.loyaltyTier} tier multiplier)`,
        referenceId,
      };
      customer.loyaltyHistory.push(entry);

      // Check tier progression
      const pts = customer.loyaltyPoints;
      const newTier =
        pts >= 5000 ? 'PLATINUM' : pts >= 2000 ? 'GOLD' : pts >= 500 ? 'SILVER' : 'BRONZE';
      if (customer.loyaltyTier !== newTier) {
        customer.loyaltyTier = newTier as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
      }

      await customer.save();

      await CRMService.recordTimelineEvent(
        customerId,
        'LOYALTY_EARNED',
        `Earned ${pointsEarned} Loyalty Points`,
        `Transaction total: $${transactionTotal}. New balance: ${customer.loyaltyPoints} points.`
      );

      logger.info(
        `[Loyalty Service] ${customer.name} earned ${pointsEarned} points. Balance: ${customer.loyaltyPoints}`
      );
      return customer;
    });
  }

  /**
   * Redeems loyalty points for rewards or store credit
   */
  public static async redeemPoints(
    customerId: string,
    pointsToRedeem: number,
    rewardReason: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    if (customer.loyaltyPoints < pointsToRedeem) {
      throw new Error(
        `Insufficient loyalty points. Balance: ${customer.loyaltyPoints}, Required: ${pointsToRedeem}`
      );
    }

    customer.loyaltyPoints -= pointsToRedeem;
    const entry: ILoyaltyHistoryEntry = {
      date: new Date(),
      points: -pointsToRedeem,
      reason: `Redeemed for: ${rewardReason}`,
    };
    customer.loyaltyHistory.push(entry);
    await customer.save();

    await CRMService.recordTimelineEvent(
      customerId,
      'LOYALTY_REDEEMED',
      `Redeemed ${pointsToRedeem} Loyalty Points`,
      `Reason: ${rewardReason}. Remaining balance: ${customer.loyaltyPoints} points.`
    );

    logger.info(
      `[Loyalty Service] ${customer.name} redeemed ${pointsToRedeem} points. Remaining: ${customer.loyaltyPoints}`
    );
    return customer;
  }
}
