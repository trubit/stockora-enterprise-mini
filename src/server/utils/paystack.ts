import crypto from 'crypto';

/**
 * Validates a Paystack webhook signature using HMAC SHA512.
 * Uses crypto.timingSafeEqual to prevent timing oracle attacks.
 */
export function verifyPaystackSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret || !payload) return false;

  const expectedHash = crypto.createHmac('sha512', secret).update(payload, 'utf8').digest('hex');

  // Constant-time comparison — prevents timing oracle attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    // Buffer length mismatch — signature is invalid
    return false;
  }
}
