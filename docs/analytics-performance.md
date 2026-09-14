# Stockora Enterprise — Analytics Performance & Optimization

## Optimization Mechanisms
1. **Multi-Tier Caching**:
   - Primary: In-memory Redis key-value cache (180s – 600s TTL).
   - Secondary: MongoDB `AnalyticsCache` collection for persistent fallback when Redis restarts.
2. **Compound Database Indexes**:
   - `Transaction`: `{ tenantId: 1, branchId: 1, status: 1, createdAt: -1 }`
   - `SalesOrder`: `{ tenantId: 1, channelCode: 1, status: 1, createdAt: -1 }`
   - `Product`: `{ tenantId: 1, isActive: 1, quantity: 1 }`
   - `PurchaseOrder`: `{ tenantId: 1, status: 1, createdAt: -1 }`
3. **Optimized Pipelines**: Aggregations project only required numeric fields before group stages.
