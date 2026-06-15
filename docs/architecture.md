# Architecture

TrackMind-MoE combines PostgreSQL migrations/seeds for the target operational store, an in-memory/reference race-day event bus, expert-agent stubs, reference Digital Twin and IoT facades, a rulebook RAG interface, Azure deployment baseline, and a canonical backend-driven React frontend shell. Critical AI outputs remain recommendations until human approval is recorded.

## Build intent

See `docs/TRACKMIND_BUILD_INTENT.md` for the current platform build intent, including the product vision, safety boundaries, human-approval requirements, Digital Twin/event/audit/workflow/rules/AI governance model, and phased roadmap. See `docs/TRACKMIND_IMPLEMENTATION_PLAN.md` for the incremental execution plan that maps the intent into repository workstreams.

See `docs/architecture/racing-operating-system-standardization-framework.md` for the Racing Operating System and TrackMind Standardization Framework. It defines the operating-model tree, ten standardization tiers, HISA-aligned readiness reference, ISO/IEC 42001 AI management anchor, deployment modes, and the boundary between readiness metadata and implemented runtime capability.

See `docs/architecture/universal-artifact-framework.md` for the TrackMind Universal Artifact Framework. It defines the canonical artifact flow from inputs through events, artifacts, Digital Twins, feature metadata, AI models, recommendations, approvals, outputs, and audits while preserving tenant ownership, lineage, safety constraints, integration points, and the distinction between metadata/facades and production infrastructure.

See `docs/architecture/racing-data-api-hub.md` for the TrackMind Racing Data API Hub. It defines the provider-agnostic licensed ingestion architecture for racing data, including adapter-ready source categories, no-scraping/no-public-redistribution assumptions, provider registry and connector contracts, raw landing, validation, normalization, canonical racing artifacts, entity resolution, data quality, API and frontend workspace expectations, Digital Twin/event/audit integration, and AI training restrictions without implying that external providers are already integrated or licensed.

## Canonical Business Domains

`packages/shared/src/domainKernel.ts` is the canonical entity model for organization, tenant, user, racetrack, horse, race, incident, facility, security event, compliance record, approval, audit event, and AI recommendation records. `packages/shared/src/accessControl.ts` owns the single `Role` and `Permission` unions, including identity-governance permissions, and `packages/shared/src/kpiArtifacts.ts` owns the governed `KPI` artifact model. API DTOs, frontend models, Python agent contracts, and database migrations should project from these shared contracts rather than creating local duplicate entities.

The durable schema mirrors that split: core twins and racing entities live in `002_dtdl_core_entities.sql`, approvals in `004_approval_required_actions.sql`, audit/events in `005_event_sourcing.sql`, KPI artifacts in `007_kpi_artifacts.sql`, and organization/tenant/user/facility/security/compliance domains in `008_canonical_business_domains.sql`.

## Canonical Database Design

`db/migrations/012_canonical_database_design.sql` is the forward normalization layer for durable storage. It standardizes tenant/racetrack scope, adds logical text IDs alongside historical UUID aggregate keys, rewrites race-day CQRS projections to use canonical string IDs, adds scoped indexes for operational reads, introduces tenant-aware KPI scope keys, and creates the missing canonical relationship tables for race meets, race days, race entries, horse owner/veterinarian links, steward panels, barns, stalls, and assets.

Historical tables such as `approval_action_events`, `source_service`, and UUID aggregate references remain compatibility storage, but canonical reads and new writes should use `tenant_id`, `racetrack_id`, logical entity IDs, `events.source`, `approval_request_id`, canonical audit JSON fields, and scoped KPI keys. Database changes should preserve tenant/racetrack indexes and avoid new globally keyed operational tables unless the shared domain model explicitly defines the entity as organization- or tenant-global.

## Canonical Event Architecture

`packages/shared/src/foundation.ts` owns the canonical event envelope and event reference shape: `eventId`, `eventType`, `tenantId`, `racetrackId`, `actorId`, `source`, `timestamp`, `payload`, and `version`. `apps/api/src/eventBus.ts` is the canonical runtime event facade; CQRS persistence in `apps/api/src/events` maps commands into the same envelope and uses versioned `context.entity.verb.vN` names. Durable event storage is defined in `005_event_sourcing.sql` and normalized with `009_canonical_event_contract.sql`.

