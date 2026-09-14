# Expense Management & Multi-Level Approvals

## Overview
Tracks operational, administrative, and capital expenditures with configurable categories, receipt attachments, and multi-tier approval workflows.

### Workflow & Limits
1. **Submission**: Employees or managers submit expense requests with category, amount, tax, and optional receipt URL.
2. **Auto-Approval Threshold**: Expenses $\le \$100$ are automatically approved and posted.
3. **Manager Approval**: Expenses $> \$100$ enter `PENDING_APPROVAL` status.
4. **General Ledger Integration**: Once approved, double-entry journal is posted: $\text{Debit: Operating Expense Account (6000-6600)}, \text{Credit: Cash/Bank Account (1000/1010)}$.
