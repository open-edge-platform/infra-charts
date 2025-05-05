# Infrastructure Manager Charts

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/open-edge-platform/infra-charts/badge)](https://scorecard.dev/viewer/?uri=github.com/open-edge-platform/infra-charts)

## Table of Contents

- [Overview](#overview)
- [Get Started](#get-started)
- [Develop](#develop)
- [Contribute](#contribute)
- [Community and Support](#community-and-support)

## Overview

This repository contains Helm Charts to deploy all the services for Edge Infrastructure Manager on a Kubernetes cluster
offering the ability to:

- Onboard and provision Edge Nodes
- Review each node's capabilities
- Monitor the status of the nodes and their resource consumption
- Update and upgrade nodes via scheduled maintenance
- Delete and de-authorize nodes
- Scale Edge Nodes to 10.0000

It contains 4 umbrella charts, referencing the other existing charts in the repository.

- infra-core: contains the mandatory components of Infrastructure Manager, e.g., inventory.
- infra-managers: contains the Resource Managers (RMs) of Infrastructure Manager.
- infra-external: contains the RMs and any other components that interface/manage external infrastructure.
- infra-onboarding: contains RMs and related components to onboard/provision edge nodes.

It also contains test code for validating/linting helm charts.

Read more about Infrastructure Manager in the
[Edge Infrastructure Manager developer documentation][inframanager-dev-guide-url] for internals and
software architecture.

## Get Started

See the [Documentation][inframanager-dev-guide-url] to get started using Edge Infrastructure Manager.

Each umbrella chart has its own life cycle in the repository, independent of the others.
It means that every umbrella chart can be updated independently from the others, and thus
have its own release cycles.

For each umbrella chart, specific tags are created in the github repository to indentify their releases.
For instance, infra-core umbrella chart has its tags defined such as `infra-core-2.3.0`.

### Dependencies

The following tools are required for this repo:

- [helm](https://github.com/helm/helm)
- [shellcheck](https://github.com/koalaman/shellcheck)
- Python 3.8 or later

## Develop

To define support branches, it is necessary to create one support branch for each umbrella chart.
For example, for infra-managers umbrella charts a support branch must be defined such as `release-infra-manager-1.2.0`.
In every pull request the helm versions of all charts in the repository are checked for updates.
And the umbrella charts have their versions checked by their own `.chartver.yaml` files.
The `make test` target ensures the charts versions are consistently linted and updated.

There are several convenience make targets to support developer activities. You can use `help` to see a list of makefile
targets. The following is a list of makefile targets that support developer activities:

- `helmbuild` to build all helm charts
- `helmclean` to clean all helm charts
- `helmpush` to push all helm charts
- `helmlint` to lint all helm charts
- `clean` to clean generated files for all helm charts
- `clean-<name>` to clean generated files for a specific chart
- `deps` to build the dependencies for all charts
- `deps-<name>` to build all the dependencies for a specific chart
- `pack` to build the helm package for all charts
- `pack-<name>` to build the helm package for a specific chart
- `mdlint` to run linting of this file.
- `test` to run the charts checks (license shellcheck helmlint mdlint)
- `license` to check licensing with the reuse tool
- `shellcheck` to check all shell scripts

### Build

To build all the umbrella charts run the command below.
It will build all the chart dependencies and pack each umbrella chart into a `.tgz` file.

```bash
make pack
```

## About resources limits/requests

Almost all of Infrastructure Manager charts have their resources requests/limits set to:

```yaml
# Sets requests/limits to support at least 100 edge nodes.
# Must be adjusted in case of higher load.

resources:
  requests:
    cpu: "50m"
    memory: "64Mi"
  limits:
    cpu: "100m"
    memory: "128Mi"
```

As mentioned, it guarantees at least the support of Infrastructure Manager to have 100 edge nodes operational.
With that, Infrastructure Manager footprints (limits) can be summarized as follows:

- infra-core - 4 components - 400m/512Mi
- infra-managers - 6 components - 600m/768Mi
- infra-external (if enabled) - 4 components - 400m/512Mi
- infra-onboarding (without tinkerbell) - 2 components - 200m/256Mi

Total: 1600m/2048Mi

Given each one of the 4 Tikerbell subcharts have resource requests of 10m/64Mi,
it is safe to assume a lower bound requirement of Infrastructure Manager of 2 CPU cores and 3GB of memory.

### Deploy Infrastructure Manager

From this folder you can deploy the whole of Infrastructure Manager with a few helm commands:

``` bash
  helm install -n orch-infra --set global.registry.name="registry-rs.edgeorchestration.intel.com/" \
      --set import.credentials.enabled=false \
      --set tenant-controller.managerArgs.disableCredentialsManagement=true \
      --set inventory.postgresql.pod.registry.enabled=true \
      infra-core ./infra-core

  helm install -n orch-infra --set global.registry.name="registry-rs.edgeorchestration.intel.com/" \
      --set loca-manager.serviceArgs.disableCredentialsManagement=true \
      --set loca-metadata-manager.serviceArgs.disableCredentialsManagement=true \
      --set import.loca-credentials.enabled=false \
      infra-external ./infra-external
  
  helm install -n orch-infra --set global.registry.name="registry-rs.edgeorchestration.intel.com/" \
      infra-managers ./infra-managers
 
  helm install -n orch-infra --set global.registry.name="registry-rs.edgeorchestration.intel.com/" \
      --set onboarding-manager.managerArgs.disableCredentialsManagement=true \
      --set import.dkam.enabled=false \
      --set tinkerbell.pvc.enabled=true \
      --set tinkerbell.pvc.storageSize=128Mi \
      infra-onboarding ./infra-onboarding
```

See the [documentation][user-guide-url] if you want to learn more about using Edge Orchestrator.

### Clean

To clean all dependencies and generated helm packages run:

```bash
make clean
```

## Contribute

To learn how to contribute to the project, see the [contributor's guide][contributors-guide-url].

## Community and Support

To learn more about the project, its community, and governance, visit
the [Edge Orchestrator Community](https://docs.openedgeplatform.intel.com/edge-manage-docs/main/index.html).

For support, start with [Troubleshooting](https://docs.openedgeplatform.intel.com/edge-manage-docs/main/developer_guide/troubleshooting/index.html)

## License

Infrastructure Manager is licensed under[Apache 2.0][apache-license].

Last Updated Date: April 7, 2025

[user-guide-url]: https://docs.openedgeplatform.intel.com/edge-manage-docs/main/user_guide/get_started_guide/index.html
[inframanager-dev-guide-url]: https://docs.openedgeplatform.intel.com/edge-manage-docs/main/developer_guide/infra_manager/index.html
[contributors-guide-url]: https://docs.openedgeplatform.intel.com/edge-manage-docs/main/developer_guide/contributor_guide/index.html
[apache-license]: https://www.apache.org/licenses/LICENSE-2.0
