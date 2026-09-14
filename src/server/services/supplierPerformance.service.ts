import { Supplier, type ISupplierScorecard } from '../models/Supplier.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { QualityInspection } from '../models/QualityInspection.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { NotFoundError } from '../errors/AppError.js';

export class SupplierPerformanceService {
  public static async calculateSupplierScorecard(supplierId: string): Promise<ISupplierScorecard> {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const totalPOs = await PurchaseOrder.countDocuments({ supplierId: supplier._id });

    if (totalPOs === 0) {
      const defaultScorecard: ISupplierScorecard = {
        onTimeDeliveryRate: 100,
        fillRate: 100,
        qualityRate: 100,
        defectRate: 0,
        priceStabilityScore: 100,
        averageLeadTimeDays: supplier.leadTimeDays || 7,
        overallScore: 100,
      };
      supplier.scorecard = defaultScorecard;
      await supplier.save();
      return defaultScorecard;
    }

    const pos = await PurchaseOrder.find({ supplierId: supplier._id });
    let onTimeCount = 0;
    let totalFulfilledQty = 0;
    let totalOrderedQty = 0;

    for (const po of pos) {
      if (po.expectedDeliveryDate && po.actualDeliveryDate) {
        if (po.actualDeliveryDate <= po.expectedDeliveryDate) {
          onTimeCount += 1;
        }
      } else {
        onTimeCount += 1;
      }

      for (const item of po.items) {
        totalOrderedQty += item.quantity;
        totalFulfilledQty += item.receivedQuantity;
      }
    }

    const onTimeDeliveryRate = Math.min(100, Math.round((onTimeCount / totalPOs) * 100));
    const fillRate =
      totalOrderedQty > 0
        ? Math.min(100, Math.round((totalFulfilledQty / totalOrderedQty) * 100))
        : 100;

    // Quality Inspection metrics
    const poIds = pos.map((p) => p._id);
    const inspections = await QualityInspection.find({ poId: { $in: poIds } });
    let totalInspected = 0;
    let totalFailed = 0;

    for (const qi of inspections) {
      for (const item of qi.items) {
        totalInspected += item.quantityInspected;
        totalFailed += item.quantityFailed;
      }
    }

    const defectRate =
      totalInspected > 0 ? Math.min(100, Math.round((totalFailed / totalInspected) * 100)) : 0;
    const qualityRate = Math.max(0, 100 - defectRate);

    // Weighted Overall Score (Configurable weights: Delivery 30%, Quality 40%, Fill 30%)
    const overallScore = Math.round(onTimeDeliveryRate * 0.3 + qualityRate * 0.4 + fillRate * 0.3);

    const scorecard: ISupplierScorecard = {
      onTimeDeliveryRate,
      fillRate,
      qualityRate,
      defectRate,
      priceStabilityScore: 100,
      averageLeadTimeDays: supplier.leadTimeDays || 7,
      overallScore,
    };

    supplier.scorecard = scorecard;
    supplier.rating = Math.max(1, Math.min(5, Math.round(overallScore / 20)));
    await supplier.save();

    return scorecard;
  }
}
