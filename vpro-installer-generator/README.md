# vpro-installer-generator

**Pure Helm approach** - generates edge node installer script from `infra-config` ConfigMap.

## ✨ Super Simple Design

- **No Job, No RBAC** - just a ConfigMap
- Helm reads `infra-config` at install time using `lookup`
- Generates ready-to-use installer script
- Customer retrieves script from ConfigMap

## 📦 What Gets Created

Single ConfigMap: `vpro-installer` containing `edge-node-installer.sh`

## 🚀 Installation

```bash
helm install vpro-installer-generator . \
  -n edge-manageability-framework
```

## 📥 Get the Installer Script

```bash
kubectl get configmap vpro-installer \
  -n edge-manageability-framework \
  -o jsonpath='{.data.edge-node-installer\.sh}' > installer.sh

chmod +x installer.sh
```

## ⚙️ Configuration

Only 4 values needed in `values.yaml`:

```yaml
sourceConfigMap:
  name: infra-config                    # Where to read from
  namespace: edge-manageability-framework

targetConfigMap:
  name: vpro-installer                  # Where to write to
  namespace: edge-manageability-framework

certificateSecrets:
  orchCaCert:
    name: gateway-ca-cert               # Orchestrator CA
    namespace: edge-manageability-framework
  bootsCaCert:
    name: boots-ca-cert                 # Boots CA
    namespace: edge-manageability-framework
```

## 📋 Requirements

- `infra-config` ConfigMap must exist before install
- CA certificate secrets should exist (optional, will use placeholders if missing)

## 🔄 Updates

Re-run `helm upgrade` to regenerate the installer when `infra-config` changes:

```bash
helm upgrade vpro-installer-generator . \
  -n edge-manageability-framework
```

## 🏗️ How It Works

```
helm install/upgrade
     ↓
Helm lookup reads infra-config ConfigMap
     ↓
Helm lookup reads CA certificate secrets
     ↓
Template engine substitutes variables in installer script
     ↓
Creates vpro-installer ConfigMap with final script
     ↓
Customer downloads and runs script
```

## 📁 Files

```
templates/
  ├─ configmap.yaml    # Main template (uses lookup to read infra-config)
  └─ _helpers.tpl      # Helm helper functions

values.yaml           # Simple configuration (24 lines)
```

That's it!
