# TrackMind Nexus Build Intent

## Existing repository architecture observed before this change

This repository is not a greenfield project. It already contains a TrackMind-MoE / TrackMind Nexus monorepo with TypeScript API domain modules, a backend-driven React frontend shell, Python expert-agent stubs, shared RBAC and governance types, PostgreSQL migrations and seed data, Azure infrastructure baselines, compliance documentation, service templates, workflow guidance, and cross-cutting tests. Existing architectural decisions already establish an Azure-first, event-driven, Digital Twin platform with CQRS/event-sourcing direction, tenant isolation, immutable audit logging, and mandatory human approval for regulated or safety-critical AI recommendations.

The current implementation includes in-memory and stubbed foundations for approvals, audit logging, a race-day event bus, Digital Twin zone/state modeling, Responsible AI governance, workflow orchestration, rules/policy evaluation, horse safety, stewarding, emergency operations, racetrack asset/control registry concepts, enterprise operating/domain models, and identity governance. These are platform foundations and reference implementations, not a complete production deployment.

## Product vision

TrackMind Nexus is an Azure-first, safety-critical, human-governed Thoroughbred racetrack intelligence platform. It helps racetracks, regulators, veterinarians, stewards, security teams, operations teams, executives, and approved partners operate from a shared, auditable, real-time understanding of racetrack conditions, assets, horses, people, incidents, compliance obligations, and official workflows.

The platform must connect Digital Twins, event-driven services, Mixture-of-Experts AI, workflow orchestration, rules engines, immutable audit trails, and compliance-by-design controls without allowing automation to bypass accountable human decision-makers. AI is used to inform, triage, explain, forecast, and recommend; protected racing, safety, veterinary, emergency, financial, and disciplinary outcomes remain human-governed.

## Core domains

TrackMind Nexus is organized around bounded domains that can mature into independently deployable services:

- **Race operations:** entries, scratches, starts, stops, post times, official results, race-day status, command-center coordination, and operational readiness.
- **Stewarding and racing integrity:** inquiries, objections, incident review, evidence packages, wagering-integrity signals, rulebook citations, and official decision support.
- **Equine safety and veterinary governance:** horse identity, eligibility, biometric and observation signals, veterinary review workflows, medication and safety flags, welfare case history, and retirement/lifecycle status.
- **Track surface and environment:** weather, track condition, cushion depth, moisture, maintenance activities, inspections, forecasts, and risk indicators.
- **Racetrack assets and controls:** gates, rails, cameras, sensors, lighting, irrigation, communications, access-controlled zones, emergency equipment, and control points.
- **Security and emergency operations:** access control, restricted-zone events, incident response, emergency dispatch coordination, evidence custody, and escalation workflows.
- **Ticketing, fan experience, and finance:** attendance, ticketing events, customer experience signals, revenue telemetry, settlement controls, and protected payout governance.
- **Compliance and audit:** HISA, ARCI, ISO, SOC 2, PCI, responsible AI, security, privacy, retention, evidence vault, audit reports, and control attestations.
- **Tenant and platform operations:** multi-racetrack tenancy, identity, RBAC/ABAC, service catalogs, observability, data platform, integration management, and release governance.

## Safety boundaries

TrackMind Nexus must preserve the following safety boundaries:

1. AI recommendations are advisory unless and until an authorized human approval is recorded.
2. The platform must not directly automate race starts, race stops, official results, horse scratches, medication decisions, veterinary clearance, emergency actions, payouts, or disciplinary decisions.
3. Safety-critical workflows require role-based authorization, separation of duties where appropriate, evidence capture, explicit rationale, and immutable audit logging.
4. External system side effects must be idempotent, tenant-scoped, auditable, and traceable to a command, workflow, or approved decision.
5. Low-confidence, conflicting, incomplete, stale, or policy-blocked AI output must escalate to human review rather than silently continue.
6. Digital Twin and sensor data must be treated as operational intelligence, not as sole authority for protected decisions.

## Human-approval requirements

Protected actions require workflow-mediated human approvals. Each approval record should capture:

