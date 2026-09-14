import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Transaction, type ITransaction } from '../models/Transaction.js';
import { Product } from '../models/Product.js';
import { Receipt } from '../models/Receipt.js';
import { PaymentService, type PaymentProvider } from '../services/payment.service.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../errors/AppError.js';
import { logger } from '../logger.js';
import { Branch } from '../models/Branch.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SocketManager } from '../sockets/manager.js';
import { redis } from '../database/redis.js';

const io = SocketManager.getInstance();

// Schemas for checkout validation
const initializeCheckoutSchema = z.object({
  email: z.string().email('Invalid customer email address'),
  provider: z.enum(['PAYSTACK', 'STRIPE']),
  paymentMethod: z.enum(['CARD', 'MOBILE', 'CASH', 'SPLIT']),
  items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        sku: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative().optional(),
        discount: z.number().nonnegative().default(0),
        total: z.number().nonnegative().optional(),
      })
    )
    .min(1, 'At least one item is required in the cart'),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  currency: z.string().default('USD'),
});

const verifyCheckoutSchema = z.object({
  provider: z.enum(['PAYSTACK', 'STRIPE']),
  reference: z.string().min(3, 'Reference is required'),
});

const refundCheckoutSchema = z.object({
  reference: z.string().min(3, 'Reference is required'),
  amount: z.number().positive('Refund amount must be positive'),
  reason: z.string().optional(),
});

export class PaymentController {
  /**
   * Safe transaction checkout initialization.
   * Calculates prices strictly from database records to prevent client-side price tampering.
   */
  public static async initializeCheckout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const payload = initializeCheckoutSchema.parse(req.body);

      // Server-side authoritative price & inventory calculation
      let calculatedSubtotal = 0;
      const verifiedItems = [];

      for (const item of payload.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new ValidationError(
            `Product ${item.productName} (ID: ${item.productId}) not found in catalog.`
          );
        }
        if (product.quantity < item.quantity) {
          throw new ValidationError(
            `Insufficient inventory for ${item.productName}. Available: ${product.quantity}, Requested: ${item.quantity}`
          );
        }

        const authoritativePrice = product.price || product.sellingPrice || 0;
        const itemDiscount = item.discount || 0;
        const itemTotal = Math.max(0, authoritativePrice * item.quantity - itemDiscount);

