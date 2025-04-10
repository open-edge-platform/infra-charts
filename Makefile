# SPDX-FileCopyrightText: (C) 2025 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# use bash as shell
SHELL         := bash -e -o pipefail

TOOLS_DIR     := ./tools

OCI_REGISTRY         ?= 080137407410.dkr.ecr.us-west-2.amazonaws.com
OCI_REPOSITORY       ?= edge-orch/infra/charts

# Create the virtualenv with python tools installed
VENV_NAME     := venv_charts
OUT_DIR       := "."

.PHONY: Makefile license yamllint helmlint clean clean-all lint mdlint

# TODO: add yamlint, too many issues to fix now, so disabling it for now.
lint: license mdlint helmlint shellcheck ## Run all linting

helm-build: clean deps pack ## build helm charts by cleaning, building dependencies, and packing

helmlint: ## lint all helm charts
	$(TOOLS_DIR)/helmlint.sh

helmclean: ## lint all helm charts, cleaning first
	$(TOOLS_DIR)/helmlint.sh clean

CHARTS = infra-core infra-external infra-managers infra-onboarding
helm-list: ## List top-level helm charts, tag format, and versions in YAML format
	@echo "charts:"
	@for chart in $(CHARTS); do \
    echo "  $${chart}:" ;\
    echo -n "    "; grep "^version" "$${chart}/Chart.yaml"  ;\
    echo "    gitTagPrefix: '$${chart}-'" ;\
    echo "    outDir: '$(OUT_DIR)'" ;\
  done

shellcheck: ## Check all shell scripts
	shellcheck --version
	shellcheck -a $(TOOLS_DIR)/*.sh

mdlint: ## Lint all markdown files
	markdownlint --version
	markdownlint "*.md"

check: $(VENV_NAME) ## Check/obtain all build dependencies

# build virtualenv
$(VENV_NAME): $(TOOLS_DIR)/requirements.txt
	python3 -m venv $@ ;\
  . ./$@/bin/activate ; set -u ;\
  python -m pip install --upgrade pip;\
  python -m pip install -r $<

license: $(VENV_NAME) ## Check licensing with the reuse tool
	. ./$</bin/activate ; set -u ;\
	reuse --version ;\
	reuse --root . lint

YAML_FILES := $(shell find . -path './venv_charts' -prune -o -type f \( -name '*.yaml' -o -name '*.yml' \) -print )

yamllint: $(VENV_NAME) ## lint YAML files
	. ./$</bin/activate ; set -u ;\
	yamllint --version ;\
	yamllint -c $(TOOLS_DIR)/yamllint_conf.yml -s $(YAML_FILES)

clean: clean-core clean-external clean-managers clean-onboarding
	rm -rf ./*.tgz

clean-core: ## clean generated files of infra-core
	rm -rf ./infra-core/Chart.lock
	rm -rf ./infra-core/charts/*.tgz

clean-external: ## clean generated files of infra-external
	rm -rf ./infra-external/Chart.lock
	rm -rf ./infra-external/charts/*.tgz

clean-managers: ## clean generated files of infra-managers
	rm -rf ./infra-managers/Chart.lock
	rm -rf ./infra-managers/charts/*.tgz

clean-onboarding: ## clean generated files of infra-onboarding
	rm -rf ./infra-onboarding/Chart.lock
	rm -rf ./infra-onboarding/charts/*.tgz
	rm -rf ./tinkerbell/Chart.lock
	rm -rf ./tinkerbell/charts/*.tgz

clean-all: clean ## clean-all - delete generated files and venv
	rm -rf "$(VENV_NAME)"

deps: deps-core deps-external deps-managers deps-onboarding

deps-core: clean-core ## Build the dependencies of infra-core
	helm dep update infra-core
	helm dep build infra-core

deps-external: clean-external ## Build the dependencies of infra-external
	helm dep update infra-external
	helm dep build infra-external

deps-managers: clean-managers ## Build the dependencies of infra-managers
	helm dep update infra-managers
	helm dep build infra-managers

deps-onboarding: clean-onboarding ## Build the dependencies of infra-onboarding
	helm dep update tinkerbell
	helm dep build tinkerbell
	helm dep update infra-onboarding
	helm dep build infra-onboarding

.PHONY: pack pack-% ## Pack all helm charts into .tgz files
pack: deps pack-infra-core pack-infra-external pack-infra-managers pack-infra-onboarding

pack-%: ## Build the helm package
	rm $*-*.tgz || true
	helm package ./$*

.PHONY: helm-push helm-push-%
helm-push: helm-push-infra-core helm-push-infra-external helm-push-infra-managers helm-push-infra-onboarding

helm-push-%: pack-% ## Push helm chart only if needed (not exist or dev version)
	aws ecr create-repository --region us-west-2 --repository-name $(OCI_REPOSITORY)/$* || true

	chartToPush=`find . -name $*-*.tgz`; \
	chartVersion=`echo $$chartToPush | sed -n 's/.*$*-\(.*\).tgz/\1/p'`; \
	isChartDev=`echo $$chartVersion | grep -c dev || true`; \
	chartExist=`helm show chart oci://${OCI_REGISTRY}/${OCI_REPOSITORY}/$* --version $${chartVersion} || true`; \
	if [ -z "$$chartExist" ] || [ "$$isChartDev" -eq 1 ]; then \
		echo "Push new chart: chart=$* version=$${chartVersion}"; \
		helm push $${chartToPush} oci://${OCI_REGISTRY}/${OCI_REPOSITORY}/; \
	fi

### help target ###
help: ## Print help for each target
	@echo $(PROJECT_NAME) make targets
	@echo "Target               Makefile:Line    Description"
	@echo "-------------------- ---------------- -----------------------------------------"
	@grep -H -n '^[[:alnum:]_-]*:.* ##' $(MAKEFILE_LIST) \
    | sort -t ":" -k 3 \
    | awk 'BEGIN  {FS=":"}; {sub(".* ## ", "", $$4)}; {printf "%-20s %-16s %s\n", $$3, $$1 ":" $$2, $$4};'
