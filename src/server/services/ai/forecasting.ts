import { Product } from '../../models/Product.js';
import { Transaction } from '../../models/Transaction.js';
import { logger } from '../../logger.js';
import { geminiService } from './gemini/gemini.service.js';

export interface ForecastingReport {
  totalSalesRevenue: number;
  totalInventoryValue: number;
  fastMovingItems: Array<{
    productId: string;
    name: string;
    quantitySold: number;
    revenue: number;
  }>;
  slowMovingItems: Array<{
    productId: string;
    name: string;
    currentQuantity: number;
    ageInDays: number;
  }>;
  reorderProposals: Array<{
    productId: string;
    name: string;
    currentStock: number;
    limit: number;
    proposedQty: number;
    reason: string;
  }>;
  seasonalTrends: Array<{ period: string; salesCount: number; totalAmount: number }>;
  profitabilityInsights: {
    grossProfit: number;
    marginPercentage: number;
  };
}

export class ForecastingEngine {
  /**
   * Run heuristics analysis over the live MongoDB databases scoped to the authorized tenant.
   */
  public static async generateReport(tenantId?: string): Promise<ForecastingReport> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required for generating forecasting reports.');
      }
      const products = await Product.find({ tenantId, isActive: true });
      const transactions = await Transaction.find({ tenantId, type: 'SALE', status: 'COMPLETED' });

      // 1. Calculations
      const totalInventoryValue = products.reduce(
        (sum, p) => sum + (p.sellingPrice || p.price || 0) * (p.quantity || 0),
        0
      );
      const totalCostBase = products.reduce(
        (sum, p) => sum + (p.costPrice || p.cost || 0) * (p.quantity || 0),
        0
      );
      const totalSalesRevenue = transactions.reduce((sum, t) => sum + (t.total || 0), 0);

      // 2. Compute sales velocity per product
      const productSalesMap: Record<string, { quantitySold: number; revenue: number }> = {};
      const monthlySalesMap: Record<string, { salesCount: number; totalAmount: number }> = {};

      for (const t of transactions) {
        // Group by month
        const date = new Date(t.createdAt);
        const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!monthlySalesMap[monthKey]) {
          monthlySalesMap[monthKey] = { salesCount: 0, totalAmount: 0 };
        }
        monthlySalesMap[monthKey].salesCount++;
        monthlySalesMap[monthKey].totalAmount += t.total;

        for (const item of t.items) {
          const pId = item.productId.toString();
          if (!productSalesMap[pId]) {
            productSalesMap[pId] = { quantitySold: 0, revenue: 0 };
          }
          productSalesMap[pId].quantitySold += item.quantity;
          productSalesMap[pId].revenue += item.total || item.quantity * (item.price || 0);
        }
      }

      // Fast vs Slow Moving items
      const fastMovingItems = products
        .map((p) => {
          const pId = (p._id || p.id).toString();
          const sales = productSalesMap[pId] || { quantitySold: 0, revenue: 0 };
          return {
            productId: pId,
            name: p.name,
            quantitySold: sales.quantitySold,
            revenue: sales.revenue,
          };
        })
        .filter((item) => item.quantitySold > 0)
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5);

      const slowMovingItems = products
        .map((p) => {
          const pId = (p._id || p.id).toString();
          const sales = productSalesMap[pId] || { quantitySold: 0, revenue: 0 };
          // Calculate inventory age in days based on createdAt or update timestamp
          const updatedDate = p.updatedAt ? new Date(p.updatedAt) : new Date();
          const ageInDays = Math.round(
            (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            productId: pId,
            name: p.name,
            currentQuantity: p.quantity,
            quantitySold: sales.quantitySold,
            ageInDays: Math.max(1, ageInDays),
          };
        })
        .filter((item) => item.quantitySold === 0 && item.currentQuantity > 0)
        .sort((a, b) => b.ageInDays - a.ageInDays)
        .slice(0, 5);

      // Reorder suggestions
      const reorderProposals = products
        .filter((p) => p.quantity <= p.lowStockAlert)
        .map((p) => {
          const pId = (p._id || p.id).toString();
          const proposedQty = Math.max(10, p.lowStockAlert * 3 - p.quantity);
          return {
            productId: pId,
            name: p.name,
            currentStock: p.quantity,
            limit: p.lowStockAlert,
            proposedQty,
            reason:
              p.quantity === 0 ? 'Out of stock' : 'Stock level below configuration threshold limit',
          };
        });

      // Group monthly metrics
      const seasonalTrends = Object.keys(monthlySalesMap).map((key) => ({
        period: key,
        salesCount: monthlySalesMap[key].salesCount,
        totalAmount: monthlySalesMap[key].totalAmount,
      }));

      // Margin calculations
      const grossProfit = Math.max(0, totalSalesRevenue - totalCostBase);
      const marginPercentage = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;

      return {
        totalSalesRevenue,
        totalInventoryValue,
        fastMovingItems,
        slowMovingItems,
        reorderProposals,
        seasonalTrends,
        profitabilityInsights: {
          grossProfit,
          marginPercentage,
        },
      };
    } catch (err) {
      logger.error('[AI Forecasting Engine] Analytics failed:', err);
      throw err;
    }
  }

  /**
   * Generates natural language AI forecasts and strategies scoped to the tenant.
   */
  public static async getAIForecasts(tenantId?: string): Promise<string> {
    try {
      const stats = await this.generateReport(tenantId);

      const systemInstruction = `
        You are a Principal Business Intelligence Analyst at Stockora.
        Provide a concise, professional executive forecast report based on the provided metrics.
        Focus on:
        1. Actionable inventory reorder advice.
        2. Recommendations for slow-moving products.
        3. Clear margin analysis.
        Avoid verbose conversational greetings; output a clean, well-formatted markdown document.
      `;

      const prompt = `
        Live Platform Statistics:
        - Total Sales Revenue: $${stats.totalSalesRevenue.toFixed(2)}
        - Total Inventory Asset Value: $${stats.totalInventoryValue.toFixed(2)}
        - Top Fast-Moving Items: ${JSON.stringify(stats.fastMovingItems)}
        - Inventory Reorder Proposals: ${JSON.stringify(stats.reorderProposals)}
        - Gross Profit Estimate: $${stats.profitabilityInsights.grossProfit.toFixed(2)}
        - Profit Margin: ${stats.profitabilityInsights.marginPercentage.toFixed(1)}%

        Please provide a detailed executive summary, inventory forecast, and reorder strategies.
      `;

      const res = await geminiService.generateContent({
        tenantId: tenantId || 'default',
        action: 'bi_forecasting',
        systemInstruction,
        prompt,
        responseMimeType: 'text/plain',
      });
      return res.content;
    } catch (err) {
      logger.error('[AI Forecasting Engine] AI analytics failed:', err);
      return 'AI Business Intelligence forecast unavailable at this time due to system offline status.';
    }
  }
}
