# Stockora Enterprise — Threat Model (STRIDE Framework)

## 1. Overview & System Scope
Stockora Enterprise is an enterprise-grade, multi-tenant Inventory Management, Point of Sale (POS), and Business Operations platform. This threat model evaluates assets, actors, trust boundaries, threat vectors, and corresponding zero-trust security controls.

---

## 2. Assets & High-Value Targets
1. **User Credentials & Auth State**: Passwords (argon2/bcrypt hashed), JWT access tokens, refresh tokens, session cookies, OTP secrets.
2. **Multi-Tenant Data**: Tenant configurations, isolated business records, accounting chart of accounts, tax policies, regional settings.
3. **Inventory & Product Catalogs**: Stock levels, pricing, cost bases, warehouse bin mappings, valuation matrices (FIFO/LIFO/WAC).
4. **Financial & POS Transactions**: Orders, payment authorizations, webhook payloads, tax calculations, discounts, split payments.
5. **Infrastructure & API Secrets**: Stripe/Paystack webhook secrets, database connection credentials, Redis authorization keys.
6. **Audit Trails & Telemetry**: Immutable security logs, operational audit trails, request correlation metadata.

---

## 3. Trust Boundaries
- **Browser <-> Edge API**: Inbound public traffic; authenticated via short-lived JWT and HTTP-only signed cookies.
- **Tenant Context Boundary**: Explicit separation of company operations; `tenantId` is strictly resolved server-side from authenticated session context.
- **App Server <-> Database / Cache (MongoDB & Redis)**: Internal secured network; tenant-scoped queries and keys.
- **App Server <-> External Payment Gateways (Stripe / Paystack)**: Asynchronous webhooks validated with cryptographic HMAC-SHA256 signatures.

---

## 4. Threat Matrix (STRIDE)

| Threat Category | Target Subsystem | Attack Vector | Severity | Existing & Implemented Control | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Authentication | Credential brute-force, token forgery, replay | High | Rate limiting (15 req/15min on auth), JWT signature verification with secret key, token revocation list in Redis | ✅ Mitigated |
| **Spoofing** | Webhooks | Forged payment confirmation events | Critical | HMAC-SHA256 signature verification on Stripe (`Stripe-Signature`) & Paystack (`x-paystack-signature`) | ✅ Mitigated |
| **Tampering** | POS / Checkout | Client-side price, discount, or tax amount manipulation | Critical | Zero-Trust authoritative server-side recalculation of line totals, tax policies, and discount bounds | ✅ Mitigated |
| **Tampering** | API / Database | NoSQL operator injection (`$gt`, `$ne`, `$where`) | High | Strict Zod validation schemas, MongoDB operator sanitization, strongly-typed Mongoose models | ✅ Mitigated |
| **Repudiation** | Auditing | Denial of critical transactions or administrative changes | Medium | Immutable audit logs with timestamp, actor userId, tenantId, IP, and correlation request IDs | ✅ Mitigated |
| **Information Disclosure** | Multi-Tenancy | IDOR attacks across company boundaries | Critical | Server-side tenant scoping on every query; strict RBAC checks; cross-company access rejection | ✅ Mitigated |
| **Information Disclosure** | Error Handling | Stack trace or DB connection string leakage | Medium | Standardized safe error handler; stack traces suppressed in production | ✅ Mitigated |
| **Denial of Service** | API / Database | High-frequency API spam, regex DoS, oversized payloads | High | Global rate limiting (100 req/15min in prod), 1MB JSON body limits, query pagination caps | ✅ Mitigated |
| **Elevation of Privilege** | RBAC System | Role tampering via mass assignment | Critical | Protected property whitelisting; server-side permission verification via `hasPermission()` | ✅ Mitigated |

---

## 5. Residual Risk & Ongoing Assurance
Continuous automated security test suites ([`src/server/tests/phase48_security.test.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/tests/phase48_security.test.ts)) validate all trust boundaries and isolation guarantees on every build.
