import crypto from 'crypto';
import { ExternalOrderMapping } from '../models/ExternalOrderMapping.js';
import { SalesChannelSync } from '../models/SalesChannelSync.js';
import { SalesChannel } from '../models/SalesChannel.js';
import { OmnichannelSalesService } from './omnichannelSales.service.js';
import { ValidationError, NotFoundError, AuthenticationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface WebhookPayload {
  externalOrderId: string;
  provider: string;
  channelCode: string;
  customerEmail?: string;
  items: { productId: string; quantity: number }[];
  signature?: string;
  timestamp?: number;
}

export class ChannelAdapterService {
  public static verifyWebhookSignature(
    payloadString: string,
    signature: string,
    secretKey: string
  ): boolean {
    if (!signature || !secretKey) return false;
    const computedHmac = crypto.createHmac('sha256', secretKey).update(payloadString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(signature));
  }

  public static async processExternalOrderWebhook(
    channelCode: string,
    rawBody: string,
    payload: WebhookPayload,
    secretKey?: string
  ): Promise<{ success: boolean; internalOrderNumber?: string; message: string }> {
    const channel = await SalesChannel.findOne({ code: channelCode.toUpperCase(), isActive: true });
    if (!channel) {
      throw new NotFoundError(`Sales channel "${channelCode}" not found or inactive.`);
    }

    if (secretKey && payload.signature) {
      const isValid = this.verifyWebhookSignature(rawBody, payload.signature, secretKey);
      if (!isValid) {
        throw new AuthenticationError('Invalid webhook signature authorization failed.');
      }
    }

    const idempotencyKey = `EXT-${payload.provider}-${payload.externalOrderId}`;

    const existingMapping = await ExternalOrderMapping.findOne({
      channelId: channel._id,
      externalOrderId: payload.externalOrderId,
    });

    if (existingMapping && existingMapping.status === 'IMPORTED') {
      return {
        success: true,
        internalOrderNumber: existingMapping.internalOrderNumber,
        message: 'Order already imported idempotently.',
      };
    }

    const syncLog = await SalesChannelSync.create({
      tenantId: channel.tenantId,
      companyId: channel.companyId,
      channelId: channel._id,
      syncType: 'ORDERS',
      status: 'IN_PROGRESS',
    });

    try {
      const internalOrder = await OmnichannelSalesService.createOrder({
        tenantId: channel.tenantId,
        companyId: channel.companyId,
        channelId: channel._id.toString(),
        channelCode: channel.code,
        items: payload.items,
        idempotencyKey,
        allowBackorders: true,
        notes: `Imported from external channel ${payload.provider} (ID: ${payload.externalOrderId})`,
      });

      await ExternalOrderMapping.create({
        tenantId: channel.tenantId,
        companyId: channel.companyId,
        channelId: channel._id,
        externalOrderId: payload.externalOrderId,
        internalOrderId: internalOrder._id,
        internalOrderNumber: internalOrder.orderNumber,
        provider: payload.provider,
        status: 'IMPORTED',
        idempotencyKey,
        rawPayload: payload,
      });

      syncLog.status = 'SUCCESS';
      syncLog.recordsProcessed = 1;
      await syncLog.save();

      eventBus.emit('sales.external_order.imported', {
        channelCode: channel.code,
        externalOrderId: payload.externalOrderId,
        internalOrderNumber: internalOrder.orderNumber,
      });

      return {
        success: true,
        internalOrderNumber: internalOrder.orderNumber,
        message: 'External order imported successfully.',
      };
    } catch (err: any) {
      syncLog.status = 'FAILED';
      syncLog.recordsFailed = 1;
      syncLog.errorDetails = err.message;
      await syncLog.save();

      await ExternalOrderMapping.create({
        tenantId: channel.tenantId,
        companyId: channel.companyId,
        channelId: channel._id,
        externalOrderId: payload.externalOrderId,
        provider: payload.provider,
        status: 'FAILED',
        idempotencyKey,
        rawPayload: payload,
        errorReason: err.message,
      });

      throw new ValidationError(`Failed to import external order: ${err.message}`);
    }
  }
}
