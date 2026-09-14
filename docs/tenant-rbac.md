# Multi-Tenant Role-Based Access Control (RBAC)

## 1. Role Hierarchy

In Stockora Enterprise SaaS, users hold roles scoped either globally (Platform Super Admin) or per-tenant:

| Role Name | Scope | Permissions | Description |
|---|---|---|---|
| **Super Administrator** | Platform Global | `*` | Platform owner; oversees all SaaS tenants, status suspensions, and global configs. |
| **Company Owner** | Tenant Scoped | `companies:*`, `branches:*`, `products:*`, `transactions:*`, `finance:*`, `users:*` | Full administrative control over the active tenant organization. |
| **Branch Manager** | Branch Scoped | `branches:read`, `products:*`, `transactions:*`, `inventory:*` | Oversees operations, inventory, and POS staff within assigned branch(es). |
| **Cashier** | POS / Terminal | `transactions:read`, `transactions:write`, `products:read` | Executes checkout, receipt printing, and daily till closures. |
| **Inventory Clerk** | Warehouse Scoped | `inventory:*`, `warehouses:*`, `products:read` | Manages stock receipts, cycle counts, bin transfers, and stock adjustments. |
| **Accountant** | Tenant Scoped | `finance:*`, `reports:*`, `transactions:read` | Manages fiscal periods, journal entries, tax filings, and ledger reports. |

## 2. Multi-Tenant User Representation

```ts
interface IUserTenantMembership {
  tenantId: Types.ObjectId;
  tenantSlug: string;
  tenantName: string;
  roleName: string;
  isDefault: boolean;
  branchIds?: Types.ObjectId[];
  joinedAt: Date;
}
```
A user can be a `Company Owner` at Harn Company and an `Employee` at Hanson Company without permission bleeding across organizations.
