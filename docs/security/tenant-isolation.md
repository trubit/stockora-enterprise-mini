# Stockora Enterprise — Multi-Tenant Isolation Architecture

## 1. Core Tenant Isolation Invariant
Stockora Enterprise enforces complete data and context isolation between organizations. Any two tenants (such as **Harn Company** and **Hanson Company**) operate with dedicated logical separation. A user belonging to Harn Company can never access, modify, infer, or leak data belonging to Hanson Company.

---

## 2. Server-Side Enforcement Mechanisms

### A. Context Resolution & Authentication Guard
1. The tenant identifier (`tenantId`) is **never trusted from client input** (URL query parameters, request bodies, or headers).
2. The user's verified `tenantId` is extracted strictly from the cryptographic JWT payload authenticated by [`src/server/middleware/auth.ts`](file:///c:/Users/USER/stockora-enterprise/src/server/middleware/auth.ts).
3. Any attempt by a client to inject `?tenantId=...` or `{ "tenantId": "..." }` into API mutations is overridden by the server-side authenticated context.

### B. Database Query Scoping
Every Mongoose query across domain models (Products, Inventory, Transactions, Invoices, Customers, Suppliers, RegionalSettings) mandates tenant criteria:
```typescript
// Enforced pattern:
const product = await Product.findOne({ _id: productId, tenantId: req.user.tenantId });
if (!product) {
  throw new NotFoundError('Product not found or access denied');
}
```

### C. Redis & Cache Key Isolation
All cached entities, rate limiters, and session records prefix keys with the active tenant ID:
`tenant:{tenantId}:exchange_rates:{currencyPair}`
`tenant:{tenantId}:products:{productId}`

### D. Socket.IO Channel Isolation
Real-time Socket.IO rooms are scoped per tenant:
`room:tenant:{tenantId}`
A client cannot join a room belonging to another tenant without passing server-side socket authentication and membership verification.

---

## 3. IDOR Penetration Testing
Every endpoint has been validated against Insecure Direct Object Reference (IDOR) attacks. If Tenant A supplies Tenant B's UUID or MongoDB ObjectId for any entity, the server returns a `404 Not Found` or `403 Forbidden` response without disclosing whether the entity exists.
