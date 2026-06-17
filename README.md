# TrackMind-MoE

TrackMind-MoE is a racetrack AI operating-system monorepo. It coordinates race-day operations, safety, compliance, facilities, fan experience, security, and finance through a Mixture-of-Experts (MoE) agent router with mandatory Responsible AI governance.

The system models a racetrack as a target/reference Digital Twin: horses, people, restricted zones, sensors, cameras, tickets, incidents, and official racing workflows are represented through auditable contracts and in-memory/facade services unless a durable integration is explicitly documented. AI recommendations are advisory by default and require human approval before downstream actions in safety-critical or regulated domains.

The current backend-first rebuild execution anchor is documented in `docs/architecture/BACKEND_FIRST_REBUILD_EXECUTION.md`. It defines the route-contract-first rebuild order, target user layout, required artifacts, AI governance boundary, and source tree shape for keeping the active frontend shell aligned to backend contracts.

## Monorepo layout

- `apps/api` — TypeScript Node.js API domain services, RBAC, event bus, approvals, audit, IoT, safety, stewarding, ticketing, and security modules.
- `apps/frontend` — canonical React/Vite frontend shell rebuilt from backend contracts, shared DTOs, route metadata, central API adapters, governed KPI cards, and advisory-only AI context.
- `apps/agents` — FastAPI-compatible Python service stubs for expert agents and rulebook RAG.
- `packages/shared` — canonical TypeScript domain kernel, DTO contracts, RBAC permissions, KPI artifacts, and governance policy constants.
- `db` — PostgreSQL migrations and seed data.
- `infra/azure` — Azure Bicep deployment baseline.
- `docs` — architecture and compliance mappings.

## TrackMind Nexus enterprise expansion

This repository is structured as the TrackMind Nexus enterprise monorepo: an Azure-first, API-first, event-driven Digital Twin platform for multi-racetrack Thoroughbred operations. The current build intent is documented in `docs/TRACKMIND_BUILD_INTENT.md`, the implementation plan is documented in `docs/TRACKMIND_IMPLEMENTATION_PLAN.md`, and the executable architecture package is documented in `docs/architecture/TRACKMIND_NEXUS_DEFINITION.md` with sequencing in `docs/architecture/IMPLEMENTATION_SEQUENCE.md`; new modules should inherit that intent and plan plus the standards in `docs/architecture/enterprise-blueprint.md`, `docs/engineering/coding-standards.md`, `docs/engineering/branching-strategy.md`, `docs/security/security-baseline.md`, and `templates/service-template`.

The Racing Operating System and TrackMind Standardization Framework are documented in `docs/architecture/racing-operating-system-standardization-framework.md`. That document defines the principle that TrackMind standardizes racetrack operations digitally, not just software modules, while keeping HISA-aligned, ISO 42001, Digital Twin, AI, deployment-mode, and franchise/readiness language clear about what is metadata or operating-model intent versus implemented runtime capability or formal certification.

The TrackMind Universal Artifact Framework is documented in `docs/architecture/universal-artifact-framework.md`. It defines the canonical path from inputs, events, artifacts, Digital Twins, feature metadata, AI models, recommendations, approvals, outputs, and audits while keeping storage, model-training, federation, and certification claims limited to documented contracts and readiness metadata unless production infrastructure exists.

TrackMind KPI artifacts are documented in `docs/architecture/kpi-artifacts.md`. KPI values are governed artifacts with owners, thresholds, source events/entities, confidence, data quality, audit references, model-readable metadata, and historical snapshots. Current KPI values are deterministic readiness/facade calculations, not production telemetry or certification proof.

Canonical business-domain ownership lives in `packages/shared/src/domainKernel.ts`, `packages/shared/src/accessControl.ts`, and `packages/shared/src/kpiArtifacts.ts`, backed by PostgreSQL migrations under `db/migrations`. The canonical event envelope lives in `packages/shared/src/foundation.ts` and is emitted through `apps/api/src/eventBus.ts` with `eventId`, `eventType`, `tenantId`, `racetrackId`, `actorId`, `source`, `timestamp`, `payload`, and `version`. Organization, tenant, user, racetrack, horse, race, incident, facility, security event, compliance record, approval, audit event, recommendation, role, permission, KPI, and event consumers should import those shared models or DTO projections instead of declaring local shapes.

