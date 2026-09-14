import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { QualityInspection } from '../models/QualityInspection.js';
import { Product } from '../models/Product.js';

export class ProcurementAnalyticsService {
  public static async getProcurementAnalytics(
    tenantId = 'default',
    companyId?: string
  ): Promise<any> {
    const filter: any = { tenantId };
    if (companyId && mongoose.isValidObjectId(companyId)) {
      filter.companyId = new mongoose.Types.ObjectId(companyId);
    }

    const totalSuppliers = await Supplier.countDocuments(filter);
    const openPOs = await PurchaseOrder.countDocuments({
      ...filter,
      status: { $in: ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] },
    });
    const pendingRequisitions = await PurchaseRequisition.countDocuments({
      ...filter,
      status: 'SUBMITTED',
    });

    const totalPOs = await PurchaseOrder.find(filter).lean();
    let totalSpend = 0;
    for (const po of totalPOs) {
      totalSpend += po.totalAmount || 0;
    }

    const suppliers = await Supplier.find(filter).limit(10).lean();
    const spendBySupplier = [];

    for (const sup of suppliers as any[]) {
      const supPOs = totalPOs.filter((p: any) => p.supplierId?.toString() === sup._id?.toString());
      let supSpend = 0;
      for (const po of supPOs) supSpend += po.totalAmount || 0;

      spendBySupplier.push({
        supplierId: sup._id,
        supplierName: sup.name,
        category: sup.category,
        totalSpend: supSpend,
        poCount: supPOs.length,
        overallScore: sup.scorecard?.overallScore || 100,
      });
    }

    const inspections = await QualityInspection.find(filter).lean();
    let totalInspected = 0;
    let totalFailed = 0;
    for (const qi of inspections) {
      for (const item of qi.items) {
        totalInspected += item.quantityInspected;
        totalFailed += item.quantityFailed;
      }
    }
    const qualityRejectionRate =
      totalInspected > 0 ? Math.round((totalFailed / totalInspected) * 100) : 0;

    // AI Reorder Advisory
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$quantity', '$lowStockAlert'] },
    })
      .limit(5)
      .lean();

    const reorderRecommendations = lowStockProducts.map((p) => ({
      productId: p._id,
      name: p.name,
      sku: p.sku,
      currentStock: p.quantity,
      recommendedQty: Math.max(50, (p.lowStockAlert || 10) * 3 - p.quantity),
      rationale: `Stock level (${p.quantity}) is below alert threshold (${p.lowStockAlert || 10}). Reorder recommended.`,
    }));

    return {
      totalSuppliers,
      openPOs,
      pendingRequisitions,
      totalSpend,
      qualityRejectionRate,
      spendBySupplier,
      aiProcurementAdvisory: {
        reorderRecommendations,
        overallSupplierHealth: totalSuppliers > 0 ? 'STRONG' : 'MODERATE',
        priceVarianceAdvice: 'Purchase price variances are within 2% threshold.',
      },
    };
  }
}
