# Multi-Tenant Database Migration Strategy

## 1. Migration Overview

To migrate single-tenant legacy databases to the Phase 43 multi-tenant architecture, Stockora provides an automated database migration script that backfills default tenant documents and compound indexes.

## 2. Migration Steps

1. **Default Tenant Creation**:
   - Creates default `Tenant` document (`slug: "default-organization"`) if none exists.
2. **Company & Branch Association**:
   - Sets `tenantId: defaultTenant._id` on existing `Company`, `Branch`, `Warehouse`, `POSTerminal` documents without a tenant.
3. **Master Data & Catalog Association**:
   - Backfills `tenantId` across `Product`, `Customer`, `Transaction`, `AuditLog`, `CustomerSegment` collections.
4. **User Membership Backfill**:
   - Populates `tenants: [{ tenantId, roleName, isDefault: true }]` for all legacy users.
5. **Index Creation & Optimization**:
   - Drops single-field legacy unique indexes (e.g. `{ code: 1 }` on branches) and builds multi-tenant compound indexes `{ tenantId: 1, code: 1 }`.
