import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Promotion } from '../models/Promotion.js';
import { GiftCard } from '../models/GiftCard.js';
import { Customer } from '../models/Customer.js';
import { AuditLog } from '../models/AuditLog.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { PromoService } from '../services/promo.service.js';

export class PromoController {
  // -------------------------------------------------------------------------
  // Promotions & Coupons
  // -------------------------------------------------------------------------

  public static async listPromotions(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const promos = await Promotion.find().sort({ createdAt: -1 });
      res.json(promos);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createPromotion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const {
      code,
      type,
      value,
      minPurchase,
      usageLimit,
      startDate,
      expiresAt,
      description,
      applicableCategories,
      applicableBrands,
      applicableProducts,
      customerSpecific,
      allowedCustomers,
    } = req.body;

    if (!code || !type || value === undefined || !expiresAt) {
      return next(new ValidationError('Code, type, value, and expiration date are required.'));
    }

    try {
      const existing = await Promotion.findOne({ code: code.toUpperCase() });
      if (existing) {
        return next(new ValidationError(`Promotion code [${code.toUpperCase()}] already exists.`));
      }

      const promo = await Promotion.create({
        code: code.toUpperCase(),
        type,
        value: Number(value),
        minPurchase: Number(minPurchase || 0),
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        expiresAt: new Date(expiresAt),
        description,
        applicableCategories: applicableCategories || [],
        applicableBrands: applicableBrands || [],
        applicableProducts: applicableProducts || [],
        customerSpecific: Boolean(customerSpecific),
        allowedCustomers: allowedCustomers || [],
        usageCount: 0,
        isActive: true,
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'Promotion',
        targetId: promo._id.toString(),
        newValues: promo.toObject(),
      });

      res.status(201).json(promo);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async togglePromotion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    try {
      const promo = await Promotion.findById(id);
      if (!promo) return next(new NotFoundError('Promotion not found.'));
      const prev = promo.toObject();
      promo.isActive = !promo.isActive;
      await promo.save();
      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'Promotion',
        targetId: promo._id.toString(),
        previousValues: prev,
        newValues: promo.toObject(),
      });
      res.json(promo);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async validatePromotion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { code, purchaseAmount, cartItems, customerId } = req.body;
    if (!code || purchaseAmount === undefined) {
      return next(new ValidationError('Code and purchase amount are required.'));
    }

    try {
      const result = await PromoService.validateAndCompute({
        code,
        purchaseAmount: Number(purchaseAmount),
        cartItems,
        customerId,
      });
      res.json(result);
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Gift Cards
  // -------------------------------------------------------------------------

  public static async listGiftCards(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const cards = await GiftCard.find()
        .sort({ createdAt: -1 })
        .populate('issuedToCustomer', 'name email code');
      res.json(cards);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createGiftCard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { code, balance, expiresAt, pinCode, customerId, purchasedByName } = req.body;
    if (!code || balance === undefined || !expiresAt) {
      return next(new ValidationError('Code, balance, and expiration date are required.'));
    }

    try {
      const card = await PromoService.issueGiftCard({
        code,
        balance: Number(balance),
        expiresAt,
        pinCode,
        customerId,
        purchasedByName,
        userId: req.user?.id,
      });
      res.status(201).json(card);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async topUpGiftCard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { code, amount, transactionNumber } = req.body;
    if (!code || amount === undefined || !transactionNumber) {
      return next(new ValidationError('Code, amount, and transaction number are required.'));
    }

    try {
      const card = await PromoService.topUpGiftCard({
        code,
        amount: Number(amount),
        transactionNumber,
        userId: req.user?.id,
      });
      res.json(card);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async checkGiftCardBalance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const code = String(req.params.code);
    try {
      const card = await GiftCard.findOne({ code: code.toUpperCase() });
      if (!card) return next(new NotFoundError('Gift card not found.'));
      if (new Date() > card.expiresAt)
        return next(new ValidationError('This gift card has expired.'));
      res.json({
        code: card.code,
        balance: card.balance,
        expiresAt: card.expiresAt,
        isActive: card.isActive,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async redeemGiftCard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { code, amount, transactionNumber } = req.body;
    if (!code || amount === undefined || !transactionNumber) {
      return next(new ValidationError('Code, amount, and transaction number are required.'));
    }

    try {
      const result = await PromoService.redeemGiftCard({
        code,
        amount: Number(amount),
        transactionNumber,
        userId: req.user?.id,
      });
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async deactivateGiftCard(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const code = String(req.params.code);
    try {
      const card = await PromoService.deactivateGiftCard(code, req.user?.id);
      res.json(card);
    } catch (err: unknown) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Loyalty Program
  // -------------------------------------------------------------------------

  public static async manageLoyalty(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { customerId, points, type, reason, referenceId } = req.body;
    if (!customerId || points === undefined || !type) {
      return next(new ValidationError('Customer ID, points, and type (ADD|DEDUCT) are required.'));
    }

    try {
      const result =
        type === 'ADD'
          ? await PromoService.awardLoyaltyPoints({
              customerId,
              points: Number(points),
              reason: reason || 'Manual adjustment',
              referenceId,
              userId: req.user?.id,
            })
          : await PromoService.deductLoyaltyPoints({
              customerId,
              points: Number(points),
              reason: reason || 'Manual redemption',
              referenceId,
              userId: req.user?.id,
            });

      res.json({ customerId, ...result });
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getLoyaltyLeaderboard(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const leaderboard = await PromoService.getLoyaltyLeaderboard(20);
      res.json(leaderboard);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async getCustomerLoyaltyHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { customerId } = req.params;
    try {
      const customer = await Customer.findById(customerId).select(
        'name email loyaltyPoints loyaltyTier loyaltyHistory'
      );
      if (!customer) return next(new NotFoundError('Customer not found.'));
      res.json(customer);
    } catch (err: unknown) {
      next(err);
    }
  }
}
