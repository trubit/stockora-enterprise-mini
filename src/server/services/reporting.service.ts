import mongoose from 'mongoose';
import { redis } from '../database/redis.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { AnalyticsCache } from '../models/AnalyticsCache.js';
import { logger } from '../logger.js';

export class ReportingService {
  /**
   * Safe Redis & MongoDB analytics caching helper
   */
  private static async getOrSetCache<T>(
    cacheKey: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      logger.warn(`[ReportingCache] Redis read failure for ${cacheKey}:`, err);
    }

    try {
      const dbCache = await AnalyticsCache.findOne({ cacheKey });
      if (dbCache && dbCache.expiresAt > new Date()) {
        return dbCache.data as T;
      }
    } catch (err) {
      logger.warn(`[ReportingCache] DB read failure for ${cacheKey}:`, err);
    }

    // Cache miss — fetch data
    const freshData = await fetchFn();

    try {
      const serialized = JSON.stringify(freshData);
      await redis.setex(cacheKey, ttlSeconds, serialized);
    } catch (err) {
      logger.warn(`[ReportingCache] Redis write failure for ${cacheKey}:`, err);
    }

    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await AnalyticsCache.findOneAndUpdate(
        { cacheKey },
        { cacheKey, data: freshData, expiresAt },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn(`[ReportingCache] DB write failure for ${cacheKey}:`, err);
    }