- tenant, racetrack, workflow, recommendation, and correlation identifiers;
- requested action and downstream system impact;
- approver identity, role, timestamp, and authority basis;
- evidence reviewed, rule citations, model output, and confidence;
- rationale, conditions, expiration, overrides, and dissent if applicable;
- audit hash/linkage for non-repudiation and later investigation.

Approvals should support escalation paths, dual-control for privileged actions, emergency break-glass handling, and post-event review. Approval workflows must be observable and should expose pending, overdue, rejected, expired, overridden, and completed states.

## Racetrack asset/control registry

The Racetrack Asset/Control Registry is the authoritative inventory of operationally relevant physical and logical racetrack assets. It should represent:

- facilities, tracks, barns, paddocks, gates, rails, tote rooms, camera coverage areas, access zones, and emergency areas;
- sensors, cameras, networking devices, lighting, irrigation, generators, radios, and safety equipment;
- control points such as gate controls, access-control doors, alarm panels, track-condition declaration processes, and emergency procedures;
- ownership, criticality, maintenance status, calibration status, inspection status, dependencies, and Digital Twin identifiers;
- safety classification, regulatory relevance, tenant scope, and audit/evidence requirements.

Registry entries should be synchronized with Digital Twin entities and emit events when assets are added, modified, decommissioned, inspected, faulted, or placed under operational restriction.

## Digital Twin model

The Digital Twin model represents each racetrack as a live graph of entities, relationships, telemetry, and state transitions. Core twin entity types include:

- racetrack, racing surfaces, chutes, rail positions, barns, paddock, winner's circle, restricted zones, public zones, emergency zones, and service areas;
- horses, jockeys, trainers, veterinarians, stewards, employees, vendors, emergency partners, and credentialed visitors;
- sensors, cameras, gates, vehicles, equipment, work orders, incidents, race cards, races, and workflows;
- compliance evidence, audit records, model recommendations, approvals, and operational declarations.

Digital Twin updates should flow through governed APIs and event routes. Twin state must include provenance, timestamp, source, tenant, confidence where relevant, and rollback/reconciliation behavior. Twin data can inform AI and dashboards but must not replace human authority in protected decision domains.

## Event bus

TrackMind Nexus is event-driven. Domain services publish versioned, tenant-scoped events for commands, facts, state transitions, approvals, model outputs, audit entries, and integrations. Event naming should follow a consistent pattern such as `domain.entity.action.vN`.

The event bus should support:

- append-only event capture for replay and investigation;
- command/work queues for workflow and integration processing;
- integration events for external systems;
- dead-letter handling, retries, idempotency keys, correlation IDs, causation IDs, and trace context;
- schema validation, versioning, compatibility checks, and tenant isolation;
- CQRS read-model updates, Digital Twin synchronization, AI feature generation, and compliance evidence collection.

Azure-first implementations should favor Azure Event Hubs, Service Bus, Event Grid, managed identities, private networking, and centralized observability.

## Audit ledger

The audit ledger is a hash-linked, immutable record of important user, workflow, system, data, AI, approval, configuration, security, and regulatory events. It must support non-repudiation, evidence custody, legal hold, retention policy, forensic timeline reconstruction, and compliance reporting.

Every protected decision should be reconstructable from audit data: who acted, what was observed, which rules and model outputs were considered, which approvals were granted, which systems were affected, and what evidence was preserved.

## Workflow engine

Workflow orchestration coordinates human-governed automation. Workflows should model race-day procedures, AI recommendation reviews, steward inquiries, veterinary checks, scratches, emergency response, maintenance dispatch, surface inspections, access exceptions, incident investigations, and compliance reviews.

Each workflow definition should declare owners, roles, SLAs, escalation policies, approval requirements, exception paths, compensating actions, audit events, Digital Twin references, tenant boundary, and evidence artifacts. Workflow execution should be resilient, observable, and replayable enough for post-incident investigation.

## Rules engine

Rules and policy evaluation should provide deterministic guardrails for regulated and operational decisions. Rules should cover role/permission checks, racing procedures, safety thresholds, veterinary review requirements, compliance controls, tenant boundaries, model confidence thresholds, evidence requirements, and escalation criteria.

Rules must be versioned, testable, explainable, auditable, and tied to authoritative sources such as HISA, ARCI, local commission rules, track SOPs, emergency plans, and internal policies. Rule outcomes should identify matched rules, missing evidence, effective dates, citations, and required human approvals.

