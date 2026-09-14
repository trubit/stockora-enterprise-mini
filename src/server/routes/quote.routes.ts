import { Router } from 'express';
import { QuoteController } from '../controllers/quote.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAnyPermission } from '../middleware/rbac.js';
import { SYSTEM_PERMISSIONS } from '../../shared/constants.js';

export const quoteRouter = Router();

quoteRouter.use(authMiddleware);

quoteRouter.get(
  '/',
  requireAnyPermission([SYSTEM_PERMISSIONS.TRANSACTIONS_READ, SYSTEM_PERMISSIONS.PRODUCTS_READ]),
  QuoteController.listQuotes
);
quoteRouter.post(
  '/',
  requireAnyPermission([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE, SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  QuoteController.createQuote
);
quoteRouter.put(
  '/:id/accept',
  requireAnyPermission([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE, SYSTEM_PERMISSIONS.PRODUCTS_WRITE]),
  QuoteController.acceptQuote
);
