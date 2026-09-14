import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { ReportingService } from '../services/reporting.service.js';
import { SavedReport } from '../models/SavedReport.js';
import { ScheduledReport } from '../models/ScheduledReport.js';
import { ReportTemplate } from '../models/ReportTemplate.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { redis } from '../database/redis.js';

describe('Phase 23 Enterprise Reporting Integration tests', () => {
  const companyId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  let templateId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_reports');
    }
    await Promise.all([
      ReportTemplate.deleteMany({}),
      Product.deleteMany({}),
      Transaction.deleteMany({}),
      SavedReport.deleteMany({}),
      ScheduledReport.deleteMany({}),
    ]);
    try {
      await redis.flushdb();
    } catch {}
    // 1. Establish template
    const template = await ReportTemplate.create({
      name: 'Base Sales Summary',
      category: 'SALES',
      fields: ['productName', 'quantity', 'lineTotal'],
      defaultFilters: {},
      defaultGroupings: [],
    });
    templateId = template._id as mongoose.Types.ObjectId;

    // 2. Add some demo products
    await Product.create([
      {
        companyId,
        tenantId: companyId.toString(),
        name: 'Whole Milk 1L',
        sku: 'MILK-123',
        category: 'Dairy',
        quantity: 100,
        price: 2.5,
        lowStockAlert: 10,
        isActive: true,
      },
      {
        companyId,
        tenantId: companyId.toString(),
        name: 'Bread',
        sku: 'BREAD-123',
        category: 'Bakery',
        quantity: 20,
        price: 3.0,
        lowStockAlert: 5,
        isActive: true,
      },
    ]);

    // 3. Add demo transaction
    await Transaction.create({
      tenantId: companyId.toString(),
      transactionNumber: 'TX-NUM-REPORT-999',
      cashierId: 'user-cashier-1',
      branchId: 'branch-hq-123',
      companyId,
      reference: 'TX-REPORT-1',
      paymentProvider: 'NONE',
      paymentMethod: 'CASH',
      items: [
        {
          productId: 'product-milk-999',
          productName: 'Whole Milk 1L',
          sku: 'MILK-123',
          quantity: 2,
          price: 2.5,
          discount: 0,
          total: 5.0,
        },
      ],
      discount: 0,
      tax: 0,
      subtotal: 5.0,
      total: 5.0,
      cashierName: 'System Test',
      branchName: 'HQ Branch',
      status: 'COMPLETED',
    });
  });

  afterAll(async () => {
    await Promise.all([
      ReportTemplate.deleteMany({}),
      Product.deleteMany({ companyId }),
      Transaction.deleteMany({ companyId }),
      SavedReport.deleteMany({ companyId }),
      ScheduledReport.deleteMany({ companyId }),
    ]);
    await mongoose.connection.close();
  });

  interface ExecSummaryResult {
    revenue: number;
    salesCount: number;
    totalProducts: number;
    inventoryValue: number;
  }

  interface KPIResult {
    code: string;
    currentValue: number;
  }

  it('should compute executive summary successfully and store in Redis/DB cache', async () => {
    const summary = (await ReportingService.getExecutiveSummary(
      companyId.toString(),
      'Company Owner'
    )) as unknown as ExecSummaryResult;
    expect(summary).toBeDefined();
    expect(summary.revenue).toBe(5.0);
    expect(summary.salesCount).toBe(1);
    expect(summary.totalProducts).toBe(2);
    expect(summary.inventoryValue).toBe(310.0); // (100 * 2.5) + (20 * 3.0)

    // Check Redis cache has the value
    const cached = await redis.get(`reporting:exec-summary:${companyId}:Company Owner`);
    expect(cached).toBeDefined();
    expect(JSON.parse(cached!).revenue).toBe(5.0);
  });

  it('should calculate custom KPIs accurately', async () => {
    const kpis = (await ReportingService.getKPIs(companyId.toString())) as unknown as KPIResult[];
    expect(kpis.length).toBeGreaterThan(0);
    const rev = kpis.find((k) => k.code === 'REVENUE');
    expect(rev).toBeDefined();
    expect(rev?.currentValue).toBe(5.0);
  });

  it('should support storing custom saved report configs and scheduling', async () => {
    const saved = await SavedReport.create({
      userId,
      companyId,
      name: 'Custom High Margin',
      templateId,
      configuration: {
        fields: ['productName', 'lineTotal'],
        filters: {},
        groupings: [],
      },
    });
    expect(saved._id).toBeDefined();

    const schedule = await ScheduledReport.create({
      savedReportId: saved._id,
      userId,
      companyId,
      name: 'Weekly Digest',
      cronExpression: '0 9 * * 1',
      format: 'PDF',
      recipients: ['admin@stockora.com'],
    });
    expect(schedule._id).toBeDefined();
  });
});
