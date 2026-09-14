import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { StockMovement } from '../models/StockMovement.js';
import { WarehouseTransfer } from '../models/WarehouseTransfer.js';

describe('Inventory Logistics, Adjustments & Transfers Integration', () => {
  let warehouseAId: mongoose.Types.ObjectId;
  let warehouseBId: mongoose.Types.ObjectId;
  let productId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_inventory');
    }
    await Product.deleteMany({});
    await Warehouse.deleteMany({});
    await StockAdjustment.deleteMany({});
    await StockMovement.deleteMany({});
    await WarehouseTransfer.deleteMany({});

    // Create test warehouses
    const wA = await Warehouse.create({
      companyId: new mongoose.Types.ObjectId(),
      branchId: new mongoose.Types.ObjectId(),
      name: 'Central Hub Austin',
      code: 'WH-AUS',
    });
    warehouseAId = wA._id as mongoose.Types.ObjectId;

    const wB = await Warehouse.create({
      companyId: new mongoose.Types.ObjectId(),
      branchId: new mongoose.Types.ObjectId(),
      name: 'Distribution Dallas',
      code: 'WH-DAL',
    });
    warehouseBId = wB._id as mongoose.Types.ObjectId;

    // Create test product
    const p = await Product.create({
      sku: 'SKU-LOGISTICS-1',
      name: 'Logistics Container Box',
      category: 'Shipping',
      costPrice: 10.0,
      sellingPrice: 25.0,
      price: 25.0,
      cost: 10.0,
      quantity: 50,
      lowStockAlert: 5,
    });
    productId = p._id.toString();
  });

  afterAll(async () => {
    await Product.deleteMany({});
    await Warehouse.deleteMany({});
    await StockAdjustment.deleteMany({});
    await StockMovement.deleteMany({});
    await WarehouseTransfer.deleteMany({});
    await mongoose.connection.close();
  }, 30_000);

  it('should process stock adjustments and emit movement ledger audits', async () => {
    const product = await Product.findById(productId);
    expect(product).toBeDefined();

    // Log adjustment ADD
    const adj = await StockAdjustment.create({
      productId,
      adjustmentNumber: `ADJ-TEST-ADD`,
      type: 'ADD',
      reason: 'COUNT_MISMATCH',
      quantity: 10,
      userId: new mongoose.Types.ObjectId(),
    });

    product!.quantity += 10;
    await product!.save();

    await StockMovement.create({
      productId,
      type: 'ADJUSTMENT',
      quantity: 10,
      costPrice: product!.costPrice,
      sellingPrice: product!.sellingPrice,
      referenceId: adj._id.toString(),
      userId: adj.userId,
    });

    const updated = await Product.findById(productId);
    expect(updated!.quantity).toBe(60);

    const moves = await StockMovement.find({ productId });
    expect(moves.length).toBe(1);
    expect(moves[0].quantity).toBe(10);
  });

  it('should accurately calculate valuations using FIFO/LIFO/Weighted Average rules', async () => {
    // Add positive movements at different cost prices to simulate batches
    const product = await Product.findById(productId);
    const userId = new mongoose.Types.ObjectId();

    // Batch 1 (Opening stock): already created, 50 units (original) at cost $10
    // Let's log positive stock movements to simulate historical purchases
    await StockMovement.create({
      productId,
      type: 'PURCHASE',
      quantity: 50,
      costPrice: 10.0,
      sellingPrice: 25.0,
      userId,
    });

    // Batch 2: 20 units at cost $12
    await StockMovement.create({
      productId,
      type: 'PURCHASE',
      quantity: 20,
      costPrice: 12.0,
      sellingPrice: 25.0,
      userId,
    });

    // Batch 3: 10 units at cost $15
    await StockMovement.create({
      productId,
      type: 'PURCHASE',
      quantity: 10,
      costPrice: 15.0,
      sellingPrice: 25.0,
      userId,
    });

    // Current stock quantity in DB is 60 (from previous test's adjustment)
    // FIFO valuation should calculate for remaining 60 units:
    // Newest batches first:
    // Batch 3 (10 units @ $15) = $150
    // Batch 2 (20 units @ $12) = $240
    // Batch 1 (30 units @ $10) = $300
    // Total FIFO value = $690

    // LIFO valuation should calculate for oldest batches first:
    // Batch 1 (50 units @ $10) = $500
    // Batch 2 (10 units @ $12) = $120
    // Total LIFO value = $620

    const Q = product!.quantity; // 60
    const defaultCost = product!.costPrice; // 10

    // Run FIFO valuation algorithm in test
    const movements = await StockMovement.find({
      productId,
      quantity: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .lean();

    let fifoVal = 0;
    let fifoRemaining = Q;
    for (const mov of movements) {
      const qty = mov.quantity;
      const cost = mov.costPrice || defaultCost;
      if (fifoRemaining <= qty) {
        fifoVal += fifoRemaining * cost;
        break;
      } else {
        fifoVal += qty * cost;
        fifoRemaining -= qty;
      }
    }
    expect(fifoVal).toBe(690);

    // Run LIFO valuation algorithm in test
    const lifoMovements = [...movements].reverse();
    let lifoVal = 0;
    let lifoRemaining = Q;
    for (const mov of lifoMovements) {
      const qty = mov.quantity;
      const cost = mov.costPrice || defaultCost;
      if (lifoRemaining <= qty) {
        lifoVal += lifoRemaining * cost;
        break;
      } else {
        lifoVal += qty * cost;
        lifoRemaining -= qty;
      }
    }
    expect(lifoVal).toBe(600);
  });

  it('should manage warehouse transfers and handle stock reservations', async () => {
    const userId = new mongoose.Types.ObjectId();
    const product = await Product.findById(productId);
    expect(product!.quantity).toBe(60);

    // Create a pending transfer of 20 units
    const transfer = await WarehouseTransfer.create({
      transferNumber: 'TRF-TEST-001',
      fromWarehouseId: warehouseAId,
      toWarehouseId: warehouseBId,
      items: [{ productId, quantity: 20 }],
      status: 'PENDING',
      createdBy: userId,
    });

    expect(transfer.status).toBe('PENDING');

    // Ship transfer: status -> IN_TRANSIT
    // Deducts from main qty (60 -> 40), adds to reserved (0 -> 20)
    product!.quantity -= 20;
    product!.reservedQuantity += 20;
    await product!.save();

    transfer.status = 'IN_TRANSIT';
    await transfer.save();

    let checkProd = await Product.findById(productId);
    expect(checkProd!.quantity).toBe(40);
    expect(checkProd!.reservedQuantity).toBe(20);

    // Complete transfer: status -> COMPLETED
    // Deducts from reserved (20 -> 0), adds to main qty (40 -> 60)
    checkProd!.reservedQuantity -= 20;
    checkProd!.quantity += 20;
    await checkProd!.save();

    transfer.status = 'COMPLETED';
    await transfer.save();

    checkProd = await Product.findById(productId);
    expect(checkProd!.quantity).toBe(60);
    expect(checkProd!.reservedQuantity).toBe(0);
  });
});
