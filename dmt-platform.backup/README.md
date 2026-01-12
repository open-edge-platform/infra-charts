# DMT Platform Helm Chart

Device Management Toolkit (DMT) for Out-of-Band device management using Intel vPro/AMT technology.

## Overview

This Helm chart deploys the DMT platform components required for Out-of-Band device management:

- **MPS** (Management Presence Server) - Handles CIRA connections from edge devices
- **RPS** (Remote Provisioning Server) - Manages vPRO/AMT device activation (ACM/CCM modes)
- **DM-Manager** (Device Management Manager) - Provides power management APIs
- **Inventory** - Device tracking and metadata management

## Prerequisites

### Required Platform Services

This chart **does NOT include** platform services. You must have the following services already deployed and accessible:

- **PostgreSQL**: Databases for MPS and RPS
- **Keycloak**: Authentication and authorization
- **Vault**: Secrets management

These can be deployed using:
- Full EMF framework (recommended for production)
- Separate Helm charts (for standalone testing)
- Managed cloud services

### System Requirements

- Kubernetes 1.24+
- Helm 3.8+
- kubectl configured with cluster access
- 2 CPU cores (total across all pods)
- 2 GB RAM (total across all pods)

## Installation

### 1. Configure Platform Service Connections

Create a custom values file with your platform service endpoints:

```yaml
# custom-values.yaml
amt:
  postgres:
    host: postgresql-cluster-rw.orch-database
    port: 5432
    mps:
      database: mpsdb
      username: mps_user
      password: "your-password"
    rps:
      database: rpsdb
      username: rps_user
      password: "your-password"
  
  keycloak:
    url: http://keycloak.orch-platform:8080
    realm: dmt-realm
    clientId: dmt-client
    clientSecret: "your-client-secret"
  
  vault:
    address: http://vault.orch-platform:8200
    token: "your-vault-token"
    secretPath: secret/data/dmt
```

### 2. Update Chart Dependencies

```bash
cd infra-charts/dmt-platform
helm dependency update
```

### 3. Install the Chart

Using the install script (recommended):

```bash
./install.sh --namespace dmt-system --values-file custom-values.yaml
```

Or using Helm directly:

```bash
helm install dmt-platform . \
  --namespace dmt-system \
  --create-namespace \
  --values custom-values.yaml
```

### 4. Verify Installation

```bash
# Check pod status
kubectl get pods -n dmt-system

# Check services
kubectl get svc -n dmt-system

# View logs
kubectl logs -n dmt-system -l app.kubernetes.io/name=mps
```

## Configuration

### Enable/Disable Services

By default, all services are enabled. To disable a service:

```yaml
import:
  amt:
    enabled: true     # MPS, RPS, DM-Manager
  inventory:
    enabled: false    # Disable inventory
```

### Service-Specific Configuration

Each sub-chart can be configured independently. Refer to the respective chart documentation:

- [amt Chart](../amt/README.md) - MPS, RPS, DM-Manager configuration
- [inventory Chart](../inventory/README.md) - Inventory service configuration

Example:

```yaml
amt:
  mps:
    replicaCount: 2
    resources:
      limits:
        cpu: 500m
        memory: 512Mi
  
  rps:
    enabled: true
    service:
      type: ClusterIP
      port: 8081

inventory:
  replicaCount: 1
  image:
    pullPolicy: Always
```

## Post-Installation

### 1. Create Default Tenant

After deployment, create a default tenant using the DM-Manager API or Orch-CLI:

```bash
# Using kubectl port-forward
kubectl port-forward -n dmt-system svc/dm-manager 8080:8080

# Create tenant (example with curl)
curl -X POST http://localhost:8080/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "default", "description": "Default tenant"}'
```

### 2. Access Services

```bash
# MPS (CIRA connections and console)
kubectl port-forward -n dmt-system svc/mps 4433:4433 3000:3000

# RPS (Provisioning API and WebSocket)
kubectl port-forward -n dmt-system svc/rps 8081:8081 8082:8082

# DM-Manager (Management API)
kubectl port-forward -n dmt-system svc/dm-manager 8080:8080
```

### 3. Configure Edge Nodes

Use the Ansible-based edge node installer to:
- Install rpc-go and rpc components
- Configure CIRA connection to MPS
- Register device with the control plane

## Upgrading

```bash
helm upgrade dmt-platform . \
  --namespace dmt-system \
  --values custom-values.yaml
```

## Uninstallation

```bash
helm uninstall dmt-platform --namespace dmt-system
```

## Troubleshooting

### Pods Not Starting

Check platform service connectivity:

```bash
# Test PostgreSQL connection
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h postgresql-cluster-rw.orch-database -U mps_user -d mpsdb

# Check Keycloak accessibility
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://keycloak.orch-platform:8080/realms/dmt-realm

# Check Vault status
kubectl run -it --rm debug --image=vault:1.13 --restart=Never -- \
  vault status -address=http://vault.orch-platform:8200
```

### View Service Logs

```bash
# MPS logs
kubectl logs -n dmt-system -l app.kubernetes.io/name=mps --tail=100

# RPS logs
kubectl logs -n dmt-system -l app.kubernetes.io/name=rps --tail=100

# DM-Manager logs
kubectl logs -n dmt-system -l app.kubernetes.io/name=dm-manager --tail=100
```

### Database Connection Issues

Verify database credentials and connectivity:

```bash
kubectl get secret -n dmt-system mps-db-secret -o yaml
kubectl describe pod -n dmt-system <mps-pod-name>
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           DMT Platform (dmt-system)         │
│                                             │
│  ┌───────┐  ┌───────┐  ┌────────────┐     │
│  │  MPS  │  │  RPS  │  │ DM-Manager │     │
│  │ :4433 │  │ :8081 │  │   :8080    │     │
│  └───┬───┘  └───┬───┘  └──────┬─────┘     │
│      │          │              │           │
│      │          │      ┌───────┴────┐      │
│      │          │      │ Inventory  │      │
│      │          │      │   :8080    │      │
│      │          │      └────────────┘      │
└──────┼──────────┼──────────┬───────────────┘
       │          │          │
       ├──────────┴──────────┤
       │                     │
┌──────▼─────────────────────▼──────┐
│    Platform Services (External)   │
│                                    │
│  PostgreSQL  Keycloak  Vault       │
│  (mpsdb,rpsdb) (auth)  (secrets)   │
└────────────────────────────────────┘
```

## Support

For issues and questions:
- Check existing GitHub issues
- Review EMF documentation
- Contact the Edge Infrastructure Manager team

## License

Apache-2.0
