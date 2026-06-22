# TrackMind Nexus Implementation Traceability

This manifest maps the vertical-slice execution prompts to current reference implementations, API routes, tests, and known extraction gaps. It is intentionally descriptive: production services must still preserve approval gates, immutable audit trails, event lineage, tenant isolation, and advisory-only AI boundaries.

| Prompt | Current Code | Runtime Route | Tests | Remaining Gap |
| --- | --- | --- | --- | --- |
| Race Office | `apps/api/src/raceOperationsService.ts`, `services/race-operations/` (in-process adapter), `apps/api/src/raceOperationsPlatform.ts`; surfaced through `apps/frontend/src/routes/routes.ts` | `/api/v1/race-operations/race-office` | `apps/api/tests/race-office-vertical-slice.test.mjs`, `apps/api/tests/race-operations-platform.test.mjs`, `services/race-operations/tests/`, `apps/frontend/tests/frontend-contracts.test.mjs` | Promote `services/race-operations` to standalone HTTP runtime; replace remaining placeholder facade fields with service read models. |
| Surface Intelligence | `apps/api/src/trackSurface.ts`; surfaced through the canonical Race Day workspace route and API adapter | `/api/v1/surface-intelligence/workspace`, `/api/v1/track-surface/measurements` | `apps/api/tests/surface-intelligence.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Governed live weather/provider integration remains placeholder-labeled; frontend does not yet load this route directly. |
| Equine Intelligence | `apps/api/src/equineIntelligencePlatform.ts`, `apps/api/src/services/equine`, `apps/frontend/src/api/services.ts` | `/api/v1/horses/{id}/*`, `/api/v1/equine-intelligence/horses/{id}` | `apps/api/tests/equine-privacy-api.test.mjs`, `apps/api/tests/equine-four-layer-platform.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Keep veterinary privacy scope server-side; frontend shows restricted status by default. |
| Barn Operations | `apps/api/src/barnOperations.ts`; surfaced through the canonical Equine workspace route and API adapter | `/api/v1/barn-operations/workspace` | `apps/api/tests/barn-operations.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Extract standalone service and wire the frontend adapter when the dedicated barn read model is ready. |
| Steward Center | `apps/api/src/stewarding.ts`, `apps/api/src/services/stewardingService.ts` | `/api/v1/stewarding/inquiries`, `/api/v1/services/stewarding/*` | `apps/api/tests/stewarding-center.test.mjs`, `apps/api/tests/apex-domain-services.test.mjs` | Harden final-ruling backend invariants and move stewarding out of compatibility-rendered dashboard sections. |
| Security Operations | `apps/api/src/securityOps.ts`, `apps/api/src/services/securityService.ts`, `apps/frontend/src/api/services.ts` | `/api/v1/security-operations/workspace`, `/api/v1/services/security/*` | `apps/api/tests/security-ops-end-to-end.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Extract standalone `services/security` if needed and add deeper route-level masking tests. |
| Emergency Operations | `apps/api/src/emergencyOperations.ts`, `apps/api/src/services/safetyService.ts` | `/api/v1/emergency-operations/workspace`, `/api/v1/services/safety/emergency-actions` | `apps/api/tests/emergency-operations.test.mjs`, `apps/api/tests/apex-domain-services.test.mjs` | Add emergency-native mutation routes with command-role enforcement and post-action evidence semantics. |
| Compliance Control Library | `apps/api/src/complianceControlLibrary.ts`, `apps/api/src/compliance` | `/api/v1/compliance/control-library`, `/api/v1/compliance/*` | `apps/api/tests/compliance-control-library.test.mjs`, `apps/api/tests/ai-act-compliance-framework.test.mjs` | Add shared contract schema for control-library DTO and complete corrective-action lifecycle methods. |
| Responsible AI Governance | `apps/api/src/responsibleAiGovernor.ts`, `apps/api/src/aiControlPlane.ts`, `apps/api/src/platform/aiRegistryService.ts`, `apps/agents/router`, `apps/frontend/src/pages/WorkspacePage.tsx` | `/api/v1/ai-governance/workspace`, `/api/v1/ai-control-plane/*`, `/api/v1/ai-governance/model-registry`, `/api/v1/ai-governance/prompt-lineage/*`, router endpoints | `apps/api/tests/responsible-ai-governance-end-to-end.test.mjs`, `apps/api/tests/ai-control-plane.test.mjs`, `apps/agents/router/tests`, `apps/frontend/tests/frontend-contracts.test.mjs` | Frontend governed mutation actions remain disabled until UX approval flows complete; production model-card storage beyond in-memory registry. |
| Platform Observability | `apps/api/src/platformObservability.ts`, `apps/api/src/server.ts` (`platformObservability` facade wiring), `apps/frontend/src/api/services.ts` | `/api/v1/platform/health` | `apps/api/tests/platform-observability.test.mjs`, `apps/api/tests/runtime-server.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Wire production Azure telemetry dashboards and live dependency checks against real Postgres/event-bus connectors. |

## Bounded-Context Service Scaffolds

Contract-only scaffolds now exist under:

- `services/events`
- `services/barn-operations`
- `services/race-operations` — contract scaffold with in-process read adapter wired into `apps/api`; standalone HTTP runtime available via `npm run start -w @trackmind/race-operations-service`
- `services/safety`
- `services/stewarding`
- `services/tenant`

These folders are not production runtimes yet, except `services/race-operations` which exposes an in-process adapter and optional standalone HTTP server. Their `service.catalog.yaml` files point to current reference implementations and declare the protected actions that must remain approval-gated during extraction.

## Feature Implementation Master Plan (20 Waves)

Platform wave handlers live in `apps/api/src/platform/` and are routed through `handlePlatformRequest` in `apps/api/src/server.ts`. Shared DTOs are in `packages/shared/src/platformFoundation.ts`.

| Wave | Current Code | Runtime Routes | Tests | Remaining Gap |
| --- | --- | --- | --- | --- |
| 01 Foundation | `tenantService.ts`, `featureFlags.ts`, `repository/repositoryAdapter.ts`, `platformController.ts` | `GET/POST /platform/foundation`, `/platform/organizations`, `/platform/tenants`, `/platform/racetracks`, `/platform/feature-flags/evaluate`, `/platform/environment` (+ canonical `/organizations`, `/tenants`, `/racetracks`) | `wave-implementation.test.mjs` (wave 01 CRUD + evaluate + environment), `repository-persistence.test.mjs` (namespaced snapshot + postgres mock reload) | User management APIs (Wave 04); live Postgres integration tests against docker-compose |
| 02 Design System | `AppShell.tsx`, `CommandBar.tsx`, `NotificationCenter.tsx`, `DegradedStateBanner.tsx`, `SupportStatusBadge.tsx`, `kpi-strip.tsx`, `states.tsx`, `TenantRacetrackScopePicker.tsx` | Frontend shell only (no new API routes) | `wave-02-design-system.test.mjs`, `frontend-contracts.test.mjs` | Remaining facade routes promoted to live-api as backends mature; incident timeline SSE wired in security workspace |
| 03 Routes | `routes.ts`, `paths.ts`, `useIncidentTimelineStream.ts` | `/analytics`, `/fan-experience`, `/notifications`, `/incidents/*/timeline/stream` | `frontend-contracts.test.mjs`, `wave-03-route-architecture.test.mjs`, `compliance-wiring.test.mjs` | Route coverage report for all GET contracts; eliminate duplicate pathSource aliases where paths share URL |
| 07 KPI Platform | `kpiCalculationService.ts`, `kpiArtifacts.ts`, `kpiPlatformService.ts`, `approvals.ts` | `/kpis`, `/kpis/recalculate`, `/kpis/{kpiId}/snapshots`, `/kpis/thresholds/draft-requests` | `governance-lineage.test.mjs`, `centralized-approval-service.test.mjs`, `wave-implementation.test.mjs` | Threshold-change approval workflow UI; Postgres-backed KPI threshold persistence |
| 08 Dashboards | `analyticsService.ts`, `platformController.ts` | `/analytics/workspace`, `/federation/kpi-aggregation`, `/kpis` | `wave-implementation.test.mjs`, `governance-lineage.test.mjs`, `frontend-contracts.test.mjs` | Predictive forecast charts; real-time dashboard SSE |
| 05 Audit | `auditAdapter.ts`, `auditVaultAdapter.ts`, `platformController.ts` | `/audit/search`, `/audit/exports` | `wave-implementation.test.mjs`, `audit-vault-adapter.test.mjs` | External WORM vault against Azure Blob/immutable storage; vault disabled by default until `TRACKMIND_AUDIT_VAULT_ENABLED=true` |
| 09 Race Day | `paddockOperations.ts`, `raceOperationsService.ts`, `racePanels.tsx` | `/race-operations/paddock`, `/race-operations/schedule`, `/races/{id}/start` | `wave-implementation.test.mjs`, `frontend-contracts.test.mjs` | Approval-gated race start UI flows complete; production gate crew telemetry integration |
| 11 Incidents | `incidentService.ts`, `postgresRecordStore.ts`, `useIncidentTimelineStream.ts`, `securityPanels.tsx` | `/incidents`, `/incidents/{id}`, `/incidents/{id}/timeline/stream` | `wave-implementation.test.mjs`, `incident-persistence.test.mjs`, `frontend-contracts.test.mjs` | Real-time incident SSE timeline production hardening; live Postgres incident store (docker-compose integration tests) |
| 16 Fan Experience | `fanExperience.ts`, `ticketingAdapter.ts` | `/fan-experience/workspace` | `wave-implementation.test.mjs` | External ticketing integrations (replace mock connector registry) |
| 17 Finance | `financePlatform.ts`, `settlementAdapter.ts` | `/finance/workspace` | `wave-implementation.test.mjs`, `racing-finance-platform.test.mjs` | GL/settlement connectors to licensed wagering backends |
| 18 AI Governance | `aiRegistryService.ts`, `platformController.ts` | `/ai-governance/model-registry`, `/ai-governance/model-registry/models`, `/ai-governance/model-registry/prompts`, `/ai-governance/prompt-lineage/drafts`, `/ai-governance/prompt-lineage/{draftId}/publish` | `wave-implementation.test.mjs`, `responsible-ai-governance-end-to-end.test.mjs` | Durable registry persistence; frontend publish/draft UX |
| 19 Data Hub | `dataHubAdapter.ts`, `businessPanels.tsx` (entity-resolution draft UI) | `/racing-data/providers/{id}/execute`, `/racing-data/entity-resolution`, `/federation/kpi-aggregation` | `wave-implementation.test.mjs`, `frontend-contracts.test.mjs` | Live licensed provider pulls |
| 15 Facilities | `facilitiesMaintenance.ts`, `facilitiesUtilitiesAdapter.ts`, `FacilitiesGeospatialMap.tsx`, `facilitiesKpiPack.ts` | `/facilities-maintenance/workspace`, `/map`, `/utilities`, `POST /maintenance-schedules`, `POST /incidents` | `facilities-maintenance.test.mjs`, `runtime-server.test.mjs` | Live SCADA/BMS integrations; durable incident store |
| 20 Convergence | `globalSearchService.ts`, `notificationFramework.ts`, `contractCoverageReport.ts`, `postgresRecordStore.ts`, `repositoryAdapter.ts` | `/search/global`, `/notifications/inbox`, `/notifications/delivery-adapters`, `/notifications/delivery-audit-trail`, `/platform/contract-coverage` | `wave-implementation.test.mjs`, `repository-persistence.test.mjs`, `notification-delivery.test.mjs` | Azure telemetry dashboards; production Postgres repository wiring for all platform stores |

## Phase 2 Swarm 20 Convergence (2026-06-21)

- `npm run validate` and `npm run perf:smoke` pass across shared, API, frontend, agents, and service-template workspaces.
- `kpi-threshold-change` approval policy registered in `apps/api/src/approvals.ts` (admin/operations-admin chain, 60-minute expiry, compliance-officer escalation).
- Frontend route adapter sources remain `live-api` by default; duplicate pathSource keys deduplicated where race-day and surface routes share URLs.
- Incident lifecycle events publish to the platform event bus (`incident.reported.v1` via `eventType`; unversioned `type` alias is `incident.reported`).
- RBAC: `updateHorseEligibility` maps to `discipline:issue` so steward role aligns with endpoint allowlist.

## Phase 3 Swarm 20 Convergence (2026-06-21)

- `npm run validate` and `npm run perf:smoke` pass across shared, API, frontend, agents, service-template, and `@trackmind/race-operations-service` workspaces.
- **Audit WORM vault**: `auditVaultAdapter.ts` backs `/audit/exports` and export-mode `/audit/search`; gated by `TRACKMIND_AUDIT_VAULT_ENABLED`; contract schema `AuditVaultExportListDto` registered in `packages/shared`.
- **Repository persistence**: `postgresRecordStore.ts`, migrations `017_repository_persistence.sql` and `018_incident_repository_persistence.sql`; opt-in via `TRACKMIND_PERSISTENCE_MODE=postgres`; boot wiring in `repositoryAdapter.wireRepositoryAdaptersOnBoot`.
- **Incident durability**: `incidentService.ts` reloads from namespaced Postgres store; SSE timeline stream at `/incidents/{id}/timeline/stream`; frontend hook `useIncidentTimelineStream.ts`.
- **Notification delivery**: unified in-app, email-stub, and webhook-stub adapters with delivery audit trail (`/notifications/delivery-adapters`, `/notifications/delivery-audit-trail`).
- **AI prompt lineage**: draft/publish mutations at `/ai-governance/prompt-lineage/*` with immutable audit records (`ai.prompt-lineage.draft.created`, `ai.prompt-lineage.published`).
- **Race operations extraction**: `services/race-operations` bounded-context package built before API typecheck; facade delegates through `raceOperationsService.ts`.
- **Platform observability**: `PlatformObservabilityService` merged into `/platform/health` with repository and connector dependency probes.
- **Frontend convergence**: `TenantRacetrackScopePicker`, Data Hub entity-resolution RBAC in `businessPanels.tsx`, compliance wiring tests (`compliance-wiring.test.mjs`).
- **API build chain**: `apps/api` prebuilds `@trackmind/race-operations-service` to satisfy type declarations.

### Remaining production gaps (Phase 3)

| Area | Current state | Production gap |
| --- | --- | --- |
| Postgres persistence | In-memory fallback with mock `pg` client in tests | Live docker-compose / Azure Database integration; wire all namespaces (KPI thresholds, AI registry, notifications) |
| Audit WORM vault | In-memory sealed exports when enabled | Azure Blob immutable tier or third-party WORM vault; compliance export retention policies |
| Race operations service | In-process adapter + optional standalone HTTP | Deploy as independent service; cut over facade routes from monolith |
| Ticketing / fan experience | Mock connector registry (`ticketingAdapter.ts`) | Licensed POS/ticketing vendor APIs with attendance sync |
| Finance settlement | `settlementAdapter.ts` stub | Wagering/GL settlement connectors with dual-control payout execution |
| Emergency operations | `emergencyOperationsService.ts` + safety boundary scaffold | Command-role enforcement on native mutation routes; post-action evidence capture |
| Platform telemetry | Dependency matrix in health DTO | Azure Monitor / Application Insights dashboards and alert routing |
| AI registry | In-memory model/prompt cards | Durable registry store with evaluation artifact lineage |
| Provider data hub | Simulated provider invoke | Live licensed racing-data pulls with rate-limit and license enforcement at edge |
| Incident SSE | Working stream with mock/reload store | Production SSE hardening (reconnect auth, backpressure, durable revision cursors) |