    return freshData;
  }

  private static getTenantOrCompanyQuery(companyId: string): Record<string, any> {
    const isOid = mongoose.Types.ObjectId.isValid(companyId);
    const companyOid = isOid ? new mongoose.Types.ObjectId(companyId) : null;
    return companyOid
      ? { $or: [{ tenantId: companyId }, { companyId: companyOid }, { companyId: companyId }] }
      : { $or: [{ tenantId: companyId }, { companyId: companyId }] };
  }

  /**
   * Generates dynamic aggregations for executive dashboards by role
   */
  public static async getExecutiveSummary(companyId: string, roleName: string): Promise<unknown> {
    const cacheKey = `reporting:exec-summary:${companyId}:${roleName}`;
    const ttl = 300; // 5 minutes cache

    return this.getOrSetCache(cacheKey, ttl, async () => {
      const tenantMatch = this.getTenantOrCompanyQuery(companyId);
      const poMatch: Record<string, any> = {
        status: { $in: ['APPROVED', 'COMPLETED', 'RECEIVED', 'BILLED'] },
        ...tenantMatch,
      };

      // 1. Basic counts
      const [totalProducts, salesStats, purchaseStats] = await Promise.all([
        Product.countDocuments(tenantMatch),
        Transaction.aggregate([
          { $match: { ...tenantMatch, status: 'COMPLETED' } },
          { $group: { _id: null, totalSales: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        PurchaseOrder.aggregate([
          { $match: poMatch },
          { $group: { _id: null, totalPurchases: { $sum: '$totalAmount' } } },
        ]),
      ]);

      const salesVolume = salesStats[0]?.totalSales || 0;
      const salesCount = salesStats[0]?.count || 0;
      const purchasesVolume = purchaseStats[0]?.totalPurchases || 0;

      // 2. Inventory Valuation (selling price * quantity)
      const inventoryValData = await Product.aggregate([
        { $match: { ...tenantMatch, isActive: true } },
        {
          $group: {
            _id: null,
            totalValuation: { $sum: { $multiply: ['$price', '$quantity'] } },
            totalCost: { $sum: { $multiply: [{ $ifNull: ['$costPrice', 0] }, '$quantity'] } },
          },
        },
      ]);
      const inventoryValue = inventoryValData[0]?.totalValuation || 0;
      const inventoryCost = inventoryValData[0]?.totalCost || 0;

      // 3. Simple Net profit
      const profit = salesVolume - purchasesVolume;

      // Live System Health metrics
      const dbStatus = mongoose.connection.readyState === 1 ? 'HEALTHY' : 'DEGRADED';
      const redisStatus = redis.status === 'ready' ? 'HEALTHY' : 'DEGRADED';

      return {
        revenue: salesVolume,
        salesCount,
        purchases: purchasesVolume,
        inventoryValue,
        inventoryCost,
        netProfit: profit,
        totalProducts,
        systemHealth: {
          database: dbStatus,
          redis: redisStatus,
          apiGateway: 'HEALTHY',
        },
      };
    });
  }

  /**
   * Retrieve Inventory Analysis Reports
   */
  public static async getInventoryReport(companyId: string): Promise<unknown> {
    const cacheKey = `reporting:inventory:${companyId}`;
    return this.getOrSetCache(cacheKey, 600, async () => {
      const items = await Product.find(this.getTenantOrCompanyQuery(companyId)).lean();
      const deadStock = items.filter((p) => p.quantity === 0 || !p.isActive);
      const lowStock = items.filter((p) => p.quantity <= p.lowStockAlert);
      const fastMoving = items.filter((p) => p.quantity > p.lowStockAlert * 3);

      return {
        totalItems: items.length,
        deadStockCount: deadStock.length,
        lowStockCount: lowStock.length,
        fastMovingCount: fastMoving.length,
        valuation: items.reduce((sum, p) => sum + p.price * p.quantity, 0),
        lowStockList: lowStock
          .slice(0, 10)
          .map((p) => ({ name: p.name, sku: p.sku, qty: p.quantity })),
      };
    });
  }

  /**
   * Retrieve Sales Performance Reports
   */
  public static async getSalesReport(
    companyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<unknown> {
    const cacheKey = `reporting:sales:${companyId}:${startDate || 'all'}:${endDate || 'all'}`;
    return this.getOrSetCache(cacheKey, 60, async () => {
      const baseMatch = this.getTenantOrCompanyQuery(companyId);
      const matchQuery: Record<string, any> = { ...baseMatch, status: 'COMPLETED' };

      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

      const summary = await Transaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            averageSale: { $avg: '$total' },
            transactionCount: { $sum: 1 },
          },
        },
      ]);

      const chartData = await Transaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sales: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return {
        summary: summary[0] || { totalRevenue: 0, averageSale: 0, transactionCount: 0 },
        trend: chartData.map((d) => ({ date: d._id, sales: d.sales })),
      };
    });
  }

  /**
   * Evaluates system and customizable Business Key Performance Indicators
   */
  public static async getKPIs(companyId: string): Promise<unknown> {
    const cacheKey = `reporting:kpis:${companyId}`;
    return this.getOrSetCache(cacheKey, 300, async () => {
      const tenantMatch = this.getTenantOrCompanyQuery(companyId);
      const poMatch: Record<string, any> = {
        status: 'COMPLETED',
        ...tenantMatch,
      };

      // Perform aggregation to calculate real-time values for KPI definitions
      const [salesSum, poSum] = await Promise.all([
        Transaction.aggregate([
          { $match: { ...tenantMatch, status: 'COMPLETED' } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
        PurchaseOrder.aggregate([
          { $match: poMatch },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
      ]);

      const totalRevenue = salesSum[0]?.total || 0;
      const totalPurchases = poSum[0]?.total || 0;
      const profitMargin =
        totalRevenue > 0 ? ((totalRevenue - totalPurchases) / totalRevenue) * 100 : 0;

      return [
        {
          code: 'REVENUE',
          name: 'Revenue Target',
          category: 'SALES',
          formula: 'Sum(Sales.total)',
          targetValue: 50000,
          currentValue: totalRevenue,
          timeframe: 'MONTHLY',
        },
        {
          code: 'PROFIT_MARGIN',
          name: 'Net Profit Margin',
          category: 'FINANCE',
          formula: '(Sales - Purchases) / Sales',
          targetValue: 35,
          currentValue: parseFloat(profitMargin.toFixed(2)),
          timeframe: 'MONTHLY',
        },
      ];
    });
  }
}
