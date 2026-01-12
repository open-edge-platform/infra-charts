# infra-vpro Deployment Guide

## Overview

The `infra-vpro` chart consolidates vPro/AMT device management components into a single ArgoCD application:

- **MPS** (Management Presence Server) - CIRA connections
- **RPS** (Remote Provisioning Server) - Device activation (ACM/CCM)
- **DM-Manager** - Power management operations
- **Inventory** - Device tracking and metadata

## Architecture

```
┌─────────────────────────────────────────────┐
│         infra-vpro (orch-infra)             │
│                                             │
│  ┌───────┐  ┌───────┐  ┌────────────┐     │
│  │  MPS  │  │  RPS  │  │ DM-Manager │     │
│  └───────┘  └───────┘  └────────────┘     │
│                                             │
│            ┌───────────┐                    │
│            │ Inventory │                    │
│            └───────────┘                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Platform Services (orch-platform,      │
│             orch-database)                  │
│                                             │
│  Vault    Keycloak    PostgreSQL            │
└─────────────────────────────────────────────┘
```

## Prerequisites

**Already Deployed:**
- ✅ Vault (orch-platform)
- ✅ Keycloak (orch-platform)
- ✅ PostgreSQL (orch-database)
- ✅ ArgoCD

## Deployment Steps

### 1. Current State (Before)

Components deployed via separate charts:
```bash
kubectl get application -n argocd | grep -E 'infra-core|infra-external'
# infra-core → includes inventory
# infra-external → includes amt (mps, rps, dm-manager)
```

### 2. Enable vPro Profile

Add `enable-vpro` to your preset configuration or cluster config:

```yaml
# In your preset file or cluster configuration
profiles:
  - enable-platform
  - enable-vpro  # ← Add this
```

This will:
- ✅ Enable `infra-vpro` application
- ❌ Disable `amt` from `infra-external`
- ❌ Disable `inventory` from `infra-core`

### 3. Deploy with Mage

```bash
# Deploy with vpro profile
mage -v deploy:kindPreset ../scorch/presets/dev-internal-coder-autocert.yaml

# Or create a new preset for vpro testing
mage -v deploy:kindPreset ../scorch/presets/dev-vpro.yaml
```

### 4. Verify Deployment

```bash
# Check ArgoCD application status
kubectl get application -n argocd infra-vpro

# Check pods in orch-infra
kubectl get pods -n orch-infra | grep -E 'mps|rps|dm-manager|inventory'

# Expected output:
# mps-xxxxx           2/2  Running
# rps-xxxxx           2/2  Running
# dm-manager-xxxxx    2/2  Running
# inventory-xxxxx     2/2  Running

# Check ArgoCD sync status
kubectl get application infra-vpro -n argocd -o jsonpath='{.status.sync.status}'
# Should show: Synced
```

### 5. Verify Services

```bash
# Check services
kubectl get svc -n orch-infra | grep -E 'mps|rps|dm-manager|inventory'

# Test MPS endpoint
kubectl port-forward -n orch-infra svc/mps 4433:4433

# Test RPS endpoint
kubectl port-forward -n orch-infra svc/rps 8081:8081

# Test DM-Manager endpoint
kubectl port-forward -n orch-infra svc/dm-manager 8080:8080
```

## Migration from Separate Charts

### Option A: Clean Deployment (Recommended for Testing)

1. **Delete existing components:**
```bash
# Delete old deployments
kubectl delete application infra-external -n argocd
kubectl delete application infra-core -n argocd

# Wait for cleanup
kubectl wait --for=delete pod -n orch-infra -l app.kubernetes.io/name=mps --timeout=120s
kubectl wait --for=delete pod -n orch-infra -l app.kubernetes.io/name=rps --timeout=120s
kubectl wait --for=delete pod -n orch-infra -l app.kubernetes.io/name=dm-manager --timeout=120s
kubectl wait --for=delete pod -n orch-infra -l app.kubernetes.io/name=inventory --timeout=120s
```

2. **Deploy with vpro profile:**
```bash
mage -v deploy:kindPreset ../scorch/presets/dev-vpro.yaml
```

