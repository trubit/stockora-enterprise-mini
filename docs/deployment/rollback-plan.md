# Stockora Enterprise — Production Rollback Plan

## 1. Rollback Strategy & Trigger Criteria

A rollback is triggered when any of the following critical conditions are detected during or after a release:
- **HTTP 5xx error rate** exceeds 1.0% over a 5-minute rolling window.
- **P99 API response latency** exceeds 1,500ms for core endpoints (`/api/v1/pos/checkout`, `/api/v1/auth/login`).
- **Data corruption or tenant bleed** is reported or detected in audit logs.
- **Payment processing failure rate** exceeds 2.0% across Stripe/Paystack.

## 2. Immediate Rollback Execution Protocol

### Step 1: Traffic Switching (Blue/Green or Kubernetes Rollout)
```bash
# Revert Kubernetes deployment to previous stable revision
kubectl rollout undo deployment/prod-stockora-server -n stockora-production
kubectl rollout undo deployment/prod-stockora-client -n stockora-production

# Verify status
kubectl rollout status deployment/prod-stockora-server -n stockora-production
```

### Step 2: Database Migration Reversal (If Applicable)
- Check schema migration compatibility before taking down application instances.
- If data backwards-compatibility is maintained, keep database schema in place.
- In case of critical schema failure, restore point-in-time snapshot using the automated restore playbook:
```bash
aws docdb restore-db-cluster-to-point-in-time \
  --db-cluster-identifier stockora-prod-cluster-restored \
  --source-db-cluster-identifier stockora-prod-cluster \
  --restore-to-time "2026-09-11T18:00:00Z"
```

### Step 3: Cache Invalidation
```bash
# Flush stale Redis application keys to prevent schema mismatch
redis-cli -u $REDIS_URL --eval "return redis.call('del', unpack(redis.call('keys', 'stockora:cache:*')))"
```

### Step 4: Verification & Sign-Off
- Run smoke test suite against `/api/v1/health`.
- Confirm error rates return to 0.0% baseline.
- Post-incident post-mortem initiated within 2 hours.
