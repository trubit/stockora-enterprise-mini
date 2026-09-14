import { Router } from 'express';
import { OmnichannelCommerceController } from '../controllers/omnichannelCommerce.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const omnichannelCommerceRouter = Router();

// Paystack Webhook (public signature verified)
omnichannelCommerceRouter.post(
  '/webhooks/paystack',
  OmnichannelCommerceController.handlePaystackWebhook
);

omnichannelCommerceRouter.use(authMiddleware);

// Checkout & Transactions
omnichannelCommerceRouter.post(
  '/checkout',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]),
  OmnichannelCommerceController.checkout
);
omnichannelCommerceRouter.get(
  '/transactions',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  OmnichannelCommerceController.listTransactions
);
omnichannelCommerceRouter.get(
  '/transactions/:id',
  rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_READ]),
  OmnichannelCommerceController.getTransaction
);

// Returns & Refunds
omnichannelCommerceRouter.post(
  '/returns',
  rbacMiddleware([SYSTEM_PERMISSIONS.RETURNS_WRITE]),
  OmnichannelCommerceController.processReturn
);

// B2B Customer Credit Exposure
omnichannelCommerceRouter.get(
  '/credit-exposures',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]),
  OmnichannelCommerceController.listCreditExposures
);
omnichannelCommerceRouter.post(
  '/credit-limit',
  rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_WRITE]),
  OmnichannelCommerceController.setCreditLimit
);

// Analytics & AI Forecasting
omnichannelCommerceRouter.get(
  '/analytics',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  OmnichannelCommerceController.getAnalytics
);
omnichannelCommerceRouter.get(
  '/ai-forecast/:productId',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  OmnichannelCommerceController.getAIForecast
);
