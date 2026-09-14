# Billing Webhooks & Idempotency Architecture

## 1. Webhook Endpoint
`POST /api/v1/billing/webhooks/paystack`

---

## 2. Cryptographic Signature Verification
All incoming payloads are validated using HMAC SHA512 against the `PAYSTACK_WEBHOOK_SECRET`:

```typescript
const hash = crypto.createHmac('sha512', secret).update(rawPayload).digest('hex');
const isValid = hash === signature;
```

---

## 3. Webhook Idempotency & Replay Protection
1. Each event contains a unique Paystack `event.id` or transaction `reference`.
2. The `BillingService` checks if `providerEventId` is already recorded on a `BillingTransaction`.
3. If previously processed, the webhook returns `200 OK` with `{ processed: true, reason: 'Duplicate event (Idempotent)' }` and exits without duplicate charging, renewal, or invoice creation.
