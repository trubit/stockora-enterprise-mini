# Stockora Enterprise — Analytics Security & Data Governance

## Security Standards Enforced
- **Authentication**: JWT token validation on all `/api/v1/analytics/*` routes via `authMiddleware`.
- **Role-Based Access Control (RBAC)**: Enforced via `rbacMiddleware` (`reports:read`, `reports:write`, `branches:read`, `warehouses:read`, `suppliers:read`, `customers:read`).
- **Multi-Tenant Data Isolation**: Every MongoDB aggregation query is bounded by `tenantId` and optional `branchId`.
- **Redis Cache Isolation**: Cache keys are strictly prefixed with `analytics:{tenantId}:{branchId}:...` ensuring Tenant A can never view or pollute Tenant B's cached aggregates.
- **Audit Logging**: AI queries and report exports are logged to the `AuditLog` collection with actor ID, IP address, and parameters.
