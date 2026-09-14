# Multi-Branch & Location Management

## 1. Branch Hierarchy

Branches represent physical stores, depots, or online fulfillment hubs owned by a single SaaS tenant:
- Every branch belongs to exactly one `tenantId`.
- Each branch has a unique `code` within the tenant (e.g. `HARN-LAG`, `HARN-ABJ`).
- Cashiers and Store Managers can be restricted to specific branch IDs via `allowedBranches` in their membership.

## 2. Warehouse & POS Terminal Links

- **Warehouses**: Connected to branches for instant stock availability queries during POS transactions.
- **POS Terminals**: Physical stations configured per branch with hardware device profiles (barcode scanners, thermal printers, scale integrations).
- **Inter-Branch Stock Transfers**: Formal multi-tenant transfer requests (`PENDING` -> `SHIPPED` -> `RECEIVED`) with dual-tenant inventory balance updates.
