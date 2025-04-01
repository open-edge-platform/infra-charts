# Summary of Changes to Upstream Open Source Project

This document summarizes the changes made to the upstream open source repo [Tinkerbell Charts](https://github.com/tinkerbell/charts).
All the changes have been made on top of version `v0.4.3`.

## Overview

Some of the tinkerbell component charts are forked from the open source [Tinkerbell Charts](https://github.com/tinkerbell/charts).
Changes have been made to enhance and customize the functionality for our specific use case.

## Changes

### General Improvements

- Added `securityContext` for all the containers to adhere to the kyverno policies
- Added `livenessProbe` and `readinessProbe` for all the components
- Replace `tink-stack` container image with non-root enabled `nginxinc/nginx-unprivileged:alpine3.21`

### General Modifications

- Added tinkerbell_ prefix to all the component names
- Replaced `deploy` field with `enable` to make it uniform with other infra-charts
- Added configMap for static `boot.ipxe` file
- Added traefik based `Ingressroute` for `tink-server`
- Added `PersistentVolumeClaim` for storing artifacts in tink-stack(PA server).
