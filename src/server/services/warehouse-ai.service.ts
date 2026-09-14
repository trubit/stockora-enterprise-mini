import { Warehouse } from '../models/Warehouse.js';
import { InventoryLocation } from '../models/InventoryLocation.js';
import { warehouseAnalyticsService } from './warehouse-analytics.service.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface AIWarehouseInsight {
  insight: string;
  reason: string;
  dataPeriod: string;
  confidence: number;
  recommendedAction: string;
}

export class WarehouseAIService {
  /**
   * Generate AI Warehouse Intelligence Insights & Recommendations
   */
  async getWarehouseAIInsights(warehouseId: string): Promise<{
    insights: AIWarehouseInsight[];
    putawayRecommendations: any[];
    transferSuggestions: any[];
  }> {
    const whObjId = safeObjectId(warehouseId);
    const analytics = await warehouseAnalyticsService.getWarehouseAnalytics(warehouseId);
    const warehouse = await Warehouse.findById(whObjId);

    const insights: AIWarehouseInsight[] = [];

    // 1. Capacity Bottleneck Detection
    if (analytics.capacity.utilizationPercentage > 80) {
      insights.push({
        insight: `High Warehouse Capacity Saturation (${analytics.capacity.utilizationPercentage}%)`,
        reason: `Warehouse [${analytics.warehouseName}] is at ${analytics.capacity.utilizationPercentage}% capacity utilization across active storage locations.`,
        dataPeriod: 'Real-time',
        confidence: 0.95,
        recommendedAction:
          'Initiate stock transfer of slow-moving inventory to a secondary warehouse or expand storage bin capacity.',
      });
    } else {
      insights.push({
        insight: `Optimal Warehouse Storage Capacity (${analytics.capacity.utilizationPercentage}%)`,
        reason: `Storage space in [${analytics.warehouseName}] is operating within normal parameters.`,
        dataPeriod: 'Real-time',
        confidence: 0.9,
        recommendedAction:
          'No immediate expansion required. Maintain current slotting arrangement.',
      });
    }

    // 2. Picking Efficiency & Accuracy
    if (analytics.fulfillment.pickAccuracyPercentage < 98) {
      insights.push({
        insight: `Picking Accuracy Below Target (${analytics.fulfillment.pickAccuracyPercentage}%)`,
        reason: `Short-pick events or barcode mismatches resulted in pick accuracy of ${analytics.fulfillment.pickAccuracyPercentage}%.`,
        dataPeriod: 'Last 30 Days',
        confidence: 0.88,
        recommendedAction:
          'Enforce mandatory barcode scan validation at picking locations and re-audit high-variance bin locations.',
      });
    }

    // 3. Put-away Backlog Alert
    if (analytics.logistics.pendingPutawayTasks > 10) {
      insights.push({
        insight: `Receiving Dock Congestion (${analytics.logistics.pendingPutawayTasks} Pending Tasks)`,
        reason: `${analytics.logistics.pendingPutawayTasks} put-away tasks are awaiting movement from RECEIVING to STORAGE.`,
        dataPeriod: 'Current Shift',
        confidence: 0.92,
        recommendedAction:
          'Reassign workers to put-away tasks to clear receiving dock bottlenecks.',
      });
    }

    // Transfer Suggestions
    const transferSuggestions = [];
    if (analytics.capacity.utilizationPercentage > 75) {
      const overstockedItems = await InventoryLocation.find({
        warehouseId: whObjId,
        quantity: { $gt: 50 },
      })
        .populate('productId', 'name sku')
        .limit(3);

      for (const item of overstockedItems) {
        const prod = item.productId as any;
        if (prod) {
          transferSuggestions.push({
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku,
            currentStock: item.quantity,
            suggestedQuantity: Math.floor(item.quantity * 0.4),
            reason: `Surplus stock detected at ${warehouse?.name || 'Main Warehouse'} (${item.quantity} units). Transfer recommended to balance inventory distribution.`,
          });
        }
      }
    }

    return {
      insights,
      putawayRecommendations: [],
      transferSuggestions,
    };
  }
}

export const warehouseAIService = new WarehouseAIService();
