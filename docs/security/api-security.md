# Stockora Enterprise — API Security & Defense-in-Depth

## 1. Authentication & Session Management
- **Stateless Bearer JWT**: Authenticated endpoints validate RS256/HS256 signed JSON Web Tokens.
- **Short-Lived Expiration**: Access tokens expire in 15 minutes.
- **Refresh Token Invalidation**: Refresh tokens stored in hashed state, rotated on every refresh, and revocable immediately upon logout or suspicious activity.
- **Cookie Security**: `HttpOnly`, `Secure` (in production), and `SameSite=Lax/Strict` flags prevent client-side JavaScript access and cross-site scripting cookie theft.

---

## 2. Authorization & RBAC
- **Strict Role Boundaries**: Roles (`Super Administrator`, `Company Owner`, `Manager`, `Cashier`, `Warehouse Worker`, `Employee`) enforce least privilege.
- **Server-Side Enforcement**: UI visibility checks never substitute for server-side `hasPermission(user, 'required:permission')` checks.
- **Mass-Assignment Guard**: Object creation and patch endpoints only accept whitelisted fields; sensitive properties (`tenantId`, `role`, `permissions`, `isPlatformAdmin`, `walletBalance`) cannot be injected by callers.

---

## 3. Injection Protections
- **NoSQL / Mongo Operator Injection**: Requests are validated against explicit Zod schemas. Query criteria prevent raw user-controlled objects containing `$gt`, `$ne`, `$where`, or `$regex` from being interpreted as MongoDB operators.
- **Regular Expression DoS (ReDoS)**: Any dynamic search input is escaped and length-limited to avoid catastrophic backtracking.
- **JSON Payload Limits**: Strict 1MB maximum payload limits on incoming JSON bodies.

---

## 4. Rate Limiting & Distributed Defense
- **Global API Rate Limiter**: 1000 requests / 15 minutes in development; 100 requests / 15 minutes in production.
- **Authentication Rate Limiter**: 15 attempts / 15 minutes on `/auth/login`, `/auth/register`, and `/auth/forgot-password` to prevent brute-force attacks and credential stuffing.
