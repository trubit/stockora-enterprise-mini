# Financial Reconciliation & Payment Gateway Audits

## Overview
Reconciles external transaction records against internal ledger balances to ensure $100\%$ accounting accuracy.

### Key Reconciliation Capabilities
1. **Paystack / Gateway Batch Settlements**:
   - Matches Gross Sales Amount vs Gateway Fee Deductions vs Net Settlement Payouts.
   - Posts: $\text{Debit: Operating Bank (1010) [Net]} + \text{Debit: Gateway Fee Expense (6400) [Fee]}, \text{Credit: Gateway Clearing (1030) [Gross]}$.
2. **POS Cash Drawer Shift Reconciliations**:
   - Reconciles expected drawer cash against actual physically counted cash.
   - Shortages post to variance expense; overages post to miscellaneous revenue.
