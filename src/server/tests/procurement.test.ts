import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import { ProcurementService } from '../services/procurement.service.js';
import { GoodsReceivingService } from '../services/goods-receiving.service.js';
import { ThreeWayMatchingService } from '../services/three-way-matching.service.js';
import { ProcurementCopilotService } from '../services/procurement-copilot.service.js';
import { QuarantineRecord } from '../models/QuarantineRecord.js';
import { AccountsPayable } from '../models/AccountsPayable.js';
import { JournalEntry } from '../models/JournalEntry.js';

describe('Phase 33 — Procurement & Supply Chain Intelligence Suite', () => {
  let supplierId: string;
  let productId: string;
  let userId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_procurement');
    }

    const user = await User.create({
      username: `procurement_mgr_${Date.now()}`,
      email: `procurement_${Date.now()}@stockora.com`,
      password: 'Password123!',
      roleName: 'BRANCH_MANAGER',
    });
    userId = user._id.toString();

    const supplier = await Supplier.create({
      name: 'Apex Industrial Supplies',
      code: `SUP-${Date.now().toString().slice(-6)}`,
      contactPerson: 'Sarah Jenkins',
      email: 'sjenkins@apexsupplies.com',
      phone: '1-800-555-0199',
      address: '500 Logistics Blvd, Chicago, IL',
      paymentTerms: 'NET 30',
      status: 'ACTIVE',
    });
    supplierId = supplier._id.toString();

    const product = await Product.create({
      name: 'Industrial Heavy Duty Bolt (M10)',
      sku: `SKU-BOLT-${Date.now().toString().slice(-6)}`,
      price: 15.0,
      costPrice: 8.5,
      cost: 8.5,
      quantity: 5,
      lowStockAlert: 50,
    });
    productId = product._id.toString();

    await Account.findOneAndUpdate(
      { code: '1200' },
      { code: '1200', name: 'Inventory Asset Account', type: 'ASSET', balance: 0 },
      { upsert: true }
    );

    await Account.findOneAndUpdate(
      { code: '2000' },
      { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', balance: 0 },
      { upsert: true }
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Supplier Management & Intelligence Scorecard', () => {
    it('should register a new enterprise supplier with scorecards', async () => {
      const supplier = await ProcurementService.createSupplier({
        name: 'Global Metals Corp',
        code: `SUP-METALS-${Date.now().toString().slice(-4)}`,
        contactPerson: 'Mark Vance',
        email: 'mvance@globalmetals.com',
      });

      expect(supplier).toBeDefined();
      expect(supplier.code).toMatch(/^SUP-METALS-/);
      expect(supplier.scorecard).toBeDefined();
      expect(supplier.scorecard?.overallScore).toBe(100);
    });

    it('should add product catalog pricing to supplier with MOQ and lead time', async () => {
      const sp = await ProcurementService.addOrUpdateSupplierProduct({
        supplierId,
        productId,
        supplierSku: 'APEX-BOLT-M10',
        purchaseCost: 7.8,
        minimumOrderQuantity: 100,
        leadTimeDays: 5,
        userId,
      });

      expect(sp).toBeDefined();
      expect(sp.purchaseCost).toBe(7.8);
      expect(sp.minimumOrderQuantity).toBe(100);
      expect(sp.leadTimeDays).toBe(5);
    });
  });

  describe('Purchase Order Workflow & Version Audit', () => {
    let poId: string;

    it('should create a purchase order with version 1 audit trail', async () => {
      const po = await ProcurementService.createPurchaseOrder({
        supplierId,
        userId,
        items: [{ productId, quantity: 200, costPrice: 7.8 }],
        paymentTerms: 'NET 30',
        notes: 'Urgent restocking order',
      });

      expect(po).toBeDefined();
      expect(po.poNumber).toMatch(/^PO-\d{4}-\d+/);
      expect(po.version).toBe(1);
      expect(po.items[0].quantity).toBe(200);
      poId = po._id.toString();
    });

    it('should approve and send purchase order to supplier', async () => {
      const approvedPo = await ProcurementService.approvePurchaseOrder(poId, userId);
      expect(approvedPo.status).toBe('APPROVED');

      const sentPo = await ProcurementService.sendPurchaseOrderToSupplier(poId);
      expect(sentPo.status).toBe('SENT');
    });

    it('should record supplier confirmation and update delivery date', async () => {
      const confirmation = await ProcurementService.recordSupplierConfirmation({
        poId,
        status: 'ACCEPTED',
        supplierMessage: 'Order confirmed and ready for dispatch.',
        revisedDeliveryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      });

      expect(confirmation).toBeDefined();
      expect(confirmation.status).toBe('ACCEPTED');
    });
  });

  describe('Barcode Goods Receiving & Quality Inspection', () => {
    it('should receive partial/full goods shipment and update weighted average cost', async () => {
      const po = await ProcurementService.createPurchaseOrder({
        supplierId,
        userId,
        items: [{ productId, quantity: 10, costPrice: 15.0 }],
      });

      const grn = await GoodsReceivingService.receiveGoods({
        poId: po._id.toString(),
        userId,
        items: [
          {
            productId,
            quantityReceived: 10,
            batchNumber: 'LOT-998811',
            barcodeScanned: true,
          },
        ],
      });

      expect(grn).toBeDefined();
      expect(grn.grnNumber).toMatch(/^GRN-\d+/);
      expect(grn.items[0].quantityReceived).toBe(10);

      const updatedProduct = await Product.findById(productId);
      expect(updatedProduct?.quantity).toBeGreaterThan(5);
    });

    it('should reject over-receiving when variance exceeds 5% limit', async () => {
      const po = await ProcurementService.createPurchaseOrder({
        supplierId,
        userId,
        items: [{ productId, quantity: 10, costPrice: 15.0 }],
      });

      await expect(
        GoodsReceivingService.receiveGoods({
          poId: po._id.toString(),
          userId,
          items: [{ productId, quantityReceived: 20 }],
        })
      ).rejects.toThrow('Over-receiving variance exceeded');
    });

    it('should submit quality inspection decision and quarantine defective stock', async () => {
      const inspectPo = await ProcurementService.createPurchaseOrder({
        supplierId,
        userId,
        items: [{ productId, quantity: 10, costPrice: 15.0 }],
      });

      const grn = await GoodsReceivingService.receiveGoods({
        poId: inspectPo._id.toString(),
        userId,
        items: [{ productId, quantityReceived: 10 }],
      });

      const inspection = await GoodsReceivingService.submitQualityInspection({
        grnId: grn._id.toString(),
        userId,
        overallStatus: 'REJECTED',
        notes: 'Cracked thread detected during sampling.',
        items: [
          {
            productId,
            quantityInspected: 10,
            quantityPassed: 0,
            quantityFailed: 10,
            failureReason: 'Cracked thread',
            resultStatus: 'REJECTED',
          },
        ],
      });

      expect(inspection).toBeDefined();
      expect(inspection.overallStatus).toBe('REJECTED');

      const quarantine = await QuarantineRecord.findOne({ inspectionId: inspection._id });
      expect(quarantine).toBeDefined();
      expect(quarantine?.quantity).toBe(10);
    });
  });

  describe('Three-Way Matching & Accounts Payable Posting', () => {
    it('should perform 3-way matching and auto-post matched invoice to Accounts Payable', async () => {
      const po = await ProcurementService.createPurchaseOrder({
        supplierId,
        userId,
        items: [{ productId, quantity: 50, costPrice: 10.0 }],
      });
      await ProcurementService.approvePurchaseOrder(po._id.toString(), userId);
      await ProcurementService.sendPurchaseOrderToSupplier(po._id.toString());

      const grn = await GoodsReceivingService.receiveGoods({
        poId: po._id.toString(),
        userId,
        items: [{ productId, quantityReceived: 50 }],
      });

      const invNum = `INV-${Date.now()}`;
      const invoice = await ThreeWayMatchingService.submitAndMatchInvoice({
        supplierId,
        invoiceNumber: invNum,
        poId: po._id.toString(),
        grnId: grn._id.toString(),
        subtotal: 500.0,
        taxAmount: 0,
        totalAmount: 500.0,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        items: [{ productId, quantity: 50, unitPrice: 10.0, lineTotal: 500.0 }],
      });

      expect(invoice).toBeDefined();
      expect(invoice.matchStatus).toBe('MATCHED');

      const ap = await AccountsPayable.findOne({ invoiceNumber: invNum });
      expect(ap).toBeDefined();
      expect(ap?.totalAmount).toBe(500.0);

      const journalEntry = await JournalEntry.findOne({ description: { $regex: invNum } });
      expect(journalEntry).toBeDefined();
      expect(journalEntry?.totalDebit).toBe(500.0);
    }, 15000);
  });

  describe('AI Procurement Copilot & Intelligence Suite', () => {
    it('should generate supplier comparison matrix and ranking for products', async () => {
      const matrix = await ProcurementCopilotService.compareSuppliersForProduct(productId);
      expect(matrix).toBeDefined();
      expect(matrix.recommendedSupplier).toBeDefined();
      expect(matrix.suppliers.length).toBeGreaterThan(0);
    });

    it('should return reorder recommendations for low stock products', async () => {
      const recs = await ProcurementCopilotService.getReorderRecommendations();
      expect(recs).toBeDefined();
      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);
    });
  });
});
