# Stockora Enterprise — Disaster Recovery & Business Continuity Plan

## 1. Objectives & Metrics

- **Recovery Point Objective (RPO)**: < 15 minutes (Max acceptable data loss).
- **Recovery Time Objective (RTO)**: < 30 minutes (Max acceptable downtime during total region failure).

## 2. Backup Strategy

| Component | Mechanism | Frequency | Retention Policy | Storage Location |
| :--- | :--- | :--- | :--- | :--- |
| **MongoDB / DocumentDB** | Automated Continuous Backups + Daily Snapshots | Continuous (1s granularity) + Daily at 02:00 UTC | 35 Days continuous + 1 Year weekly archives | AWS S3 (Cross-Region Encrypted) |
| **Redis Cache / Sessions** | RDB Snapshots + AOF (Append-Only File) | Hourly RDB + 1s AOF | 7 Days | Multi-AZ ElastiCache Replica |
| **Media / Asset Storage** | Multi-Region Bucket Replication | Synchronous on upload | Permanent / Policy-based | Cloudinary Multi-DC |
| **Infrastructure State** | Terraform State via S3 + DynamoDB Locking | Continuous on apply | Complete version history | AWS S3 Encrypted |

## 3. Restore & Failover Verification Runbook

### Primary Database Restoration Test
```bash
# 1. Restore DocumentDB cluster from latest daily snapshot
aws docdb restore-db-cluster-from-snapshot \
  --db-cluster-identifier stockora-prod-dr-restore \
  --snapshot-identifier arn:aws:rds:us-east-1:123456789012:cluster-snapshot:stockora-daily-latest \
  --engine docdb \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/stockora-kms-key

# 2. Update Kubernetes Secret with new connection string
kubectl patch secret stockora-secrets -n stockora-production \
  --type='json' -p='[{"op": "replace", "path": "/data/MONGODB_URI", "value": "<BASE64_URI>"}]'

# 3. Restart server pods to bind restored connection
kubectl rollout restart deployment/prod-stockora-server -n stockora-production
```
