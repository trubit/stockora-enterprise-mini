# Tenant Feature Flags & Subscription Limits

## 1. Dynamic Feature Flags

Tenants have granular feature access control governed by boolean flags:

| Feature Key | Description |
|---|---|
| `pos` | Point-of-Sale checkout terminal interface and till operations. |
| `inventory` | Stock adjustments, batch/lot tracking, barcode generation. |
| `finance` | General ledger, journal entries, AR/AP, fiscal periods. |
| `crm` | Customer profiles, loyalty tiers, marketing campaigns. |
| `copilot` | AI Executive Assistant, natural language business intelligence. |
| `analytics` | Advanced reporting, custom report builder, export logs. |
| `wholesale` | Tiered B2B pricing, credit limits, volume discounts. |
| `ecommerce` | Multi-channel online storefront and order synchronization. |

### API Middleware Enforcement
The `requireTenantFeature('featureName')` middleware protects specific route groups:
```ts
router.use('/crm/advanced', requireTenantFeature('crm'), crmRouter);
router.use('/copilot/query', requireTenantFeature('copilot'), copilotRouter);
```

## 2. Resource Quotas & Limits

Enforced via `ITenantLimits`:
- `maxUsers`: Caps active team members (e.g. 5 on STARTER, 50 on GROWTH, unlimited on ENTERPRISE).
- `maxBranches`: Restricts total operational store locations.
- `maxWarehouses`: Restricts storage depots.
- `maxPOSTerminals`: Limits concurrent active POS register stations.
- `maxProducts`: Caps SKU catalog size.
- `maxStorageBytes`: Restricts media attachment and document upload storage.
