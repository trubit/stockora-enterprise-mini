# Stockora Enterprise — Security Testing & Verification Guide

## 1. Automated Security Test Framework
Stockora Enterprise employs an extensive security test harness in [`src/server/tests/phase48_security.test.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/tests/phase48_security.test.ts).

---

## 2. Test Categories
1. **Multi-Tenant Isolation**: Validates strict boundary separation between Harn Company and Hanson Company across products, transactions, receipts, and settings.
2. **Privilege Escalation & RBAC**: Confirms low-privilege roles cannot execute administrative operations or elevate roles.
3. **NoSQL Injection**: Asserts that payloads with `$gt`, `$ne`, or `$where` operators are rejected or treated as plain literals.
4. **Rate Limiting**: Verifies that high-frequency requests trigger `429 Too Many Requests`.
5. **Payment & Currency Integrity**: Ensures client-side price/tax/currency manipulations are overridden by server calculations.
6. **Webhook Signature & Idempotency**: Tests that forged signatures are rejected and duplicate webhook deliveries are safely handled.
7. **File Path Traversal**: Ensures relative path parameters (`../../`) are blocked.
