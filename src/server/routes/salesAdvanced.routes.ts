import { Router } from 'express';
import { SalesController } from '../controllers/sales.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { rbacMiddleware } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const salesAdvancedRouter = Router();

// Public webhook route (handled by secret signature verification)
salesAdvancedRouter.post('/webhooks/:channelCode', SalesController.handleExternalWebhook);

salesAdvancedRouter.use(authMiddleware);

// Channels
salesAdvancedRouter.get(
  '/channels',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.listChannels
);
salesAdvancedRouter.post(
  '/channels',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.createChannel
);

// Pricing & Cart Evaluation
salesAdvancedRouter.get(
  '/price-lists',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.listPriceLists
);
salesAdvancedRouter.post(
  '/price-lists',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.createPriceList
);
salesAdvancedRouter.post(
  '/price-lists/items',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.addPriceListItem
);
salesAdvancedRouter.post('/evaluate-cart', SalesController.evaluateCart);

// Quotes
salesAdvancedRouter.get(
  '/quotes',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.listQuotes
);
salesAdvancedRouter.post(
  '/quotes',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.createQuote
);
salesAdvancedRouter.post(
  '/quotes/:id/convert',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.convertQuoteToOrder
);

// Omnichannel Orders & Holds
salesAdvancedRouter.get(
  '/orders',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.listOrders
);
salesAdvancedRouter.post(
  '/orders',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.createOrder
);
salesAdvancedRouter.post(
  '/holds/:holdId/release',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.releaseHold
);
salesAdvancedRouter.post(
  '/orders/:id/cancel',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.cancelOrder
);

// Territories & Assignments
salesAdvancedRouter.get(
  '/territories',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.listTerritories
);
salesAdvancedRouter.post(
  '/territories',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  SalesController.createTerritory
);

// Analytics
salesAdvancedRouter.get(
  '/analytics',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.getAnalytics
);
salesAdvancedRouter.get(
  '/analytics/overview',
  rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  SalesController.getAnalytics
);
