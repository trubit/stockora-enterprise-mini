# 🏢 Stockora Enterprise — Admin, Company & Staff Access Guide

> **Where this fits in the project:** `docs/admin-company-staff-access-guide.md`
> **Related docs:** [`multi-tenancy.md`](./multi-tenancy.md) · [`tenant-rbac.md`](./tenant-rbac.md) · [`tenant-onboarding.md`](./tenant-onboarding.md)

---

## 1. The Big Picture

Stockora Enterprise is a **multi-tenant SaaS platform**. Every piece of data — products, sales, customers, inventory — is **isolated per company (tenant)**. No company can ever see another company's data.

```
┌─────────────────────────────────────────────────────────┐
│                  🌐 STOCKORA PLATFORM                   │
│               (Platform Super Admin owns this)          │
├─────────────────────┬───────────────────────────────────┤
│   🏢 Harn Company   │       🏢 Hanson Company            │
│   (Tenant A)        │       (Tenant B)                  │
│                     │                                   │
│  ├─ 🏪 Branch HQ    │  ├─ 🏪 Branch Paris               │
│  ├─ 🏪 Branch Abuja │  └─ 🏪 Branch Berlin              │
│  └─ 🏗️ Warehouse    │                                   │
│                     │                                   │
│  Staff:             │  Staff:                           │
│  • Company Owner    │  • Company Owner                  │
│  • Branch Manager   │  • Branch Manager                 │
│  • Cashier          │  • Cashier                        │
│  • Accountant       │  • Accountant                     │
│  • Warehouse Mgr    │  • Warehouse Mgr                  │
│  • Auditor          │  • Auditor                        │
└─────────────────────┴───────────────────────────────────┘
```

---

## 2. Who Are The Admins?

### 2.1 🌐 Platform Super Admin

This is **the person who runs Stockora itself**.

| Field | Value |
|---|---|
| **Model field** | `isPlatformAdmin: true` in `User.ts` |
| **OR role name** | `roleName: 'Super Administrator'` |
| **Default seed email** | `admin@stockora.com` (set via `INITIAL_ADMIN_EMAIL` env var) |
| **Can access** | Every company on the entire platform |
| **Permission level** | Bypasses ALL role and tenant checks |

**How the code recognises them** — from `rbac.ts`:

```ts
if (isPlatformAdmin || roleName === 'Super Administrator' || roleName === 'admin' || roleName === 'Company Owner') {
  return next(); // Full access granted immediately
}
```

**What the Platform Admin can do:**

```http
# 1. View ALL companies across the platform
GET /api/tenants/admin/all
Authorization: Bearer <PLATFORM_ADMIN_JWT>

# 2. Suspend a misbehaving company
PATCH /api/tenants/admin/:tenantId/status
{ "status": "SUSPENDED" }

# 3. Inspect any company's data by passing its tenant ID in the header
GET /api/inventory/products
Authorization: Bearer <PLATFORM_ADMIN_JWT>
x-tenant-id: <HARN_COMPANY_TENANT_ID>
```

---

### 2.2 🏢 Company Owner

This is the **owner of one specific company**. Created automatically when a company is onboarded.

| Field | Value |
|---|---|
| **Role name** | `Company Owner` |
| **Permissions** | ALL permissions within their own tenant |
| **Can access** | Their company only — no cross-company access |
| **Seed example** | `owner@harncompany.com` (Harn Company) |

---

## 3. The 10 Built-In Roles

Defined in `src/shared/constants.ts` and seeded by `src/server/database/seeder.ts`.

| # | Role Name | Who Uses It | Access Level |
|---|---|---|---|
| 1 | `Super Administrator` | Platform owner | 🌐 Everything on all companies |
| 2 | `Company Owner` | Business owner | 🏢 Full access in their company |
| 3 | `Branch Manager` | Store manager | 🏪 All ops in their assigned branch |
| 4 | `Warehouse Manager` | Warehouse operator | 🏗️ Inventory, stock, transfers |
| 5 | `Cashier` | POS operator | 🖥️ POS sales only |
| 6 | `Inventory Manager` | Stock controller | 📦 Products + stock levels |
| 7 | `Sales Manager` | Sales team lead | 💼 Orders, quotes, customers |
| 8 | `Purchasing Manager` | Procurement lead | 🛒 Purchase orders, suppliers |
| 9 | `Accountant` | Finance staff | 💰 Finance, invoices, reports |
| 10 | `Read-Only Auditor` | Compliance/audit | 👁️ Read everything, write nothing |

