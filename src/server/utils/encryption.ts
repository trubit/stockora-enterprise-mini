import crypto from 'crypto';
import { config } from '../../config/environment.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key from the environment variable or fallback.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    config.jwtSecret ||
    'stockora-default-enterprise-secure-key-32b!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts sensitive credentials or tokens.
 * Returns a colon-separated string: iv:authTag:encryptedData (hex encoded).
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts encrypted credentials.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates an HMAC SHA-256 signature for outbound webhooks.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies an HMAC SHA-256 signature for inbound webhooks with timing-safe comparison.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuffer = Buffer.from(signature, 'hex');
    const expBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a high-entropy API key.
 * Returns raw secret for one-time display, along with hashed version and key prefix.
 */
export function generateApiKey(): {
  rawKey: string;
  keyId: string;
  hashedSecret: string;
  prefix: string;
} {
  const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
  const randomSecret = crypto.randomBytes(24).toString('hex');
  const rawKey = `sk_live_${keyId}_${randomSecret}`;
  const prefix = `sk_live_${keyId.slice(0, 8)}...`;
  const hashedSecret = crypto.createHash('sha256').update(rawKey).digest('hex');

  return { rawKey, keyId, hashedSecret, prefix };
}

/**
 * Hashes an API key for lookup / comparison.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}
