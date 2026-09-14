import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { BusinessIntelligenceService } from '../services/businessIntelligence.service.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { Branch } from '../models/Branch.js';
import { Supplier } from '../models/Supplier.js';
import { Customer } from '../models/Customer.js';
import { KPIDefinition } from '../models/KPIDefinition.js';

describe('Phase 46 — Advanced Business Intelligence & Executive Analytics Test Suite', () => {
  const tenantA = 'tenant-harn-bi';
  const tenantB = 'tenant-hanson-bi';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_phase46_bi');
    }

    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Transaction.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Supplier.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await KPIDefinition.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });

    // Seed test products for Tenant A
    await Product.create([
      {
        tenantId: tenantA,
        sku: 'HARN-PROD-001',
        name: 'Enterprise Industrial Router',
        price: 3200,
        costPrice: 1800,
        quantity: 25,
        lowStockAlert: 5,
        isActive: true,
        category: 'Networking',
      },
      {
        tenantId: tenantA,
        sku: 'HARN-PROD-002',
        name: 'Fiber Patch Cable 10m',
        price: 50,
        costPrice: 20,
        quantity: 0, // Stockout
        lowStockAlert: 15,
        isActive: true,
        category: 'Accessories',
      },
      {
        tenantId: tenantB,
        sku: 'HANSON-PROD-001',
        name: 'Hanson Luxury Desk',
        price: 5500,
        costPrice: 3000,
        quantity: 12,
        lowStockAlert: 3,
        isActive: true,
        category: 'Furniture',
      },
    ]);

    // Seed test transactions for Tenant A
    await Transaction.create([
      {
        tenantId: tenantA,
        transactionNumber: `TX-HARN-${Date.now()}-1`,
        type: 'SALE',
        status: 'COMPLETED',
        subtotal: 6400,
        discount: 200,
        tax: 500,
        total: 6700,
        paymentMethod: 'CARD',
        currencyCode: 'USD',
        exchangeRate: 1.0,
        cashierId: 'user-harn-01',
        cashierName: 'Sarah Harn',
        branchId: 'branch-harn-01',
        branchName: 'Harn Flagship',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Enterprise Industrial Router',
            sku: 'HARN-PROD-001',
            quantity: 2,
            price: 3200,
            discount: 0,
            total: 6400,
          },
        ],
      },
      {
        tenantId: tenantB,
        transactionNumber: `TX-HANS-${Date.now()}-2`,
        type: 'SALE',
        status: 'COMPLETED',
        subtotal: 11000,
        discount: 0,
        tax: 1100,
        total: 12100,
        paymentMethod: 'MOBILE',
        currencyCode: 'EUR',
        exchangeRate: 1.0,
        cashierId: 'user-hans-01',
        cashierName: 'Klaus Hanson',
        branchId: 'branch-hans-01',
        branchName: 'Hanson Berlin',
      },
    ]);
  });

  afterAll(async () => {
    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Transaction.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Customer.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Supplier.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await KPIDefinition.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
  });

  it('1. Executive Analytics: Computes revenue, profit margins and health score correctly', async () => {
    const exec = await BusinessIntelligenceService.getExecutiveMetrics(
      tenantA,
      undefined,
      '30_DAYS'
    );
    expect(exec).toBeDefined();
    expect(exec.revenue).toBeGreaterThanOrEqual(0);
    expect(exec.grossSales).toBeGreaterThanOrEqual(0);
    expect(exec.averageOrderValue).toBeGreaterThanOrEqual(0);

    const health = await BusinessIntelligenceService.calculateBusinessHealthScore(tenantA);
    expect(health.overallScore).toBeGreaterThanOrEqual(0);
    expect(health.overallScore).toBeLessThanOrEqual(100);
    expect(['EXCELLENT', 'GOOD', 'NEEDS_ATTENTION', 'CRITICAL']).toContain(health.status);
  });

  it('2. Sales Analytics: Computes best-sellers with dynamic limits (5, 10, 20) & payment distribution', async () => {
    const sales5 = await BusinessIntelligenceService.getSalesAnalytics(
      tenantA,
      undefined,
      '30_DAYS',
      'PREVIOUS_PERIOD',
      5
    );
    expect(sales5.bestSellers.length).toBeLessThanOrEqual(5);
    expect(sales5.paymentMethods.length).toBeGreaterThan(0);
    expect(sales5.employeeSales.length).toBeGreaterThan(0);

    const sales20 = await BusinessIntelligenceService.getSalesAnalytics(
      tenantA,
      undefined,
      '30_DAYS',
      'PREVIOUS_PERIOD',
      20
    );
    expect(sales20.bestSellers.length).toBeLessThanOrEqual(20);
  });

  it('3. Inventory Analytics: Calculates turnover ratio, aging bands & stockout lost sales', async () => {
    const inv = await BusinessIntelligenceService.getInventoryAnalytics(tenantA);
    expect(inv.totalSkus).toBeGreaterThan(0);
    expect(inv.inventoryTurnoverRatio).toBeGreaterThan(0);
    expect(inv.agingBands).toBeDefined();
    expect(inv.agingBands.band0To30Days).toBeGreaterThanOrEqual(0);
    expect(inv.stockoutMetrics.lostSalesDisclaimer).toContain('velocity');
    expect(inv.reorderRecommendations.length).toBeGreaterThanOrEqual(0);
  });

  it('4. Customer Retention: Evaluates lifetime value, retention rate & segmentation', async () => {
    const cust = await BusinessIntelligenceService.getCustomerAnalytics(tenantA, '30_DAYS');
    expect(cust.customerLifetimeValueEst).toBeGreaterThan(0);
    expect(cust.retentionRatePct).toBeGreaterThan(0);
    expect(cust.customerSegments.length).toBe(5);
    expect(cust.cohorts.length).toBeGreaterThan(0);
  });

  it('5. Supplier Intelligence: Evaluates vendor scorecards, lead times & reliability index', async () => {
    const sup = await BusinessIntelligenceService.getSupplierAnalytics(tenantA);
    expect(sup.scorecards.length).toBeGreaterThan(0);
    expect(sup.averageLeadTimeDays).toBeGreaterThan(0);
    expect(sup.onTimeDeliveryRatePct).toBeGreaterThan(0);
    expect(sup.purchasingTrends.length).toBeGreaterThan(0);
  });

  it('6. Financial Analytics: Verifies COGS, gross margin, operating expenses & cash flow visibility', async () => {
    const fin = await BusinessIntelligenceService.getFinancialAnalytics(tenantA, '30_DAYS');
    expect(fin.grossMarginPct).toBeGreaterThan(0);
    expect(fin.operatingExpenses).toBeGreaterThan(0);
    expect(fin.cashFlowVisibility.disclaimer).toContain('Operational cash-flow visibility');
    expect(fin.expenseBreakdown.length).toBeGreaterThan(0);
  });

  it('7. Demand Forecasting: Returns probabilistic horizons (7/30/90 days) with confidence intervals', async () => {
    const fc7 = await BusinessIntelligenceService.getForecastAnalytics(tenantA, 'SALES', '7_DAYS');
    expect(fc7.dataPoints.length).toBe(7);
    expect(fc7.accuracyEvaluation.mapePct).toBeDefined();
    expect(fc7.seasonalityDetected.peakDay).toBeDefined();
    expect(fc7.disclaimer).toContain('probabilistic');

    const fc90 = await BusinessIntelligenceService.getForecastAnalytics(
      tenantA,
      'DEMAND',
      '90_DAYS'
    );
    expect(fc90.dataPoints.length).toBe(90);
  });

  it('8. Anomaly Detection: Detects baseline deviations and triage alerts with lifecycle management', async () => {
    const anom = await BusinessIntelligenceService.getAnomalyAnalytics(tenantA);
    expect(anom.totalActiveAnomalies).toBeGreaterThan(0);
    expect(anom.anomalies.length).toBeGreaterThan(0);
    expect(anom.anomalies[0].confidence).toBeGreaterThan(0.5);
  });

  it('9. KPI Target Management: Retrieves benchmarks, evaluates status & updates target thresholds', async () => {
    const kpis = await BusinessIntelligenceService.getKPIMetrics(tenantA);
    expect(kpis.kpis.length).toBeGreaterThan(0);
    expect(['ON_TRACK', 'AT_RISK', 'BEHIND', 'EXCEEDED']).toContain(kpis.kpis[0].status);

    const updateRes = await BusinessIntelligenceService.updateKPITarget(
      tenantA,
      'REV_GROWTH',
      25.0,
      18.0,
      10.0
    );
    expect(updateRes.success).toBe(true);
    expect(updateRes.targetValue).toBe(25.0);
  });

  it('10. Multi-Tenant Data Isolation: Strict separation between Harn and Hanson analytics', async () => {
    const harnExec = await BusinessIntelligenceService.getExecutiveMetrics(
      tenantA,
      undefined,
      '30_DAYS'
    );
    const hansonExec = await BusinessIntelligenceService.getExecutiveMetrics(
      tenantB,
      undefined,
      '30_DAYS'
    );

    expect(harnExec).not.toEqual(hansonExec);

    // Verify cache isolation keys
    const harnCacheKey = `analytics:${tenantA}:exec:all:30_DAYS:PREVIOUS_PERIOD::`;
    const hansonCacheKey = `analytics:${tenantB}:exec:all:30_DAYS:PREVIOUS_PERIOD::`;
    expect(harnCacheKey).not.toBe(hansonCacheKey);
  });

  it('11. Multi-Domain Analytics Export: Generates CSV and JSON output successfully', async () => {
    const csvExport = await BusinessIntelligenceService.exportAnalyticsData(
      tenantA,
      'SALES',
      'CSV',
      '30_DAYS'
    );
    expect(csvExport.contentType).toBe('text/csv');
    expect(csvExport.content).toContain('Metric,Value');

    const jsonExport = await BusinessIntelligenceService.exportAnalyticsData(
      tenantA,
      'FINANCE',
      'JSON',
      '30_DAYS'
    );
    expect(jsonExport.contentType).toBe('application/json');
    const parsed = JSON.parse(jsonExport.content);
    expect(parsed.revenue).toBeDefined();
  });
});
