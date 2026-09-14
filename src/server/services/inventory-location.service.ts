import mongoose from 'mongoose';
import { InventoryLocation, type IInventoryLocation } from '../models/InventoryLocation.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { StockMovement, type StockMovementType } from '../models/StockMovement.js';
import { Product } from '../models/Product.js';
import { ValidationError, NotFoundError } from '../errors/AppError.js';
import { eventBus } from '../events/eventBus.js';

export interface MoveStockParams {
  companyId: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  lotNumber?: string;
  expiryDate?: Date;
  serialNumber?: string;
  movementType: StockMovementType;
  referenceId?: string;
  referenceType?: string;
  userId: string;
  costPrice?: number;
  sellingPrice?: number;
  notes?: string;
}

export class InventoryLocationService {
  /**
   * Move stock between locations (or in/out of warehouse) with atomic MongoDB operations & concurrency protection.
   */
  async moveStock(params: MoveStockParams): Promise<{ movementId: string; success: boolean }> {
    const {
      companyId,
      warehouseId,
      productId,
      quantity,
      fromLocationId,
      toLocationId,
      lotNumber,
      expiryDate,
      serialNumber,
      movementType,
      referenceId,
      referenceType,
      userId,
      costPrice = 0,
      sellingPrice = 0,
      notes,
    } = params;

    if (quantity <= 0) {
      throw new ValidationError('Quantity must be greater than zero.');
    }

    if (!fromLocationId && !toLocationId) {
      throw new ValidationError(
        'At least one of fromLocationId or toLocationId must be specified.'
      );
    }

    // 1. Deduct from source location if specified
    if (fromLocationId) {
      const sourceLoc = await InventoryLocation.findOne({
        locationId: fromLocationId,
        productId,
        ...(lotNumber ? { lotNumber } : {}),
        ...(serialNumber ? { serialNumber } : {}),
      });

      if (!sourceLoc || sourceLoc.availableQuantity < quantity) {
        const available = sourceLoc ? sourceLoc.availableQuantity : 0;
        throw new ValidationError(
          `Insufficient stock at location. Requested: ${quantity}, Available: ${available}`
        );
      }

      // Atomic update
      const updatedSource = await InventoryLocation.findOneAndUpdate(
        {
          _id: sourceLoc._id,
          availableQuantity: { $gte: quantity },
        },
        {
          $inc: {
            quantity: -quantity,
            availableQuantity: -quantity,
          },
        },
        { new: true }
      );

      if (!updatedSource) {
        throw new ValidationError(
          'Stock movement failed due to concurrent modification. Please retry.'
        );
      }

      // Update WarehouseLocation currentUnits
      await WarehouseLocation.findByIdAndUpdate(fromLocationId, {
        $inc: { currentUnits: -quantity },
      });
    }

    // 2. Add to destination location if specified
    if (toLocationId) {
      const query = {
        locationId: toLocationId,
        productId,
        lotNumber: lotNumber || null,
        serialNumber: serialNumber || null,
      };

      const destLoc = await InventoryLocation.findOneAndUpdate(
        query,
        {
          $setOnInsert: {
            companyId,
            warehouseId,
            expiryDate: expiryDate || null,
            receivedDate: new Date(),
            costPrice,
          },
          $inc: {
            quantity,
            availableQuantity: quantity,
          },
        },
        { upsert: true, new: true }
      );

      // Check location capacity
      const targetLoc = await WarehouseLocation.findById(toLocationId);
      if (
        targetLoc &&
        targetLoc.capacityUnits &&
        targetLoc.currentUnits + quantity > targetLoc.capacityUnits
      ) {
        console.warn(`[WMS] Warning: Location ${targetLoc.locationCode} capacity exceeded.`);
      }

      // Update WarehouseLocation currentUnits
      await WarehouseLocation.findByIdAndUpdate(toLocationId, {
        $inc: { currentUnits: quantity },
      });
    }

    // 3. Update overall product stock count
    const product = await Product.findById(productId);
    if (product) {
      if (!fromLocationId && toLocationId) {
        // Receipt / Addition
        product.quantity += quantity;
        await product.save();
      } else if (fromLocationId && !toLocationId) {
        // Dispatch / Removal
        product.quantity = Math.max(0, product.quantity - quantity);
        await product.save();
      }
    }

    // 4. Create immutable StockMovement record
    const movement = await StockMovement.create({
      companyId,
      productId,
      type: movementType,
      quantity,
      costPrice,
      sellingPrice,
      fromLocationId: fromLocationId || null,
      fromWarehouseId: fromLocationId ? warehouseId : null,
      toLocationId: toLocationId || null,
      toWarehouseId: toLocationId ? warehouseId : null,
      referenceId,
      referenceType,
      lotNumber,
      serialNumber,
      expiryDate,
      userId,
      notes,
    });

    // 5. Emit strongly-typed WMS event
    eventBus.emit('warehouse.inventory.moved', {
      movementId: movement._id.toString(),
      productId,
      quantity,
      movementType,
      fromLocationId,
      toLocationId,
      userId,
    });

    return { movementId: movement._id.toString(), success: true };
  }

  /**
   * Get available lots sorted by FEFO (First Expiry First Out) for a product in a warehouse
   */
  async getFEFOLots(warehouseId: string, productId: string) {
    return InventoryLocation.find({
      warehouseId,
      productId,
      availableQuantity: { $gt: 0 },
    })
      .sort({ expiryDate: 1, createdAt: 1 })
      .populate('locationId', 'locationCode zoneId aisle rack shelf bin')
      .lean();
  }

  /**
   * Reserve stock at location for an order
   */
  async reserveStock(locationId: string, productId: string, qty: number, lotNumber?: string) {
    const inv = await InventoryLocation.findOne({
      locationId,
      productId,
      ...(lotNumber ? { lotNumber } : {}),
      availableQuantity: { $gte: qty },
    });

    if (!inv) {
      throw new ValidationError(
        'Insufficient available stock at specified location for reservation.'
      );
    }

    const updated = await InventoryLocation.findOneAndUpdate(
      { _id: inv._id, availableQuantity: { $gte: qty } },
      {
        $inc: {
          availableQuantity: -qty,
          reservedQuantity: qty,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new ValidationError('Stock reservation failed due to concurrent modification.');
    }

    return updated;
  }

  /**
   * Release reserved stock back to available
   */
  async releaseReservation(locationId: string, productId: string, qty: number, lotNumber?: string) {
    return InventoryLocation.findOneAndUpdate(
      {
        locationId,
        productId,
        ...(lotNumber ? { lotNumber } : {}),
        reservedQuantity: { $gte: qty },
      },
      {
        $inc: {
          reservedQuantity: -qty,
          availableQuantity: qty,
        },
      },
      { new: true }
    );
  }
}

export const inventoryLocationService = new InventoryLocationService();
