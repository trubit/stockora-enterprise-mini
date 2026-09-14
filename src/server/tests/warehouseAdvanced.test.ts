import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Warehouse } from '../models/Warehouse.js';
import { WarehouseLocation } from '../models/WarehouseLocation.js';
import { Product } from '../models/Product.js';
import { WarehouseTransfer } from '../models/WarehouseTransfer.js';
import { PickList } from '../models/PickList.js';
import { Package } from '../models/Package.js';
import { DispatchManifest } from '../models/DispatchManifest.js';
import { CycleCount } from '../models/CycleCount.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';
import { WarehouseAdvancedService } from '../services/warehouseAdvanced.service.js';
import { PickingAdvancedService } from '../services/pickingAdvanced.service.js';
import { PackingAdvancedService } from '../services/packingAdvanced.service.js';
import { DispatchAdvancedService } from '../services/dispatchAdvanced.service.js';
import { StockCountAdvancedService } from '../services/stockCountAdvanced.service.js';
import { WarehouseAnalyticsAdvancedService } from '../services/warehouseAnalyticsAdvanced.service.js';

describe('Phase 37 — Advanced Warehouse Operations, Inventory Control & Logistics Orchestration Engine', () => {
  let sourceWarehouseId: string;
  let destWarehouseId: string;
  let locationId: string;
  let productId: string;
  let orderId: string;
  let transferId: string;
  let pickTaskId: string;
  let packageId: string;
  let manifestId: string;
  let countId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }
  });

  afterAll(async () => {
    await Warehouse.deleteMany({ tenantId: 'tenant-wms-test' });
    await WarehouseLocation.deleteMany({ tenantId: 'tenant-wms-test' });
    await Product.deleteMany({ name: 'Heavy Duty Steel Beam' });
    await WarehouseTransfer.deleteMany({ tenantId: 'tenant-wms-test' });
    await PickList.deleteMany({ tenantId: 'tenant-wms-test' });
    await Package.deleteMany({ tenantId: 'tenant-wms-test' });
    await DispatchManifest.deleteMany({ tenantId: 'tenant-wms-test' });
    await CycleCount.deleteMany({ tenantId: 'tenant-wms-test' });
    await OmnichannelOrder.deleteMany({ customerName: 'WMS Test Customer' });
    await mongoose.connection.close();
  });

  it('1. Should register multi-warehouse facilities with capacity limits', async () => {
    const sourceWh = await WarehouseAdvancedService.createWarehouse({
      tenantId: 'tenant-wms-test',
      name: 'Central Logistics Hub',
      code: `WH-SRC-${Date.now().toString().slice(-4)}`,
      warehouseType: 'DISTRIBUTION',
      city: 'Lagos',
      country: 'Nigeria',
      capacityUnits: 15000,
    });

    const destWh = await WarehouseAdvancedService.createWarehouse({
      tenantId: 'tenant-wms-test',
      name: 'Retail Fulfillment Hub',
      code: `WH-DST-${Date.now().toString().slice(-4)}`,
      warehouseType: 'FULFILLMENT',
      city: 'Abuja',
      country: 'Nigeria',
      capacityUnits: 8000,
    });

    expect(sourceWh).toBeDefined();
    expect(sourceWh.capacityUnits).toBe(15000);
    expect(destWh).toBeDefined();
    sourceWarehouseId = sourceWh._id.toString();
    destWarehouseId = destWh._id.toString();
  });

  it('2. Should create storage location hierarchy and check capacity thresholds', async () => {
    const loc = await WarehouseAdvancedService.createLocation({
      tenantId: 'tenant-wms-test',
      warehouseId: sourceWarehouseId,
      locationCode: `LOC-A-${Date.now().toString().slice(-4)}`,
      locationType: 'STORAGE',
      aisle: 'A',
      rack: '01',
      shelf: '02',
      bin: '04',
      capacityUnits: 200,
    });

    expect(loc).toBeDefined();
    expect(loc.locationCode).toContain('LOC-A-');
    locationId = loc._id.toString();

    // Capacity Check Test
    const isCapacityAvailable = await WarehouseAdvancedService.checkLocationCapacity(
      locationId,
      50
    );
    expect(isCapacityAvailable).toBe(true);
  });

  it('3. Should execute inter-warehouse transfer lifecycle with in-transit reservations', async () => {
    const product = await Product.create({
      tenantId: 'tenant-wms-test',
      name: 'Heavy Duty Steel Beam',
      sku: `STEEL-${Date.now().toString().slice(-4)}`,
      price: 250,
      costPrice: 150,
      quantity: 500,
    });
    productId = product._id.toString();

    const transfer = await WarehouseAdvancedService.createTransferRequest({
      tenantId: 'tenant-wms-test',
      fromWarehouseId: sourceWarehouseId,
      toWarehouseId: destWarehouseId,
      items: [{ productId, quantity: 100 }],
      notes: 'Inter-warehouse stock rebalancing',
    });

    expect(transfer.status).toBe('REQUESTED');
    transferId = transfer._id.toString();

    // Approve Transfer
    const approvedTrf = await WarehouseAdvancedService.approveTransfer(transferId);
    expect(approvedTrf.status).toBe('APPROVED');

    // Dispatch Transfer In-Transit
    const dispatchedTrf = await WarehouseAdvancedService.dispatchTransfer(transferId);
    expect(dispatchedTrf.status).toBe('IN_TRANSIT');

    // Check Source Warehouse Stock Deduction
    const updatedProd = await Product.findById(productId);
    expect(updatedProd!.quantity).toBe(400);

    // Receive Transfer at Destination
    const receivedTrf = await WarehouseAdvancedService.receiveTransfer(transferId, [
      { productId, quantityReceived: 100 },
    ]);
    expect(receivedTrf.status).toBe('RECEIVED');

    // Check Destination Warehouse Stock Added Back
    const finalProd = await Product.findById(productId);
    expect(finalProd!.quantity).toBe(500);
  });

  it('4. Should create picking tasks with aisle route optimization', async () => {
    const pickTask = await PickingAdvancedService.createPickTask({
      tenantId: 'tenant-wms-test',
      warehouseId: sourceWarehouseId,
      strategy: 'SINGLE',
      priority: 'HIGH',
      items: [{ productId, requestedQuantity: 25 }],
    });

    expect(pickTask).toBeDefined();
    expect(pickTask.status).toBe('ASSIGNED');
    pickTaskId = pickTask._id.toString();
  });

  it('5. Should execute pick item scanning and reserve order stock', async () => {
    const updatedTask = await PickingAdvancedService.executePickItem({
      pickTaskId,
      productId,
      quantityPicked: 25,
    });

    expect(updatedTask.status).toBe('COMPLETED');
  });

  it('6. Should pack order items into package containers with weight and dimensions', async () => {
    const testOrder = await OmnichannelOrder.create({
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      channel: 'WEBSITE',
      customerName: 'WMS Test Customer',
      warehouseId: new mongoose.Types.ObjectId(sourceWarehouseId),
      items: [
        {
          productId: new mongoose.Types.ObjectId(productId),
          sku: 'SKU-TEST',
          name: 'Heavy Duty Steel Beam',
          quantity: 25,
          unitPrice: 250,
          discount: 0,
          tax: 0,
          total: 6250,
        },
      ],
      subtotal: 6250,
      taxTotal: 0,
      discountTotal: 0,
      grandTotal: 6250,
      currencyCode: 'USD',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'PICKED',
      fulfillmentMethod: 'SHIP',
      status: 'PROCESSING',
    });
    orderId = testOrder._id.toString();

    const pkg = await PackingAdvancedService.packOrderPackage({
      tenantId: 'tenant-wms-test',
      orderId,
      items: [{ productId, quantity: 25 }],
      weight: 12.5,
      length: 40,
      width: 30,
      height: 20,
    });

    expect(pkg).toBeDefined();
    expect(pkg.packageNumber).toContain('PKG-');
    expect(pkg.weight).toBe(12.5);
    packageId = pkg._id.toString();
  });

  it('7. Should generate shipment manifest and perform loading verification before dispatch', async () => {
    const manifest = await DispatchAdvancedService.createDispatchManifest({
      tenantId: 'tenant-wms-test',
      warehouseId: sourceWarehouseId,
      carrierName: 'DHL Logistics',
      driverName: 'Samuel Jackson',
      vehiclePlateNumber: 'KJA-592-LS',
      packageIds: [packageId],
    });

    expect(manifest).toBeDefined();
    expect(manifest.manifestNumber).toContain('MNF-');
    manifestId = manifest._id.toString();

    // Verify package loading scan
    const verifiedManifest = await DispatchAdvancedService.verifyPackageLoaded(
      manifestId,
      manifest.items[0].packageNumber
    );
    expect(verifiedManifest.status).toBe('LOADED');

    // Execute Carrier Handover Dispatch
    const dispatchedManifest = await DispatchAdvancedService.executeDispatch(manifestId);
    expect(dispatchedManifest.status).toBe('DISPATCHED');
  });

  it('8. Should perform blind cycle count and reconcile stock variance', async () => {
    const countDoc = await StockCountAdvancedService.createStockCount({
      tenantId: 'tenant-wms-test',
      warehouseId: sourceWarehouseId,
      countType: 'BLIND',
      items: [{ productId }],
    });

    expect(countDoc).toBeDefined();
    expect(countDoc.status).toBe('IN_PROGRESS');
    countId = countDoc._id.toString();

    // Submit Physical Count (Physical count = 490 vs System = 500 -> Variance -10)
    const submittedCount = await StockCountAdvancedService.submitCountResults({
      countId,
      counts: [{ productId, countedQuantity: 490 }],
    });
    expect(submittedCount.status).toBe('VARIANCE_DETECTED');

    // Approve Count Reconciliation
    const reconciledCount = await StockCountAdvancedService.approveCountReconciliation(countId);
    expect(reconciledCount.status).toBe('COMPLETED');

    const reconciledProd = await Product.findById(productId);
    expect(reconciledProd!.quantity).toBe(490);
  });

  it('9. Should process inventory disposition for damaged or quarantined stock', async () => {
    const adjustment = await WarehouseAdvancedService.processInventoryDisposition({
      tenantId: 'tenant-wms-test',
      productId,
      warehouseId: sourceWarehouseId,
      quantity: 10,
      disposition: 'QUARANTINE',
      reason: 'Defective packaging isolation',
    });

    expect(adjustment).toBeDefined();
    const finalProd = await Product.findById(productId);
    expect(finalProd!.quantity).toBe(480);
  });

  it('10. Should generate warehouse analytics, stock aging breakdown and AI slotting recommendations', async () => {
    const analytics =
      await WarehouseAnalyticsAdvancedService.getWarehouseAnalytics('tenant-wms-test');
    expect(analytics).toBeDefined();
    expect(analytics.totalWarehouses).toBeGreaterThanOrEqual(1);
    expect(analytics.aiSlottingAdvisory).toBeDefined();
    expect(analytics.stockAging).toBeDefined();
  });
});
