# TrackMind Nexus Implementation Plan

## Purpose

This plan turns the TrackMind Nexus build intent into incremental repository work. It does not mark any future service as production-ready; it identifies the next safe steps for evolving the current monorepo without deleting existing functionality or bypassing human governance.

## Current code-space alignment

The repository already contains platform foundations for API domain modules, the canonical `apps/frontend` shell, expert-agent stubs, shared governance types, database seeds/migrations, Azure Bicep, compliance docs, service templates, workflows, tests, and placeholder bounded-context folders. The immediate code-space goal is therefore to harden discoverability, exports, and contributor alignment rather than introduce a large greenfield rewrite.

## Workstream 1: Documentation and contributor guidance

- Keep `docs/TRACKMIND_BUILD_INTENT.md` as the canonical product and safety intent.
- Use this implementation plan as the execution checklist for future PRs.
- Keep README and architecture docs linked to both intent and implementation guidance.
- Add service-specific README files before adding runtime code to a bounded context.

## Workstream 2: API package stability

- Maintain a single API package entry point that exports existing platform modules in a predictable way.
- Resolve export-name collisions explicitly instead of hiding modules from consumers.
- Add regression coverage for public exports when the API package is split into production services.
- Avoid runtime behavior changes when making packaging or documentation updates.

## Workstream 3: Bounded-context service scaffolding

Future services should start from `templates/service-template` and include:

- OpenAPI contract and service catalog metadata.
- Tenant-scoped domain model and event schemas.
- Command handlers that emit audit events.
- Health, readiness, liveness, metrics, and trace endpoints.
- Unit, contract, integration, security, and safety-boundary tests.

Initial bounded contexts should remain aligned with the existing placeholders:

- `services/events` for event backbone, schema registry, delivery guarantees, and replay.
- `services/race-operations` for race cards, race-day commands, protected actions, and official workflow state.
- `services/safety` for equine safety, track safety signals, veterinary review routing, and emergency escalation.
- `services/stewarding` for inquiries, objections, evidence packages, rule citations, and decision support.
- `services/tenant` for racetrack tenancy, identity boundaries, configuration, and provisioning.

## Workstream 4: Digital Twin and asset registry

- Promote the Racetrack Asset/Control Registry into the authoritative registry for assets, control points, ownership, risk, compliance mappings, and twin references.
- Formalize Digital Twin ontology assets under `digital-twin/ontology` before building production twin connectors.
- Ensure every twin update includes tenant/racetrack context, provenance, timestamp, source, and audit linkage.
- Keep Digital Twin state advisory for protected decisions unless a workflow and human approval record authorize action.

## Workstream 5: Event, audit, rules, and workflows

- Define versioned event schema conventions and contract tests for `domain.entity.action.vN` events.
- Promote immutable audit ledger behavior into persistent storage with retention, legal hold, and evidence custody.
- Connect workflow orchestration to approvals, escalations, audit entries, and Digital Twin references.
- Keep rules versioned, citation-backed, testable, explainable, and tied to human-approval outcomes.

## Workstream 6: Responsible AI and MoE governance

- Treat expert outputs as recommendations with evidence, confidence, policy decisions, and escalation paths.
- Add model cards, prompt cards, evaluation artifacts, and policy gates before any production AI integration.
- Route safety-critical or regulated recommendations through approval workflows.
- Preserve full lineage from input context to model output to final human decision.

## Workstream 7: Azure-first production hardening

- Expand Bicep/Terraform baselines for identity, networking, Key Vault, Event Hubs, Service Bus, Event Grid, storage, observability, and policy.
- Add environment overlays for development, staging, and production racetrack tenants.
- Require managed identities, private endpoints where appropriate, tenant isolation, and centralized monitoring.
- Add CI/CD gates for build, test, contract checks, dependency checks, IaC validation, and security scanning.

## Near-term checklist

1. Keep root docs linked to build intent and implementation plan.
2. Ensure API package exports all existing modules needed by tests and consumers.
3. Add README scaffolds to service placeholders before implementing runtime service code.
4. Add event schema and approval-flow contract tests.
5. Convert in-memory reference classes to persistent implementations only in focused PRs with migration and rollback plans.
