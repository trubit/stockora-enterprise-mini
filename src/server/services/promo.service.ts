/**
 * promo.service.ts
 * Centralised business logic for Promotions, Discounts, Gift Cards, and Loyalty.
 *
 * Responsibilities:
 *  - Validate and apply promotion codes with full scoping (category/brand/product/customer)
 *  - BOGO & BUNDLE discount computation
 *  - Gift card issuance, top-up, redemption, and deactivation
 *  - Loyalty points award/deduction with automatic tier recalculation
 *  - Loyalty history tracking
 */

import mongoose from 'mongoose';
import { Promotion, type IPromotion } from '../models/Promotion.js';
import { GiftCard } from '../models/GiftCard.js';
import { Customer } from '../models/Customer.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';

// ---------------------------------------------------------------------------
// Tier thresholds (cumulative lifetime points earned)
// ---------------------------------------------------------------------------
export const LOYALTY_TIER_THRESHOLDS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 2000,
  PLATINUM: 5000,
};

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

// Points earned per dollar spent (by tier)
export const POINTS_PER_DOLLAR: Record<LoyaltyTier, number> = {
  BRONZE: 1,
  SILVER: 1.5,
  GOLD: 2,
  PLATINUM: 3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recalculateTier(totalPoints: number): LoyaltyTier {
  if (totalPoints >= LOYALTY_TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalPoints >= LOYALTY_TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (totalPoints >= LOYALTY_TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

// ---------------------------------------------------------------------------
// Promotion Validation & Discount Computation
// ---------------------------------------------------------------------------

export interface CartItem {
  productId: string;
  category?: string;
  brand?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ValidatePromoOptions {
  code: string;
  purchaseAmount: number;
  cartItems?: CartItem[];
  customerId?: string;
}

export interface PromoValidationResult {
  valid: boolean;
  promoId: string;
  type: IPromotion['type'];
  value: number;
  discountAmount: number;
  applicableItems?: CartItem[];
  description?: string;
}

export class PromoService {
  /**
   * Validate a promo code and compute the effective discount.
   * Applies scoping rules (category / brand / product / customer-specific).
   */
  static async validateAndCompute(opts: ValidatePromoOptions): Promise<PromoValidationResult> {
    const { code, purchaseAmount, cartItems = [], customerId } = opts;

    const promo = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) throw new ValidationError('Invalid or inactive promotion code.');

    const now = new Date();
    if (promo.startDate && now < promo.startDate) {
      throw new ValidationError('This promotion has not started yet.');
    }
    if (now > promo.expiresAt) throw new ValidationError('This promotion code has expired.');
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      throw new ValidationError('This promotion code has reached its usage limit.');
    }

    // Customer-specific check
    if (promo.customerSpecific && customerId) {
      const allowed = promo.allowedCustomers.map((id) => id.toString());
      if (!allowed.includes(customerId)) {
        throw new ValidationError('This promotion code is not valid for your account.');
      }
    }

    if (purchaseAmount < promo.minPurchase) {
      throw new ValidationError(
        `Minimum purchase of $${promo.minPurchase.toFixed(2)} required for this promotion.`
      );
    }

    // Filter applicable cart items by scope
    let applicableItems = cartItems;
    const hasCategoryScope = promo.applicableCategories.length > 0;
    const hasBrandScope = promo.applicableBrands.length > 0;
    const hasProductScope = promo.applicableProducts.length > 0;

    if (hasCategoryScope || hasBrandScope || hasProductScope) {
      const productIds = promo.applicableProducts.map((id) => id.toString());
      applicableItems = cartItems.filter((item) => {
        if (hasCategoryScope && item.category && promo.applicableCategories.includes(item.category))
          return true;
        if (hasBrandScope && item.brand && promo.applicableBrands.includes(item.brand)) return true;
        if (hasProductScope && productIds.includes(item.productId)) return true;
        return false;
      });
      // If scoped but no items qualify, no discount
      if (applicableItems.length === 0) {
        return {
          valid: true,
          promoId: promo._id.toString(),
          type: promo.type,
          value: promo.value,
          discountAmount: 0,
          applicableItems: [],
          description: 'No items in your cart qualify for this promotion.',
        };
      }
    }

    const applicableTotal = applicableItems.reduce((sum, i) => sum + i.lineTotal, 0);
    let discountAmount = 0;

    switch (promo.type) {
      case 'PERCENTAGE':
        discountAmount = (applicableTotal * promo.value) / 100;
        break;
      case 'FIXED':
        discountAmount = Math.min(promo.value, applicableTotal);
        break;
      case 'BOGO': {
        // Buy-one-get-one: every pair of identical items, the cheaper one is free
        let bogoDiscount = 0;
        for (const item of applicableItems) {
          const freePairs = Math.floor(item.quantity / 2);
          bogoDiscount += freePairs * item.unitPrice;
        }
        discountAmount = bogoDiscount;
        break;
      }
      case 'BUNDLE': {
        // Bundle: flat percentage off if all scoped products are present
        const hasAll =
          promo.applicableProducts.length > 0 &&
          promo.applicableProducts.every((pid) =>
            applicableItems.some((i) => i.productId === pid.toString())
          );
        if (hasAll) {
          discountAmount = (applicableTotal * promo.value) / 100;
        }
        break;
      }
    }

    return {
      valid: true,
      promoId: promo._id.toString(),
      type: promo.type,
      value: promo.value,
      discountAmount: Math.round(discountAmount * 100) / 100,
      applicableItems,
      description: promo.description,
    };
  }

  /**
   * Increment usage count after a promotion is successfully applied on a sale.
   */
  static async incrementUsage(promoId: string): Promise<void> {
    await Promotion.findByIdAndUpdate(promoId, { $inc: { usageCount: 1 } });
  }

  // ---------------------------------------------------------------------------
  // Gift Cards
  // ---------------------------------------------------------------------------

  static async issueGiftCard(opts: {
    code: string;
    balance: number;
    expiresAt: string;
    pinCode?: string;
    customerId?: string;
    purchasedByName?: string;
    userId?: string;
  }) {
    const { code, balance, expiresAt, pinCode, customerId, purchasedByName, userId } = opts;

    const existing = await GiftCard.findOne({ code: code.toUpperCase() });
    if (existing)
      throw new ValidationError(`Gift card code [${code.toUpperCase()}] already exists.`);

    const card = await GiftCard.create({
      code: code.toUpperCase(),
      pinCode,
      initialBalance: Number(balance),
      balance: Number(balance),
      expiresAt: new Date(expiresAt),
      isActive: true,
      issuedToCustomer: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
      purchasedByName,
      transactions: [
        {
          transactionNumber: `GC-ISSUE-${Date.now()}`,
          type: 'ISSUE',
          amount: Number(balance),
          balanceAfter: Number(balance),
          note: 'Initial issue',
          createdAt: new Date(),
        },
      ],
    });

    await AuditLog.create({
      userId,
      action: 'CREATE',
      targetModel: 'GiftCard',
      targetId: card._id.toString(),
      newValues: card.toObject(),
    });

    return card;
  }

  static async topUpGiftCard(opts: {
    code: string;
    amount: number;
    transactionNumber: string;
    userId?: string;
  }) {
    const { code, amount, transactionNumber, userId } = opts;
    const card = await GiftCard.findOne({ code: code.toUpperCase(), isActive: true });
    if (!card) throw new NotFoundError('Gift card not found or inactive.');
    if (new Date() > card.expiresAt) throw new ValidationError('This gift card has expired.');

    const prev = card.toObject();
    card.balance += Number(amount);
    card.transactions.push({
      transactionNumber,
      type: 'TOPUP',
      amount: Number(amount),
      balanceAfter: card.balance,
      createdAt: new Date(),
    });
    await card.save();

    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'GiftCard',
      targetId: card._id.toString(),
      previousValues: prev,
      newValues: card.toObject(),
    });

    return card;
  }

  static async redeemGiftCard(opts: {
    code: string;
    amount: number;
    transactionNumber: string;
    userId?: string;
  }) {
    const { code, amount, transactionNumber, userId } = opts;
    const card = await GiftCard.findOne({ code: code.toUpperCase(), isActive: true });
    if (!card) throw new NotFoundError('Gift card not found or inactive.');
    if (new Date() > card.expiresAt) throw new ValidationError('This gift card has expired.');
    if (card.balance < Number(amount)) throw new ValidationError('Insufficient gift card balance.');

    const prev = card.toObject();
    card.balance -= Number(amount);
    card.transactions.push({
      transactionNumber,
      type: 'REDEEM',
      amount: -Number(amount),
      balanceAfter: card.balance,
      createdAt: new Date(),
    });

    if (card.balance === 0) card.isActive = false;
    await card.save();

    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'GiftCard',
      targetId: card._id.toString(),
      previousValues: prev,
      newValues: card.toObject(),
    });

    return { newBalance: card.balance };
  }

  static async deactivateGiftCard(code: string, userId?: string) {
    const card = await GiftCard.findOne({ code: code.toUpperCase() });
    if (!card) throw new NotFoundError('Gift card not found.');
    const prev = card.toObject();
    card.isActive = false;
    await card.save();
    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'GiftCard',
      targetId: card._id.toString(),
      previousValues: prev,
      newValues: card.toObject(),
    });
    return card;
  }

  // ---------------------------------------------------------------------------
  // Loyalty
  // ---------------------------------------------------------------------------

  static async awardLoyaltyPoints(opts: {
    customerId: string;
    points: number;
    reason: string;
    referenceId?: string;
    userId?: string;
  }) {
    const { customerId, points, reason, referenceId, userId } = opts;
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found.');

    const prev = customer.toObject();
    customer.loyaltyPoints += Math.round(points);
    customer.loyaltyHistory.push({
      date: new Date(),
      points: Math.round(points),
      reason,
      referenceId,
    });
    customer.loyaltyTier = recalculateTier(customer.loyaltyPoints);
    await customer.save();

    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'Customer',
      targetId: customer._id.toString(),
      previousValues: prev,
      newValues: customer.toObject(),
    });

    return { loyaltyPoints: customer.loyaltyPoints, loyaltyTier: customer.loyaltyTier };
  }

  static async deductLoyaltyPoints(opts: {
    customerId: string;
    points: number;
    reason: string;
    referenceId?: string;
    userId?: string;
  }) {
    const { customerId, points, reason, referenceId, userId } = opts;
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found.');
    if (customer.loyaltyPoints < points) {
      throw new ValidationError(
        `Insufficient loyalty points. Available: ${customer.loyaltyPoints}, Requested: ${points}`
      );
    }

    const prev = customer.toObject();
    customer.loyaltyPoints -= Math.round(points);
    customer.loyaltyHistory.push({
      date: new Date(),
      points: -Math.round(points),
      reason,
      referenceId,
    });
    customer.loyaltyTier = recalculateTier(customer.loyaltyPoints);
    await customer.save();

    await AuditLog.create({
      userId,
      action: 'UPDATE',
      targetModel: 'Customer',
      targetId: customer._id.toString(),
      previousValues: prev,
      newValues: customer.toObject(),
    });

    return { loyaltyPoints: customer.loyaltyPoints, loyaltyTier: customer.loyaltyTier };
  }

  /**
   * Compute how many loyalty points a purchase earns based on customer tier.
   */
  static computeEarnedPoints(saleTotal: number, tier: LoyaltyTier): number {
    return Math.floor(saleTotal * POINTS_PER_DOLLAR[tier]);
  }

  /**
   * Return loyalty leaderboard (top customers by points).
   */
  static async getLoyaltyLeaderboard(limit = 20) {
    return Customer.find({ isActive: true })
      .sort({ loyaltyPoints: -1 })
      .limit(limit)
      .select('name email loyaltyPoints loyaltyTier group');
  }
}
