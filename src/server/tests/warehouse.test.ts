import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { warehouseService } from '../services/warehouse.service.js';
import { inventoryLocationService } from '../services/inventory-location.service.js';
import { putAwayService } from '../services/putaway.service.js';
import { allocationService } from '../services/allocation.service.js';
import { pickingService } from '../services/picking.service.js';
import { packingService } from '../services/packing.service.js';
import { dispatchService } from '../services/dispatch.service.js';
import { warehouseTransferService } from '../services/warehouse-transfer.service.js';
import { cycleCountService } from '../services/cycle-count.service.js';
import { Warehouse } from '../models/Warehouse.js';
import { WarehouseZone } from '../models/WarehouseZone.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';

describe('Phase 34 — Advanced Warehouse Management System (WMS) Tests', () => {
  let warehouseId: string;
  let zoneId: string;
  let recLocId: string;
  let storeLocId: string;
  let productId: string;
  let productSku: string;
  let userId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }

    // Seed User
    const user = await User.create({
      username: `wh_admin_${Date.now()}`,
      email: `wh_admin_${Date.now()}@stockora.io`,
      password: 'password123',
      roleName: 'admin',
    });
    userId = user._id.toString();

    // Seed Product
    const prod = await Product.create({
      name: 'WMS Test Pallet Widget',
      sku: `WMS-SKU-${Date.now()}`,
      barcode: `123456789_${Date.now()}`,
      quantity: 100,
      costPrice: 50,
      sellingPrice: 100,
      lowStockAlert: 10,
    });
    productId = prod._id.toString();
    productSku = prod.sku;
  });

  it('should create warehouse, zone, receiving location, and storage location', async () => {
    const code = `WH-TEST-${Date.now().toString().slice(-4)}`;
    const wh = await warehouseService.createWarehouse({
      companyId: new mongoose.Types.ObjectId().toString(),
      branchId: new mongoose.Types.ObjectId().toString(),
      name: 'Central Distribution Center',
      code,
      warehouseType: 'DISTRIBUTION_CENTER',
      capacityUnits: 10000,
    });
    warehouseId = wh._id.toString();
    expect(wh.code).toBe(code);

    const zone = await warehouseService.createZone({
      companyId: wh.companyId!.toString(),
      warehouseId,
      name: 'High Capacity Storage Zone',
      code: 'ZONE-A',
      zoneType: 'STORAGE',
      createdBy: userId,
    });
    zoneId = zone._id.toString();
    expect(zone.code).toBe('ZONE-A');

    // Receiving Dock Location
    const recLoc = await warehouseService.createLocation({
      companyId: wh.companyId!.toString(),
      warehouseId,
      zoneId,
      locationCode: 'RECEIVING-DOCK-01',
      locationType: 'RECEIVING',
      capacityUnits: 1000,
      createdBy: userId,
    });
    recLocId = recLoc._id.toString();

    // Storage Bin Location
    const storeLoc = await warehouseService.createLocation({
      companyId: wh.companyId!.toString(),
      warehouseId,
      zoneId,
      locationCode: 'A-01-02-03',
      locationType: 'STORAGE',
      capacityUnits: 500,
      createdBy: userId,
    });
    storeLocId = storeLoc._id.toString();
    expect(storeLoc.locationCode).toBe('A-01-02-03');
  });

  it('should execute atomic stock movements and update location currentUnits', async () => {
    const move = await inventoryLocationService.moveStock({
      companyId: new mongoose.Types.ObjectId().toString(),
      warehouseId,
      productId,
      quantity: 50,
      toLocationId: recLocId,
      movementType: 'RECEIPT',
      userId,
      notes: 'Initial Goods Receipt at Dock',
    });
    expect(move.success).toBe(true);

    const recLocDoc = await WarehouseLocation.findById(recLocId);
    expect(recLocDoc?.currentUnits).toBe(50);
  });

  it('should recommend put-away location and execute put-away to storage bin', async () => {
    const rec = await putAwayService.recommendLocation({
      warehouseId,
      productId,
      quantity: 50,
      strategy: 'NEAREST_AVAILABLE',
    });
    expect(rec.locationId).toBe(storeLocId);

    // Perform put-away move
    const move = await inventoryLocationService.moveStock({
      companyId: new mongoose.Types.ObjectId().toString(),
      warehouseId,
      productId,
      quantity: 50,
      fromLocationId: recLocId,
      toLocationId: storeLocId,
      movementType: 'PUT_AWAY',
      userId,
      notes: 'Put-away from RECEIVING to Storage Bin A-01-02-03',
    });
    expect(move.success).toBe(true);

    const recLocDoc = await WarehouseLocation.findById(recLocId);
    const storeLocDoc = await WarehouseLocation.findById(storeLocId);
    expect(recLocDoc?.currentUnits).toBe(0);
    expect(storeLocDoc?.currentUnits).toBe(50);
  });

  it('should allocate order stock and reserve inventory at storage location', async () => {
    const orderId = new mongoose.Types.ObjectId().toString();
    const alloc = await allocationService.allocateOrder({
      companyId: new mongoose.Types.ObjectId().toString(),
      orderId,
      orderNumber: 'STK-2026-TEST-99',
      items: [{ productId, quantity: 20 }],
      preferredWarehouseId: warehouseId,
      strategy: 'AVAILABILITY',
      createdBy: userId,
    });

    expect(alloc.status).toBe('ALLOCATED');
    expect(alloc.items[0].quantityAllocated).toBe(20);
  });

  it('should enforce wrong product and wrong location protection during barcode picking', async () => {
    const orderId = new mongoose.Types.ObjectId().toString();
    const alloc = await allocationService.allocateOrder({
      companyId: new mongoose.Types.ObjectId().toString(),
      orderId,
      orderNumber: 'STK-2026-PICK-01',
      items: [{ productId, quantity: 10 }],
      preferredWarehouseId: warehouseId,
      createdBy: userId,
    });

    const pickList = await pickingService.createPickList({
      companyId: alloc.companyId.toString(),
      warehouseId,
      orderId,
      orderNumber: 'STK-2026-PICK-01',
      allocationId: alloc._id.toString(),
      createdBy: userId,
    });

    const itemId = (pickList.items[0] as any)._id.toString();

    // Wrong Product Protection Check
    await expect(
      pickingService.scanAndPickItem({
        pickListId: pickList._id.toString(),
        itemId,
        scannedSku: 'WRONG-SKU-999',
        scannedLocationCode: 'A-01-02-03',
        quantityToPick: 10,
        pickerId: userId,
      })
    ).rejects.toThrow(/WRONG PRODUCT SCANNED|SKU MISMATCH/);

    // Wrong Location Protection Check
    await expect(
      pickingService.scanAndPickItem({
        pickListId: pickList._id.toString(),
        itemId,
        scannedSku: productSku,
        scannedLocationCode: 'WRONG-LOC-B99',
        quantityToPick: 10,
        pickerId: userId,
      })
    ).rejects.toThrow(/WRONG LOCATION SCANNED|LOCATION MISMATCH/);

    // Successful Pick Scan
    const result = await pickingService.scanAndPickItem({
      pickListId: pickList._id.toString(),
      itemId,
      scannedSku: productSku,
      scannedLocationCode: 'A-01-02-03',
      quantityToPick: 10,
      pickerId: userId,
    });

    expect(result.pickList.status).toBe('PICKED');
  });

  it('should pack order into shipping container and execute carrier dispatch', async () => {
    const orderId = new mongoose.Types.ObjectId().toString();
    const pkg = await packingService.packOrder({
      companyId: new mongoose.Types.ObjectId().toString(),
      warehouseId,
      orderId,
      orderNumber: 'STK-2026-DISP-01',
      packagingType: 'BOX_MED',
      weight: 2.5,
      carrier: 'DHL Express',
      items: [
        {
          productId: new mongoose.Types.ObjectId(productId),
          sku: 'SKU',
          name: 'Widget',
          quantity: 5,
        },
      ],
      packerId: userId,
    });

    expect(pkg.status).toBe('PACKED');

    const dispatch = await dispatchService.createDispatchManifest({
      companyId: pkg.companyId!.toString(),
      warehouseId,
      carrier: 'DHL Express',
      packageIds: [pkg._id.toString()],
      userId,
    });

    expect(dispatch.status).toBe('VERIFIED');

    const executed = await dispatchService.executeDispatch(dispatch._id.toString(), userId);
    expect(executed.status).toBe('DISPATCHED');
  });

  it('should request, ship, and receive inter-warehouse stock transfer', async () => {
    // Create destination warehouse
    const destWh = await warehouseService.createWarehouse({
      companyId: new mongoose.Types.ObjectId().toString(),
      branchId: new mongoose.Types.ObjectId().toString(),
      name: 'Secondary Transit Warehouse',
      code: `WH-SEC-${Date.now().toString().slice(-4)}`,
      capacityUnits: 5000,
    });

    const destZone = await warehouseService.createZone({
      companyId: destWh.companyId!.toString(),
      warehouseId: destWh._id.toString(),
      name: 'Destination Zone',
      code: 'DEST-ZONE',
      createdBy: userId,
    });

    await warehouseService.createLocation({
      companyId: destWh.companyId!.toString(),
      warehouseId: destWh._id.toString(),
      zoneId: destZone._id.toString(),
      locationCode: 'DEST-REC-01',
      locationType: 'RECEIVING',
      createdBy: userId,
    });

    const transfer = await warehouseTransferService.requestTransfer({
      companyId: destWh.companyId!.toString(),
      fromWarehouseId: warehouseId,
      toWarehouseId: destWh._id.toString(),
      items: [{ productId, quantity: 5, fromLocationId: storeLocId }],
      createdBy: userId,
    });

    expect(transfer.status).toBe('REQUESTED');

    await warehouseTransferService.approveTransfer(transfer._id.toString(), userId);
    const shipped = await warehouseTransferService.shipTransfer(transfer._id.toString(), userId);
    expect(shipped.status).toBe('IN_TRANSIT');

    const received = await warehouseTransferService.receiveTransfer(
      transfer._id.toString(),
      userId,
      [{ productId, receivedQuantity: 5 }]
    );
    expect(received.status).toBe('RECEIVED');
  });

  it('should run cycle count, calculate variance, and execute stock adjustment', async () => {
    const count = await cycleCountService.createCycleCount({
      companyId: new mongoose.Types.ObjectId().toString(),
      warehouseId,
      countType: 'SCHEDULED',
      isBlindCount: true,
      createdBy: userId,
    });

    expect(count.status).toBe('ASSIGNED');

    if (count.items.length > 0) {
      const firstItem = count.items[0];
      const submitted = await cycleCountService.submitCountResults(count._id.toString(), userId, [
        {
          itemId: (firstItem as any)._id.toString(),
          countedQuantity: (firstItem.expectedQuantity || 0) + 2,
        },
      ]);

      expect(submitted.totalVarianceCount).toBe(2);
    }
  });
});
