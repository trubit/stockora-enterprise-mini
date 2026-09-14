# Stockora Enterprise — Payment & Financial Security Architecture

## 1. Zero-Trust Payment Processing
Stockora Enterprise integrates with **Stripe** and **Paystack** for enterprise checkout, subscriptions, and POS payments.

---

## 2. Core Financial Security Principles
1. **Server-Side Authoritative Recalculation**:
   - The frontend never dictates the final charge amount, currency, or tax liability.
   - When a checkout session initializes (`/checkout/initialize`), the server looks up verified product prices, applies tenant-specific tax configurations, validates discount codes, and computes the authoritative total.
2. **Currency Tampering Protection**:
   - Multi-currency conversions are checked against verified exchange rate records. An attacker cannot change the currency code while preserving the numerical value.
3. **Idempotency Keys**:
   - Every financial transaction uses a unique idempotency key (`reference` / `idempotencyKey`) preventing duplicate charges from network retries or double-clicks.
4. **Webhook Security & Replay Prevention**:
   - Inbound Stripe events are validated using `stripe.webhooks.constructEvent()` with the webhook signing secret.
   - Inbound Paystack events are validated using `crypto.createHmac('sha512', secret).update(rawBody).digest('hex')` matched via `crypto.timingSafeEqual()`.
   - Processed webhook event IDs are cached in Redis to prevent replay attacks.
