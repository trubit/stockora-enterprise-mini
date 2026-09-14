# Stockora Enterprise — Disaster Recovery & Business Continuity Plan

**Version:** 1.0.0 (Phase 49 Release Candidate)  
**Classification:** Mission-Critical / Enterprise Confidential  
**Target RPO (Recovery Point Objective):** <= 15 minutes  
**Target RTO (Recovery Time Objective):** <= 30 minutes  

---

## 1. Executive Summary & Objective

This document outlines the end-to-end Disaster Recovery (DR) and High Availability (HA) procedures for Stockora Enterprise. Stockora Enterprise manages multi-tenant retail operations, point of sale (POS) transactions, financial general ledgers, inventory ledgers, customer lifetime data, and subscription billing. 

The primary objectives are:
1. Guarantee data consistency and transactional atomicity across multi-tenant boundaries.
2. Maintain hot and warm replicas with continuous point-in-time recovery (PITR).
3. Ensure transparent failover for all active customer tenants, employees, and point-of-sale registers.

---

## 2. Recovery Objectives

| Metric | Target SLA | Strategy |
| :--- | :--- | :--- |
| **RPO (Data Loss Tolerance)** | < 15 minutes | Continuous MongoDB Oplog replication + 6-hour automated snapshot backups to cold offsite S3-compatible storage. Redis persistence configured with AOF (`appendfsync everysec`). |
| **RTO (Downtime Tolerance)** | < 30 minutes | Infrastructure as Code (IaC) automated deployments, Docker container automated orchestration, DNS failover through Cloudflare / Route 53 with 60-second TTL. |
| **Integrity SLA** | 100% | Zero double-spend, strict idempotency enforcement (`idempotencyKey` index on transactions & checkouts), double-entry journal balance invariant checks. |

---

## 3. Architecture Resiliency Matrix

```
                          [ Global DNS / CDN (Cloudflare) ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      [ Primary Region (Active) ]                 [ DR Secondary Region (Warm Standby) ]
       - Nginx / Reverse Proxy                     - Standby Reverse Proxy
       - Stockora Node App Clusters (x3)           - Cold/Warm Standby App Cluster
       - Redis Primary (AOF enabled)               - Redis Replica
       - MongoDB Replica Set (Primary/Sec)         - MongoDB Disaster Replica (Hidden / Non-voting)
```

### 3.1 MongoDB Data Persistence
- **Topology:** 3-node Replica Set (Primary, Secondary, Arbiter or Secondary in secondary AZ).
- **Storage Engine:** WiredTiger with journal compression and continuous PITR.
- **Backup Automation:**
  - Automated hourly incremental dumps using `mongodump --oplog`.
  - Daily full archive snapshots uploaded to immutable encrypted cloud storage buckets (AES-256 with retention policy: 90 days).
  - Validation test: Weekly automated restoration run into an isolated sandbox to verify snapshot integrity.

### 3.2 Redis Cache & Message Broker
- **Role:** Session storage, BullMQ background job queues, live analytics cache, circuit-breaker metrics, rate-limiting tokens.
- **Persistence:** AOF (`appendonly yes`, `appendfsync everysec`) and RDB periodic snapshots (`save 900 1 300 10 60 10000`).
- **Resilience:** BullMQ auto-reconnect with dead-letter queue (DLQ) persistent retention for webhook delivery events, notification emails, and inventory re-computations.

---

## 4. Disaster Recovery Scenarios & Playbooks

### Scenario A: Single Node / Container Failure
1. **Detection:** Docker daemon or orchestrator health checks fail on `/api/health` (5 consecutive failures).
2. **Action:** Auto-restart container instance. Load balancer immediately shifts ingress traffic to surviving healthy application replicas.
3. **Expected Impact:** Zero downtime; zero user impact.

### Scenario B: Database Primary Node Crash
1. **Detection:** Heartbeat loss detected by replica set nodes within 10 seconds.
2. **Action:** MongoDB replica set automatically elects the secondary node as new Primary.
3. **Connection String:** Application connection URI uses standard replica set syntax (`mongodb://node1,node2,node3/stockora?replicaSet=rs0`), causing Mongoose to seamlessly buffer and retry operations via native retryable writes.
4. **Expected Impact:** Brief 2–5 second write pause while election concludes. No data lost.

### Scenario C: Regional Data Center Catastrophic Outage
1. **Activation Trigger:** Primary data center inaccessible for > 5 minutes with unrecoverable host failure.
2. **Step 1: Declare Disaster:** DR Commander notifies incident team and activates warm standby site.
3. **Step 2: Database Promotion:** Promote secondary disaster replica to standalone Primary:
   ```bash
   mongosh --eval "rs.reconfig(forceConfig, { force: true })"
   ```
4. **Step 3: Point Application Nodes:** Spin up Stockora Enterprise application instances in target region using pre-built immutable container image tags (`stockora-enterprise:v1.0.0-rc1`).
5. **Step 4: DNS Redirection:** Update Cloudflare DNS A/CNAME records to new edge IP addresses.
6. **Step 5: Run Health Gate Validation:**
   ```bash
   curl -f https://app.stockora.enterprise/api/health
   curl -f https://app.stockora.enterprise/api/v1/auth/health
   ```
7. **Step 6: Notify Tenants:** Post public status update via external status page.

---

## 5. Data Restoration Runbook

### Restoring MongoDB from Offsite Snapshot
```bash
# 1. Download snapshot archive
aws s3 cp s3://stockora-backups-immutable/mongodb/2026-09-07_snapshot.archive.gz /tmp/

# 2. Perform restoration with oplog replay
mongorestore --gzip --archive=/tmp/2026-09-07_snapshot.archive.gz \
  --uri="mongodb://db-admin:SECRET@127.0.0.1:27017/stockora?authSource=admin" \
  --oplogReplay \
  --drop \
  --nsInclude="stockora.*"

# 3. Verify collection document counts and index build
mongosh "mongodb://127.0.0.1:27017/stockora" --eval "
  print('Users:', db.users.countDocuments());
  print('Tenants:', db.tenants.countDocuments());
  print('Transactions:', db.transactions.countDocuments());
  print('Products:', db.products.countDocuments());
"
```

### Restoring Redis State from RDB Snapshot
```bash
# 1. Stop Redis service
systemctl stop redis-server

# 2. Replace dump.rdb with verified backup
cp /backups/redis/dump-2026-09-07.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# 3. Restart Redis service
systemctl start redis-server
redis-cli ping
```

---

## 6. Post-Recovery Verification Checklist

- [ ] All database connections operational and writable (`readyState === 1`).
- [ ] Redis operational with memory within allocation budget.
- [ ] No unhandled exceptions on `/api/health` and `/api/v1/billing/health`.
- [ ] User authentication and token issuance functional.
- [ ] Active tenant isolation verified (cross-tenant queries return empty set).
- [ ] POS checkout transaction recorded successfully in sandbox branch.
- [ ] Background worker processes (BullMQ) consuming and executing jobs.
- [ ] Incident log and post-mortem scheduled within 48 hours.
