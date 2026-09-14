import mongoose from 'mongoose';
import {
  InventoryReservation,
  type IInventoryReservation,
} from '../models/InventoryReservation.js';
import { Product } from '../models/Product.js';
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';

export class ReservationService {
  /**
   * Reserve stock for an order across channels (POS, E-Commerce, Mobile)
   */
  public static async reserveStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    orderNumber: string,
    channel: IInventoryReservation['channel'] = 'POS',
    reservationDurationMinutes = 30
  ): Promise<IInventoryReservation> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found for reservation.`);
    }

    if (product.quantity < quantity) {
      throw new Error(
        `Insufficient inventory to reserve SKU ${product.sku}. On-hand: ${product.quantity}, requested: ${quantity}.`
      );
    }

    const expiresAt = new Date(Date.now() + reservationDurationMinutes * 60 * 1000);

    const reservation = await InventoryReservation.create({
      productId: new mongoose.Types.ObjectId(productId),
      sku: product.sku,
      warehouseId: new mongoose.Types.ObjectId(warehouseId),
      quantity,
      reservedForOrderNumber: orderNumber,
      channel,
      status: 'RESERVED',
      expiresAt,
    });

    // Deduct available stock atomically or lock reservation
    product.quantity -= quantity;
    await product.save();

    logger.info(
      `[Reservation Service] Reserved ${quantity} units of ${product.sku} for Order #${orderNumber} (Expires: ${expiresAt.toISOString()})`
    );

    eventBus.emit('order.inventory.reserved', {
      orderNumber,
      sku: product.sku,
      quantity,
      expiresAt,
    });

    return reservation;
  }

  /**
   * Confirm reservation upon successful payment completion
   */
  public static async confirmReservation(orderNumber: string): Promise<number> {
    const reservations = await InventoryReservation.find({
      reservedForOrderNumber: orderNumber,
      status: 'RESERVED',
    });

    let count = 0;
    for (const res of reservations) {
      res.status = 'CONFIRMED';
      await res.save();
      count++;
    }

    logger.info(`[Reservation Service] Confirmed ${count} reservations for Order #${orderNumber}`);
    return count;
  }

  /**
   * Release reservation manually or on cancellation
   */
  public static async releaseReservation(orderNumber: string): Promise<void> {
    const reservations = await InventoryReservation.find({
      reservedForOrderNumber: orderNumber,
      status: { $in: ['RESERVED', 'CONFIRMED'] },
    });

    for (const res of reservations) {
      if (res.status === 'RESERVED') {
        const product = await Product.findById(res.productId);
        if (product) {
          product.quantity += res.quantity;
          await product.save();
        }
      }
      res.status = 'RELEASED';
      await res.save();
    }

    logger.info(`[Reservation Service] Released inventory for Order #${orderNumber}`);
    eventBus.emit('order.inventory.released', { orderNumber });
  }

  /**
   * Housekeeping: Expire unconfirmed reservations older than expiration threshold
   */
  public static async expireStaleReservations(): Promise<number> {
    const staleReservations = await InventoryReservation.find({
      status: 'RESERVED',
      expiresAt: { $lte: new Date() },
    });

    let expiredCount = 0;
    for (const res of staleReservations) {
      const product = await Product.findById(res.productId);
      if (product) {
        product.quantity += res.quantity;
        await product.save();
      }
      res.status = 'EXPIRED';
      await res.save();
      expiredCount++;

      logger.info(
        `[Reservation Service] Expired reservation ${res._id} for Order #${res.reservedForOrderNumber}. Restocked ${res.quantity} units.`
      );
    }

    return expiredCount;
  }
}
