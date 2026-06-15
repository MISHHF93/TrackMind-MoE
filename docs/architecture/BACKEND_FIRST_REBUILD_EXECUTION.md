# Backend-First Rebuild Execution

This document is the execution anchor for rebuilding TrackMind from backend contracts to frontend layout. The rule is simple: every visible workspace must map to a backend read model, every state-changing action must map to an approval-gated backend command or draft endpoint, and every AI output must remain advisory until a human approval record exists.

## Current Read

The README defines TrackMind-MoE as a racetrack operating-system monorepo with:

- `apps/api` as the TypeScript Node API and domain-service facade.
- `apps/frontend` as the canonical backend-driven React shell; the previous dashboard implementation and temporary shell have been removed.
- `apps/agents` as Python MoE and rulebook RAG service stubs.
- `packages/shared` as shared DTO, policy, and route contracts.
- `db`, `infra`, `docs`, and service folders as migration, deployment, architecture, and extraction scaffolds.

The implemented runtime is strongest when `packages/shared` contracts and `apps/api` routes are treated as the product contract before expanding UI behavior. The old monolithic dashboard compatibility layer is gone; the active frontend shell now exposes backend-declared workspaces through route metadata, centralized API adapters, and governed read-only action rails until approved backend workflows are available.

## Better User Layout

Use a new canonical AI Stack AppShell workspace layout as the target layout, not the removed monolithic `CommandCenter` compatibility layout.

The better layout is:

- A persistent command shell with tenant, racetrack, role, degraded-state, and command-palette context.
- Workspace groups for operations, equine, safety, facilities, governance, intelligence, executive, and platform administration.
- Domain modules rendered by route, each with a backend dependency declaration and read-only/degraded/mock labelling.
- Locked action rails for protected workflows, where buttons create backend drafts or approval requests instead of mutating frontend state.

The replacement frontend has been created and should continue to evolve only from stable backend route, DTO, approval, audit, KPI, and AI recommendation contracts.

## Execution Order

1. Backend contract pass: make `packages/shared/src/apiContracts.ts` the source of truth for route paths, DTO names, roles, emitted events, and audit tags.
2. Backend facade pass: ensure each route in the shared contract is implemented in `apps/api/src/server.ts` or a controller mounted by it.
3. AI governance pass: make TypeScript API governance the system of record for recommendations, approvals, audit, events, and digital-twin references.
4. Python router pass: keep Python agents as recommendation engines that return evidence, confidence, model version, prompt card, and policy metadata.
5. Frontend layout pass: maintain the AI Stack-first frontend workspace and bind each module to declared backend dependencies.
6. Artifact pass: add first-class model cards, prompt cards, evaluations, schemas, contract manifests, and route coverage reports.
7. Verification pass: run package tests plus contract coverage tests for API routes, route registry dependencies, approval gates, and AI advisory-only controls.

## Workstreams

Use these workstreams as the backlog. They intentionally exceed 20 so the rebuild can be broken into reviewable vertical slices.

1. Shared API contract normalization.
2. API route implementation coverage.
3. DTO validation and contract tests.
4. Approval service and protected-action gates.
5. Audit ledger and evidence lineage.
6. Event/CQRS backbone.
7. Digital Twin read models.
8. Race Office workspace.
9. Track Configuration workspace.
10. Starting Gate workspace.
11. Surface Intelligence workspace.
12. Equine Intelligence workspace.
13. Barn Operations workspace.
14. Steward Center workspace.
15. Safety Center composition.
16. Security Operations workspace.
17. Emergency Operations workspace.
18. Asset and Facilities workspace.
19. Workforce Operations workspace.
20. Compliance Control Library workspace.
21. Responsible AI Governance workspace.
22. Unified AI Control Plane workspace.
23. Racing Data API Hub workspace.
24. Federation workspace.
25. Executive read-only workspace.
26. Platform Health workspace.
27. Frontend shell, navigation, and command palette.
28. Mock/live/degraded adapter split.
29. Python MoE router integration.
30. Model card, prompt card, and evaluation artifacts.

