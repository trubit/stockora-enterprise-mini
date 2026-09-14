# Chart of Accounts Architecture & Hierarchy

## Overview
Stockora Enterprise organizes financial accounts into 6 fundamental account types with category classifications, hierarchy relationships, and multi-tenant scoping.

### Account Structure
| Code Range | Type | Category | Description | Normal Balance |
|---|---|---|---|---|
| **1000–1099** | `ASSET` | `CASH_AND_BANK` | Liquid Vault Cash, Operating Bank, POS Drawer Floats, Gateway Clearing | Debit |
| **1200–1299** | `ASSET` | `RECEIVABLE` | Accounts Receivable (Trade Debtors) | Debit |
| **1300–1399** | `ASSET` | `INVENTORY` | Merchandise Inventory & Warehouse Stock | Debit |
| **1500–1599** | `ASSET` | `NON_CURRENT_ASSET` | Store Fixtures, POS Terminals, Warehouse Equipment | Debit |
| **2000–2099** | `LIABILITY` | `PAYABLE` | Accounts Payable (Trade Creditors) | Credit |
| **2100–2199** | `LIABILITY` | `CURRENT_LIABILITY` | Sales Tax & Output VAT Payable | Credit |
| **3000–3099** | `EQUITY` | `OWNERS_EQUITY` | Contributed Shareholder Capital | Credit |
| **3100–3199** | `EQUITY` | `RETAINED_EARNINGS` | Cumulative Business Retained Earnings | Credit |
| **4000–4899** | `REVENUE` | `OPERATING_REVENUE` | POS, Online, Wholesale Sales Revenue | Credit |
| **4900–4999** | `REVENUE` | `OPERATING_REVENUE` | Sales Discounts, Contra-Revenue Returns | Debit |
| **5000–5999** | `COGS` | `COST_OF_GOODS_SOLD` | Cost of Goods Sold, Inbound Freight, Shrinkage | Debit |
| **6000–6999** | `EXPENSE` | `OPERATING_EXPENSE` | Rent, Utilities, Payroll, Marketing, Gateway Fees, Software | Debit |

### Multi-Tenant Isolation
Every account belongs to a specific `tenantId` and enforces unique `{ tenantId, code }` compound indexing.
