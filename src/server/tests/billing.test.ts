import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import axios from 'axios';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { BillingTransaction } from '../models/BillingTransaction.js';
import { BillingInvoice } from '../models/BillingInvoice.js';
import { Tenant } from '../models/Tenant.js';
import { BillingService } from '../services/billing.service.js';

vi.mock('axios');

describe('Billing Service & Invoice Unit Tests', () => {
  let tenantId: string;
  let plan: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_billing_svc');
    }
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await BillingTransaction.deleteMany({});
    await BillingInvoice.deleteMany({});
    await Tenant.deleteMany({});

    plan = await Plan.create({
      name: 'Professional Pro',
      slug: 'pro-billing-test',
      tier: 'PROFESSIONAL',
      price: 45000,
      yearlyDiscountPercent: 20,
      currency: 'NGN',
      status: 'ACTIVE',
      features: { pos: true, inventory: true, crm: true },
      limits: { users: { count: 20, unlimited: false } },
    });

    const tenant = await Tenant.create({
      name: 'Invoice Test Tenant',
      slug: 'inv-tenant',
      status: 'ACTIVE',
      contact: { email: 'billing@invtest.com' },
      taxConfig: { defaultTaxRate: 0.075 },
    });
    tenantId = tenant._id.toString();
  });

  afterAll(async () => {
    await Plan.deleteMany({});
    await Subscription.deleteMany({});
    await BillingTransaction.deleteMany({});
    await BillingInvoice.deleteMany({});
    await Tenant.deleteMany({});
    await mongoose.connection.close();
  });

  it('should initialize a Paystack payment with server-authoritative subtotal and VAT total', async () => {
    const mockAxiosResponse = {
      data: {
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/test-auth-44',
          reference: 'STK-SUB-TEST-1',
          access_code: 'access-code-44',
        },
      },
    };
    vi.mocked(axios.post).mockResolvedValueOnce(mockAxiosResponse);

    const init = await BillingService.initializeSubscriptionPayment({
      tenantId,
      planId: plan._id.toString(),
      billingInterval: 'MONTHLY',
      email: 'billing@invtest.com',
    });

    const expectedSubtotal = 45000;
    const expectedTax = 0;
    const expectedTotal = expectedSubtotal; // 45000 (0% tax)

    expect(init.subtotal).toBe(expectedSubtotal);
    expect(init.tax).toBe(expectedTax);
    expect(init.amount).toBe(expectedTotal);
    expect(init.currency).toBe('NGN');
    expect(init.reference).toBeDefined();

    // Pending BillingTransaction record created with financial fields
    const tx = await BillingTransaction.findOne({ providerReference: init.reference });
    expect(tx).toBeDefined();
    expect(tx?.status).toBe('PENDING');
    expect(tx?.subtotal).toBe(expectedSubtotal);
    expect(tx?.tax).toBe(expectedTax);
    expect(tx?.amount).toBe(expectedTotal);
  });

  it('should verify payment, activate subscription, and generate official SaaS invoice with amount matching gateway settlement', async () => {
    const reference = 'STK-VERIFY-1';
    const subtotal = 45000;
    const tax = 3375;
    const total = 48375;

    await BillingTransaction.create({
      tenantId,
      planId: plan._id,
      planSlug: plan.slug,
      subtotal,
      tax,
      taxRate: 0.075,
      amount: total,
      amountPaid: 0,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: reference,
      status: 'PENDING',
      type: 'SUBSCRIPTION_PAYMENT',
      metadata: { billingInterval: 'MONTHLY', subtotal, tax, taxRate: 0.075 },
    });

    // Mock Paystack verification response (48,375 NGN = 4,837,500 kobo)
    const mockVerifyResponse = {
      data: {
        status: true,
        data: {
          status: 'success',
          amount: 4837500, // in kobo
          currency: 'NGN',
          gateway_response: 'Successful',
          reference,
        },
      },
    };
    vi.mocked(axios.get).mockResolvedValueOnce(mockVerifyResponse);

    const result = await BillingService.verifyAndActivatePayment('PAYSTACK', reference, tenantId);

    expect(result.success).toBe(true);
    expect(result.subscription?.status).toBe('ACTIVE');
    expect(result.invoice?.invoiceNumber).toMatch(/^INV-SAAS-/);
    expect(result.invoice?.subtotal).toBe(subtotal);
    expect(result.invoice?.tax).toBe(tax);
    expect(result.invoice?.total).toBe(total);
    expect(result.invoice?.amountPaid).toBe(total);
    expect(result.invoice?.amountOutstanding).toBe(0);
    expect(result.invoice?.status).toBe('PAID');
    expect(result.invoice?.transactionReference).toBe(reference);
  });

  it('should prevent duplicate invoices when verified multiple times (Idempotency)', async () => {
    const reference = 'STK-VERIFY-1';

    // Second verification call for the same reference
    const result2 = await BillingService.verifyAndActivatePayment('PAYSTACK', reference, tenantId);

    expect(result2.success).toBe(true);
    expect(result2.invoice?.transactionReference).toBe(reference);

    // Total invoice count for this reference must remain strictly 1
    const invoiceCount = await BillingInvoice.countDocuments({ transactionReference: reference });
    expect(invoiceCount).toBe(1);
  });

  it('should handle failed payments safely without generating a paid invoice', async () => {
    const reference = 'STK-FAIL-1';
    await BillingTransaction.create({
      tenantId,
      planId: plan._id,
      planSlug: plan.slug,
      subtotal: 45000,
      tax: 3375,
      taxRate: 0.075,
      amount: 48375,
      currency: 'NGN',
      provider: 'PAYSTACK',
      providerReference: reference,
      status: 'PENDING',
      type: 'SUBSCRIPTION_PAYMENT',
      metadata: { billingInterval: 'MONTHLY' },
    });

    const mockFailedVerifyResponse = {
      data: {
        status: true,
        data: {
          status: 'failed',
          amount: 4837500,
          currency: 'NGN',
          gateway_response: 'Declined by bank',
          reference,
        },
      },
    };
    vi.mocked(axios.get).mockResolvedValueOnce(mockFailedVerifyResponse);

    const result = await BillingService.verifyAndActivatePayment('PAYSTACK', reference, tenantId);

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');

    // No invoice should exist
    const invoice = await BillingInvoice.findOne({ transactionReference: reference });
    expect(invoice).toBeNull();

    // Transaction status must be FAILED
    const tx = await BillingTransaction.findOne({ providerReference: reference });
    expect(tx?.status).toBe('FAILED');
  });
});
