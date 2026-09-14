import crypto from 'crypto';
import { SalesTransaction } from '../models/SalesTransaction.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response: string;
    customer: { email: string };
    metadata?: any;
  };
}

export class PaymentGatewayAdvancedService {
  public static verifyPaystackSignature(
    signature: string,
    rawBody: string,
    secretKey: string
  ): boolean {
    if (!signature || !secretKey) return false;
    const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
    return hash === signature;
  }

  public static async processPaystackWebhook(
    payload: PaystackWebhookPayload
  ): Promise<{ processed: boolean; reference: string }> {
    const { event, data } = payload;
    if (event !== 'charge.success') {
      return { processed: false, reference: data.reference };
    }

    const referenceNumber = data.reference;
    const tx = await SalesTransaction.findOne({
      'payments.referenceNumber': referenceNumber,
    });

    if (tx) {
      const payment = tx.payments.find((p: any) => p.referenceNumber === referenceNumber);
      if (payment) {
        payment.status = 'SUCCESS';
        payment.gatewayTransactionId = data.reference;
      }
      tx.status = 'PAID';
      await tx.save();

      eventBus.emit('pos.payment.completed', {
        transactionId: tx._id,
        referenceNumber,
        amount: data.amount / 100,
      });

      return { processed: true, reference: referenceNumber };
    }

    return { processed: false, reference: referenceNumber };
  }

  public static validateSplitPayment(
    totalOrderAmount: number,
    payments: { method: string; amount: number }[]
  ): boolean {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return Math.abs(totalPaid - totalOrderAmount) < 0.01;
  }
}
