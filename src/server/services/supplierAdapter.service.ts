import crypto from 'crypto';
import { Supplier } from '../models/Supplier.js';
import { ProcurementAdvancedService } from './procurementAdvanced.service.js';
import { AuthenticationError, ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface ExternalSupplierPayload {
  poId: string;
  externalSupplierRef: string;
  status: 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'REJECTED';
  confirmedDeliveryDate?: string;
  signature?: string;
  timestamp?: number;
}

export class SupplierAdapterService {
  public static verifyWebhookSignature(
    payloadString: string,
    signature: string,
    secretKey: string
  ): boolean {
    if (!signature || !secretKey) return false;
    const computedHmac = crypto.createHmac('sha256', secretKey).update(payloadString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(signature));
  }

  public static async processExternalSupplierWebhook(
    supplierId: string,
    rawBody: string,
    payload: ExternalSupplierPayload,
    secretKey?: string
  ): Promise<{ success: boolean; message: string }> {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    if (secretKey && payload.signature) {
      const isValid = this.verifyWebhookSignature(rawBody, payload.signature, secretKey);
      if (!isValid) {
        throw new AuthenticationError('Invalid supplier webhook signature.');
      }
    }

    if (payload.timestamp && Math.abs(Date.now() - payload.timestamp) > 300000) {
      // 5 min replay protection
      throw new ValidationError('Webhook timestamp expired replay attack protection.');
    }

    const deliveryDate = payload.confirmedDeliveryDate
      ? new Date(payload.confirmedDeliveryDate)
      : undefined;

    await ProcurementAdvancedService.processSupplierConfirmation(
      payload.poId,
      payload.status,
      deliveryDate,
      `External confirmation via Supplier Portal (Ref: ${payload.externalSupplierRef})`
    );

    eventBus.emit('procurement.external_supplier.confirmed', {
      supplierId: supplier._id,
      poId: payload.poId,
      status: payload.status,
    });

    return {
      success: true,
      message: 'Supplier confirmation webhook processed successfully.',
    };
  }
}
