import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { POSService } from '../services/pos.service.js';
import { OrderManagementService } from '../services/order-management.service.js';
import { PricingEngineService } from '../services/pricingEngine.service.js';
import { Product } from '../models/Product.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';

describe('Stockora Enterprise Mini — Zero-Tax & Fixed Pricing Verification', () => {
  const testTenantId = new mongoose.Types.ObjectId();
  let retailProduct: any;
  let wholesaleProduct: any;

  beforeAll(async () => {
    // Connect to test/mini database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_mini_database'
      );
    }

    // Create fixed-price test products
    retailProduct = await Product.create({
      tenantId: testTenantId,
      name: 'Fixed Retail Rice 50kg',
      sku: 'TEST-RICE-50KG',
      sellingPrice: 5000,
      retailPrice: 5000,
      wholesalePrice: 4200,
      currency: 'NGN',
      quantity: 100,
      minStockLevel: 5,
    });

    wholesaleProduct = await Product.create({
      tenantId: testTenantId,
      name: 'Fixed Wholesale Oil 25L',
      sku: 'TEST-OIL-25L',
      sellingPrice: 12000,
      retailPrice: 12000,
      wholesalePrice: 9500,
      currency: 'NGN',
      quantity: 50,
      minStockLevel: 2,
    });
  });

  afterAll(async () => {
    if (retailProduct) await Product.findByIdAndDelete(retailProduct._id);
    if (wholesaleProduct) await Product.findByIdAndDelete(wholesaleProduct._id);
    await OmnichannelOrder.deleteMany({ 'items.name': { $regex: /Fixed (Retail|Wholesale)/ } });
  });

  it('calculates POS cart with strictly zero sales tax and zero VAT', () => {
    const cart = [
      { unitPrice: 5000, quantity: 2, discount: 0 },
      { unitPrice: 9500, quantity: 1, discount: 0 },
    ];

    const result = POSService.calculateCart(cart, 0, 0);

    expect(result.subtotal).toBe(19500);
    expect(result.discountTotal).toBe(0);
    expect(result.taxTotal).toBe(0); // Zero tax enforced
    expect(result.grandTotal).toBe(19500); // Exact match, no tax added
  });

  it('preserves exact seller retail price without tax addition or alteration', async () => {
    const checkoutResult = await POSService.checkout({
      idempotencyKey: `FIXED-RETAIL-${Date.now()}`,
      branchId: '000000000000000000000001',
      warehouseId: '000000000000000000000001',
      cashierId: 'CASHIER-TEST',
      cashierName: 'Alice Operator',
      pricingMode: 'RETAIL',
      items: [
        {
          productId: retailProduct._id.toString(),
          quantity: 2,
          priceTier: 'RETAIL',
        },
      ],
      paymentMethod: 'CASH',
      amountTendered: 10000,
      cartDiscount: 0,
      taxRate: 0,
      currency: 'NGN',
    });

    expect(checkoutResult.taxTotal).toBe(0);
    expect(checkoutResult.subtotal).toBe(10000); // 5000 * 2
    expect(checkoutResult.grandTotal).toBe(10000); // Exactly 10000, 0 tax
    expect(checkoutResult.items[0].unitPrice).toBe(5000); // Fixed seller price preserved
    expect(checkoutResult.items[0].total).toBe(10000);
    expect(checkoutResult.items[0].tax).toBe(0);
  });

  it('preserves exact seller wholesale price without tax addition or alteration', async () => {
    const checkoutResult = await POSService.checkout({
      idempotencyKey: `FIXED-WHOLESALE-${Date.now()}`,
      branchId: '000000000000000000000001',
      warehouseId: '000000000000000000000001',
      cashierId: 'CASHIER-TEST',
      cashierName: 'Alice Operator',
      pricingMode: 'WHOLESALE',
      items: [
        {
          productId: wholesaleProduct._id.toString(),
          quantity: 3,
          priceTier: 'WHOLESALE',
        },
      ],
      paymentMethod: 'CASH',
      amountTendered: 28500,
      cartDiscount: 0,
      taxRate: 0,
      currency: 'NGN',
    });

    expect(checkoutResult.taxTotal).toBe(0);
    expect(checkoutResult.subtotal).toBe(28500); // 9500 * 3
    expect(checkoutResult.grandTotal).toBe(28500); // Exactly 28500, 0 tax
    expect(checkoutResult.items[0].unitPrice).toBe(9500); // Fixed wholesale seller price preserved
    expect(checkoutResult.items[0].total).toBe(28500);
    expect(checkoutResult.items[0].tax).toBe(0);
  });

  it('generates complete receipt data without taxId and with 0 tax', async () => {
    const order = await OmnichannelOrder.findOne({
      idempotencyKey: { $regex: /^FIXED-RETAIL-/ },
    });
    expect(order).toBeDefined();

    if (order) {
      const receipt = await POSService.getReceiptData(order.orderNumber);
      expect(receipt.header.taxId).toBeUndefined();
      expect(receipt.tax).toBe(0);
      expect(receipt.total).toBe(order.grandTotal);
      expect(receipt.items.length).toBeGreaterThan(0);
      expect(receipt.items[0].qty).toBe(2);
      expect(receipt.items[0].price).toBe(5000);
      expect(receipt.items[0].total).toBe(10000);
    }
  });

  it('enforces zero sales tax in OrderManagementService', async () => {
    const order = await OrderManagementService.createOrder({
      channel: 'POS',
      warehouseId: '000000000000000000000001',
      items: [
        {
          productId: retailProduct._id.toString(),
          sku: 'TEST-RICE-50KG',
          name: 'Fixed Retail Rice 50kg',
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    });

    expect(order.taxTotal).toBe(0); // 0.07 sales tax removed
    expect(order.subtotal).toBe(5000);
    expect(order.grandTotal).toBe(5000);
  });

  it('enforces zero tax in PricingEngineService', async () => {
    const evaluation = await PricingEngineService.evaluateCart([
      { productId: retailProduct._id.toString(), quantity: 2 },
    ]);

    expect(evaluation.taxTotal).toBe(0);
    expect(evaluation.subtotal).toBe(10000);
    expect(evaluation.grandTotal).toBe(10000);
  });
});
