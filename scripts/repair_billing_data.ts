import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { BillingInvoice } from '../src/server/models/BillingInvoice.js';
import { BillingTransaction } from '../src/server/models/BillingTransaction.js';

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora';
  console.log('[Migration] Connecting to MongoDB:', uri);
  await mongoose.connect(uri);

  console.log('[Migration] Starting Billing & Invoice Historical Data Repair...');

  // 1. Remove duplicate invoice INV-SAAS-2026-00003
  const dupInvoice = await BillingInvoice.findOne({ invoiceNumber: 'INV-SAAS-2026-00003' });
  if (dupInvoice) {
    console.log('[Migration] Found duplicate invoice INV-SAAS-2026-00003. Removing duplicate record...');
    await BillingInvoice.deleteOne({ _id: dupInvoice._id });
    console.log('[Migration] Successfully removed duplicate invoice.');
  }

  // 2. Reconcile INV-SAAS-2026-00002 to match verified Paystack settlement STK-SUB-1788368698179-IAVSO (15,000 NGN)
  const inv2 = await BillingInvoice.findOne({ invoiceNumber: 'INV-SAAS-2026-00002' });
  if (inv2) {
    console.log('[Migration] Reconciling INV-SAAS-2026-00002 to match verified Paystack amount (15,000 NGN)...');
    const taxRate = inv2.taxRate || 0.1;
    const subtotal = Math.round((15000 / (1 + taxRate)) * 100) / 100;
    const tax = Math.round((15000 - subtotal) * 100) / 100;

    inv2.subtotal = subtotal;
    inv2.tax = tax;
    inv2.total = 15000;
    inv2.amountPaid = 15000;
    inv2.amountOutstanding = 0;
    inv2.status = 'PAID';
    if (inv2.lineItems && inv2.lineItems.length > 0) {
      inv2.lineItems[0].unitPrice = subtotal;
      inv2.lineItems[0].amount = subtotal;
    }
    await inv2.save();
    console.log('[Migration] Reconciled INV-SAAS-2026-00002 successfully.');
  }

  // 3. Reconcile INV-SAAS-2026-00001 to match verified Paystack settlement STK-SUB-1788367694039-NE9MU (45,000 NGN)
  const inv1 = await BillingInvoice.findOne({ invoiceNumber: 'INV-SAAS-2026-00001' });
  if (inv1) {
    console.log('[Migration] Reconciling INV-SAAS-2026-00001 to match verified Paystack amount (45,000 NGN)...');
    const taxRate = inv1.taxRate || 0.075;
    const subtotal = Math.round((45000 / (1 + taxRate)) * 100) / 100;
    const tax = Math.round((45000 - subtotal) * 100) / 100;

    inv1.subtotal = subtotal;
    inv1.tax = tax;
    inv1.total = 45000;
    inv1.amountPaid = 45000;
    inv1.amountOutstanding = 0;
    inv1.status = 'PAID';
    if (inv1.lineItems && inv1.lineItems.length > 0) {
      inv1.lineItems[0].unitPrice = subtotal;
      inv1.lineItems[0].amount = subtotal;
    }
    await inv1.save();
    console.log('[Migration] Reconciled INV-SAAS-2026-00001 successfully.');
  }

  // 4. Update BillingTransactions with amountPaid
  await BillingTransaction.updateMany(
    { status: 'SUCCESS', amountPaid: { $in: [0, null] } },
    [{ $set: { amountPaid: '$amount' } }]
  );

  console.log('[Migration] All historical billing records successfully reconciled!');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
