import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SalesOrder } from '../models/SalesOrder.js';
import { SalesShipment } from '../models/SalesShipment.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { redis } from '../database/redis.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SocketManager } from '../sockets/manager.js';

const io = SocketManager.getInstance();

export class SalesOrderController {
  public static async listOrders(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orders = await SalesOrder.find()
        .populate('customerId', 'name code email')
        .populate('items.productId', 'name sku price')
        .sort({ createdAt: -1 })
        .lean();
      res.json(orders);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async createOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { customerId, quoteId, items, discount, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new ValidationError('items array is required.'));
    }

    try {
      let subtotal = 0;
      const formattedItems = items.map((i) => {
        const qty = Number(i.quantity || 0);
        const prc = Number(i.price || 0);
        subtotal += qty * prc;
        return {
          productId: new mongoose.Types.ObjectId(i.productId),
          quantity: qty,
          price: prc,
          shippedQuantity: 0,
        };
      });

      const taxRate = 0.08;
      const tax = subtotal * taxRate;
      const disc = Number(discount || 0);
      const total = Math.max(0, subtotal + tax - disc);

      const orderNumber = `SO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const order = await SalesOrder.create({
        orderNumber,
        quoteId: quoteId ? new mongoose.Types.ObjectId(quoteId) : undefined,
        customerId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
        items: formattedItems,
        subtotal,
        tax,
        discount: disc,
        total,
        status: 'PENDING',
        notes,
      });

      await AuditLog.create({
        userId: req.user?.id,
        action: 'CREATE',
        targetModel: 'SalesOrder',
        targetId: order._id.toString(),
        newValues: order.toObject(),
      });

      res.status(201).json(order);
    } catch (err: unknown) {
      next(err);
    }
  }

  public static async dispatchShipment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { id } = req.params;
    const { items, carrier, trackingNumber } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new ValidationError('A non-empty items array is required.'));
    }

    try {
      const order = await SalesOrder.findById(id);
      if (!order) {
        return next(new NotFoundError('Sales Order not found.'));
      }

      if (order.status === 'SHIPPED' || order.status === 'CANCELLED') {
        return next(
          new ValidationError(`Cannot dispatch shipment for order in status: ${order.status}`)
        );
      }

      const oldOrderValues = order.toObject();
      const shipmentNumber = `SH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const shItems = [];

      for (const shipItem of items) {
        const orderLine = order.items.find((i) => i.productId.toString() === shipItem.productId);
        if (!orderLine) {
          return next(
            new ValidationError(`Product [${shipItem.productId}] is not part of this Sales Order.`)
          );
        }

        const qtyToShip = Number(shipItem.quantityShipped || 0);
        if (qtyToShip <= 0) continue;

        const maxShippable = orderLine.quantity - orderLine.shippedQuantity;
        if (qtyToShip > maxShippable) {
          return next(
            new ValidationError(
              `Cannot ship more than ordered. Ordered: ${orderLine.quantity}, Shipped: ${orderLine.shippedQuantity}, Trying to ship: ${qtyToShip}`
            )
          );
        }

        const product = await Product.findById(shipItem.productId);
        if (!product || product.quantity < qtyToShip) {
          return next(
            new ValidationError(
              `Insufficient inventory for product [${product?.name || shipItem.productId}]. Available: ${product?.quantity || 0}, Trying to ship: ${qtyToShip}`
            )
          );
        }

        // Deduct from product inventory count
        product.quantity -= qtyToShip;
        await product.save();

        io.emitGlobal('product:stock-updated', {
          productId: product._id,
          quantity: product.quantity,
        });

        if (product.quantity <= product.lowStockAlert) {
          io.emitGlobal('notification:low-stock', {
            productId: product._id,
            name: product.name,
            quantity: product.quantity,
            lowStockAlert: product.lowStockAlert,
          });
        }

        // Record stock movement (negative change for sales deduction)
        await StockMovement.create({
          productId: product._id,
          type: 'SALE',
          quantity: -qtyToShip,
          costPrice: product.costPrice || product.cost || 0,
          sellingPrice: orderLine.price,
          referenceId: shipmentNumber,
          userId: req.user?.id,
          notes: `Sales dispatch shipment under SO: ${order.orderNumber}. Shipment: ${shipmentNumber}`,
        });

        orderLine.shippedQuantity += qtyToShip;
        shItems.push({
          productId: new mongoose.Types.ObjectId(shipItem.productId),
          quantityShipped: qtyToShip,
        });
      }

      // Determine new order status
      let allShipped = true;
      for (const orderLine of order.items) {
        if (orderLine.shippedQuantity < orderLine.quantity) {
          allShipped = false;
          break;
        }
      }

      order.status = allShipped ? 'SHIPPED' : 'PARTIALLY_SHIPPED';
      await order.save();

      const shipment = await SalesShipment.create({
        shipmentNumber,
        orderId: order._id,
        items: shItems,
        shippedAt: new Date(),
        status: 'DELIVERED',
        carrier,
        trackingNumber,
      });

      await redis.del('products:all');

      await AuditLog.create({
        userId: req.user?.id,
        action: 'UPDATE',
        targetModel: 'SalesOrder',
        targetId: order._id.toString(),
        priorValues: oldOrderValues,
        newValues: order.toObject(),
      });

      res.status(201).json(shipment);
    } catch (err: unknown) {
      next(err);
    }
  }
}
