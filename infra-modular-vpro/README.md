# infra-modular-vpro Helm Chart

## Overview

The `infra-modular-vpro` Helm chart is an umbrella chart that packages Intel vPro Out-of-Band Device Management components for streamlined deployment. This chart is designed for use with Device Management Tools (DMT) and vPro-only deployment scenarios within the Edge Manageability Framework (EMF).

## Components

This chart includes the following sub-charts:

| Component | Version | Purpose |
|-----------|---------|---------|
| **apiv2** | 2.6.0-dev | Enhanced API service for device management |
| **inventory** | 2.30.0-dev | Device inventory management service |
| **tenant-controller** | 0.25.0-dev | Multi-tenancy management controller |
| **credentials** | 1.9.0-dev | Credential management service |
| **mps** | 0.0.28 | Management Presence Server (Intel AMT/vPro management) |
| **rps** | 0.0.19 | Remote Provisioning Server (AMT device provisioning) |
| **dm-manager** | 0.7.2 | Device Management Manager (orchestration layer) |

## Prerequisites

- Kubernetes 1.24+
- Helm 3.8+
- PostgreSQL database (postgresql-cluster operator recommended)
- Keycloak (for authentication)
- Vault (for secrets management)

### Required Databases

The following PostgreSQL databases must be created:

- `inventory` - For device inventory data
- `mps` - For MPS device connections and state
- `rps` - For RPS provisioning profiles

## Installation

### Using Helm CLI

```bash
# Add the chart repository (if using OCI registry)
helm pull oci://registry-rs.edgeorchestration.intel.com/infra/charts/infra-modular-vpro --version 1.0.0

# Install the chart
helm install vpro-mgmt infra-modular-vpro \
  --namespace orch-infra \
  --create-namespace \
  --values custom-values.yaml
```

### Using ArgoCD (Recommended)

This chart is designed to be deployed via ArgoCD within EMF. See the EMF repository's ArgoCD application template:
- `edge-manageability-framework/argocd/applications/templates/infra-modular-vpro.yaml`

Enable in your cluster config:
```yaml
argo:
  enabled:
    infra-modular-vpro: true
```

## Configuration

### Basic Configuration

The chart uses default values from `values.yaml`. You can override these by creating a custom values file or by setting values during installation.

### Enabling/Disabling Components

All components are enabled by default. To disable specific components:

```yaml
import:
  apiv2: 
    enabled: true
  inventory:
    enabled: true
  tenant-controller:
    enabled: true
  credentials:
    enabled: true
  mps:
    enabled: true
  rps:
    enabled: true
  dm-manager:
    enabled: true
```

### Container Registry Configuration

```yaml
global:
  registry:
    name: "registry.example.com/"
    imagePullSecrets:
      - name: "registry-secret"
```

### Database Configuration

By default, components use external PostgreSQL. Example for MPS:

```yaml
mps:
  postgresql:
    type: external
    host: postgresql-cluster-rw.orch-infra.svc.cluster.local
    port: 5432
    database: mps
    username: orch-infra-system-mps_user
    secretName: db-postgresql-cluster-mps-app
```

### Service Integration

Components integrate with platform services. These are typically configured in the ArgoCD configs:

```yaml
# Keycloak Integration
env:
  keycloakUrl: "http://platform-keycloak.orch-platform.svc.cluster.local:8080"

# Vault Integration
env:
  vaultUrl: "http://vault.orch-platform.svc.cluster.local:8200"
  vaultRole: "orch-svc"

# Inventory Integration (for MPS, RPS, DM-Manager)
serviceArgs:
  inventoryAddress: "inventory.orch-infra.svc.cluster.local:50051"
```

### Resource Limits

You can override resource limits for each component:

```yaml
mps:
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
```

### Observability

Enable tracing and metrics:

```yaml
mps:
  serviceArgs:
    enableTracing: true
    traceURL: "orchestrator-observability-opentelemetry-collector.orch-platform.svc:4318"
  metrics:
    enabled: true
```

