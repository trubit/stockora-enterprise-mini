import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { SupplierProduct } from '../models/SupplierProduct.js';
import { SupplierContract } from '../models/SupplierContract.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { ReorderRecommendation } from '../models/ReorderRecommendation.js';
import { LandedCostAllocation } from '../models/LandedCostAllocation.js';
import { ProcurementBudget } from '../models/ProcurementBudget.js';
import { SupplierManagementAdvancedService } from '../services/supplierManagementAdvanced.service.js';
import { ReplenishmentEngineAdvancedService } from '../services/replenishmentEngineAdvanced.service.js';
import { PurchaseOrderVersioningService } from '../services/purchaseOrderVersioning.service.js';
import { LandedCostAdvancedService } from '../services/landedCostAdvanced.service.js';

describe('Phase 38 — Advanced Procurement, Supplier Management & Automated Replenishment Engine', () => {
  let supplier1Id: string;
  let supplier2Id: string;
  let productId: string;
  let warehouseId: string;
  let requisitionId: string;
  let purchaseOrderId: string;
  let recommendationId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/stockora_test');
    }
  });

  afterAll(async () => {
    await Supplier.deleteMany({ tenantId: 'tenant-procurement-test' });
    await SupplierProduct.deleteMany({ tenantId: 'tenant-procurement-test' });
    await SupplierContract.deleteMany({ tenantId: 'tenant-procurement-test' });
    await Product.deleteMany({ name: 'Automated Solar Panel Kit' });
    await Warehouse.deleteMany({ tenantId: 'tenant-procurement-test' });
    await PurchaseRequisition.deleteMany({ tenantId: 'tenant-procurement-test' });
    await PurchaseOrder.deleteMany({ tenantId: 'tenant-procurement-test' });
    await ReorderRecommendation.deleteMany({ tenantId: 'tenant-procurement-test' });
    await LandedCostAllocation.deleteMany({ tenantId: 'tenant-procurement-test' });
    await ProcurementBudget.deleteMany({ tenantId: 'tenant-procurement-test' });
    await mongoose.connection.close();
  });

  it('1. Should create suppliers and calculate weighted scorecard ratings', async () => {
    const supp1 = await Supplier.create({
      tenantId: 'tenant-procurement-test',
      name: 'Alpha Energy Technologies',
      code: `SUP-ALP-${Date.now().toString().slice(-4)}`,
      contactPerson: 'David Miller',
      email: 'david@alphaenergy.com',
      phone: '+1-555-0199',
      address: '100 Solar Way, CA',
      paymentTerms: 'NET 30',
      category: 'MANUFACTURER',
      status: 'ACTIVE',
      leadTimeDays: 5,
      moq: 10,
      scorecard: {
        onTimeDeliveryRate: 98,
        fillRate: 99,
        qualityRate: 98,
        defectRate: 2,
        priceStabilityScore: 95,
        averageLeadTimeDays: 5,
        overallScore: 97,
      },
    });

    const supp2 = await Supplier.create({
      tenantId: 'tenant-procurement-test',
      name: 'Beta Global Power',
      code: `SUP-BET-${Date.now().toString().slice(-4)}`,
      contactPerson: 'Sarah Jenkins',
      email: 'sarah@betaglobal.com',
      phone: '+1-555-0288',
      address: '45 Power Ave, TX',
      paymentTerms: 'NET 60',
      category: 'DISTRIBUTOR',
      status: 'ACTIVE',
      leadTimeDays: 8,
      moq: 5,
      scorecard: {
        onTimeDeliveryRate: 88,
        fillRate: 90,
        qualityRate: 92,
        defectRate: 8,
        priceStabilityScore: 88,
        averageLeadTimeDays: 8,
        overallScore: 89,
      },
    });

    expect(supp1).toBeDefined();
    expect(supp2).toBeDefined();
    supplier1Id = supp1._id.toString();
    supplier2Id = supp2._id.toString();

    const scorecard =
      await SupplierManagementAdvancedService.calculateSupplierScorecard(supplier1Id);
    expect(scorecard.overallScore).toBeGreaterThanOrEqual(90);
  });

  it('2. Should set volume quantity price breaks and rank suppliers for product demand', async () => {
    const product = await Product.create({
      tenantId: 'tenant-procurement-test',
      name: 'Automated Solar Panel Kit',
      sku: `SOLAR-${Date.now().toString().slice(-4)}`,
      price: 600,
      costPrice: 350,
      quantity: 12,
      lowStockAlert: 20,
    });
    productId = product._id.toString();

    // Supplier 1 product mapping with volume price breaks
    await SupplierProduct.create({
      tenantId: 'tenant-procurement-test',
      supplierId: supplier1Id,
      productId: product._id,
      supplierSku: 'ALP-SOL-500',
      purchaseCost: 350,
      currency: 'USD',
      minimumOrderQuantity: 10,
      orderMultiple: 5,
      leadTimeDays: 5,
      isPreferred: true,
      priceBreaks: [
        { minQuantity: 1, maxQuantity: 19, unitPrice: 350 },
        { minQuantity: 20, maxQuantity: 99, unitPrice: 330 },
        { minQuantity: 100, unitPrice: 300 },
      ],
    });

    // Supplier 2 mapping
    await SupplierProduct.create({
      tenantId: 'tenant-procurement-test',
      supplierId: supplier2Id,
      productId: product._id,
      supplierSku: 'BET-SOL-990',
      purchaseCost: 340,
      currency: 'USD',
      minimumOrderQuantity: 5,
      leadTimeDays: 8,
      isPreferred: false,
    });

    // Resolve Price Break for 25 units from Supplier 1
    const suppProd1 = await SupplierProduct.findOne({
      supplierId: supplier1Id,
      productId: product._id,
    });
    const breakRes = await SupplierManagementAdvancedService.resolveSupplierCostForQuantity(
      suppProd1!._id.toString(),
      25
    );
    expect(breakRes.unitCost).toBe(330);

    // Rank suppliers for 25 units
    const rankings = await SupplierManagementAdvancedService.rankSuppliersForProduct(
      productId,
      25,
      'tenant-procurement-test'
    );
    expect(rankings.length).toBe(2);
    expect(rankings[0].supplierId).toBe(supplier1Id); // Supplier 1 cheaper at Qty 25 ($330 vs $340)
  });

  it('3. Should bind master supplier contracts with minimum spend tracking', async () => {
    const contract = await SupplierContract.create({
      tenantId: 'tenant-procurement-test',
      supplierId: supplier1Id,
      contractNumber: `CNT-2026-${Date.now().toString().slice(-4)}`,
      title: 'Annual Solar Panel Master Supply Agreement',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 86400 * 1000),
      minimumCommitmentAmount: 100000,
      currentCommitmentSpend: 25000,
      paymentTerms: 'NET 30',
      status: 'ACTIVE',
    });

    expect(contract).toBeDefined();
    expect(contract.status).toBe('ACTIVE');
    expect(contract.minimumCommitmentAmount).toBe(100000);
  });

  it('4. Should calculate automated replenishment (ROP, Safety Stock, MOQ rounding & risk level)', async () => {
    const warehouse = await Warehouse.create({
      tenantId: 'tenant-procurement-test',
      name: 'Main Distribution Hub',
      code: `WH-MAIN-${Date.now().toString().slice(-4)}`,
      warehouseType: 'DISTRIBUTION',
      capacityUnits: 20000,
    });
    warehouseId = warehouse._id.toString();

    const rec = await ReplenishmentEngineAdvancedService.calculateProductReplenishment({
      tenantId: 'tenant-procurement-test',
      warehouseId,
      productId,
    });

    expect(rec).toBeDefined();
    expect(rec.recommendedQuantity).toBeGreaterThan(0);
    expect(rec.riskLevel).toBeDefined();
    expect(rec.supplierId?.toString()).toBe(supplier1Id);
    recommendationId = rec._id.toString();
  });

  it('5. Should convert automated replenishment recommendation to Purchase Request', async () => {
    const pr =
      await ReplenishmentEngineAdvancedService.convertRecommendationToPurchaseRequest(
        recommendationId
      );

    expect(pr).toBeDefined();
    expect(pr.status).toBe('SUBMITTED');
    expect(pr.requisitionNumber).toContain('REQ-');
    requisitionId = pr._id.toString();
  });

  it('6. Should revise Purchase Order version and audit revision history', async () => {
    const po = await PurchaseOrder.create({
      tenantId: 'tenant-procurement-test',
      warehouseId: new mongoose.Types.ObjectId(warehouseId),
      requisitionId: new mongoose.Types.ObjectId(requisitionId),
      supplierId: new mongoose.Types.ObjectId(supplier1Id),
      supplierName: 'Alpha Energy Technologies',
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      items: [
        {
          productId: new mongoose.Types.ObjectId(productId),
          quantity: 25,
          costPrice: 330,
          receivedQuantity: 0,
          lineTotal: 8250,
        },
      ],
      subtotal: 8250,
      totalAmount: 8250,
      currency: 'USD',
      status: 'PENDING_APPROVAL',
      version: 1,
    });
    purchaseOrderId = po._id.toString();

    // Revise PO to version 2 (increase quantity to 30)
    const revisedPO = await PurchaseOrderVersioningService.revisePurchaseOrder(purchaseOrderId, {
      reason: 'Additional store demand added to purchase batch',
      updatedItems: [
        {
          productId,
          quantity: 30,
          costPrice: 330,
        },
      ],
    });

    expect(revisedPO.version).toBe(2);
    expect(revisedPO.totalAmount).toBe(9900);
    expect(revisedPO.revisions?.length).toBe(1);
    expect(revisedPO.revisions![0].version).toBe(2);
  });

  it('7. Should record supplier counter-proposal and human review resolution', async () => {
    const counterPO = await PurchaseOrderVersioningService.recordSupplierAcknowledgement(
      purchaseOrderId,
      'COUNTER_PROPOSED',
      {
        proposedDeliveryDate: new Date(Date.now() + 10 * 86400 * 1000),
        comments: 'Can supply 30 units but delivery delayed by 3 days due to shipping queue.',
      }
    );

    expect(counterPO.status).toBe('COUNTER_PROPOSED');
    expect(counterPO.counterProposal?.status).toBe('PENDING_REVIEW');

    // Accept Counter Proposal
    const acceptedPO = await PurchaseOrderVersioningService.resolveSupplierCounterProposal(
      purchaseOrderId,
      'ACCEPT'
    );
    expect(acceptedPO.status).toBe('ACKNOWLEDGED');
    expect(acceptedPO.counterProposal?.status).toBe('ACCEPTED');
  });

  it('8. Should allocate landed costs (freight/duties) and update product cost prices', async () => {
    const allocation = await LandedCostAdvancedService.createAndApplyLandedCost({
      tenantId: 'tenant-procurement-test',
      purchaseOrderId,
      totalFreightCost: 300,
      totalCustomsDuty: 150,
      allocationMethod: 'BY_VALUE',
    });

    expect(allocation).toBeDefined();
    expect(allocation.totalLandedCost).toBe(450);

    const updatedProd = await Product.findById(productId);
    expect(updatedProd!.costPrice).toBeGreaterThan(330); // Base cost 330 + allocated landed cost per unit
  });
});
