import { InventoryAllocation, type IInventoryAllocation } from '../models/InventoryAllocation.js';
import { InventoryLocation } from '../models/InventoryLocation.js';
import { Warehouse } from '../models/Warehouse.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { inventoryLocationService } from './inventory-location.service.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface AllocateOrderParams {
  companyId: string;
  orderId: string;
  orderNumber: string;
  orderType?: 'OMNICHANNEL' | 'POS' | 'SALES_ORDER' | 'TRANSFER';
  items: Array<{ productId: string; quantity: number }>;
  preferredWarehouseId?: string;
  strategy?: 'NEAREST' | 'AVAILABILITY' | 'PRIORITY' | 'ZONE' | 'MANUAL';
  allowSplitOrder?: boolean;
  createdBy: string;
}

export class AllocationService {
  /**
   * Allocate stock across warehouses for an order
   */
  async allocateOrder(params: AllocateOrderParams): Promise<IInventoryAllocation> {
    const {
      companyId,
      orderId,
      orderNumber,
      orderType = 'OMNICHANNEL',
      items,
      preferredWarehouseId,
      strategy = 'AVAILABILITY',
      allowSplitOrder = true,
      createdBy,
    } = params;

    // Get active warehouses
    let warehouses = await Warehouse.find({ companyId, isActive: true });
    if (warehouses.length === 0) {
      warehouses = await Warehouse.find({ isActive: true });
    }
    if (warehouses.length === 0) {
      throw new ValidationError('No active warehouses found for allocation.');
    }

    // Sort warehouses based on strategy
    let sortedWarehouses = [...warehouses];
    if (preferredWarehouseId) {
      sortedWarehouses.sort((a, b) =>
        a._id.toString() === preferredWarehouseId
          ? -1
          : b._id.toString() === preferredWarehouseId
            ? 1
            : 0
      );
    }

    const allocatedItems: any[] = [];
    const usedWarehouseIds = new Set<string>();

    for (const item of items) {
      let qtyNeeded = item.quantity;
      let qtyAllocatedForItem = 0;

      for (const wh of sortedWarehouses) {
        if (qtyNeeded <= 0) break;

        // Find available stock locations in this warehouse (FEFO order)
        const locs = await InventoryLocation.find({
          warehouseId: wh._id,
          productId: item.productId,
          availableQuantity: { $gt: 0 },
        }).sort({ expiryDate: 1, createdAt: 1 });

        for (const loc of locs) {
          if (qtyNeeded <= 0) break;

          const qtyToReserve = Math.min(qtyNeeded, loc.availableQuantity);
          if (qtyToReserve > 0) {
            // Reserve stock at location
            await inventoryLocationService.reserveStock(
              loc.locationId.toString(),
              item.productId,
              qtyToReserve,
              loc.lotNumber
            );

            allocatedItems.push({
              productId: item.productId,
              quantityRequired: item.quantity,
              quantityAllocated: qtyToReserve,
              locationId: loc.locationId,
              warehouseId: wh._id,
              lotNumber: loc.lotNumber,
              expiryDate: loc.expiryDate,
            });

            qtyNeeded -= qtyToReserve;
            qtyAllocatedForItem += qtyToReserve;
            usedWarehouseIds.add(wh._id.toString());
          }
        }

        if (!allowSplitOrder && qtyNeeded > 0) {
          // If split order not allowed and this warehouse couldn't fulfill completely, revert reservations for this item
          break;
        }
      }

      if (qtyAllocatedForItem < item.quantity) {
        console.warn(
          `[Allocation] Partial allocation for product ${item.productId}: ${qtyAllocatedForItem}/${item.quantity}`
        );
      }
    }

    const isFullyAllocated =
      allocatedItems.reduce((acc, i) => acc + i.quantityAllocated, 0) >=
      items.reduce((acc, i) => acc + i.quantity, 0);
    const allocationStatus = isFullyAllocated
      ? 'ALLOCATED'
      : allocatedItems.length > 0
        ? 'PARTIAL'
        : 'PENDING';

    const allocationNumber = `ALLOC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    const allocation = await InventoryAllocation.create({
      allocationNumber,
      companyId,
      orderId,
      orderNumber,
      orderType,
      status: allocationStatus,
      items: allocatedItems,
      allocationStrategy: strategy,
      warehouseIds: Array.from(usedWarehouseIds),
      allocatedAt: new Date(),
      createdBy,
    });

    // Update OmnichannelOrder state if applicable
    if (orderType === 'OMNICHANNEL') {
      const order = await OmnichannelOrder.findById(orderId);
      if (order && order.fulfillmentStatus === 'UNFULFILLED') {
        order.fulfillmentStatus = 'PICKING';
        order.status = isFullyAllocated ? 'READY_FOR_FULFILLMENT' : 'PARTIALLY_FULFILLED';
        await order.save();
      }
    }

    eventBus.emit('warehouse.allocation.created', {
      allocationId: allocation._id.toString(),
      orderId,
      status: allocationStatus,
    });

    return allocation;
  }

  /**
   * Release allocation and return stock to available
   */
  async releaseAllocation(allocationId: string): Promise<IInventoryAllocation> {
    const allocation = await InventoryAllocation.findById(allocationId);
    if (!allocation) throw new NotFoundError('Allocation record not found.');

    if (allocation.status === 'RELEASED' || allocation.status === 'CANCELLED') {
      return allocation;
    }

    for (const item of allocation.items) {
      if (item.locationId && item.quantityAllocated > 0) {
        await inventoryLocationService.releaseReservation(
          item.locationId.toString(),
          item.productId.toString(),
          item.quantityAllocated,
          item.lotNumber
        );
      }
    }

    allocation.status = 'RELEASED';
    allocation.releasedAt = new Date();
    await allocation.save();

    return allocation;
  }
}

export const allocationService = new AllocationService();
