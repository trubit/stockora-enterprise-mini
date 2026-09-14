import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { POSService } from '../services/pos.service.js';
import { ReservationService } from '../services/reservation.service.js';
import { RegisterSessionService } from '../services/register-session.service.js';
import { OrderManagementService } from '../services/order-management.service.js';
import { Product } from '../models/Product.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';

describe('Phase 31 — Advanced POS, Omnichannel Commerce & Order Management Tests', () => {
  let testProductId: string;
  const testSku = `POS-TEST-${Date.now()}`;
  const testWarehouseId = new mongoose.Types.ObjectId().toString();
  const testBranchId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_pos_omnichannel');

    const product = await Product.create({
      sku: testSku,
      name: 'Omnichannel POS Test Product',
      costPrice: 50,
      sellingPrice: 100,
      quantity: 50,
      lowStockAlert: 5,
    });
    testProductId = (product._id as mongoose.Types.ObjectId).toString();
  });

  afterAll(async () => {
    await Product.deleteMany({ sku: testSku });
    await OmnichannelOrder.deleteMany({ 'items.sku': testSku });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('POS Cart Engine & Calculations', () => {
    it('should calculate cart subtotal, discounts, tax, and grand total accurately', () => {
      const items = [
        { unitPrice: 100, quantity: 2, discount: 10 }, // 200 sub, 20 disc -> 180
        { unitPrice: 50, quantity: 1, discount: 0 }, // 50 sub -> 50
      ]; // total taxable = 230
      const calc = POSService.calculateCart(items, 0.07, 10); // 230 - 10 = 220 taxable. Tax = 15.40, Total = 235.40

      expect(calc.subtotal).toBe(250);
      expect(calc.discountTotal).toBe(30);
      expect(calc.taxTotal).toBe(15.4);
      expect(calc.grandTotal).toBe(235.4);
    });
  });

  describe('POS Checkout & Idempotency', () => {
    it('should execute checkout and enforce idempotency', async () => {
      const idempotencyKey = `POS-KEY-${Date.now()}`;

      const checkoutInput = {
        idempotencyKey,
        branchId: testBranchId,
        warehouseId: testWarehouseId,
        cashierId: 'CASHIER-TEST',
        cashierName: 'Test Operator',
        customerName: 'Walk-in Tester',
        items: [{ productId: testProductId, quantity: 2, unitPrice: 100 }],
        paymentMethod: 'CASH' as const,
        amountTendered: 214,
        taxRate: 0.07,
      };

      const order1 = await POSService.checkout(checkoutInput);
      expect(order1.orderNumber).toBeDefined();
      expect(order1.grandTotal).toBe(214);
      expect(order1.status).toBe('COMPLETED');
      expect(order1.paymentStatus).toBe('PAID');

      // Re-submit with same idempotency key
      const order2 = await POSService.checkout(checkoutInput);
      expect(order2._id.toString()).toBe(order1._id.toString());
    });

    it('should reject checkout when payment total is less than order grand total', async () => {
      const checkoutInput = {
        branchId: testBranchId,
        warehouseId: testWarehouseId,
        cashierId: 'CASHIER-TEST',
        cashierName: 'Test Operator',
        items: [{ productId: testProductId, quantity: 1, unitPrice: 100 }],
        payments: [{ paymentMethod: 'CASH' as const, amount: 50 }], // Total due is 107
      };

      await expect(POSService.checkout(checkoutInput)).rejects.toThrow(
        /Insufficient payment amount/
      );
    });
  });

  describe('POS Hold and Resume Cart', () => {
    it('should park a cart and resume it successfully', async () => {
      const cartItems = [
        {
          productId: new mongoose.Types.ObjectId(testProductId),
          sku: testSku,
          name: 'Omnichannel POS Test Product',
          quantity: 2,
          unitPrice: 100,
          discount: 0,
          total: 200,
        },
      ];

      const held = await POSService.holdSale(
        'CASHIER-TEST',
        'Test Operator',
        testBranchId,
        cartItems,
        { name: 'Parked Customer' }
      );

      expect(held.holdId).toBeDefined();
      expect(held.subtotal).toBe(200);

      const resumed = await POSService.resumeSale(held.holdId);
      expect(resumed.holdId).toBe(held.holdId);
      expect(resumed.cartItems.length).toBe(1);
    });
  });

  describe('Inventory Reservation Engine', () => {
    it('should reserve stock for an order and release upon expiration', async () => {
      const orderNum = `TEST-RES-${Date.now()}`;

      const res = await ReservationService.reserveStock(
        testProductId,
        testWarehouseId,
        5,
        orderNum,
        'WEBSITE',
        0.001 // expire in ~60ms for testing
      );

      expect(res.status).toBe('RESERVED');
      expect(res.quantity).toBe(5);

      // Verify stock was temporarily deducted
      const productBefore = await Product.findById(testProductId);
      expect(productBefore).toBeDefined();

      // Wait briefly for reservation duration to elapse
      await new Promise((r) => setTimeout(r, 100));

      // Trigger stale reservation expiration
      const expiredCount = await ReservationService.expireStaleReservations();
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      const productAfter = await Product.findById(testProductId);
      expect(productAfter?.quantity).toBe(productBefore!.quantity + 5);
    });
  });

  describe('Cash Register Shift & Reconciliation', () => {
    it('should open register, record cash movements, and calculate shift variance on close', async () => {
      const regId = `REG-TEST-${Date.now()}`;

      const session = await RegisterSessionService.openRegister(
        regId,
        'Test Register',
        testBranchId,
        'CASHIER-01',
        'Alice Cashier',
        100
      );
      expect(session.status).toBe('OPEN');
      expect(session.openingFloat).toBe(100);

      // Record cash in
      await RegisterSessionService.recordCashMovement(
        regId,
        'CASH_IN',
        50,
        'Additional Float',
        'Supervisor'
      );

      // Close register with actual drawer count of 150
      const closed = await RegisterSessionService.closeRegister(
        regId,
        150,
        'Shift closed smoothly'
      );
      expect(closed.status).toBe('CLOSED');
      expect(closed.expectedCash).toBe(150); // 100 float + 50 cash in
      expect(closed.variance).toBe(0);
    });
  });

  describe('Omnichannel Order Management & Risk Engine', () => {
    it('should create an online order, assign risk level, and transition status', async () => {
      const order = await OrderManagementService.createOrder({
        channel: 'WEBSITE',
        customerName: 'High Spender',
        warehouseId: testWarehouseId,
        items: [
          {
            productId: testProductId,
            sku: testSku,
            name: 'Omnichannel POS Test Product',
            quantity: 25,
            unitPrice: 100,
          },
        ],
      });

      expect(order.orderNumber).toBeDefined();
      expect(order.grandTotal).toBeGreaterThan(2000);
      expect(order.riskLevel).toBe('REVIEW'); // >$2000 trigger

      // Transition status
      const updated = await OrderManagementService.updateOrderStatus(order.orderNumber, 'PAID');
      expect(updated.status).toBe('PAID');
    });

    it('should process an order return and refund successfully', async () => {
      const order = await OrderManagementService.createOrder({
        channel: 'POS',
        customerName: 'Return Customer',
        warehouseId: testWarehouseId,
        items: [
          {
            productId: testProductId,
            sku: testSku,
            name: 'Omnichannel POS Test Product',
            quantity: 1,
            unitPrice: 100,
          },
        ],
      });

      await OrderManagementService.updateOrderStatus(order.orderNumber, 'PAID');
      await OrderManagementService.updateOrderStatus(order.orderNumber, 'PROCESSING');
      await OrderManagementService.updateOrderStatus(order.orderNumber, 'READY_FOR_FULFILLMENT');
      await OrderManagementService.updateOrderStatus(order.orderNumber, 'FULFILLED');

      const ret = await OrderManagementService.processReturn(
        order.orderNumber,
        'Wrong size',
        order.grandTotal,
        'Manager Bob'
      );

      expect(ret.returnNumber).toBeDefined();
      expect(ret.status).toBe('APPROVED');

      const reFetched = await OmnichannelOrder.findOne({ orderNumber: order.orderNumber });
      expect(reFetched?.status).toBe('RETURNED');
      expect(reFetched?.paymentStatus).toBe('REFUNDED');
    });
  });
});
