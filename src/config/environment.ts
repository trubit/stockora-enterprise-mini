import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Critical Test Isolation: never allow automated test runners to target the main 'stockora' development database
const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.VITEST) ||
  Boolean(process.env.VITEST_WORKER_ID);

if (isTestEnv && (!process.env.MONGODB_URI || process.env.MONGODB_URI.endsWith('/stockora'))) {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/stockora_test';
}

const envSchema = z.object({
  // --- Core ---
  PORT: z.coerce.number().default(8095),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3050'),
  APP_URL: z.string().optional().default(''),
  FRONTEND_URL: z.string().optional().default(''),
  PUBLIC_FRONTEND_URL: z.string().optional().default(''),

  // --- Database ---
  MONGODB_URI: z.string({ required_error: 'MONGODB_URI is required' }),
  REDIS_URL: z.string({ required_error: 'REDIS_URL is required' }),

  // --- Auth ---
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string({ required_error: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRATION: z.string().default('30m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // --- Cookie Signing (separate from JWT secret) ---
  COOKIE_SECRET: z
    .string({ required_error: 'COOKIE_SECRET is required' })
    .min(32, 'COOKIE_SECRET must be at least 32 characters'),

  // --- Platform Admin Bootstrap ---
  PLATFORM_ADMIN_EMAIL: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),

  // --- Logging ---
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // --- Rate Limiting ---
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // --- File Uploads ---
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_SIZE: z.coerce.number().default(5242880),

  // --- Cloudinary (optional — graceful fallback if not set) ---
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // --- SMTP (optional — graceful fallback if not set) ---
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('noreply@stockora.com'),

  // --- Brevo Email Delivery (optional — direct HTTPS API or SMTP relay) ---
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_SENDER_EMAIL: z.string().optional().default(''),
  BREVO_SENDER_NAME: z.string().default('Stockora Enterprise'),

  // --- OTP Verification Security Policy ---
  OTP_EXPIRATION_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),

  // --- Payment Gateways (optional) ---
  PAYSTACK_SECRET_KEY: z.string().optional().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),

  // --- Exchange Rate / FX Provider (optional) ---
  EXCHANGE_RATE_API_KEY: z.string().optional().default(''),
  EXCHANGE_RATE_PROVIDER: z
    .enum(['openexchangerates', 'exchangerate-api', 'frankfurter', 'auto'])
    .default('auto'),

  // --- Google Gemini AI Intelligence ---
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_ENABLED: z.coerce.boolean().default(true),
});

let parsedEnv: z.infer<typeof envSchema>;

try {
  const envSource = typeof process !== 'undefined' ? process.env : {};
  parsedEnv = envSchema.parse(envSource);
} catch (error) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`\n[FATAL] Environment variable validation failed:\n${issues}\n`);
    console.error('Hint: Copy .env.example to .env and fill in the required values.\n');
  } else {
    console.error('[FATAL] Unexpected environment validation error:', error);
  }
  process.exit(1);
}

export const config = {
  port: parsedEnv.PORT,
  env: parsedEnv.NODE_ENV,
  mongodbUri: parsedEnv.MONGODB_URI,
  redisUrl: parsedEnv.REDIS_URL,
  jwtSecret: parsedEnv.JWT_SECRET,
  jwtRefreshSecret: parsedEnv.JWT_REFRESH_SECRET,
  jwtAccessExpiration: parsedEnv.JWT_ACCESS_EXPIRATION,
  jwtRefreshExpiration: parsedEnv.JWT_REFRESH_EXPIRATION,
  cookieSecret: parsedEnv.COOKIE_SECRET,
  corsOrigin: parsedEnv.CORS_ORIGIN,
  frontendUrl: parsedEnv.PUBLIC_FRONTEND_URL || parsedEnv.FRONTEND_URL || parsedEnv.APP_URL || '',
  publicFrontendUrl:
    parsedEnv.PUBLIC_FRONTEND_URL || parsedEnv.FRONTEND_URL || parsedEnv.APP_URL || '',
  appUrl:
    parsedEnv.PUBLIC_FRONTEND_URL ||
    parsedEnv.FRONTEND_URL ||
    parsedEnv.APP_URL ||
    parsedEnv.CORS_ORIGIN ||
    'http://localhost:3050',
  platformAdminEmail: parsedEnv.PLATFORM_ADMIN_EMAIL,
  logLevel: parsedEnv.LOG_LEVEL,
  rateLimitWindowMs: parsedEnv.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: parsedEnv.RATE_LIMIT_MAX,
  uploadDir: parsedEnv.UPLOAD_DIR,
  uploadMaxSize: parsedEnv.UPLOAD_MAX_SIZE,
  cloudinaryCloudName: parsedEnv.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: parsedEnv.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: parsedEnv.CLOUDINARY_API_SECRET,
  smtpHost: parsedEnv.SMTP_HOST,
  smtpPort: parsedEnv.SMTP_PORT,
  smtpUser: parsedEnv.SMTP_USER,
  smtpPass: parsedEnv.SMTP_PASS,
  emailFrom: parsedEnv.EMAIL_FROM,
  brevoApiKey: parsedEnv.BREVO_API_KEY,
  brevoSenderEmail: parsedEnv.BREVO_SENDER_EMAIL || parsedEnv.EMAIL_FROM,
  brevoSenderName: parsedEnv.BREVO_SENDER_NAME,
  otpExpirationMinutes: parsedEnv.OTP_EXPIRATION_MINUTES,
  otpMaxAttempts: parsedEnv.OTP_MAX_ATTEMPTS,
  otpResendCooldownSeconds: parsedEnv.OTP_RESEND_COOLDOWN_SECONDS,
  paystackSecretKey: parsedEnv.PAYSTACK_SECRET_KEY,
  paystackPublicKey: parsedEnv.PAYSTACK_PUBLIC_KEY,
  paystackWebhookSecret: parsedEnv.PAYSTACK_WEBHOOK_SECRET,
  stripeSecretKey: parsedEnv.STRIPE_SECRET_KEY,
  stripeWebhookSecret: parsedEnv.STRIPE_WEBHOOK_SECRET,
  exchangeRateApiKey: parsedEnv.EXCHANGE_RATE_API_KEY,
  exchangeRateProvider: parsedEnv.EXCHANGE_RATE_PROVIDER,
  geminiApiKey: parsedEnv.GEMINI_API_KEY || process.env.AI_SERVICE_API_KEY || '',
  geminiModel: parsedEnv.GEMINI_MODEL || process.env.AI_MODEL_NAME || 'gemini-1.5-flash',
  geminiEnabled: parsedEnv.GEMINI_ENABLED,
  isProduction: parsedEnv.NODE_ENV === 'production',
  isDevelopment: parsedEnv.NODE_ENV === 'development',
  isTest: parsedEnv.NODE_ENV === 'test',
};
