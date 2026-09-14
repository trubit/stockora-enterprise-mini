import { Router } from 'express';
import { CurrencyController } from '../controllers/currency.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/rates', authenticate, CurrencyController.listRates);
router.post('/rates', authenticate, CurrencyController.updateRate);
router.get('/tax-config', authenticate, CurrencyController.getTaxConfig);
router.post('/tax-config', authenticate, CurrencyController.updateTaxConfig);

export { router as currencyRouter };
