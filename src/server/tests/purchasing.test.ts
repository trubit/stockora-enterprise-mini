import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Supplier } from '../models/Supplier.js';
import { PurchaseRequisition } from '../models/PurchaseRequisition.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { GoodsReceipt } from '../models/GoodsReceipt.js';
import { SupplierInvoice } from '../models/SupplierInvoice.js';
import { StockMovement } from '../models/StockMovement.js';

describe('Purchasing & Procurement Integration', () => {
  let supplierId: mongoose.Types.ObjectId;
  let productId: string;
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_purchasing');
    }
    await Product.deleteMany({});
    await Supplier.deleteMany({});
    await PurchaseRequisition.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await GoodsReceipt.deleteMany({});
    await SupplierInvoice.deleteMany({});
    await StockMovement.deleteMany({});

    userId = new mongoose.Types.ObjectId();

    // Register supplier
    const sup = await Supplier.create({
      name: 'Organic Farm Seeds LLC',
      code: 'OFS-VEND',
      contactPerson: 'David Seed',
      email: 'david@farmseeds.com',
      phone: '+1-555-555-5555',
      address: '101 Farm Rd, Austin TX',
      paymentTerms: 'NET 30',
      creditLimit: 20000,
    });
    supplierId = sup._id as mongoose.Types.ObjectId;

    // Create product
    const prod = await Product.create({
      sku: 'SKU-SEED-1',
      name: 'Organic Wheat Seed Bag 20kg',
      category: 'Agriculture',
      costPrice: 15.0,
      sellingPrice: 35.0,
      price: 35.0,
      cost: 15.0,
      quantity: 50,
      lowStockAlert: 10,
    });
    productId = prod._id.toString();
  });

  afterAll(async () => {
    await Product.deleteMany({});
    await Supplier.deleteMany({});
    await PurchaseRequisition.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await GoodsReceipt.deleteMany({});
    await SupplierInvoice.deleteMany({});
    await StockMovement.deleteMany({});
    await mongoose.connection.close();
  });

  it('should process requisitions approval states', async () => {
    const pr = await PurchaseRequisition.create({
      requisitionNumber: 'REQ-TEST-001',
      requestedBy: userId,
      items: [{ productId, quantity: 10, estimatedCost: 15.0 }],
      status: 'PENDING_APPROVAL',
    });

    expect(pr.status).toBe('PENDING_APPROVAL');

    pr.status = 'APPROVED';
    pr.approvedBy = userId;
    await pr.save();

    const updated = await PurchaseRequisition.findById(pr._id);
    expect(updated!.status).toBe('APPROVED');
  });

  it('should process PO and execute partial receiving logistics', async () => {
    // Issue Purchase Order
    const po = await PurchaseOrder.create({
      poNumber: 'PO-TEST-001',
      supplierId,
      items: [{ productId, quantity: 40, costPrice: 15.0, receivedQuantity: 0 }],
      totalAmount: 600.0,
      status: 'APPROVED',
      approvedBy: userId,
    });

    expect(po.status).toBe('APPROVED');

    // Partial Goods Receipt (Receive 15 out of 40)
    const grnNumber = 'GRN-TEST-001';
    const poItem = po.items[0];
    poItem.receivedQuantity += 15;

    // Increments product stock (50 -> 65)
    const product = await Product.findById(productId);
    product!.quantity += 15;
    await product!.save();

    await StockMovement.create({
      productId,
      type: 'PURCHASE',
      quantity: 15,
      costPrice: poItem.costPrice,
      sellingPrice: product!.sellingPrice,
      referenceId: grnNumber,
      userId,
    });

    po.status = 'PARTIALLY_RECEIVED';
    await po.save();

    const updatedPo = await PurchaseOrder.findById(po._id);
    expect(updatedPo!.status).toBe('PARTIALLY_RECEIVED');
    expect(updatedPo!.items[0].receivedQuantity).toBe(15);

    const updatedProduct = await Product.findById(productId);
    expect(updatedProduct!.quantity).toBe(65);

    const moves = await StockMovement.find({ referenceId: grnNumber });
    expect(moves.length).toBe(1);
    expect(moves[0].quantity).toBe(15);
  });

  it('should register accounts payable invoice matches and complete payments', async () => {
    const po = await PurchaseOrder.findOne({ poNumber: 'PO-TEST-001' });

    const invoice = await SupplierInvoice.create({
      invoiceNumber: 'INV-TEST-001',
      poId: po!._id,
      supplierId,
      amount: 600.0,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'UNPAID',
    });

    expect(invoice.status).toBe('UNPAID');

    invoice.status = 'PAID';
    await invoice.save();

    const updatedInvoice = await SupplierInvoice.findById(invoice._id);
    expect(updatedInvoice!.status).toBe('PAID');
  });
});
