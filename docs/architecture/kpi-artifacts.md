# KPI Artifacts

TrackMind Nexus treats KPIs as governed artifacts, not dashboard-only numbers. The implemented contract lives in `packages/shared/src/kpiArtifacts.ts` and is exposed by read-only backend routes under `/api/v1/kpis`.

## Implemented Capability

- `KPIArtifact` contains tenant, organization, racetrack, domain, value, threshold, confidence, data quality, source events/entities, calculation method, approval sensitivity, audit references, model readability, version, and historical snapshots.
- `KPIWorkspaceDto` exposes filtered KPI artifacts and governed model-readable context.
- `ModelReadableKPIContext` is metadata-only and prohibits KPI mutation, regulated action execution, human-approval bypass, and raw cross-track record exposure.
- Backend routes provide read-only access through the canonical KPI API only: `/api/v1/kpis`, `/api/v1/kpis/{kpiId}`, `/api/v1/kpis/{kpiId}/snapshots`, and `/api/v1/kpis/model-context`.
- KPI reads fail closed when tenant, racetrack, organization, or role query scope conflicts with TrackMind scope headers.
- Database migration `007_kpi_artifacts.sql` defines `kpi_definitions`, `kpi_snapshots`, `kpi_thresholds`, `kpi_source_mappings`, and `kpi_audit_links` with append-only triggers, domain/value constraints, and child-table scope checks.
- KPI seed `002_kpi_seed.sql` uses immutable definition inserts and deterministic threshold IDs so reruns do not update definitions or duplicate thresholds.

## Readiness Boundary

Current KPI values are deterministic readiness/facade calculations derived from seeded TrackMind artifacts and documented backend state. They are not production telemetry, certification proof, payment settlement, veterinary clearance, or raw federation analytics.

Federated KPIs are aggregate-only and do not expose raw cross-track records. Veterinary KPIs are restricted and excluded from model-readable context unless a future backend privacy service explicitly permits scoped access.

## AI Boundary

Agents may read KPI context to generate advisory recommendations. Agents must not update KPI values, change thresholds, mutate workflow state, execute protected actions, or bypass approval/audit controls.
