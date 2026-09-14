import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

export const webhookRouter = Router();

// Public webhook endpoints — verified via HMAC cryptographic signatures
webhookRouter.post('/paystack', WebhookController.handlePaystack);
webhookRouter.post('/stripe', WebhookController.handleStripe);
