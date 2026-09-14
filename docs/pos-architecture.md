# Stockora Enterprise — Advanced POS & Omnichannel Commerce Architecture (Phase 39)

## Overview
Phase 39 builds the **Advanced POS, Omnichannel Sales & Commerce Intelligence Engine** for Stockora Enterprise, unifying in-store POS terminals, e-commerce web sales, B2B wholesale orders, and mobile transactions into one server-validated order, payment, inventory reservation, and analytics pipeline.

---

## Architecture Components

### 1. Unified Commerce Pipeline
- Every sales channel (`POS`, `ONLINE`, `B2B`, `WHOLESALE`, `MARKETPLACE`, `MOBILE`) executes through a single server-side checkout validation pipeline:
  $$\text{Cart} \rightarrow \text{Pricing} \rightarrow \text{Promotions} \rightarrow \text{Tax} \rightarrow \text{Customer Credit} \rightarrow \text{Inventory Reservation} \rightarrow \text{Payment Allocation} \rightarrow \text{Receipt/Invoice}$$

### 2. POS Terminal & Register Sessions
- **`POSTerminal` Model**: Tracks terminal IDs, assigned branch/warehouse, cashier assignments, and hardware configuration.
- **`RegisterSession` Model**: Tracks opening float, cash movements (`PETTY_CASH`, `SAFE_DROP`, `CASH_IN`, `CASH_OUT`), expected cash, counted closing cash, and variance reconciliation explanations.
- **Hold / Resume Sales**: Temporarily suspends customer carts with hold IDs (`HOLD-XXXXXX`) and restores them back into active POS operator sessions.

### 3. Payment Gateway & Paystack Integration
- **Split Payments**: Supports multi-method payment allocations (e.g. $150 Cash + $154.50 Card).
- **Paystack Webhook Security**: HMAC SHA-512 signature verification (`X-Paystack-Signature`) and idempotency checks to prevent duplicate charges.

### 4. Resilient Offline POS Foundation
- Queueing of offline transactions with unique idempotency keys:
  $$\text{IdempotencyKey} = \text{TerminalID} + \text{SessionID} + \text{TransactionID}$$
- Automatic server reconnection, server-side stock reconciliation, and duplicate transaction deduplication.

### 5. Sales Returns & Inspection Dispositions
- Integrates Phase 37 stock receiving inspection:
  - `RESTOCK`: Adds items back to available inventory.
  - `QUARANTINE`: Holds items for quality testing.
  - `DAMAGED`: Scraps items into inventory loss ledgers.

---

## Integration Test Suite
- `src/server/tests/omnichannelCommercePOS.test.ts` (10/10 tests passing).
