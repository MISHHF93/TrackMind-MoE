# TrackMind Nexus Implementation Sequence

## Phase 1 — Foundation slice (this change)
Acceptance criteria:
- Create `docs/architecture/TRACKMIND_NEXUS_DEFINITION.md` and this file.
- Modify `README.md` to link the architecture definition and implementation sequence.
- Modify `packages/shared/src/index.ts` and create focused shared modules only under `packages/shared/src/`.
- Add shared types for racetracks, races, horses, jockeys, stewards, veterinarians, track sectors, starting gates, sensors, workflows, approvals, AI recommendations, audit events, and Digital Twin references.
- Add validation helpers for protected AI actions and approval requirements.
- Add tests under `packages/shared/tests/` proving AI can draft/recommend but cannot execute protected actions without explicit approval.
Expected events: `ai.recommendation.created.v1`, `approval.protectedAction.approved.v1`, `audit.event.recorded.v1`.
Expected APIs: none beyond exported shared package functions.
Expected schemas: TypeScript type guards and validation result objects.
Documentation updates: README and architecture package.

## Phase 2 — Asset registry skeleton
Files/folders: create `services/assets/README.md`, `apps/api/src/assetRegistry.ts`, `apps/api/tests/asset-registry.test.mjs`, docs updates.
Events: `asset.trackSector.registered.v1`, `asset.control.registered.v1`.
APIs: `GET /assets`, `POST /assets`, `GET /controls` with no live actuation.
Schemas: asset, control, sensor, track sector.
Tests: register asset, reject safety-critical actuation without approval.

## Phase 3 — Event model skeleton
Files/folders: create `packages/shared/src/events.ts`, `services/events/schemas/`, contract tests.
Events: all foundation event envelopes.
APIs: publish/subscribe interfaces only.
Schemas: event envelope JSON schemas.
Tests: naming, versioning, tenant and correlation requirements.

## Phase 4 — Audit ledger skeleton
Files/folders: extend `apps/api/src/auditLog.ts`, add ledger tests and docs.
Events: `audit.event.recorded.v1`, `audit.ledger.hashVerified.v1`.
APIs: append audit event, verify chain.
Schemas: audit event and evidence reference.
Tests: append-only behavior and tamper detection.

## Phase 5 — Digital Twin skeleton
Files/folders: extend `apps/api/src/digitalTwinFoundation.ts`, `digital-twin/ontology/README.md`, tests.
Events: `twin.reference.created.v1`, `twin.relationship.linked.v1`.
APIs: create/read twin references.
Schemas: twin reference and relationship.
Tests: official records remain source of truth.

## Phase 6 — Workflow and approval enforcement
Files/folders: extend `apps/api/src/workflowEngine.ts`, `apps/api/src/approvals.ts`, tests.
Events: `workflow.instance.created.v1`, `approval.protectedAction.requested.v1`, `approval.protectedAction.approved.v1`.
APIs: create workflow, request approval, approve/reject.
Schemas: workflow state and approval policy.
Tests: expired/mismatched approvals fail.

## Phase 7 — AI governance integration
Files/folders: extend `apps/api/src/responsibleAiGovernor.ts`, `ai/README.md`, tests.
Events: `ai.recommendation.created.v1`, `ai.protectedAction.denied.v1`.
APIs: create recommendation, evaluate automation request.
Schemas: recommendation, safety decision.
Tests: all protected actions require authorized human approval.

## Vertical slice backlog

After the foundation phases are stable, use the vertical slice execution prompts in `VERTICAL_SLICE_EXECUTION_PROMPTS.md` to implement Race Office, Surface Intelligence, Equine Intelligence, Barn Operations, Steward Center, Security Operations, Emergency Operations, Compliance Control Library, Responsible AI Governance, and Platform Observability as coordinated frontend-backend increments.

## Phase 8 — Service extraction and deployment hardening
Files/folders: service folders, OpenAPI specs, CI, Azure modules, observability dashboards.
Events/APIs/Schemas: promoted from prior phases with compatibility guarantees.
Tests: contract, integration, security, performance, and disaster recovery.
Documentation: operational runbooks and compliance evidence map.
