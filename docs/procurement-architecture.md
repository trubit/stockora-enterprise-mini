# Stockora Enterprise — Advanced Procurement & Automated Replenishment Architecture (Phase 38)

## Overview
Phase 38 builds the enterprise-grade **Advanced Procurement, Supplier Management & Automated Replenishment Engine** for Stockora Enterprise.

---

## Core Components

### 1. Supplier Scorecard & Ranking Matrix
- **Weighted Scorecard Formula**:
  $$\text{Score} = (\text{OnTimeDeliveryRate} \times 0.3) + (\text{QualityRate} \times 0.3) + (\text{PriceStabilityScore} \times 0.2) + (\text{FillRate} \times 0.2)$$
- **Multi-Criteria Ranking**: Sorts suppliers by unit cost (factoring volume quantity price breaks), overall scorecard rating, and lead time days.

### 2. Automated Replenishment Engine
- **Reorder Point (ROP) Formula**:
  $$\text{ROP} = (\text{DailyDemand} \times \text{LeadTimeDays}) + \text{SafetyStock}$$
- **Reorder Quantity**:
  $$\text{RequiredQty} = \max(0, \text{ROP} - \text{AvailableStock} - \text{IncomingStock})$$
  - Rounded up to Supplier Minimum Order Quantity (MOQ) and Order Multiples (pack sizes).
- **Multi-Warehouse Inter-Warehouse Transfer Recommendation**: Evaluates whether surplus stock in another facility can fulfill the shortage before recommending an external supplier purchase order.
- **Stockout Risk Levels**:
  - `CRITICAL`: Available Stock = 0
  - `HIGH`: Available Stock $\le$ Safety Stock
  - `MEDIUM`: Available Stock $\le$ Reorder Point
  - `LOW`: Available Stock $>$ Reorder Point

### 3. Purchase Order Versioning & Revisions
- Tracks version history (`PO Version 1` → `PO Version 2`) with revision audit logs.
- Supplier counter-proposal human review approval panel.

### 4. Landed Cost Allocation
- Distributes freight, customs duty, insurance, and handling fees into product inventory unit cost ledgers using `BY_VALUE`, `BY_QUANTITY`, or `EQUAL` allocation rules.

---

## Integration Test Suite
- `src/server/tests/procurementAutomatedReplenishment.test.ts` (100% passing).
