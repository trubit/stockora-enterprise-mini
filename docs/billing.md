# SaaS Billing Architecture & Tenant Monetization

## 1. Overview
Stockora Enterprise employs a multi-tenant SaaS monetization architecture designed specifically for Nigerian and international retail enterprises. The billing engine decouples platform catalog administration from tenant-specific subscriptions, providing isolated billing cycles, metered resource enforcement, Paystack gateway verification, and immutable invoicing.

---

## 2. Architectural Components

```text
┌──────────────────────────────────────────────────────────┐
│                STOCKORA MONETIZATION ENGINE              │
└──────────────────────────────────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ↓                       ↓                       ↓
[Plan Catalog]     [Usage Metering Engine]     [Billing Engine]
(Tiers, Limits,    (Redis + MongoDB Sync,      (Paystack Gateway,
 Features, Pricing) Multi-Resource Meters)      Webhooks, Invoices)
```

---

## 3. Core Database Models

| Model | Description | Multi-Tenant Scoping |
| :--- | :--- | :--- |
| `Plan` | Configurable pricing tiers, feature toggles, limits, and trial rules | Global / Platform |
| `Subscription` | Active tenant subscription with immutable plan snapshot | `tenantId` indexed |
| `BillingTransaction` | Payment transactions with gateway references and refund states | `tenantId` indexed |
| `BillingInvoice` | Sequence-generated SaaS invoices with VAT calculation | `tenantId` indexed |
| `TenantUsage` | Billing period resource usage metrics | `tenantId` + `billingPeriod` |
| `BillingAuditLog` | Auditable ledger of all subscription and billing events | `tenantId` indexed |

---

## 4. Key Endpoints

- `GET /api/v1/billing/plans`: Retrieve active public plans.
- `GET /api/v1/billing/subscription`: Retrieve active tenant subscription.
- `POST /api/v1/billing/subscription/initialize`: Initialize Paystack checkout.
- `POST /api/v1/billing/subscription/verify`: Server-side verification and activation.
- `POST /api/v1/billing/subscription/change-plan`: Immediate upgrade or non-destructive downgrade.
- `POST /api/v1/billing/subscription/cancel`: Immediate or period-end cancellation.
- `POST /api/v1/billing/subscription/reactivate`: Revert pending cancellation.
- `GET /api/v1/billing/invoices`: Tenant SaaS invoices list.
- `GET /api/v1/billing/usage`: Real-time metered resource counters and percentages.
