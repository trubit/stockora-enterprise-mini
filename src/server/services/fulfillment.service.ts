import mongoose from 'mongoose';
import { PickingTask, type IPickingTask } from '../models/PickingTask.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';

export class FulfillmentService {
  /**
   * Create Picking Task for Warehouse Order Fulfillment
   */
  public static async createPickingTask(
    orderNumber: string,
    pickerId?: string,
    pickerName?: string
  ): Promise<IPickingTask> {
    const order = await OmnichannelOrder.findOne({ orderNumber });
    if (!order) {
      throw new Error(`Order #${orderNumber} not found.`);
    }

    const taskCount = await PickingTask.countDocuments();
    const taskNumber = `PICK-${new Date().getFullYear()}-${String(taskCount + 1).padStart(6, '0')}`;

    const itemsToPick = order.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      name: i.name,
      quantityToPick: i.quantity,
      pickedQuantity: 0,
    }));

    const task = await PickingTask.create({
      taskNumber,
      orderId: order._id as mongoose.Types.ObjectId,
      orderNumber,
      warehouseId: order.warehouseId || new mongoose.Types.ObjectId(),
      pickerId,
      pickerName,
      items: itemsToPick,
      status: 'PENDING',
    });

    order.fulfillmentStatus = 'PICKING';
    await order.save();

    logger.info(
      `[Fulfillment Service] Created Picking Task #${taskNumber} for Order #${orderNumber}`
    );
    eventBus.emit('order.picked', { orderNumber, taskNumber });

    return task;
  }

  /**
   * Update quantity picked for a task line item
   */
  public static async updatePickingItem(
    taskNumber: string,
    productId: string,
    quantityPicked: number
  ): Promise<IPickingTask> {
    const task = await PickingTask.findOne({ taskNumber });
    if (!task) {
      throw new Error(`Picking task #${taskNumber} not found.`);
    }

    const item = task.items.find((i) => i.productId.toString() === productId);
    if (!item) {
      throw new Error(`Product ${productId} not found in picking task.`);
    }

    item.pickedQuantity = Math.min(item.quantityToPick, quantityPicked);
    task.status = 'IN_PROGRESS';
    if (!task.startedAt) task.startedAt = new Date();

    const allPicked = task.items.every((i) => i.pickedQuantity === i.quantityToPick);
    if (allPicked) {
      task.status = 'PICKED';
      task.completedAt = new Date();
    }

    await task.save();
    return task;
  }

  /**
   * Complete Packing & mark Ready for Shipping or Store Pickup
   */
  public static async completePacking(taskNumber: string): Promise<IPickingTask> {
    const task = await PickingTask.findOne({ taskNumber });
    if (!task) {
      throw new Error(`Picking task #${taskNumber} not found.`);
    }

    task.status = 'PACKED';
    await task.save();

    const order = await OmnichannelOrder.findOne({ orderNumber: task.orderNumber });
    if (order) {
      order.fulfillmentStatus =
        order.fulfillmentMethod === 'STORE_PICKUP' ? 'READY_FOR_PICKUP' : 'PACKED';
      await order.save();
    }

    logger.info(`[Fulfillment Service] Packed Order #${task.orderNumber} via Task #${taskNumber}`);
    eventBus.emit('order.packed', { orderNumber: task.orderNumber, taskNumber });
    return task;
  }

  /**
   * Release Store Pickup to Customer
   */
  public static async verifyStorePickup(orderNumber: string, verificationCode: string) {
    const order = await OmnichannelOrder.findOne({ orderNumber });
    if (!order) {
      throw new Error(`Order #${orderNumber} not found.`);
    }

    if (order.fulfillmentStatus !== 'READY_FOR_PICKUP') {
      throw new Error(`Order #${orderNumber} is not ready for store pickup.`);
    }

    order.fulfillmentStatus = 'DELIVERED';
    order.status = 'COMPLETED';
    await order.save();

    logger.info(
      `[Fulfillment Service] Store pickup verified for Order #${orderNumber} (Code: ${verificationCode})`
    );
    eventBus.emit('order.delivered', { orderNumber });
    return order;
  }
}
