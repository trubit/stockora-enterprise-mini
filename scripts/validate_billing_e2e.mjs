import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, ObjectId } from 'mongodb';

async function testE2E() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('stockora');
  console.log('[E2E Test] Connected to MongoDB.');

  const tenant = await db.collection('tenants').findOne({ slug: 'hanson-company' });
  const plan = await db.collection('plans').findOne({ slug: 'starter' });

  console.log('[E2E Test] Tenant:', tenant.name, 'Tax Rate:', tenant.taxConfig?.defaultTaxRate);
  console.log('[E2E Test] Plan:', plan.name, 'Base Price:', plan.price);

  const subtotal = plan.price;
  const taxRate = tenant.taxConfig?.defaultTaxRate ?? 0.075;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + tax;

  console.log('[E2E Test] Calculated Billing Breakdown:');
  console.log({ subtotal, taxRate, tax, total });

  if (total !== 16500) {
    throw new Error(`Expected total 16500 NGN, got ${total}`);
  }

  console.log('[E2E Test] Verification: Hanson Company 15,000 NGN + 10% VAT = 16,500 NGN correctly calculated!');
  await client.close();
  process.exit(0);
}

testE2E().catch((err) => {
  console.error('[E2E Test Error]', err);
  process.exit(1);
});
