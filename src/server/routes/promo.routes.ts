import { Router } from 'express';
import { PromoController } from '../controllers/promo.controller.js';
import { authenticate } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

const router = Router();

// --- Promotions & Coupons ---
router.get(
  '/',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_READ]),
  PromoController.listPromotions
);
router.post(
  '/',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  PromoController.createPromotion
);
router.patch(
  '/:id/toggle',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.PROMOTIONS_WRITE]),
  PromoController.togglePromotion
);
router.post('/validate', authenticate, PromoController.validatePromotion);

// --- Gift Cards ---
router.get(
  '/gift-cards',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.GIFTCARDS_READ]),
  PromoController.listGiftCards
);
router.post(
  '/gift-cards',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.GIFTCARDS_WRITE]),
  PromoController.createGiftCard
);
router.post(
  '/gift-cards/topup',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.GIFTCARDS_WRITE]),
  PromoController.topUpGiftCard
);
router.post('/gift-cards/redeem', authenticate, PromoController.redeemGiftCard);
router.get('/gift-cards/:code/balance', authenticate, PromoController.checkGiftCardBalance);
router.patch(
  '/gift-cards/:code/deactivate',
  authenticate,
  rbacMiddleware([SYSTEM_PERMISSIONS.GIFTCARDS_WRITE]),
  PromoController.deactivateGiftCard
);

// --- Loyalty ---
router.post('/loyalty', authenticate, PromoController.manageLoyalty);
router.get('/loyalty/leaderboard', authenticate, PromoController.getLoyaltyLeaderboard);
router.get(
  '/loyalty/customer/:customerId',
  authenticate,
  PromoController.getCustomerLoyaltyHistory
);

export { router as promoRouter };
