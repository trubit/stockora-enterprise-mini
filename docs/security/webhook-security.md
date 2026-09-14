# Stockora Enterprise — Webhook Security Architecture

## 1. Overview
Inbound webhooks receive asynchronous events from Stripe, Paystack, and third-party enterprise integrations.

---

## 2. Security Controls
1. **HMAC Signature Verification**: Every incoming webhook payload must include a valid cryptographic signature in request headers. Requests lacking or failing signature verification are rejected immediately with `401 Unauthorized`.
2. **Timing-Safe Digest Comparison**: Cryptographic comparisons use constant-time operations (`crypto.timingSafeEqual`) to prevent timing side-channel analysis.
3. **Idempotency & Replay Protection**: Webhook event IDs are tracked in Redis (`webhook:event:{eventId}`) with a 24-hour TTL. Duplicate deliveries return `200 OK` immediately without re-executing business logic or financial mutations.
4. **Tenant Context Binding**: Webhook payloads resolve the corresponding tenant through metadata and process events strictly within that tenant's boundary.
