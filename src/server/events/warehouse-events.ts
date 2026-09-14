import { eventBus } from './eventBus.js';
import { logger } from '../logger.js';

export interface WarehouseEventPayloads {
  'warehouse.created': { warehouseId: string; code: string };
  'warehouse.location.created': { locationId: string; locationCode: string };
  'warehouse.inventory.moved': {
    movementId: string;
    productId: string;
    quantity: number;
    movementType: string;
    fromLocationId?: string;
    toLocationId?: string;
    userId: string;
  };
  'warehouse.putaway.created': { taskId: string; productId: string; suggestedLocationId?: string };
  'warehouse.putaway.completed': { taskId: string; locationId: string; quantity: number };
  'warehouse.allocation.created': { allocationId: string; orderId: string; status: string };
  'warehouse.pick.created': { pickListId: string; orderId: string; warehouseId: string };
  'warehouse.pick.completed': { pickListId: string; itemId: string; quantityPicked: number };
  'warehouse.pick.short': {
    pickListId: string;
    itemId: string;
    shortReason: string;
    quantityShort: number;
  };
  'warehouse.wave.created': { waveId: string };
  'warehouse.order.packed': { packageId: string; orderId: string; packageNumber: string };
  'warehouse.dispatch.created': { dispatchId: string; dispatchNumber: string; carrier: string };
  'warehouse.order.dispatched': {
    dispatchId: string;
    dispatchNumber: string;
    totalPackages: number;
  };
  'warehouse.transfer.created': {
    transferId: string;
    transferNumber: string;
    fromWarehouseId: string;
    toWarehouseId: string;
  };
  'warehouse.transfer.shipped': { transferId: string; transferNumber: string };
  'warehouse.transfer.received': { transferId: string; transferNumber: string; status: string };
  'warehouse.count.created': { countId: string; countNumber: string };
  'warehouse.count.completed': { countId: string; countNumber: string; totalVarianceValue: number };
  'warehouse.stock.quarantined': { productId: string; quantity: number; reason: string };
  'warehouse.stock.released': { productId: string; quantity: number };
  'warehouse.stock.damaged': { recordId: string; productId: string; lossValue: number };
}

export function registerWarehouseEventHandlers() {
  eventBus.on('warehouse.inventory.moved', (data) => {
    logger.info(
      `[WMS Event] Inventory Moved: Product ${data.productId}, Qty ${data.quantity}, Type: ${data.movementType}`
    );
  });

  eventBus.on('warehouse.pick.short', (data) => {
    logger.warn(
      `[WMS Event] Short Pick Alert: Item ${data.itemId}, Reason: ${data.shortReason}, Short Qty: ${data.quantityShort}`
    );
  });

  eventBus.on('warehouse.count.completed', (data) => {
    logger.info(
      `[WMS Event] Cycle Count Completed: ${data.countNumber}, Variance Value: $${data.totalVarianceValue}`
    );
  });
}
