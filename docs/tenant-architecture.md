# Multi-Tenant Architecture & Technical Specification

## 1. Architectural Overview

```text
                                 HTTP / WebSocket Request
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  authenticateJWT Middleware│
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  resolveTenantContext     │
                               │  - Verify user.tenantId   │
                               │  - Validate x-tenant-id   │
                               │  - Reject unauthorized (403│
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  requireActiveTenant      │
                               │  - Check ACTIVE / TRIAL   │
                               │  - Reject SUSPENDED       │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  Tenant Scoped Services   │
                               │  - DB Queries: { tenantId }
                               │  - Redis Keys: tenant:{id}│
                               │  - Socket: room(tenant:{id}
                               └───────────────────────────┘
```

## 2. Tenant Model Schema

Located at `src/server/models/Tenant.ts`:
- `name`: Organization public display name.
- `slug`: Collision-free unique alphanumeric slug (e.g. `harn-company`).
- `status`: `ACTIVE`, `SUSPENDED`, `TRIAL`, `PENDING`, `CANCELLED`.
- `branding`: Primary color, secondary color, accent color, logo URL, receipt header, receipt footer.
- `taxConfig`: Tax identification number, default tax rate, tax inclusive flag.
- `fiscalConfig`: Currency code, currency symbol, fiscal year start month, timezone.
- `features`: Map of module access (`pos`, `inventory`, `finance`, `crm`, `copilot`, `analytics`, etc.).
- `limits`: Max users, branches, warehouses, POS terminals, products, storage bytes.
- `subscriptionTier`: `FREE`, `STARTER`, `GROWTH`, `ENTERPRISE`, `CUSTOM`.

## 3. Database Indexes

Every tenant-scoped MongoDB collection implements compound indexes with `tenantId` in the leading position for ultra-low query latency:
```ts
ProductSchema.index({ tenantId: 1, sku: 1 });
ProductSchema.index({ tenantId: 1, category: 1 });
ProductSchema.index({ tenantId: 1, status: 1 });
ProductSchema.index({ tenantId: 1, createdAt: -1 });

BranchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
WarehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
POSTerminalSchema.index({ tenantId: 1, terminalCode: 1 }, { unique: true });
```
