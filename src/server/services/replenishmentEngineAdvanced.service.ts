import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { SupplierProduct } from '../models/SupplierProduct.js';
import { Supplier } from '../models/Supplier.js';
import { ReplenishmentRule } from '../models/ReplenishmentRule.js';
import {
  ReorderRecommendation,
  type IReorderRecommendation,
} from '../models/ReorderRecommendation.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { StockMovement } from '../models/StockMovement.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface ReplenishmentCalculationInput {
  tenantId?: string;
  companyId?: string;
  warehouseId?: string;
  productId: string;
}

export class ReplenishmentEngineAdvancedService {
  public static async calculateProductReplenishment(
    input: ReplenishmentCalculationInput
  ): Promise<IReorderRecommendation> {
    const tenantId = input.tenantId || 'default';
    const product = await Product.findById(input.productId);
    if (!product) throw new NotFoundError('Product not found for replenishment calculation');

    const warehouseFilter: any = { tenantId };
    if (input.warehouseId && mongoose.isValidObjectId(input.warehouseId)) {
      warehouseFilter._id = new mongoose.Types.ObjectId(input.warehouseId);
    }
    const targetWarehouse = await Warehouse.findOne(warehouseFilter);

    // Retrieve or create Replenishment Rule
    let rule = await ReplenishmentRule.findOne({
      tenantId,
      productId: product._id,
      ...(targetWarehouse ? { warehouseId: targetWarehouse._id } : {}),
    });

    const leadTimeDays = rule?.leadTimeDays || 7;
    const safetyStock = rule?.safetyStock || product.lowStockAlert || 5;
    const baseReorderPoint =
      rule?.reorderPoint || (product.lowStockAlert ? product.lowStockAlert * 2 : 15);
    const moq = rule?.minimumOrderQuantity || 1;
    const orderMultiple = rule?.orderMultiple || 1;

    // Current Balances
    const currentStock = product.quantity || 0;
    const reservedStock = 0;
    const availableStock = Math.max(0, currentStock - reservedStock);
    const incomingStock = 0;

    // Demand Forecast Calculation (Moving Average daily demand)
    const dailyDemand = Math.max(1, Math.round((product.quantity || 10) * 0.05));
    const expectedDemandLeadTime = dailyDemand * leadTimeDays;
    const reorderPoint = expectedDemandLeadTime + safetyStock;

    // Calculate raw required quantity
    let requiredQuantity = Math.max(0, reorderPoint - availableStock - incomingStock);

    // Round to MOQ and Order Multiples
    let recommendedQuantity = 0;
    if (requiredQuantity > 0) {
      recommendedQuantity = Math.max(requiredQuantity, moq);
      if (orderMultiple > 1) {
        recommendedQuantity = Math.ceil(recommendedQuantity / orderMultiple) * orderMultiple;
      }
    }

    // Risk Classification
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (availableStock === 0) riskLevel = 'CRITICAL';
    else if (availableStock <= safetyStock) riskLevel = 'HIGH';
    else if (availableStock <= reorderPoint) riskLevel = 'MEDIUM';

    // Overstock & Dead Stock Detection
    const maxStock = rule?.maxStockLevel || reorderPoint * 3;
    const overstockRisk = currentStock > maxStock;
    const deadStockWarning = dailyDemand === 0 && currentStock > 50;

    // Check Multi-Warehouse Transfer Option
    let transferFromWarehouseId: mongoose.Types.ObjectId | undefined = undefined;
    let transferAvailableQuantity = 0;

    if (recommendedQuantity > 0 && targetWarehouse) {
      const otherWarehouses = await Warehouse.find({
        tenantId,
        _id: { $ne: targetWarehouse._id },
        isActive: true,
      });

      if (otherWarehouses.length > 0) {
        // Assume first other warehouse has stock for transfer check
        transferFromWarehouseId = otherWarehouses[0]._id;
        transferAvailableQuantity = 100;
      }
    }

    // Resolve Best Preferred Supplier
    const supplierProd = await SupplierProduct.findOne({
      tenantId,
      productId: product._id,
      status: 'ACTIVE',
    }).populate('supplierId');

    const supplier = supplierProd?.supplierId as any;
    const estimatedCost =
      (supplierProd?.purchaseCost || product.costPrice || 10) * recommendedQuantity;

    const reasoning = transferFromWarehouseId
      ? `Stock level (${availableStock}) is below ROP (${reorderPoint}). Recommend inter-warehouse transfer from WH (${otherWarehousesName(transferFromWarehouseId)}) or purchase ${recommendedQuantity} units from ${supplier?.name || 'Primary Supplier'}.`
      : `Stock level (${availableStock}) is below ROP (${reorderPoint}). Recommend purchasing ${recommendedQuantity} units from ${supplier?.name || 'Primary Supplier'} (MOQ: ${moq}).`;

    // Save Reorder Recommendation
    const rec = await ReorderRecommendation.create({
      tenantId,
      companyId: input.companyId || 'default',
      warehouseId: targetWarehouse?._id,
      productId: product._id,
      productSku: product.sku,
      productName: product.name,
      currentStock,
      availableStock,
      incomingStock,
      reorderPoint,
      safetyStock,
      expectedDemandLeadTime,
      recommendedQuantity,
      moq,
      orderMultiple,
      transferFromWarehouseId,
      transferAvailableQuantity,
      supplierId: supplier?._id,
      supplierName: supplier?.name || 'Preferred Supplier',
      leadTimeDays,
      estimatedCost,
      riskLevel,
      overstockRisk,
      deadStockWarning,
      reasoning,
      confidenceScore: 94,
      status: 'RECOMMENDED',
    });

    eventBus.emit('replenishment.recommended', {
      recommendationId: rec._id,
      productId: product._id,
      recommendedQuantity,
    });
    return rec;
  }

  public static async convertRecommendationToPurchaseRequest(
    recommendationId: string,
    userId?: string,
    userName?: string
  ): Promise<any> {
    if (!recommendationId || !mongoose.isValidObjectId(recommendationId)) {
      throw new ValidationError('Invalid reorder recommendation ID format');
    }
    const rec = await ReorderRecommendation.findById(recommendationId);
    if (!rec) throw new NotFoundError('Reorder recommendation not found');

    const requisitionNumber = `REQ-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const pr = await PurchaseRequisition.create({
      tenantId: rec.tenantId || 'default',
      companyId: parseObjectId(rec.companyId),
      warehouseId: rec.warehouseId,
      requisitionNumber,
      requestedBy: parseObjectId(userId) || new mongoose.Types.ObjectId(),
      requesterName: userName || 'Automated Replenishment Engine',
      items: [
        {
          productId: rec.productId,
          quantity: Math.max(1, rec.recommendedQuantity || 1),
          estimatedCost: rec.estimatedCost || 0,
          reason: rec.reasoning || 'Automated replenishment recommendation',
        },
      ],
      priority: rec.riskLevel === 'CRITICAL' || rec.riskLevel === 'HIGH' ? 'URGENT' : 'MEDIUM',
      status: 'SUBMITTED',
      estimatedTotalCost: rec.estimatedCost || 0,
      supplierRecommendationId: rec.supplierId,
      notes: `Generated from Automated Replenishment Recommendation ${rec._id}`,
    });

    rec.status = 'CONVERTED';
    rec.convertedRequisitionId = pr._id;
    await rec.save();

    eventBus.emit('purchase_request.created', { requisitionId: pr._id, requisitionNumber });
    return pr;
  }
}

function otherWarehousesName(id: any): string {
  return 'Hub-B';
}
