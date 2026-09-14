import mongoose from 'mongoose';
import { ReorderRecommendation, IReorderRecommendation } from '../models/ReorderRecommendation.js';
import { Product } from '../models/Product.js';
import { Supplier } from '../models/Supplier.js';
import { AuditLog } from '../models/AuditLog.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export interface ReplenishmentCalculationOptions {
  productId: string;
  serviceLevelZ?: number; // e.g. 1.65 for 95% service level
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  warehouseId?: string;
}

export class ReplenishmentService {
  /**
   * Calculates safety stock, reorder point, and generates reorder recommendation for a product
   */
  public static async calculateReplenishment(
    options: ReplenishmentCalculationOptions
  ): Promise<IReorderRecommendation> {
    return await ResilientExecutor.execute(
      { name: `replenishment:${options.productId}` },
      async () => {
        const {
          productId,
          serviceLevelZ = 1.65,
          tenantId = 'default',
          companyId = 'default',
        } = options;

        const product = await Product.findById(productId);
        if (!product) {
          throw new Error(`Product not found: ${productId}`);
        }

        // Default or preferred supplier lookup
        const supplier = await Supplier.findOne({ isActive: true });
        const leadTimeDays = 7; // standard lead time
        const moq = 10; // minimum order quantity

        // Estimate daily demand and standard deviation from product sales/quantities
        const avgDailyDemand = Math.max(1, Math.ceil((product.quantity || 10) / 30));
        const stdDevDemand = Math.ceil(avgDailyDemand * 0.25); // 25% demand variability
        const stdDevLeadTime = 1; // 1 day lead time variability

        // Safety Stock formula: Safety Stock = Z * sqrt( (leadTime * stdDevDemand^2) + (avgDailyDemand^2 * stdDevLeadTime^2) )
        const safetyStock = Math.ceil(
          serviceLevelZ *
            Math.sqrt(
              leadTimeDays * Math.pow(stdDevDemand, 2) +
                Math.pow(avgDailyDemand, 2) * Math.pow(stdDevLeadTime, 2)
            )
        );

        // Expected Demand during Lead Time
        const expectedDemandLeadTime = avgDailyDemand * leadTimeDays;

        // Reorder Point = Expected Demand During Lead Time + Safety Stock
        const reorderPoint = expectedDemandLeadTime + safetyStock;

        // Recommended Quantity: If current stock <= reorder point, order enough to reach target inventory level (reorderPoint + safetyStock) rounded up to MOQ
        let recommendedQuantity = 0;
        if (product.quantity <= reorderPoint) {
          const deficit = reorderPoint + expectedDemandLeadTime - product.quantity;
          recommendedQuantity = Math.max(moq, Math.ceil(deficit / moq) * moq);
        }

        const estimatedCost = recommendedQuantity * (product.costPrice || product.cost || 10);

        // Upsert ReorderRecommendation record
        const recommendationDoc = await ReorderRecommendation.findOneAndUpdate(
          { productId: product._id, status: 'RECOMMENDED' },
          {
            tenantId,
            companyId,
            branchId: options.branchId ? new mongoose.Types.ObjectId(options.branchId) : undefined,
            warehouseId: options.warehouseId
              ? new mongoose.Types.ObjectId(options.warehouseId)
              : undefined,
            productId: product._id,
            productSku: product.sku,
            productName: product.name,
            currentStock: product.quantity,
            reorderPoint,
            safetyStock,
            expectedDemandLeadTime,
            recommendedQuantity,
            moq,
            supplierId: supplier ? supplier._id : undefined,
            supplierName: supplier ? supplier.name : 'Primary Supplier',
            leadTimeDays,
            estimatedCost,
            status: 'RECOMMENDED',
          },
          { upsert: true, new: true }
        );

        logger.info(
          `[Replenishment Service] Reorder point for ${product.sku}: ROP=${reorderPoint}, RecQty=${recommendedQuantity}`
        );

        return recommendationDoc;
      }
    );
  }

  /**
   * Allows manual override of a reorder recommendation with mandatory audit trail
   */
  public static async overrideRecommendation(
    recommendationId: string,
    overrideQuantity: number,
    reason: string,
    userId: string
  ): Promise<IReorderRecommendation> {
    const recommendation = await ReorderRecommendation.findById(recommendationId);
    if (!recommendation) {
      throw new Error(`Reorder recommendation not found: ${recommendationId}`);
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error(
        'A detailed reason (at least 5 characters) is required for manual overrides.'
      );
    }

    recommendation.status = 'OVERRIDDEN';
    recommendation.overrideQuantity = overrideQuantity;
    recommendation.overrideReason = reason;
    recommendation.overriddenBy = new mongoose.Types.ObjectId(userId);
    recommendation.overriddenAt = new Date();
    await recommendation.save();

    // Record mandatory Audit Log
    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(userId),
      action: 'REORDER_RECOMMENDATION_OVERRIDDEN',
      targetModel: 'ReorderRecommendation',
      targetId: recommendationId,
      previousValues: { recommendedQuantity: recommendation.recommendedQuantity },
      newValues: { overrideQuantity, overrideReason: reason },
    });

    logger.info(`[Replenishment Service] Override created for recommendation ${recommendationId}`);
    return recommendation;
  }

  /**
   * Fetch active recommendations
   */
  public static async getRecommendations(status?: string, limit = 50) {
    const query = status ? { status } : {};
    return await ReorderRecommendation.find(query).sort({ updatedAt: -1 }).limit(limit);
  }
}
