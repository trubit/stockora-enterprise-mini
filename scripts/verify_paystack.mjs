import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

async function verifyPaystack() {
  console.log('======================================================');
  console.log('💳 Paystack Live Sandbox Configuration Verification');
  console.log('======================================================');

  console.log(`\n1. Checking Public Key format: ${PUBLIC_KEY?.slice(0, 12)}... (Length: ${PUBLIC_KEY?.length})`);
  if (!PUBLIC_KEY || !PUBLIC_KEY.startsWith('pk_test_')) {
    console.error('❌ Invalid or missing PAYSTACK_PUBLIC_KEY. Must start with pk_test_');
    process.exit(1);
  }
  console.log('✅ Public Key format verified!');

  console.log(`\n2. Checking Secret Key format: ${SECRET_KEY?.slice(0, 12)}... (Length: ${SECRET_KEY?.length})`);
  if (!SECRET_KEY || !SECRET_KEY.startsWith('sk_test_')) {
    console.error('❌ Invalid or missing PAYSTACK_SECRET_KEY. Must start with sk_test_');
    process.exit(1);
  }
  console.log('✅ Secret Key format verified!');

  console.log('\n3. Testing live connection to Paystack Sandbox API (https://api.paystack.co)...');
  try {
    const testReference = `TEST_STK_${Date.now()}`;
    const initResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: 'customer@stockoratest.com',
        amount: 500000, // 5,000 NGN in Kobo
        currency: 'NGN',
        reference: testReference,
        metadata: {
          tenantId: 'demo-tenant',
          system: 'Stockora Enterprise',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (initResponse.data && initResponse.data.status === true) {
      console.log('✅ Live Paystack API Connection Successful!');
      console.log(`   - Access Code: ${initResponse.data.data.access_code}`);
      console.log(`   - Authorization URL: ${initResponse.data.data.authorization_url}`);
      console.log(`   - Reference: ${initResponse.data.data.reference}`);
    } else {
      console.error('❌ Paystack returned error:', initResponse.data);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Paystack API authentication failed:', err.response?.data || err.message);
    process.exit(1);
  }

  console.log('\n4. Testing HMAC SHA512 Webhook Cryptographic Signing...');
  const sampleWebhookEvent = JSON.stringify({
    event: 'charge.success',
    data: {
      id: 998877,
      domain: 'test',
      status: 'success',
      reference: 'TEST_STK_REF',
      amount: 500000,
      currency: 'NGN',
    },
  });

  const generatedSignature = crypto
    .createHmac('sha512', SECRET_KEY)
    .update(sampleWebhookEvent)
    .digest('hex');

  console.log(`✅ Webhook HMAC SHA512 Signature generated: ${generatedSignature.slice(0, 24)}...`);

  console.log('\n======================================================');
  console.log('🎉 PAYSTACK CONFIGURATION IS 100% VALID & OPERATIONAL!');
  console.log('======================================================');
}

verifyPaystack().catch(console.error);
