import type { Request, Response } from 'express';
import { OrderManagementService } from '../services/order-management.service.js';
import { FulfillmentService } from '../services/fulfillment.service.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';

export class OrderManagementController {
  /**
   * POST /api/v1/orders
   */
  public static async createOrder(req: Request, res: Response) {
    try {
      const order = await OrderManagementService.createOrder(req.body);
      res.status(201).json({ success: true, data: order });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/orders
   */
  public static async getOrders(req: Request, res: Response) {
    try {
      const { channel, status, riskLevel } = req.query;
      const filter: Record<string, unknown> = {};
      if (channel) filter.channel = channel;
      if (status) filter.status = status;
      if (riskLevel) filter.riskLevel = riskLevel;

      const orders = await OmnichannelOrder.find(filter).sort({ createdAt: -1 }).limit(50);
      res.status(200).json({ success: true, data: orders });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/orders/:orderNumber
   */
  public static async getOrderByNumber(req: Request, res: Response) {
    try {
      const orderNumber = String(req.params.orderNumber);
      const order = await OmnichannelOrder.findOne({ orderNumber });
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      res.status(200).json({ success: true, data: order });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PATCH /api/v1/orders/:orderNumber/status
   */
  public static async updateStatus(req: Request, res: Response) {
    try {
      const orderNumber = String(req.params.orderNumber);
      const { status, notes } = req.body;
      const updated = await OrderManagementService.updateOrderStatus(orderNumber, status, notes);
      res.status(200).json({ success: true, data: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/orders/:orderNumber/return
   */
  public static async processReturn(req: Request, res: Response) {
    try {
      const orderNumber = String(req.params.orderNumber);
      const { reason, refundAmount, approvedBy, restock } = req.body;
      const ret = await OrderManagementService.processReturn(
        orderNumber,
        reason,
        Number(refundAmount),
        approvedBy || 'Manager',
        restock !== false
      );
      res.status(200).json({ success: true, data: ret });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/v1/orders/:orderNumber/timeline
   */
  public static async getTimeline(req: Request, res: Response) {
    try {
      const orderNumber = String(req.params.orderNumber);
      const timeline = await OrderManagementService.getOrderTimeline(orderNumber);
      res.status(200).json({ success: true, data: timeline });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(404).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/orders/:orderNumber/picking
   */
  public static async createPickingTask(req: Request, res: Response) {
    try {
      const orderNumber = String(req.params.orderNumber);
      const { pickerId, pickerName } = req.body;
      const task = await FulfillmentService.createPickingTask(orderNumber, pickerId, pickerName);
      res.status(201).json({ success: true, data: task });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/v1/orders/fulfillment/pickup-verify
   */
  public static async verifyStorePickup(req: Request, res: Response) {
    try {
      const { orderNumber, verificationCode } = req.body;
      const order = await FulfillmentService.verifyStorePickup(orderNumber, verificationCode);
      res.status(200).json({ success: true, data: order });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, message: msg });
    }
  }
}
