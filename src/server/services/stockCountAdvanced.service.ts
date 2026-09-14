import mongoose from 'mongoose';
import { CycleCount, type ICycleCount } from '../models/CycleCount.js';
import { Product } from '../models/Product.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { StockMovement } from '../models/StockMovement.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export class StockCountAdvancedService {
  public static async createStockCount(input: {
    tenantId?: string;
    companyId?: string;
    warehouseId: string;
    countType: 'FULL' | 'CYCLE' | 'BLIND' | 'LOCATION';
    items: { productId: string; locationId?: string }[];
    notes?: string;
  }): Promise<ICycleCount> {
    const tenantId = input.tenantId || 'default';
    const countNumber = `CNT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const items = [];
    for (const item of input.items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);

      const systemQuantity = product.quantity || 0;
      items.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        locationId: parseObjectId(item.locationId),
        systemQuantity,
        countedQuantity: 0,
        variance: 0,
        status: 'PENDING' as const,
      });
    }

    const countDoc = await CycleCount.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      warehouseId: new mongoose.Types.ObjectId(input.warehouseId),
      countNumber,
      countType: input.countType,
      items,
      status: 'IN_PROGRESS',
      notes: input.notes,
    });

    eventBus.emit('count.created', { countId: countDoc._id, countNumber });
    return countDoc;
  }

  public static async submitCountResults(input: {
    countId: string;
    counts: { productId: string; countedQuantity: number }[];
    counterId?: string;
  }): Promise<ICycleCount> {
    const countDoc = await CycleCount.findById(input.countId);
    if (!countDoc) throw new NotFoundError('Stock count record not found');

    let totalVariance = 0;
    for (const cResult of input.counts) {
      const item = countDoc.items.find((i: any) => i.productId?.toString() === cResult.productId);
      if (item) {
        item.countedQuantity = cResult.countedQuantity;
        item.variance = cResult.countedQuantity - item.systemQuantity;
        item.status = 'COUNTED';
        totalVariance += Math.abs(item.variance);
      }
    }

    countDoc.status = totalVariance === 0 ? 'COMPLETED' : 'VARIANCE_DETECTED';
    await countDoc.save();

    eventBus.emit('count.submitted', { countId: countDoc._id, totalVariance });
    return countDoc;
  }

  public static async approveCountReconciliation(
    countId: string,
    approvedBy?: string,
    approvedByName?: string
  ): Promise<ICycleCount> {
    const countDoc = await CycleCount.findById(countId);
    if (!countDoc) throw new NotFoundError('Stock count record not found');

    for (const item of countDoc.items) {
      if (item.variance !== 0) {
        // Adjust product stock to match physical count
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: item.variance },
        });

        await StockMovement.create({
          tenantId: countDoc.tenantId,
          companyId: countDoc.companyId,
          productId: item.productId,
          warehouseId: countDoc.warehouseId,
          quantity: item.variance,
          type: 'CYCLE_COUNT',
          referenceId: countDoc.countNumber,
          userId: parseObjectId(approvedBy),
          notes: `Stock count reconciliation adjustment (Variance: ${item.variance})`,
        });

        await StockAdjustment.create({
          tenantId: countDoc.tenantId,
          companyId: countDoc.companyId,
          productId: item.productId,
          warehouseId: countDoc.warehouseId,
          quantityDelta: item.variance,
          reason: `Count Reconciliation for ${countDoc.countNumber}`,
          approvedBy: parseObjectId(approvedBy),
        });
      }
    }

    countDoc.status = 'COMPLETED';
    await countDoc.save();

    eventBus.emit('inventory.reconciliation.completed', { countId: countDoc._id });
    return countDoc;
  }
}