## Required Artifacts

- Shared API route manifest: `packages/shared/src/apiContracts.ts`.
- Shared DTO and safety policy exports: `packages/shared/src/`.
- Backend route facade and controllers: `apps/api/src/server.ts`, `apps/api/src/**/controllers.ts`.
- Backend domain read models: `apps/api/src/*.ts`, `apps/api/src/services/**/*.ts`.
- Frontend route registry: `apps/frontend/src/routes/routes.ts`.
- Frontend workspace modules: `apps/frontend/src/pages`, `apps/frontend/src/shell`, and `apps/frontend/src/domain`.
- Frontend API adapter: `apps/frontend/src/api/client.ts` and `apps/frontend/src/api/services.ts`.
- AI governance control plane: `apps/api/src/aiControlPlane.ts`, `apps/api/src/responsibleAiGovernor.ts`.
- Python MoE router services: `apps/agents/router`, `apps/agents/trackmind_agents`.
- AI model cards: `ai/model-cards/*.md`.
- AI prompt cards: `ai/prompt-cards/*.md`.
- AI evaluation reports: `ai/evaluations/*.md`.
- Governance policy gates: `apps/agents/router/policies/*.yaml`.
- Database migrations and seeds: `db/migrations`, `db/seeds`.
- Rebuild verification tests: `packages/shared/tests`, `apps/api/tests`, `apps/frontend/tests`, and `apps/agents/**/tests`.

## Target Tree

```text
TrackMind-MoE-main/
  README.md
  package.json
  ai/
    README.md
    model-cards/
    prompt-cards/
    evaluations/
  apps/
    api/
      package.json
      src/
        server.ts
        index.ts
        controllers/
        services/
        events/
        compliance/
        safetyIntelligence/
        telemetry/
      tests/
    agents/
      router/
        main.py
        config.json
        policies/
        phase_router/
        tests/
      trackmind_agents/
        main.py
        tests/
    frontend/
      package.json
      src/
        api/
        domain/
        mocks/
        pages/
        routes/
        shell/
        theme/
      tests/
  packages/
    shared/
      package.json
      src/
      tests/
  services/
    barn-operations/
    events/
    race-operations/
    safety/
    stewarding/
    tenant/
  db/
    migrations/
    seeds/
  digital-twin/
    ontology/
  docs/
    architecture/
    compliance/
    engineering/
    onboarding/
    security/
  infra/
    azure/
    docker/
    environments/
    policies/
    terraform/
  integrations/
    cameras/
    hisa/
    iot/
    wagering/
    weather/
  tests/
  workflows/
```

## AI Harmonization

The backend should own all governance decisions. Python agents can classify, retrieve, rank, and recommend, but they should not approve, execute, mutate operational state, or bypass the TypeScript approval/audit/event boundary.

Target AI boundary:

- Python router output: recommendation text, expert id, model version, prompt card id, confidence, evidence refs, limitations, risk class, and proposed action.
- TypeScript API decision: validate policy, attach approval requirement, create audit/event refs, create draft workflow, and expose dashboard DTOs.
- Frontend display: show recommendation, confidence, evidence, affected assets, policy decision, audit refs, KPI context, and locked/disabled approval-safe actions.

## Immediate Next Build Slice

Start with the backend contract pass:

1. Generate or hand-maintain a route coverage test that compares `apiEndpointContracts` with `handleApiRequest`.
2. Add missing shared contract entries for live routes that are implemented but not in the manifest.
3. Remove stale dashboard references instead of preserving compatibility aliases in the route registry.
4. Keep the AI Stack-first route registry and API adapter reconciled with shared backend contracts.
5. Add AI model-card, prompt-card, and evaluation files for the current seeded Surface Advisor agent.
