# CRM Security, Multi-Tenant Isolation & Access Control

## Overview
Customer data is governed by enterprise cybersecurity standards, OWASP Top 10 guidelines, and strict multi-tenant boundaries.

### Security Controls
1. **Multi-Tenant Scoping**: All database queries enforce `{ tenantId }`. No tenant can query or modify another tenant's customers, loyalty accounts, or campaign recipients.
2. **Role-Based Access Control (RBAC)**: Enforces `customers:read`, `customers:write`, `promotions:read`, and `promotions:write` permissions.
3. **Idempotency Protection**: All point redemptions and campaign delivery jobs utilize idempotency keys to prevent double spending and duplicate transmissions.
