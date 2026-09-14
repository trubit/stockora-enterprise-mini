# Billing Testing Suite

## 1. Automated Test Suites

### Unit Tests
- `src/server/tests/plan.test.ts`: Plan model structure, unlimited limits, uniqueness.
- `src/server/tests/usage.test.ts`: Usage reconciliation, counter increments, threshold warnings.
- `src/server/tests/subscription.test.ts`: Snapshot immutability, trial transitions, upgrade/downgrade.
- `src/server/tests/billing.test.ts`: Paystack payment initialization, verification, and invoice generation.

### Integration & Security Tests
- `src/server/tests/subscription.integration.test.ts`: Full lifecycle and safe downgrade evaluation.
- `src/server/tests/billing-isolation.test.ts`: Harn vs Hanson IDOR isolation.
- `src/server/tests/price-manipulation.test.ts`: Authoritative pricing defense.
- `src/server/tests/limit-bypass.test.ts`: Concurrency limit enforcement.
- `src/server/tests/webhook.integration.test.ts`: Webhook cryptographic verification and idempotency.

### End-to-End Browser Tests (Playwright)
- `e2e/pricing.spec.ts`: Plan catalog, interval toggle, checkout modal.
- `e2e/billing.spec.ts`: Billing dashboard, invoices, usage meter progress bars.
