import { logger } from '../logger.js';
import { PaymentGatewayFactory } from './payment/gateway.factory.js';
import type {
  PaymentProvider,
  PaymentInitOptions,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentRefundOptions,
  PaymentRefundResult,
} from './payment/paymentGateway.interface.js';

export type {
  PaymentProvider,
  PaymentInitOptions as InitializePaymentOptions,
  PaymentInitResult as InitializePaymentResult,
  PaymentVerifyResult as VerifyPaymentResult,
  PaymentRefundResult as RefundPaymentResult,
  PaymentRefundOptions as RefundPaymentOptions,
};

export class PaymentService {
  /**
   * Resiliently initialize a payment transaction with either Paystack or Stripe.
   */
  public static async initialize(
    provider: PaymentProvider,
    options: PaymentInitOptions
  ): Promise<PaymentInitResult> {
    logger.info(
      `[PaymentService] Initializing ${provider} payment for reference ${options.reference}`
    );
    const adapter = PaymentGatewayFactory.getAdapter(provider);
    return adapter.initializePayment(options);
  }

  /**
   * Resiliently verify a payment status with the gateway directly.
   * Enforces zero-trust: backend asks the payment provider directly.
   */
  public static async verify(
    provider: PaymentProvider,
    reference: string,
    expectedAmount: number,
    expectedCurrency: string
  ): Promise<PaymentVerifyResult> {
    logger.info(`[PaymentService] Verifying ${provider} payment status for reference ${reference}`);
    const adapter = PaymentGatewayFactory.getAdapter(provider);
    return adapter.verifyPayment(reference, expectedAmount, expectedCurrency);
  }

  /**
   * Resiliently trigger a refund request for a completed payment.
   */
  public static async refund(
    provider: PaymentProvider,
    reference: string,
    amount: number,
    reason?: string
  ): Promise<PaymentRefundResult> {
    logger.info(`[PaymentService] Processing refund for reference ${reference} via ${provider}`);
    const adapter = PaymentGatewayFactory.getAdapter(provider);
    return adapter.refundPayment({ reference, amount, reason });
  }
}
