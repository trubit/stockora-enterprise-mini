import { Product } from '../../models/Product.js';
import { Transaction } from '../../models/Transaction.js';
import { Warehouse } from '../../models/Warehouse.js';
import { StockMovement } from '../../models/StockMovement.js';
import { Supplier } from '../../models/Supplier.js';
import { PurchaseOrder } from '../../models/PurchaseOrder.js';
import { logger } from '../../logger.js';

export interface InventoryContextSummary {
  tenantId: string;
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockCount: number;
  totalInventoryValuationCost: number;
  totalInventoryValuationRetail: number;
  warehouses: Array<{
    id: string;
    name: string;
    code: string;
    type: string;
  }>;
  criticalProducts: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    lowStockAlert: number;
    costPrice: number;
    sellingPrice: number;
    status: string;
  }>;
  hasSufficientData: boolean;
}

export interface SalesContextSummary {
  tenantId: string;
  periodDays: number;
  totalTransactions: number;
  totalRevenue: number;
  averageOrderValue: number;
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
  }>;
  recentSalesVelocity: Record<string, number>; // units/day per productId/sku
  hasSufficientData: boolean;
}

export interface ReorderContextSummary {
  tenantId: string;
  candidateProducts: Array<{
    productId: string;
    sku: string;
    name: string;
    category: string;
    currentStock: number;
    lowStockAlert: number;
    costPrice: number;
    sellingPrice: number;
    unitsSoldLast30Days: number;
    salesVelocityPerDay: number;
    daysOfStockLeft: number;
    primarySupplierName?: string;
  }>;
  hasSufficientData: boolean;
}

export interface AnomalyContextSummary {
  tenantId: string;
  unusualMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    productName?: string;
    date: Date;
    note?: string;
  }>;
  decliningSalesProducts: Array<{
    name: string;
    sku: string;
    sales30DaysAgo: number;
    salesRecent30Days: number;
  }>;
  hasSufficientData: boolean;
}

export class AIContextService {
  private static instance: AIContextService;

  private constructor() {}

  public static getInstance(): AIContextService {
    if (!AIContextService.instance) {
      AIContextService.instance = new AIContextService();
    }
    return AIContextService.instance;
  }

