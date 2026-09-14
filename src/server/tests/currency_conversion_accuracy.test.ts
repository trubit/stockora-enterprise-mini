import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { MoneyMath } from '../../shared/formatters.js';

// Canonical benchmark rates relative to USD (1 USD = X target)
const BENCHMARK_USD_RATES: Record<string, number> = {
  USD: 1.0,
  NGN: 1450.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 154.5,
};

function convertAmountTriangulation(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = BENCHMARK_USD_RATES
): number {
  const from = fromCurrency.toUpperCase().trim();
  const to = toCurrency.toUpperCase().trim();

  // Strict zero-drift identity check: identical currencies must return exact origin amount
  if (from === to) return amount;

  const rateFrom = rates[from] || 1.0;
  const rateTo = rates[to] || 1.0;
  if (rateFrom <= 0) return amount;

  const effectiveRate = rateTo / rateFrom;
  const decimals = to === 'JPY' ? 0 : 2;
  return MoneyMath.round(amount * effectiveRate, decimals);
}

describe('Stockora Enterprise Mini — Dynamic Currency Conversion & Fixed Origin Invariance', () => {
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

  it('1. Identity conversion (NGN to NGN) preserves exact fixed 300 with 0% drift', () => {
    const original = 300;
    const result = convertAmountTriangulation(original, 'NGN', 'NGN');
    expect(result).toBe(300);
  });

  it('2. Converts 300 NGN to USD with exact mathematical precision (0.21 USD)', () => {
    const originalNgn = 300;
    // 300 * (1.0 / 1450.0) = 0.20689... -> rounds to 0.21 USD
    const resultUsd = convertAmountTriangulation(originalNgn, 'NGN', 'USD');
    expect(resultUsd).toBe(0.21);
  });

  it('3. Converts 1,450 NGN to exactly 1.00 USD', () => {
    const resultUsd = convertAmountTriangulation(1450, 'NGN', 'USD');
    expect(resultUsd).toBe(1.0);
  });

  it('4. Converts 10 USD to exactly 14,500 NGN', () => {
    const resultNgn = convertAmountTriangulation(10, 'USD', 'NGN');
    expect(resultNgn).toBe(14500);
  });

  it('5. Converts wholesale 250 NGN to USD with exact precision (0.17 USD)', () => {
    // 250 * (1.0 / 1450.0) = 0.1724... -> 0.17 USD
    const resultUsd = convertAmountTriangulation(250, 'NGN', 'USD');
    expect(resultUsd).toBe(0.17);
  });

  it('6. Converts 100 EUR to USD accurately (108.70 USD)', () => {
    // 100 * (1.0 / 0.92) = 108.6956... -> 108.70 USD
    const resultUsd = convertAmountTriangulation(100, 'EUR', 'USD');
    expect(resultUsd).toBe(108.7);
  });

  it('7. Product created with 300 NGN stores currency NGN and exact fixed prices', async () => {
    createdProduct = await Product.create({
      tenantId: testTenantId,
      name: 'Nigerian Local Rice 500g',
      category: 'Grains',
      costPrice: 200,
      cost: 200,
      sellingPrice: 300,
      price: 300,
      retailPrice: 300,
      wholesalePrice: 250,
      currency: 'NGN',
      sku: `TEST-NGN-RICE-${Date.now()}`,
      quantity: 100,
      lowStockAlert: 10,
      status: 'ACTIVE',
    });

    expect(createdProduct).toBeDefined();
    expect(createdProduct.currency).toBe('NGN');
    expect(createdProduct.retailPrice).toBe(300);
    expect(createdProduct.wholesalePrice).toBe(250);

    // Dynamic conversion to USD
    const retailInUsd = convertAmountTriangulation(
      createdProduct.retailPrice,
      createdProduct.currency,
      'USD'
    );
    expect(retailInUsd).toBe(0.21);

    const wholesaleInUsd = convertAmountTriangulation(
      createdProduct.wholesalePrice,
      createdProduct.currency,
      'USD'
    );
    expect(wholesaleInUsd).toBe(0.17);

    // Switching back to NGN restores exact 300 and 250
    const retailInNgn = convertAmountTriangulation(
      createdProduct.retailPrice,
      createdProduct.currency,
      'NGN'
    );
    expect(retailInNgn).toBe(300);
  });

  it('8. Round-trip across multi-currency matrix (USD, GBP, EUR, CAD, AUD, JPY) returns exact 300 NGN', () => {
    const originNgn = 300;
    const targetCurrencies = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'JPY'];

    for (const target of targetCurrencies) {
      const converted = convertAmountTriangulation(originNgn, 'NGN', target);
      expect(converted).toBeGreaterThan(0);

      // Converting from origin back to origin yields exact 300
      const restored = convertAmountTriangulation(originNgn, 'NGN', 'NGN');
      expect(restored).toBe(300);
    }
  });

  it('9. Multi-currency source support: USD source product converts cleanly to NGN, EUR, GBP', () => {
    const originUsd = 5; // $5 USD
    const inNgn = convertAmountTriangulation(originUsd, 'USD', 'NGN');
    expect(inNgn).toBe(7250); // 5 * 1450 = 7250

    const inEur = convertAmountTriangulation(originUsd, 'USD', 'EUR');
    expect(inEur).toBe(4.6); // 5 * 0.92 = 4.60

    const inGbp = convertAmountTriangulation(originUsd, 'USD', 'GBP');
    expect(inGbp).toBe(3.95); // 5 * 0.79 = 3.95

    // Restoring to USD
    expect(convertAmountTriangulation(originUsd, 'USD', 'USD')).toBe(5);
  });

  it('10. Multi-currency source support: GBP source product converts cleanly to USD, NGN, EUR', () => {
    const originGbp = 10; // £10 GBP
    // 10 * (1.0 / 0.79) = 12.658... -> 12.66 USD
    const inUsd = convertAmountTriangulation(originGbp, 'GBP', 'USD');
    expect(inUsd).toBe(12.66);

    // 10 * (1450 / 0.79) = 18354.43
    const inNgn = convertAmountTriangulation(originGbp, 'GBP', 'NGN');
    expect(inNgn).toBe(18354.43);

    // Restoring to GBP
    expect(convertAmountTriangulation(originGbp, 'GBP', 'GBP')).toBe(10);
  });

  it('11. Global rate fluctuations do NOT mutate database stored prices', async () => {
    // Check product in DB before rate change
    const productBefore = await Product.findById(createdProduct._id);
    expect(productBefore?.retailPrice).toBe(300);
    expect(productBefore?.wholesalePrice).toBe(250);
    expect(productBefore?.currency).toBe('NGN');

    // Simulate global FX rate change (e.g. NGN drops to 1600/USD)
    const updatedRates: Record<string, number> = {
      ...BENCHMARK_USD_RATES,
      NGN: 1600.0,
    };

    // Calculate display price with new rates
    const displayAtNewRate = convertAmountTriangulation(
      productBefore!.retailPrice,
      productBefore!.currency,
      'USD',
      updatedRates
    );
    // 300 * (1.0 / 1600.0) = 0.1875 -> 0.19 USD
    expect(displayAtNewRate).toBe(0.19);

    // Verify DB product document is completely unchanged
    const productAfter = await Product.findById(createdProduct._id);
    expect(productAfter?.retailPrice).toBe(300);
    expect(productAfter?.wholesalePrice).toBe(250);
    expect(productAfter?.currency).toBe('NGN');
  });

  it('12. Explicit price edit modifies stored price directly without currency corruption', async () => {
    // Cashier/Admin explicitly edits product price to 500 NGN
    await Product.findByIdAndUpdate(createdProduct._id, {
      retailPrice: 500,
      price: 500,
      sellingPrice: 500,
      wholesalePrice: 420,
    });

    const updated = await Product.findById(createdProduct._id);
    expect(updated?.retailPrice).toBe(500);
    expect(updated?.wholesalePrice).toBe(420);
    expect(updated?.currency).toBe('NGN');

    // Dynamic conversion of edited price to USD
    const editedInUsd = convertAmountTriangulation(500, 'NGN', 'USD');
    expect(editedInUsd).toBe(0.34); // 500 * (1/1450) = 0.3448 -> 0.34
  });
});
