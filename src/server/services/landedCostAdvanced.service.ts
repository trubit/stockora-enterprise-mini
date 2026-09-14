import mongoose from 'mongoose';
import {
  LandedCostAllocation,
  type ILandedCostAllocation,
  type LandedCostAllocationMethod,
} from '../models/LandedCostAllocation.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface CreateLandedCostInput {
  tenantId?: string;
  companyId?: string;
  purchaseOrderId: string;
  totalFreightCost?: number;
  totalCustomsDuty?: number;
  totalInsuranceCost?: number;
  otherCosts?: number;
  allocationMethod?: LandedCostAllocationMethod;
  appliedBy?: string;
}

export class LandedCostAdvancedService {
  public static async createAndApplyLandedCost(
    input: CreateLandedCostInput
  ): Promise<ILandedCostAllocation> {
    const tenantId = input.tenantId || 'default';
    const po = await PurchaseOrder.findById(input.purchaseOrderId);
    if (!po) throw new NotFoundError('Purchase Order not found for landed cost allocation');

    const allocationNumber = `LCA-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const freight = input.totalFreightCost || 0;
    const duty = input.totalCustomsDuty || 0;
    const insurance = input.totalInsuranceCost || 0;
    const other = input.otherCosts || 0;
    const totalLandedCost = freight + duty + insurance + other;

    const method = input.allocationMethod || 'BY_VALUE';
    const items = [];

    const totalQuantity = po.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const totalValue = po.subtotal || po.totalAmount || 1;

    for (const item of po.items) {
      let itemShare = 0;

      if (method === 'BY_QUANTITY') {
        itemShare = totalQuantity > 0 ? (item.quantity / totalQuantity) * totalLandedCost : 0;
      } else if (method === 'BY_VALUE') {
        const itemValue = item.quantity * item.costPrice;
        itemShare = totalValue > 0 ? (itemValue / totalValue) * totalLandedCost : 0;
      } else {
        itemShare = totalLandedCost / po.items.length;
      }

      const allocatedLandedCostPerUnit = item.quantity > 0 ? itemShare / item.quantity : 0;
      const finalUnitCost = item.costPrice + allocatedLandedCostPerUnit;

      items.push({
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        baseCost: item.costPrice,
        allocatedLandedCost: itemShare,
        finalUnitCost,
      });

      // Update product cost price in inventory ledger
      await Product.findByIdAndUpdate(item.productId, {
        costPrice: finalUnitCost,
      });

      await StockMovement.create({
        tenantId,
        companyId: parseObjectId(input.companyId),
        productId: item.productId,
        warehouseId: po.warehouseId,
        quantity: 0,
        type: 'ADJUSTMENT',
        referenceId: allocationNumber,
        userId: parseObjectId(input.appliedBy),
        notes: `Landed cost adjustment (+${allocatedLandedCostPerUnit.toFixed(2)} per unit). Final unit cost: ${finalUnitCost.toFixed(2)}`,
      });
    }

    const allocationDoc = await LandedCostAllocation.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      purchaseOrderId: po._id,
      allocationNumber,
      totalFreightCost: freight,
      totalCustomsDuty: duty,
      totalInsuranceCost: insurance,
      otherCosts: other,
      totalLandedCost,
      allocationMethod: method,
      items,
      status: 'APPLIED',
      appliedBy: parseObjectId(input.appliedBy),
      appliedAt: new Date(),
    });

    eventBus.emit('landed_cost.applied', { allocationId: allocationDoc._id, allocationNumber });
    return allocationDoc;
  }
}
