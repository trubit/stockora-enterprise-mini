import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { SupplierProduct } from '../models/SupplierProduct.js';
import { SupplierPriceHistory } from '../models/SupplierPriceHistory.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { PurchaseOrderRevision } from '../models/PurchaseOrderRevision.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { QualityInspection } from '../models/QualityInspection.js';
import { SupplierReturn } from '../models/SupplierReturn.js';
import { SupplierInvoice } from '../models/SupplierInvoice.js';
import { ProcurementMatch } from '../models/ProcurementMatch.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { ProcurementAdvancedService } from '../services/procurementAdvanced.service.js';
import { SupplierPerformanceService } from '../services/supplierPerformance.service.js';
import { ThreeWayMatchAdvancedService } from '../services/threeWayMatchAdvanced.service.js';
import { SupplierAdapterService } from '../services/supplierAdapter.service.js';
import { ProcurementAnalyticsService } from '../services/procurementAnalytics.service.js';

describe('Phase 36 — Advanced Procurement, Supplier & Purchase Order Management Engine', () => {
  let supplierId: string;
  let productId: string;
  let userId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_procurement_advanced');
    }

    await Supplier.deleteMany({});
    await SupplierProduct.deleteMany({});
    await SupplierPriceHistory.deleteMany({});
    await PurchaseRequisition.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await PurchaseOrderRevision.deleteMany({});
    await GoodsReceipt.deleteMany({});
    await QualityInspection.deleteMany({});
    await SupplierReturn.deleteMany({});
    await SupplierInvoice.deleteMany({});
    await ProcurementMatch.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});

    const user = await User.create({
      username: `procurement_exec_${Date.now()}`,
      email: `exec_${Date.now()}@stockora.com`,
      password: 'Password123!',
      roleName: 'PROCUREMENT_MANAGER',
    });
    userId = user._id.toString();

    const supplier = await Supplier.create({
      tenantId: 'tenant-test',
      name: 'Vanguard Industrial Global',
      legalName: 'Vanguard Industrial Global Corp LLC',
      code: `SUP-VAN-${Date.now().toString().slice(-4)}`,
      contactPerson: 'David Miller',
      email: 'dmiller@vanguard.com',
      phone: '+1-800-555-9000',
      address: '700 Logistics Way, Enterprise Park, CA',
      paymentTerms: 'NET 30',
      category: 'MANUFACTURER',
      status: 'ACTIVE',
      leadTimeDays: 5,
      moq: 10,
    });
    supplierId = supplier._id.toString();

    const product = await Product.create({
      tenantId: 'tenant-test',
      name: 'Heavy Duty Titanium Fastener (M12)',
      sku: `SKU-FAST-${Date.now().toString().slice(-4)}`,
      costPrice: 25.0,
      price: 60.0,
      cost: 25.0,
      quantity: 15,
      lowStockAlert: 50,
    });
    productId = product._id.toString();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('1. Should register a new supplier master with scorecards and contacts', async () => {
    const sup = await Supplier.findById(supplierId);
    expect(sup).toBeDefined();
    expect(sup!.legalName).toBe('Vanguard Industrial Global Corp LLC');
    expect(sup!.status).toBe('ACTIVE');

    const scorecard = await SupplierPerformanceService.calculateSupplierScorecard(supplierId);
    expect(scorecard.overallScore).toBe(100);
  });

  it('2. Should map supplier products, MOQ, lead times, and price history', async () => {
    const sp = await SupplierProduct.create({
      tenantId: 'tenant-test',
      supplierId,
      productId,
      supplierSku: 'VANG-M12-FASTENER',
      purchaseCost: 22.5,
      minimumOrderQuantity: 20,
      leadTimeDays: 4,
      isPreferred: true,
    });

    expect(sp.purchaseCost).toBe(22.5);
    expect(sp.isPreferred).toBe(true);
  });

  it('3. Should create purchase requisition and approve it', async () => {
    const pr = await ProcurementAdvancedService.createPurchaseRequest({
      tenantId: 'tenant-test',
      items: [{ productId, quantity: 100, estimatedCost: 22.5 }],
      priority: 'HIGH',
      userId,
      userName: 'David Requisitioner',
    });

    expect(pr.status).toBe('SUBMITTED');
    expect(pr.priority).toBe('HIGH');

    const approvedPR = await ProcurementAdvancedService.approvePurchaseRequest(
      pr._id.toString(),
      userId,
      'Executive Approver'
    );
    expect(approvedPR.status).toBe('APPROVED');
  });

  it('4. Should issue purchase order and record version revision history', async () => {
    const po = await ProcurementAdvancedService.createPurchaseOrder({
      tenantId: 'tenant-test',
      supplierId,
      items: [{ productId, quantity: 100, costPrice: 22.5 }],
      shippingCost: 50,
      userId,
      userName: 'PO Creator',
    });

    expect(po.poNumber).toMatch(/^PO-/);
    expect(po.totalAmount).toBe(2300); // 100 * 22.5 + 50
    expect(po.version).toBe(1);

    const revision = await PurchaseOrderRevision.findOne({ purchaseOrderId: po._id });
    expect(revision).toBeDefined();
    expect(revision!.revisionNumber).toBe(1);

    // Revise PO
    const revisedPO = await ProcurementAdvancedService.revisePurchaseOrder(
      po._id.toString(),
      { notes: 'Updated delivery instructions' },
      userId,
      'Procurement Agent',
      'Change of delivery instructions'
    );
    expect(revisedPO.version).toBe(2);
  });

  it('5. Should handle supplier confirmation and partial goods receiving', async () => {
    const po = await PurchaseOrder.findOne({ supplierId });
    expect(po).toBeDefined();

    const confirmation = await ProcurementAdvancedService.processSupplierConfirmation(
      po!._id.toString(),
      'CONFIRMED',
      new Date(Date.now() + 5 * 86400000),
      'Order confirmed by vendor'
    );
    expect(confirmation.status).toBe('CONFIRMED');

    // Goods Receipt (Receive 60 out of 100)
    const grn = await ProcurementAdvancedService.processGoodsReceiving({
      tenantId: 'tenant-test',
      poId: po!._id.toString(),
      items: [{ productId, quantityReceived: 60, batchNumber: 'LOT-VAN-001' }],
      receivedBy: userId,
      receivedByName: 'Receiving Officer',
    });

    expect(grn.grnNumber).toMatch(/^GRN-/);
    const updatedPO = await PurchaseOrder.findById(po!._id);
    expect(updatedPO!.status).toBe('PARTIALLY_RECEIVED');

    // Verify stock incremented by 60 (15 original + 60 = 75)
    const updatedProd = await Product.findById(productId);
    expect(updatedProd!.quantity).toBe(75);
  });

  it('6. Should enforce over-receiving tolerance limits', async () => {
    const po = await PurchaseOrder.findOne({ supplierId });
    expect(po).toBeDefined();

    // Max allowed is 100 + 5% = 105. Currently received 60. Attempting to receive 60 more (total 120) should throw ValidationError
    await expect(
      ProcurementAdvancedService.processGoodsReceiving({
        tenantId: 'tenant-test',
        poId: po!._id.toString(),
        items: [{ productId, quantityReceived: 60 }],
        overReceivingTolerancePercent: 5,
        receivedBy: userId,
      })
    ).rejects.toThrow(/Over-receiving limit exceeded/);
  });

  it('7. Should process quality inspection and isolate quarantined stock', async () => {
    const grn = await GoodsReceipt.findOne({});
    expect(grn).toBeDefined();

    const qi = await ProcurementAdvancedService.processQualityInspection({
      grnId: grn!._id.toString(),
      inspectorId: userId,
      inspectorName: 'QA Lead',
      items: [
        {
          productId,
          quantityInspected: 60,
          quantityPassed: 50,
          quantityFailed: 10,
          defectType: 'SURFACE_SCRATCHES',
          failureReason: 'Failed structural stress tolerance',
        },
      ],
    });

    expect(qi.overallStatus).toBe('QUARANTINED');
    const updatedGRN = await GoodsReceipt.findById(grn!._id);
    expect(updatedGRN!.inspectionStatus).toBe('QUARANTINED');

    // 10 failed items removed from available inventory (75 - 10 = 65)
    const updatedProd = await Product.findById(productId);
    expect(updatedProd!.quantity).toBe(65);
  });

  it('8. Should process supplier returns and issue supplier credit notes', async () => {
    const ret = await ProcurementAdvancedService.createSupplierReturn({
      supplierId,
      items: [{ productId, quantity: 10, unitCost: 22.5, returnReason: 'Defective batch items' }],
      createdById: userId,
      createdByName: 'Procurement Specialist',
    });

    expect(ret.totalAmount).toBe(225);
    expect(ret.status).toBe('APPROVED');
  });

  it('9. Should execute 3-Way Invoice Matching and prevent duplicate invoices', async () => {
    const po = await PurchaseOrder.findOne({ supplierId });

    // Complete remaining receiving (40 items) to achieve 100% full receipt matching
    await ProcurementAdvancedService.processGoodsReceiving({
      tenantId: 'tenant-test',
      poId: po!._id.toString(),
      items: [{ productId, quantityReceived: 40, batchNumber: 'LOT-VAN-002' }],
      receivedBy: userId,
    });

    const matchResult = await ThreeWayMatchAdvancedService.processThreeWayMatch({
      tenantId: 'tenant-test',
      supplierId,
      poId: po!._id.toString(),
      invoiceNumber: 'INV-VAN-2026-001',
      amount: 2300,
    });

    expect(matchResult.invoice.matchingStatus).toBe('MATCHED');
    expect(matchResult.matchRecord.overallStatus).toBe('MATCHED');

    // Duplicate invoice submission test
    await expect(
      ThreeWayMatchAdvancedService.processThreeWayMatch({
        tenantId: 'tenant-test',
        supplierId,
        poId: po!._id.toString(),
        invoiceNumber: 'INV-VAN-2026-001',
        amount: 2300,
      })
    ).rejects.toThrow(/Duplicate Invoice Error/);
  });

  it('10. Should generate procurement spend analytics and AI reorder recommendations', async () => {
    const analytics = await ProcurementAnalyticsService.getProcurementAnalytics(
      'tenant-test',
      'default'
    );
    expect(analytics.totalSuppliers).toBeGreaterThan(0);
    expect(analytics.totalSpend).toBeGreaterThan(0);
    expect(analytics.aiProcurementAdvisory).toBeDefined();
  });

  it('11. Should process external supplier webhook integration foundation', async () => {
    const po = await PurchaseOrder.findOne({ supplierId });

    const result = await SupplierAdapterService.processExternalSupplierWebhook(
      supplierId,
      JSON.stringify({
        poId: po!._id.toString(),
        externalSupplierRef: 'EXT-1234',
        status: 'CONFIRMED',
      }),
      {
        poId: po!._id.toString(),
        externalSupplierRef: 'EXT-1234',
        status: 'CONFIRMED',
        timestamp: Date.now(),
      }
    );

    expect(result.success).toBe(true);
  });
});
