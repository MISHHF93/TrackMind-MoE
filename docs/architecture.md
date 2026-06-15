# Architecture

TrackMind-MoE combines PostgreSQL migrations/seeds for the target operational store, an in-memory/reference race-day event bus, expert-agent stubs, reference Digital Twin and IoT facades, a rulebook RAG interface, Azure deployment baseline, and a canonical backend-driven React frontend shell. Critical AI outputs remain recommendations until human approval is recorded.

## Build intent

See `docs/TRACKMIND_BUILD_INTENT.md` for the current platform build intent, including the product vision, safety boundaries, human-approval requirements, Digital Twin/event/audit/workflow/rules/AI governance model, and phased roadmap. See `docs/TRACKMIND_IMPLEMENTATION_PLAN.md` for the incremental execution plan that maps the intent into repository workstreams.

See `docs/architecture/racing-operating-system-standardization-framework.md` for the Racing Operating System and TrackMind Standardization Framework. It defines the operating-model tree, ten standardization tiers, HISA-aligned readiness reference, ISO/IEC 42001 AI management anchor, deployment modes, and the boundary between readiness metadata and implemented runtime capability.

See `docs/architecture/universal-artifact-framework.md` for the TrackMind Universal Artifact Framework. It defines the canonical artifact flow from inputs through events, artifacts, Digital Twins, feature metadata, AI models, recommendations, approvals, outputs, and audits while preserving tenant ownership, lineage, safety constraints, integration points, and the distinction between metadata/facades and production infrastructure.

See `docs/architecture/racing-data-api-hub.md` for the TrackMind Racing Data API Hub. It defines the provider-agnostic licensed ingestion architecture for racing data, including adapter-ready source categories, no-scraping/no-public-redistribution assumptions, provider registry and connector contracts, raw landing, validation, normalization, canonical racing artifacts, entity resolution, data quality, API and frontend workspace expectations, Digital Twin/event/audit integration, and AI training restrictions without implying that external providers are already integrated or licensed.

## Frontend Architecture

`apps/frontend` is the active canonical shell after removing the old dashboard and temporary shell. It is an AI Stack-first command surface with route-scoped artifacts, approval-safe read-only action rails, backend-declared dependencies, explicit mock/stub labeling, and tenant/racetrack context propagation. Theme variables use a single TrackMind token namespace for color, typography, spacing, radius, elevation, density, layout, status, risk, and audit/KPI signals.

Route metadata lives in one registry in `apps/frontend/src/routes/routes.ts`. Every routed workspace carries readiness status, role visibility, mock/live posture, approval boundaries, backend paths, aliases for deliberate legacy compatibility, and audit references through that registry.

Collaboration is route-scoped, artifact-attached, and draft-only. `packages/shared/src/collaborationContracts.ts` owns the canonical object and event contracts. Future browser collaboration controls must not mutate operational state; posts remain `collaborationOnly`, `draftOnlyPosts`, and `mutatesOperationalState: false` unless a backend approval workflow later issues an explicit authorization path.