---

## 4. Exact Permissions Per Role

Permissions are stored in the `Role` MongoDB collection and seeded automatically on first boot.

### 🏢 Company Owner & Super Administrator
```
users:read            users:write
roles:read            roles:write
companies:read        companies:write
branches:read         branches:write
warehouses:read       warehouses:write
products:read         products:write
transactions:read     transactions:write
suppliers:read        suppliers:write
customers:read        customers:write
finance:read          finance:write
reports:read          reports:write
audit:read
promotions:read       promotions:write
returns:read          returns:write
automation:read       automation:write
workflows:read        workflows:write
... (ALL permissions)
```

### 🏪 Branch Manager
```
products:read         products:write
transactions:read     transactions:write
warehouses:read
customers:read        customers:write
users:read
suppliers:read
```

### 🏗️ Warehouse Manager
```
products:read
warehouses:read       warehouses:write
suppliers:read
```

### 🖥️ Cashier
```
products:read
transactions:write
customers:read        customers:write
```

### 👁️ Read-Only Auditor
```
users:read            roles:read
companies:read        branches:read
warehouses:read       products:read
transactions:read     customers:read
suppliers:read        audit:read
```

---

## 5. How Access Control Works — 3 Layers on Every Request

Every API call goes through this exact pipeline:

```
HTTP Request
     │
     ▼
┌─────────────────────────────────┐
│  Layer 1: authMiddleware        │  ← Validates JWT token
│  middleware/auth.ts             │  ← Checks session in DB
│                                 │  ← Enforces IP allowlist/denylist
└─────────────────┬───────────────┘
                  │ req.user attached
                  ▼
┌─────────────────────────────────┐
│  Layer 2: resolveTenantContext  │  ← Reads x-tenant-id header
│  middleware/tenant.middleware.ts│  ← Verifies user is a MEMBER of that tenant
│                                 │  ← Attaches req.tenantId to request
└─────────────────┬───────────────┘
                  │ req.tenantId attached
                  ▼
┌─────────────────────────────────┐
│  Layer 3: rbacMiddleware        │  ← Checks role has required permissions
│  middleware/rbac.ts             │  ← e.g. ['products:write']
└─────────────────┬───────────────┘
                  │ authorized
                  ▼
            Controller → returns ONLY this tenant's data
```

**Branch-level scoping** is handled by a 4th layer — `abacMiddleware` — which ensures a cashier assigned to `Branch A` cannot access `Branch B`'s data even within the same company.

---

## 6. Full Staff Lifecycle — From Invitation to Daily Work

### Step 1 — Company Owner Invites Staff

```http
POST /api/tenants/invitations
Authorization: Bearer <COMPANY_OWNER_JWT>
x-tenant-slug: harn-company

{
  "email": "cashier1@harncompany.com",
  "roleName": "Cashier",
  "branchId": "<lagos_branch_id>"
}
```

This creates a `TenantInvitation` record with a unique token and sends an email to the staff member.

---

### Step 2 — Staff Member Registers & Accepts Invitation

If new to the platform, the staff member registers first:

```http
POST /api/auth/register
{
  "username": "cashier_emeka",
  "email": "cashier1@harncompany.com",
  "password": "MyPass123!",
  "roleName": "Cashier"
}
```

Then accepts the invitation using the token from the email:

```http
POST /api/tenants/invitations/accept
Authorization: Bearer <STAFF_JWT>
{
  "token": "<INVITATION_TOKEN_FROM_EMAIL>"
}
```

After acceptance, their `User` record looks like this:

```json
{
  "username": "cashier_emeka",
  "email": "cashier1@harncompany.com",
  "roleName": "Cashier",
  "tenantId": "<harn_tenant_id>",
  "branchId": "<lagos_branch_id>",
  "allowedBranches": ["<lagos_branch_id>"],
  "tenants": [
    {
      "tenantId": "<harn_tenant_id>",
      "tenantSlug": "harn-company",
      "tenantName": "Harn Company",
      "roleName": "Cashier",
      "branchId": "<lagos_branch_id>",
      "isDefault": true
    }
  ]
}
```

---

### Step 3 — Staff Logs In and Gets Their Scoped Token

```http
POST /api/auth/login
{
  "email": "cashier1@harncompany.com",
  "password": "MyPass123!"
}
```

