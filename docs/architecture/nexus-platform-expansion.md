# Nexus Platform Expansion (Prompts 03–20)

TrackMind Nexus exposes prompts **03–20** as a **facade layer** over canonical domain services. Nexus routes are **workspace and summary projections**; authoritative mutations and deep domain state remain on the existing API surfaces documented in `packages/shared/src/apiContracts.ts`.

## Design principles

1. **No parallel systems** — `NexusPlatformExpansionService` delegates to canonical services via `nexusPlatformCanonicalDeps.ts` and maps results in `nexusPlatformProjections.ts`.
2. **Shared contracts** — Response shapes live in `packages/shared/src/nexusPlatformExpansion.ts` and are registered in `apiContracts.ts`.
3. **Tenant isolation** — All workspaces are scoped by `organizationId`, `tenantId`, and `racetrackId`. Branding, report jobs, and marketplace toggles enforce scope.
4. **Subscription entitlements** — Marketplace enablement checks `EntitlementService` before mutating feature flags (prompt 01).
5. **Approval & audit** — Operational intelligence, workflow automation, compliance, security, and facilities projections read from approval-gated canonical services; nexus routes do not bypass human approval workflows.
6. **AI governance** — Recommendations in operational intelligence are `advisoryOnly: true`. AI governance registry projects from `createAIModelCardRegistry()`.

## Canonical source map

| Prompt | Nexus route | Canonical source |
|--------|-------------|------------------|
| 03 | `/marketplace/*` | `EntitlementService`, `TenantService`, `FeatureFlagService`, `config/saas/modules.json` |
| 04 | `/white-label/*` | Nexus-owned branding store (migration `016_nexus_platform_expansion.sql`) |
| 05 | `/digital-twin/platform/workspace` | `DigitalTwinRuntime`, `createCommandCenterContractSnapshot()` |
| 06 | `/operational-intelligence/center` | Command center snapshot, `IncidentService` |
| 07 | `/equine-welfare/*` | `EquineIntelligencePrivacyService` |
| 08 | `/predictive-analytics/workspace` | `createAnalyticsWorkspace()` |
| 09 | `/reporting/*` | Config templates + tenant-scoped report job store |
| 10 | `/workflow-automation/workspace` | `workflowTemplateRegistry()`, `WorkflowOrchestrationEngine` |
| 11 | `/integration-hub/workspace` | `config/platform-expansion/integration-connectors.json`, Racing Data Hub providers |
| 12 | `/mobile-operations/workspace` | `config/platform-expansion/mobile-workflows.json` |
| 13 | `/compliance-command-center/workspace` | `ComplianceControlLibrary.dashboard()` |
| 14 | `/security-soc/workspace` | `SecurityOperationsService.getWorkspace()` |
| 15 | `/facilities-command/workspace` | `FacilitiesMaintenanceService.workspace()` |
| 16 | `/federation-intelligence/workspace` | `createFederationWorkspace()`, `createAnalyticsWorkspace()` |
| 17 | `/ai-governance-registry/workspace` | `createAIModelCardRegistry()` |
| 18 | `/knowledge-graph/workspace` | `globalSearch()` |
| 19 | `/executive-intelligence/suite` | Customer executive dashboard + ops + compliance projections |
| 20 | `/platform/enterprise-readiness` | `PlatformObservabilityService.health()`, `production-readiness.json` |

## Parallel routes (intentional)

Nexus workspace routes complement — they do not replace — canonical routes such as:

- `/operations/command-center` (full command center)
- `/compliance/control-library` (full control library)
- `/facilities-maintenance/workspace` (full facilities workspace)
- `/security-operations/workspace` (full SOC workspace)
- `/federation/workspace` (full federation governance)
- `/subscriptions/entitlements` (licensing source of truth)

## Configuration

- `config/platform-expansion/marketplace-catalog.json`
- `config/platform-expansion/white-label-defaults.json`
- `config/platform-expansion/integration-connectors.json`
- `config/platform-expansion/report-templates.json`
- `config/platform-expansion/mobile-workflows.json`
- `config/platform-expansion/production-readiness.json`

Set `TRACKMIND_REPO_ROOT` when running tests that load configuration from the monorepo root.

## Tests

- `packages/shared/tests/nexus-platform-expansion.test.mjs` — shared band helpers
- `apps/api/tests/nexus-platform-expansion.test.mjs` — facade integration and contract registration

## SaaS context

TrackMind Nexus is a **commercial multi-racetrack SaaS Operating System**. Nexus expansion workspaces are tenant-scoped product surfaces for portfolio operators; subscription plans (prompt 01) and customer management (prompt 02) govern what each organization can enable in the marketplace.