## Canonical Audit Architecture

`packages/shared/src/foundation.ts` owns the canonical audit contract: `auditEventId`, `actor`, `entity`, `action`, `reason`, `approvalReference`, `timestamp`, `tenantScope`, and `integrityReference`. `apps/api/src/auditLog.ts` is the canonical runtime ledger; it accepts legacy service inputs but stores and exports canonical audit records with hash-chain integrity. API DTOs expose the same shape through `AuditEventDto`, frontend audit cards render canonical actor/entity/scope/integrity fields, and durable event storage is extended by `010_canonical_audit_contract.sql` for canonical audit columns and indexes.

## Canonical Approval Architecture

`packages/shared/src/accessControl.ts` owns the canonical approval model: approval request identity, status, approver roles, evidence, escalation, expiration, and audit linkage. `apps/api/src/approvals.ts` is the runtime approval engine for regulated actions; it normalizes legacy statuses, enforces chained human approvals, emits audit/event references, and issues execution tokens only for approved scoped requests. API responses project approvals through `ApprovalDto`, frontend approval cards render canonical role/escalation/audit fields, and durable approval storage is extended by `011_canonical_approval_engine.sql`.

## Canonical AI Governance

`packages/shared/src/aiControlPlane.ts` owns the canonical AI recommendation envelope: structured evidence packages, calibrated confidence, risk level, approval requirement, audit/event/twin linkage, and the invariant `advisoryOnly: true`, `executionAllowed: false`, `blockedAutonomousExecution: true`. `apps/api/src/responsibleAiGovernor.ts` may record recommendations, reviews, drafts, evidence, and blocked execution attempts, but it never executes regulated or low-risk advisory outputs autonomously. API DTOs, Python agent stubs, frontend recommendation cards, and durable storage in `013_canonical_ai_governance.sql` project that same advisory-only contract.

## Canonical API Architecture

`packages/shared/src/apiContracts.ts` owns the API contract standard. Every endpoint in `apiEndpointContracts` declares its request/response DTO, roles, audits, emitted events, canonical `ApiResponse` envelope, metadata requirements, and pagination mode. HTTP responses from `apps/api/src/server.ts` use `{ ok, data|error, meta }`, where `meta` carries request identity, timestamp, tenant/racetrack/organization scope, role, and optional pagination; errors use the shared `ApiError` shape with `code`, `message`, `details`, `path`, `requestId`, and `timestamp`. List endpoints use offset pagination metadata unless a route explicitly declares a non-list response. Duplicate endpoint aliases are not part of the API surface; KPIs live under `/api/v1/kpis`, and Racing Data drafts/read models use the canonical `/api/v1/racing-data/...` paths in the shared manifest.

## Canonical RBAC Architecture

`packages/shared/src/accessControl.ts` is the single permission registry for role names, permission names, permission groups, role grants, frontend route permissions, API endpoint permissions, workflow-template permissions, approval-action permissions, and audit-export permissions. Frontend route metadata imports `frontendRoutePermissionRegistry`, backend endpoint contracts derive `requiredPermission` with `permissionForApiEndpoint`, and the API dispatcher enforces `apiEndpointContracts` role and permission requirements when request role headers are present. Local services may keep domain-specific actor context, but permission names must be shared `Permission` values rather than private strings.

## Frontend Architecture

`apps/frontend` is the active canonical shell after removing the old dashboard and temporary shell. It is an AI Stack-first command surface with route-scoped artifacts, approval-safe read-only action rails, backend-declared dependencies, explicit mock/stub labeling, and tenant/racetrack context propagation. Theme variables use a single TrackMind token namespace for color, typography, spacing, radius, elevation, density, layout, status, risk, and audit/KPI signals.

Route metadata lives in one registry in `apps/frontend/src/routes/routes.ts`. Every routed workspace carries one canonical route, readiness status, role visibility, mock/live posture, approval boundaries, backend paths, and audit references through that registry.

Collaboration is route-scoped, artifact-attached, and draft-only. `packages/shared/src/collaborationContracts.ts` owns the canonical object and event contracts. Future browser collaboration controls must not mutate operational state; posts remain `collaborationOnly`, `draftOnlyPosts`, and `mutatesOperationalState: false` unless a backend approval workflow later issues an explicit authorization path.
