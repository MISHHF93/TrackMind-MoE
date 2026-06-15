# TrackMind Universal Artifact Framework

TrackMind Universal Artifact Framework defines the canonical path for governed racetrack data, AI evidence, recommendations, approvals, and audits. It is an architecture and metadata contract for TrackMind Nexus. It does not claim that production lakehouse storage, feature-store infrastructure, model-training pipelines, Azure Digital Twins, cross-tenant federation, or external certification are complete unless a deployment separately proves them.

## Canonical Artifact Flow

`INPUTS -> EVENTS -> ARTIFACTS -> DIGITAL TWINS -> FEATURE STORE -> AI MODELS -> RECOMMENDATIONS -> APPROVALS -> OUTPUTS -> AUDITS`

1. **Inputs** are tenant-scoped operational, telemetry, manual, API, workflow, audit, compliance, and Digital Twin context.
2. **Events** normalize changes through `context.entity.verb.vN` envelopes with tenant, racetrack, actor, correlation, subject, evidence, audit, approval, and Digital Twin references.
3. **Artifacts** are versioned, owned, tenant-scoped records that preserve evidence, lineage, lifecycle, access, and compliance metadata.
4. **Digital Twins** represent operational graph state for assets, horses, people, workflows, approvals, incidents, and AI agents, but they are not legal source-of-truth records for protected decisions.
5. **Feature Store** records deterministic feature metadata, scores, input quality, freshness, evidence, and lineage. Current feature records are placeholder/facade records, not proof of a deployed feature database.
6. **AI Models** are registered advisory modules with model cards, intended/prohibited use, prompt versions, evaluations, risk assessments, rollback evidence, and governance anchors.
7. **Recommendations** are advisory outputs with evidence, confidence, affected assets, Digital Twin refs, event refs, audit refs, risk, and approval requirements.
8. **Approvals** turn draft or recommendation artifacts into authorized workflow artifacts only when a qualified human approver records evidence and reason.
9. **Outputs** are draft actions, dashboard views, evidence packages, export packages, or approval-authorized downstream commands. Protected execution remains backend-governed.
10. **Audits** seal the path with append-only event and audit records, hash-chain metadata where available, evidence custody, and replayable lineage.

## Artifact Types

The framework treats the following as canonical artifact families:

- **TUS entity artifacts**: racetrack, meet, race-day, race, horse, jockey, trainer, owner, veterinarian, steward, employee, asset, incident, inspection, workflow, approval, audit-event, audit-record, digital-twin, ai-recommendation, and compliance-control records.
- **TUS standardization artifacts**: `TUSAssetStandardDto`, `TUSTwinStandardDto`, and `TUSStandardizationWorkspaceDto` projections for asset/twin health, risk, telemetry, approvals, audits, relationships, context, and source metadata.
- **Event artifacts**: Nexus event contracts and envelopes such as `ai.input.ingested.v1`, `ai.feature-set.built.v1`, `ai.model.selected.v1`, `ai.recommendation.created.v1`, `approval.request.transitioned.v1`, `audit.record.appended.v1`, `surface.measurement.recorded.v1`, `asset.registry.changed.v1`, and `compliance.evidence.collected.v1`.
- **Evidence artifacts**: reusable evidence packages, source-object/workflow/control references, audit refs, event refs, Digital Twin refs, AI recommendation refs, framework mappings, owner, review cadence, HISA-aligned operational oversight categories, and accreditation-readiness metadata.
- **Feature artifacts**: feature records for surface, gate, race, horse, security, weather, and operations domains with feature vectors, scores, quality scores, stale-input thresholds, evidence, tenant/racetrack scope, and correlation IDs.
- **Model and prompt artifacts**: expert model registry records, AI agent records, prompt template versions, model evaluations, risk assessments, explainability notes, intended use, prohibited use, and rollback/runbook evidence.
- **Recommendation artifacts**: advisory risk assessments, readiness checks, forecasts, classifications, summaries, simulations, evidence assistance, and draft-action packages.
- **Workflow and approval artifacts**: workflow instances, approval requirements, approval decisions, execution-authorization tokens, expiration/escalation state, approver roles, reasons, evidence, and protected-action mappings.
- **Output artifacts**: frontend route cards, command-center summaries, draft work orders, compliance packages, audit exports, API responses, and approved downstream command requests.
- **Audit artifacts**: audit events, audit records, verification exports, previous-hash/current-hash fields where available, actor/action/target records, correlation IDs, decisions, and evidence paths.
- **Racing Data API Hub artifacts**: provider configs, provider statuses, raw provider payloads, ingestion jobs, provider-agnostic connector descriptors, normalization mappings, canonical racing data envelopes, license snapshots, quality decisions, and entity-resolution evidence. The provider-agnostic licensed ingestion architecture is documented in [TrackMind Racing Data API Hub](racing-data-api-hub.md).