  /**
   * Sanitizes text fields retrieved from untrusted database fields (e.g. product names, notes)
   * to mitigate prompt injection, jailbreaking, and control character attacks.
   */
  public sanitizeField(value: any, maxLength = 150): string {
    if (value === null || value === undefined) return '';
    let str = String(value)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // remove ASCII control characters
      .replace(/<[^>]*>?/gm, '') // strip HTML tags
      .replace(/`{3,}/g, "'''") // neutralize markdown code fences
      .replace(/(SYSTEM INSTRUCTION|IGNORE ALL PREVIOUS|YOU ARE NOW|PROMPT:)/gi, '[FILTERED]')
      .trim();

    if (str.length > maxLength) {
      str = str.substring(0, maxLength) + '...';
    }
    return str;
  }

  /**
   * Retrieves deterministic, strictly tenant-isolated inventory metrics.
   */
  public async getInventoryContext(tenantId: string): Promise<InventoryContextSummary> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID is mandatory for inventory context retrieval.');
    }

    // Strictly scoped to tenantId
    const filter = { tenantId, isActive: true };

    const [products, warehouses] = await Promise.all([
      Product.find(filter)
        .select(
          '_id sku name category quantity lowStockAlert costPrice sellingPrice cost price status'
        )
        .lean()
        .exec(),
      Warehouse.find({ tenantId }).select('_id name code warehouseType').lean().exec(),
    ]);

    const totalProducts = products.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let overstockCount = 0;
    let totalValuationCost = 0;
    let totalValuationRetail = 0;

    const criticalProducts: InventoryContextSummary['criticalProducts'] = [];

    for (const p of products) {
      const qty = Number(p.quantity) || 0;
      const threshold = Number(p.lowStockAlert) || 5;
      const cost = Number(p.costPrice || p.cost) || 0;
      const retail = Number(p.sellingPrice || p.price) || 0;

      totalValuationCost += qty * cost;
      totalValuationRetail += qty * retail;

      if (qty <= 0) {
        outOfStockCount++;
        criticalProducts.push({
          id: String(p._id),
          sku: this.sanitizeField(p.sku, 50),
          name: this.sanitizeField(p.name, 100),
          category: this.sanitizeField(p.category, 50),
          quantity: qty,
          lowStockAlert: threshold,
          costPrice: cost,
          sellingPrice: retail,
          status: 'OUT_OF_STOCK',
        });
      } else if (qty <= threshold) {
        lowStockCount++;
        criticalProducts.push({
          id: String(p._id),
          sku: this.sanitizeField(p.sku, 50),
          name: this.sanitizeField(p.name, 100),
          category: this.sanitizeField(p.category, 50),
          quantity: qty,
          lowStockAlert: threshold,
          costPrice: cost,
          sellingPrice: retail,
          status: 'LOW_STOCK',
        });
      } else if (threshold > 0 && qty > threshold * 10 && threshold >= 10) {
        overstockCount++;
      }
    }

    return {
      tenantId,
      totalProducts,
      activeProducts: totalProducts,
      lowStockCount,
      outOfStockCount,
      overstockCount,
      totalInventoryValuationCost: Math.round(totalValuationCost * 100) / 100,
      totalInventoryValuationRetail: Math.round(totalValuationRetail * 100) / 100,
      warehouses: warehouses.map((w: any) => ({
        id: String(w._id),
        name: this.sanitizeField(w.name, 80),
        code: this.sanitizeField(w.code, 30),
        type: String(w.warehouseType || 'MAIN'),
      })),
      criticalProducts: criticalProducts.slice(0, 30), // top 30 critical items to fit token budget
      hasSufficientData: totalProducts > 0,
    };
  }

  /**
   * Retrieves deterministic, strictly tenant-isolated sales performance metrics.
   */
  public async getSalesContext(tenantId: string, days = 30): Promise<SalesContextSummary> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID is mandatory for sales context retrieval.');
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Strictly filtered by tenantId, type SALE, status COMPLETED
    const transactions = await Transaction.find({
      tenantId,
      type: 'SALE',
      status: 'COMPLETED',
      createdAt: { $gte: sinceDate },
    })
      .select('total items createdAt')
      .lean()
      .exec();

    let totalRevenue = 0;
    const productStats: Record<
      string,
      { name: string; sku: string; qty: number; revenue: number }
    > = {};

    for (const tx of transactions) {
      totalRevenue += Number(tx.total) || 0;
      if (Array.isArray(tx.items)) {
        for (const item of tx.items) {
          const key = String(item.productId || item.sku);
          if (!productStats[key]) {
            productStats[key] = {
              name: this.sanitizeField(item.productName, 80),
              sku: this.sanitizeField(item.sku, 40),
              qty: 0,
              revenue: 0,
            };
          }
          productStats[key].qty += Number(item.quantity) || 0;
          productStats[key].revenue += Number(item.total) || 0;
        }
      }
    }

    const sortedProducts = Object.entries(productStats)
      .map(([id, stats]) => ({
        productId: id,
        productName: stats.name,
        sku: stats.sku,
        quantitySold: stats.qty,
        revenue: Math.round(stats.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const velocityMap: Record<string, number> = {};
    for (const p of sortedProducts) {
      velocityMap[p.productId] = Math.round((p.quantitySold / days) * 100) / 100;
      if (p.sku) {
        velocityMap[p.sku] = velocityMap[p.productId];
      }
    }

    const totalTransactions = transactions.length;
    const averageOrderValue =
      totalTransactions > 0 ? Math.round((totalRevenue / totalTransactions) * 100) / 100 : 0;

    return {
      tenantId,
      periodDays: days,
      totalTransactions,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue,
      topSellingProducts: sortedProducts.slice(0, 20),
      recentSalesVelocity: velocityMap,
      hasSufficientData: totalTransactions > 0,
    };
  }

  /**
   * Generates calculated reorder context for items at risk of running out.
   */
  public async getReorderContext(tenantId: string): Promise<ReorderContextSummary> {
    const [invContext, salesContext] = await Promise.all([
      this.getInventoryContext(tenantId),
      this.getSalesContext(tenantId, 30),
    ]);

    if (!invContext.hasSufficientData) {
      return {
        tenantId,
        candidateProducts: [],
        hasSufficientData: false,
      };
    }

    const candidates: ReorderContextSummary['candidateProducts'] = [];

    for (const p of invContext.criticalProducts) {
      const dailyVelocity =
        salesContext.recentSalesVelocity[p.id] || salesContext.recentSalesVelocity[p.sku] || 0;

      const unitsSold30 = Math.round(dailyVelocity * 30);
      const daysLeft =
        dailyVelocity > 0 ? Math.floor(p.quantity / dailyVelocity) : p.quantity === 0 ? 0 : 999;

      candidates.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        currentStock: p.quantity,
        lowStockAlert: p.lowStockAlert,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        unitsSoldLast30Days: unitsSold30,
        salesVelocityPerDay: dailyVelocity,
        daysOfStockLeft: daysLeft,
      });
    }

    // Sort by most urgent: least days of stock left
    candidates.sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);

    return {
      tenantId,
      candidateProducts: candidates.slice(0, 25),
      hasSufficientData: candidates.length > 0,
    };
  }

  /**
   * Retrieves operational context for anomaly detection.
   */
  public async getAnomalyContext(tenantId: string): Promise<AnomalyContextSummary> {
    if (!tenantId) throw new Error('Tenant ID required');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Look for unusual stock movements (DAMAGES, WRITE_OFFS, abnormal ADJUSTMENTS)
    const movements = await StockMovement.find({
      tenantId,
      createdAt: { $gte: sevenDaysAgo },
      type: { $in: ['DAMAGE', 'WRITE_OFF', 'ADJUSTMENT', 'QUARANTINE'] },
    })
      .select('type quantity notes createdAt')
      .limit(30)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const unusualMovements = movements.map((m: any) => ({
      id: String(m._id),
      type: String(m.type),
      quantity: Math.abs(Number(m.quantity) || 0),
      date: m.createdAt,
      note: this.sanitizeField(m.notes, 100),
    }));

    return {
      tenantId,
      unusualMovements,
      decliningSalesProducts: [],
      hasSufficientData: movements.length > 0,
    };
  }
}

export const aiContextService = AIContextService.getInstance();
