#!/usr/bin/env bash
# SPDX-FileCopyrightText: (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

##############################################################################
# DMT Platform Installer
#
# This script automates the installation of the Device Management Toolkit
# (DMT) platform using Helm.
#
# Usage:
#   ./install.sh [OPTIONS]
#
# Options:
#   --namespace <name>          Kubernetes namespace (default: dmt-system)
#   --release-name <name>       Helm release name (default: dmt-platform)
#   --values-file <path>        Custom values file (optional, default: values.yaml)
#   --dry-run                   Perform a dry-run without actual installation
#   --help                      Display this help message
#
# Examples:
#   # Install with defaults
#   ./install.sh
#
#   # Install with custom namespace
#   ./install.sh --namespace my-dmt
#
#   # Install with custom values
#   ./install.sh --values-file my-values.yaml
#
#   # Dry run to test configuration
#   ./install.sh --dry-run
#
##############################################################################

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}"

# Default values
NAMESPACE="${NAMESPACE:-dmt-system}"
RELEASE_NAME="${RELEASE_NAME:-dmt-platform}"
VALUES_FILE=""
DRY_RUN="${DRY_RUN:-false}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

##############################################################################
# Helper Functions
##############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

usage() {
    sed -n '3,31p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
    exit 0
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in kubectl helm; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the required tools and try again."
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    # Check Helm version
    local helm_version
    helm_version=$(helm version --short 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    log_info "Helm version: $helm_version"
    
    # Check Kubernetes version
    local k8s_version
    k8s_version=$(kubectl version --short 2>/dev/null | grep 'Server Version' | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    log_info "Kubernetes version: $k8s_version"
    
    log_success "Prerequisites check passed"
}

install_dmt_platform() {
    log_info "Installing DMT Platform..."
    
    # Determine values file
    local values_file="${VALUES_FILE:-${CHART_DIR}/values.yaml}"
    
    if [ ! -f "$values_file" ]; then
        log_error "Values file not found: $values_file"
        exit 1
    fi
    
    log_info "Using values file: $values_file"
    log_info "Target namespace: $NAMESPACE"
    log_info "Release name: $RELEASE_NAME"
    
    # Update chart dependencies
    log_info "Updating chart dependencies..."
    if ! helm dependency update "$CHART_DIR"; then
        log_error "Failed to update chart dependencies"
        exit 1
    fi
    
    # Build Helm command
    local helm_cmd="helm install $RELEASE_NAME $CHART_DIR"
    helm_cmd="$helm_cmd --namespace $NAMESPACE"
    helm_cmd="$helm_cmd --create-namespace"
    helm_cmd="$helm_cmd --values $values_file"
    
    if [ "$DRY_RUN" = "true" ]; then
        helm_cmd="$helm_cmd --dry-run --debug"
    fi
    
    # Execute installation
    log_info "Executing: $helm_cmd"
    if eval "$helm_cmd"; then
        log_success "DMT Platform installed successfully!"
        echo ""
        show_next_steps
    else
        log_error "Installation failed"
        exit 1
    fi
}

show_next_steps() {
    cat <<EOF

${GREEN}╔════════════════════════════════════════════════════════════════╗
║           DMT Platform - Installation Complete!                ║
╚════════════════════════════════════════════════════════════════╝${NC}

${BLUE}Deployment Information:${NC}
  Namespace:     $NAMESPACE
  Release Name:  $RELEASE_NAME

${BLUE}Verify Installation:${NC}
  # Check pod status
  kubectl get pods -n $NAMESPACE

  # Check services
  kubectl get svc -n $NAMESPACE

  # View release information
  helm list -n $NAMESPACE

  # View post-install notes
  helm get notes $RELEASE_NAME -n $NAMESPACE

${BLUE}Access Services:${NC}
  # MPS (Management Presence Server)
  kubectl port-forward -n $NAMESPACE svc/mps 4433:4433 3000:3000

  # RPS (Remote Provisioning Server)
  kubectl port-forward -n $NAMESPACE svc/rps 8081:8081

  # DM-Manager (Device Management Manager)
  kubectl port-forward -n $NAMESPACE svc/dm-manager 8080:8080

${BLUE}Next Steps:${NC}
  1. Wait for all pods to be ready
  2. Configure edge node installer with CIRA connection details
  3. Install edge node components (rpc-go, rpc) using Ansible
  4. Use Orch-CLI to list connected devices and initiate activation

${BLUE}Troubleshooting:${NC}
  # View pod logs
  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=mps
  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=rps
  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=dm-manager

  # Check events
  kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'

${BLUE}Uninstall:${NC}
  helm uninstall $RELEASE_NAME -n $NAMESPACE

EOF
}

##############################################################################
# Main Script
##############################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --release-name)
                RELEASE_NAME="$2"
                shift 2
                ;;
            --values-file)
                VALUES_FILE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --help|-h)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    # Display banner
    cat <<EOF
${BLUE}╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║     Device Management Toolkit (DMT) Platform Installer        ║
║                                                                ║
║     Version: 0.1.0                                            ║
║     Intel Corporation                                         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝${NC}

EOF
    
    # Check prerequisites
    check_prerequisites
    
    # Execute installation
    install_dmt_platform
}

# Run main function
main "$@"
