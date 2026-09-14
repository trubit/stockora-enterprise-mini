import mongoose from 'mongoose';
import { Warehouse, type IWarehouse } from '../models/Warehouse.js';
import { WarehouseLocation, type IWarehouseLocation } from '../models/WarehouseLocation.js';
import { WarehouseTransfer, type IWarehouseTransfer } from '../models/WarehouseTransfer.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

function parseObjectId(idStr?: string): mongoose.Types.ObjectId | undefined {
  if (!idStr || !mongoose.isValidObjectId(idStr)) return undefined;
  return new mongoose.Types.ObjectId(idStr);
}

export class WarehouseAdvancedService {
  // Warehouse & Location Management
  public static async createWarehouse(input: any): Promise<IWarehouse> {
    const tenantId = input.tenantId || 'default';
    const code = (input.code || `WH-${Date.now().toString().slice(-4)}`).toUpperCase();

    const wh = await Warehouse.create({
      ...input,
      tenantId,
      code,
      companyId: parseObjectId(input.companyId),
      branchId: parseObjectId(input.branchId),
      managerId: parseObjectId(input.managerId),
    });

    eventBus.emit('warehouse.created', { warehouseId: wh._id, code: wh.code, name: wh.name });
    return wh;
  }

  public static async createLocation(input: any): Promise<IWarehouseLocation> {
    const tenantId = input.tenantId || 'default';
    const locationCode = (
      input.locationCode || `LOC-${Date.now().toString().slice(-4)}`
    ).toUpperCase();

    const loc = await WarehouseLocation.create({
      ...input,
      tenantId,
      locationCode,
      warehouseId: new mongoose.Types.ObjectId(input.warehouseId),
      zoneId: parseObjectId(input.zoneId),
      companyId: parseObjectId(input.companyId),
      createdBy: parseObjectId(input.userId),
    });

    eventBus.emit('location.created', { locationId: loc._id, locationCode: loc.locationCode });
    return loc;
  }

  public static async checkLocationCapacity(
    locationId: string,
    additionalUnits: number,
    additionalWeight = 0,
    additionalVolume = 0
  ): Promise<boolean> {
    const loc = await WarehouseLocation.findById(locationId);
    if (!loc) throw new NotFoundError('Location not found');

    if (loc.capacityUnits && loc.currentUnits + additionalUnits > loc.capacityUnits) {
      throw new ValidationError(
        `Capacity exceeded for location ${loc.locationCode}. Max: ${loc.capacityUnits}, Current: ${loc.currentUnits}, Attempted: ${additionalUnits}`
      );
    }

    if (loc.capacityWeight && loc.currentWeight + additionalWeight > loc.capacityWeight) {
      throw new ValidationError(
        `Weight capacity exceeded for location ${loc.locationCode}. Max: ${loc.capacityWeight}kg, Current: ${loc.currentWeight}kg`
      );
    }

    if (loc.capacityVolume && loc.currentVolume + additionalVolume > loc.capacityVolume) {
      throw new ValidationError(
        `Volume capacity exceeded for location ${loc.locationCode}. Max: ${loc.capacityVolume}m³, Current: ${loc.currentVolume}m³`
      );
    }

    return true;
  }