The TrackMind Racing Data API Hub is documented in `docs/architecture/racing-data-api-hub.md`. It defines the provider-agnostic licensed ingestion architecture for racing data, including adapter-ready provider categories, no-scraping and no-public-redistribution assumptions, raw landing, validation, normalization, canonical artifacts, entity resolution, data quality, API surfaces, frontend workspace expectations, Digital Twin/event/audit integration, and AI training restrictions without claiming that external providers are currently integrated or licensed.

Enterprise domains are organized across the current `services`, `digital-twin`, `ai`, `workflows`, `compliance`, `infra`, `tests`, and deployment scaffolding so future teams can add production modules with consistent tenant isolation, CQRS/event sourcing patterns, observability, compliance evidence, and human-governed AI automation.

## Multi-Track Federation

TrackMind Nexus now declares a read-only federation contract for the long-term Multi-Track Federation OS and Racing Intelligence Network vision. The contract carries `organizationId`, `tenantId`, `racetrackId`, track certification readiness, standard schema versions, governance, data-sharing policy, tenant isolation, consent, and retention boundaries. Cross-track benchmark and industry analytics fields are explicitly anonymized, aggregate-only, permission-governed metadata; no raw cross-track records or execution endpoints are exposed.

## Equine Intelligence Platform

TrackMind now includes an Equine Intelligence Platform for a horse-centered digital profile across the full lifecycle. The platform models ownership history, trainer assignments, racing starts, workouts, transportation, veterinary records with privacy scopes, welfare observations, retirement, participation eligibility, compliance posture, immutable audit history, and Digital Twin synchronization for every horse.

Governance is enforced through tenant boundaries, role-based veterinary privacy filtering, eligibility rules, hash-chained audit events, and synchronized equine twin state so racing officials, care teams, regulators, and auditors operate from a controlled source of truth.

## Safety model

TrackMind-MoE never directly automates race starts/stops, official results, scratches, medication decisions, emergency actions, payouts, or disciplinary decisions without a human approval record. Every AI recommendation carries `recommendationId`, confidence, evidence, `modelVersion`, `generatedAt`, `approvalRequirement`, and `auditReference` metadata.

## Getting started

Run these commands from the repository root that contains this `package.json`. In wrapped checkouts, that may be the inner `TrackMind-MoE-main` directory.

```bash
npm install
python -m pip install -r apps/agents/router/requirements.txt pytest httpx
npm test
npm run build
npm run typecheck
npm run start:frontend
node scripts/performance-smoke.mjs
```

The default build is intentionally Vite-only for the deployable platform UI. It builds shared contracts, builds `apps/frontend`, and syncs `apps/frontend/dist` into root `dist` for static hosting. Run the backend API separately when you need live local data:

```bash
npm run build:api
npm run start:api
```

To validate every TypeScript workspace build in one command, use:

```bash
npm run build:all
```

Python stubs and router checks can be run after installing the agent/router requirements and test runner:

```bash
python -m pip install -r apps/agents/router/requirements.txt pytest
uvicorn apps.agents.trackmind_agents.main:app --reload
uvicorn apps.agents.router.main:app --reload
```

Docker Compose provides a local PostgreSQL baseline only. Start the API, frontend, and agents separately when you need the full local runtime:

```bash
docker compose -f infra/docker/docker-compose.yml up
```

## Vercel frontend deployment

The platform UI is deployed as a Vite-only static frontend. The Vercel build uses the root `vercel.json`, which runs:

```bash
npm run build -w packages/shared && npm run build -w apps/frontend
```

and serves static assets from:

```text
apps/frontend/dist
```

If the Vercel project **Root Directory** is set to `apps/frontend`, the nested `apps/frontend/vercel.json` applies instead. `npm run build:vite` still copies output to root `dist` for local smoke checks.

The command-center route (`/dashboard`) is a client-side React route. Backend data is loaded from `VITE_TRACKMIND_API_BASE_URL`, which defaults to `/api/v1` for local Vite proxy development only. On Vercel or any static host, configure `VITE_TRACKMIND_API_BASE_URL` to the public deployed API URL, including `/api/v1`. The frontend project does not deploy the Node API as part of the Vite static build.
