import {
  WarehouseTransfer,
  type IWarehouseTransfer,
  type TransferStatus,
} from '../models/WarehouseTransfer.js';
import { inventoryLocationService } from './inventory-location.service.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface CreateTransferParams {
  companyId?: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: Array<{
    productId: string;
    quantity: number;
    fromLocationId?: string;
    lotNumber?: string;
  }>;
  notes?: string;
  createdBy: string;
}

export class WarehouseTransferService {
  /**
   * Request a new Warehouse Transfer
   */
  async requestTransfer(params: CreateTransferParams): Promise<IWarehouseTransfer> {
    if (params.fromWarehouseId === params.toWarehouseId) {
      throw new ValidationError('Source and destination warehouses cannot be the same.');
    }

    const transferNumber = `TRF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const transfer = await WarehouseTransfer.create({
      companyId: params.companyId,
      transferNumber,
      fromWarehouseId: params.fromWarehouseId,
      toWarehouseId: params.toWarehouseId,
      items: params.items,
      status: 'REQUESTED',
      requestedBy: params.createdBy,
      createdBy: params.createdBy,
      notes: params.notes,
    });

    eventBus.emit('warehouse.transfer.created', {
      transferId: transfer._id.toString(),
      transferNumber,
      fromWarehouseId: params.fromWarehouseId,
      toWarehouseId: params.toWarehouseId,
    });

    return transfer;
  }

  /**
   * Approve a Transfer Request
   */
  async approveTransfer(transferId: string, approvedBy: string): Promise<IWarehouseTransfer> {
    const transfer = await WarehouseTransfer.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer request not found.');

    if (transfer.status !== 'REQUESTED' && transfer.status !== 'DRAFT') {
      throw new ValidationError(
        `Transfer cannot be approved from current state [${transfer.status}].`
      );
    }

    transfer.status = 'APPROVED';
    transfer.approvedBy = approvedBy as any;
    transfer.approvedAt = new Date();
    await transfer.save();

    return transfer;
  }

  /**
   * Ship Transfer (Moves stock OUT of source warehouse to TRANSIT)
   */
  async shipTransfer(
    transferId: string,
    shippedBy: string,
    trackingNumber?: string
  ): Promise<IWarehouseTransfer> {
    const transfer = await WarehouseTransfer.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer not found.');

    if (transfer.status !== 'APPROVED' && transfer.status !== 'PICKING') {
      throw new ValidationError(`Transfer cannot be shipped from status [${transfer.status}].`);
    }

    for (const item of transfer.items) {
      // Find source location if not set
      let fromLocId = item.fromLocationId?.toString();
      if (!fromLocId) {
        const defaultLoc = await WarehouseLocation.findOne({
          warehouseId: transfer.fromWarehouseId,
          locationType: 'STORAGE',
        });
        fromLocId = defaultLoc?._id.toString();
      }

      if (fromLocId) {
        // Move stock out of source location
        await inventoryLocationService.moveStock({
          companyId: transfer.companyId?.toString() || '',
          warehouseId: transfer.fromWarehouseId.toString(),
          productId: item.productId.toString(),
          quantity: item.quantity,
          fromLocationId: fromLocId,
          lotNumber: item.lotNumber,
          movementType: 'TRANSFER_OUT',
          referenceId: transfer.transferNumber,
          referenceType: 'WarehouseTransfer',
          userId: shippedBy,
          notes: `Shipped transfer ${transfer.transferNumber} to warehouse ${transfer.toWarehouseId}`,
        });
      }

      item.shippedQuantity = item.quantity;
    }

    transfer.status = 'IN_TRANSIT';
    transfer.shippedBy = shippedBy as any;
    transfer.shippedAt = new Date();
    if (trackingNumber) transfer.trackingNumber = trackingNumber;
    await transfer.save();

    eventBus.emit('warehouse.transfer.shipped', {
      transferId: transfer._id.toString(),
      transferNumber: transfer.transferNumber,
    });

    return transfer;
  }

  /**
   * Receive Transfer at Destination Warehouse (Moves stock INTO destination warehouse location)
   */
  async receiveTransfer(
    transferId: string,
    receivedBy: string,
    receivedItems: Array<{ productId: string; receivedQuantity: number; toLocationId?: string }>
  ): Promise<IWarehouseTransfer> {
    const transfer = await WarehouseTransfer.findById(transferId);
    if (!transfer) throw new NotFoundError('Transfer not found.');

    if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PARTIALLY_RECEIVED') {
      throw new ValidationError(`Transfer cannot be received from status [${transfer.status}].`);
    }

    // Default receiving location at destination warehouse
    const defaultToLoc =
      (await WarehouseLocation.findOne({
        warehouseId: transfer.toWarehouseId,
        locationType: 'RECEIVING',
        isActive: true,
      })) ||
      (await WarehouseLocation.findOne({
        warehouseId: transfer.toWarehouseId,
        locationType: 'STORAGE',
        isActive: true,
      }));

    let allFullyReceived = true;

    for (const rItem of receivedItems) {
      const itemIndex = transfer.items.findIndex(
        (i: any) => i.productId?.toString() === rItem.productId
      );
      if (itemIndex === -1) continue;

      const item = transfer.items[itemIndex];
      const qtyToReceive = rItem.receivedQuantity;
      const targetLocId =
        rItem.toLocationId || item.toLocationId?.toString() || defaultToLoc?._id.toString();

      if (!targetLocId) {
        throw new ValidationError(
          `No valid receiving location found at destination warehouse for product ${rItem.productId}`
        );
      }

      if (qtyToReceive > 0) {
        // Move stock into destination location
        await inventoryLocationService.moveStock({
          companyId: transfer.companyId?.toString() || '',
          warehouseId: transfer.toWarehouseId.toString(),
          productId: item.productId.toString(),
          quantity: qtyToReceive,
          toLocationId: targetLocId,
          lotNumber: item.lotNumber,
          movementType: 'TRANSFER_IN',
          referenceId: transfer.transferNumber,
          referenceType: 'WarehouseTransfer',
          userId: receivedBy,
          notes: `Received transfer ${transfer.transferNumber} at destination warehouse.`,
        });

        item.receivedQuantity = (item.receivedQuantity || 0) + qtyToReceive;
      }

      if ((item.receivedQuantity || 0) < item.quantity) {
        allFullyReceived = false;
      }
    }

    transfer.status = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    transfer.receivedBy = receivedBy as any;
    transfer.receivedAt = new Date();
    await transfer.save();

    eventBus.emit('warehouse.transfer.received', {
      transferId: transfer._id.toString(),
      transferNumber: transfer.transferNumber,
      status: transfer.status,
    });

    return transfer;
  }
}

export const warehouseTransferService = new WarehouseTransferService();
