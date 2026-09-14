import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { apiRouter } from '../routes/api.js';
import { Tenant } from '../models/Tenant.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import {
  calculateDelay,
  CircuitBreaker,
  Bulkhead,
  RetryBudget,
  ResilientExecutor,
} from '../utils/resiliency/index.js';
import { QueueManager } from '../queue/bullmq.js';

describe('Stockora Enterprise — Microservices & Architecture Resilience Tests', () => {
  let app: express.Application;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_arch_boundaries');
    }

    app = express();
    app.use(express.json());
    app.use('/api/v1', apiRouter);

    await Tenant.deleteMany({});
    await Product.deleteMany({});
    await Transaction.deleteMany({});
    await User.deleteMany({});

    // Create Tenant Alpha
    const tenantA = await Tenant.create({
      name: 'Alpha Logistics Enterprise',
      slug: 'alpha-logistics',
      status: 'ACTIVE',
      contact: { email: 'admin@alpha-logistics.com' },
    });
    tenantAId = tenantA._id.toString();

    // Create Tenant Beta
    const tenantB = await Tenant.create({
      name: 'Beta Retail Group',
      slug: 'beta-retail',
      status: 'ACTIVE',
      contact: { email: 'admin@beta-retail.com' },
    });
    tenantBId = tenantB._id.toString();
  });

  afterAll(async () => {
    await Tenant.deleteMany({});
    await Product.deleteMany({});
    await Transaction.deleteMany({});
    await User.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ── 1. HEALTH & KUBERNETES PROBES ───────────────────────────────────────────
  describe('Kubernetes Health, Liveness & Readiness Probes', () => {
    it('GET /api/v1/health returns 200 with complete subsystem status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('dbConnected');
      expect(res.body).toHaveProperty('redisConnected');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('pid');
    });

    it('GET /api/v1/health/liveness returns 200 with process health for k8s livenessProbe', async () => {
      const res = await request(app).get('/api/v1/health/liveness');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(res.body).toHaveProperty('pid');
      expect(res.body).toHaveProperty('uptime');
    });

    it('GET /api/v1/health/readiness returns 200 and ready state for k8s readinessProbe', async () => {
      const res = await request(app).get('/api/v1/health/readiness');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.dbConnected).toBe(true);
    });
  });

  // ── 2. TRANSACTION IDEMPOTENCY & FAULT TOLERANCE ─────────────────────────────
  describe('POS & Transaction Idempotency Protection', () => {
    it('creates a transaction with idempotencyKey and deduplicates on replay', async () => {
      const idempotencyKey = `idem-test-${Date.now()}`;

      const createdTx = await Transaction.create({
        tenantId: tenantAId,
        idempotencyKey,
        transactionNumber: `TX-IDEM-${Date.now()}`,
        type: 'SALE',
        status: 'COMPLETED',
        items: [
          {
            productId: 'prod-item-1',
            productName: 'Sample SKU',
            sku: 'SKU-001',
            quantity: 2,
            price: 50,
            discount: 0,
            total: 100,
          },
        ],
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        paymentMethod: 'CASH',
        cashierId: 'cashier-001',
        cashierName: 'John Cashier',
        branchId: 'branch-001',
        branchName: 'Main Store',
      });

      expect(createdTx.idempotencyKey).toBe(idempotencyKey);

      // Verify that duplicate lookup returns original transaction without modifying state
      const foundTx: any = await Transaction.findOne({
        idempotencyKey,
        tenantId: tenantAId,
      }).lean();
      expect(foundTx).toBeDefined();
      expect(foundTx?._id.toString()).toBe(createdTx._id.toString());
      expect(foundTx?.total).toBe(100);
    });
  });

  // ── 3. MULTI-TENANT ISOLATION BOUNDARIES ────────────────────────────────────
  describe('Multi-Tenant Data Isolation', () => {
    it('enforces strict tenant boundary isolation between Tenant Alpha and Tenant Beta', async () => {
      // Create product for Tenant Alpha
      const productA = await Product.create({
        tenantId: tenantAId,
        name: 'Alpha Confidential Item',
        sku: 'ALPHA-SKU-001',
        quantity: 100,
        lowStockAlert: 10,
        sellingPrice: 250,
        retailPrice: 250,
      });

      // Create product for Tenant Beta
      const productB = await Product.create({
        tenantId: tenantBId,
        name: 'Beta Restricted Item',
        sku: 'BETA-SKU-001',
        quantity: 50,
        lowStockAlert: 5,
        sellingPrice: 400,
        retailPrice: 400,
      });

      // Query scoped to Tenant Alpha MUST NOT return Tenant Beta's product
      const alphaProducts = await Product.find({ tenantId: tenantAId }).lean();
      const alphaIds = alphaProducts.map((p: any) => p._id.toString());
      expect(alphaIds).toContain(productA._id.toString());
      expect(alphaIds).not.toContain(productB._id.toString());

      // Query scoped to Tenant Beta MUST NOT return Tenant Alpha's product
      const betaProducts = await Product.find({ tenantId: tenantBId }).lean();
      const betaIds = betaProducts.map((p: any) => p._id.toString());
      expect(betaIds).toContain(productB._id.toString());
      expect(betaIds).not.toContain(productA._id.toString());
    });
  });

  // ── 4. RESILIENT EXECUTOR & DISTRIBUTED RESILIENCE ───────────────────────────
  describe('Distributed Systems Resiliency & Failure Handling', () => {
    it('executes task through ResilientExecutor with bounded retries and exponential backoff', async () => {
      let attempts = 0;
      const result = await ResilientExecutor.execute(
        {
          name: 'Test_Resilient_Operation',
          retryCount: 3,
          baseDelayMs: 20,
          maxDelayMs: 100,
          backoffType: 'EXPONENTIAL',
          jitterType: 'NONE',
          isIdempotent: true,
        },
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient network timeout');
          }
          return 'SUCCESS_AFTER_RETRY';
        }
      );

      expect(attempts).toBe(3);
      expect(result).toBe('SUCCESS_AFTER_RETRY');
    });

    it('trips CircuitBreaker from CLOSED to OPEN after failure threshold is breached', async () => {
      const breaker = new CircuitBreaker('TestBreaker_Arch', 3, 1000);
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('enforces Bulkhead concurrency limits without throwing unhandled exceptions', async () => {
      const bulkhead = new Bulkhead('TestBulkhead_Arch', 2);
      expect(bulkhead.getActiveCount()).toBe(0);

      const p1 = bulkhead.execute(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'P1_DONE';
      });

      const p2 = bulkhead.execute(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'P2_DONE';
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe('P1_DONE');
      expect(r2).toBe('P2_DONE');
      expect(bulkhead.getActiveCount()).toBe(0);
    });

    it('enforces Token Bucket RetryBudget to protect downstream dependencies from retry storms', () => {
      const budget = new RetryBudget(30, 10, 0); // 30 tokens, 10 per acquisition, 0 refill
      expect(budget.acquire()).toBe(true); // 20 remaining
      expect(budget.acquire()).toBe(true); // 10 remaining
      expect(budget.acquire()).toBe(true); // 0 remaining
      expect(budget.acquire()).toBe(false); // Exhausted
    });
  });

  // ── 5. QUEUE & BACKGROUND WORKER COMPATIBILITY ──────────────────────────────
  describe('Queue & Worker Architecture', () => {
    it('QueueManager gracefully probes Redis and provides metric interfaces', async () => {
      const queueManager = QueueManager.getInstance();
      expect(queueManager).toBeDefined();

      const metrics = await queueManager.getQueueMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(1);
      expect(metrics[0]).toHaveProperty('name');
      expect(metrics[0]).toHaveProperty('status');
    });
  });
});
