# Source Code Audit

Audit date: 2026-06-14

## Scope reviewed

- TypeScript workspaces: `packages/shared`, `apps/api`, and the canonical `apps/frontend` shell.
- Python agent entrypoint: `apps/agents/trackmind_agents/main.py`.
- Repository documentation, infrastructure, database migrations, service templates, and compliance/control references.
- Existing automated checks: root tests plus backend/shared/frontend workspace builds and focused frontend contract tests.

## Implemented feature areas

- Shared policy and domain kernel foundations for protected actions, canonical RBAC permissions, organization/tenant/racetrack/user scope, entity schemas, and safety rules.
- API domain slices for approvals, immutable audit logging, universal event bus, workflow orchestration, Digital Twin runtime/foundation/graph, track configuration, race operations, race-day readiness, surface intelligence, barn operations, security operations, emergency operations, stewarding, compliance controls, policy engine, responsible AI governance, racetrack asset registry, enterprise API gateway, observability, geospatial operations, and equine intelligence.
- Canonical frontend shell rebuilt from backend contracts, route metadata, central API adapters, and governed AI/KPI display rules.
- Documentation for architecture intent, compliance mappings, security baseline, onboarding, service templates, and implementation sequencing.

## Key findings

| Area | Status | Notes |
| --- | --- | --- |
| Build health | Passing | Builds complete for shared, API, and the new frontend shell. |
| Test health | Focused | Root and workspace tests cover shared, API, frontend contract checks, and service-template checks. |
| Broken imports | No current blocker found | Workspace builds did not reveal unresolved TypeScript imports. |
| Frontend/backend contract drift | Improved | The old dashboard and temporary shell have been removed; `apps/frontend` now uses route metadata, centralized API paths, scoped client headers/query params, and source-aware API adapters. |
| Weak typing | Improved | Backend/shared/frontend contract typing remains enforced by current workspace builds and frontend typecheck. |
| Incomplete stubs/placeholders | Present by design | Python agents, future service folders, integrations, Terraform environment folders, and compliance framework placeholder data are explicitly scaffolding/reference implementations. |
| Security gaps | Production gap | In-memory services model RBAC, approvals, audit, and tenant context, but production authentication, durable authorization enforcement, secret management, mTLS termination, persistence, and rate limiting are not fully wired to a deployable HTTP boundary. |
| Missing validation | Partial risk | Many domain modules validate critical fields, but validation style is inconsistent and not centralized around versioned request schemas for every API boundary. |
| Missing audit/events | Reduced risk | Core protected workflows emit audit/events through the canonical `CanonicalEventEnvelope` fields and `UniversalEventBus`; CQRS, security, workforce, barn, and equine helpers now normalize to versioned event names. Remaining risk is durable outbox/HTTP production wiring rather than duplicate event contracts. |
| Approval checks | Strong in core domains | Protected action tests cover approvals extensively. Remaining risk is at integration/HTTP boundary because live endpoint enforcement is not represented as a real server. |
| Digital Twin sync | Partial | Several slices synchronize or queue Twin updates, but synchronization is in-memory/reference-level and lacks durable reconciliation, rollback, and outbox processing. |
| Duplicated logic | Present | Repeated mock DTO construction, id/date helpers, clone helpers, audit/event helper patterns, and approval/evidence literals appear across modules. Consolidation should be incremental to avoid destabilizing tests. |
| Unused/scaffold files | Present | `.gitkeep` service/app/integration placeholders and template files are intentionally unused until future production modules are implemented. |
| Documentation drift | Reduced | README and architecture docs now identify `apps/frontend` as the canonical rebuilt shell and distinguish facade/stub/mock support. |


## TrackMind Nexus target-architecture gap classification (2026-06-14 follow-up)

