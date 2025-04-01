# SPDX-FileCopyrightText: (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
{{/*
Expand the name of the chart.
*/}}
{{- define "loca-credentials.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "loca-credentials.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "loca-credentials.labels" -}}
helm.sh/chart: {{ include "loca-credentials.chart" . }}
{{ include "loca-credentials.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "loca-credentials.selectorLabels" -}}
app.kubernetes.io/name: {{ include "loca-credentials.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
