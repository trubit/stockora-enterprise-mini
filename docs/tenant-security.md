# Tenant Security & Zero-Trust Architecture

## 1. Zero-Trust Context Validation

- **No Implicit Trust**: Request body or query parameters containing `tenantId` are ignored for authorization. The tenant context is strictly derived from the validated JWT token and the authenticated user document.
- **Header Impersonation Defense**: When `x-tenant-id` header is present, it is checked against `req.user.tenants` array. If no authorized membership exists, `resolveTenantContext` throws a `403 Forbidden` response and logs a security audit incident.

## 2. Token Refresh & Tenant Context Switching

When switching tenants via `/api/tenants/switch`:
1. The server validates that `req.user` holds an active membership for target `tenantId`.
2. A new JWT token is signed containing `tenantId: targetTenant._id` and `tenantSlug: targetTenant.slug`.
3. The previous TanStack React Query cache on the client is completely flushed (`queryClient.clear()`) to eliminate stale data cross-contamination.

## 3. Real-Time Room Partitioning

Socket.IO connections are partitioned into tenant-specific channels:
```ts
socket.on('join_tenant', ({ tenantId }) => {
  // Verify user token has access to tenantId
  socket.join(`tenant:${tenantId}`);
});
```
Broadcasts for stock alerts, order status updates, and POS receipts are scoped strictly to `io.to(`tenant:${tenantId}`)`.
