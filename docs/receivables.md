# Accounts Receivable (AR) & Customer Credit

## Overview
Accounts Receivable tracks outstanding balances owed by customers from credit sales and commercial invoicing.

### Aging Buckets
- **Current**: Invoices before or on due date.
- **1–30 Days**: Overdue by 1 to 30 days.
- **31–60 Days**: Overdue by 31 to 60 days.
- **61–90 Days**: Overdue by 61 to 90 days.
- **90+ Days**: Critical overdue balances requiring immediate recovery actions.

### Credit Limits
Before confirming credit sales, total customer exposure ($\text{Outstanding AR} + \text{New Order}$) is validated against `Customer.creditLimit`.
