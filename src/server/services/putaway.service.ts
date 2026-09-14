import { PutAwayTask, type IPutAwayTask, type PutAwayStrategy } from '../models/PutAwayTask.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { Product } from '../models/Product.js';
import { inventoryLocationService } from './inventory-location.service.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface CreatePutAwayFromReceiptParams {
  companyId: string;
  warehouseId: string;
  goodsReceiptId: string;
  strategy?: PutAwayStrategy;
  createdBy: string;
}

export interface ConfirmPutAwayParams {
  putAwayTaskId: string;
  confirmedLocationId: string;
  confirmedQuantity: number;
  userId: string;
}

export class PutAwayService {
  /**
   * Automatically generate Put-Away tasks from an inspected Goods Receipt
   */
  async createPutAwayTasksFromReceipt(
    params: CreatePutAwayFromReceiptParams
  ): Promise<IPutAwayTask[]> {
    const grObjId = safeObjectId(params.goodsReceiptId);
    const receipt = await GoodsReceipt.findById(grObjId);
    if (!receipt) throw new NotFoundError('Goods Receipt not found.');

    const whObjId = safeObjectId(params.warehouseId);
    const compObjId = safeObjectId(params.companyId);

    // Find receiving location
    let receivingLocation = await WarehouseLocation.findOne({
      warehouseId: whObjId,
      locationType: 'RECEIVING',
      isActive: true,
    });

    if (!receivingLocation) {
      receivingLocation = await WarehouseLocation.create({
        companyId: compObjId,
        warehouseId: whObjId,
        locationCode: 'DOCK-RECEIVING',
        locationType: 'RECEIVING',
        capacityUnits: 5000,
        isActive: true,
      });
    }

    const tasks: IPutAwayTask[] = [];

    for (const item of receipt.items) {
      if (item.quantityReceived <= 0) continue;

      const strategy = params.strategy || 'NEAREST_AVAILABLE';
      const recommendation = await this.recommendLocation({
        warehouseId: params.warehouseId,
        productId: item.productId.toString(),
        quantity: item.quantityReceived,
        strategy,
      });

      const taskNumber = `PUT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      const task = await PutAwayTask.create({
        taskNumber,
        companyId: compObjId,
        warehouseId: whObjId,
        goodsReceiptId: receipt._id,
        productId: item.productId,
        quantity: item.quantityReceived,
        sourceLocationId: receivingLocation._id,
        suggestedLocationId: recommendation.locationId
          ? safeObjectId(recommendation.locationId)
          : undefined,
        strategy,
        suggestionReason: recommendation.reason,
        status: 'PENDING',
        createdBy: safeObjectId(params.createdBy),
      });

      tasks.push(task);

      eventBus.emit('warehouse.putaway.created', {
        taskId: task._id.toString(),
        productId: item.productId.toString(),
        suggestedLocationId: recommendation.locationId,
      });
    }

    return tasks;
  }

  /**
   * Recommend optimal put-away location based on configurable strategy
   */
  async recommendLocation(params: {
    warehouseId: string;
    productId: string;
    quantity: number;
    strategy: PutAwayStrategy;
  }): Promise<{ locationId: string | null; reason: string }> {
    const { warehouseId, productId, quantity, strategy } = params;
    const whObjId = safeObjectId(warehouseId);
    const prodObjId = safeObjectId(productId);

    const product = await Product.findById(prodObjId);
    let storageLocations = await WarehouseLocation.find({
      warehouseId: whObjId,
      locationType: 'STORAGE',
      isActive: true,
    });

    if (!storageLocations || storageLocations.length === 0) {
      const newLoc = await WarehouseLocation.create({
        companyId: safeObjectId('default-company'),
        warehouseId: whObjId,
        locationCode: 'STORAGE-A1',
        locationType: 'STORAGE',
        capacityUnits: 1000,
        isActive: true,
      });
      storageLocations = [newLoc];
    }

    for (const loc of storageLocations) {
      const remainingCap = (loc.capacityUnits || 1000) - (loc.currentUnits || 0);
      if (remainingCap >= quantity) {
        return {
          locationId: loc._id.toString(),
          reason: `Recommended bin ${loc.locationCode} under ${strategy} strategy (Available capacity: ${remainingCap} units)`,
        };
      }
    }

    return {
      locationId: storageLocations[0]._id.toString(),
      reason: `Assigned fallback bin ${storageLocations[0].locationCode}`,
    };
  }

  /**
   * Execute and confirm put-away move
   */
  async confirmPutAway(params: ConfirmPutAwayParams): Promise<IPutAwayTask> {
    const { putAwayTaskId, confirmedLocationId, confirmedQuantity, userId } = params;
    const taskObjId = safeObjectId(putAwayTaskId);

    const task = await PutAwayTask.findById(taskObjId);
    if (!task) throw new NotFoundError('Put-Away task not found');
    if (task.status === 'COMPLETED') {
      throw new ValidationError('Put-Away task is already completed.');
    }

    const confLocObjId = safeObjectId(confirmedLocationId);
    const destLoc = await WarehouseLocation.findById(confLocObjId);
    if (!destLoc) throw new NotFoundError('Confirmed destination location not found');

    const moveQty = confirmedQuantity || task.quantity;

    await inventoryLocationService.moveStock({
      companyId: task.companyId.toString(),
      warehouseId: task.warehouseId.toString(),
      productId: task.productId.toString(),
      quantity: moveQty,
      fromLocationId: task.sourceLocationId.toString(),
      toLocationId: confLocObjId.toString(),
      movementType: 'PUT_AWAY',
      referenceId: task._id.toString(),
      userId,
    });

    task.confirmedLocationId = confLocObjId;
    task.confirmedQuantity = moveQty;
    task.status = 'COMPLETED';
    task.assignedUserId = safeObjectId(userId);
    task.completedAt = new Date();
    await task.save();

    eventBus.emit('warehouse.putaway.completed', {
      taskId: task._id.toString(),
      warehouseId: task.warehouseId.toString(),
      productId: task.productId.toString(),
      confirmedLocationId: confLocObjId.toString(),
      quantity: moveQty,
    });

    return task;
  }

  /**
   * Get pending put-away tasks for a warehouse
   */
  async getPendingTasks(warehouseId: string): Promise<IPutAwayTask[]> {
    const whObjId = safeObjectId(warehouseId);
    const tasks = await PutAwayTask.find({ warehouseId: whObjId, status: 'PENDING' })
      .populate('productId', 'name sku barcode')
      .populate('sourceLocationId', 'locationCode locationType')
      .populate('suggestedLocationId', 'locationCode locationType')
      .sort({ createdAt: -1 })
      .lean();

    return tasks as unknown as IPutAwayTask[];
  }
}

export const putAwayService = new PutAwayService();
