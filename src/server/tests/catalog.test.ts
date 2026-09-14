import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Supplier } from '../models/Supplier.js';
import { Customer } from '../models/Customer.js';

describe('Product Catalog, Suppliers & Customers Integration', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_catalog');
    }
    await Product.deleteMany({ sku: { $in: ['SKU-TEST-VAR-1', 'SKU-TEST-VAR-1-XL'] } });
    await Supplier.deleteMany({ code: 'GPD-VEND' });
    await Customer.deleteMany({ code: 'CUST-SARAH' });
  });

  afterAll(async () => {
    await Product.deleteMany({ sku: { $in: ['SKU-TEST-VAR-1', 'SKU-TEST-VAR-1-XL'] } });
    await Supplier.deleteMany({ code: 'GPD-VEND' });
    await Customer.deleteMany({ code: 'CUST-SARAH' });
  });

  it('should create products with attributes and variants', async () => {
    const product = await Product.create({
      sku: 'SKU-TEST-VAR-1',
      name: 'Organic Honey 500g',
      category: 'Pantry',
      costPrice: 5.5,
      sellingPrice: 12.0,
      price: 12.0,
      cost: 5.5,
      quantity: 100,
      lowStockAlert: 10,
      brand: 'HoneyGold',
      variants: [
        {
          sku: 'SKU-TEST-VAR-1-XL',
          name: 'Organic Honey 1kg',
          price: 22.0,
          quantity: 20,
          attributes: [{ key: 'Size', value: '1kg' }],
        },
      ],
      attributes: [{ key: 'Organic', value: 'Yes' }],
    });

    expect(product.name).toBe('Organic Honey 500g');
    expect(product.sku).toBe('SKU-TEST-VAR-1');
    expect(product.variants.length).toBe(1);
    expect(product.variants[0].name).toBe('Organic Honey 1kg');
    expect(product.attributes[0].key).toBe('Organic');
  });

  it('should register suppliers with payment terms and credit limits', async () => {
    const supplier = await Supplier.create({
      name: 'Global Pantry Distributors',
      code: 'GPD-VEND',
      contactPerson: 'Alex Jones',
      email: 'alex@globalpantry.com',
      phone: '+1-555-987-6543',
      address: '789 Logistics Blvd, Dallas TX',
      paymentTerms: 'NET 45',
      creditLimit: 50000,
      rating: 5,
    });

    expect(supplier.name).toBe('Global Pantry Distributors');
    expect(supplier.code).toBe('GPD-VEND');
    expect(supplier.paymentTerms).toBe('NET 45');
    expect(supplier.creditLimit).toBe(50000);
  });

  it('should register customers with loyalty points and VIP groupings', async () => {
    const customer = await Customer.create({
      name: 'Sarah Smith',
      code: 'CUST-SARAH',
      email: 'sarah.smith@example.com',
      phone: '+1-555-123-4567',
      group: 'VIP',
      creditLimit: 1000,
      loyaltyPoints: 350,
      billingAddress: '456 Elm St, New York NY',
      shippingAddress: '456 Elm St, New York NY',
    });

    expect(customer.name).toBe('Sarah Smith');
    expect(customer.group).toBe('VIP');
    expect(customer.loyaltyPoints).toBe(350);
  });
});
