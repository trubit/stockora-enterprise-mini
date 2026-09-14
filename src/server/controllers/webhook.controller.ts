import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { WebhookService } from '../services/webhook.service.js';
import { AuthorizationError, ValidationError } from '../errors/AppError.js';
import { verifyPaystackSignature } from '../utils/paystack.js';
import { verifyStripeSignature } from '../utils/stripe.js';
import { PaymentController } from './payment.controller.js';
import { config } from '../../config/environment.js';

export class WebhookController {
  /**
   * POST /api/v1/integrations/webhooks
   * Creates a new outbound webhook subscription for the tenant.
   */
  public static async createSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { name, events, endpointUrl, secret, headers } = req.body;
      const createdBy = req.user?.email || req.user?.username || 'Unknown User';

      const result = await WebhookService.createSubscription(
        tenantId,
        { name, events, endpointUrl, secret, headers },
        createdBy
      );

      res.status(201).json({
        success: true,
        message: 'Webhook subscription created. Copy signing secret for signature verification.',
        data: {
          subscription: result.subscription,
          secret: result.secret,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/webhooks
   * Lists all webhook subscriptions for the tenant.
   */
  public static async listSubscriptions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const subs = await WebhookService.listSubscriptions(tenantId);
      res.json({ success: true, data: subs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/integrations/webhooks/:subscriptionId
   * Deletes a webhook subscription.
   */
  public static async deleteSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { subscriptionId } = req.params;
      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      await WebhookService.deleteSubscription(tenantId, String(subscriptionId), performedBy);
      res.json({ success: true, message: 'Webhook subscription deleted.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/webhooks/logs
   * Retrieves recent webhook delivery logs.
   */
  public static async getDeliveryLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const logs = await WebhookService.getDeliveryLogs(tenantId);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/webhooks/logs/:logId/replay
   * Replays a previous webhook delivery safely.
   */
  public static async replayDelivery(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const { logId } = req.params;
      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      const result = await WebhookService.replayDelivery(tenantId, String(logId), performedBy);
      res.json({ success: true, message: 'Webhook delivery replayed.', data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Inbound Payment Gateway Webhook Handlers
   */
  public static async handlePaystack(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      return next(new ValidationError('Missing x-paystack-signature.'));
    }

    const payload = JSON.stringify(req.body);
    const secret = config.paystackWebhookSecret;
    if (!verifyPaystackSignature(payload, signature, secret)) {
      return next(new ValidationError('Invalid Paystack webhook signature.'));
    }

    try {
      const { event, data } = req.body;
      if (event === 'charge.success') {
        const reference = data?.reference;
        if (reference) {
          await PaymentController.verifyAndProcessPayment('PAYSTACK', reference);
        }
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  }

  public static async handleStripe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return next(new ValidationError('Missing stripe-signature header.'));
    }

    const payload = JSON.stringify(req.body);
    const secret = config.stripeWebhookSecret;
    if (!verifyStripeSignature(payload, signature, secret)) {
      return next(new ValidationError('Invalid Stripe webhook signature.'));
    }

    try {
      const { type, data } = req.body;
      if (type === 'payment_intent.succeeded') {
        const object = data?.object;
        const reference = object?.metadata?.reference || object?.id;
        if (reference) {
          await PaymentController.verifyAndProcessPayment('STRIPE', reference);
        }
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  }
}
