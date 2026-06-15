# Azure Infrastructure Deployment

This folder contains the TrackMind Nexus Azure Bicep deployment package and gated Buildkite deployment flow.

## Folder Layout

- `main.bicep`: resource-group scoped deployment composition.
- `modules/monitor.bicep`: Log Analytics, Application Insights, and optional action group.
- `modules/networking.bicep`: VNet, delegated Container Apps subnet, delegated PostgreSQL subnet, and PostgreSQL private DNS.
- `modules/postgresql.bicep`: Azure Database for PostgreSQL Flexible Server and TrackMind database.
- `modules/container-apps.bicep`: Azure Container Apps managed environment plus API and agent apps.
- `modules/event-hubs.bicep`: Azure Event Hubs namespace, governed domain event hub, 20 Hz telemetry hub, projection consumer group, and diagnostics.
- `modules/redis.bicep`: Azure Redis Cache and diagnostics.
- `parameters/dev.bicepparam`, `parameters/staging.bicepparam`, `parameters/prod.bicepparam`: environment-specific sizing and approval metadata.
- `pipelines/buildkite.pipeline.yml`: Buildkite upload entry.
- `pipelines/buildkite-gated-pipeline.ps1`: dynamic pipeline generator for Lint, Build, What-If, Approve, Deploy.

## Deployment Flow

The Buildkite deployment flow is:

1. Lint: `az bicep build --stdout` for `main.bicep` and all modules.
2. Build: compile `main.bicep` to `infra/azure/out/main.json`.
3. What-If: run `az deployment group what-if` with the selected environment parameter file.
4. Approve: block deployment according to environment and change category.
5. Deploy: run `az deployment group create` only after all required approval blocks are cleared.

## Approval Requirements

- Dev: deployment approval is skipped by default.
- Staging: one manual deployment approval is required.
- Prod: two separate manual production approvals are required.
- Networking changes: manual approval is always required when networking changes are detected or `TRACKMIND_NETWORKING_CHANGES=true`.
- Database schema changes: manual approval is always required when schema/migration changes are detected or `TRACKMIND_DATABASE_SCHEMA_CHANGES=true`.

The dynamic Buildkite generator detects common networking changes in `infra/azure` diffs and common schema changes in migration/schema/SQL paths. Operators can force gates with:

```powershell
$env:TRACKMIND_NETWORKING_CHANGES = 'true'
$env:TRACKMIND_DATABASE_SCHEMA_CHANGES = 'true'
```

## Buildkite Usage

Set the target environment and resource group before uploading the pipeline:

```bash
export TRACKMIND_ENVIRONMENT=staging
export AZURE_RESOURCE_GROUP=trackmind-staging-rg
export TRACKMIND_PG_ADMIN_PASSWORD='use-a-secret-manager-value'
buildkite-agent pipeline upload infra/azure/pipelines/buildkite.pipeline.yml
```

Production deployments must use:

```bash
export TRACKMIND_ENVIRONMENT=prod
export AZURE_RESOURCE_GROUP=trackmind-prod-rg
```

## Local What-If

```bash
export TRACKMIND_PG_ADMIN_PASSWORD='use-a-secret-manager-value'
az deployment group what-if \
  --resource-group trackmind-dev-rg \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/parameters/dev.bicepparam \
  --result-format FullResourcePayloads
```

## Telemetry Event Hubs

The Event Hubs module provisions `trackmind-events` for governed domain events and `trackmind-telemetry-20hz` for race-day telemetry such as sensor readings, camera detections, and horse location updates.

Environment parameters set the telemetry target at `20 Hz` with a `<100 ms` latency objective. Container Apps receive `TRACKMIND_TELEMETRY_TARGET_HZ` and `TRACKMIND_TELEMETRY_LATENCY_TARGET_MS`; telemetry can update projections, but any state mutation must still pass an approval-gated API path.

## Required Tags

All environments set:

`tenant`, `track`, `environment`, `owner`, `dataClassification`, `costCenter`, `businessCriticality`.