| Target area | Gap | Severity | Remediation status |
| --- | --- | --- | --- |
| Responsible AI governance / approval engine | AI intent verbs from the Nexus definition (`start-race`, `clear-veterinary-flag`, `execute-safety-critical-control`, etc.) were not normalized consistently to platform protected actions (`race-start`, `clear-vet-flag`, `safety-critical-control`, etc.), creating a potential policy bypass or missing approval policy lookup when callers used definition-language action names. | Critical | Fixed by adding a shared normalization map and routing Nexus safety evaluation and protected execution requests through it. |
| Approval engine | Default approval policies covered core aliases but not every normalized protected action (`race-stop`, `modify-official-results`, `scratch-horse`, `clear-vet-flag`, `steward-ruling`, `emergency-personnel-override`). | Critical | Fixed by adding explicit policies for the missing normalized protected actions with role chains, evidence, expiration, and escalation rules. |
| Shared types | Shared safety types exposed both AI autonomy intent names and platform protected action names without a first-class bridge type. | High | Fixed by exporting `protectedActionIntentMap`, `ProtectedActionIntent`, `NormalizedProtectedAction`, and normalization helpers from the shared package. |
| API contracts | API routes, response envelopes, metadata, errors, pagination, and frontend adapters needed one shared contract standard. | Medium | Fixed by extending `apiEndpointContracts` with the canonical `ApiResponse` envelope, request metadata, pagination modes, structured `ApiError`, frontend envelope unwrapping, and removal of duplicate KPI/Racing Data route aliases. |
| Event bus / audit ledger | Core protected workflows emit events and hash-chained audit records, but external API boundary event/audit completeness is not enforced uniformly for future HTTP handlers. | Medium | Partially covered by existing domain tests; contract-level enforcement remains recommended. |
| Digital Twin runtime | Runtime is in-memory/reference-level and lacks durable outbox/reconciliation for production Azure Digital Twins synchronization. | Medium | Not fixed in this pass; current safety alignment is modeled and tested in memory. |
| Asset registry | Registry models controlled assets and approval-sensitive controls but is not connected to live actuators, which is correct for the first slice but leaves production execution adapters absent. | Medium | No change; intentional safety posture. |
| Workflow engine | Workflow state machines and approvals are modeled, but BPMN/external-worker persistence is still reference-level. | Medium | No change in this pass. |
| Frontend app shell / command-center UX | Previous command-center UI and temporary route stub have been removed; `apps/frontend` is now the canonical backend-driven shell. | Medium | Continue hardening route coverage and replace read-only disabled action rails only when governed draft/approval handlers exist. |
| Domain models | Canonical entities and metadata are present; some service-specific models still use local literals instead of central shared unions. | Low | Partially improved by centralizing protected action normalization; broader consolidation remains incremental work. |

## Safe incremental fixes made

1. Removed the previous dashboard workspace from the active build and test surface and replaced it with the canonical `apps/frontend` shell.
2. Added shared protected-action intent normalization so AI governance, Nexus safety decisions, and backend approval requests treat definition-language protected actions and platform protected actions consistently.
3. Added missing normalized protected-action approval policies for race stops, official-result modification, horse scratches, vet-flag clearance, steward rulings, and emergency-personnel overrides.
4. Added a backend-driven frontend route registry, API adapter layer, scoped client context, KPI artifact display, and read-only AI action rail.

## Recommended next steps

1. Add an HTTP adapter/router layer or generated OpenAPI contract tests that bind API domain modules to the active frontend client paths.
2. Introduce shared event/audit envelope test helpers so every protected state transition proves tenant, actor, evidence, approval, audit hash, and event emission coverage.
3. Keep frontend route metadata reconciled with actual adapter calls and shared API contracts.
4. Add durable persistence/outbox design tests for Digital Twin synchronization and approval execution tokens before production integration.
5. Add schema validation at every external boundary using versioned request/response contracts.
6. Clarify lifecycle status for scaffold directories in a single repository map to distinguish intentional placeholders from incomplete production modules.
