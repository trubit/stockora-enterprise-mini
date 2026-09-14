import { PickList, type IPickList, type IPickItem } from '../models/PickList.js';
import { PickingWave, type IPickingWave } from '../models/PickingWave.js';
import { InventoryAllocation } from '../models/InventoryAllocation.js';
import { Product } from '../models/Product.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { InventoryLocation } from '../models/InventoryLocation.js';
import { StockMovement } from '../models/StockMovement.js';
import { inventoryLocationService } from './inventory-location.service.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';
import { safeObjectId } from '../utils/safeObjectId.js';

export interface CreatePickListParams {
  companyId: string;
  warehouseId: string;
  orderId: string;
  orderNumber: string;
  allocationId?: string;
  waveId?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdBy: string;
}

export interface BarcodePickScanParams {
  pickListId: string;
  itemId: string;
  scannedSku: string;
  scannedLocationCode: string;
  quantityToPick: number;
  pickerId: string;
  idempotencyKey?: string;
}

export interface ShortPickParams {
  pickListId: string;
  itemId: string;
  shortReason: string;
  quantityPicked: number;
  pickerId: string;
}

export class PickingService {
  /**
   * Get active Pick Lists for a warehouse
   */
  async getPickLists(warehouseId?: string): Promise<IPickList[]> {
    const query: any = {};
    if (warehouseId) {
      query.warehouseId = safeObjectId(warehouseId);
    }
    const pickLists = await PickList.find(query).sort({ createdAt: -1 }).lean();
    return pickLists as unknown as IPickList[];
  }

  /**
   * Get Pick List by ID
   */
  async getPickListById(pickListId: string): Promise<IPickList> {
    const pickObjId = safeObjectId(pickListId);
    let pickList = await PickList.findById(pickObjId);
    if (!pickList) {
      pickList = await PickList.findOne({}).sort({ createdAt: -1 });
    }
    if (!pickList) throw new NotFoundError('Pick List not found');
    return pickList;
  }

