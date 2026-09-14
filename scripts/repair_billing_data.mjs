import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora';
  console.log('[Migration] Connecting to MongoDB:', uri);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('stockora');

  console.log('[Migration] Starting Billing & Invoice Historical Data Repair...');

  // 1. Remove duplicate invoice INV-SAAS-2026-00003
  const dupInvoice = await db.collection('billinginvoices').findOne({ invoiceNumber: 'INV-SAAS-2026-00003' });
  if (dupInvoice) {
    console.log('[Migration] Found duplicate invoice INV-SAAS-2026-00003. Removing duplicate record...');
    await db.collection('billinginvoices').deleteOne({ _id: dupInvoice._id });
    console.log('[Migration] Successfully removed duplicate invoice.');
  }

  // 2. Reconcile INV-SAAS-2026-00002 to match verified Paystack settlement STK-SUB-1788368698179-IAVSO (15,000 NGN)
  const inv2 = await db.collection('billinginvoices').findOne({ invoiceNumber: 'INV-SAAS-2026-00002' });
  if (inv2) {
    console.log('[Migration] Reconciling INV-SAAS-2026-00002 to match verified Paystack amount (15,000 NGN)...');
    const taxRate = inv2.taxRate || 0.1;
    const subtotal = Math.round((15000 / (1 + taxRate)) * 100) / 100;
    const tax = Math.round((15000 - subtotal) * 100) / 100;

    const lineItems = inv2.lineItems || [];
    if (lineItems.length > 0) {
      lineItems[0].unitPrice = subtotal;
      lineItems[0].amount = subtotal;
    }

    await db.collection('billinginvoices').updateOne(
      { _id: inv2._id },
      {
        $set: {
          subtotal,
          tax,
          total: 15000,
          amountPaid: 15000,
          amountOutstanding: 0,
          status: 'PAID',
          lineItems,
        },
      }
    );
    console.log('[Migration] Reconciled INV-SAAS-2026-00002 successfully.');
  }

  // 3. Reconcile INV-SAAS-2026-00001 to match verified Paystack settlement STK-SUB-1788367694039-NE9MU (45,000 NGN)
  const inv1 = await db.collection('billinginvoices').findOne({ invoiceNumber: 'INV-SAAS-2026-00001' });
  if (inv1) {
    console.log('[Migration] Reconciling INV-SAAS-2026-00001 to match verified Paystack amount (45,000 NGN)...');
    const taxRate = inv1.taxRate || 0.075;
    const subtotal = Math.round((45000 / (1 + taxRate)) * 100) / 100;
    const tax = Math.round((45000 - subtotal) * 100) / 100;

    const lineItems = inv1.lineItems || [];
    if (lineItems.length > 0) {
      lineItems[0].unitPrice = subtotal;
      lineItems[0].amount = subtotal;
    }

    await db.collection('billinginvoices').updateOne(
      { _id: inv1._id },
      {
        $set: {
          subtotal,
          tax,
          total: 45000,
          amountPaid: 45000,
          amountOutstanding: 0,
          status: 'PAID',
          lineItems,
        },
      }
    );
    console.log('[Migration] Reconciled INV-SAAS-2026-00001 successfully.');
  }

  // 4. Update BillingTransactions with amountPaid
  await db.collection('billingtransactions').updateMany(
    { status: 'SUCCESS' },
    [{ $set: { amountPaid: '$amount' } }]
  );

  console.log('[Migration] All historical billing records successfully reconciled!');
  await client.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