Response:
```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<REFRESH>",
  "user": {
    "roleName": "Cashier",
    "tenantId": "<harn_tenant_id>",
    "branchId": "<lagos_branch_id>",
    "permissions": [
      "products:read",
      "transactions:write",
      "customers:read",
      "customers:write"
    ]
  }
}
```

The `permissions` array is fetched live from the `Role` collection — the frontend uses it to show/hide UI menu items.

---

## 7. What Each Role Does Every Day

### 🖥️ Cashier — Daily POS Flow

The cashier works entirely within their assigned branch and POS terminal.

```
1. Open register (set opening float)
   POST /api/v1/pos/register/open
   { "registerId": "T001", "branchId": "...", "openingFloat": 5000 }

2. Scan products & process a sale
   POST /api/v1/pos/checkout
   { "items": [...], "paymentMethod": "CASH", "cashierId": "..." }

3. Hold a sale (customer isn't ready)
   POST /api/v1/pos/hold

4. Resume the held sale
   POST /api/v1/pos/resume/:holdId

5. Print receipt
   GET /api/v1/pos/receipt/:orderNumber?width=80mm

6. Close register at end of shift
   POST /api/v1/pos/register/close
   { "registerId": "T001", "closingCash": 47350 }
```

**What a cashier CANNOT do:**
- ❌ Create or update products (`products:write` missing)
- ❌ View financial reports or invoices
- ❌ Access another branch's data (ABAC blocks it)
- ❌ Manage suppliers or purchase orders

---

### 🏪 Branch Manager — Daily Operations Flow

```
1. View branch sales summary
   GET /api/analytics/sales?branchId=<my_branch>

2. Manage products (read + write)
   GET /api/inventory/products
   PUT /api/inventory/products/:id

3. View and update customers
   GET /api/crm/customers
   PUT /api/crm/customers/:id

4. Read warehouse stock levels
   GET /api/org/warehouses

5. View all users at their branch
   GET /api/users
```

---

### 🏗️ Warehouse Manager — Stock & Inventory Flow

```
1. Receive goods from suppliers (put-away)
   POST /api/warehouse/put-away/tasks

2. Manage warehouse zones and locations
   GET /api/warehouse/zones
   POST /api/warehouse/locations

3. Process stock transfers between branches
   POST /api/transfers

4. Cycle count / stock reconciliation
   POST /api/warehouse/cycle-counts

5. View supplier list (read-only)
   GET /api/suppliers
```

---

### 💰 Accountant — Finance Flow

```
1. View and manage invoices
   GET /api/invoices
   POST /api/invoices

2. Record journal entries
   POST /api/finance/journal-entries

3. Run financial reports
   GET /api/reporting/financial

4. Manage accounts payable / receivable
   GET /api/finance/payables
   GET /api/finance/receivables

5. Track budgets
   GET /api/finance/budgets
```

---

### 👁️ Read-Only Auditor — Compliance View

```
GET /api/inventory/products        ✅ Allowed
GET /api/transactions              ✅ Allowed
GET /api/admin/audit-logs          ✅ Allowed
GET /api/finance/reports           ✅ Allowed

POST /api/inventory/products       ❌ 403 Forbidden
DELETE /api/transactions           ❌ 403 Forbidden
PUT /api/users/:id                 ❌ 403 Forbidden
```

---

## 8. Branch-Level Isolation (ABAC)

Beyond role permissions, users can be **restricted to specific branches** using Attribute-Based Access Control (`abacMiddleware` in `rbac.ts`).

```ts
const permitted =
  (branchId && branchId === targetBranchId) ||
  (allowedBranches && allowedBranches.includes(targetBranchId));
```

**Example:** A cashier assigned to Lagos tries to view Abuja's sales:

```
GET /api/v1/pos/held/abuja_branch_id
→ 403 Access Denied: You do not have permissions to access branch resource [abuja_branch_id]
```

| User | `branchId` | `allowedBranches` | Can access |
|---|---|---|---|
| Company Owner / Admin | none | none | All branches |
| Cashier Emeka | `lagos_id` | `["lagos_id"]` | Lagos only |
| Multi-branch Manager | `lagos_id` | `["lagos_id", "abuja_id"]` | Lagos + Abuja |

---

## 9. Real-World Example — Harn Company Full Setup

### Company Structure

