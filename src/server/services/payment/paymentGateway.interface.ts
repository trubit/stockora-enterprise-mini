export type PaymentProvider = 'PAYSTACK' | 'STRIPE';

export interface PaymentInitOptions {
  email: string;
  amount: number; // in standard currency units (e.g. 10.50 USD or 5000 NGN)
  currency: string; // e.g. 'USD', 'NGN', 'EUR', 'GBP'
  reference: string; // unique transaction reference
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  authorizationUrl?: string; // Redirect URL for hosted checkouts (Paystack, etc.)
  clientSecret?: string; // Client secret for client-side components (Stripe Elements)
  gatewayTransactionId?: string; // Gateway identifier / access code
  provider: PaymentProvider;
}

export interface PaymentVerifyResult {
  success: boolean;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  reference: string;
  amount: number; // in standard currency units
  currency: string;
  gatewayResponse?: string;
  provider: PaymentProvider;
  gatewayTransactionId?: string;
  paidAt?: Date;
}

export interface PaymentRefundOptions {
  reference: string; // Gateway transaction reference or ID
  amount: number; // in standard currency units
  reason?: string;
  merchantNote?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refundId?: string;
  amount: number;
  provider: PaymentProvider;
  status: 'PROCESSED' | 'PENDING' | 'FAILED';
  gatewayResponse?: string;
}

export interface IPaymentGatewayAdapter {
  readonly provider: PaymentProvider;
  initializePayment(options: PaymentInitOptions): Promise<PaymentInitResult>;
  verifyPayment(
    reference: string,
    expectedAmount: number,
    expectedCurrency: string
  ): Promise<PaymentVerifyResult>;
  refundPayment(options: PaymentRefundOptions): Promise<PaymentRefundResult>;
}
