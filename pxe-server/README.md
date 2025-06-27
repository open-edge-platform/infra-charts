<!-- SPDX-FileCopyrightText: (C) 2025 Intel Corporation -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Edge Infrastructure Manager PXE server Charts

## Table of Contents

- [Overview](#overview)
- [Get Started](#get-started)
- [Contribute](#contribute)
- [Community and Support](#community-and-support)
- [License](#license)

## Overview

This module implements a PXE server as part of Edge Infrastructure Manager.
The PXE server is used to support legacy PXE boot as another OS provisioning mechanism supported by EIM.
It runs a local Proxy-DHCP and TFTP server that exposes PXE boot info and iPXE script that is needed to initiate OS provisioning.

This chart is only intended to be run locally, on-prem. The following deployment modes are supported:
- **default** - deploy as part of the entire EMF orchestrator
- **standalone** - deploy as a standalone Helm chart, outside of the EMF orchestrator.

## Get Started

The following configuration must be provided to install PXE server. Adjust the configuration parameters to your local on-prem environment.

- `interface` - name of a network interface connected to local L2 network that the DHCP/TFTP server should listen on. All Edge Nodes being provisioned should have L2 connectivity with this network interface.
- `bootServerIP` - an IP address assigned to `interface`, from a local subnet.
- `subnetAddress` - a network address of L2 subnet (without CIDR mask), e.g., 192.168.1.0 or 10.0.0.0. It is used to match incoming DHCP discovery packets.

### Run as part of on-prem EMF (default)

Follow official deployment guide to run on-prem, OXM profile of EMF.

### Run as standalone Helm chart

If you need to run the PXE server as a standalone Helm chart on your K8s cluster, use the following command.

> NOTE! We assume that you have a Kubernetes cluster up and running before executing the command.

```bash
helm install -n orch-infra pxe-server ./pxe-server/  \
--set config.interface=<interface>,config.bootServerIP=<bootServerIP>,config.subnetAddress=<subnetAddress>,standaloneMode.enabled=true,standaloneMode.ipxePath="/home/user/signed_ipxe.efi"
```

Note the following:
- `standaloneMode.enabled` must be set to `true`
- `standaloneMode.ipxePath` must specify a local OS path to the iPXE script that will be provided via TFTP to chain-load into. The iPXE script should be downloaded from the EMF orchestrator where Edge Nodes should be connected to.

### Run TFTP-only flavor

By default, the PXE server will run both Proxy-DHCP and TFTP servers. However, when you want to use your own DHCP server
to assist in the PXE booting, you can run the PXE server in the TFTP-only mode that will only serve the iPXE script via TFTP.

Use `--set config.proxydhcp=false` to disable ProxyDHCP:

```bash
helm install -n orch-infra pxe-server ./pxe-server/  \
--set config.proxydhcp=false,config.interface=<interface>,config.bootServerIP=<bootServerIP>,config.subnetAddress=<subnetAddress>"
```

## Contribute

To learn how to contribute to the project, see the [contributor's guide][contributors-guide-url].

## Community and Support

To learn more about the project, its community, and governance, visit
the [Edge Orchestrator Community](https://docs.openedgeplatform.intel.com/edge-manage-docs/main/index.html).

For support, start with [Troubleshooting](https://docs.openedgeplatform.intel.com/edge-manage-docs/main/developer_guide/troubleshooting/index.html)

## License

Infrastructure Manager is licensed under[Apache 2.0][apache-license].

[user-guide-url]: https://docs.openedgeplatform.intel.com/edge-manage-docs/main/user_guide/get_started_guide/index.html
[inframanager-dev-guide-url]: https://docs.openedgeplatform.intel.com/edge-manage-docs/main/developer_guide/infra_manager/index.html
[contributors-guide-url]: https://docs.openedgeplatform.intel.com/edge-manage-docs/main/developer_guide/contributor_guide/index.html
[apache-license]: https://www.apache.org/licenses/LICENSE-2.0
