import type { IPaymentGatewayAdapter, PaymentProvider } from './paymentGateway.interface.js';
import { PaystackAdapter } from './paystack.adapter.js';
import { StripeAdapter } from './stripe.adapter.js';

export class PaymentGatewayFactory {
  private static adapters: Map<PaymentProvider, IPaymentGatewayAdapter> = new Map();

  public static getAdapter(provider: PaymentProvider): IPaymentGatewayAdapter {
    const normalized = provider.toUpperCase() as PaymentProvider;

    if (!this.adapters.has(normalized)) {
      switch (normalized) {
        case 'PAYSTACK':
          this.adapters.set(normalized, new PaystackAdapter());
          break;
        case 'STRIPE':
          this.adapters.set(normalized, new StripeAdapter());
          break;
        default:
          throw new Error(`Unsupported payment provider: [${provider}]`);
      }
    }

    return this.adapters.get(normalized)!;
  }

  public static registerAdapter(provider: PaymentProvider, adapter: IPaymentGatewayAdapter): void {
    this.adapters.set(provider, adapter);
  }
}