## Responsible AI governance

TrackMind Nexus uses a Mixture-of-Experts AI architecture under responsible AI governance. Expert agents may support race operations, stewarding, equine safety, veterinary compliance, track surface, weather/environment, wagering integrity, ticketing/fan experience, security, facilities/IoT, maintenance, finance, legal/regulatory, executive decision support, and Responsible AI oversight.

Responsible AI requirements include:

- model cards, prompt cards, evaluation records, risk classifications, and approved use cases;
- evidence citations, confidence scores, uncertainty handling, and explanation summaries;
- model/version lineage, dataset lineage, feature provenance, and monitoring;
- bias, safety, reliability, privacy, security, drift, and hallucination controls;
- policy gates that block or escalate unsafe recommendations;
- human-in-the-loop approval before protected actions;
- complete auditability from input context to recommendation to final human decision.

## Multi-racetrack scalability

The platform must scale across multiple racetracks while preserving local autonomy and central visibility. Every service, event, twin, dataset, secret, identity decision, workflow, audit record, and telemetry item must carry tenant/racetrack context. Cross-track analytics should use governed aggregation, not direct cross-tenant data leakage.

Azure landing-zone design should support isolated environments, private networking, per-tenant keys where required, central monitoring, disaster recovery, regional resilience, and repeatable infrastructure-as-code deployment.

## Phased implementation roadmap

### Phase 0: Current foundation hardening

- Keep existing modules working while documenting intent and boundaries.
- Ensure README, architecture, onboarding, and service-template guidance point to the build intent.
- Add contract tests for event schemas, approval flows, audit verification, and protected-action enforcement.
- Identify which current in-memory implementations are reference stubs versus production candidates.

### Phase 1: Azure and tenancy foundation

- Establish Azure landing-zone modules, managed identity, Key Vault, networking, observability, policy baselines, and environment overlays.
- Define tenant/racetrack identifiers and isolation requirements across APIs, events, Digital Twins, storage, secrets, and telemetry.
- Publish service catalog standards and baseline CI/CD checks.

### Phase 2: Event, audit, and workflow backbone

- Implement production event backbone with schema registry, retries, dead-letter handling, idempotency, and trace propagation.
- Promote immutable audit ledger and evidence vault patterns.
- Implement durable workflow orchestration for AI review, race-day approvals, emergency response, and compliance evidence collection.

### Phase 3: Racetrack Digital Twin and asset registry

- Formalize DTDL ontology and registry schemas.
- Synchronize assets, sensors, cameras, zones, horses, incidents, workflows, and compliance records into Digital Twin routes.
- Build operations dashboards over authoritative read models and twin state.

### Phase 4: Safety-critical domain services

- Mature race operations, stewarding, equine safety, veterinary governance, surface intelligence, emergency operations, and regulatory operations as independently deployable services.
- Add contract tests, domain-event suites, workflow tests, and safety-boundary regression tests.
- Integrate HISA, ARCI, weather, camera, IoT, and wagering adapters behind explicit compliance controls.

### Phase 5: Governed MoE intelligence

- Build production MoE routing, expert evaluation harnesses, model registry, prompt registry, model cards, policy gates, and responsible AI dashboards.
- Connect AI outputs to approval workflows and audit lineage.
- Validate expert behavior with offline scenarios, red-team cases, synthetic race-day exercises, and live shadow mode before operational use.

### Phase 6: Multi-track scale and operational readiness

- Onboard multiple racetracks with automated provisioning, tenant isolation tests, backup/restore, disaster recovery, and operational runbooks.
- Establish central command-center views, cross-track analytics, compliance reporting, and incident response exercises.
- Continuously measure safety, reliability, latency, resilience, model quality, policy compliance, and audit completeness.

## Non-goals for the current repository state

- This document does not claim that production Azure services, complete microservices, full Digital Twin ontology, certified AI models, or operational integrations are already complete.
- Existing stubs and in-memory classes should be treated as design foundations and testable reference slices until production persistence, security, infrastructure, and operational controls are implemented.
- Future work must remain incremental and must not bypass existing safety and human-governance boundaries.
