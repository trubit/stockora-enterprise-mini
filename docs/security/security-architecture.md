# Stockora Enterprise — Enterprise Security Architecture

## 1. Zero-Trust Security Philosophy
Stockora Enterprise operates on the zero-trust paradigm:
1. **Never trust client state**: All parameters (prices, discounts, quantities, tenant IDs, roles, permissions, taxes) are recalculated and verified on the backend.
2. **Defense in Depth**: Security controls operate across multiple layers:
   - Network / Edge: Helmet headers, strict CORS, rate limiters, compression.
   - Application Gateway: JWT cryptographic verification, session validation, cookie security.
   - Domain Layer: RBAC permissions matrix, tenant context enforcement.
   - Persistence Layer: Mongoose schema constraints, atomic operators, indexes.
   - Asynchronous Layer: HMAC webhook validation, BullMQ scoped jobs, Socket.IO room isolation.

---

## 2. Security Headers & Content Security Policy (CSP)
- **Helmet**: OWASP-aligned HTTP response headers.
- **HSTS**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` in production.
- **Frame Protection**: `X-Frame-Options: DENY` preventing clickjacking.
- **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff`.
- **CORS**: Strict origin whitelist matching configured domains; no wildcard fallbacks with credentials.

---

## 3. Cryptography & Secrets Handling
- **Password Hashing**: Industry-standard cryptographic key derivation (Argon2 / Bcrypt).
- **JWT Signatures**: High-entropy secret key signatures with short-lived access tokens (15m) and secure refresh token rotation.
- **Webhook Verification**: Constant-time comparison (`crypto.timingSafeEqual`) of HMAC-SHA256 digests for Stripe and Paystack payloads.
