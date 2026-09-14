# Tenant Data Isolation & IDOR Prevention

## 1. Isolation Strategy

Stockora implements defense-in-depth isolation across multiple tiers:

1. **Authentication & Identity Layer**:
   - The user's valid tenant memberships are embedded into the cryptographically signed JWT access token (`req.user.tenants`).
   - `resolveTenantContext` middleware checks the active `tenantId`.

2. **Authorization & IDOR Protection**:
   - If an attacker passes an `x-tenant-id` header corresponding to an organization where they have no membership, `resolveTenantContext` throws a `403 Forbidden` error immediately.
   - Platform Super Admins (`isPlatformAdmin: true`) bypass membership validation for cross-tenant maintenance.

3. **Data Access Layer**:
   - Every service query automatically applies `{ tenantId: req.tenantId }`.
   - `getTenantFilter(req)` helper utility ensures no un-scoped queries execute.

4. **Cache & Memory Isolation**:
   - Redis cache keys are prefixed: `tenant:{tenantId}:metrics`, `tenant:{tenantId}:catalog`.
   - Client-side React Query cache is flushed with `queryClient.clear()` upon tenant switching.

5. **Real-time Event Isolation**:
   - Socket.IO connections join tenant-specific rooms: `socket.join(`tenant:${tenantId}`)`.
   - Real-time stock alerts and POS updates never broadcast across tenant room boundaries.