        calculatedSubtotal += itemTotal;
        verifiedItems.push({
          productId: product._id.toString(),
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          price: authoritativePrice,
          discount: itemDiscount,
          total: itemTotal,
        });
      }

      const calculatedTotal = Math.max(0, calculatedSubtotal - payload.discount + payload.tax);

      // Generate a unique reference number
      const reference = `TX-PAY-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      // Dynamically resolve cashier and branch information
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      const cashierId = user?.id || 'cashier-pos';
      const cashierName = user?.username || 'POS Cashier';

      const activeBranch = await Branch.findOne({ isActive: true });
      const branchId = activeBranch?._id?.toString() || 'branch-default';
      const branchName = activeBranch?.name || 'Primary Branch';

      // Create standard transaction marked as PENDING
      const transaction = await Transaction.create({
        transactionNumber: reference,
        type: 'SALE',
        status: 'PENDING',
        items: verifiedItems,
        subtotal: calculatedSubtotal,
        tax: payload.tax,
        discount: payload.discount,
        total: calculatedTotal,
        paymentMethod: payload.paymentMethod,
        currencyCode: payload.currency.toUpperCase(),
        exchangeRate: 1.0,
        cashierId,
        cashierName,
        branchId,
        branchName,
        customerEmail: payload.email,
      });

      // Determine frontend origin for redirecting back to user interface
      const referer = req.headers.referer || '';
      let frontendOrigin = `${req.protocol}://${req.get('host')}`;
      if (referer) {
        try {
          const urlObj = new URL(referer);
          frontendOrigin = urlObj.origin;
        } catch {
          // ignore invalid referer URL
        }
      }

      // Call payment service with resiliency protection
      const paymentResult = await PaymentService.initialize(payload.provider, {
        email: payload.email,
        amount: calculatedTotal,
        currency: payload.currency,
        reference,
        callbackUrl: `${frontendOrigin}/pos?provider=${payload.provider}&reference=${reference}`,
        metadata: {
          transactionId: transaction._id.toString(),
          cashierId,
          branchId,
        },
      });

      res.status(200).json({
        success: true,
        transactionId: transaction._id,
        reference: paymentResult.reference,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        authorizationUrl: paymentResult.authorizationUrl, // For Paystack redirection
        clientSecret: paymentResult.clientSecret, // For Stripe card elements mounting
        gatewayTransactionId: paymentResult.gatewayTransactionId,
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Refined static payment verification method. Connects directly to the provider,
   * performs amount/currency checks, manages stock level decreases, and commits status.
   */
  public static async verifyAndProcessPayment(
    provider: PaymentProvider,
    reference: string
  ): Promise<{
    success: boolean;
    status: string;
    transaction: ITransaction;
    gatewayResponse?: string;
  }> {
    const transaction = await Transaction.findOne({ transactionNumber: reference });
    if (!transaction) {
      throw new NotFoundError(`Transaction record not found for reference: ${reference}`);
    }

    // Idempotency: Avoid double inventory deductions or re-processing completed payments
    if (transaction.status === 'COMPLETED') {
      logger.info(`[PaymentController] Reference ${reference} already marked as COMPLETED.`);
      return { success: true, status: 'COMPLETED', transaction };
    }

    const expectedAmount = transaction.total;
    const expectedCurrency = transaction.currencyCode || 'USD';

    const verification = await PaymentService.verify(
      provider,
      reference,
      expectedAmount,
      expectedCurrency
    );

    if (verification.success && verification.status === 'COMPLETED') {
      // Safely decrease stock levels
      for (const item of transaction.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity);
          await product.save();

          io.emitGlobal('product:stock-updated', {
            productId: product._id,
            quantity: product.quantity,
          });

          if (product.quantity <= product.lowStockAlert) {
            io.emitGlobal('notification:low-stock', {
              productId: product._id,
              name: product.name,
              quantity: product.quantity,
              lowStockAlert: product.lowStockAlert,
            });
          }
        }
      }

      transaction.status = 'COMPLETED';
      await transaction.save();

      // Persist receipt if it does not exist yet
      const existingReceipt = await Receipt.findOne({ transactionId: transaction._id });
      if (!existingReceipt) {
        await Receipt.create({
          transactionId: transaction._id,
          transactionNumber: transaction.transactionNumber,
          customerEmail: transaction.customerEmail,
          branchId: transaction.branchId,
          cashierId: transaction.cashierId,
          data: {
            transactionNumber: transaction.transactionNumber,
            items: transaction.items,
            subtotal: transaction.subtotal,
            tax: transaction.tax,
            discount: transaction.discount,
            total: transaction.total,
            paymentMethod: transaction.paymentMethod,
            cashierName: transaction.cashierName,
            branchName: transaction.branchName,
            customerEmail: transaction.customerEmail,
            createdAt: transaction.createdAt,
          },
        });
      }

      // Clear cache layer
      await redis.del(['products:all', 'transactions:all']);

      // Socket notification
      io.emitGlobal('transaction:completed', transaction);

      return {
        success: true,
        status: 'COMPLETED',
        transaction,
        gatewayResponse: verification.gatewayResponse,
      };
    } else {
      transaction.status = 'CANCELLED';
      await transaction.save();

      return {
        success: false,
        status: 'FAILED',
        transaction,
        gatewayResponse: verification.gatewayResponse,
      };
    }
  }

  /**
   * Strict verification of checkout payment session directly with the gateway.
   */
  public static async verifyCheckout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = {
        provider: (req.body && req.body.provider) || req.query.provider,
        reference: (req.body && req.body.reference) || req.query.reference,
      };

      const { provider, reference } = verifyCheckoutSchema.parse(input);

      const result = await PaymentController.verifyAndProcessPayment(
        provider as PaymentProvider,
        reference
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(200).json({
          ...result,
          message: result.gatewayResponse || 'Payment not yet confirmed by gateway.',
        });
      }
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * Refunding an initialized transaction via standard admin permissions.
   */
  public static async refundCheckout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reference, amount, reason } = refundCheckoutSchema.parse(req.body);

      const transaction = await Transaction.findOne({ transactionNumber: reference });
      if (!transaction) {
        throw new NotFoundError(`Transaction for reference ${reference} not found.`);
      }

      if (transaction.status !== 'COMPLETED') {
        throw new ValidationError('Only successfully completed transactions can be refunded.');
      }

      const provider: PaymentProvider =
        transaction.paymentMethod === 'MOBILE' ? 'PAYSTACK' : 'STRIPE';

      // Perform gateway refund
      const refundResult = await PaymentService.refund(provider, reference, amount, reason);

      if (refundResult.success) {
        // Return products to inventory stock ledger
        for (const item of transaction.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.quantity += item.quantity;
            await product.save();
            io.emitGlobal('product:stock-updated', {
              productId: product._id,
              quantity: product.quantity,
            });
          }
        }

        // Update database state
        transaction.status = 'CANCELLED';
        await transaction.save();
        await redis.del(['products:all', 'transactions:all']);

        res.json({
          success: true,
          message: `Successfully refunded $${amount} via ${provider}. Restored catalog stocks.`,
          refundId: refundResult.refundId,
        });
      } else {
        throw new Error('Gateway rejected refund request');
      }
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * GET /api/v1/checkout/history
   * Returns transaction history with pagination.
   */
  public static async getTransactionHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.paymentMethod) {
        filter.paymentMethod = req.query.paymentMethod;
      }
      if (req.query.branchId) {
        filter.branchId = req.query.branchId;
      }

      const [transactions, total] = await Promise.all([
        Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Transaction.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err: unknown) {
      next(err);
    }
  }

  /**
   * GET /api/v1/checkout/receipts/:transactionNumber
   * Returns receipt details for a transaction.
   */
  public static async getPaymentReceipt(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transactionNumber } = req.params;
      const receipt = await Receipt.findOne({ transactionNumber }).lean();

      if (!receipt) {
        throw new NotFoundError(`Receipt for transaction ${transactionNumber} not found.`);
      }

      res.json({ success: true, data: receipt });
    } catch (err: unknown) {
      next(err);
    }
  }
}
