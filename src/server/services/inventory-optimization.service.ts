import mongoose from 'mongoose';
import { StockoutRisk, StockoutRiskLevel } from '../models/StockoutRisk.js';
import { TransferRecommendation } from '../models/TransferRecommendation.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { Transaction } from '../models/Transaction.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export class InventoryOptimizationService {
  /**
   * Scans stockout risks across all active products
   */
  public static async scanStockoutRisks() {
    return await ResilientExecutor.execute({ name: 'scan-stockout-risks' }, async () => {
      const products = await Product.find({ isActive: true });
      const risks = [];

      for (const product of products) {
        const currentStock = product.quantity || 0;
        const expectedDailyDemand = Math.max(1, Math.ceil(currentStock / 25)); // Estimate
        const daysUntilStockout = Math.floor(currentStock / expectedDailyDemand);

        let riskLevel: StockoutRiskLevel = 'LOW';
        if (currentStock === 0 || daysUntilStockout <= 2) {
          riskLevel = 'CRITICAL';
        } else if (daysUntilStockout <= 5) {
          riskLevel = 'HIGH';
        } else if (daysUntilStockout <= 10) {
          riskLevel = 'MEDIUM';
        }

        if (riskLevel !== 'LOW') {
          const stockoutDate = new Date();
          stockoutDate.setDate(stockoutDate.getDate() + daysUntilStockout);

          const riskDoc = await StockoutRisk.findOneAndUpdate(
            { productId: product._id },
            {
              tenantId: 'default',
              companyId: 'default',
              productId: product._id,
              productSku: product.sku,
              productName: product.name,
              riskLevel,
              estimatedStockoutDate: stockoutDate,
              daysUntilStockout,
              expectedDailyDemand,
              currentStock,
              incomingStock: 0,
              recommendedAction:
                riskLevel === 'CRITICAL'
                  ? 'Emergency reorder immediately or transfer stock from primary warehouse'
                  : 'Place purchase order with supplier within 48 hours',
            },
            { upsert: true, new: true }
          );

          risks.push(riskDoc);
        } else {
          await StockoutRisk.deleteOne({ productId: product._id });
        }
      }

      logger.info(`[Stockout Risk Scan] Identified ${risks.length} products with stockout risk`);
      return risks;
    });
  }

  /**
   * Identifies overstock and dead stock items
   */
  public static async getOverstockAndDeadStock() {
    const products = await Product.find({ isActive: true });
    const ninetiesDaysAgo = new Date();
    ninetiesDaysAgo.setDate(ninetiesDaysAgo.getDate() - 90);

    const overstock = [];
    const deadStock = [];

    for (const product of products) {
      const recentSalesCount = await Transaction.countDocuments({
        $or: [
          { 'items.productId': product._id.toString() },
          { 'items.sku': product.sku },
          { productId: product._id },
        ],
        createdAt: { $gte: ninetiesDaysAgo },
        status: { $ne: 'CANCELLED' },
      });

      if (product.quantity > 100 && recentSalesCount < 3) {
        overstock.push({
          productId: product._id,
          sku: product.sku,
          name: product.name,
          currentStock: product.quantity,
          holdingValue: product.quantity * (product.costPrice || product.cost || 10),
          recommendedAction: 'Apply 20% discount or launch promotional clearance campaign',
        });
      }

      if (recentSalesCount === 0 && product.quantity > 0) {
        deadStock.push({
          productId: product._id,
          sku: product.sku,
          name: product.name,
          quantity: product.quantity,
          capitalTiedUp: product.quantity * (product.costPrice || product.cost || 10),
          daysInactive: 90,
          recommendedAction: 'Initiate vendor return or bundle product promotion',
        });
      }
    }

    return { overstock, deadStock };
  }

  /**
   * Generates warehouse stock transfer recommendations
   */
  public static async generateTransferRecommendations() {
    const warehouses = await Warehouse.find({ isActive: true });
    if (warehouses.length < 2) {
      return []; // Single warehouse system
    }

    const sourceWh = warehouses[0];
    const targetWh = warehouses[1];

    const products = await Product.find({ quantity: { $gt: 50 } }).limit(5);
    const recommendations = [];

    for (const product of products) {
      const transferQty = Math.floor(product.quantity * 0.3);
      if (transferQty > 0) {
        const doc = await TransferRecommendation.findOneAndUpdate(
          {
            sourceWarehouseId: sourceWh._id,
            targetWarehouseId: targetWh._id,
            productId: product._id,
            status: 'DRAFT',
          },
          {
            tenantId: 'default',
            companyId: 'default',
            sourceWarehouseId: sourceWh._id,
            sourceWarehouseName: sourceWh.name,
            targetWarehouseId: targetWh._id,
            targetWarehouseName: targetWh.name,
            productId: product._id,
            productSku: product.sku,
            productName: product.name,
            quantity: transferQty,
            reason: `Rebalance surplus stock from ${sourceWh.name} to cover anticipated demand in ${targetWh.name}`,
            priority: 'MEDIUM',
            status: 'DRAFT',
          },
          { upsert: true, new: true }
        );
        recommendations.push(doc);
      }
    }

    return recommendations;
  }
}
