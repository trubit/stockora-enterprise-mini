import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product, type IProductVariant } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { StockMovement } from '../models/StockMovement.js';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { InventoryController } from '../controllers/inventory.controller.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SYSTEM_ROLES } from '../../shared/constants.js';

describe('Inventory Stock Correction & Adjustment Enterprise E2E Test Suite', () => {
  const tenantAObj = new mongoose.Types.ObjectId();
  const tenantBObj = new mongoose.Types.ObjectId();
  const tenantA = tenantAObj.toString();
  const tenantB = tenantBObj.toString();

  let userAdminA: any;
  let userCashierA: any;
  let userAdminB: any;

  let warehouseA: any;
  let warehouseB: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_adjustments');
    }

    // Clean test state
    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Warehouse.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await StockAdjustment.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await StockMovement.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await User.deleteMany({
      email: { $in: ['adminA@test.com', 'cashierA@test.com', 'adminB@test.com'] },
    });

    // Create test users
    userAdminA = await User.create({
      username: 'adminA',
      email: 'adminA@test.com',
      password: 'HashPassword123!',
      roleName: SYSTEM_ROLES.SUPER_ADMIN,
      tenantId: tenantA,
      isActive: true,
    });

    userCashierA = await User.create({
      username: 'cashierA',
      email: 'cashierA@test.com',
      password: 'HashPassword123!',
      roleName: SYSTEM_ROLES.CASHIER,
      tenantId: tenantA,
      isActive: true,
    });

    userAdminB = await User.create({
      username: 'adminB',
      email: 'adminB@test.com',
      password: 'HashPassword123!',
      roleName: SYSTEM_ROLES.SUPER_ADMIN,
      tenantId: tenantB,
      isActive: true,
    });

    // Create test warehouses
    warehouseA = await Warehouse.create({
      name: 'Austin Warehouse A',
      code: 'WH-AUS-A',
      tenantId: tenantA,
      branchId: new mongoose.Types.ObjectId(),
      companyId: new mongoose.Types.ObjectId(),
    });

    warehouseB = await Warehouse.create({
      name: 'Dallas Warehouse B',
      code: 'WH-DAL-B',
      tenantId: tenantB,
      branchId: new mongoose.Types.ObjectId(),
      companyId: new mongoose.Types.ObjectId(),
    });
  });

  afterAll(async () => {
    await Product.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await Warehouse.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await StockAdjustment.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await StockMovement.deleteMany({ tenantId: { $in: [tenantA, tenantB] } });
    await User.deleteMany({
      email: { $in: ['adminA@test.com', 'cashierA@test.com', 'adminB@test.com'] },
    });
  });

  // Helper to invoke InventoryController.adjustStock directly with mocked req/res
  async function invokeAdjustStock(reqData: {
    user: any;
    tenantId: string;
    body: Record<string, any>;
  }): Promise<{ status: number; body: any; error?: any }> {
    return new Promise((resolve) => {
      let status = 200;
      const res: any = {
        status: (code: number) => {
          status = code;
          return res;
        },
        json: (data: any) => {
          resolve({ status, body: data });
        },
      };

      const req: any = {
        user: {
          id: reqData.user._id?.toString() || reqData.user.id,
          roleName: reqData.user.roleName,
          tenantId: reqData.tenantId,
        },
        tenantId: reqData.tenantId,
        body: reqData.body,
      };

      const next = (err?: any) => {
        if (err) {
          resolve({
            status: err.statusCode || 500,
            body: { error: { message: err.message, code: err.code } },
            error: err,
          });
        }
      };

      InventoryController.adjustStock(req as AuthenticatedRequest, res, next);
    });
  }

  // Helper to invoke InventoryController.getAdjustments
  async function invokeGetAdjustments(reqData: {
    user: any;
    tenantId: string;
    query?: Record<string, any>;
  }): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      let status = 200;
      const res: any = {
        status: (code: number) => {
          status = code;
          return res;
        },
        json: (data: any) => {
          resolve({ status, body: data });
        },
      };

      const req: any = {
        user: {
          id: reqData.user._id?.toString(),
          roleName: reqData.user.roleName,
          tenantId: reqData.tenantId,
        },
        tenantId: reqData.tenantId,
        query: reqData.query || {},
      };

      const next = (err?: any) => {
        if (err) {
          resolve({ status: err.statusCode || 500, body: { error: err.message } });
        }
      };

      InventoryController.getAdjustments(req as AuthenticatedRequest, res, next);
    });
  }

  // =========================================================================
  // TEST 1: Mandatory Core Scenario (100 -> +200 Mistaken -> 300 -> -200 -> 100)
  // =========================================================================
  it('MANDATORY TEST: 100 Initial -> Mistaken +200 (300) -> Correct back to 100 (-200)', async () => {
    // 1. Initial product with 100 stock
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Fresh Red Apple',
      sku: 'SKU-APPLE-MANDATORY-1',
      category: 'Produce',
      costPrice: 1.0,
      sellingPrice: 2.0,
      price: 2.0,
      cost: 1.0,
      quantity: 100,
      lowStockAlert: 10,
    });

    // 2. Simulate mistaken entry: user accidentally added +200 -> stock becomes 300
    product.quantity = 300;
    await product.save();

    let fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(300);

    // 3. User realizes mistake and applies correction to restore authoritative stock to 100
    // Using MODE 2 (Set Correct Quantity = 100)
    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'SET_QUANTITY',
        targetQuantity: 100,
        reason: 'Incorrect stock entry',
        notes: 'Correcting mistaken +200 entry',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.previousQuantity).toBe(300);
    expect(res.body.adjustmentDelta).toBe(-200);
    expect(res.body.newQuantity).toBe(100);

    // 4. Assert product in database is authoritative 100
    fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(100);

    // 5. Assert StockAdjustment record created
    const adj = await StockAdjustment.findOne({ productId: product._id });
    expect(adj).toBeDefined();
    expect(adj?.previousQuantity).toBe(300);
    expect(adj?.quantityDelta).toBe(-200);
    expect(adj?.newQuantity).toBe(100);
    expect(adj?.reason).toBe('Incorrect stock entry');
    expect(adj?.tenantId).toBe(tenantA);

    // 6. Assert StockMovement record created
    const movement = await StockMovement.findOne({ productId: product._id, type: 'ADJUSTMENT' });
    expect(movement).toBeDefined();
    expect(movement?.quantity).toBe(-200);
    expect(movement?.tenantId).toBe(tenantA);
  });

  // =========================================================================
  // TEST 2: Exact Example (Expected: 100, Mistaken: 200, Correction: -100, Final: 100)
  // =========================================================================
  it('MANDATORY TEST 2: Current 200 -> Correction -100 -> Final 100', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Green Apple',
      sku: 'SKU-APPLE-EXACT-2',
      category: 'Produce',
      costPrice: 1.5,
      sellingPrice: 3.0,
      price: 3.0,
      cost: 1.5,
      quantity: 200,
      lowStockAlert: 10,
    });

    // Apply Relative adjustment: -100
    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -100,
        reason: 'Incorrect stock entry',
        warehouseId: warehouseA._id.toString(),
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(200);
    expect(res.body.adjustmentDelta).toBe(-100);
    expect(res.body.newQuantity).toBe(100);

    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(100);
  });

  // =========================================================================
  // TEST 3: Relative Stock Increase (+50)
  // =========================================================================
  it('supports positive stock adjustment (ADD / RELATIVE +50)', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Orange Valencia',
      sku: 'SKU-ORANGE-1',
      category: 'Produce',
      costPrice: 0.8,
      sellingPrice: 1.8,
      price: 1.8,
      cost: 0.8,
      quantity: 50,
      lowStockAlert: 10,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'ADD',
        quantity: 50,
        reason: 'Found goods',
        notes: 'Found in storage aisle 3',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(50);
    expect(res.body.adjustmentDelta).toBe(50);
    expect(res.body.newQuantity).toBe(100);

    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(100);
  });

  // =========================================================================
  // TEST 4: Relative Stock Decrease (REMOVE)
  // =========================================================================
  it('supports negative stock adjustment (REMOVE)', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Banana Cluster',
      sku: 'SKU-BANANA-1',
      category: 'Produce',
      costPrice: 0.5,
      sellingPrice: 1.2,
      price: 1.2,
      cost: 0.5,
      quantity: 80,
      lowStockAlert: 10,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'REMOVE',
        quantity: 30,
        reason: 'Damaged goods',
        notes: 'Spoiled during transit',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(80);
    expect(res.body.adjustmentDelta).toBe(-30);
    expect(res.body.newQuantity).toBe(50);

    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(50);
    expect(fresh?.damagedQuantity).toBe(30);
  });

  // =========================================================================
  // TEST 5: Reason Validation Rules
  // =========================================================================
  it('rejects missing reason with 400', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Mango Keitt',
      sku: 'SKU-MANGO-1',
      category: 'Produce',
      costPrice: 2.0,
      sellingPrice: 4.0,
      price: 4.0,
      cost: 2.0,
      quantity: 50,
      lowStockAlert: 5,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'ADD',
        quantity: 10,
        reason: '',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('valid adjustment reason is required');
  });

  it('rejects reason "Other" without explanatory note', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Pineapple Golden',
      sku: 'SKU-PINEAPPLE-1',
      category: 'Produce',
      costPrice: 3.0,
      sellingPrice: 6.0,
      price: 6.0,
      cost: 3.0,
      quantity: 40,
      lowStockAlert: 5,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'REMOVE',
        quantity: 5,
        reason: 'Other',
        notes: '', // missing note
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(
      'explanatory note of at least 3 characters is required'
    );
  });

  // =========================================================================
  // TEST 6: Zero Delta Rejection
  // =========================================================================
  it('rejects zero delta adjustments with 400', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Grapes Red Globe',
      sku: 'SKU-GRAPES-1',
      category: 'Produce',
      costPrice: 2.5,
      sellingPrice: 5.0,
      price: 5.0,
      cost: 2.5,
      quantity: 60,
      lowStockAlert: 10,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'SET_QUANTITY',
        targetQuantity: 60, // same as current
        reason: 'Counting error',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Adjustment delta is zero');
  });

  // =========================================================================
  // TEST 7: Negative Resulting Stock Prevention
  // =========================================================================
  it('rejects adjustment that would result in negative stock', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Avocado Hass',
      sku: 'SKU-AVOCADO-1',
      category: 'Produce',
      costPrice: 1.5,
      sellingPrice: 3.0,
      price: 3.0,
      cost: 1.5,
      quantity: 20,
      lowStockAlert: 5,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -50, // Would result in -30
        reason: 'Counting error',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('negative stock');

    // Verify stock remains untouched at 20
    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(20);
  });

  // =========================================================================
  // TEST 8: Decimal Quantity Support
  // =========================================================================
  it('supports precise decimal quantities (e.g. 10.5 kg - 2.5 kg = 8.0 kg)', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Bulk Basmati Rice',
      sku: 'SKU-RICE-KG-1',
      category: 'Grains',
      uom: 'kg',
      costPrice: 1.2,
      sellingPrice: 2.5,
      price: 2.5,
      cost: 1.2,
      quantity: 10.5,
      lowStockAlert: 2,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -2.5,
        reason: 'Counting error',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.newQuantity).toBe(8);

    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(8);
  });

  // =========================================================================
  // TEST 9: Product Variants Support
  // =========================================================================
  it('adjusts specific product variant quantity when variantSku is provided', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'T-Shirt Cotton',
      sku: 'SKU-TSHIRT-PARENT',
      category: 'Apparel',
      costPrice: 5.0,
      sellingPrice: 15.0,
      price: 15.0,
      cost: 5.0,
      quantity: 100,
      lowStockAlert: 10,
      variants: [
        {
          sku: 'TSHIRT-RED-S',
          name: 'Red Small',
          quantity: 40,
          attributes: [{ key: 'Size', value: 'S' }],
        },
        {
          sku: 'TSHIRT-BLUE-L',
          name: 'Blue Large',
          quantity: 60,
          attributes: [{ key: 'Size', value: 'L' }],
        },
      ],
    });

    // Adjust only variant TSHIRT-RED-S by -10
    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        variantSku: 'TSHIRT-RED-S',
        type: 'RELATIVE',
        quantityDelta: -10,
        reason: 'Counting error',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(40);
    expect(res.body.newQuantity).toBe(30);

    const fresh = await Product.findById(product._id);
    const redVariant = fresh?.variants.find((v: IProductVariant) => v.sku === 'TSHIRT-RED-S');
    const blueVariant = fresh?.variants.find((v: IProductVariant) => v.sku === 'TSHIRT-BLUE-L');

    expect(redVariant?.quantity).toBe(30);
    expect(blueVariant?.quantity).toBe(60); // Blue remains untouched
    expect(fresh?.quantity).toBe(90); // Parent total updated
  });

  // =========================================================================
  // TEST 10: Multi-Tenant Isolation (CRITICAL MANDATORY TEST)
  // =========================================================================
  it('MULTI-TENANT ISOLATION: Company A cannot adjust Company B stock', async () => {
    // 1. Company A product = 100 Apple
    const prodA = await Product.create({
      tenantId: tenantA,
      name: 'Company A Apple',
      sku: 'SKU-APPLE-CO-A',
      category: 'Produce',
      costPrice: 1.0,
      sellingPrice: 2.0,
      price: 2.0,
      cost: 1.0,
      quantity: 100,
      lowStockAlert: 10,
    });

    // 2. Company B product = 500 Apple
    const prodB = await Product.create({
      tenantId: tenantB,
      name: 'Company B Apple',
      sku: 'SKU-APPLE-CO-B',
      category: 'Produce',
      costPrice: 1.0,
      sellingPrice: 2.0,
      price: 2.0,
      cost: 1.0,
      quantity: 500,
      lowStockAlert: 10,
    });

    // 3. Adjust Company A from 100 to 80
    const resA = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: prodA._id.toString(),
        type: 'SET_QUANTITY',
        targetQuantity: 80,
        reason: 'Data correction',
      },
    });

    expect(resA.status).toBe(201);
    expect(resA.body.newQuantity).toBe(80);

    // 4. Assert Company A is 80, and Company B remains 500
    const freshA = await Product.findById(prodA._id);
    const freshB = await Product.findById(prodB._id);
    expect(freshA?.quantity).toBe(80);
    expect(freshB?.quantity).toBe(500);

    // 5. ATTEMPT: Use Company A credentials to modify Company B's product
    const crossTenantAttempt = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA, // User A is in Tenant A
      body: {
        productId: prodB._id.toString(), // Target is Tenant B's product!
        type: 'RELATIVE',
        quantityDelta: -200,
        reason: 'Data correction',
      },
    });

    // 6. ASSERT: Request REJECTED with 404 (Not found or access denied for this tenant)
    expect(crossTenantAttempt.status).toBe(404);
    expect(crossTenantAttempt.body.error.message).toContain('Product not found or access denied');

    // 7. Verify Company B's stock MUST remain 500!
    const stillB = await Product.findById(prodB._id);
    expect(stillB?.quantity).toBe(500);
  });

  // =========================================================================
  // TEST 11: Idempotency Protection (Double-Submit Prevention)
  // =========================================================================
  it('IDEMPOTENCY: Duplicate submission with same idempotencyKey returns existing result without double-deduction', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Idempotent Item',
      sku: 'SKU-IDEMPOTENT-1',
      category: 'General',
      costPrice: 10,
      sellingPrice: 20,
      price: 20,
      cost: 10,
      quantity: 100,
      lowStockAlert: 10,
    });

    const idempotencyKey = 'IDEM-KEY-UNIQUE-12345';

    // First submission: -20
    const res1 = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -20,
        reason: 'Counting error',
        idempotencyKey,
      },
    });

    expect(res1.status).toBe(201);
    expect(res1.body.newQuantity).toBe(80);

    // Second submission with SAME idempotencyKey
    const res2 = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -20,
        reason: 'Counting error',
        idempotencyKey,
      },
    });

    expect(res2.status).toBe(200);
    expect(res2.body.idempotent).toBe(true);

    // Stock must be 80, NOT 60!
    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(80);
  });

  // =========================================================================
  // TEST 12: Tenant-Isolated Adjustment History Query
  // =========================================================================
  it('GET /inventory/adjustments returns only active tenant records', async () => {
    const listResA = await invokeGetAdjustments({
      user: userAdminA,
      tenantId: tenantA,
    });

    expect(listResA.status).toBe(200);
    expect(Array.isArray(listResA.body)).toBe(true);

    // Every record returned must belong strictly to tenantA
    for (const record of listResA.body) {
      expect(record.tenantId).toBe(tenantA);
    }
  });

  // =========================================================================
  // TEST 13: Concurrent Adjustments Safety (No Lost Updates)
  // =========================================================================
  it('CONCURRENCY: Multiple simultaneous adjustments update atomically without lost updates', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Concurrent Item',
      sku: 'SKU-CONCURRENT-1',
      category: 'General',
      costPrice: 5,
      sellingPrice: 10,
      price: 10,
      cost: 5,
      quantity: 500,
      lowStockAlert: 10,
    });

    // Fire 5 concurrent adjustments of -20 each
    const promises = Array.from({ length: 5 }).map((_, i) =>
      invokeAdjustStock({
        user: userAdminA,
        tenantId: tenantA,
        body: {
          productId: product._id.toString(),
          type: 'RELATIVE',
          quantityDelta: -20,
          reason: 'Counting error',
          notes: `Concurrent worker ${i}`,
        },
      })
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      expect(r.status).toBe(201);
    }

    // 500 - (5 * 20) = 400
    const fresh = await Product.findById(product._id);
    expect(fresh?.quantity).toBe(400);

    // Assert 5 separate StockAdjustment and StockMovement records exist
    const adjCount = await StockAdjustment.countDocuments({ productId: product._id });
    expect(adjCount).toBe(5);
    const movCount = await StockMovement.countDocuments({
      productId: product._id,
      type: 'ADJUSTMENT',
    });
    expect(movCount).toBe(5);
  });

  // =========================================================================
  // TEST 14: POS & Purchase Ledger Integrity
  // =========================================================================
  it('INTEGRITY: Stock adjustments preserve historical transactions without altering sales or POs', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Integrity Fruit',
      sku: 'SKU-INTEGRITY-1',
      category: 'Produce',
      costPrice: 2,
      sellingPrice: 5,
      price: 5,
      cost: 2,
      quantity: 100,
      lowStockAlert: 10,
    });

    // Create a simulated historical Goods Receipt movement
    const purchaseMovement = await StockMovement.create({
      tenantId: tenantA,
      productId: product._id,
      type: 'PURCHASE',
      quantity: 100,
      costPrice: 2,
      sellingPrice: 5,
      referenceId: 'GRN-HISTORIC-999',
      notes: 'Initial purchase receiving',
    });

    // Create a simulated completed POS sale movement
    const saleMovement = await StockMovement.create({
      tenantId: tenantA,
      productId: product._id,
      type: 'SALE',
      quantity: -5,
      costPrice: 2,
      sellingPrice: 5,
      referenceId: 'TX-POS-HISTORIC-101',
      notes: 'POS Register Sale',
    });

    // Current stock was 100 - 5 = 95
    product.quantity = 95;
    await product.save();

    // Now apply a stock adjustment to correct an entry mistake (-15)
    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -15,
        reason: 'Incorrect stock entry',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.newQuantity).toBe(80);

    // CRITICAL ASSERTION:
    // Historical purchase movement and POS sale movement MUST remain completely intact and untouched!
    const verifiedPurchase = await StockMovement.findById(purchaseMovement._id);
    expect(verifiedPurchase?.quantity).toBe(100);
    expect(verifiedPurchase?.type).toBe('PURCHASE');

    const verifiedSale = await StockMovement.findById(saleMovement._id);
    expect(verifiedSale?.quantity).toBe(-5);
    expect(verifiedSale?.type).toBe('SALE');

    // And the adjustment movement exists as its own independent audit record
    const adjMovement = await StockMovement.findOne({
      productId: product._id,
      type: 'ADJUSTMENT',
    });
    expect(adjMovement?.quantity).toBe(-15);
  });

  // =========================================================================
  // TEST 15: Warehouse-Specific Stock Adjustments
  // =========================================================================
  it('WAREHOUSE ISOLATION: Warehouse adjustment properly records warehouse reference', async () => {
    const product = await Product.create({
      tenantId: tenantA,
      name: 'Warehouse Stocked Product',
      sku: 'SKU-WH-PROD-1',
      category: 'General',
      costPrice: 10,
      sellingPrice: 20,
      price: 20,
      cost: 10,
      quantity: 100,
      lowStockAlert: 10,
    });

    const res = await invokeAdjustStock({
      user: userAdminA,
      tenantId: tenantA,
      body: {
        productId: product._id.toString(),
        warehouseId: warehouseA._id.toString(),
        type: 'RELATIVE',
        quantityDelta: -25,
        reason: 'Warehouse correction',
      },
    });

    expect(res.status).toBe(201);

    const adj = await StockAdjustment.findById(res.body.adjustment._id);
    expect(adj?.warehouseId?.toString()).toBe(warehouseA._id.toString());
    expect(adj?.reason).toBe('Warehouse correction');

    const mov = await StockMovement.findById(res.body.movement._id);
    expect(mov?.warehouseId?.toString()).toBe(warehouseA._id.toString());
  });
});
