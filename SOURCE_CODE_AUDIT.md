# Source Code Audit

Audit date: 2026-06-14

## Scope reviewed

- TypeScript workspaces: `packages/shared`, `apps/api`, and `apps/dashboard`.
- Python agent entrypoint: `apps/agents/trackmind_agents/main.py`.
- Repository documentation, infrastructure, database migrations, service templates, and compliance/control references.
- Existing automated checks: root tests, workspace builds, and dashboard tests.

## Implemented feature areas

- Shared policy and domain kernel foundations for protected actions, RBAC, identity governance, tenant isolation, entity schemas, and safety rules.
- API domain slices for approvals, immutable audit logging, universal event bus, workflow orchestration, Digital Twin runtime/foundation/graph, track configuration, race operations, race-day readiness, surface intelligence, barn operations, security operations, emergency operations, stewarding, compliance controls, policy engine, responsible AI governance, racetrack asset registry, enterprise API gateway, observability, geospatial operations, and equine intelligence.
- Dashboard mock/live adapter with a command-center shell, role-aware navigation, approval-gated controls, operational widgets, Digital Twin state displays, and domain workspaces.
- Documentation for architecture intent, compliance mappings, security baseline, onboarding, service templates, and implementation sequencing.

## Key findings

| Area | Status | Notes |
| --- | --- | --- |
| Build health | Passing | TypeScript builds complete for shared, API, and dashboard workspaces. |
| Test health | Improved | Root `npm test` previously skipped dashboard tests even though dashboard has its own test suite. The root test script now includes dashboard tests. |
| Broken imports | No current blocker found | Workspace builds did not reveal unresolved TypeScript imports. |
| Frontend/backend contract drift | Partial risk | Dashboard live paths are hand-coded and API services are mostly in-memory/domain modules rather than an HTTP router implementation, so DTO drift can still occur without generated OpenAPI/client contracts. |
| Weak typing | Improved | `NexusApiClient.getAIGovernanceWorkspace()` used `Promise<any>` and mock compliance data used `as any`; these were narrowed to explicit dashboard DTO/framework types. |
| Incomplete stubs/placeholders | Present by design | Python agents, future service folders, integrations, Terraform environment folders, compliance framework placeholder data, and mock dashboard adapters are explicitly scaffolding/reference implementations. |
| Security gaps | Production gap | In-memory services model RBAC, approvals, audit, and tenant context, but production authentication, durable authorization enforcement, secret management, mTLS termination, persistence, and rate limiting are not fully wired to a deployable HTTP boundary. |
| Missing validation | Partial risk | Many domain modules validate critical fields, but validation style is inconsistent and not centralized around versioned request schemas for every API boundary. |
| Missing audit/events | Partial risk | Core protected workflows emit audit/events, but not every helper or dashboard adapter has an externally verifiable event contract. Contract tests should be expanded around event schemas and audit completeness. |
| Approval checks | Strong in core domains | Protected action tests cover approvals extensively. Remaining risk is at integration/HTTP boundary because live endpoint enforcement is not represented as a real server. |
| Digital Twin sync | Partial | Several slices synchronize or queue Twin updates, but synchronization is in-memory/reference-level and lacks durable reconciliation, rollback, and outbox processing. |
| Duplicated logic | Present | Repeated mock DTO construction, id/date helpers, clone helpers, audit/event helper patterns, and approval/evidence literals appear across modules. Consolidation should be incremental to avoid destabilizing tests. |
| Unused/scaffold files | Present | `.gitkeep` service/app/integration placeholders and template files are intentionally unused until future production modules are implemented. |
| Documentation drift | Moderate | README and architecture docs correctly describe reference/stub status, but root test documentation implied `npm test` covered automated tests broadly while dashboard tests were omitted until this change. |


## TrackMind Nexus target-architecture gap classification (2026-06-14 follow-up)

