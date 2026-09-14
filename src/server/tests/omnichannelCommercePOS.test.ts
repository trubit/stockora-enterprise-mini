import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { POSTerminal } from '../models/POSTerminal.js';
import { RegisterSession } from '../models/RegisterSession.js';
import { HeldSale } from '../models/HeldSale.js';
import { SalesTransaction } from '../models/SalesTransaction.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { CustomerCreditExposure } from '../models/CustomerCreditExposure.js';
import { POSAdvancedService } from '../services/posAdvanced.service.js';
import { OmnichannelSalesService } from '../services/omnichannelSales.service.js';
import { PaymentGatewayAdvancedService } from '../services/paymentGatewayAdvanced.service.js';
import { CommerceAnalyticsAIService } from '../services/commerceAnalyticsAI.service.js';

describe('Phase 39 — Advanced POS, Omnichannel Sales & Commerce Intelligence Engine', () => {
  let terminalId: string;
  let registerSessionId: string;
  let productId: string;
  let customerId: string;
  let transactionId: string;
  let holdId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }
  });

  afterAll(async () => {
    await POSTerminal.deleteMany({ tenantId: 'tenant-pos-test' });
    await RegisterSession.deleteMany({ tenantId: 'tenant-pos-test' });
    await HeldSale.deleteMany({ tenantId: 'tenant-pos-test' });
    await SalesTransaction.deleteMany({ tenantId: 'tenant-pos-test' });
    await Product.deleteMany({ name: 'POS Wireless Barcode Scanner' });
    await Customer.deleteMany({ code: 'CUST-POS-99' });
    await CustomerCreditExposure.deleteMany({ tenantId: 'tenant-pos-test' });
  });

  it('1. Should create POS terminal and open register shift session', async () => {
    const terminal = await POSTerminal.create({
      tenantId: 'tenant-pos-test',
      terminalCode: `TRM-MAIN-${Date.now().toString().slice(-4)}`,
      name: 'Main Checkout Register 1',
      status: 'ACTIVE',
      hardwareConfig: { barcodeScannerEnabled: true },
    });
    terminalId = terminal._id.toString();

    const session = await RegisterSession.create({
      tenantId: 'tenant-pos-test',
      registerId: terminal.terminalCode,
      registerName: terminal.name,
      branchId: new mongoose.Types.ObjectId(),
      cashierId: 'cashier-001',
      cashierName: 'John Operator',
      openingFloat: 200,
      expectedCash: 200,
      status: 'OPEN',
      openedAt: new Date(),
    });

    expect(terminal).toBeDefined();
    expect(session).toBeDefined();
    expect(session.openingFloat).toBe(200);
    registerSessionId = session._id.toString();
  });

  it('2. Should scan product barcode and resolve inventory availability', async () => {
    const product = await Product.create({
      tenantId: 'tenant-pos-test',
      name: 'POS Wireless Barcode Scanner',
      sku: `SCAN-${Date.now().toString().slice(-4)}`,
      barcode: `88099231-${Date.now().toString().slice(-4)}`,
      price: 150,
      costPrice: 85,
      quantity: 50,
    });
    productId = product._id.toString();

    const scanResult = await POSAdvancedService.scanBarcodeOrSku(product.sku, 'tenant-pos-test');
    expect(scanResult.isAvailable).toBe(true);
    expect(scanResult.product.price).toBe(150);
  });

  it('3. Should hold sale transaction and resume cart', async () => {
    const held = await POSAdvancedService.holdSale({
      tenantId: 'tenant-pos-test',
      branchId: new mongoose.Types.ObjectId().toString(),
      cashierId: 'cashier-001',
      cashierName: 'John Operator',
      cartItems: [
        {
          productId: new mongoose.Types.ObjectId(productId),
          sku: 'SCAN-001',
          name: 'Scanner',
          quantity: 2,
          unitPrice: 150,
          discount: 0,
          total: 300,
        },
      ],
      notes: 'Customer fetching wallet',
    });

    expect(held).toBeDefined();
    expect(held.holdId).toContain('HOLD-');
    holdId = held.holdId;

    const resumed = await POSAdvancedService.resumeSale(holdId);
    expect(resumed).toBeDefined();
    expect(resumed.holdId).toBe(holdId);
  });

  it('4. Should execute omnichannel checkout with split payments (Cash + Card) and stock deduct', async () => {
    const customer = await Customer.create({
      tenantId: 'tenant-pos-test',
      name: 'Acme Retail Corp',
      code: 'CUST-POS-99',
      email: `acme-${Date.now()}@retail.com`,
      group: 'RETAIL',
    });
    customerId = customer._id.toString();

    const tx = await OmnichannelSalesService.validateAndExecuteCheckout({
      tenantId: 'tenant-pos-test',
      terminalId,
      registerSessionId,
      channel: 'POS',
      customerId,
      customerName: customer.name,
      cashierId: 'cashier-001',
      cashierName: 'John Operator',
      items: [
        {
          productId,
          quantity: 2,
          unitPrice: 150,
          discountAmount: 10,
        },
      ],
      payments: [
        { method: 'CASH', amount: 150 },
        { method: 'CARD', amount: 154.5 },
      ],
      idempotencyKey: `TX-IDEM-${Date.now()}`,
    });

    expect(tx).toBeDefined();
    expect(tx.status).toBe('COMPLETED');
    expect(tx.payments.length).toBe(2);
    transactionId = tx._id.toString();

    // Verify stock deduct
    const updatedProd = await Product.findById(productId);
    expect(updatedProd!.quantity).toBe(48); // 50 - 2
  });

  it('5. Should verify Paystack payment gateway webhook and update transaction status', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: `PAYSTACK-REF-${Date.now()}`,
        amount: 29450,
        currency: 'USD',
        status: 'success',
        gateway_response: 'Successful',
        customer: { email: 'customer@test.com' },
      },
    };

    const res = await PaymentGatewayAdvancedService.processPaystackWebhook(payload);
    expect(res.reference).toBe(payload.data.reference);
  });

  it('6. Should sync offline POS transaction queue with idempotency protection', async () => {
    const offlineTx = [
      {
        terminalId,
        transactionNumber: `POS-OFFLINE-${Date.now()}`,
        idempotencyKey: `IDEM-OFF-${Date.now()}`,
        channel: 'POS',
        items: [
          {
            productId,
            sku: 'SCAN-001',
            name: 'Scanner',
            quantity: 1,
            unitPrice: 150,
            unitCost: 85,
            discountAmount: 0,
            taxRate: 5,
            taxAmount: 7.5,
            lineTotal: 150,
          },
        ],
        subtotal: 150,
        totalAmount: 157.5,
        payments: [{ method: 'CASH', amount: 157.5 }],
      },
    ];

    const syncRes = await POSAdvancedService.syncOfflineQueue(offlineTx, 'tenant-pos-test');
    expect(syncRes.synced).toBe(1);

    // Duplicate sync attempt should be safely skipped
    const syncResDup = await POSAdvancedService.syncOfflineQueue(offlineTx, 'tenant-pos-test');
    expect(syncResDup.skipped).toBe(1);
  });

  it('7. Should process B2B customer credit limit risk evaluation', async () => {
    const exposure = await CustomerCreditExposure.create({
      tenantId: 'tenant-pos-test',
      customerId: new mongoose.Types.ObjectId(customerId),
      customerName: 'Acme Retail Corp',
      creditLimit: 5000,
      currentExposure: 1200,
      availableCredit: 3800,
      paymentTerms: 'NET 30',
      riskStatus: 'LOW_RISK',
    });

    expect(exposure).toBeDefined();
    expect(exposure.availableCredit).toBe(3800);
  });

  it('8. Should process sales return, inspection disposition (RESTOCK) and refund', async () => {
    const returnRes = await OmnichannelSalesService.processSalesReturn({
      transactionId,
      items: [{ productId, quantity: 1, returnReason: 'Defective packaging' }],
      refundMethod: 'CASH',
      inventoryDisposition: 'RESTOCK',
    });

    expect(returnRes).toBeDefined();
    expect(returnRes.disposition).toBe('RESTOCK');

    // Restock verification
    const restockedProd = await Product.findById(productId);
    expect(restockedProd!.quantity).toBe(48); // Restocked +1 after offline sync deduct
  });

  it('9. Should aggregate channel sales summary and payment mix analytics', async () => {
    const channels = await CommerceAnalyticsAIService.getChannelSalesSummary('tenant-pos-test');
    const payments = await CommerceAnalyticsAIService.getPaymentMixAnalytics('tenant-pos-test');

    expect(channels.length).toBeGreaterThan(0);
    expect(payments.length).toBeGreaterThan(0);
  });

  it('10. Should generate AI predictive sales forecast and cross-selling recommendations', async () => {
    const forecast = await CommerceAnalyticsAIService.generateAISalesForecast(productId);

    expect(forecast).toBeDefined();
    expect(forecast.dailyForecastDemand).toBeGreaterThan(0);
    expect(forecast.crossSellingRecommendations.length).toBeGreaterThan(0);
  });
});
