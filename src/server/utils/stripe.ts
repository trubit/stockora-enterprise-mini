import crypto from 'crypto';

/**
 * Validates a Stripe webhook signature using HMAC SHA256.
 * Uses crypto.timingSafeEqual to prevent timing oracle attacks.
 * Enforces a 5-minute tolerance window to protect against replay attacks.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !secret || !payload) return false;

  const parts = signatureHeader.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));

  if (!tPart || !v1Part) return false;

  const timestamp = tPart.split('=')[1];
  const signature = v1Part.split('=')[1];

  if (!timestamp || !signature) return false;

  // Protect against replay attacks — enforce 5-minute tolerance window
  const TOLERANCE_SECONDS = 300;
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - Number(timestamp)) > TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Constant-time comparison — prevents timing oracle attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    // Buffer length mismatch — signature is malformed
    return false;
  }
}

export default verifyStripeSignature;