## Registry Metadata

Every governed artifact should carry enough metadata to be independently interpreted, filtered, and audited:

- Stable `id`, `globalId`, `schemaVersion`, lifecycle/status, version, created/updated timestamps, tenant ID, racetrack ID, source system, and external IDs.
- Ownership metadata: owner ID, owner type, custodian, jurisdiction, data classification, access expectations, retention policy, legal hold posture, and review cadence.
- Lineage metadata: event refs, audit refs, evidence refs, compliance refs, Digital Twin refs, feature record refs, recommendation refs, model/prompt/version refs, correlation ID, causation ID, and upstream/downstream store refs.
- Governance metadata: intended use, prohibited use, risk level, protected actions, required approver roles, approval state, safety-control decisions, policy IDs, framework mappings, and no-overclaim caveats.
- Runtime posture: `mock`, `placeholder`, `readiness-metadata`, `partial`, `implemented`, or facade-only metadata when the repository exposes contracts without a production backing dependency.

## AI Training Input Policy

TrackMind AI training and model improvement must be evidence-governed and tenant-controlled:

- Only use inputs that have tenant/racetrack scope, source-system provenance, lawful basis or operational authority, data classification, evidence refs, event/audit lineage, and retention posture.
- Treat veterinary, workforce, security, identity, payment, and local-commission data as restricted or regulated. Minimize fields, preserve role-based access, and avoid using raw sensitive notes when derived, reviewed, or de-identified features are sufficient.
- Do not use cross-tenant raw data for training, benchmarking, or model evaluation. Federation and Racing Intelligence Network concepts require anonymized, aggregate-only, permission-governed records with cohort thresholds and explicit data-sharing policy.
- Exclude stale, incomplete, low-quality, outlier-heavy, or missing-evidence inputs unless a human-reviewed data-quality exception is recorded.
- Preserve feature, dataset, prompt, model, evaluation, and recommendation lineage so an approved model output can be traced back to source events, evidence, and feature records.
- Keep protected-action labels intact during training and evaluation. Training data must not teach or test autonomous execution for race starts/stops, official results, scratches, vet clearances, steward rulings, payouts, emergency overrides, or safety-critical controls.
- The current repository documents deterministic placeholder experts, feature metadata, model registry records, and governance controls. It does not claim real production model training, external certification of models, or deployed ML infrastructure.

## Output Classes

Artifact outputs are classified by authority and risk:

- **Read-only insight**: dashboards, readiness summaries, health cards, observability, compliance posture, executive briefings, and evidence views.
- **Advisory AI output**: recommendations, forecasts, anomaly prioritization, classifications, simulations, summaries, confidence adjustments, and explanation records.
- **Draft operational package**: draft work orders, gate-move plans, race readiness packages, surface review packages, steward evidence bundles, veterinary review packages, and compliance filing drafts.
- **Approval-required output**: any output that proposes a protected action, regulated state change, sensitive disclosure, Digital Twin state patch, compliance filing, or operational execution.
- **Approved downstream command**: an execution request that includes a matching non-expired approval reference, approver role, reason, evidence, event record, audit record, tenant/racetrack scope, and idempotency key.
- **Audit and compliance output**: audit exports, evidence packages, framework mappings, verification records, incident timelines, management review artifacts, and accreditation-readiness packages.

## Storage Architecture

TrackMind maps artifacts to canonical store descriptors:

- **Data Lake** for regulated archive metadata across operational, AI, event, audit, and twin records.
- **Feature Store** for deterministic feature records, scores, input quality, and AI feature lineage.
- **Knowledge Graph** for domain relations among TUS entities, policies, evidence, models, and regulated context.
- **Digital Twin Graph** for twin nodes, relationships, state update history, and approval-aware synchronization metadata.
- **Event Store** for replayable event backbone metadata, registered schemas, dead letters, event streams, and event lineage.
- **Audit Store** for immutable audit ledger metadata, hash-chain records, evidence paths, and forensic exports.

