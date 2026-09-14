# Usage Metering Architecture

## 1. Overview
The `UsageMeteringService` provides centralized, multi-resource usage tracking.

### 11 Metered Resources:
1. `users`: Active team accounts with system login rights
2. `branches`: Active physical retail store branches
3. `warehouses`: Active storage & logistics centers
4. `posTerminals`: Active checkout POS terminals
5. `products`: Active catalog SKUs and master items
6. `customers`: CRM customer profiles
7. `orders`: Sales orders processed during the current billing period
8. `storageMb`: Total asset and document storage allocation (MB)
9. `apiRequestsMonthly`: External REST API requests processed
10. `aiRequestsMonthly`: Copilot AI token / request prompts consumed
11. `automations`: Active background workflow automation bots

---

## 2. Reconciled Counters & Redis Cache

- **Fast Checks**: Ephemeral counters use atomic Redis `INCRBY` / `GET` commands.
- **Authoritative Database Source**: Periodic background reconciliation computes exact counts from MongoDB collections (`User`, `Branch`, `Warehouse`, `Product`, etc.).
- **Warning Thresholds**:
  - `< 75%`: Normal (Green)
  - `75% - 89%`: Warning 75% (Yellow)
  - `90% - 99%`: Critical 90% (Orange)
  - `100%`: Exceeded (Red) - Server blocks additional resource creation.
