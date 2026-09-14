import mongoose from 'mongoose';
import { logger } from '../logger.js';
import { Plan, type BillingInterval } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { BillingTransaction, type BillingTransactionType } from '../models/BillingTransaction.js';
import { BillingInvoice, type BillingInvoiceStatus } from '../models/BillingInvoice.js';
import { BillingAuditLog } from '../models/BillingAuditLog.js';
import { Tenant } from '../models/Tenant.js';
import { PaymentService, type PaymentProvider } from './payment.service.js';
import { SubscriptionService } from './subscription.service.js';
import { NotFoundError, ValidationError, PaymentGatewayError } from '../errors/AppError.js';
import { config } from '../../config/environment.js';
import { redis } from '../database/redis.js';

export interface InitializeSubscriptionPaymentInput {
  tenantId: string;
  planId: string;
  billingInterval?: BillingInterval;
  email: string;
  provider?: PaymentProvider;
  callbackUrl?: string;
  actorId?: string;
}

export interface WebhookEventPayload {
  event: string;
  data: {
    id?: number | string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response?: string;
    customer?: {
      email?: string;
    };
    metadata?: {
      tenantId?: string;
      planId?: string;
      billingInterval?: BillingInterval;
      transactionType?: BillingTransactionType;
      [key: string]: any;
    };
  };
}

