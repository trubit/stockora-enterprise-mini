import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

console.log('\n======================================================');
console.log('STOCKORA ENTERPRISE MINI — .ENV VERIFICATION AUDIT');
console.log('======================================================\n');

const results = {};

// 1. Port & Network
results.network = {
  PORT: process.env.PORT || 'not set',
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  FRONTEND_URL: process.env.FRONTEND_URL,
  status: process.env.PORT === '8095' ? 'PASS (Isolated)' : 'WARN (Not 8095)',
};

// 2. MongoDB
try {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  results.mongodb = {
    uri,
    connected: true,
    dbName: mongoose.connection.name,
    status: 'PASS (Connected)',
  };
  await mongoose.disconnect();
} catch (err) {
  results.mongodb = {
    uri: process.env.MONGODB_URI,
    connected: false,
    error: err.message,
    status: 'FAIL',
  };
}

// 3. Redis
try {
  const redisUri = process.env.REDIS_URL;
  const client = new Redis(redisUri, { connectTimeout: 4000, maxRetriesPerRequest: 1 });
  await client.ping();
  results.redis = {
    uri: redisUri,
    connected: true,
    status: 'PASS (Connected)',
  };
  client.disconnect();
} catch (err) {
  results.redis = {
    uri: process.env.REDIS_URL,
    connected: false,
    error: err.message,
    status: 'FAIL',
  };
}

// 4. JWT & Cookie Secrets
const jwtSecLen = (process.env.JWT_SECRET || '').length;
const jwtRefLen = (process.env.JWT_REFRESH_SECRET || '').length;
const cookieSecLen = (process.env.COOKIE_SECRET || '').length;
results.auth = {
  jwtSecretLength: jwtSecLen,
  jwtRefreshSecretLength: jwtRefLen,
  cookieSecretLength: cookieSecLen,
  status: jwtSecLen >= 32 && jwtRefLen >= 32 && cookieSecLen >= 32 ? 'PASS (Secure)' : 'FAIL (Too short)',
};

// 5. Cloudinary
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const ping = await cloudinary.api.ping();
  results.cloudinary = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    ping: ping.status,
    status: ping.status === 'ok' ? 'PASS (Verified)' : 'WARN',
  };
} catch (err) {
  results.cloudinary = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    error: err.message,
    status: 'FAIL / INVALID KEYS',
  };
}

// 6. SMTP / Brevo
try {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,
  });
  await transporter.verify();
  results.smtp = {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    status: 'PASS (Credentials Verified)',
  };
} catch (err) {
  results.smtp = {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    error: err.message,
    status: 'FAIL / UNREACHABLE',
  };
}

// 7. Payment Gateways
results.paystack = {
  publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  secretKey: process.env.PAYSTACK_SECRET_KEY ? 'Set' : 'Missing',
  isPlaceholder: (process.env.PAYSTACK_PUBLIC_KEY || '').includes('placeholder'),
};

results.admin = {
  email: process.env.PLATFORM_ADMIN_EMAIL,
  configured: Boolean(process.env.PLATFORM_ADMIN_EMAIL),
};

console.log(JSON.stringify(results, null, 2));
