# SPDX-FileCopyrightText: (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0
{{/*
Expand the name of the chart.
*/}}
{{- define "credentials.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "credentials.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "credentials.labels" -}}
helm.sh/chart: {{ include "credentials.chart" . }}
{{ include "credentials.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "credentials.selectorLabels" -}}
app.kubernetes.io/name: {{ include "credentials.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
