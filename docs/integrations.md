# Stockora Enterprise — Enterprise Integrations & Connectivity Architecture

## 1. Overview

Stockora Enterprise features a modular, multi-tenant Integration Hub allowing tenant enterprises to integrate external ERPs, accounting clouds, shipping carriers, messaging platforms, and custom REST gateways with zero-knowledge secret isolation.

```text
                         STOCKORA
                             │
                    INTEGRATION HUB
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
   REST APIs             Webhooks            Import/Export
        │                    │                    │
        ↓                    ↓                    ↓
 External Systems       External Systems       Files/Data
        │
 ┌──────┼────────┬────────────┬─────────────┐
 ↓      ↓        ↓            ↓             ↓
ERP   Accounting Shipping   Messaging    Custom API
```

---

## 2. Supported Adapters & Catalog

1. **QuickBooks Online** (`Accounting`): Invoices, charts of accounts, double-entry ledgers.
2. **Xero Accounting** (`Accounting`): Double-entry journal sync, invoice reconciliation.
3. **Shopify Plus** (`E-commerce`): Bi-directional catalog and order streaming.
4. **Slack Workspace** (`Messaging`): Real-time operations and inventory alerts.
5. **ShipStation** (`Shipping`): Automated carrier rate calculations and label generation.
6. **Custom REST Gateway** (`Custom`): HMAC-signed payloads for proprietary ERPs.

---

## 3. Resiliency & Circuit Breaker

Every external adapter execution passes through Stockora's **Resiliency Engine**:
* **Timeouts:** Fixed 8,000ms ceiling.
* **Backoff Strategy:** Exponential backoff with Full Jitter.
* **Circuit Breakers:** Tripped upon 5 consecutive failures, entering `HALF_OPEN` state after 10,000ms cooldown.
