import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import request from 'supertest';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Product } from '../models/Product.js';
import { Branch } from '../models/Branch.js';
import { Plan } from '../models/Plan.js';
import { POSService } from '../services/pos.service.js';
import { BillingService } from '../services/billing.service.js';
import { apiRouter } from '../routes/api.js';
import { posRouter } from '../routes/pos.routes.js';
import { billingRouter } from '../routes/billing.routes.js';
import { errorHandler } from '../errors/handlers.js';
import { AuthService } from '../services/auth.service.js';

let app: Express;
let testTenant: any;
let testUser: any;
let testToken: string;
let testBranch: any;
let testProduct: any;
let testPlan: any;

describe('POS Payment Separation & Architecture Boundary Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const mongoUri = 'mongodb://127.0.0.1:27017/stockora_test_pos_separation';
    await mongoose.connect(mongoUri);

    app = express();
    app.use(express.json());
    app.use('/api/v1/pos', posRouter);
    app.use('/api/v1/billing', billingRouter);
    app.use('/api/v1', apiRouter);
    app.use(errorHandler);

    // Clean test data
    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Product.deleteMany({}),
      Branch.deleteMany({}),
      Plan.deleteMany({}),
    ]);

    // Create Tenant
    testTenant = await Tenant.create({
      name: 'Separation Test Corp',
      slug: 'sep-test-corp',
      status: 'ACTIVE',
      contact: {
        email: 'billing@septest.com',
        phone: '+1234567890',
        addressLine1: '100 Market St',
        city: 'City',
        state: 'State',
        country: 'US',
        postalCode: '10001',
      },
    });

    // Create Cashier / Manager Role
    const cashierRole = await Role.create({
      name: 'Cashier',
      permissions: ['pos:access', 'pos:sales', 'inventory:view'],
      tenantId: testTenant._id,
      isSystem: false,
    });

    // Create User
    testUser = await User.create({
      username: 'pos_cashier',
      email: 'pos_cashier@septest.com',
      password: 'hash123456',
      tenantId: testTenant._id,
      roleName: 'Cashier',
    });

    testToken = AuthService.generateAccessToken(testUser);

    // Create Branch
    testBranch = await Branch.create({
      name: 'Main POS Branch',
      code: 'MAIN-POS',
      tenantId: testTenant._id,
      isActive: true,
      address: '100 Market St',
    });

    // Create Product
    testProduct = await Product.create({
      name: 'POS Demo Item',
      sku: 'POS-DEMO-001',
      sellingPrice: 1500,
      costPrice: 1000,
      price: 1500,
      quantity: 50,
      category: 'Electronics',
      tenantId: testTenant._id,
      isActive: true,
    });

    // Create Subscription Plan
    testPlan = await Plan.create({
      name: 'Enterprise Scale',
      slug: 'enterprise-scale',
      tier: 'ENTERPRISE',
      price: 50000,
      currency: 'NGN',
      status: 'ACTIVE',
      limits: { maxUsers: 50, maxBranches: 10, maxProducts: 10000 },
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('1. POS Manual In-Person Tenders (Allowed)', () => {
    it('1.1 POS Cash Payment: processes sale, calculates change, and reduces stock', async () => {
      const initialStock = (await Product.findById(testProduct._id))!.quantity;

      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 2, unitPrice: 1500 }],
          paymentMethod: 'CASH',
          amountTendered: 4000, // Total = 3000 + 7% tax = 3210 -> Change = 790
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('PAID');
      expect(res.body.data.payments[0].paymentMethod).toBe('CASH');

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct!.quantity).toBe(initialStock - 2);
    });

    it('1.2 POS Bank/Mobile Transfer: records manual transfer without calling online gateways', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 1, unitPrice: 1500 }],
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TRF-ALERT-982341',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('PAID');
      expect(res.body.data.payments[0].paymentMethod).toBe('BANK_TRANSFER');
      expect(res.body.data.payments[0].referenceNumber).toBe('TRF-ALERT-982341');
    });

    it('1.3 POS Physical Card: records cashier card terminal confirmation without Stripe/Paystack', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 1, unitPrice: 1500 }],
          paymentMethod: 'CARD',
          referenceNumber: 'RRN-SLIP-554433',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('PAID');
      expect(res.body.data.payments[0].paymentMethod).toBe('CARD');
      expect(res.body.data.payments[0].referenceNumber).toBe('RRN-SLIP-554433');
    });
  });

  describe('2. Forbidden POS Methods & Architecture Boundary Enforcement', () => {
    it('2.1 Rejects Paystack paymentMethod on POS checkout', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 1, unitPrice: 1500 }],
          paymentMethod: 'PAYSTACK',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not permitted for in-person POS sales');
    });

    it('2.2 Rejects Stripe paymentMethod on POS checkout', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 1, unitPrice: 1500 }],
          paymentMethod: 'STRIPE',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not permitted for in-person POS sales');
    });

    it('2.3 Rejects Split Payments on POS checkout (multiple tender allocations)', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 1, unitPrice: 1500 }],
          payments: [
            { paymentMethod: 'CASH', amount: 1000 },
            { paymentMethod: 'CARD', amount: 605 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Split payment is forbidden in POS');
    });

    it('2.4 Rejects Insufficient Cash Tender on POS checkout', async () => {
      const res = await request(app)
        .post('/api/v1/pos/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          branchId: testBranch._id.toString(),
          warehouseId: testBranch._id.toString(),
          cashierId: testUser._id.toString(),
          cashierName: 'POS Cashier',
          items: [{ productId: testProduct._id.toString(), quantity: 1, unitPrice: 1500 }],
          paymentMethod: 'CASH',
          amountTendered: 500, // Total is ~1605
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient cash received');
    });
  });

  describe('3. Company Subscription Billing Gateway Retention & Multi-Provider Support', () => {
    it('3.1 Company subscription endpoint accepts Plan checkout initialization via Paystack', async () => {
      const res = await request(app)
        .post('/api/v1/billing/subscription/initialize')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          planId: testPlan._id.toString(),
          billingInterval: 'MONTHLY',
          provider: 'PAYSTACK',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reference).toBeDefined();
      expect(res.body.data.amount).toBe(53750);
      expect(res.body.data.provider).toBe('PAYSTACK');
    });

    it('3.2 Company subscription endpoint accepts Plan checkout initialization via Stripe', async () => {
      const res = await request(app)
        .post('/api/v1/billing/subscription/initialize')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          planId: testPlan.slug,
          billingInterval: 'MONTHLY',
          provider: 'STRIPE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reference).toBeDefined();
      expect(res.body.data.provider).toBe('STRIPE');
    });

    it('3.3 Returns 404 for non-existent subscription plan', async () => {
      const res = await request(app)
        .post('/api/v1/billing/subscription/initialize')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          planId: 'non-existent-plan-id',
          billingInterval: 'MONTHLY',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('4. POS /transactions API Contract Validation', () => {
    it('4.1 Successfully records a CASH sale via /api/v1/transactions', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          items: [
            {
              productId: testProduct._id.toString(),
              productName: testProduct.name,
              sku: testProduct.sku,
              quantity: 1,
              price: 1500,
              discount: 0,
              total: 1500,
            },
          ],
          paymentMethod: 'CASH',
          subtotal: 1500,
          tax: 112.5,
          discount: 0,
          total: 1612.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.paymentMethod).toBe('CASH');
      expect(res.body.status).toBe('COMPLETED');
    });

    it('4.2 Successfully records a BANK_TRANSFER sale via /api/v1/transactions', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          items: [
            {
              productId: testProduct._id.toString(),
              productName: testProduct.name,
              sku: testProduct.sku,
              quantity: 1,
              price: 1500,
              discount: 0,
              total: 1500,
            },
          ],
          paymentMethod: 'BANK_TRANSFER',
          subtotal: 1500,
          tax: 112.5,
          discount: 0,
          total: 1612.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.paymentMethod).toBe('BANK_TRANSFER');
      expect(res.body.status).toBe('COMPLETED');
    });

    it('4.3 Rejects PAYSTACK or STRIPE on /api/v1/transactions', async () => {
      const res = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          items: [
            {
              productId: testProduct._id.toString(),
              productName: testProduct.name,
              sku: testProduct.sku,
              quantity: 1,
              price: 1500,
              discount: 0,
              total: 1500,
            },
          ],
          paymentMethod: 'PAYSTACK',
          subtotal: 1500,
          tax: 112.5,
          discount: 0,
          total: 1612.5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
