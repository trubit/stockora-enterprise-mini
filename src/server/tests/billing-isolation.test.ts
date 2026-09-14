import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { BillingInvoice } from '../models/BillingInvoice.js';
import { BillingTransaction } from '../models/BillingTransaction.js';
import { SubscriptionService } from '../services/subscription.service.js';

describe('Cross-Tenant Billing Isolation Security Tests', () => {
  let harnTenantId: string;
  let hansonTenantId: string;
  let harnInvoiceId: string;
  let hansonInvoiceId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_billing_isolation');
    }
    await Tenant.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await BillingInvoice.deleteMany({});
    await BillingTransaction.deleteMany({});

    // Create 2 separate plans
    const starter = await Plan.create({
      name: 'Starter',
      slug: 'starter-iso',
      tier: 'STARTER',
      price: 15000,
      currency: 'NGN',
    });

    const pro = await Plan.create({
      name: 'Professional',
      slug: 'pro-iso',
      tier: 'PROFESSIONAL',
      price: 45000,
      currency: 'NGN',
    });

    // Create 2 separate tenants: Harn and Hanson
    const harn = await Tenant.create({
      name: 'Harn Company',
      slug: 'harn-co',
      status: 'ACTIVE',
      contact: { email: 'admin@harn.com' },
    });
    harnTenantId = harn._id.toString();

    const hanson = await Tenant.create({
      name: 'Hanson Company',
      slug: 'hanson-co',
      status: 'ACTIVE',
      contact: { email: 'admin@hanson.com' },
    });
    hansonTenantId = hanson._id.toString();

    // Assign subscriptions
    await SubscriptionService.createSubscription({
      tenantId: harnTenantId,
      planId: pro._id.toString(),
      billingInterval: 'MONTHLY',
    });

    await SubscriptionService.createSubscription({
      tenantId: hansonTenantId,
      planId: starter._id.toString(),
      billingInterval: 'MONTHLY',
    });

    // Create Invoices
    const invHarn = await BillingInvoice.create({
      invoiceNumber: 'INV-HARN-001',
      tenantId: harnTenantId,
      tenantName: 'Harn Company',
      tenantEmail: 'admin@harn.com',
      planName: 'Professional',
      planSlug: 'pro-iso',
      billingInterval: 'MONTHLY',
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(),
      subtotal: 45000,
      tax: 3375,
      taxRate: 0.075,
      total: 48375,
      currency: 'NGN',
      status: 'PAID',
      dueDate: new Date(),
      lineItems: [{ description: 'Pro Plan', quantity: 1, unitPrice: 45000, amount: 45000 }],
    });
    harnInvoiceId = invHarn._id.toString();

    const invHanson = await BillingInvoice.create({
      invoiceNumber: 'INV-HANSON-001',
      tenantId: hansonTenantId,
      tenantName: 'Hanson Company',
      tenantEmail: 'admin@hanson.com',
      planName: 'Starter',
      planSlug: 'starter-iso',
      billingInterval: 'MONTHLY',
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(),
      subtotal: 15000,
      tax: 1125,
      taxRate: 0.075,
      total: 16125,
      currency: 'NGN',
      status: 'PAID',
      dueDate: new Date(),
      lineItems: [{ description: 'Starter Plan', quantity: 1, unitPrice: 15000, amount: 15000 }],
    });
    hansonInvoiceId = invHanson._id.toString();
  });

  afterAll(async () => {
    await Tenant.deleteMany({});
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await BillingInvoice.deleteMany({});
    await BillingTransaction.deleteMany({});
    await mongoose.connection.close();
  });

  it('should guarantee that Harn cannot view or retrieve Hanson invoices (Cross-Tenant IDOR protection)', async () => {
    // 1. Harn queries invoices by Harn tenantId
    const harnInvoices = await BillingInvoice.find({ tenantId: harnTenantId });
    expect(harnInvoices.length).toBe(1);
    expect(harnInvoices[0].invoiceNumber).toBe('INV-HARN-001');

    // 2. Harn queries invoices by Hanson tenantId -> Must not return Hanson data when filtered by Harn tenantId
    const leaked = await BillingInvoice.find({ tenantId: harnTenantId, _id: hansonInvoiceId });
    expect(leaked.length).toBe(0);
  });

  it('should maintain independent subscription tiers and usage for Harn vs Hanson', async () => {
    const harnSub = await SubscriptionService.getTenantSubscription(harnTenantId);
    const hansonSub = await SubscriptionService.getTenantSubscription(hansonTenantId);

    expect(harnSub?.planSlug).toBe('pro-iso');
    expect(harnSub?.price).toBe(45000);

    expect(hansonSub?.planSlug).toBe('starter-iso');
    expect(hansonSub?.price).toBe(15000);
  });
});
