import mongoose from 'mongoose';
import { SalesQuote, type ISalesQuote } from '../models/SalesQuote.js';
import { SalesOrder, type ISalesOrder } from '../models/SalesOrder.js';
import { Customer } from '../models/Customer.js';
import { PricingEngineService } from './pricingEngine.service.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface CreateQuoteInput {
  tenantId?: string;
  companyId?: string;
  channelId?: string;
  customerId?: string;
  salesRepId?: string;
  salesRepName?: string;
  territoryId?: string;
  items: { productId: string; quantity: number }[];
  validDays?: number;
  terms?: string;
  notes?: string;
}

export class SalesQuoteService {
  public static async createQuote(input: CreateQuoteInput): Promise<ISalesQuote> {
    const tenantId = input.tenantId || 'default';
    const companyId = input.companyId || 'default';

    let customerName: string | undefined;
    let customerGroup: string | undefined;

    if (input.customerId) {
      const customer = await Customer.findById(input.customerId);
      if (!customer) {
        throw new NotFoundError(`Customer ${input.customerId} not found`);
      }
      customerName = customer.name;
      customerGroup = customer.group;
    }

    const cartEval = await PricingEngineService.evaluateCart(input.items, {
      customerId: input.customerId,
      channelId: input.channelId,
      customerGroup,
    });

    const quoteNumber = `SQ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (input.validDays || 30));

    const quote = await SalesQuote.create({
      tenantId,
      companyId,
      quoteNumber,
      channelId: input.channelId ? new mongoose.Types.ObjectId(input.channelId) : undefined,
      customerId: input.customerId ? new mongoose.Types.ObjectId(input.customerId) : undefined,
      customerName,
      salesRepId: input.salesRepId,
      salesRepName: input.salesRepName,
      territoryId: input.territoryId ? new mongoose.Types.ObjectId(input.territoryId) : undefined,
      items: cartEval.items.map((item) => ({
        productId: new mongoose.Types.ObjectId(item.productId),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.unitPrice,
        discount: item.itemDiscount,
        tax: item.itemTax,
      })),
      subtotal: cartEval.subtotal,
      tax: cartEval.taxTotal,
      discount: cartEval.totalDiscount,
      total: cartEval.grandTotal,
      currency: cartEval.currency,
      status: 'DRAFT',
      validUntil,
      terms: input.terms || 'Standard 30-day quotation validity.',
      notes: input.notes,
    });

    eventBus.emit('sales.quote.created', { quoteId: quote._id, quoteNumber });

    return quote;
  }

  public static async getQuotes(tenantId = 'default', companyId = 'default'): Promise<any[]> {
    return SalesQuote.find({ tenantId, companyId }).sort({ createdAt: -1 }).lean();
  }

  public static async getQuoteById(id: string): Promise<ISalesQuote> {
    const quote = await SalesQuote.findById(id);
    if (!quote) {
      throw new NotFoundError('Sales quote not found');
    }
    return quote;
  }

  public static async updateQuoteStatus(
    id: string,
    status: 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  ): Promise<ISalesQuote> {
    const quote = await SalesQuote.findById(id);
    if (!quote) {
      throw new NotFoundError('Sales quote not found');
    }

    if (quote.status === 'CONVERTED') {
      throw new ValidationError('Cannot update status of an already converted quote.');
    }

    quote.status = status;
    if (status === 'ACCEPTED') {
      quote.acceptedAt = new Date();
      eventBus.emit('sales.quote.accepted', { quoteId: quote._id, quoteNumber: quote.quoteNumber });
    }

    await quote.save();
    return quote;
  }

  public static async convertQuoteToOrder(
    quoteId: string,
    idempotencyKey?: string
  ): Promise<ISalesOrder> {
    const quote = await SalesQuote.findById(quoteId);
    if (!quote) {
      throw new NotFoundError('Sales quote not found');
    }

    if (quote.status === 'CONVERTED' && quote.convertedOrderId) {
      const existingOrder = await SalesOrder.findById(quote.convertedOrderId);
      if (existingOrder) return existingOrder;
    }

    if (new Date() > quote.validUntil) {
      quote.status = 'EXPIRED';
      await quote.save();
      throw new ValidationError('Quotation has expired and cannot be converted.');
    }

    const orderNumber = `SO-Q-${Date.now().toString().slice(-6)}`;

    const order = await SalesOrder.create({
      tenantId: quote.tenantId,
      companyId: quote.companyId,
      orderNumber,
      channelId: quote.channelId,
      quoteId: quote._id,
      customerId: quote.customerId,
      customerName: quote.customerName,
      salesRepId: quote.salesRepId,
      salesRepName: quote.salesRepName,
      territoryId: quote.territoryId,
      items: quote.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        tax: item.tax,
        shippedQuantity: 0,
      })),
      subtotal: quote.subtotal,
      tax: quote.tax,
      discount: quote.discount,
      total: quote.total,
      currency: quote.currency,
      status: 'APPROVED',
      idempotencyKey,
      notes: `Converted from quote ${quote.quoteNumber}`,
    });

    quote.status = 'CONVERTED';
    quote.convertedOrderId = order._id as mongoose.Types.ObjectId;
    quote.convertedOrderNumber = order.orderNumber;
    await quote.save();

    eventBus.emit('sales.quote.converted', {
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      orderId: order._id,
      orderNumber: order.orderNumber,
    });

    return order;
  }
}
