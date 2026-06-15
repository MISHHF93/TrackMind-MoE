# TrackMind-MoE

TrackMind-MoE is a racetrack AI operating-system monorepo. It coordinates race-day operations, safety, compliance, facilities, fan experience, security, and finance through a Mixture-of-Experts (MoE) agent router with mandatory Responsible AI governance.

The system treats a racetrack as a live digital twin: horses, people, restricted zones, sensors, cameras, tickets, incidents, and official racing workflows are connected through auditable events. AI recommendations are advisory by default and require human approval before downstream actions in safety-critical or regulated domains.

## Monorepo layout

- `apps/api` — TypeScript Node.js API domain services, RBAC, event bus, approvals, audit, IoT, safety, stewarding, ticketing, and security modules.
- `apps/dashboard` — React race-day command dashboard.
- `apps/agents` — FastAPI-compatible Python service stubs for expert agents and rulebook RAG.
- `packages/shared` — shared TypeScript types and policy constants.
- `db` — PostgreSQL migrations and seed data.
- `infra/azure` — Azure Bicep deployment baseline.
- `docs` — architecture and compliance mappings.

## TrackMind Nexus enterprise expansion

This repository is structured as the TrackMind Nexus enterprise monorepo: an Azure-first, API-first, event-driven Digital Twin platform for multi-racetrack Thoroughbred operations. The current build intent is documented in `docs/TRACKMIND_BUILD_INTENT.md`, the implementation plan is documented in `docs/TRACKMIND_IMPLEMENTATION_PLAN.md`, and the executable architecture package is documented in `docs/architecture/TRACKMIND_NEXUS_DEFINITION.md` with sequencing in `docs/architecture/IMPLEMENTATION_SEQUENCE.md`; new modules should inherit that intent and plan plus the standards in `docs/architecture/enterprise-blueprint.md`, `docs/engineering/coding-standards.md`, `docs/engineering/branching-strategy.md`, `docs/security/security-baseline.md`, and `templates/service-template`.

The Racing Operating System and TrackMind Standardization Framework are documented in `docs/architecture/racing-operating-system-standardization-framework.md`. That document defines the principle that TrackMind standardizes racetrack operations digitally, not just software modules, while keeping HISA-aligned, ISO 42001, Digital Twin, AI, deployment-mode, and franchise/readiness language clear about what is metadata or operating-model intent versus implemented runtime capability or formal certification.

The TrackMind Universal Artifact Framework is documented in `docs/architecture/universal-artifact-framework.md`. It defines the canonical path from inputs, events, artifacts, Digital Twins, feature metadata, AI models, recommendations, approvals, outputs, and audits while keeping storage, model-training, federation, and certification claims limited to documented contracts and readiness metadata unless production infrastructure exists.

The TrackMind Racing Data API Hub is documented in `docs/architecture/racing-data-api-hub.md`. It defines the provider-agnostic licensed ingestion architecture for racing data, including adapter-ready provider categories, no-scraping and no-public-redistribution assumptions, raw landing, validation, normalization, canonical artifacts, entity resolution, data quality, API surfaces, frontend workspace expectations, Digital Twin/event/audit integration, and AI training restrictions without claiming that external providers are currently integrated or licensed.

Enterprise domains are organized across `services`, `digital-twin`, `ai`, `workflows`, `compliance`, `integrations`, `infra`, `tests`, and `deploy` so future teams can add production modules with consistent tenant isolation, CQRS/event sourcing patterns, observability, compliance evidence, and human-governed AI automation.

## Multi-Track Federation

TrackMind Nexus now declares a read-only federation contract for the long-term Multi-Track Federation OS and Racing Intelligence Network vision. The contract carries `organizationId`, `tenantId`, `racetrackId`, track certification readiness, standard schema versions, governance, data-sharing policy, tenant isolation, consent, and retention boundaries. Cross-track benchmark and industry analytics fields are explicitly anonymized, aggregate-only, permission-governed metadata; no raw cross-track records or execution endpoints are exposed.

## Equine Intelligence Platform

TrackMind now includes an Equine Intelligence Platform for a horse-centered digital profile across the full lifecycle. The platform models ownership history, trainer assignments, racing starts, workouts, transportation, veterinary records with privacy scopes, welfare observations, retirement, participation eligibility, compliance posture, immutable audit history, and Digital Twin synchronization for every horse.

Governance is enforced through tenant boundaries, role-based veterinary privacy filtering, eligibility rules, hash-chained audit events, and synchronized equine twin state so racing officials, care teams, regulators, and auditors operate from a controlled source of truth.

## Safety model

TrackMind-MoE never directly automates race starts/stops, official results, scratches, medication decisions, emergency actions, payouts, or disciplinary decisions without a human approval record. Every AI recommendation carries `recommendationId`, confidence, evidence, `modelVersion`, `generatedAt`, `approvalRequirement`, and `auditReference` metadata.

## Getting started

```bash
npm install
npm test
```

Python stubs can be run with FastAPI tooling after installing `fastapi` and `uvicorn`:

```bash
uvicorn apps.agents.trackmind_agents.main:app --reload
```

Docker Compose provides a local PostgreSQL baseline:

```bash
docker compose -f infra/docker/docker-compose.yml up
```
