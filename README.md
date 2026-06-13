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

## Safety model

TrackMind-MoE never directly automates race starts/stops, official results, scratches, medication decisions, emergency actions, payouts, or disciplinary decisions without a human approval record. Every AI recommendation carries confidence, evidence, required approvals, and immutable audit logging hooks.

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
