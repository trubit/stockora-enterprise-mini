import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { IntegrationService } from '../services/integration.service.js';
import { IntegrationAuditLog } from '../models/IntegrationAuditLog.js';
import { ValidationError, AuthorizationError } from '../errors/AppError.js';
import { verifyPaystackSignature } from '../utils/paystack.js';
import { verifyStripeSignature } from '../utils/stripe.js';
import { PaymentController } from './payment.controller.js';
import { config } from '../../config/environment.js';

export class IntegrationController {
  /**
   * GET /api/v1/integrations
   * Returns all integrations and available catalog for the authenticated tenant.
   */
  public static async listIntegrations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId || 'anonymous-preview';
      const integrations = await IntegrationService.getTenantIntegrations(tenantId);
      res.json({ success: true, data: integrations });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/:provider/configure
   * Connects / saves configuration and encrypted credentials for an integration.
   */
  public static async configureIntegration(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }
      const { provider } = req.params;
      const { configuration, credentials, syncSettings } = req.body;

      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      const integration = await IntegrationService.configureIntegration(
        tenantId,
        String(provider) as any,
        { configuration, credentials, syncSettings },
        performedBy
      );

      res.json({
        success: true,
        message: `Integration [${provider}] configured successfully.`,
        data: integration,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/:provider/test
   * Validates connection to the external provider.
   */
  public static async testConnection(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }
      const { provider } = req.params;
      const { configuration, credentials } = req.body;

      const result = await IntegrationService.testConnection(
        tenantId,
        String(provider) as any,
        configuration,
        credentials
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/:provider/disconnect
   * Disables an active integration.
   */
  public static async disconnectIntegration(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }
      const { provider } = req.params;
      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      await IntegrationService.disconnectIntegration(
        tenantId,
        String(provider) as any,
        performedBy
      );

      res.json({
        success: true,
        message: `Integration [${provider}] disconnected successfully.`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/integrations/:provider/sync
   * Triggers an on-demand data sync.
   */
  public static async triggerSync(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }
      const provider = req.params.provider || req.body?.platform?.toLowerCase() || 'quickbooks';
      const entities = req.body?.entities || ['products', 'orders', 'inventory'];
      const performedBy = req.user?.email || req.user?.username || 'Unknown User';

      const result = await IntegrationService.triggerSync(
        tenantId,
        provider,
        entities,
        performedBy
      );

      res.json({
        success: true,
        message: `Synchronization completed for [${provider}].`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/integrations/audit-logs
   * Retrieves integration activity and audit logs for the tenant.
   */
  public static async getAuditLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        return next(new AuthorizationError('Tenant context required.'));
      }

      const logs = await IntegrationAuditLog.find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Inbound Payment Webhooks
   */
  public static async stripeWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return next(new ValidationError('Missing stripe-signature header.'));
    }

    const payload = JSON.stringify(req.body);
    const secret = config.stripeWebhookSecret;

    const isValid = verifyStripeSignature(payload, signature, secret);
    if (!isValid) {
      return next(new ValidationError('Invalid Stripe signature.'));
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
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async paystackWebhook(
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

    const isValid = verifyPaystackSignature(payload, signature, secret);
    if (!isValid) {
      return next(new ValidationError('Invalid webhook signature.'));
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
    } catch (err: unknown) {
      next(err);
    }
  }
}
