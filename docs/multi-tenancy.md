# Stockora Enterprise — Multi-Tenant SaaS & Company Management

## 1. Executive Summary

Stockora Enterprise transforms into a production-grade **Multi-Tenant Software-as-a-Service (SaaS) Platform**. Distinct enterprises (e.g. Harn Company, Hanson Company, and thousands of other global businesses) can operate concurrently on a single unified infrastructure while maintaining **strict logical data isolation**, custom branding, distinct fiscal and tax policies, independent branch/warehouse hierarchies, and granular RBAC.

---

## 2. Multi-Tenancy Design Principles

1. **Shared-Application, Isolated-Data Model**:
   - Single deployment serving multiple organizations.
   - Every operational data document in MongoDB contains an indexed `tenantId` field.
   - All backend queries, mutations, aggregations, and cache keys are strictly scoped by `tenantId`.

2. **Zero Trust Cross-Tenant Access**:
   - Client headers (`x-tenant-id`) are verified against authenticated user memberships in JWT and database.
   - Unauthorized cross-tenant requests are immediately rejected with `403 Forbidden`.

3. **Autonomous Tenant Administration**:
   - Company owners manage their own branding (colors, logos, receipt templates), fiscal calendars, feature flags, and team invitations without platform admin intervention.

4. **Multi-Company User Memberships**:
   - A single user account (e.g., an executive consultant or franchise owner) can hold memberships in multiple tenants with different roles in each company, switching seamlessly via the top navigation bar.

---

## 3. High-Level Tenant Hierarchy

```text
Platform Super-Administrator (Global Oversight)
  │
  ├── Tenant: Harn Company (harn-company)
  │     ├── Company Profile: Harn Enterprises Ltd
  │     ├── Branches:
  │     │     ├── Lagos Flagship Branch (HARN-LAG)
  │     │     └── Abuja Wholesale Depot (HARN-ABJ)
  │     ├── Warehouses: Central Lagos WH, Northern Depot
  │     ├── POS Terminals: POS-LAG-01, POS-LAG-02
  │     ├── Inventory / Catalog / Products / Categories
  │     ├── Customers / Loyalty / CRM Segments
  │     └── Financial Records / General Ledger / Fiscal Periods
  │
  └── Tenant: Hanson Company (hanson-company)
        ├── Company Profile: Hanson Global Corp
        ├── Branches: Victoria Island Store (HANS-VIC)
        ├── Warehouses: VI Logistics Center
        ├── POS Terminals: POS-VIC-01
        ├── Inventory / Products (Completely Isolated)
        └── Financial Records (Completely Isolated)
```

---

## 4. Key SaaS Capabilities

- **8-Step Onboarding Wizard**: Guided setup covering profile, business model, localization, primary branch, warehouse, POS terminal, team invitations, and final launch.
- **Dynamic Feature Flags**: Enable/disable POS, Wholesale, E-Commerce, Loyalty, AI Copilot, and Advanced Analytics per tenant.
- **Resource Quotas & Tier Limits**: Automated enforcement of maximum users, branches, warehouses, POS terminals, products, and storage limits.
- **Custom Theming & Receipt Layouts**: Per-tenant CSS variables, primary/secondary colors, logo rendering, and receipt header/footer customizations.
- **AI Context Isolation**: Prompt injection defense ensuring AI assistants query strictly within the authenticated tenant context.
