# TrackMind Nexus Repository Understanding and Foundational Execution Map

## Review scope

This report summarizes the repository as of 2026-06-13 after reviewing the monorepo layout, root documentation, architecture and implementation plans, compliance catalogues, Azure infrastructure baseline, database migrations and seeds, Digital Twin ontology notes, workflow notes, service placeholders, API domain modules, shared governance package, tests, and CI/CD pipeline definitions. The repository is not a greenfield system: it already contains executable TypeScript platform foundations, Python agent stubs, a dashboard, infrastructure templates, database definitions, compliance documentation, and service scaffolds.

## Current state

TrackMind-MoE already aligns strongly with the TrackMind Nexus target operating model. The root README establishes an Azure-first, event-driven, Digital Twin racetrack operating-system monorepo with mandatory human governance for safety-critical and regulated actions. The implementation plan prioritizes documentation continuity, API stability, bounded-context service scaffolding, Digital Twin and asset registry hardening, event/audit/rules/workflow foundations, Responsible AI governance, and Azure production hardening.

Executable API modules currently cover approvals, audit logging, Digital Twin foundations, emergency operations, enterprise API gateway concepts, enterprise architecture/domain/data-lakehouse/operating-model concepts, equine intelligence, event bus/schema registry/replay/dead-letter behavior, governance center, horse safety, IoT ingestion, Mixture-of-Experts routing, race operations, regulatory operations, Responsible AI governor, security operations, stewarding, telemetry, ticketing, track configuration, surface intelligence, twin graph, workflows, and the Racetrack Asset and Control Registry (RACR). Tests under `apps/api/tests` exercise these modules as in-memory reference implementations and guard the safety and governance boundaries.

The infrastructure baseline includes Azure Bicep, Azure documentation, Docker Compose for local services, baseline policy definitions, CI pipeline definitions, PostgreSQL migrations/seeds, and Neo4j schema notes. These files establish direction but are not yet a production deployment fabric for all bounded contexts.

## Target state

The target TrackMind Nexus platform is a multi-racetrack, tenant-isolated Thoroughbred racing intelligence platform where every physical, digital, biological, operational, regulatory, workflow, and AI asset has an authoritative registry record and, where applicable, a synchronized Digital Twin. Operational behavior is event-driven, auditable, observable, policy-governed, workflow-orchestrated, and human-supervised. AI systems produce evidence-backed recommendations and may not independently execute protected racing, veterinary, stewarding, emergency, payout, or disciplinary decisions.

## Gap analysis

| Area | Current state | Target gap |
| --- | --- | --- |
| RACR | In-memory authoritative asset registry with versions, audit trail, RBAC, events, telemetry, maintenance, approvals, soft delete, rollback, and templates. | Persistent storage, tenant-scoped read/write APIs, event schema contracts, Digital Twin synchronization jobs, import/export, and operational runbooks. |
| Digital Twin | In-memory foundation twins with relationships, state synchronization, risk/health scoring, playback, simulation, and audit trail. | Production Azure Digital Twins integration, formal ontology coverage, persistent history, and replay from event streams. |
| Event backbone | In-memory UniversalEventBus with schemas, publish, subscribe, replay, dead-lettering, trace metadata, and observability hooks. | Event Hub/Service Bus/Event Grid deployment, schema registry persistence, contracts, retention, replay governance, and cross-service delivery SLAs. |
| Workflows and approvals | Reference workflow and approval modules. | Durable orchestration, escalation policies, SLO tracking, human task inboxes, and regulatory evidence packages. |
| Rules/policy | Reference policy engine and compliance docs. | Versioned policy-as-code store, simulation tests, approval-chain binding, and regulator-facing evidence workflows. |
| Responsible AI/MoE | Responsible AI governor and MoE reference modules with safety boundaries. | Model/prompt cards, evaluation artifacts, lineage persistence, runtime policy gates, and monitored expert services. |
| Observability | Events and modules expose telemetry concepts. | Standard OpenTelemetry instrumentation, dashboards, SLOs, alerts, model monitoring, infrastructure metrics, and audit correlation. |
| Azure/IaC | Baseline Bicep and policy docs. | Environment overlays, managed identities, private networking, DR, centralized logs, secrets, eventing, data stores, and CI/CD gates. |

## Feature mapping before coding: RACR event-schema governance hardening

| Requirement | Mapping |
| --- | --- |
| Domain | Asset Management, Digital Twin Management, Event Management, Compliance and Accreditation, Responsible AI Governance, Multi-Racetrack Federation. |
| Digital Twin model | Every RACR asset includes `digitalTwin.twinId`, `modelRef`, `stateTopic`, optional `commandTopic`, simulation profile, shadow state, and relationships. |
| Event model | Registry mutations emit canonical versioned asset events such as `racr.asset.created.v1` and `racr.asset.updated.v1` with schema refs, tenant context, aggregate id, correlation id, lineage, compliance classification, and observability metadata. |
| Workflow model | Approval requirements and lifecycle controls remain part of every asset snapshot so workflow engines can route activation, retirement, maintenance, and critical state changes. |
| Approval requirements | Critical assets require approval requirements at validation time; controls define min approvals and role requirements. |
| Audit requirements | Every accepted command appends an immutable audit entry with actor, action, version, timestamp, changes, and reason. |
| Compliance controls | Baseline mappings include TrackPolicy, and schema metadata maps registry events to RACR authoritative inventory obligations. |
| Observability requirements | Event bus signals emit schema registration, event publication, handler delivery/failure, replay, and dead-letter notifications with trace and correlation identifiers. |

## Architecture decisions

1. Preserve the existing monorepo and in-memory reference implementations as the starting point rather than replacing them with a greenfield design.
2. Keep AI authority advisory by default and enforce protected-action handoffs through approvals, policy, audit, and workflow records.
3. Make RACR the authoritative inventory boundary for assets and controls, with events as the synchronization mechanism for Digital Twin, CQRS, compliance, and command-center projections.
4. Treat event schemas as governance artifacts: discoverable, versioned, owned, compliance-classified, and traceable.
5. Evolve persistence and Azure integrations in focused increments with migrations, rollback plans, and contract tests.

## Recommended implementation order

1. Harden RACR event schemas and governance catalog entries for registry-created and registry-updated events.
2. Add tenant-scoped API/service adapters around RACR commands without weakening current RBAC.
3. Connect RACR events to Digital Twin synchronization projections and add replay tests.
4. Promote the audit ledger to persistent append-only storage with retention/legal-hold metadata.
5. Add durable workflow orchestration for asset activation, critical maintenance, emergency readiness, and AI recommendation review.
6. Expand Azure IaC for eventing, identity, observability, storage, and tenant isolation.
7. Add model cards, prompt cards, evaluation records, and runtime gates for each MoE expert.

## Immediate next steps

The immediate foundational code change is to keep first-class RACR event schemas inside the authoritative registry, emit stable canonical `racr.asset.*.v1` event names, include aggregate/tenant metadata, and expose a governance catalog for downstream consumers. This strengthens event discoverability, auditability, replayability, observability, and Digital Twin synchronization without removing existing functionality.
