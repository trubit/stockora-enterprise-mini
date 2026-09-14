# Dynamic Customer Segmentation Engine

## Overview
Allows administrators to define granular, dynamic audience segments using visual rule builders with real-time size preview.

### Supported Rule Fields & Operators
- **Fields**: `totalSpending`, `totalOrders`, `avgOrderValue`, `loyaltyTier`, `churnRiskLevel`, `daysSinceLastPurchase`, `customerType`, `tags`.
- **Operators**: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `IN`, `NOT_IN`, `CONTAINS`.
- **Logic**: `AND` / `OR` conjunction groups.

### Live Audience Preview
Evaluates rule queries against the tenant database before saving, reporting matched count and sample customer profiles.
