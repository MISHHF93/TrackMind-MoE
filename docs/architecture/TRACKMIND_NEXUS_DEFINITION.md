# TrackMind Nexus Implementation Definition Package

## Product vision
TrackMind Nexus is an Azure-first, event-driven racetrack operating platform that coordinates race operations, equine safety, stewarding, veterinary compliance, track assets, sensors, workflows, Digital Twins, audit evidence, and Responsible AI. The platform must make race-day operations safer and more explainable without replacing authorized officials.

## Core safety rule
AI may recommend, simulate, summarize, classify, forecast, and create draft actions, but AI must never independently start a race, stop a race, declare official results, modify official results, scratch a horse, clear a veterinary flag, issue steward rulings, trigger payouts, override emergency personnel, or execute safety-critical controls without explicit authorized human approval.

## Domain map and bounded contexts
| Context | Purpose | Primary records | Human authority |
| --- | --- | --- | --- |
| Race Operations | Race-day schedule, entries, starts, stops, statuses, official result workflow | Racetrack, race day, race, race entry | Stewards and racing secretary |
| Equine Safety | Horse welfare observations, vet flags, scratches, eligibility recommendations | Horse, veterinary flag, safety observation | Veterinarians and stewards |
| Stewarding | Inquiries, objections, rule references, rulings, appeals package | Steward inquiry, ruling draft, official ruling | Steward panel |
| Track Asset Control Registry | Track sectors, gates, cameras, surface sensors, emergency controls | Asset, control, sensor, sector | Operations and emergency command |
| Digital Twin | Authoritative references joining physical assets, people, horses, and workflows | Twin reference, relationship, telemetry point | Platform owner with domain owners |
| Workflow and Approvals | Human approvals, segregation of duties, escalation and expiry | Workflow instance, approval record | Role-specific approvers |
| Audit Ledger | Immutable event evidence across regulated operations | Audit event, hash pointer, evidence URI | Compliance officer and auditors |
| Responsible AI Governance | Model lifecycle, AI recommendation boundaries, safety block decisions | AI recommendation, model record, safety decision | AI governance board and domain approvers |

## Service catalog
| Service | Folder today | Ownership | First-slice scope |
| --- | --- | --- | --- |
| Shared Domain Kernel | `packages/shared` | Platform architecture | Shared types, protected action policy, validation helpers |
| API Domain Modules | `apps/api/src` | TrackMind API | Existing services consume shared policy without rewrites |
| Asset Registry Service | future `services/assets` | Operations | Skeleton only; no live controls |
| Event Catalog Service | future `services/events` | Platform | Schema definitions and naming standard |
| Digital Twin Service | `apps/api/src/digitalTwin*`, future `services/digital-twin` | Platform | Twin reference types and skeleton state |
| Workflow Service | `apps/api/src/workflowEngine.ts`, future `services/workflows` | Platform | Approval requirement model |
| Responsible AI Service | `apps/api/src/responsibleAiGovernor.ts`, future `services/ai-governance` | Compliance/AI | Enforce no autonomous protected actions |

## Digital Twin catalog
Twin IDs use `twin:<context>:<entity-id>`. Required twin classes are racetrack, track sector, starting gate, sensor, horse, jockey, steward, veterinarian, race, workflow, and control. Twins reference source-system IDs and must not become the legal source of truth for official results, vet clearance, scratches, rulings, payouts, or emergency command.

## Racetrack asset and control registry
Assets are classified as `informational`, `operational`, or `safety-critical`. Safety-critical controls include start gate release, race stop signal, emergency sirens, evacuation controls, ambulance dispatch overrides, surface closure controls, and restricted-zone locks. The first implementation slice may define asset/control records but must not connect to live actuators.

## Event catalog
Events use `context.entity.verb.vN`, for example `race.race.startRequested.v1`, `equine.horse.vetFlagRaised.v1`, `ai.recommendation.created.v1`, `approval.protectedAction.approved.v1`, and `audit.event.recorded.v1`. Every event requires tenant ID, event ID, occurred-at timestamp, actor, correlation ID, subject reference, payload, and evidence references.

## Workflow catalog
Workflows begin as explicit state machines: draft, pending approval, approved, rejected, expired, executed, cancelled. Protected workflows require domain approver role, evidence, reason, correlation ID, and immutable audit event before any downstream execution.

## API standards
APIs are REST or event-consumer contracts with OpenAPI 3.1, stable IDs, tenant isolation, explicit idempotency keys for commands, and no hidden AI side effects. Protected command endpoints must accept an approval reference and verify it against the shared safety policy.

## Data model standards
Use stable string IDs or UUIDs, ISO-8601 timestamps, explicit tenant IDs, typed statuses, evidence arrays, and source references. Regulated records must be append-only or versioned; updates that alter official state require an audit event and approval record.

## Audit requirements
Audit entries must capture actor, actor type, action, target, timestamp, decision, evidence, correlation ID, previous hash where available, and source service. Audit stores are append-only. Safety denials by AI governance are auditable events, not silent validation failures.

## Approval rules
AI-generated actions start as recommendations or drafts. A protected action can execute only when a matching, non-expired, explicit human approval exists for the same recommendation ID, protected action, tenant, and target. Approvals require approver identity, role, reason, and evidence.

## AI safety boundaries
Permitted AI activities are recommendation, simulation, summarization, classification, forecasting, anomaly detection, and draft action preparation. Prohibited autonomous activities are race start, race stop, official result declaration or modification, horse scratch, veterinary flag clearance, steward ruling, payout trigger, emergency personnel override, and safety-critical control execution.

## Compliance mappings
| Requirement | Mapping |
| --- | --- |
| HISA/ARCI | Human authority for veterinary, stewarding, eligibility, and official results decisions |
| NIST AI RMF | Govern/map/measure/manage through model registry, risk assessment, monitoring, and human oversight |
| ISO 42001 | AI management system, intended/prohibited use, lifecycle approval, audit evidence |
| ISO 27001/SOC 2 | Access control, change control, audit logging, monitoring, incident response |
| PCI-DSS | Payout and payment workflows are protected actions with finance approval boundaries |

## Observability standards
Every service emits structured logs, metrics, traces, health/readiness endpoints, event lag, approval latency, safety-denial counts, audit-write failures, and protected-action execution attempts. Dashboards must separate advisory AI output from authorized human execution.

## Azure deployment assumptions
The target platform uses Azure API Management, Container Apps or AKS, Event Hubs or Service Bus, Event Grid, PostgreSQL, Cosmos DB where appropriate, Azure Digital Twins, Azure Monitor/Application Insights/Log Analytics, Key Vault, Managed Identity, Microsoft Entra ID, Azure AI Search, Azure OpenAI/AI Foundry, and Microsoft Sentinel.

## Phased implementation order
1. Foundation: docs, shared domain types, protected action policy, schemas, tests.
2. Asset registry skeleton: asset/control APIs with no actuator integration.
3. Event model: versioned schemas and contract tests.
4. Audit ledger: append-only ledger and hash-chain verification.
5. Digital Twin skeleton: references and relationships.
6. Workflow approvals: protected action workflows and authorization.
7. AI governance: recommendation lifecycle and safety-denial audit.
8. Service extraction: promote modules to independently deployable services.