  // Inter-Warehouse Transfers
  public static async createTransferRequest(input: {
    tenantId?: string;
    companyId?: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    items: { productId: string; quantity: number; fromLocationId?: string }[];
    notes?: string;
    userId?: string;
  }): Promise<IWarehouseTransfer> {
    const tenantId = input.tenantId || 'default';
    const transferNumber = `TRF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const transferItems = [];
    for (const item of input.items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);

      if ((product.quantity || 0) < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for product ${product.name} to initiate transfer.`
        );
      }

      transferItems.push({
        productId: new mongoose.Types.ObjectId(item.productId),
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        fromLocationId: parseObjectId(item.fromLocationId),
        shippedQuantity: 0,
        receivedQuantity: 0,
      });
    }

    const transfer = await WarehouseTransfer.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      transferNumber,
      fromWarehouseId: new mongoose.Types.ObjectId(input.fromWarehouseId),
      toWarehouseId: new mongoose.Types.ObjectId(input.toWarehouseId),
      items: transferItems,
      status: 'REQUESTED',
      requestedBy: parseObjectId(input.userId),
      notes: input.notes,
    });

    eventBus.emit('transfer.created', { transferId: transfer._id, transferNumber });
    return transfer;
  }

  public static async approveTransfer(
    transferId: string,
    userId?: string
  ): Promise<IWarehouseTransfer> {
    const transfer = await WarehouseTransfer.findById(transferId);
    if (!transfer) throw new NotFoundError('Warehouse transfer not found');

    transfer.status = 'APPROVED';
    transfer.approvedBy = parseObjectId(userId);
    transfer.approvedAt = new Date();
    await transfer.save();

    eventBus.emit('transfer.approved', { transferId: transfer._id });
    return transfer;
  }

  public static async dispatchTransfer(
    transferId: string,
    shippedItems?: { productId: string; quantityShipped: number }[],
    userId?: string
  ): Promise<IWarehouseTransfer> {
    const transfer = await WarehouseTransfer.findById(transferId);
    if (!transfer) throw new NotFoundError('Warehouse transfer not found');

    for (const item of transfer.items) {
      const shipOverride = shippedItems?.find((s) => s.productId === item.productId.toString());
      const qtyShipped = shipOverride ? shipOverride.quantityShipped : item.quantity;
      item.shippedQuantity = qtyShipped;

      // Deduct from Source Warehouse Stock Movement
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -qtyShipped },
      });

      await StockMovement.create({
        tenantId: transfer.tenantId,
        companyId: transfer.companyId,
        productId: item.productId,
        warehouseId: transfer.fromWarehouseId,
        quantity: -qtyShipped,
        type: 'TRANSFER_OUT',
        referenceId: transfer.transferNumber,
        notes: `Transferred out to warehouse ${transfer.toWarehouseId}`,
      });
    }

    transfer.status = 'IN_TRANSIT';
    transfer.shippedBy = parseObjectId(userId);
    transfer.shippedAt = new Date();
    await transfer.save();

    eventBus.emit('transfer.dispatched', { transferId: transfer._id });
    return transfer;
  }

  public static async receiveTransfer(
    transferId: string,
    receivedItems: { productId: string; quantityReceived: number; toLocationId?: string }[],
    userId?: string
  ): Promise<IWarehouseTransfer> {
    const transfer = await WarehouseTransfer.findById(transferId);
    if (!transfer) throw new NotFoundError('Warehouse transfer not found');

    let isFullyReceived = true;

    for (const rItem of receivedItems) {
      const item = transfer.items.find((i: any) => i.productId?.toString() === rItem.productId);
      if (!item) continue;

      const newReceivedTotal = (item.receivedQuantity || 0) + rItem.quantityReceived;
      item.receivedQuantity = newReceivedTotal;
      if (item.toLocationId || rItem.toLocationId) {
        item.toLocationId = parseObjectId(rItem.toLocationId) || item.toLocationId;
      }

      if (newReceivedTotal < (item.shippedQuantity || item.quantity)) {
        isFullyReceived = false;
      }

      // Add to Destination Warehouse Stock Movement
      await Product.findByIdAndUpdate(rItem.productId, {
        $inc: { quantity: rItem.quantityReceived },
      });

      await StockMovement.create({
        tenantId: transfer.tenantId,
        companyId: transfer.companyId,
        productId: rItem.productId,
        warehouseId: transfer.toWarehouseId,
        toLocationId: parseObjectId(rItem.toLocationId),
        quantity: rItem.quantityReceived,
        type: 'TRANSFER_IN',
        referenceId: transfer.transferNumber,
        notes: `Received transfer from warehouse ${transfer.fromWarehouseId}`,
      });
    }

    transfer.status = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    transfer.receivedBy = parseObjectId(userId);
    transfer.receivedAt = new Date();
    await transfer.save();

    eventBus.emit('transfer.received', { transferId: transfer._id, isFullyReceived });
    return transfer;
  }

  // Damaged & Quarantine Disposition Management
  public static async processInventoryDisposition(input: {
    tenantId?: string;
    companyId?: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    disposition: 'RESTOCK' | 'QUARANTINE' | 'DAMAGED' | 'DISPOSE' | 'RETURN_TO_SUPPLIER';
    reason?: string;
    userId?: string;
  }): Promise<any> {
    const tenantId = input.tenantId || 'default';
    const product = await Product.findById(input.productId);
    if (!product) throw new NotFoundError('Product not found');

    if (input.disposition === 'RESTOCK') {
      await Product.findByIdAndUpdate(input.productId, { $inc: { quantity: input.quantity } });
      await StockMovement.create({
        tenantId,
        companyId: parseObjectId(input.companyId),
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        type: 'QUARANTINE_RELEASE',
        notes: `Restocked: ${input.reason || 'Disposition release'}`,
      });
    } else {
      // Deduct from sellable inventory for damaged/quarantined/disposed stock
      await Product.findByIdAndUpdate(input.productId, { $inc: { quantity: -input.quantity } });
      await StockMovement.create({
        tenantId,
        companyId: parseObjectId(input.companyId),
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: -input.quantity,
        type: input.disposition === 'QUARANTINE' ? 'QUARANTINE' : 'DAMAGE',
        notes: `Disposition (${input.disposition}): ${input.reason || 'Isolated'}`,
      });
    }

    const adjustment = await StockAdjustment.create({
      tenantId,
      companyId: parseObjectId(input.companyId),
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantityDelta: input.disposition === 'RESTOCK' ? input.quantity : -input.quantity,
      reason: `${input.disposition}: ${input.reason || 'Stock disposition'}`,
      approvedBy: parseObjectId(input.userId),
    });

    eventBus.emit('inventory.disposition_processed', {
      productId: input.productId,
      disposition: input.disposition,
    });
    return adjustment;
  }
}
