import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { BillingService } from '../src/server/services/billing.service.js';
import { Plan } from '../src/server/models/Plan.js';
import { Tenant } from '../src/server/models/Tenant.js';
import { BillingInvoice } from '../src/server/models/BillingInvoice.js';
import { BillingTransaction } from '../src/server/models/BillingTransaction.js';
import { PaymentService } from '../src/server/services/payment.service.js';

async function testE2E() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora';
  await mongoose.connect(uri);
  console.log('[E2E Test] Connected to MongoDB.');

  // Find Hanson Company
  const tenant = await Tenant.findOne({ slug: 'hanson-co' });
  if (!tenant) {
    console.error('Tenant hanson-co not found.');
    process.exit(1);
  }

  // Find Starter Plan
  const plan = await Plan.findOne({ slug: 'starter' });
  if (!plan) {
    console.error('Starter plan not found.');
    process.exit(1);
  }

  console.log('[E2E Test] Found Tenant:', tenant.name, 'Tax Rate:', tenant.taxConfig?.defaultTaxRate);
  console.log('[E2E Test] Found Plan:', plan.name, 'Base Price:', plan.price);

  // Initialize
  const init = await BillingService.initializeSubscriptionPayment({
    tenantId: tenant._id.toString(),
    planId: plan._id.toString(),
    billingInterval: 'MONTHLY',
    email: 'owner@hansoncompany.com',
    provider: 'PAYSTACK',
  });

  console.log('[E2E Test] Initialized Payment:');
  console.log({
    reference: init.reference,
    subtotal: init.subtotal,
    tax: init.tax,
    taxRate: init.taxRate,
    totalAmount: init.amount,
  });

  // Check that total equals subtotal + tax
  if (init.amount !== (init.subtotal! + init.tax!)) {
    throw new Error(`Total amount ${init.amount} does not equal subtotal ${init.subtotal} + tax ${init.tax}`);
  }

  console.log('[E2E Test] Calculation check PASSED: Total = Subtotal + VAT');

  // Clean up the temporary test transaction created
  await BillingTransaction.deleteOne({ providerReference: init.reference });

  await mongoose.connection.close();
  console.log('[E2E Test] All end-to-end financial integrity checks PASSED!');
  process.exit(0);
}

testE2E().catch((err) => {
  console.error('[E2E Test Error]', err);
  process.exit(1);
});