export class BillingService {
  /**
   * Generates a safe, sequential-like unique SaaS invoice number.
   */
  public static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await BillingInvoice.countDocuments();
    const sequence = String(count + 1).padStart(5, '0');
    return `INV-SAAS-${year}-${sequence}`;
  }

  /**
   * Initialize a subscription checkout payment via Paystack or Stripe.
   * Note: Amount is strictly calculated server-side with VAT/tax from the Plan and Tenant model.
   */
  public static async initializeSubscriptionPayment(input: InitializeSubscriptionPaymentInput) {
    const plan = mongoose.Types.ObjectId.isValid(input.planId)
      ? await Plan.findById(input.planId)
      : await Plan.findOne({
          $or: [
            { slug: input.planId.toLowerCase().trim() },
            { tier: input.planId.toUpperCase().trim() },
          ],
        });

    if (!plan) {
      throw new NotFoundError(`Subscription plan [${input.planId}] not found.`);
    }

    const tenant = await Tenant.findById(input.tenantId);
    const interval = input.billingInterval || 'MONTHLY';
    let subtotal = plan.price;
    if (interval === 'YEARLY') {
      const discount = (plan.yearlyDiscountPercent || 0) / 100;
      subtotal = Math.round(plan.price * 12 * (1 - discount));
    }

    const provider: PaymentProvider = (input.provider || 'PAYSTACK')
      .toString()
      .toUpperCase() as PaymentProvider;
    if (provider !== 'PAYSTACK' && provider !== 'STRIPE') {
      throw new ValidationError(
        `Unsupported payment provider [${input.provider}]. Allowed providers are PAYSTACK and STRIPE.`
      );
    }

    const currency = plan.currency || (provider === 'STRIPE' ? 'USD' : 'NGN');

    // Tax and VAT are completely removed (0%) across all transactions
    const taxRate = 0;
    const tax = 0;
    const totalAmount = subtotal;
    const reference = `STK-SUB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create a pending BillingTransaction with authoritative financial fields
    const transaction = await BillingTransaction.create({
      tenantId: input.tenantId,
      planId: plan._id,
      planSlug: plan.slug,
      subtotal,
      tax,
      taxRate,
      amount: totalAmount,
      amountPaid: 0,
      currency,
      provider,
      providerReference: reference,
      status: 'PENDING',
      type: 'SUBSCRIPTION_PAYMENT',
      billingReason: `Subscription to ${plan.name} (${interval})`,
      metadata: {
        billingInterval: interval,
        actorId: input.actorId,
        subtotal,
        tax,
        taxRate,
      },
    });

    try {
      const initResult = await PaymentService.initialize(provider, {
        email: input.email,
        amount: totalAmount,
        currency,
        reference,
        callbackUrl: input.callbackUrl || `${config.appUrl}/pricing?payment=callback`,
        metadata: {
          tenantId: input.tenantId,
          planId: plan._id.toString(),
          billingInterval: interval,
          subtotal,
          tax,
          taxRate,
          total: totalAmount,
        },
      });

      await BillingAuditLog.create({
        tenantId: input.tenantId,
        actorId: input.actorId,
        actorEmail: input.email,
        action: 'PAYMENT_INITIATED',
        details: {
          reference,
          subtotal,
          tax,
          taxRate,
          amount: totalAmount,
          currency,
          planSlug: plan.slug,
          interval,
          provider,
        },
      });

      return {
        authorizationUrl: initResult.authorizationUrl,
        clientSecret: initResult.clientSecret,
        reference,
        subtotal,
        tax,
        taxRate,
        amount: totalAmount,
        currency,
        provider,
        transactionId: transaction._id,
      };
    } catch (err: any) {
      transaction.status = 'FAILED';
      transaction.gatewayResponse = err?.message || 'Payment initialization failed at gateway';
      await transaction.save();

      logger.error(`[BillingService] Gateway payment initialization failed: ${err.message}`);
      throw new PaymentGatewayError(
        `Failed to initialize ${provider} checkout: ${err?.message || 'Payment gateway connection error'}`
      );
    }
  }

  /**
   * Verify and activate a subscription payment server-side with strict idempotency and zero-trust verification.
   */
  public static async verifyAndActivatePayment(
    provider: PaymentProvider,
    reference: string,
    tenantId: string
  ) {
    logger.info(`[BillingService] Verifying payment reference ${reference} for tenant ${tenantId}`);

    const existingInvoice = await BillingInvoice.findOne({ transactionReference: reference });
    const existingSubscription = await Subscription.findOne({
      tenantId,
      lastPaymentReference: reference,
    });

    const transaction = await BillingTransaction.findOne({ providerReference: reference });
    if (!transaction) {
      throw new NotFoundError(`Billing transaction with reference ${reference} not found.`);
    }

    if (transaction.tenantId !== tenantId) {
      throw new ValidationError('Access denied: Transaction belongs to a different tenant.');
    }

    if (transaction.status === 'SUCCESS' && existingInvoice) {
      return {
        success: true,
        message: 'Payment already processed and verified.',
        subscription: existingSubscription,
        invoice: existingInvoice,
      };
    }

    const effectiveProvider = (transaction.provider as PaymentProvider) || provider || 'PAYSTACK';

    // Direct gateway verification
    const verification = await PaymentService.verify(
      effectiveProvider,
      reference,
      transaction.amount,
      transaction.currency
    );

    if (!verification.success || verification.status !== 'COMPLETED') {
      transaction.status = 'FAILED';
      transaction.gatewayResponse = verification.gatewayResponse || 'Payment verification failed';
      await transaction.save();

      await BillingAuditLog.create({
        tenantId,
        action: 'PAYMENT_FAILED',
        details: { reference, reason: transaction.gatewayResponse, provider: effectiveProvider },
      });

      return {
        success: false,
        status: 'FAILED',
        message: 'Payment verification failed at gateway.',
      };
    }

    // Atomic update to ensure only one concurrent handler processes the activation
    const updatedTx = await BillingTransaction.findOneAndUpdate(
      { providerReference: reference, status: { $ne: 'SUCCESS' } },
      {
        $set: {
          status: 'SUCCESS',
          paidAt: verification.paidAt || new Date(),
          gatewayResponse: verification.gatewayResponse || 'Approved',
          amountPaid: verification.amount,
        },
      },
      { new: true }
    );

    // If another thread already updated transaction to SUCCESS, return existing invoice & subscription
    if (!updatedTx) {
      const latestInvoice = await BillingInvoice.findOne({ transactionReference: reference });
      const latestSub = await Subscription.findOne({ tenantId });
      return {
        success: true,
        message: 'Payment verified and already processed.',
        subscription: latestSub,
        invoice: latestInvoice,
      };
    }

    // Activate/Renew Subscription
    const plan = await Plan.findById(updatedTx.planId);
    if (!plan) {
      throw new NotFoundError('Associated plan not found during activation.');
    }

    const interval: BillingInterval = updatedTx.metadata?.billingInterval || 'MONTHLY';
    const tenant = await Tenant.findById(tenantId);
    const tenantName = tenant?.name || 'Stockora Tenant';
    const tenantEmail = tenant?.contact?.email || 'billing@tenant.com';

    let subscription = await Subscription.findOne({
      tenantId,
      status: { $in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'INCOMPLETE'] },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const snapshot = SubscriptionService.createPlanSnapshot(plan, interval);
    const recurringPrice = updatedTx.subtotal || plan.price;

    if (subscription) {
      subscription.planId = plan._id as mongoose.Types.ObjectId;
      subscription.planSlug = plan.slug;
      subscription.status = 'ACTIVE';
      subscription.billingInterval = interval;
      subscription.currency = updatedTx.currency;
      subscription.price = recurringPrice;
      subscription.currentPeriodStart = now;
      subscription.currentPeriodEnd = periodEnd;
      subscription.renewalDate = periodEnd;
      subscription.lastPaymentReference = reference;
      subscription.lastPaymentDate = now;
      subscription.failedPaymentCount = 0;
      subscription.cancelAtPeriodEnd = false;
      subscription.provider = effectiveProvider as any;
      subscription.planSnapshot = snapshot;
      await subscription.save();
    } else {
      subscription = await Subscription.create({
        tenantId,
        planId: plan._id,
        planSlug: plan.slug,
        status: 'ACTIVE',
        billingInterval: interval,
        currency: updatedTx.currency,
        price: recurringPrice,
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        renewalDate: periodEnd,
        lastPaymentReference: reference,
        lastPaymentDate: now,
        failedPaymentCount: 0,
        provider: effectiveProvider as any,
        planSnapshot: snapshot,
      });
    }

    const planFeatures = plan.features
      ? (plan.features as any).toObject
        ? (plan.features as any).toObject()
        : plan.features
      : {};
    const planLimits = {
      maxUsers: plan.limits?.users?.count ?? 1,
      maxBranches: plan.limits?.branches?.count ?? 1,
      maxWarehouses: plan.limits?.warehouses?.count ?? 1,
      maxPOSTerminals: plan.limits?.posTerminals?.count ?? 1,
      maxProducts: plan.limits?.products?.count ?? 50,
      maxStorageMb: plan.limits?.storageMb?.count ?? 512,
    };

    // Update Tenant features & limits snapshot
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: {
        subscriptionTier: plan.tier,
        subscriptionReference: subscription._id.toString(),
        features: new Map(Object.entries(planFeatures)),
        limits: planLimits,
      },
    });

    // Invalidate Redis usage and limit caches immediately upon subscription activation
    try {
      const currentPeriod = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      await redis.del(`usage:${tenantId}:${currentPeriod}`);
    } catch {
      // Non-fatal
    }

    // Generate or retrieve SaaS Invoice (Guaranteed single invoice per transaction)
    let invoice = await BillingInvoice.findOne({ transactionReference: reference });
    if (!invoice) {
      const invoiceNumber = await this.generateInvoiceNumber();
      const taxRate = typeof updatedTx.taxRate === 'number' ? updatedTx.taxRate : 0.075;
      const subtotal =
        typeof updatedTx.subtotal === 'number'
          ? updatedTx.subtotal
          : Math.round((updatedTx.amount / (1 + taxRate)) * 100) / 100;
      const tax =
        typeof updatedTx.tax === 'number'
          ? updatedTx.tax
          : Math.round(subtotal * taxRate * 100) / 100;
      const total = updatedTx.amount;
      const amountPaid = verification.amount;
      const invoiceStatus: BillingInvoiceStatus = amountPaid >= total ? 'PAID' : 'OPEN';

      invoice = await BillingInvoice.create({
        invoiceNumber,
        tenantId,
        tenantName,
        tenantEmail,
        subscriptionId: subscription._id,
        planId: plan._id,
        planName: plan.name,
        planSlug: plan.slug,
        billingInterval: interval,
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        subtotal,
        tax,
        taxRate,
        discount: 0,
        total,
        amountPaid,
        amountOutstanding: Math.max(0, total - amountPaid),
        currency: updatedTx.currency,
        status: invoiceStatus,
        issueDate: now,
        dueDate: now,
        paidDate: invoiceStatus === 'PAID' ? now : undefined,
        transactionReference: reference,
        lineItems: [
          {
            description: `${plan.name} Subscription (${interval}) - ${now.toISOString().substring(0, 10)} to ${periodEnd.toISOString().substring(0, 10)}`,
            quantity: 1,
            unitPrice: subtotal,
            amount: subtotal,
          },
        ],
        planSnapshot: snapshot,
      });
    }

    updatedTx.subscriptionId = subscription._id as mongoose.Types.ObjectId;
    await updatedTx.save();

    // Audit Log
    await BillingAuditLog.create({
      tenantId,
      action: 'PAYMENT_CONFIRMED',
      details: {
        reference,
        amount: updatedTx.amount,
        amountPaid: verification.amount,
        subscriptionId: subscription._id,
        invoiceNumber: invoice.invoiceNumber,
        provider: effectiveProvider,
      },
    });

    return {
      success: true,
      subscription,
      invoice,
    };
  }

  /**
   * Idempotent webhook handler for Paystack events.
   */
  public static async processPaystackWebhook(eventPayload: WebhookEventPayload): Promise<{
    processed: boolean;
    reason?: string;
    eventId?: string;
  }> {
    const eventId = String(
      eventPayload.data?.id || eventPayload.data?.reference || `evt-${Date.now()}`
    );
    const eventType = eventPayload.event;
    const reference = eventPayload.data?.reference;

    logger.info(
      `[BillingService] Processing Paystack webhook event [${eventType}] - Ref: ${reference}`
    );

    // Check if event was already processed (Idempotency)
    const existingTx = await BillingTransaction.findOne({ providerEventId: eventId });
    if (existingTx) {
      logger.info(`[BillingService] Webhook event ${eventId} already processed. Skipping.`);
      return { processed: true, reason: 'Duplicate event (Idempotent)', eventId };
    }

    if (eventType === 'charge.success') {
      const transaction = await BillingTransaction.findOne({ providerReference: reference });
      if (transaction) {
        transaction.providerEventId = eventId;
        await transaction.save();

        if (transaction.status !== 'SUCCESS') {
          await this.verifyAndActivatePayment('PAYSTACK', reference, transaction.tenantId);
        }
      }
    } else if (eventType === 'charge.failed') {
      const transaction = await BillingTransaction.findOne({ providerReference: reference });
      if (transaction) {
        transaction.status = 'FAILED';
        transaction.providerEventId = eventId;
        transaction.gatewayResponse = eventPayload.data.gateway_response || 'Charge failed';
        await transaction.save();

        // Increment failed payment count on subscription
        await Subscription.updateMany(
          { tenantId: transaction.tenantId, status: { $in: ['ACTIVE', 'TRIALING'] } },
          {
            $inc: { failedPaymentCount: 1 },
            $set: { status: 'PAST_DUE' },
          }
        );

        await BillingAuditLog.create({
          tenantId: transaction.tenantId,
          action: 'PAYMENT_FAILED',
          details: {
            reference,
            reason: transaction.gatewayResponse,
            webhookEvent: eventType,
            provider: 'PAYSTACK',
          },
        });
      }
    }

    return { processed: true, eventId };
  }

  /**
   * Idempotent webhook handler for Stripe events.
   */
  public static async processStripeWebhook(eventPayload: any): Promise<{
    processed: boolean;
    reason?: string;
    eventId?: string;
  }> {
    const eventId = String(eventPayload?.id || `evt-${Date.now()}`);
    const eventType = eventPayload?.type;
    const paymentIntent = eventPayload?.data?.object;
    const reference = paymentIntent?.metadata?.reference || paymentIntent?.id;

    logger.info(
      `[BillingService] Processing Stripe webhook event [${eventType}] - Ref: ${reference}`
    );

    // Check if event was already processed (Idempotency)
    const existingTx = await BillingTransaction.findOne({ providerEventId: eventId });
    if (existingTx) {
      logger.info(`[BillingService] Stripe webhook event ${eventId} already processed. Skipping.`);
      return { processed: true, reason: 'Duplicate event (Idempotent)', eventId };
    }

    if (eventType === 'payment_intent.succeeded') {
      const transaction = await BillingTransaction.findOne({ providerReference: reference });
      if (transaction) {
        transaction.providerEventId = eventId;
        await transaction.save();

        if (transaction.status !== 'SUCCESS') {
          await this.verifyAndActivatePayment('STRIPE', reference, transaction.tenantId);
        }
      }
    } else if (eventType === 'payment_intent.payment_failed') {
      const transaction = await BillingTransaction.findOne({ providerReference: reference });
      if (transaction) {
        transaction.status = 'FAILED';
        transaction.providerEventId = eventId;
        transaction.gatewayResponse =
          paymentIntent?.last_payment_error?.message || 'Payment failed';
        await transaction.save();

        await Subscription.updateMany(
          { tenantId: transaction.tenantId, status: { $in: ['ACTIVE', 'TRIALING'] } },
          {
            $inc: { failedPaymentCount: 1 },
            $set: { status: 'PAST_DUE' },
          }
        );

        await BillingAuditLog.create({
          tenantId: transaction.tenantId,
          action: 'PAYMENT_FAILED',
          details: {
            reference,
            reason: transaction.gatewayResponse,
            webhookEvent: eventType,
            provider: 'STRIPE',
          },
        });
      }
    }

    return { processed: true, eventId };
  }

  /**
   * Process a refund for a billing transaction.
   */
  public static async processRefund(
    tenantId: string,
    transactionId: string,
    amount?: number,
    reason?: string,
    actorId?: string
  ) {
    const tx = await BillingTransaction.findById(transactionId);
    if (!tx || tx.tenantId !== tenantId) {
      throw new Error('Transaction not found or unauthorized.');
    }

    if (tx.status !== 'SUCCESS') {
      throw new Error('Only successful transactions can be refunded.');
    }

    const refundAmount = amount || tx.amount;
    const refundResult = await PaymentService.refund(
      tx.provider as PaymentProvider,
      tx.providerReference,
      refundAmount
    );

    if (!refundResult.success) {
      throw new Error('Refund failed at payment gateway.');
    }

    tx.status = 'REFUNDED';
    tx.refundId = refundResult.refundId;
    tx.refundAmount = refundAmount;
    tx.refundReason = reason || 'Customer requested refund';
    await tx.save();

    // Update associated SaaS invoice status
    await BillingInvoice.updateOne(
      { transactionReference: tx.providerReference },
      { $set: { status: 'REFUNDED' } }
    );

    await BillingAuditLog.create({
      tenantId,
      actorId,
      action: 'REFUND_ISSUED',
      details: {
        transactionId: tx._id,
        reference: tx.providerReference,
        amount: refundAmount,
        refundId: refundResult.refundId,
        reason,
      },
    });

    return {
      success: true,
      refundId: refundResult.refundId,
      amount: refundAmount,
    };
  }

  /**
   * Auto-seed default SaaS plans if database has zero plans.
   */
  public static async ensureDefaultPlans(): Promise<void> {
    const singleEnterprisePlan = {
      name: 'Stockora Enterprise Plan',
      slug: 'enterprise',
      tier: 'ENTERPRISE' as const,
      description:
        'Complete all-in-one unified enterprise inventory, multi-branch POS, warehouse logistics, CRM, and analytics suite.',
      price: 5000,
      currency: 'NGN',
      billingInterval: 'MONTHLY' as const,
      yearlyDiscountPercent: 20,
      sortOrder: 1,
      status: 'ACTIVE' as const,
      isPopular: true,
      features: {
        pos: true,
        inventory: true,
        advancedInventory: true,
        crm: true,
        loyalty: true,
        aiAssistant: true,
        advancedAnalytics: true,
        multiBranch: true,
        warehouseManagement: true,
        employeeManagement: true,
        reports: true,
        apiAccess: true,
        integrations: true,
        automation: true,
        customBranding: true,
        prioritySupport: true,
      },
      limits: {
        users: { count: 100, unlimited: true },
        branches: { count: 50, unlimited: true },
        warehouses: { count: 50, unlimited: true },
        posTerminals: { count: 50, unlimited: true },
        products: { count: 100000, unlimited: true },
        customers: { count: 100000, unlimited: true },
        orders: { count: 100000, unlimited: true },
        storageMb: { count: 51200, unlimited: true },
        apiRequestsMonthly: { count: 100000, unlimited: true },
        aiRequestsMonthly: { count: 5000, unlimited: true },
        automations: { count: 100, unlimited: true },
      },
      trialConfiguration: {
        trialDays: 14,
        isTrialEnabled: true,
      },
    };

    // In test environment, preserve test-seeded plans
    if (process.env.NODE_ENV === 'test') {
      const existingPlans = await Plan.countDocuments();
      if (existingPlans === 0) {
        await Plan.create(singleEnterprisePlan);
      }
      return;
    }

    // Remove all other plans so only the single ₦5,000 Enterprise plan is active
    await Plan.deleteMany({ slug: { $ne: 'enterprise' } });
    await Plan.findOneAndUpdate(
      { slug: 'enterprise' },
      { $set: singleEnterprisePlan },
      { upsert: true, new: true }
    );
    logger.info('[Billing] Initialized single ₦5,000 Enterprise SaaS subscription plan.');
  }
}
