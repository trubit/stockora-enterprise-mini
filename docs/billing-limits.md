# Billing Limits & Concurrency Protection

## 1. Server-Side Limit Guard

Limits are strictly enforced in the backend via `requirePlanLimit(resourceKey, requestedIncrement)` middleware.

### Enforcement Rules:
1. **Never Trust Client**: Frontend disables buttons for UX, but the backend rejects requests with `403 PLAN_LIMIT_EXCEEDED` if quota is full.
2. **Explicit Unlimited**: Unlimited limits are marked with `unlimited: true` rather than arbitrary placeholder numbers like `9999999`.
3. **Concurrency Defense**: Concurrency races are validated against atomic database counts and transactions to prevent parallel burst creation past the threshold.

---

## 2. Non-Destructive Downgrade Handling

When a tenant downgrades to a plan with lower limits than existing resources:
1. Existing resources are **never deleted or modified**.
2. A conflict warning lists the resources currently over limit.
3. Creation of new resources in those categories is blocked until the tenant reduces usage or upgrades.
