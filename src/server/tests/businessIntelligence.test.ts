import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { BusinessIntelligenceService } from '../services/businessIntelligence.service.js';
import { DecisionIntelligenceService } from '../services/ai/decisionIntelligence.service.js';
import { BusinessAlertService } from '../services/businessAlert.service.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { Branch } from '../models/Branch.js';
import { Supplier } from '../models/Supplier.js';
import { Customer } from '../models/Customer.js';

describe('Phase 40 — Advanced Business Intelligence & Decision Intelligence Tests', () => {
  const tenantA = 'tenant-test-a';
  const tenantB = 'tenant-test-b';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }

    // Seed test products
    await Product.create([
      {
        tenantId: tenantA,
        sku: 'TEST-SKU-001',
        name: 'Enterprise Server Rack',
        price: 2500,
        costPrice: 1500,
        quantity: 15,
        lowStockAlert: 5,
        isActive: true,
        category: 'Hardware',
      },
      {
        tenantId: tenantA,
        sku: 'TEST-SKU-002',
        name: 'Network Switch 48-Port',
        price: 800,
        costPrice: 400,
        quantity: 0, // Stockout
        lowStockAlert: 10,
        isActive: true,
        category: 'Networking',
      },
      {
        tenantId: tenantB,
        sku: 'TENANT-B-SKU',
        name: 'Tenant B Product',
        price: 100,
        costPrice: 50,
        quantity: 50,
        lowStockAlert: 5,
        isActive: true,
        category: 'Office',
      },
    ]);

    // Seed test transactions
    await Transaction.create([
      {
        tenantId: tenantA,
        transactionNumber: `TX-BI-${Date.now()}-1`,
        type: 'SALE',
        status: 'COMPLETED',
        subtotal: 2500,
        discount: 100,
        tax: 200,
        total: 2600,
        paymentMethod: 'CARD',
        currencyCode: 'USD',
        exchangeRate: 1.0,
        cashierId: 'user-01',
        cashierName: 'Jane Doe',
        branchId: 'branch-01',
        branchName: 'Main HQ',
        items: [
          {
            productId: '64d4b1a4c9b841a4c9b84001',
            productName: 'Enterprise Server Rack',
            sku: 'TEST-SKU-001',
            quantity: 1,
            price: 2500,
            discount: 0,
            total: 2500,
          },
        ],
      },
      {
        tenantId: tenantB,
        transactionNumber: `TX-BI-${Date.now()}-2`,
        type: 'SALE',
        status: 'COMPLETED',
        subtotal: 5000,
        discount: 0,
        tax: 0,
        total: 5000,
        paymentMethod: 'CASH',
        currencyCode: 'USD',
        exchangeRate: 1.0,
        cashierId: 'user-02',
        cashierName: 'John Smith',
        branchId: 'branch-02',
        branchName: 'Branch B',
        items: [
          {
            productId: '64d4b1a4c9b841a4c9b84002',
            productName: 'Tenant B Product',
            sku: 'TENANT-B-SKU',
            quantity: 50,
            price: 100,
            discount: 0,
            total: 5000,
          },
        ],
      },
    ]);

    // Invalidate tenant cache to ensure fresh aggregation
    await BusinessIntelligenceService.invalidateTenantCache(tenantA);
    await BusinessIntelligenceService.invalidateTenantCache(tenantB);
  });

  afterAll(async () => {
    await Product.deleteMany({ sku: { $in: ['TEST-SKU-001', 'TEST-SKU-002', 'TENANT-B-SKU'] } });
    await Transaction.deleteMany({ transactionNumber: { $regex: /^TX-BI-/ } });
  });

  it('1. should accurately aggregate executive revenue and gross margin metrics', async () => {
    const metrics = await BusinessIntelligenceService.getExecutiveMetrics(
      tenantA,
      undefined,
      '30_DAYS'
    );

    expect(metrics).toBeDefined();
    expect(metrics.revenue).toBeGreaterThanOrEqual(2600);
    expect(metrics.totalTransactions).toBeGreaterThanOrEqual(1);
    expect(metrics.inventoryAssetValue).toBeGreaterThan(0);
    expect(metrics.stockoutRatePct).toBeGreaterThan(0);
    expect(metrics.comparison).toBeDefined();
    expect(typeof metrics.comparison.revenueGrowthPct).toBe('number');
  });

  it('2. should enforce multi-tenant boundary isolation across analytics calculations', async () => {
    const metricsA = await BusinessIntelligenceService.getExecutiveMetrics(tenantA);
    const metricsB = await BusinessIntelligenceService.getExecutiveMetrics(tenantB);

    expect(metricsA).toBeDefined();
    expect(metricsB).toBeDefined();
    // Verify tenant calculations don't bleed
    expect(metricsA.revenue).not.toEqual(metricsB.revenue);
  });

  it('3. should generate valid sales trends and channel aggregations', async () => {
    const trend = await BusinessIntelligenceService.getSalesTrend(
      tenantA,
      undefined,
      '30_DAYS',
      'DAILY'
    );
    expect(Array.isArray(trend)).toBe(true);
    expect(trend.length).toBeGreaterThan(0);

    const channels = await BusinessIntelligenceService.getSalesChannels(tenantA, '30_DAYS');
    expect(Array.isArray(channels)).toBe(true);
    expect(channels.some((c) => c.channel === 'POS')).toBe(true);
  });

  it('4. should compute BCG product matrix with Star/Cash Cow/Question Mark/Dog classification', async () => {
    const matrix = await BusinessIntelligenceService.getProductBCGMatrix(tenantA);
    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix.length).toBeGreaterThan(0);
    const sample = matrix[0];
    expect(sample).toHaveProperty('quadrant');
    expect(['STAR', 'CASH_COW', 'QUESTION_MARK', 'DOG']).toContain(sample.quadrant);
  });

  it('5. should compute customer monthly cohort retention matrix', async () => {
    const cohorts = await BusinessIntelligenceService.getCustomerCohorts(tenantA);
    expect(Array.isArray(cohorts)).toBe(true);
    expect(cohorts.length).toBeGreaterThan(0);
    expect(cohorts[0].activityByMonth.length).toBeGreaterThan(0);
    expect(cohorts[0].activityByMonth[0].retentionRatePct).toBe(100);
  });

  it('6. should evaluate supplier performance scorecards with transparent formulas', async () => {
    const scorecards = await BusinessIntelligenceService.getSupplierScorecards(tenantA);
    expect(Array.isArray(scorecards)).toBe(true);
    expect(scorecards.length).toBeGreaterThan(0);
    const score = scorecards[0];
    expect(score.onTimeDeliveryRatePct).toBeGreaterThan(0);
    expect(score.reliabilityOverallScorePct).toBeGreaterThan(0);
  });

  it('7. should calculate transparent multi-factor business health score', async () => {
    const health = await BusinessIntelligenceService.calculateBusinessHealthScore(tenantA);
    expect(health.overallScore).toBeGreaterThanOrEqual(0);
    expect(health.overallScore).toBeLessThanOrEqual(100);
    expect(['EXCELLENT', 'GOOD', 'NEEDS_ATTENTION', 'CRITICAL']).toContain(health.status);
    expect(health.breakdown.salesScore).toBeGreaterThan(0);
    expect(health.methodologyNotes.length).toBe(7);
  });

  it('8. should execute What-If Price Elasticity simulation accurately', async () => {
    const testProd = await Product.findOne({ sku: 'TEST-SKU-001' });
    const simulation = await DecisionIntelligenceService.simulatePriceChange(
      testProd?._id.toString() || '64d4b1a4c9b841a4c9b84001',
      5 // +5% price change
    );

    expect(simulation).toBeDefined();
    expect(simulation.percentageChange).toBe(5);
    expect(simulation.simulatedPrice).toBeGreaterThan(simulation.currentPrice);
    expect(simulation.assumptions.length).toBeGreaterThan(0);
  });

  it('9. should scan business anomalies and generate intelligence alerts', async () => {
    const alerts = await BusinessAlertService.scanAndGenerateAlerts(tenantA);
    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBeGreaterThan(0);

    const hasStockoutAlert = alerts.some((a) => a.category === 'STOCKOUT_RISK');
    expect(hasStockoutAlert).toBe(true);
  });

  it('10. should generate an executive morning briefing with verified metrics', async () => {
    const briefing = await DecisionIntelligenceService.generateDailyBriefing(tenantA);
    expect(briefing).toBeDefined();
    expect(briefing.yesterdayPerformance).toBeDefined();
    expect(briefing.criticalInventoryAlerts.length).toBeGreaterThan(0);
    expect(briefing.actionItems.length).toBeGreaterThan(0);
  });
});
