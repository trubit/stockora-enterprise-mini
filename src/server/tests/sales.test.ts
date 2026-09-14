import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { SalesQuote } from '../models/SalesQuote.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { SalesShipment } from '../models/SalesShipment.js';
import { SalesReturn } from '../models/SalesReturn.js';
import { StockMovement } from '../models/StockMovement.js';

describe('Sales & POS Cycles Integration', () => {
  let customerId: mongoose.Types.ObjectId;
  let productId: string;
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri =
        process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        'mongodb://127.0.0.1:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }
    await Product.deleteMany({ sku: { $in: ['SKU-SALE-1', 'SKU-DISPATCH-1'] } });
    await Customer.deleteMany({ name: 'Global Supply Corp' });
    await SalesQuote.deleteMany({ quoteNumber: 'QT-TEST-001' });
    await SalesOrder.deleteMany({ orderNumber: 'SO-TEST-001' });
    await SalesShipment.deleteMany({});
    await SalesReturn.deleteMany({ returnNumber: 'RT-TEST-001' });
    await StockMovement.deleteMany({});

    userId = new mongoose.Types.ObjectId();

    // Register customer
    const cust = await Customer.create({
      name: 'Global Supply Corp',
      code: 'GSC-CUST',
      contactPerson: 'Alice Green',
      email: 'alice@globalsupply.com',
      phone: '+1-555-123-4567',
      address: '202 Trade St, Austin TX',
      loyaltyPoints: 120,
      vipGroup: 'Gold',
    });
    customerId = cust._id as mongoose.Types.ObjectId;

    // Create product
    const prod = await Product.create({
      sku: 'SKU-DISPATCH-1',
      name: 'Dispatch Carton Box',
      category: 'Packaging',
      costPrice: 5.0,
      sellingPrice: 12.0,
      price: 12.0,
      cost: 5.0,
      quantity: 100,
      lowStockAlert: 10,
    });
    productId = prod._id.toString();
  });

  afterAll(async () => {
    await Product.deleteMany({ sku: { $in: ['SKU-SALE-1', 'SKU-DISPATCH-1'] } });
    await Customer.deleteMany({ name: 'Global Supply Corp' });
  });

  it('should process sales quotes acceptances', async () => {
    const quote = await SalesQuote.create({
      quoteNumber: 'QT-TEST-001',
      customerId,
      items: [{ productId, quantity: 20, price: 12.0 }],
      subtotal: 240.0,
      tax: 19.2,
      discount: 0,
      total: 259.2,
      status: 'PENDING',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(quote.status).toBe('PENDING');

    quote.status = 'ACCEPTED';
    await quote.save();

    const updated = await SalesQuote.findById(quote._id);
    expect(updated!.status).toBe('ACCEPTED');
  });

  it('should process sales orders and execute partial shipments inventory deductions', async () => {
    // Confirm Sales Order
    const order = await SalesOrder.create({
      orderNumber: 'SO-TEST-001',
      customerId,
      items: [{ productId, quantity: 30, price: 12.0, shippedQuantity: 0 }],
      subtotal: 360.0,
      tax: 28.8,
      discount: 10.0,
      total: 378.8,
      status: 'PENDING',
    });

    expect(order.status).toBe('PENDING');

    // Dispatch Partial Shipment (Ship 10 out of 30)
    const shipmentNumber = 'SH-TEST-001';
    const orderLine = order.items[0];
    orderLine.shippedQuantity += 10;

    // Deducts product stock (100 -> 90)
    const product = await Product.findById(productId);
    product!.quantity -= 10;
    await product!.save();

    await StockMovement.create({
      productId,
      type: 'SALE',
      quantity: -10,
      costPrice: product!.costPrice,
      sellingPrice: orderLine.price,
      referenceId: shipmentNumber,
      userId,
    });

    order.status = 'PARTIALLY_SHIPPED';
    await order.save();

    const updatedOrder = await SalesOrder.findById(order._id);
    expect(updatedOrder!.status).toBe('PARTIALLY_SHIPPED');
    expect(updatedOrder!.items[0].shippedQuantity).toBe(10);

    const updatedProduct = await Product.findById(productId);
    expect(updatedProduct!.quantity).toBe(90);

    const moves = await StockMovement.find({ referenceId: shipmentNumber });
    expect(moves.length).toBe(1);
    expect(moves[0].quantity).toBe(-10);
  });

  it('should process sales returns and audit inventory returns to stock', async () => {
    const returnNumber = 'RT-TEST-001';

    const salesReturn = await SalesReturn.create({
      returnNumber,
      transactionNumber: 'TX-TEST-001',
      customerId,
      items: [
        {
          productId,
          productName: 'Test Product',
          sku: 'SKU-TEST-001',
          quantity: 5,
          price: 12.0,
          refundAmount: 60.0,
          reason: 'Wrong size carton',
          condition: 'SELLABLE',
          action: 'REFUND',
        },
      ],
      reason: 'Wrong size carton',
      status: 'COMPLETED',
      createdBy: userId,
    });

    expect(salesReturn.status).toBe('COMPLETED');

    // Add returned stock back to inventory (90 -> 95)
    const product = await Product.findById(productId);
    product!.quantity += 5;
    await product!.save();

    await StockMovement.create({
      productId,
      type: 'RETURN',
      quantity: 5,
      costPrice: product!.costPrice,
      sellingPrice: 12.0,
      referenceId: returnNumber,
      userId,
    });

    const updatedProduct = await Product.findById(productId);
    expect(updatedProduct!.quantity).toBe(95);

    const moves = await StockMovement.find({ referenceId: returnNumber });
    expect(moves.length).toBe(1);
    expect(moves[0].quantity).toBe(5);
  });
});