The current Tier 9 unified data model exposes these as read-only descriptors with `runtimeFacade.facadeOnly: true` and `backingDependency: "none"`. API paths such as `/api/v1/tus/data-model`, `/api/v1/events/catalog`, `/api/v1/events/stream`, `/api/v1/ai-control-plane/workspace`, `/api/v1/digital-twin/state`, and `/api/v1/audit/events` are integration surfaces, not proof that a production lakehouse, graph database, feature database, or Azure service is provisioned.

## Versioning, Lineage, And Tenant Ownership

- Artifact IDs must be stable and tenant-scoped. TUS global IDs follow `tus:<tenantId>:<racetrackId>:<kind>:<id>`, and twin IDs follow `twin:<context>:<entity-id>`.
- Versioned schemas must use explicit versions such as `trackmind.tus.v1`, `trackmind.tus.asset.v1`, `trackmind.tus.twin.v1`, `trackmind.feature-store.v1`, `trackmind.ai-control-plane.v1`, and event names ending in `.vN`.
- Regulated records are append-only or explicitly versioned. Updates that alter official, safety, compliance, or approval state require a new event and audit record.
- Lineage must cross-reference source inputs, events, audit records, evidence, Digital Twin refs, feature records, model versions, recommendation IDs, approval IDs, and output records.
- Tenant ownership travels with the artifact through features, model recommendations, approvals, audits, dashboards, API responses, exports, and retention decisions.
- Cross-track outputs must be aggregate, anonymized, permission-governed, and explicitly prevented from exposing raw cross-tenant records unless a future approved architecture changes that rule.

## Safety Constraints

AI may recommend, summarize, classify, prioritize, forecast, simulate, and create draft actions. AI must not autonomously start or stop races, declare or modify official results, scratch horses, make medication decisions, clear veterinary flags, issue steward rulings, trigger payouts, override emergency personnel, move gates, control actuators, close or reopen tracks, approve compliance filings, or execute safety-critical controls.

Protected artifacts must remain locked until a matching authorized human approval exists for the same tenant, target, recommendation, protected action, and workflow. Digital Twin patches, operational outputs, compliance filings, and dashboard commands must preserve the distinction between advisory state and approved execution.

## Integration Points

- **Digital Twins** consume asset, telemetry, workflow, approval, incident, and AI impact artifacts. Twin state is operational context and synchronization metadata, not legal source of truth for official results, vet clearance, scratches, rulings, payouts, or emergency command.
- **Events** publish artifact transitions through the Nexus event backbone and carry correlation, causation, subject, evidence, audit refs, approval refs, and Digital Twin refs.
- **Audit** records every regulated artifact transition, AI safety denial, approval decision, event sink, and evidence export with actor, action, target, decision, evidence, correlation, and hash metadata where available.
- **Approvals** convert draft/recommendation artifacts into approved workflow state only after qualified human review, reason, role, evidence, expiration checks, and segregation-of-duties controls.
- **Compliance** reuses artifact evidence across ISO/IEC 42001, NIST AI RMF, ISO 27001, ISO 27701, ISO 31000, SOC 2, PCI DSS, HISA-aligned, ARCI-aligned, and local racing-rule mappings. These are readiness artifacts unless certification or regulatory acceptance is independently completed.
- **Frontend route workspaces** surface artifact state through role-aware views, degraded/empty/error states, command-center summaries, approval queues, AI governance, Digital Twin context, platform health, audit timelines, and compliance readiness. Frontend routes are decision-support surfaces, not autonomous authority.
- **API** exposes versioned REST and event-consumer contracts with tenant isolation, idempotency keys for commands, no hidden AI side effects, approval references for protected endpoints, and read-only metadata surfaces where the implementation is facade-only.

## Current Repository State

The repository currently contains shared contracts, deterministic placeholder feature builders, AI control-plane metadata, expert recommendation stubs, TUS entity and standardization DTOs, Racing Data API Hub DTOs, provider registry and connector runtime reference slices, unified data-model descriptors, event contracts, approval/audit services, frontend route workspaces in `apps/frontend`, and compliance readiness pages. It also contains no-overclaim language for external racing data providers, Azure Digital Twins, feature stores, model training, federation, SaaS provisioning, and certification.

This framework should guide future implementation work: new artifact-producing services must register their schema, lineage, tenant ownership, safety constraints, storage mapping, event/audit behavior, approval posture, dashboard/API surface, and compliance evidence before they are treated as operationally authoritative.
