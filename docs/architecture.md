# Architecture

TrackMind-MoE combines a PostgreSQL operational store, race-day event bus, expert-agent stubs, digital twin, IoT ingestion, rulebook RAG interface, React dashboard, and Azure deployment baseline. Critical AI outputs are recommendations until human approval is recorded.

## Build intent

See `docs/TRACKMIND_BUILD_INTENT.md` for the current platform build intent, including the product vision, safety boundaries, human-approval requirements, Digital Twin/event/audit/workflow/rules/AI governance model, and phased roadmap. See `docs/TRACKMIND_IMPLEMENTATION_PLAN.md` for the incremental execution plan that maps the intent into repository workstreams.

See `docs/architecture/racing-operating-system-standardization-framework.md` for the Racing Operating System and TrackMind Standardization Framework. It defines the operating-model tree, ten standardization tiers, HISA-aligned readiness reference, ISO/IEC 42001 AI management anchor, deployment modes, and the boundary between readiness metadata and implemented runtime capability.

See `docs/architecture/universal-artifact-framework.md` for the TrackMind Universal Artifact Framework. It defines the canonical artifact flow from inputs through events, artifacts, Digital Twins, feature metadata, AI models, recommendations, approvals, outputs, and audits while preserving tenant ownership, lineage, safety constraints, integration points, and the distinction between metadata/facades and production infrastructure.

See `docs/architecture/racing-data-api-hub.md` for the TrackMind Racing Data API Hub. It defines the provider-agnostic licensed ingestion architecture for racing data, including adapter-ready source categories, no-scraping/no-public-redistribution assumptions, provider registry and connector contracts, raw landing, validation, normalization, canonical racing artifacts, entity resolution, data quality, API and frontend workspace expectations, Digital Twin/event/audit integration, and AI training restrictions without implying that external providers are already integrated or licensed.

## Design, Theme, and Collaboration Architecture

The active dashboard design language is the TrackMind Nexus command-center shell in `apps/dashboard/src/App.tsx`, `apps/dashboard/src/server.tsx`, `apps/dashboard/src/components/nexus-ui.tsx`, and `apps/dashboard/src/shell/navigation.ts`. Theme variables use the `--tm-*` token namespace for color, typography, spacing, radius, elevation, density, layout, status, risk, and map geometry. Legacy aliases such as `--bg`, `--panel`, `--border`, `--text`, `--muted`, `--ok`, `--warn`, and `--critical` are quarantine aliases only; new component rules should consume `--tm-*` tokens directly.

Route metadata is centralized in `routeMetadataById` and `navItems`. Every routed workspace should carry TrackMind OS component IDs, Universal Schema coverage, readiness status, role visibility, and mock/live posture through that registry instead of local route-only metadata. Deprecated UI areas stay visible only as compatibility or placeholder labels: legacy one-page routes redirect to canonical workspaces, the old combined facilities/workforce hub is removed, revenue/wagering/finance telemetry is explicitly not connected, and simulation, predictive maintenance, weather, watchlist, evidence viewer, and appeal package views remain labeled placeholders until live governed services exist.

Collaboration is route-scoped, artifact-attached, and draft-only. `packages/shared/src/collaborationContracts.ts` owns the canonical object and event contracts, while dashboard collaboration panels attach comments, assignments, decisions, evidence packets, approval discussions, and incident rooms to concrete route artifacts, audit refs, workflow refs, approval refs, event refs, and Digital Twin refs. Browser collaboration controls must not mutate operational state; posts remain `collaborationOnly`, `draftOnlyPosts`, and `mutatesOperationalState: false` unless a backend approval workflow later issues an explicit authorization path.
