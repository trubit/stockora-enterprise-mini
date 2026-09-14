import mongoose from 'mongoose';
import { PickList, type IPickList } from '../models/PickList.js';
import { PickingWave } from '../models/PickingWave.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { StockMovement } from '../models/StockMovement.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export interface CreatePickListInput {
  tenantId?: string;
  companyId?: string;
  warehouseId: string;
  orderId?: string;
  strategy?: 'SINGLE' | 'BATCH' | 'WAVE' | 'ZONE';
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  assignedTo?: string;
  items: { productId: string; locationId?: string; requestedQuantity: number }[];
}

export class PickingAdvancedService {
  public static async createPickTask(input: CreatePickListInput): Promise<IPickList> {
    const tenantId = input.tenantId || 'default';
    const pickListNumber = `PICK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const items = [];
    for (const item of input.items) {
      let locId = parseObjectId(item.locationId);
      if (!locId) {
        // Deterministic Route Optimization Strategy: pick from storage location with highest sequence priority
        const loc: any = await WarehouseLocation.findOne({
          warehouseId: input.warehouseId,
          locationType: { $in: ['STORAGE', 'PICKING'] },
          isActive: true,
        })
          .sort({ pickSequencePriority: 1, aisle: 1, rack: 1 })
          .lean();
        locId = loc?._id;
      }

      items.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        locationId: locId,
        requestedQuantity: item.requestedQuantity,
        pickedQuantity: 0,
        status: 'PENDING' as const,
      });
    }

    const pickTask = await PickList.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      warehouseId: new mongoose.Types.ObjectId(input.warehouseId),
      pickListNumber,
      orderId: parseObjectId(input.orderId),
      strategy: input.strategy || 'SINGLE',
      priority: input.priority || 'NORMAL',
      assignedTo: parseObjectId(input.assignedTo),
      items,
      status: 'ASSIGNED',
    });

    eventBus.emit('pick.created', { pickTaskId: pickTask._id, pickListNumber });
    return pickTask;
  }

  public static async createPickWave(input: {
    tenantId?: string;
    warehouseId: string;
    carrierName?: string;
    cutoffTime?: Date;
    orderIds: string[];
  }): Promise<any> {
    const waveNumber = `WAVE-${Date.now().toString().slice(-6)}`;
    const wave = await PickingWave.create({
      tenantId: input.tenantId || 'default',
      warehouseId: new mongoose.Types.ObjectId(input.warehouseId),
      waveNumber,
      carrierName: input.carrierName,
      cutoffTime: input.cutoffTime || new Date(),
      orderIds: input.orderIds.map((id) => new mongoose.Types.ObjectId(id)),
      status: 'CREATED',
    });

    eventBus.emit('wave.created', { waveId: wave._id, waveNumber });
    return wave;
  }

  public static async executePickItem(input: {
    pickTaskId: string;
    productId: string;
    quantityPicked: number;
    scannedBarcode?: string;
    serialNumber?: string;
    batchNumber?: string;
    pickerId?: string;
  }): Promise<IPickList> {
    const pickList = await PickList.findById(input.pickTaskId);
    if (!pickList) throw new NotFoundError('Pick task not found');

    const item = pickList.items.find((i: any) => i.productId?.toString() === input.productId);
    if (!item)
      throw new ValidationError(
        `Product ${input.productId} is not part of pick task ${pickList.pickListNumber}`
      );

    item.pickedQuantity = (item.pickedQuantity || 0) + input.quantityPicked;
    item.status = item.pickedQuantity >= item.requestedQuantity ? 'PICKED' : 'PARTIALLY_PICKED';

    const allPicked = pickList.items.every((i: any) => i.pickedQuantity >= i.requestedQuantity);
    pickList.status = allPicked ? 'COMPLETED' : 'IN_PROGRESS';
    await pickList.save();

    await StockMovement.create({
      tenantId: pickList.tenantId,
      productId: input.productId,
      warehouseId: pickList.warehouseId,
      quantity: -input.quantityPicked,
      type: 'PICK',
      referenceId: pickList.pickListNumber,
      lotNumber: input.batchNumber,
      serialNumber: input.serialNumber,
      userId: parseObjectId(input.pickerId),
      notes: `Picked for task ${pickList.pickListNumber}`,
    });

    if (pickList.orderId) {
      await OmnichannelOrder.findByIdAndUpdate(pickList.orderId, { fulfillmentStatus: 'PICKED' });
    }

    eventBus.emit('pick.completed', { pickTaskId: pickList._id, isCompleted: allPicked });
    return pickList;
  }

  public static async recordPickException(input: {
    pickTaskId: string;
    productId: string;
    exceptionReason: 'SHORT_STOCK' | 'WRONG_LOCATION' | 'DAMAGED' | 'MISSING' | 'BARCODE_MISMATCH';
    notes?: string;
  }): Promise<IPickList> {
    const pickList = await PickList.findById(input.pickTaskId);
    if (!pickList) throw new NotFoundError('Pick task not found');

    pickList.status = 'EXCEPTION';
    await pickList.save();

    eventBus.emit('pick.exception', { pickTaskId: pickList._id, reason: input.exceptionReason });
    return pickList;
  }
}
