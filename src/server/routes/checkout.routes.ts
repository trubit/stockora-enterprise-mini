import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Secure payment checkout lifecycle endpoints
router.post('/initialize', authenticate, PaymentController.initializeCheckout);
router.all('/verify', PaymentController.verifyCheckout); // supports GET/POST verify parameters
router.post('/refund', authenticate, PaymentController.refundCheckout);
router.get('/history', authenticate, PaymentController.getTransactionHistory);
router.get('/receipts/:transactionNumber', PaymentController.getPaymentReceipt);

export { router as checkoutRouter };
