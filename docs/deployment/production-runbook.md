# Stockora Enterprise — Production Operations Runbook

## 1. Routine Operational Commands

### Health Checks & Status
```bash
# Cluster Pod Status
kubectl get pods -n stockora-production -o wide

# Application Health Probes
curl -fsSL https://api.stockora.enterprise/api/v1/health
curl -fsSL https://app.stockora.enterprise/
```

### Log Inspection & Telemetry
```bash
# Stream API Server Logs
kubectl logs -f deployment/prod-stockora-server -n stockora-production --tail=100

# Stream Client Ingress Logs
kubectl logs -f deployment/prod-stockora-client -n stockora-production --tail=100
```

## 2. Horizontal Scaling & Resource Management
```bash
# Scale API Server Pods
kubectl scale deployment/prod-stockora-server --replicas=5 -n stockora-production

# Check Horizontal Pod Autoscaler (HPA)
kubectl get hpa -n stockora-production
```

## 3. Maintenance Procedures

### Rotating Database Credentials
1. Generate new MongoDB SCRAM user credentials with least privilege.
2. Update AWS Secrets Manager / Kubernetes Secret:
   ```bash
   kubectl create secret generic stockora-secrets \
     --from-literal=MONGODB_URI="mongodb://user:newpass@cluster.mongodb.net/stockora?ssl=true&replicaSet=rs0" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
3. Execute rolling restart of server deployment:
   ```bash
   kubectl rollout restart deployment/prod-stockora-server -n stockora-production
   ```
