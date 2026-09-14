import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Plan, type IPlan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { BillingTransaction } from '../models/BillingTransaction.js';
import { BillingInvoice } from '../models/BillingInvoice.js';
import { BillingAuditLog } from '../models/BillingAuditLog.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { BillingService } from '../services/billing.service.js';
import { UsageMeteringService } from '../services/usageMetering.service.js';
import { verifyPaystackSignature } from '../utils/paystack.js';
import { verifyStripeSignature } from '../utils/stripe.js';
import { config } from '../../config/environment.js';
import { logger } from '../logger.js';
import { AuthorizationError, NotFoundError } from '../errors/AppError.js';

export class BillingController {
  /**
   * GET /billing/plans
   * Retrieve active public plans
   */
  public static async getPublicPlans(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await BillingService.ensureDefaultPlans();
      const plans = await Plan.find({ status: 'ACTIVE' }).sort({ sortOrder: 1, price: 1 }).lean();
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/plans/:id
   */
  public static async getPlanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await Plan.findById(req.params.id).lean();
      if (!plan) {
        throw new NotFoundError('Plan not found');
      }
      res.json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/subscription
   * Get active subscription for current tenant
   */
  public static async getSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const subscription = await SubscriptionService.getTenantSubscription(tenantId);
      if (!subscription) {
        const freePlan = await Plan.findOne({ tier: 'FREE', status: 'ACTIVE' });
        const snapshot = freePlan
          ? SubscriptionService.createPlanSnapshot(freePlan, 'MONTHLY')
          : {
              name: 'Free Starter',
              slug: 'free',
              tier: 'FREE',
              price: 0,
              currency: 'NGN',
              billingInterval: 'MONTHLY' as const,
              features: { pos: true, inventory: true },
              limits: {
                users: { count: 1, unlimited: false },
                products: { count: 50, unlimited: false },
              },
              version: 1,
            };

        res.json({
          success: true,
          data: {
            tenantId,
            status: 'FREE',
            planSlug: freePlan?.slug || 'free',
            planSnapshot: snapshot,
          },
        });
        return;
      }
      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/entitlements
   * Get active plan features and resource limits for current tenant
   */
  public static async getEntitlements(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const entitlements = await SubscriptionService.getTenantEntitlements(tenantId);
      res.json({ success: true, data: entitlements });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/subscription/initialize
   * Initialize Paystack or Stripe checkout for a plan
   */
  public static async initializePayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId?.toString();
      if (!tenantId) {
        throw new AuthorizationError('Tenant context is required to purchase a subscription.');
      }
      const { planId, billingInterval, callbackUrl, provider } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'planId is required' });
        return;
      }

      const email = req.user?.email || req.tenant?.contact?.email || 'customer@example.com';

      const result = await BillingService.initializeSubscriptionPayment({
        tenantId,
        planId,
        billingInterval: billingInterval || 'MONTHLY',
        email,
        provider,
        callbackUrl,
        actorId: req.user?.id,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/subscription/verify
   * Verify completed payment and activate subscription
   */
  public static async verifyPayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { reference, provider } = req.body;

      if (!reference) {
        res.status(400).json({ error: 'Payment reference is required' });
        return;
      }

      const result = await BillingService.verifyAndActivatePayment(
        provider || 'PAYSTACK',
        reference,
        tenantId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/subscription/change-plan
   * Upgrade or Downgrade plan
   */
  public static async changePlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { newPlanId, billingInterval } = req.body;

      if (!newPlanId) {
        res.status(400).json({ error: 'newPlanId is required' });
        return;
      }

      const targetPlan = await Plan.findById(newPlanId);
      if (!targetPlan) {
        throw new NotFoundError('Target plan not found');
      }

      // Disallow free upgrades to paid plans via this endpoint
      if (targetPlan.tier !== 'FREE' && targetPlan.price > 0) {
        res.status(402).json({
          success: false,
          error: 'PAYMENT_REQUIRED',
          requiresPayment: true,
          message: `Upgrading to [${targetPlan.name}] requires payment. Please initialize checkout.`,
          upgradeUrl: '/pricing',
        });
        return;
      }

      const result = await SubscriptionService.changePlan({
        tenantId,
        newPlanId,
        billingInterval,
        actorId: req.user?.id,
        actorEmail: req.user?.email,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/subscription/cancel
   */
  public static async cancelSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { immediately, reason } = req.body;

      const sub = await SubscriptionService.cancelSubscription(
        tenantId,
        Boolean(immediately),
        reason,
        req.user?.id,
        req.user?.email
      );

      res.json({ success: true, data: sub });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/subscription/reactivate
   */
  public static async reactivateSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const sub = await SubscriptionService.reactivateSubscription(
        tenantId,
        req.user?.id,
        req.user?.email
      );
      res.json({ success: true, data: sub });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/transactions
   */
  public static async getTransactions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const transactions = await BillingTransaction.find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/invoices
   */
  public static async getInvoices(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const invoices = await BillingInvoice.find({ tenantId })
        .sort({ issueDate: -1 })
        .limit(100)
        .lean();
      res.json({ success: true, data: invoices });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/invoices/:id
   * Tenant isolation protected invoice detail
   */
  public static async getInvoiceById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const invoice = await BillingInvoice.findById(req.params.id).lean();

      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }

      // Security IDOR check: Non-platform admins can only see invoices of their own tenant
      const isSuperAdmin = Boolean(
        req.user?.isPlatformAdmin || req.user?.roleName === 'Super Administrator'
      );
      if (invoice.tenantId !== tenantId && !isSuperAdmin) {
        throw new AuthorizationError(
          'Access denied: You do not have permission to view this invoice.'
        );
      }

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/usage
   */
  public static async getUsage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const usage = await UsageMeteringService.getTenantUsageSummary(tenantId);
      res.json({ success: true, data: usage });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/limits
   */
  public static async getLimits(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const limits = await UsageMeteringService.getTenantLimits(tenantId);
      res.json({ success: true, data: limits });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/usage/reconcile
   */
  public static async reconcileUsage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const metrics = await UsageMeteringService.reconcileTenantUsage(tenantId);
      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/webhooks/paystack
   * Paystack webhook handler with HMAC SHA512 signature verification
   */
  public static async handlePaystackWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = (req.headers['x-paystack-signature'] as string) || '';
      const webhookSecret = config.paystackSecretKey || process.env.PAYSTACK_WEBHOOK_SECRET || '';

      // In production/sandbox, verify signature
      const rawPayload = JSON.stringify(req.body);
      const isValid = verifyPaystackSignature(rawPayload, signature, webhookSecret);

      if (!isValid && process.env.NODE_ENV === 'production') {
        logger.warn('[BillingController] Paystack webhook signature mismatch');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }

      const result = await BillingService.processPaystackWebhook(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/webhooks/stripe
   * Stripe webhook handler with HMAC SHA256 signature verification
   */
  public static async handleStripeWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = (req.headers['stripe-signature'] as string) || '';
      const webhookSecret = config.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';

      const rawPayload = JSON.stringify(req.body);
      const isValid = verifyStripeSignature(rawPayload, signature, webhookSecret);

      if (!isValid && process.env.NODE_ENV === 'production') {
        logger.warn('[BillingController] Stripe webhook signature mismatch');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }

      const result = await BillingService.processStripeWebhook(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // ---- Platform Admin Endpoints ---------------------------------------------

  /**
   * GET /billing/admin/plans
   */
  public static async adminListPlans(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await BillingService.ensureDefaultPlans();
      const plans = await Plan.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /billing/admin/plans
   */
  public static async adminCreatePlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const plan = await Plan.create(req.body);
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /billing/admin/plans/:id
   */
  public static async adminUpdatePlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const plan = await Plan.findByIdAndUpdate(
        req.params.id,
        { $set: req.body, $inc: { version: 1 } },
        { new: true, runValidators: true }
      );
      if (!plan) {
        throw new NotFoundError('Plan not found');
      }
      res.json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/admin/subscriptions
   */
  public static async adminListSubscriptions(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscriptions = await Subscription.find().sort({ createdAt: -1 }).limit(100).lean();
      res.json({ success: true, data: subscriptions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /billing/admin/metrics
   */
  public static async adminGetMetrics(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const [totalActive, totalTrialing, totalCancelled, activeSubs] = await Promise.all([
        Subscription.countDocuments({ status: 'ACTIVE' }),
        Subscription.countDocuments({ status: 'TRIALING' }),
        Subscription.countDocuments({ status: 'CANCELLED' }),
        Subscription.find({ status: 'ACTIVE' }).select('price billingInterval currency').lean(),
      ]);

      let mrr = 0;
      for (const sub of activeSubs) {
        if (sub.billingInterval === 'YEARLY') {
          mrr += Math.round((sub.price || 0) / 12);
        } else {
          mrr += sub.price || 0;
        }
      }

      const arr = mrr * 12;

      res.json({
        success: true,
        data: {
          activeSubscriptions: totalActive,
          trialingSubscriptions: totalTrialing,
          cancelledSubscriptions: totalCancelled,
          mrr,
          arr,
          currency: 'NGN',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
