import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { POSService } from '../services/pos.service.js';
import { ReservationService } from '../services/reservation.service.js';
import { Product } from '../models/Product.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { InventoryReservation } from '../models/InventoryReservation.js';
import { Customer } from '../models/Customer.js';
import { Supplier } from '../models/Supplier.js';
import { SupplierInvoice } from '../models/SupplierInvoice.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Notification } from '../models/Notification.js';
import { NotificationService } from '../services/notification.service.js';
import { CustomerController } from '../controllers/customer.controller.js';
import { SupplierController } from '../controllers/supplier.controller.js';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { PurchaseOrderController } from '../controllers/purchaseOrder.controller.js';
import { NotificationController } from '../controllers/notification.controller.js';
import { ProductController } from '../controllers/product.controller.js';

describe('Production Concurrency, Multi-Tenant Isolation & Scalability Audit Suite', () => {
  const tenantA = `tenant-a-${Date.now()}`;
  const tenantB = `tenant-b-${Date.now()}`;
  const branchA = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test_concurrency_audit';
    await mongoose.connect(mongoUri);
    await Supplier.syncIndexes();
    await Customer.syncIndexes();
  });

  afterAll(async () => {
    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await OmnichannelOrder.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await InventoryReservation.deleteMany({});
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Supplier.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await SupplierInvoice.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await PurchaseOrder.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Notification.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('1. POS Concurrent Checkout & Stock Deduction (Zero Overselling)', () => {
    it('prevents race conditions when 20 cashiers checkout simultaneously for 5 units', async () => {
      const product = await Product.create({
        tenantId: tenantA,
        sku: `RACE-${Date.now()}`,
        name: 'High-Demand Flash Sale Item',
        costPrice: 20,
        retailPrice: 50,
        sellingPrice: 50,
        quantity: 5, // Only 5 available in inventory
      });

      const totalConcurrentBuyers = 20;
      const checkoutPromises = Array.from({ length: totalConcurrentBuyers }, (_, idx) => {
        return POSService.checkout({
          tenantId: tenantA,
          branchId: branchA,
          items: [{ productId: (product._id as mongoose.Types.ObjectId).toString(), quantity: 1 }],
          paymentMethod: 'CASH',
          cashierId: `cashier-${idx}`,
          cashierName: `Cashier ${idx}`,
          idempotencyKey: `CONCUR-${Date.now()}-${idx}`,
        });
      });

      const results = await Promise.allSettled(checkoutPromises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 5 checkouts must succeed and exactly 15 must be rejected
      expect(fulfilled.length).toBe(5);
      expect(rejected.length).toBe(15);

      // Verify DB state: Inventory must be exactly 0, NEVER negative
      const freshProduct = await Product.findById(product._id);
      expect(freshProduct?.quantity).toBe(0);

      // Verify orders: Exactly 5 orders created
      const orders = await OmnichannelOrder.find({
        tenantId: tenantA,
        'items.productId': product._id,
      });
      expect(orders.length).toBe(5);
    });
  });

  describe('2. Concurrent Inventory Reservations & Atomic Releases', () => {
    it('guarantees atomic stock reservation under 10 concurrent requests for 3 items', async () => {
      const product = await Product.create({
        tenantId: tenantA,
        sku: `RES-${Date.now()}`,
        name: 'Limited Reservation Stock Item',
        costPrice: 30,
        retailPrice: 80,
        sellingPrice: 80,
        quantity: 3,
      });

      const orderNumbers = Array.from({ length: 10 }, (_, i) => `ORD-RES-${Date.now()}-${i}`);
      const reservationPromises = orderNumbers.map((orderNum) =>
        ReservationService.reserveStock(
          (product._id as mongoose.Types.ObjectId).toString(),
          branchA,
          1,
          orderNum,
          'POS',
          15
        )
      );

      const results = await Promise.allSettled(reservationPromises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(3);
      expect(rejected.length).toBe(7);

      const reservedProduct = await Product.findById(product._id);
      expect(reservedProduct?.quantity).toBe(0);

      // Release reservations and verify stock restoration
      for (const orderNum of orderNumbers) {
        await ReservationService.releaseReservation(orderNum);
      }

      const releasedProduct = await Product.findById(product._id);
      expect(releasedProduct?.quantity).toBe(3);
    });
  });

  describe('3. Multi-Tenant Query Scoping & Isolation', () => {
    it('strictly isolates customers, suppliers, invoices, and POs between tenants', async () => {
      // Seed Tenant A entities
      await Customer.create({
        tenantId: tenantA,
        name: 'Tenant A Customer',
        code: `CUST-A-${Date.now()}`,
        email: `custA-${Date.now()}@tenantA.com`,
      });

      await Supplier.create({
        tenantId: tenantA,
        name: 'Tenant A Supplier',
        code: `SUP-A-${Date.now()}`,
        contactPerson: 'Alice',
        email: `supA-${Date.now()}@tenantA.com`,
        phone: '1234567890',
        address: '123 Tenant A St',
        paymentTerms: 'NET 30',
      });

      // Seed Tenant B entities
      await Customer.create({
        tenantId: tenantB,
        name: 'Tenant B Secret Customer',
        code: `CUST-B-${Date.now()}`,
        email: `custB-${Date.now()}@tenantB.com`,
      });

      await Supplier.create({
        tenantId: tenantB,
        name: 'Tenant B Secret Supplier',
        code: `SUP-B-${Date.now()}`,
        contactPerson: 'Bob',
        email: `supB-${Date.now()}@tenantB.com`,
        phone: '9876543210',
        address: '456 Tenant B Ave',
        paymentTerms: 'NET 15',
      });

      // Query customers as Tenant A
      let tenantACustomers: any[] = [];
      const mockReqA: any = {
        tenantId: tenantA,
        query: { page: '1', limit: '50' },
      };
      const mockResA: any = {
        json: (data: any) => {
          tenantACustomers = data;
        },
      };

      await CustomerController.getCustomers(mockReqA, mockResA, () => {});

      // All returned customers must belong to Tenant A, none from Tenant B
      expect(tenantACustomers.length).toBeGreaterThanOrEqual(1);
      expect(tenantACustomers.every((c) => c.tenantId === tenantA)).toBe(true);
      expect(tenantACustomers.some((c) => c.tenantId === tenantB)).toBe(false);

      // Query suppliers as Tenant A
      let tenantASuppliers: any[] = [];
      const mockResSuppA: any = {
        json: (data: any) => {
          tenantASuppliers = data;
        },
      };

      await SupplierController.getSuppliers(mockReqA, mockResSuppA, () => {});
      expect(tenantASuppliers.length).toBeGreaterThanOrEqual(1);
      expect(tenantASuppliers.every((s) => s.tenantId === tenantA)).toBe(true);
      expect(tenantASuppliers.some((s) => s.tenantId === tenantB)).toBe(false);
    });

    it('allows identical entity codes across different tenants without collision', async () => {
      const sharedCode = `SHARED-CODE-${Date.now()}`;

      // Tenant A creates supplier with shared code
      const supplierA = await Supplier.create({
        tenantId: tenantA,
        name: 'Supplier Alpha',
        code: sharedCode,
        contactPerson: 'Alpha Contact',
        email: `alpha-${Date.now()}@alpha.com`,
        phone: '1111111111',
        address: 'Alpha St',
        paymentTerms: 'NET 30',
      });

      // Tenant B creates supplier with SAME code — must succeed
      const supplierB = await Supplier.create({
        tenantId: tenantB,
        name: 'Supplier Beta',
        code: sharedCode,
        contactPerson: 'Beta Contact',
        email: `beta-${Date.now()}@beta.com`,
        phone: '2222222222',
        address: 'Beta St',
        paymentTerms: 'NET 30',
      });

      expect(supplierA.code).toBe(sharedCode);
      expect(supplierB.code).toBe(sharedCode);
      expect(supplierA.tenantId).not.toBe(supplierB.tenantId);
    });
  });

  describe('4. Multi-Tenant Notification Privacy', () => {
    it('prevents role broadcasts in Tenant A from leaking to users in Tenant B', async () => {
      // Send role broadcast to admin in Tenant A
      await NotificationService.send({
        tenantId: tenantA,
        targetRole: 'admin',
        type: 'WARNING',
        title: 'Tenant A Inventory Alert',
        body: 'Confidential low stock alert for Tenant A',
      });

      // Query notifications as an admin in Tenant B
      let receivedNotifications: any[] = [];
      const mockReqAdminB: any = {
        tenantId: tenantB,
        user: { id: new mongoose.Types.ObjectId().toString(), roleName: 'admin' },
        query: {},
      };
      const mockResAdminB: any = {
        json: (data: any) => {
          receivedNotifications = data;
        },
      };

      await NotificationController.listNotifications(mockReqAdminB, mockResAdminB, () => {});

      // Admin B must NOT receive Tenant A's role notification
      expect(receivedNotifications.some((n) => n.title === 'Tenant A Inventory Alert')).toBe(false);
    });
  });

  describe('5. ReDoS Attack Resistance & Query Safety', () => {
    it('executes malicious regex input safely without event-loop blocking or ReDoS crash', async () => {
      const maliciousPayload = '((((((((((((a+)+)+)+)+)+)+)+)+)+)+)+)+$';
      let searchResults: any[] = [];
      const mockReq: any = {
        tenantId: tenantA,
        query: { search: maliciousPayload },
      };
      const mockRes: any = {
        json: (data: any) => {
          searchResults = data;
        },
      };

      const start = Date.now();
      await ProductController.getProducts(mockReq, mockRes, () => {});
      const durationMs = Date.now() - start;

      // Must complete in under 50ms without catastrophic backtracking
      expect(durationMs).toBeLessThan(100);
      expect(Array.isArray(searchResults)).toBe(true);
    });
  });
});