## Upgrading

### Helm Upgrade

```bash
helm upgrade vpro-mgmt infra-modular-vpro \
  --namespace orch-infra \
  --values custom-values.yaml
```

### ArgoCD Auto-Sync

If using ArgoCD with auto-sync enabled, the chart will automatically upgrade when a new version is available.

## Uninstallation

```bash
helm uninstall vpro-mgmt --namespace orch-infra
```

**Note**: This will not delete:
- PostgreSQL databases
- Secrets in Vault
- Keycloak realms/clients

## Troubleshooting

### Chart Dependency Issues

If you encounter dependency errors:

```bash
helm dependency update infra-modular-vpro
```

### Pod Not Starting

Check events and logs:

```bash
kubectl describe pod <pod-name> -n orch-infra
kubectl logs <pod-name> -n orch-infra
```

### Database Connection Issues

Verify PostgreSQL cluster is running:

```bash
kubectl get postgresql -n orch-infra
kubectl get pods -n orch-infra -l cnpg.io/cluster=postgresql-cluster
```

Check secrets exist:

```bash
kubectl get secrets -n orch-infra | grep db-postgresql
```

### Authentication Issues

Verify platform services are running:

```bash
kubectl get pods -n orch-platform -l app=keycloak
kubectl get pods -n orch-platform -l app=vault
```

Check service account:

```bash
kubectl get sa orch-svc -n orch-infra
```

## Development

### Building the Chart

```bash
# Update dependencies
helm dependency update infra-modular-vpro

# Lint the chart
helm lint infra-modular-vpro

# Template rendering test
helm template test infra-modular-vpro --debug

# Package the chart
helm package infra-modular-vpro
```

### Testing Locally

```bash
# Dry-run installation
helm install test-vpro infra-modular-vpro \
  --namespace orch-infra \
  --dry-run \
  --debug

# Install for testing
helm install test-vpro infra-modular-vpro \
  --namespace orch-infra \
  --create-namespace
```

## Chart Dependencies

This chart depends on the following sub-charts:

```yaml
dependencies:
  - name: apiv2
    version: "2.6.0-dev"
    repository: "file://../apiv2"
  - name: inventory
    version: "2.30.0-dev"
    repository: "file://../inventory"
  - name: tenant-controller
    version: "0.25.0-dev"
    repository: "file://../tenant-controller"
  - name: credentials
    version: "1.9.0-dev"
    repository: "file://../credentials"
  - name: mps
    version: "0.0.28"
    repository: "file://../amt/charts/mps"
  - name: rps
    version: "0.0.19"
    repository: "file://../amt/charts/rps"
  - name: dm-manager
    version: "0.7.2"
    repository: "file://../amt/charts/dm-manager"
```

## Integration with EMF

This chart is designed to work seamlessly with the Edge Manageability Framework. For complete integration:

1. **Profile**: `orch-configs/profiles/enable-modular-vpro.yaml`
2. **ArgoCD App**: `argocd/applications/templates/infra-modular-vpro.yaml`
3. **Config**: `argocd/applications/configs/infra-modular-vpro.yaml`
4. **Preset**: `scorch/presets/dev-vpro-only-coder.yaml`

See the EMF repository for complete deployment examples.

## Support

For issues or questions:
- Check logs: `kubectl logs -n orch-infra <pod-name>`
- Review ArgoCD: https://argocd.<your-domain>/applications/infra-modular-vpro
- Consult EMF documentation

## License

Copyright (C) 2025 Intel Corporation

SPDX-License-Identifier: Apache-2.0

## Maintainers

- Edge Infrastructure Manager Team

## Version History

### 1.0.0 (Initial Release)
- Initial release with all core vPro components
- Includes: MPS, RPS, DM-Manager, APIv2, Inventory, Tenant-Controller, Credentials
- Supports EMF ArgoCD deployment
- Multi-tenancy enabled by default
