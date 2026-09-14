import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SalesTransaction } from '../models/SalesTransaction.js';
import { CustomerCreditExposure } from '../models/CustomerCreditExposure.js';
import { OmnichannelSalesService } from '../services/omnichannelSales.service.js';
import { PaymentGatewayAdvancedService } from '../services/paymentGatewayAdvanced.service.js';
import { CommerceAnalyticsAIService } from '../services/commerceAnalyticsAI.service.js';
import { config } from '../../config/environment.js';

function buildTenantQuery(user: any): any {
  const query: any = {};
  if (user?.tenantId) {
    query.tenantId = user.tenantId;
  }
  if (user?.companyId && mongoose.isValidObjectId(user.companyId)) {
    query.companyId = new mongoose.Types.ObjectId(user.companyId);
  }
  return query;
}

export class OmnichannelCommerceController {
  // Checkout Execution
  public static async checkout(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const tx = await OmnichannelSalesService.validateAndExecuteCheckout({
        ...req.body,
        tenantId: user?.tenantId,
        companyId: user?.companyId,
        cashierId: user?.id,
        cashierName: user?.username,
      });
      res.status(201).json(tx);
    } catch (err) {
      next(err);
    }
  }

  // Transactions List
  public static async listTransactions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const transactions = await SalesTransaction.find(buildTenantQuery(user))
        .sort({ createdAt: -1 })
        .lean();
      res.json(transactions);
    } catch (err) {
      next(err);
    }
  }

  public static async getTransaction(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const tx = await SalesTransaction.findById(id).lean();
      if (!tx) {
        res.status(404).json({ message: 'Transaction not found' });
        return;
      }
      res.json(tx);
    } catch (err) {
      next(err);
    }
  }

  // Sales Returns & Refunds
  public static async processReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const result = await OmnichannelSalesService.processSalesReturn({
        ...req.body,
        processedBy: user?.id,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Customer Credit Exposure
  public static async listCreditExposures(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const exposures = await CustomerCreditExposure.find(buildTenantQuery(user))
        .populate('customerId')
        .lean();
      res.json(exposures);
    } catch (err) {
      next(err);
    }
  }

  public static async setCreditLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const exposure = await CustomerCreditExposure.findOneAndUpdate(
        { customerId: req.body.customerId },
        {
          ...req.body,
          tenantId: user?.tenantId || 'default',
          availableCredit: Number(req.body.creditLimit) - Number(req.body.currentExposure || 0),
          reviewedBy: user?.id,
          lastReviewDate: new Date(),
        },
        { upsert: true, new: true }
      );
      res.status(200).json(exposure);
    } catch (err) {
      next(err);
    }
  }

  // Paystack Webhook Handler
  public static async handlePaystackWebhook(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      const secret =
        config.paystackWebhookSecret || config.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY;
      if (!secret) {
        res.status(500).json({ message: 'Paystack webhook secret not configured' });
        return;
      }
      const rawBody = JSON.stringify(req.body);

      const isValid = PaymentGatewayAdvancedService.verifyPaystackSignature(
        signature,
        rawBody,
        secret
      );
      if (!isValid) {
        res.status(401).json({ message: 'Invalid Paystack webhook signature' });
        return;
      }

      const result = await PaymentGatewayAdvancedService.processPaystackWebhook(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // Analytics & AI
  public static async getAnalytics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user as any;
      const [channels, payments] = await Promise.all([
        CommerceAnalyticsAIService.getChannelSalesSummary(user?.tenantId),
        CommerceAnalyticsAIService.getPaymentMixAnalytics(user?.tenantId),
      ]);
      res.json({ channels, payments });
    } catch (err) {
      next(err);
    }
  }

  public static async getAIForecast(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const productId = Array.isArray(req.params.productId)
        ? req.params.productId[0]
        : req.params.productId || '';
      const forecast = await CommerceAnalyticsAIService.generateAISalesForecast(productId);
      res.json(forecast);
    } catch (err) {
      next(err);
    }
  }
}
