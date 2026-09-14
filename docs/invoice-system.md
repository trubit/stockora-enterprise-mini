# SaaS Invoice System

## 1. Structure
SaaS Invoices (`BillingInvoice`) are distinct from commerce/POS receipts:
- Unique sequence numbering: `INV-SAAS-YYYY-XXXXX`
- Full tenant billing address and contact details
- Tax calculation based on Nigerian standard VAT (7.5%) or tenant custom tax configuration
- Line items detailing the plan tier, billing period, and itemized addons
- Transaction reference link back to Paystack transaction

---

## 2. Invoicing States
- `DRAFT`: Generated prior to confirmation
- `OPEN`: Issued and awaiting settlement
- `PAID`: Payment verified by Paystack
- `VOID`: Cancelled or superseded
- `REFUNDED`: Full or partial refund issued
- `OVERDUE`: Past due date without payment
