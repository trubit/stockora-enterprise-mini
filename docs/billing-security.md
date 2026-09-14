# Billing Security & Multi-Tenant Isolation

## 1. Security Defenses

### 1. Cross-Tenant IDOR Attack Defense
- All billing queries (invoices, subscriptions, transactions, usage) are strictly filtered by `tenantId`.
- Even if a tenant knows another tenant's invoice ID or subscription ID, access is denied (`403 Forbidden`).

### 2. Price Manipulation Defense
- The client cannot submit price values to the initialization endpoint.
- Price is authoritatively loaded from the MongoDB `Plan` document.

### 3. Plan Bypass Defense
- Submitting an arbitrary `planId` does not unlock features until Paystack verification succeeds or an admin grants it.

### 4. Webhook Forgery Defense
- HMAC SHA512 signatures are verified against the Paystack webhook secret before processing.

### 5. Webhook Replay Defense
- `providerEventId` uniqueness prevents multiple activations for the same event.
