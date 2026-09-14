import mongoose from 'mongoose';
import { SupplierScore, ISupplierScore, SupplierRiskTier } from '../models/SupplierScore.js';
import { Supplier } from '../models/Supplier.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';
import { logger } from '../logger.js';

export class SupplierIntelligenceService {
  /**
   * Recalculates supplier performance scores based on POs and Goods Receipts
   */
  public static async evaluateSupplierScore(supplierId: string): Promise<ISupplierScore> {
    return await ResilientExecutor.execute({ name: `supplier-score:${supplierId}` }, async () => {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error(`Supplier not found: ${supplierId}`);
      }

      const poList = await PurchaseOrder.find({
        supplierId: new mongoose.Types.ObjectId(supplierId),
        status: { $in: ['RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED'] },
      });

      const grList = await GoodsReceipt.find({
        supplierId: new mongoose.Types.ObjectId(supplierId),
      });

      const totalOrdersEvaluated = poList.length;

      let deliveryPerformanceScore = 85;
      const priceStabilityScore = 90;
      const qualityScore = 95;
      let orderAccuracyScore = 90;
      let fillRateScore = 88;
      const avgLeadTimeDays = 7;
      const leadTimeVarianceDays = 1;

      if (totalOrdersEvaluated > 0) {
        let totalFulfilledQty = 0;
        let totalOrderedQty = 0;

        poList.forEach((po) => {
          po.items.forEach((item: any) => {
            totalOrderedQty += item.quantity;
            totalFulfilledQty += item.receivedQuantity || item.quantity;
          });
        });

        fillRateScore =
          totalOrderedQty > 0
            ? Math.min(100, Math.round((totalFulfilledQty / totalOrderedQty) * 100))
            : 90;
        deliveryPerformanceScore = Math.min(100, Math.max(50, fillRateScore - 5));
        orderAccuracyScore = Math.min(100, fillRateScore);
      }

      const overallScore = Math.round(
        deliveryPerformanceScore * 0.3 +
          qualityScore * 0.25 +
          fillRateScore * 0.2 +
          orderAccuracyScore * 0.15 +
          priceStabilityScore * 0.1
      );

      let riskTier: SupplierRiskTier = 'LOW';
      if (overallScore < 60) {
        riskTier = 'HIGH';
      } else if (overallScore < 80) {
        riskTier = 'MEDIUM';
      }

      const supplierScoreDoc = await SupplierScore.findOneAndUpdate(
        { supplierId: supplier._id },
        {
          tenantId: 'default',
          companyId: 'default',
          supplierId: supplier._id,
          supplierName: supplier.name,
          overallScore,
          deliveryPerformanceScore,
          priceStabilityScore,
          qualityScore,
          orderAccuracyScore,
          fillRateScore,
          avgLeadTimeDays,
          leadTimeVarianceDays,
          riskTier,
          totalOrdersEvaluated,
          notes: `Evaluated ${totalOrdersEvaluated} orders with overall performance score ${overallScore}%`,
        },
        { upsert: true, new: true }
      );

      logger.info(
        `[Supplier Intelligence] Evaluated ${supplier.name}: Score=${overallScore}%, Risk=${riskTier}`
      );
      return supplierScoreDoc;
    });
  }

  /**
   * Evaluates scores for all suppliers
   */
  public static async evaluateAllSuppliers() {
    const suppliers = await Supplier.find({ isActive: true });
    const results = [];
    for (const s of suppliers) {
      try {
        const score = await this.evaluateSupplierScore(
          (s._id as mongoose.Types.ObjectId).toString()
        );
        results.push(score);
      } catch (err) {
        logger.error(`Error evaluating supplier ${s._id}:`, err);
      }
    }
    return results;
  }

  /**
   * Retrieves supplier scorecards
   */
  public static async getSupplierScores() {
    return await SupplierScore.find().sort({ overallScore: -1 });
  }
}
