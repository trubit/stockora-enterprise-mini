import mongoose from 'mongoose';
import { Supplier, type ISupplier } from '../models/Supplier.js';
import { SupplierProduct, type ISupplierProduct } from '../models/SupplierProduct.js';
import { SupplierContract, type ISupplierContract } from '../models/SupplierContract.js';
import { NotFoundError } from '../errors/AppError.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface SupplierRankingResult {
  supplierId: string;
  supplierName: string;
  unitCost: number;
  leadTimeDays: number;
  moq: number;
  overallScore: number;
  rank: number;
  recommendationReason: string;
}

export class SupplierManagementAdvancedService {
  public static async calculateSupplierScorecard(supplierId: string): Promise<any> {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) throw new NotFoundError('Supplier not found');

    const scorecard = supplier.scorecard || {
      onTimeDeliveryRate: 95,
      fillRate: 98,
      qualityRate: 97,
      defectRate: 3,
      priceStabilityScore: 92,
      averageLeadTimeDays: supplier.leadTimeDays || 7,
      overallScore: 94,
    };

    // Configurable weighting: Delivery 30%, Quality 30%, Pricing 20%, Reliability 20%
    const deliveryScore = scorecard.onTimeDeliveryRate * 0.3;
    const qualityScore = scorecard.qualityRate * 0.3;
    const pricingScore = scorecard.priceStabilityScore * 0.2;
    const fillScore = scorecard.fillRate * 0.2;

    const overallScore = Math.round(deliveryScore + qualityScore + pricingScore + fillScore);
    scorecard.overallScore = overallScore;

    supplier.rating = Math.max(1, Math.min(5, Math.round((overallScore / 100) * 5)));
    await supplier.save();

    return {
      supplierId: supplier._id,
      name: supplier.name,
      rating: supplier.rating,
      overallScore,
      scorecard,
      status: supplier.status,
    };
  }

  public static async resolveSupplierCostForQuantity(
    supplierProductId: string,
    quantity: number
  ): Promise<{ unitCost: number; totalPrice: number; appliedBreak?: string }> {
    const sp = await SupplierProduct.findById(supplierProductId);
    if (!sp) throw new NotFoundError('Supplier product mapping not found');

    let unitCost = sp.purchaseCost;
    let appliedBreak = 'Standard Base Cost';

    if (sp.priceBreaks && sp.priceBreaks.length > 0) {
      for (const pb of sp.priceBreaks) {
        if (quantity >= pb.minQuantity && (!pb.maxQuantity || quantity <= pb.maxQuantity)) {
          unitCost = pb.unitPrice;
          appliedBreak = `Volume Break (Qty ${pb.minQuantity}+ @ ${sp.currency} ${pb.unitPrice})`;
          break;
        }
      }
    }

    return {
      unitCost,
      totalPrice: unitCost * quantity,
      appliedBreak,
    };
  }

  public static async rankSuppliersForProduct(
    productId: string,
    quantity = 1,
    tenantId = 'default'
  ): Promise<SupplierRankingResult[]> {
    const filter: any = {
      tenantId,
      productId: new mongoose.Types.ObjectId(productId),
      status: 'ACTIVE',
    };
    const supplierProducts = await SupplierProduct.find(filter).populate('supplierId').lean();

    if (supplierProducts.length === 0) return [];

    const results: SupplierRankingResult[] = [];

    for (const sp of supplierProducts) {
      const supp = sp.supplierId as any;
      if (!supp || supp.status === 'BLACKLISTED') continue;

      let unitCost = sp.purchaseCost;
      if (sp.priceBreaks && sp.priceBreaks.length > 0) {
        for (const pb of sp.priceBreaks) {
          if (quantity >= pb.minQuantity && (!pb.maxQuantity || quantity <= pb.maxQuantity)) {
            unitCost = pb.unitPrice;
            break;
          }
        }
      }

      const overallScore = supp.scorecard?.overallScore || supp.rating * 20 || 85;

      results.push({
        supplierId: supp._id.toString(),
        supplierName: supp.name,
        unitCost,
        leadTimeDays: sp.leadTimeDays || supp.leadTimeDays || 7,
        moq: sp.minimumOrderQuantity || supp.moq || 1,
        overallScore,
        rank: 0,
        recommendationReason: `Cost ${sp.currency} ${unitCost}, ${sp.leadTimeDays || 7} days lead time, Score ${overallScore}%`,
      });
    }

    // Sort by lowest cost, highest score, and shortest lead time
    results.sort((a, b) => {
      if (a.unitCost !== b.unitCost) return a.unitCost - b.unitCost;
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      return a.leadTimeDays - b.leadTimeDays;
    });

    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return results;
  }
}