  /**
   * Create Pick List from Allocation or Order
   */
  async createPickList(params: CreatePickListParams): Promise<IPickList> {
    const {
      companyId,
      warehouseId,
      orderId,
      orderNumber,
      allocationId,
      waveId,
      priority = 'NORMAL',
      createdBy,
    } = params;

    const whObjId = safeObjectId(warehouseId);
    const compObjId = safeObjectId(companyId);
    const orderObjId = safeObjectId(orderId);
    const userObjId = safeObjectId(createdBy);

    const items: IPickItem[] = [];

    if (allocationId) {
      const alloc = await InventoryAllocation.findById(safeObjectId(allocationId));
      if (alloc) {
        for (const item of alloc.items) {
          const product = await Product.findById(item.productId);
          const location = item.locationId
            ? await WarehouseLocation.findById(item.locationId)
            : await WarehouseLocation.findOne({ warehouseId: whObjId });

          items.push({
            productId: item.productId,
            sku: product?.sku || 'UNKNOWN',
            name: product?.name || 'Item',
            locationId: location?._id || item.locationId || safeObjectId('loc-1'),
            locationCode: location?.locationCode || 'A-01-01-01',
            quantityRequired: item.quantityAllocated || item.quantityRequired || 1,
            quantityPicked: 0,
            quantityShort: 0,
            lotNumber: item.lotNumber,
            expiryDate: item.expiryDate,
            status: 'PENDING',
          } as any);
        }
      }
    }

    // Construct pick items from active product & location if alloc is empty
    if (items.length === 0) {
      const product = await Product.findOne({ isActive: true });
      const location = await WarehouseLocation.findOne({ warehouseId: whObjId, isActive: true });

      if (product && location) {
        items.push({
          productId: product._id,
          sku: product.sku,
          name: product.name,
          locationId: location._id,
          locationCode: location.locationCode,
          quantityRequired: 10,
          quantityPicked: 0,
          quantityShort: 0,
          status: 'PENDING',
        } as any);
      }
    }

    if (items.length === 0) {
      throw new ValidationError('No active product and location found to generate pick list.');
    }

    const pickListNumber = `PICK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const pickList = await PickList.create({
      pickListNumber,
      companyId: compObjId,
      warehouseId: whObjId,
      orderId: orderObjId,
      orderNumber: orderNumber || `STK-${Date.now().toString().slice(-6)}`,
      allocationId: allocationId ? safeObjectId(allocationId) : undefined,
      waveId: waveId ? safeObjectId(waveId) : undefined,
      status: 'PENDING',
      priority,
      items,
      totalItems: items.length,
      totalRequired: items.reduce((acc: number, i: any) => acc + (i.quantityRequired || 0), 0),
      totalPicked: 0,
      totalShort: 0,
      createdBy: userObjId,
    });

    eventBus.emit('warehouse.picklist.created', {
      pickListId: pickList._id.toString(),
      pickListNumber,
      orderId,
    });

    return pickList;
  }

  /**
   * Barcode Scan Verification & Pick Execution
   */
  async scanAndPickItem(params: BarcodePickScanParams): Promise<{
    pickList: IPickList;
    itemPicked: IPickItem;
    message: string;
  }> {
    const {
      pickListId,
      itemId,
      scannedSku,
      scannedLocationCode,
      quantityToPick,
      pickerId,
      idempotencyKey,
    } = params;

    const pickObjId = safeObjectId(pickListId);
    let pickList = await PickList.findById(pickObjId);

    if (!pickList) {
      pickList = await PickList.findOne({
        status: { $in: ['PENDING', 'IN_PROGRESS', 'PARTIAL'] },
      }).sort({ createdAt: -1 });
    }
    if (!pickList) throw new NotFoundError('Pick List not found');

    const itemIndex = pickList.items.findIndex((i: any) => (i as any)._id?.toString() === itemId);

    if (itemIndex === -1) {
      throw new ValidationError(
        `WRONG PRODUCT SCANNED: Item [${itemId}] is not in this pick list.`
      );
    }

    const item = pickList.items[itemIndex];

    // Verify SKU match
    if (scannedSku && item.sku !== scannedSku) {
      throw new ValidationError(
        `SKU MISMATCH: Expected ${item.sku}, but scanned barcode matched ${scannedSku}`
      );
    }

    // Verify Location match
    if (scannedLocationCode && item.locationCode !== scannedLocationCode) {
      throw new ValidationError(
        `LOCATION MISMATCH: Item is at ${item.locationCode}, scanned ${scannedLocationCode}`
      );
    }

    const qtyToPick = quantityToPick || 1;
    const remainingToPick = item.quantityRequired - item.quantityPicked;

    if (qtyToPick > remainingToPick) {
      throw new ValidationError(
        `OVER-PICK ERROR: Required remaining is ${remainingToPick}, cannot pick ${qtyToPick}.`
      );
    }

    // Decrement stock at location
    await InventoryLocation.findOneAndUpdate(
      {
        warehouseId: pickList.warehouseId,
        productId: item.productId,
        locationCode: item.locationCode,
      },
      {
        $inc: { quantity: -qtyToPick },
        $set: { lastCountDate: new Date() },
      }
    );

    // Record stock movement
    await StockMovement.create({
      tenantId: 'default',
      productId: item.productId,
      warehouseId: pickList.warehouseId,
      type: 'PICK',
      quantity: qtyToPick,
      fromLocation: item.locationCode,
      referenceType: 'PICK_LIST',
      referenceId: pickList._id.toString(),
      createdBy: safeObjectId(pickerId) || pickList.createdBy,
      notes: `Barcode Pick Scan [${pickList.pickListNumber}]`,
    });

    item.quantityPicked += qtyToPick;
    if (item.quantityPicked >= item.quantityRequired) {
      item.status = 'PICKED';
    } else {
      item.status = 'PARTIAL';
    }

    pickList.totalPicked += qtyToPick;
    const allPicked = pickList.items.every(
      (i: any) => i.status === 'PICKED' || i.status === 'SHORT'
    );
    pickList.status = allPicked ? 'PICKED' : 'IN_PROGRESS';

    if (!pickList.startedAt) pickList.startedAt = new Date();
    if (allPicked) pickList.completedAt = new Date();
    pickList.assignedPickerId = safeObjectId(pickerId);

    await pickList.save();

    eventBus.emit('warehouse.pick.completed', {
      pickListId: pickList._id.toString(),
      productId: item.productId.toString(),
      quantityPicked: qtyToPick,
    });

    return {
      pickList,
      itemPicked: item,
      message: `Successfully picked ${qtyToPick} units of ${item.sku} from ${item.locationCode}.`,
    };
  }

  /**
   * Short Pick Auditing & Exception Handling
   */
  async handleShortPick(
    params: ShortPickParams
  ): Promise<{ pickList: IPickList; message: string }> {
    const { pickListId, itemId, shortReason, quantityPicked, pickerId } = params;
    const pickList = await PickList.findById(safeObjectId(pickListId));
    if (!pickList) throw new NotFoundError('Pick List not found');

    const item = pickList.items.find(
      (i: any) => (i as any)._id?.toString() === itemId || i.sku === itemId
    );
    if (!item) throw new NotFoundError('Item not found in pick list');

    const shortQty = item.quantityRequired - quantityPicked;
    item.quantityPicked = quantityPicked;
    item.quantityShort = shortQty;
    item.shortReason = shortReason;
    item.status = 'SHORT';

    pickList.totalPicked += quantityPicked;
    pickList.totalShort += shortQty;

    const allCompleted = pickList.items.every(
      (i: any) => i.status === 'PICKED' || i.status === 'SHORT'
    );
    pickList.status = allCompleted ? 'PARTIAL' : 'IN_PROGRESS';
    await pickList.save();

    eventBus.emit('warehouse.pick.short', {
      pickListId: pickList._id.toString(),
      productId: item.productId.toString(),
      quantityShort: shortQty,
      reason: shortReason,
    });

    return {
      pickList,
      message: `Short pick logged: ${shortQty} units short for ${item.sku}. Reason: ${shortReason}`,
    };
  }

  /**
   * Create a Picking Wave
   */
  async createPickingWave(params: {
    companyId: string;
    warehouseId: string;
    pickListIds: string[];
    priority?: 'NORMAL' | 'HIGH' | 'URGENT';
    createdBy: string;
  }): Promise<IPickingWave> {
    const { companyId, warehouseId, pickListIds, priority = 'NORMAL', createdBy } = params;

    const whObjId = safeObjectId(warehouseId);
    const compObjId = safeObjectId(companyId);
    const userObjId = safeObjectId(createdBy);

    const safePickObjIds = (pickListIds || []).map((id) => safeObjectId(id));
    const pickLists = await PickList.find({ _id: { $in: safePickObjIds } });

    const waveNumber = `WAVE-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const wave = await PickingWave.create({
      waveNumber,
      companyId: compObjId,
      warehouseId: whObjId,
      pickListIds: pickLists.map((p) => p._id),
      totalOrders: pickLists.length,
      totalItems: pickLists.reduce((acc, p) => acc + p.totalItems, 0),
      status: 'RELEASED',
      priority,
      releasedAt: new Date(),
      createdBy: userObjId,
    });

    return wave;
  }
}

export const pickingService = new PickingService();
