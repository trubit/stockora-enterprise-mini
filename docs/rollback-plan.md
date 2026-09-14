# Stockora Enterprise — Production Rollback Plan

**Version:** 1.0.0 (Phase 49 Release Candidate)  
**Scope:** Immediate Reversion Protocol for Failed or Degraded Production Deployments  
**Classification:** Operational Security / Release Gate Document  

---

## 1. Principles of Rollback

1. **Safety First:** If unexpected data corruption, critical authorization breach, or cascading runtime 500 errors occur upon deployment, rollback is triggered without hesitation.
2. **Speed:** Rollback execution target is **< 5 minutes** using pre-tested container images and blue-green traffic switching.
3. **Database Backward Compatibility:** Database migrations must always follow the **Expand/Contract (Two-Phase)** migration pattern. Code in version $N$ must never break backward compatibility with database schema from version $N-1$.
4. **Audit Trail:** Every rollback action is logged with timestamp, operator identity, rationale, and diff hashes.

---

## 2. Trigger Conditions (Rollback Thresholds)

A rollback MUST be initiated immediately if any of the following conditions are met within the first 60 minutes of deployment:

| Condition | Threshold | Detection Method |
| :--- | :--- | :--- |
| **HTTP 5xx Spike** | > 1.0% of total requests over a 3-minute window | APM / Prometheus / Datadog alerts |
| **API Latency Degradation** | P95 latency > 800ms (normal: < 120ms) | Load balancer metrics |
| **Authentication / Login Failures** | > 5% token issuance failure rate | `/api/v1/auth/login` error counters |
| **Payment / Checkout Faults** | Any unhandled exception during checkout or gateway callback | Alert on `error.code === 'CHECKOUT_FAILURE'` |
| **Multi-Tenant Leak** | ANY cross-tenant data leak or authorization boundary violation | Security audit log alert |
| **Container Crash Loop** | Restart count > 3 across application pods | Docker / Kubernetes status |

---

## 3. Rollback Procedures

### 3.1 Blue-Green Traffic Redirection (Instant Rollback)

In a Blue-Green deployment setup, the previous stable version (Blue) remains active in warm standby while the new version (Green) receives traffic.

```bash
# 1. Immediate traffic cutover back to Blue cluster
nginx -s reload -c /etc/nginx/sites-available/stockora-blue.conf

# 2. Or via Cloudflare / Load Balancer routing weight:
# Set Weight(Green) = 0, Weight(Blue) = 100

# 3. Verify traffic shift
curl -I https://app.stockora.enterprise/api/health
# Response header should indicate: X-Release-Version: v0.48.0 (or previous stable tag)
```

### 3.2 Container Image Reversion (Docker / Compose / K8s)

If running single-cluster container orchestration:

```bash
# Re-tag and deploy previous known good image
docker pull ghcr.io/stockora/stockora-enterprise:v0.48-stable

docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --no-build

# Verify healthy startup
docker compose ps
docker compose logs -f --tail=100
```

### 3.3 Database Migration Reversion

If the deployment included a schema migration:
1. Verify whether the migration added new optional fields or modified existing data.
2. If the migration was additive (standard policy), **no database rollback is necessary**. The previous code version ignores the new fields safely.
3. If a destructive migration occurred that requires schema reversal:
   ```bash
   # Run backward migration script
   npm run migrate:down
   
   # Or restore pre-deployment point-in-time backup
   mongorestore --gzip --archive=/backups/pre-deploy-v0.49-snapshot.archive.gz --nsInclude="stockora.*"
   ```

### 3.4 Redis Cache Invalidation

After code reversion, stale cached models and analytics may cause frontend mismatches. Flush volatile caches:

```bash
# Clear API response & analytics caches without clearing user active sessions
redis-cli --scan --pattern "reporting:*" | xargs -r redis-cli del
redis-cli --scan --pattern "analytics:*" | xargs -r redis-cli del
redis-cli --scan --pattern "pos:cache:*" | xargs -r redis-cli del
```

---

## 4. Post-Rollback Verification & Triage

1. **Health Check Validation:**
   ```bash
   curl -s https://app.stockora.enterprise/api/health | jq .
   # Verify { "status": "UP", "database": "CONNECTED", "redis": "CONNECTED" }
   ```
2. **Smoke Test Execution:**
   - Execute automated smoke test suite against production endpoint.
   - Verify cashier POS login and dummy item checkout.
   - Verify tenant admin dashboard loading.
3. **Internal Stakeholder Communication:**
   - Post update to `#engineering-incidents` on Slack/Teams.
   - Update external status page with investigation notice.
4. **Post-Mortem Requirements:**
   - Incident post-mortem document created within 24 hours.
   - Root cause analysis (RCA) including logs, stack trace, and regression test case added to test suite before re-release.
