# Stockora Enterprise — Analytics Architecture

## Overview
Stockora Enterprise Phase 40 delivers an enterprise-grade Business Intelligence and Decision Intelligence pipeline. It aggregates real-time data from Point of Sale, Omnichannel Sales Orders, Inventory Locations, Warehouse Logistics, Procurement Workflows, and CRM into high-performance executive metrics.

---

## Core Architecture

```
POS / Orders / Inventory / Procurement / Payments
                     ↓
             Typed Event Bus
                     ↓
        Multi-Tenant Redis Caching
                     ↓
        BusinessIntelligenceService
                     ↓
        DecisionIntelligenceService
                     ↓
        Executive Intelligence API
                     ↓
        Executive Dashboard UI
```

---

## Unified Analytics API Endpoints

All endpoints are mounted under `/api/v1/analytics` and strictly enforced with JWT authentication and Role-Based Access Control (RBAC).

| Endpoint | Method | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `/analytics/executive` | `GET` | `reports:read` | Executive summary metrics with multi-period growth comparison |
| `/analytics/sales-trend` | `GET` | `reports:read` | Multi-resolution time-series sales trends (Hourly, Daily, Monthly) |
| `/analytics/channels` | `GET` | `reports:read` | Channel revenue breakdown (POS, Online, B2B, Wholesale) |
| `/analytics/branches` | `GET` | `branches:read` | Multi-branch financial & performance comparison |
| `/analytics/warehouses` | `GET` | `warehouses:read` | Warehouse movement velocity, picking, and stock accuracy |
| `/analytics/inventory-health` | `GET` | `products:read` | Healthy, low, critical, overstock, and dead stock metrics |
| `/analytics/stockouts` | `GET` | `products:read` | Stockout risk counts, durations, and estimated lost sales |
| `/analytics/products` | `GET` | `products:read` | 4-Quadrant BCG Matrix (Star, Cash Cow, Question Mark, Dog) |
| `/analytics/customer-cohorts` | `GET` | `customers:read` | Monthly registration cohort retention heatmap matrix |
| `/analytics/suppliers` | `GET` | `suppliers:read` | Supplier scorecards (on-time %, defect %, lead times) |
| `/analytics/cash-registers` | `GET` | `transactions:read` | Terminal register sessions & closing variance audits |
| `/analytics/health-score` | `GET` | `reports:read` | Transparent weighted 0-100 overall business health rating |
| `/analytics/briefing` | `GET` | `reports:read` | Daily automated executive morning briefing |
| `/analytics/alerts` | `GET` | `reports:read` | Real-time business anomaly intelligence alerts |
| `/analytics/ai/assistant` | `POST` | `reports:read` | Scoped conversational AI executive advisor |
| `/analytics/ai/forecast` | `POST` | `reports:read` | Autoregressive sales forecasting with p10/p90 confidence bands |
| `/analytics/ai/simulate-price` | `POST` | `reports:read` | What-If price elasticity simulation ($\pm 5\%, \pm 10\%$) |
| `/analytics/ai/simulate-inventory` | `POST` | `reports:read` | What-If stock reorder coverage simulator |
| `/analytics/ai/simulate-supplier` | `POST` | `reports:read` | What-If supplier comparison scenario simulator |
| `/analytics/export` | `POST` | `reports:read` | Server-side report exports (CSV, XLSX, JSON) |

---

## Multi-Tenant Cache Strategy
All aggregation queries are keyed by tenant and branch:
`analytics:{tenantId}:{branchId || 'all'}:{period}:{comparison}`
Cached in Redis with a 180s to 600s TTL and auto-invalidated when underlying mutations occur.
