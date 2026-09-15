import mongoose from 'mongoose';
import { OmnichannelOrder, type IOmnichannelOrder } from '../models/OmnichannelOrder.js';
import { SalesReturn } from '../models/SalesReturn.js';
import { ReservationService } from './reservation.service.js';
import { CRMService } from './crm.service.js';
import { eventBus } from '../events/eventBus.js';
import { logger } from '../logger.js';

export interface CreateOrderInput {
  channel: IOmnichannelOrder['channel'];
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  branchId?: string;
  warehouseId: string;
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
  fulfillmentMethod?: IOmnichannelOrder['fulfillmentMethod'];
  notes?: string;
  idempotencyKey?: string;
}

export class OrderManagementService {
  /**
   * Create an Omnichannel Order with risk scoring and inventory reservation
   */
  public static async createOrder(input: CreateOrderInput): Promise<IOmnichannelOrder> {
    if (input.idempotencyKey) {
      const existing = await OmnichannelOrder.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }

    const orderCount = await OmnichannelOrder.countDocuments();
    const orderNumber = `STK-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${String(orderCount + 1).padStart(4, '0')}`;

    let subtotal = 0;
    let discountTotal = 0;

    const formattedItems = input.items.map((i) => {
      const itemSub = i.unitPrice * i.quantity;
      const itemDisc = (i.discount || 0) * i.quantity;
      const itemTotal = Math.max(0, itemSub - itemDisc);
      subtotal += itemSub;
      discountTotal += itemDisc;

      return {
        productId: new mongoose.Types.ObjectId(i.productId),
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
        tax: 0,
        total: itemTotal,
      };
    });

    const taxTotal = 0;
    const grandTotal = Number(Math.max(0, subtotal - discountTotal).toFixed(2));

    // Risk Assessment Foundation
    let riskScore = 0;
    if (grandTotal > 2000) riskScore += 35;
    if (input.channel === 'MARKETPLACE') riskScore += 15;
    const riskLevel: IOmnichannelOrder['riskLevel'] =
      riskScore >= 50 ? 'HIGH_RISK' : riskScore >= 30 ? 'REVIEW' : 'NORMAL';

    const order = await OmnichannelOrder.create({
      orderNumber,
      channel: input.channel,
      customerId: input.customerId ? new mongoose.Types.ObjectId(input.customerId) : undefined,
      customerName: input.customerName || 'Online Guest',
      customerEmail: input.customerEmail,
      branchId: input.branchId ? new mongoose.Types.ObjectId(input.branchId) : undefined,
      warehouseId: new mongoose.Types.ObjectId(input.warehouseId),
      items: formattedItems,
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'UNFULFILLED',
      fulfillmentMethod: input.fulfillmentMethod || 'SHIP',
      status: 'PENDING_PAYMENT',
      riskScore,
      riskLevel,
      idempotencyKey: input.idempotencyKey,
      notes: input.notes,
    });

    // Atomically reserve inventory for online/mobile orders
    const resChannel = input.channel === 'MANUAL' ? 'POS' : input.channel;
    for (const item of input.items) {
      await ReservationService.reserveStock(
        item.productId,
        input.warehouseId,
        item.quantity,
        orderNumber,
        resChannel
      );
    }

    eventBus.emit('order.created', { orderNumber, channel: input.channel, total: grandTotal });
    return order;
  }

  /**
   * Transition order status safely
   */
  public static async updateOrderStatus(
    orderNumber: string,
    nextStatus: IOmnichannelOrder['status'],
    notes?: string
  ): Promise<IOmnichannelOrder> {
    const order = await OmnichannelOrder.findOne({ orderNumber });
    if (!order) {
      throw new Error(`Order #${orderNumber} not found.`);
    }

    const current = order.status;

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
      PENDING_PAYMENT: ['PAID', 'CANCELLED'],
      PAID: ['PROCESSING', 'READY_FOR_FULFILLMENT', 'CANCELLED'],
      PROCESSING: ['READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED', 'CANCELLED'],
      READY_FOR_FULFILLMENT: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
      PARTIALLY_FULFILLED: ['FULFILLED', 'CANCELLED'],
      FULFILLED: ['COMPLETED', 'RETURNED', 'REFUNDED'],
      COMPLETED: ['RETURNED', 'REFUNDED'],
      CANCELLED: [],
      RETURNED: [],
      REFUNDED: [],
    };

    if (!validTransitions[current]?.includes(nextStatus)) {
      throw new Error(
        `Invalid status transition from ${current} to ${nextStatus} for Order #${orderNumber}`
      );
    }

    order.status = nextStatus;
    if (notes) order.notes = notes;
    await order.save();

    // If order was cancelled, release reserved stock
    if (nextStatus === 'CANCELLED') {
      await ReservationService.releaseReservation(orderNumber);
    } else if (nextStatus === 'PAID') {
      await ReservationService.confirmReservation(orderNumber);
    }

    logger.info(
      `[Order Management] Order #${orderNumber} transitioned ${current} -> ${nextStatus}`
    );
    eventBus.emit('order.processing', { orderNumber, status: nextStatus });

    return order;
  }

  /**
   * Process Order Return & Refund
   */
  public static async processReturn(
    orderNumber: string,
    reason: string,
    refundAmount: number,
    approvedBy: string,
    restock = true
  ) {
    const order = await OmnichannelOrder.findOne({ orderNumber });
    if (!order) {
      throw new Error(`Order #${orderNumber} not found for return.`);
    }

    if (refundAmount > order.grandTotal) {
      throw new Error(
        `Refund amount ($${refundAmount}) cannot exceed order grand total ($${order.grandTotal}).`
      );
    }

    const returnNumber = `RET-${orderNumber}-${Date.now().toString().slice(-4)}`;
    const approvedObjectId =
      approvedBy && mongoose.Types.ObjectId.isValid(approvedBy)
        ? new mongoose.Types.ObjectId(approvedBy)
        : new mongoose.Types.ObjectId();

    const salesReturn = await SalesReturn.create({
      returnNumber,
      transactionNumber: orderNumber,
      items: order.items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        sku: i.sku,
        quantity: i.quantity,
        price: i.unitPrice,
        reason,
        condition: 'SELLABLE',
        action: 'REFUND',
      })),
      exchangeItems: [],
      refundType: refundAmount === order.grandTotal ? 'FULL' : 'PARTIAL',
      refundAmount,
      exchangePriceDifference: 0,
      refundMethod: 'CASH',
      status: 'APPROVED',
      approvedBy: approvedObjectId,
      createdBy: approvedObjectId,
      approvedAt: new Date(),
    });

    order.status = 'RETURNED';
    order.paymentStatus = refundAmount === order.grandTotal ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await order.save();

    if (order.customerId) {
      await CRMService.recordTimelineEvent(
        order.customerId.toString(),
        'RETURN',
        `Returned Order #${orderNumber}`,
        `Refund amount: $${refundAmount}`,
        { orderNumber, refundAmount, reason }
      );
    }

    eventBus.emit('order.returned', { orderNumber, returnNumber, refundAmount });
    return salesReturn;
  }

  /**
   * Fetch order history / timeline
   */
  public static async getOrderTimeline(orderNumber: string) {
    const order = await OmnichannelOrder.findOne({ orderNumber });
    if (!order) {
      throw new Error(`Order #${orderNumber} not found.`);
    }

    return {
      orderNumber: order.orderNumber,
      channel: order.channel,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      riskLevel: order.riskLevel,
      riskScore: order.riskScore,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      itemsCount: order.items.length,
      grandTotal: order.grandTotal,
    };
  }
}