### Option B: In-Place Migration (Safer for Production)

1. **Add vpro profile to existing deployment:**
```yaml
# Add to your cluster config
profiles:
  - enable-platform
  - enable-edgeinfra  # Keep existing
  - enable-vpro       # Add new
```

2. **Apply configuration:**
```bash
mage -v deploy:kindPreset ../scorch/presets/dev-internal-coder-autocert.yaml
```

3. **ArgoCD will automatically:**
   - Deploy `infra-vpro`
   - Disable amt in `infra-external`
   - Disable inventory in `infra-core`
   - Sync changes with minimal downtime

## Configuration

### Enable/Disable Components

```yaml
# In argocd/applications/custom/infra-vpro.tpl
argo:
  infra-vpro:
    import:
      amt:
        enabled: true      # All AMT components
      inventory:
        enabled: true      # Inventory service
    
    amt:
      mps:
        enabled: true      # Individual control
      rps:
        enabled: true
      dm-manager:
        enabled: true
```

### Resource Limits

```yaml
# In custom/infra-vpro.tpl
argo:
  infra-vpro:
    amt:
      mps:
        resources:
          limits:
            cpu: 500m
            memory: 512Mi
          requests:
            cpu: 100m
            memory: 128Mi
```

## Troubleshooting

### Application Not Syncing

```bash
# Check application status
kubectl describe application infra-vpro -n argocd

# View sync errors
argocd app get infra-vpro

# Force sync
argocd app sync infra-vpro --force
```

### Pods Not Starting

```bash
# Check pod events
kubectl describe pod -n orch-infra <pod-name>

# Check logs
kubectl logs -n orch-infra <pod-name>

# Verify platform services are accessible
kubectl get pods -n orch-platform
kubectl get pods -n orch-database
```

### Database Connection Issues

```bash
# Verify PostgreSQL databases exist
kubectl exec -it -n orch-database postgresql-cluster-1 -- psql -U postgres -c "\l" | grep -E 'mpsdb|rpsdb|inventory'

# Check Vault secrets
kubectl exec -n orch-platform vault-0 -- vault kv list secret/
```

## Rollback

### Remove vpro Profile

1. **Remove from preset:**
```yaml
profiles:
  - enable-platform
  - enable-edgeinfra
  # - enable-vpro  ← Remove this
```

2. **Redeploy:**
```bash
mage -v deploy:kindPreset ../scorch/presets/dev-internal-coder-autocert.yaml
```

3. **ArgoCD will:**
   - Delete `infra-vpro` application
   - Re-enable amt in `infra-external`
   - Re-enable inventory in `infra-core`

## Testing Workflow

### Complete Test Cycle

```bash
# 1. Current state check
kubectl get application -n argocd | grep -E 'infra-core|infra-external|infra-vpro'
kubectl get pods -n orch-infra | grep -E 'mps|rps|dm-manager|inventory'

# 2. Delete existing (if needed)
kubectl delete application infra-external -n argocd --wait=false
kubectl delete application infra-core -n argocd --wait=false

# 3. Deploy with vpro
mage -v deploy:kindPreset ../scorch/presets/dev-vpro.yaml

# 4. Monitor deployment
watch kubectl get application -n argocd infra-vpro
watch kubectl get pods -n orch-infra

# 5. Verify functionality
kubectl port-forward -n orch-infra svc/mps 4433:4433 &
curl -k https://localhost:4433/health

kubectl port-forward -n orch-infra svc/rps 8081:8081 &
curl http://localhost:8081/api/v1/health

kubectl port-forward -n orch-infra svc/dm-manager 8080:8080 &
curl http://localhost:8080/api/v1/health
```

## Next Steps

After successful deployment:

1. **Configure edge nodes** using Ansible installer
2. **Test device activation** (ACM/CCM modes)
3. **Test power operations** (on/off/cycle)
4. **Monitor with Grafana/Prometheus**

## Support

For issues:
- Check ArgoCD application logs: `argocd app logs infra-vpro`
- Review pod logs: `kubectl logs -n orch-infra <pod-name>`
- Check events: `kubectl get events -n orch-infra --sort-by='.lastTimestamp'`
