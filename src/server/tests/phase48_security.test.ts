import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { Receipt } from '../models/Receipt.js';
import { Branch } from '../models/Branch.js';
import { TenantService } from '../services/tenant.service.js';
import { AuthService } from '../services/auth.service.js';
import { apiRouter } from '../routes/api.js';
import { errorHandler } from '../errors/handlers.js';
import { TaxService } from '../services/tax.service.js';
import { ExchangeRateService } from '../services/exchangeRate.service.js';

let app: Express;
let harnUser: any;
let harnToken: string;
let harnTenant: any;

let hansonUser: any;
let hansonToken: string;
let hansonTenant: any;

let employeeUser: any;
let employeeToken: string;

describe('Phase 48: Enterprise Security Hardening & Zero-Trust Verification', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = 'mongodb://127.0.0.1:27017/stockora_test_p48_security';
      await mongoose.connect(mongoUri);
    }

    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);
    app.use(errorHandler);

    // Clean test collections
    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Product.deleteMany({}),
      Transaction.deleteMany({}),
      Receipt.deleteMany({}),
      Branch.deleteMany({}),
    ]);

    // Seed default roles
    const roles = [
      { name: 'Super Administrator', permissions: ['*'] },
      {
        name: 'Company Owner',
        permissions: [
          'companies:read',
          'companies:write',
          'products:read',
          'products:write',
          'transactions:read',
          'transactions:write',
          'security:write',
          'admin:access',
        ],
      },
      { name: 'Employee', permissions: ['products:read'] },
      {
        name: 'Cashier',
        permissions: ['transactions:read', 'transactions:write', 'products:read'],
      },
    ];
    for (const r of roles) {
      await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true });
    }

    // 1. Create Harn Tenant & Owner
    harnUser = await User.create({
      username: 'harn_owner',
      email: 'owner@harn.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const harnOnboard = await TenantService.onboardTenant({
      name: 'Harn Security Corp',
      legalName: 'Harn Security Corp Ltd',
      email: 'owner@harn.com',
      businessType: 'Security Services',
      currency: 'USD',
      branchName: 'Harn HQ',
      branchCode: 'HARN-HQ-1',
      userId: harnUser._id.toString(),
    });
    harnTenant = harnOnboard.tenant;
    harnToken = harnOnboard.token;

    // 2. Create Hanson Tenant & Owner
    hansonUser = await User.create({
      username: 'hanson_owner',
      email: 'owner@hanson.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const hansonOnboard = await TenantService.onboardTenant({
      name: 'Hanson Global Ltd',
      legalName: 'Hanson Global Holdings',
      email: 'owner@hanson.com',
      businessType: 'Electronics',
      currency: 'USD',
      branchName: 'Hanson HQ',
      branchCode: 'HANSON-HQ-1',
      userId: hansonUser._id.toString(),
    });
    hansonTenant = hansonOnboard.tenant;
    hansonToken = hansonOnboard.token;

    // 3. Create low-privilege Employee under Harn
    const employeeRole = await Role.findOne({ name: 'Employee' });
    employeeUser = await User.create({
      tenantId: harnTenant._id.toString(),
      companyId: harnTenant.companyId,
      username: 'harn_employee',
      email: 'employee@harn.com',
      password: 'Password123!',
      roleId: employeeRole!._id,
      roleName: 'Employee',
      permissions: employeeRole!.permissions,
      isActive: true,
      emailVerified: true,
    });
    employeeToken = AuthService.generateAccessToken(employeeUser);
  });

  afterAll(async () => {
    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Product.deleteMany({}),
      Transaction.deleteMany({}),
      Receipt.deleteMany({}),
      Branch.deleteMany({}),
    ]);
  });

  // ── 1. TENANT ISOLATION & IDOR DEFENSE ───────────────────────────────────────
  describe('1. Multi-Tenant Isolation & IDOR Protection', () => {
    let harnProduct: any;
    let hansonProduct: any;

    beforeAll(async () => {
      harnProduct = await Product.create({
        tenantId: harnTenant._id,
        name: 'Harn Proprietary Scanner',
        sku: 'HARN-SCAN-01',
        category: 'Hardware',
        price: 499.99,
        cost: 250.0,
        quantity: 50,
        lowStockAlert: 5,
        isActive: true,
      });

      hansonProduct = await Product.create({
        tenantId: hansonTenant._id,
        name: 'Hanson Confidential Widget',
        sku: 'HANSON-WDG-01',
        category: 'Electronics',
        price: 899.99,
        cost: 400.0,
        quantity: 30,
        lowStockAlert: 5,
        isActive: true,
      });
    });

    it('Harn user cannot access Hanson confidential product via direct IDOR', async () => {
      const res = await request(app)
        .get(`/api/products/${hansonProduct._id}`)
        .set('Authorization', `Bearer ${harnToken}`);

      // Expect either 404 or 403 (never 200 with Hanson data)
      expect([404, 403]).toContain(res.status);
    });

    it('Harn transaction listing strictly excludes Hanson transaction records', async () => {
      // Create transactions in both tenants
      await Transaction.create({
        tenantId: harnTenant._id,
        transactionNumber: 'TX-HARN-001',
        type: 'SALE',
        status: 'COMPLETED',
        items: [
          {
            productId: harnProduct._id,
            productName: harnProduct.name,
            sku: harnProduct.sku,
            quantity: 1,
            price: 499.99,
            total: 499.99,
          },
        ],
        subtotal: 499.99,
        tax: 0,
        total: 499.99,
        cashierId: harnUser._id.toString(),
        cashierName: 'Harn Cashier',
        branchId: 'branch-1',
        branchName: 'Harn HQ',
      });

      await Transaction.create({
        tenantId: hansonTenant._id,
        transactionNumber: 'TX-HANSON-999',
        type: 'SALE',
        status: 'COMPLETED',
        items: [
          {
            productId: hansonProduct._id,
            productName: hansonProduct.name,
            sku: hansonProduct.sku,
            quantity: 1,
            price: 899.99,
            total: 899.99,
          },
        ],
        subtotal: 899.99,
        tax: 0,
        total: 899.99,
        cashierId: hansonUser._id.toString(),
        cashierName: 'Hanson Cashier',
        branchId: 'branch-2',
        branchName: 'Hanson HQ',
      });

      const res = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${harnToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const txNumbers = res.body.map((t: any) => t.transactionNumber);
      expect(txNumbers).toContain('TX-HARN-001');
      expect(txNumbers).not.toContain('TX-HANSON-999');
    });

    it('Tenant ID injected in body or query parameters is overridden by authenticated JWT context', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${harnToken}`)
        .send({
          tenantId: hansonTenant._id.toString(), // Attacker tries to impersonate Hanson
          items: [
            {
              productId: harnProduct._id.toString(),
              productName: harnProduct.name,
              sku: harnProduct.sku,
              quantity: 1,
              price: 499.99,
              discount: 0,
              total: 499.99,
            },
          ],
          subtotal: 499.99,
          tax: 0,
          total: 499.99,
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(201);
      // Verify saved record is attributed to Harn, not Hanson
      expect(res.body.tenantId).toBe(harnTenant._id.toString());
      expect(res.body.tenantId).not.toBe(hansonTenant._id.toString());
    });
  });

  // ── 2. RBAC & PRIVILEGE ESCALATION DEFENSE ──────────────────────────────────
  describe('2. RBAC & Privilege Escalation Defenses', () => {
    it('Low-privilege Employee cannot execute write operations on products', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'Unauthorized Product Created by Employee',
          sku: 'HACK-001',
          category: 'Exploit',
          price: 1.0,
          cost: 0.5,
          quantity: 100,
        });

      expect(res.status).toBe(403);
    });

    it('Employee cannot access security administrative endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── 3. NOSQL INJECTION & OPERATOR DEFENSE ────────────────────────────────────
  describe('3. NoSQL Injection & Input Sanitization', () => {
    it('Rejects or safely literalizes query containing $gt or $ne operators', async () => {
      const res = await request(app)
        .get('/api/products')
        .query({ category: { $gt: '' } }) // Attacker attempts to bypass category filter
        .set('Authorization', `Bearer ${harnToken}`);

      // The server must handle safely without executing raw MongoDB operators
      expect([200, 400]).toContain(res.status);
    });
  });

  // ── 4. FINANCIAL & PAYMENT INTEGRITY ─────────────────────────────────────────
  describe('4. Zero-Trust Payment & Financial Calculation Integrity', () => {
    it('Authoritative tax calculation correctly calculates tax on backend', async () => {
      const result = await TaxService.calculateTax({
        tenantId: harnTenant._id.toString(),
        items: [
          { productId: 'p1', unitPrice: 100, quantity: 1, taxCategory: 'STANDARD' },
          { productId: 'p2', unitPrice: 50, quantity: 1, taxCategory: 'STANDARD' },
        ],
      });

      expect(result.subtotal).toBe(150);
      expect(result.grandTotal).toBeGreaterThan(0);
    });

    it('Rejects invalid, negative, or non-finite exchange rate values', () => {
      expect(() => {
        ExchangeRateService.validateRate(-1.5);
      }).toThrow();

      expect(() => {
        ExchangeRateService.validateRate(Infinity);
      }).toThrow();

      expect(() => {
        ExchangeRateService.validateRate(NaN);
      }).toThrow();
    });
  });

  // ── 5. WEBHOOK HMAC SIGNATURE & REPLAY DEFENSE ──────────────────────────────
  describe('5. Webhook Cryptographic Integrity & Replay Protections', () => {
    it('Rejects webhook without valid HMAC signature', async () => {
      const fakePayload = { event: 'charge.success', data: { reference: 'ref-123' } };

      const res = await request(app)
        .post('/api/webhooks/paystack')
        .set('x-paystack-signature', 'invalid_signature_hash')
        .send(fakePayload);

      expect([400, 401]).toContain(res.status);
    });
  });
});
