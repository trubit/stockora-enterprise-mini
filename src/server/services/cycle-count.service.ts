import {
  CycleCount,
  type ICycleCount,
  type CountType,
  type ICycleCountItem,
} from '../models/CycleCount.js';
import { InventoryLocation } from '../models/InventoryLocation.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { Product } from '../models/Product.js';
import { inventoryLocationService } from './inventory-location.service.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface CreateCycleCountParams {
  companyId: string;
  warehouseId: string;
  countType: CountType;
  zoneId?: string;
  locationIds?: string[];
  productIds?: string[];
  isBlindCount?: boolean;
  assignedCounterId?: string;
  assignedCounterName?: string;
  createdBy: string;
}

export interface RecordCountItemInput {
  itemId: string;
  countedQuantity: number;
  notes?: string;
}

export class CycleCountService {
  /**
   * Create a new Cycle Count task
   */
  async createCycleCount(params: CreateCycleCountParams): Promise<ICycleCount> {
    const {
      companyId,
      warehouseId,
      countType,
      zoneId,
      locationIds,
      productIds,
      isBlindCount = true,
      assignedCounterId,
      assignedCounterName,
      createdBy,
    } = params;

    const whObjId = safeObjectId(warehouseId);
    const compObjId = safeObjectId(companyId);
    const userObjId = safeObjectId(createdBy);

    const query: any = { warehouseId: whObjId };
    if (productIds && productIds.length > 0)
      query.productId = { $in: productIds.map((id) => safeObjectId(id)) };
    if (locationIds && locationIds.length > 0)
      query.locationId = { $in: locationIds.map((id) => safeObjectId(id)) };

    const stockRecords = await InventoryLocation.find(query)
      .populate('productId', 'name sku costPrice')
      .populate('locationId', 'locationCode')
      .limit(200);

    const items: ICycleCountItem[] = [];

    for (const rec of stockRecords) {
      const prod = rec.productId as any;
      const loc = rec.locationId as any;
      if (!prod || !loc) continue;

      items.push({
        productId: prod._id,
        sku: prod.sku || 'SKU',
        name: prod.name || 'Product',
        locationId: loc._id,
        locationCode: loc.locationCode,
        lotNumber: rec.lotNumber,
        serialNumber: rec.serialNumber,
        expectedQuantity: rec.quantity,
        unitCost: prod.costPrice || 0,
        status: 'PENDING',
      } as any);
    }

    // Fallback if no inventory locations exist yet
    if (items.length === 0) {
      const loc = await WarehouseLocation.findOne({ warehouseId: whObjId, isActive: true });
      const prod = await Product.findOne({ isActive: true });

      if (loc && prod) {
        items.push({
          productId: prod._id,
          sku: prod.sku || 'SKU-01',
          name: prod.name || 'Sample Product',
          locationId: loc._id,
          locationCode: loc.locationCode,
          expectedQuantity: prod.quantity || 10,
          unitCost: prod.costPrice || 10,
          status: 'PENDING',
        } as any);
      }
    }

    const countNumber = `CNT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const count = await CycleCount.create({
      countNumber,
      companyId: compObjId,
      warehouseId: whObjId,
      countType: countType || 'SCHEDULED',
      zoneId: zoneId ? safeObjectId(zoneId) : undefined,
      isBlindCount,
      status: 'ASSIGNED',
      assignedCounterId: assignedCounterId ? safeObjectId(assignedCounterId) : userObjId,
      assignedCounterName: assignedCounterName || 'Inventory Auditor',
      items,
      totalExpectedItems: items.length,
      totalCountedItems: 0,
      totalVarianceCount: 0,
      totalVarianceValue: 0,
      createdBy: userObjId,
    });

    eventBus.emit('warehouse.cyclecount.created', {
      countId: count._id.toString(),
      countNumber,
      warehouseId,
    });

    return count;
  }

  /**
   * Submit physical count results for a cycle count
   */
  async submitCountResults(
    countId: string,
    counterId: string,
    countedItems: RecordCountItemInput[]
  ): Promise<ICycleCount> {
    const countObjId = safeObjectId(countId);
    const count = await CycleCount.findById(countObjId);
    if (!count) throw new NotFoundError('Cycle count task not found.');

    let totalVarianceCount = 0;
    let totalVarianceValue = 0;
    let countedItemsCount = 0;
    let requiresSupervisorReview = false;

    const inputMap = new Map(countedItems.map((i) => [i.itemId, i]));

    for (const item of count.items) {
      const itemObjIdStr = (item as any)._id?.toString() || item.sku;
      const input = inputMap.get(itemObjIdStr) || inputMap.get(item.sku);

      if (input !== undefined) {
        const countedQty = input.countedQuantity;
        const variance = countedQty - item.expectedQuantity;
        const varianceVal = Math.abs(variance * (item.unitCost || 0));

        item.countedQuantity = countedQty;
        item.variance = variance;
        item.varianceValue = varianceVal;
        item.status = variance === 0 ? 'COUNTED' : 'VERIFIED';
        item.notes = input.notes;

        if (variance !== 0) {
          totalVarianceCount += Math.abs(variance);
          totalVarianceValue += varianceVal;
          requiresSupervisorReview = true;
        }

        countedItemsCount++;
      }
    }

    count.totalCountedItems = countedItemsCount;
    count.totalVarianceCount = totalVarianceCount;
    count.totalVarianceValue = totalVarianceValue;
    count.status = requiresSupervisorReview ? 'REVIEW_REQUIRED' : 'COMPLETED';

    if (count.status === 'COMPLETED') {
      await this.applyCountAdjustments(count._id.toString(), counterId);
    } else {
      await count.save();
    }

    eventBus.emit('warehouse.cyclecount.submitted', {
      countId: count._id.toString(),
      status: count.status,
      totalVarianceCount,
    });

    return count;
  }

  /**
   * Apply stock adjustment for approved cycle count variances
   */
  async applyCountAdjustments(countId: string, supervisorId: string): Promise<ICycleCount> {
    const countObjId = safeObjectId(countId);
    const count = await CycleCount.findById(countObjId);
    if (!count) throw new NotFoundError('Cycle count task not found.');

    for (const item of count.items) {
      if (item.variance && item.variance !== 0) {
        const movementType = 'ADJUSTMENT';
        const qty = Math.abs(item.variance);

        await inventoryLocationService.moveStock({
          companyId: count.companyId.toString(),
          warehouseId: count.warehouseId.toString(),
          productId: item.productId.toString(),
          quantity: qty,
          fromLocationId: item.locationId.toString(),
          toLocationId: item.locationId.toString(),
          movementType,
          referenceId: count._id.toString(),
          userId: supervisorId,
          notes: `Cycle Count Adjustment [${count.countNumber}]`,
        });

        item.status = 'ADJUSTED';
      }
    }

    count.status = 'COMPLETED';
    count.approvedBy = safeObjectId(supervisorId);
    count.approvedAt = new Date();
    await count.save();

    eventBus.emit('warehouse.cyclecount.approved', {
      countId: count._id.toString(),
      approvedBy: supervisorId,
    });

    return count;
  }
}

export const cycleCountService = new CycleCountService();
