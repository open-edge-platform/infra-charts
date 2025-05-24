<!-- SPDX-FileCopyrightText: (C) 2025 Intel Corporation -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# EIM PXE server

This module implements a PXE server as part of Edge Infrastructure Manager.
The PXE server is used to support legacy PXE boot as another OS provisioning mechanism supported by EIM.
It runs a local DHCP and TFTP server that exposes PXE boot info and iPXE script that is needed to initiate OS provisioning.

This chart is only intended to be run locally, on-prem.
It can be deployed as part of the entire EMF orchestrator or as a standalone Helm chart.

## How to run?

The following configuration must be provided to install PXE server. Adjust the configuration parameters to your local on-prem environment.

- `interface` - name of a network interface connected to local L2 network that the DHCP/TFTP server should listen on. All Edge Nodes being provisioned should have L2 connectivity with this network interface. 
- `bootServerIP` - an IP address assigned to `interface`, from a local subnet.
- `subnetAddress` - a network address of L2 subnet (without CIDR mask), e.g., 192.168.1.0 or 10.0.0.0. It is used to match incoming DHCP discovery packets.

### Run as part of on-prem EMF

Follow official deployment guide to run on-prem, OXM profile of EMF.

### Run as standalone Helm chart

If you need to run the PXE server as a standalone Helm chart on your K8s cluster, use the following command.

> NOTE! We assume that you have a Kubernetes cluster up and running before executing the command.

```bash
helm install -n orch-infra pxe-server ./pxe-server/  \
--set config.interface=<interface>,config.bootServerIP=192.168.160.37,config.subnetAddress=192.168.160.0,standaloneMode.enabled=true,standaloneMode.ipxePath="/home/onprem/signed_ipxe.efi"
```

Note the following:
- `standaloneMode.enabled` must be set to `true`
- `standaloneMode.ipxePath` must specify a local OS path to the iPXE script that will be provided via TFTP to chain-load into.
