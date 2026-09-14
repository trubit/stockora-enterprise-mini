# Financial Security, Data Privacy & Multi-Tenant Isolation

## Overview
Financial data is governed by strict enterprise cybersecurity, OWASP ASVS standards, and multi-tenant scoping.

### Security Controls
1. **Multi-Tenant Isolation**: All queries enforce `{ tenantId }`. No tenant can read or modify another tenant's ledger, accounts, or bank statements.
2. **Role-Based Access Control (RBAC)**: Enforces `finance:read`, `finance:write`, and `transactions:write` permissions.
3. **Data Privacy**: Sensitive bank details, customer credit balances, and disbursement accounts are protected behind authenticated APIs.
