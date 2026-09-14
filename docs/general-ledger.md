# General Ledger System & Audit Inquiry

## Overview
The General Ledger provides a complete, searchable record of all financial movements across all accounts.

### Query Capabilities
- Filter by Account Code, Date Range, Operational Source (`SALE`, `REFUND`, `PURCHASE`, `EXPENSE`, `MANUAL`, `REVERSAL`), Branch, and Tenant.
- Paginated response format preventing massive dataset memory bottlenecks.
- Compound database index on `{ tenantId: 1, 'lines.accountId': 1, postingDate: -1 }` for sub-millisecond retrieval.