```
Harn Company (Tenant: harn-company)
├── Lagos HQ Branch (BR-LGA-01)
│   ├── 🖥️ Cashier: cashier@harncompany.com → Terminal T001
│   └── 🏗️ Warehouse: Central WH (WH-MAIN-01)
└── Abuja Branch (BR-ABJ-02)
    └── 🖥️ Cashier: cashier2@harncompany.com → Terminal T002
```

### Seeded Default Users

| Username | Email | Role | Scope |
|---|---|---|---|
| `superadmin` | `admin@stockora.com` | Super Administrator | All companies |
| `harn_owner` | `owner@harncompany.com` | Company Owner | Harn Company |
| `harn_cashier` | `cashier@harncompany.com` | Cashier | Lagos HQ Branch |
| `hanson_owner` | `owner@hansoncompany.com` | Company Owner | Hanson Company |

### Full API Flow — Harn Cashier Makes a Sale

```http
# Step 1: Login
POST /api/auth/login
{ "email": "cashier@harncompany.com", "password": "Password123!" }

# Step 2: Open morning register
POST /api/v1/pos/register/open
Authorization: Bearer <CASHIER_JWT>
x-tenant-slug: harn-company
{
  "registerId": "T001",
  "registerName": "Lagos Till 1",
  "branchId": "lagos_id",
  "cashierId": "cashier_id",
  "cashierName": "Emeka",
  "openingFloat": 5000
}

# Step 3: Process a sale
POST /api/v1/pos/checkout
Authorization: Bearer <CASHIER_JWT>
x-tenant-slug: harn-company
{
  "cashierId": "cashier_id",
  "branchId": "lagos_id",
  "items": [
    { "productId": "prod_001", "qty": 2, "unitPrice": 4.99 },
    { "productId": "prod_002", "qty": 1, "unitPrice": 2.49 }
  ],
  "paymentMethod": "CASH",
  "amountTendered": 20.00
}
→ { "orderNumber": "ORD-2026-00412", "change": 7.53 }

# Step 4: Close register at end of shift
POST /api/v1/pos/register/close
Authorization: Bearer <CASHIER_JWT>
x-tenant-slug: harn-company
{ "registerId": "T001", "closingCash": 47350, "managerNotes": "No issues" }
```

---

## 10. Security Guarantees Summary

| Scenario | Result |
|---|---|
| Cashier tries to create a product | ❌ 403 — lacks `products:write` |
| Branch A cashier accesses Branch B | ❌ 403 — ABAC blocks it |
| Harn Company accesses Hanson's data | ❌ 403 — tenant membership check fails |
| Suspended company makes any API call | ❌ 403 — `requireActiveTenant` blocks all |
| Platform Admin accesses any company | ✅ — `isPlatformAdmin` bypasses all checks |
| Disabled feature called (e.g. loyalty) | ❌ 403 — `requireTenantFeature()` blocks it |
| Auditor tries to write any record | ❌ 403 — lacks all `:write` permissions |

---

## 11. Key File Reference

| File | Purpose |
|---|---|
| `src/server/models/User.ts` | User model — holds role, tenantId, branchId, allowedBranches |
| `src/server/models/Tenant.ts` | Company profile, features, limits, subscription tier |
| `src/server/models/Company.ts` | Company sub-profile (name, currency, tax) |
| `src/server/models/Branch.ts` | Branch locations tied to a tenant |
| `src/server/models/Role.ts` | Role names with their permission string arrays |
| `src/server/models/POSTerminal.ts` | POS terminal assigned to a branch and cashier |
| `src/shared/constants.ts` | `SYSTEM_ROLES` and `SYSTEM_PERMISSIONS` enums |
| `src/server/database/seeder.ts` | Seeds default roles, tenants, and users on first boot |
| `src/server/middleware/auth.ts` | JWT validation, IP filtering, session validation |
| `src/server/middleware/tenant.middleware.ts` | Resolves and validates tenant context per-request |
| `src/server/middleware/rbac.ts` | Role-based + attribute-based permission enforcement |
| `src/server/routes/tenant.routes.ts` | Onboarding, switching, invitations, admin ops |
| `src/server/routes/org.routes.ts` | Company, branch, warehouse management endpoints |
| `src/server/controllers/pos.controller.ts` | Checkout, hold/resume, register open/close |
| `src/server/controllers/tenant.controller.ts` | All tenant management business logic |

---

*Last updated: August 2026 — Stockora Enterprise v1.0*
