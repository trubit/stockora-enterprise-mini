import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { SalesChannelService } from '../services/salesChannel.service.js';
import { PricingEngineService } from '../services/pricingEngine.service.js';
import { SalesQuoteService } from '../services/salesQuote.service.js';
import { OmnichannelSalesService } from '../services/omnichannelSales.service.js';
import { ChannelAdapterService } from '../services/channelAdapter.service.js';
import { SalesAnalyticsService } from '../services/salesAnalytics.service.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { PriceList } from '../models/PriceList.js';
import { PriceListItem } from '../models/PriceListItem.js';
import { SalesOrderHold } from '../models/SalesOrderHold.js';
import { Backorder } from '../models/Backorder.js';

describe('Phase 35 — Advanced Sales & Omnichannel Commerce Engine', () => {
  let testProductId: string;
  let testCustomerId: string;
  let testChannelId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }

    // Seed test Product
    const prod = await Product.create({
      tenantId: 'test-tenant',
      name: 'Omnichannel Test Laptop',
      sku: `SKU-TEST-${Date.now()}`,
      category: 'Electronics',
      price: 1000,
      quantity: 50,
      minStockLevel: 5,
    });
    testProductId = prod._id.toString();

    // Seed test Customer
    const cust = await Customer.create({
      tenantId: 'test-tenant',
      name: 'Acme Enterprise Ltd',
      code: `CUST-${Date.now()}`,
      email: `acme-${Date.now()}@example.com`,
      group: 'WHOLESALE',
      creditLimit: 2000,
      totalSpending: 0,
    });
    testCustomerId = cust._id.toString();

    // Seed test Sales Channel
    const channel = await SalesChannelService.createChannel({
      tenantId: 'test-tenant',
      code: `WEB-${Date.now()}`,
      name: 'Web Store Channel',
      type: 'ONLINE',
      currency: 'USD',
    });
    testChannelId = channel._id.toString();
  });

  beforeEach(async () => {
    const existing = await Product.findById(testProductId);
    if (!existing) {
      const prod = await Product.create({
        tenantId: 'test-tenant',
        name: 'Omnichannel Test Laptop',
        sku: `SKU-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category: 'Electronics',
        price: 1000,
        quantity: 50,
        minStockLevel: 5,
      });
      testProductId = prod._id.toString();
    }
  });

  afterAll(async () => {
    await Product.deleteMany({ tenantId: 'test-tenant' });
    await Customer.deleteMany({ tenantId: 'test-tenant' });
  });

  it('should create and fetch a sales channel', async () => {
    const channel = await SalesChannelService.getChannelById(testChannelId);
    expect(channel).toBeDefined();
    expect(channel.type).toBe('ONLINE');
  });

  it('should evaluate tier volume price breaks and server-side cart pricing correctly', async () => {
    // Create Wholesale Price List with volume break (minQty 5 -> $850 instead of $1000)
    const priceList = await PriceList.create({
      tenantId: 'test-tenant',
      code: `PL-WHOLESALE-${Date.now()}`,
      name: 'Wholesale Volume List',
      type: 'WHOLESALE',
      customerGroupId: 'WHOLESALE',
      currency: 'USD',
      isActive: true,
    });

    await PriceListItem.create({
      priceListId: priceList._id,
      productId: testProductId,
      minQuantity: 5,
      unitPrice: 850,
      currency: 'USD',
    });

    // Evaluate single item (< 5 qty -> $1000)
    const evalSingle = await PricingEngineService.evaluatePriceForItem(
      testProductId,
      1,
      testCustomerId,
      testChannelId,
      'WHOLESALE'
    );
    expect(evalSingle.unitPrice).toBe(1000);

    // Evaluate bulk item (>= 5 qty -> $850)
    const evalBulk = await PricingEngineService.evaluatePriceForItem(
      testProductId,
      5,
      testCustomerId,
      testChannelId,
      'WHOLESALE'
    );
    expect(evalBulk.unitPrice).toBe(850);

    // Evaluate Cart
    const cartEval = await PricingEngineService.evaluateCart(
      [{ productId: testProductId, quantity: 5 }],
      {
        customerId: testCustomerId,
        customerGroup: 'WHOLESALE',
      }
    );

    expect(cartEval.subtotal).toBe(4250); // 5 * 850
    expect(cartEval.grandTotal).toBe(4250);
  });

  it('should create a Sales Quote and convert it idempotently to a Sales Order', async () => {
    const quote = await SalesQuoteService.createQuote({
      tenantId: 'test-tenant',
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 2 }],
      validDays: 15,
    });

    expect(quote.quoteNumber).toBeDefined();
    expect(quote.status).toBe('DRAFT');

    const convertedOrder = await SalesQuoteService.convertQuoteToOrder(
      quote._id.toString(),
      'IDEMP-QUOTE-1'
    );
    expect(convertedOrder.orderNumber).toBeDefined();
    expect(convertedOrder.status).toBe('APPROVED');

    // Idempotency check: converting same quote returns existing order
    const repeatOrder = await SalesQuoteService.convertQuoteToOrder(
      quote._id.toString(),
      'IDEMP-QUOTE-1'
    );
    expect(repeatOrder._id.toString()).toBe(convertedOrder._id.toString());
  });

  it('should trigger SalesOrderHold when credit limit is exceeded and enforce oversale protection', async () => {
    // Attempt order that exceeds customer credit limit ($2000)
    // 3 laptops @ $1000 = $3000 total > $2000 limit
    const order = await OmnichannelSalesService.createOrder({
      tenantId: 'test-tenant',
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 3 }],
      idempotencyKey: `IDEMP-EXCEED-${Date.now()}`,
    });

    expect(order.status).toBe('ON_HOLD');
    expect(order.creditApproved).toBe(false);

    const holdRecord = await SalesOrderHold.findOne({
      orderId: order._id,
      reason: 'CREDIT_LIMIT_EXCEEDED',
    });
    expect(holdRecord).toBeDefined();
    expect(holdRecord?.status).toBe('ACTIVE');

    // Release Hold
    if (holdRecord) {
      const released = await OmnichannelSalesService.releaseOrderHold(
        holdRecord._id.toString(),
        'admin',
        'System Admin'
      );
      expect(released.status).toBe('RELEASED');

      const updatedOrder = await OmnichannelSalesService.getOrderById(order._id.toString());
      expect(updatedOrder.status).toBe('APPROVED');
    }
  });

  it('should handle backorders when requested quantity exceeds available stock', async () => {
    await Product.findByIdAndUpdate(testProductId, { quantity: 50 });

    // Current stock is 50. Request 60 with allowBackorders: true
    const order = await OmnichannelSalesService.createOrder({
      tenantId: 'test-tenant',
      items: [{ productId: testProductId, quantity: 60 }],
      allowBackorders: true,
      idempotencyKey: `IDEMP-BO-${Date.now()}`,
    });

    expect(order).toBeDefined();

    const boRecord = await Backorder.findOne({ orderId: order._id });
    expect(boRecord).toBeDefined();
    expect(boRecord?.backorderQuantity).toBe(10); // 60 requested - 50 available = 10 backordered
  });

  it('should process external channel webhook orders idempotently', async () => {
    const channel = await SalesChannelService.getChannelById(testChannelId);

    const result = await ChannelAdapterService.processExternalOrderWebhook(channel.code, '', {
      externalOrderId: `EXT-SHOPIFY-8810`,
      provider: 'SHOPIFY',
      channelCode: channel.code,
      items: [{ productId: testProductId, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    expect(result.internalOrderNumber).toBeDefined();

    // Repeat webhook with same external order ID should be idempotent
    const repeatResult = await ChannelAdapterService.processExternalOrderWebhook(channel.code, '', {
      externalOrderId: `EXT-SHOPIFY-8810`,
      provider: 'SHOPIFY',
      channelCode: channel.code,
      items: [{ productId: testProductId, quantity: 1 }],
    });

    expect(repeatResult.success).toBe(true);
    expect(repeatResult.message).toContain('idempotently');
  });

  it('should generate sales analytics and AI sales intelligence metrics', async () => {
    const analytics = await SalesAnalyticsService.getAnalyticsOverview('test-tenant');
    expect(analytics.totalOrders).toBeGreaterThan(0);
    expect(analytics.revenueByChannel.length).toBeGreaterThan(0);
    expect(analytics.aiSalesIntelligence).toBeDefined();
    expect(analytics.aiSalesIntelligence.growthChannel).toBeDefined();
  });
});