| Target area | Gap | Severity | Remediation status |
| --- | --- | --- | --- |
| Responsible AI governance / approval engine | AI intent verbs from the Nexus definition (`start-race`, `clear-veterinary-flag`, `execute-safety-critical-control`, etc.) were not normalized consistently to platform protected actions (`race-start`, `clear-vet-flag`, `safety-critical-control`, etc.), creating a potential policy bypass or missing approval policy lookup when callers used definition-language action names. | Critical | Fixed by adding a shared normalization map and routing Nexus safety evaluation and protected execution requests through it. |
| Approval engine | Default approval policies covered core aliases but not every normalized protected action (`race-stop`, `modify-official-results`, `scratch-horse`, `clear-vet-flag`, `steward-ruling`, `emergency-personnel-override`). | Critical | Fixed by adding explicit policies for the missing normalized protected actions with role chains, evidence, expiration, and escalation rules. |
| Shared types | Shared safety types exposed both AI autonomy intent names and platform protected action names without a first-class bridge type. | High | Fixed by exporting `protectedActionIntentMap`, `ProtectedActionIntent`, `NormalizedProtectedAction`, and normalization helpers from the shared package. |
| API contracts | Dashboard live clients still target endpoint paths without a deployable HTTP router or generated OpenAPI/client binding for every module. | High | Not fixed in this pass; remains a next priority because it requires introducing or generating HTTP adapters across multiple modules. |
| Event bus / audit ledger | Core protected workflows emit events and hash-chained audit records, but external API boundary event/audit completeness is not enforced uniformly for future HTTP handlers. | Medium | Partially covered by existing domain tests; contract-level enforcement remains recommended. |
| Digital Twin runtime | Runtime is in-memory/reference-level and lacks durable outbox/reconciliation for production Azure Digital Twins synchronization. | Medium | Not fixed in this pass; current safety alignment is modeled and tested in memory. |
| Asset registry | Registry models controlled assets and approval-sensitive controls but is not connected to live actuators, which is correct for the first slice but leaves production execution adapters absent. | Medium | No change; intentional safety posture. |
| Workflow engine | Workflow state machines and approvals are modeled, but BPMN/external-worker persistence is still reference-level. | Medium | No change in this pass. |
| Frontend app shell / command-center UX | Command-center shell and disabled safety controls are covered by tests, but live/mock DTO duplication can drift over time. | Medium | Not fixed in this pass; typed fixture consolidation remains recommended. |
| Domain models | Canonical entities and metadata are present; some service-specific models still use local literals instead of central shared unions. | Low | Partially improved by centralizing protected action normalization; broader consolidation remains incremental work. |

## Safe incremental fixes made

1. Added dashboard tests to the root `npm test` command so frontend/backend contract checks and command-center UI safeguards run in the default verification path.
2. Added an explicit `AIGovernanceWorkspaceDto` dashboard contract and changed the dashboard client from `Promise<any>` to `Promise<AIGovernanceWorkspaceDto>`.
3. Removed avoidable `as any` casts in dashboard compliance mock data by using the existing `ComplianceFrameworkIdDto` union.
4. Added shared protected-action intent normalization so AI governance, Nexus safety decisions, and backend approval requests treat definition-language protected actions and platform protected actions consistently.
5. Added missing normalized protected-action approval policies for race stops, official-result modification, horse scratches, vet-flag clearance, steward rulings, and emergency-personnel overrides.

## Recommended next steps

1. Add an HTTP adapter/router layer or generated OpenAPI contract tests that bind API domain modules to the dashboard live client paths.
2. Introduce shared event/audit envelope test helpers so every protected state transition proves tenant, actor, evidence, approval, audit hash, and event emission coverage.
3. Move repeated mock DTO factories and approval/evidence constants into typed fixtures to reduce drift across dashboard tests and source.
4. Add durable persistence/outbox design tests for Digital Twin synchronization and approval execution tokens before production integration.
5. Add schema validation at every external boundary using versioned request/response contracts.
6. Clarify lifecycle status for scaffold directories in a single repository map to distinguish intentional placeholders from incomplete production modules.
