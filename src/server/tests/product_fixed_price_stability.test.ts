import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { POSService } from '../services/pos.service.js';

describe('Stockora Enterprise Mini — Product Fixed Price Stability & Invariance', () => {
  const testTenantId = new mongoose.Types.ObjectId().toString();
  let createdProduct: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_mini_database'
      );
    }
  });

  afterAll(async () => {
    if (createdProduct?._id) {
      await Product.findByIdAndDelete(createdProduct._id);
    }
    await mongoose.disconnect();
  });

  it('1. Persists exact fixed price 300 without mutating to 305 or any drifted value', async () => {
    // Simulate raw user input of 300 retail price and 260 wholesale price
    const rawInputRetail = 300;
    const rawInputWholesale = 260;
    const rawInputCost = 150;

    createdProduct = await Product.create({
      tenantId: testTenantId,
      name: 'Stable Fixed Price Widget',
      category: 'Electronics',
      costPrice: rawInputCost,
      cost: rawInputCost,
      sellingPrice: rawInputRetail,
      price: rawInputRetail,
      retailPrice: rawInputRetail,
      wholesalePrice: rawInputWholesale,
      currency: 'NGN',
      sku: `STABLE-WDG-${Date.now()}`,
      quantity: 50,
      lowStockAlert: 5,
      status: 'ACTIVE',
    });

    expect(createdProduct).toBeDefined();
    // Verify retailPrice is strictly 300, not 305
    expect(createdProduct.retailPrice).toBe(300);
    expect(createdProduct.sellingPrice).toBe(300);
    expect(createdProduct.price).toBe(300);

    // Verify wholesalePrice is strictly 260
    expect(createdProduct.wholesalePrice).toBe(260);

    // Verify costPrice is strictly 150
    expect(createdProduct.costPrice).toBe(150);
  });

  it('2. Fetching stored product from database yields exact 300 and 260', async () => {
    const fetched = await Product.findById(createdProduct._id).lean();
    expect(fetched).toBeDefined();
    expect((fetched as any).retailPrice).toBe(300);
    expect((fetched as any).sellingPrice).toBe(300);
    expect((fetched as any).price).toBe(300);
    expect((fetched as any).wholesalePrice).toBe(260);
    // Explicitly assert it never drifted to 305
    expect((fetched as any).retailPrice).not.toBe(305);
    expect((fetched as any).sellingPrice).not.toBe(305);
  });

  it('3. POS calculation in RETAIL mode charges exact fixed 300 per unit with 0 tax and 0 fee', () => {
    const cart = [{ unitPrice: createdProduct.retailPrice, quantity: 1, discount: 0 }];
    const calc = POSService.calculateCart(cart, 0, 0);

    expect(calc.subtotal).toBe(300);
    expect(calc.taxTotal).toBe(0);
    expect(calc.discountTotal).toBe(0);
    expect(calc.grandTotal).toBe(300);
    expect(calc.grandTotal).not.toBe(305);
  });

  it('4. POS calculation in WHOLESALE mode charges exact fixed 260 per unit with 0 tax and 0 fee', () => {
    const cart = [{ unitPrice: createdProduct.wholesalePrice, quantity: 2, discount: 0 }];
    const calc = POSService.calculateCart(cart, 0, 0);

    expect(calc.subtotal).toBe(520);
    expect(calc.taxTotal).toBe(0);
    expect(calc.grandTotal).toBe(520);
  });

  it('5. Updating product fixed price preserves exact value without drift', async () => {
    const updated = await Product.findByIdAndUpdate(
      createdProduct._id,
      {
        $set: {
          retailPrice: 350,
          sellingPrice: 350,
          price: 350,
          wholesalePrice: 310,
        },
      },
      { new: true }
    ).lean();

    expect(updated).toBeDefined();
    expect((updated as any).retailPrice).toBe(350);
    expect((updated as any).sellingPrice).toBe(350);
    expect((updated as any).price).toBe(350);
    expect((updated as any).wholesalePrice).toBe(310);
  });
});
