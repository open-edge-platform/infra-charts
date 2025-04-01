// SPDX-FileCopyrightText: (C) 2025 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

// NOTICE: This file has been modified by Intel Corporation.
// Original file can be found at https://github.com/tinkerbell/charts.

{{ define "smee.ports" }}
- {{ .PortKey }}: {{ .http.port }}
  name: {{ .http.name }}
  protocol: TCP
- {{ .PortKey }}: {{ .syslog.port }}
  name: {{ .syslog.name }}
  protocol: UDP
- {{ .PortKey }}: {{ .dhcp.port }}
  name: {{ .dhcp.name }}
  protocol: UDP
- {{ .PortKey }}: {{ .tftp.port }}
  name: {{ .tftp.name }}
  protocol: UDP
{{- end }}

{{- define "urlJoiner" }}
{{- $host := printf "%v:%v" .urlDict.host .urlDict.port }}
{{- $newDict := set .urlDict "host" $host }}
{{- print (urlJoin $newDict) }}
{{- end }}
