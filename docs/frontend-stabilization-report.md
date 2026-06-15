# TrackMind Nexus Frontend Stabilization Report

## New Frontend Active

- The dashboard now has a Vite React SPA entry in `apps/dashboard/src/main.tsx`.
- The browser runtime renders through `apps/dashboard/src/shell/AppShell.tsx`.
- Route resolution is centralized through `apps/dashboard/src/routes/registry.ts` and `apps/dashboard/src/routes/RouteRenderer.tsx`.
- The Node dashboard server still handles `/health`, legacy redirects, unknown route fallback, and now serves `/assets/trackmind-dashboard.js` from the SPA build.
- SSR HTML is retained inside `#root` as a compatibility fallback and initial shell.

## Routes Stabilized

- Canonical route metadata is consolidated in `routes/registry.ts`.
- Breadcrumbs and command palette items now derive from the canonical route registry.
- Legacy redirects remain active for moved routes.
- Deprecated routes remain quarantined: `/legacy-one-page-dashboard` and `/nexus-operational-workspace-blueprint`.
- Active routes are checked by `auditFrontendDecommission()` to ensure they do not reference quarantined paths.

## Component And Theme Platform

- Theme modes now include `command-center-dark`, `command-center`, `dark`, `light`, and `high-contrast`.
- Runtime theme and density are applied by `AppShell`.
- Shared platform primitives now include `EvidencePanel` and `RecommendationCard` in addition to existing Nexus components.
- Duplicate wrappers remain compatibility-only until all imports move to canonical `nexus-ui` components.

## API And Realtime Platform

- `api/typedApi.ts` wraps the existing Nexus client with one typed dashboard loader.
- `api/requestPolicy.ts` adds retry and stale metadata policy.
- `api/realtime.ts` provides an EventSource-backed realtime service with reconnect, stale detection, degraded state, and visible mock-stream warnings.
- `hooks/useRealtimeStream.ts` exposes the realtime service to browser workspaces.
- Existing mock fallback remains labelled and read-only.

## Workspace Cohorts

- Workspace migration boundaries are recorded in `workspaces/cohorts.ts`.
- Cohorts preserve approval actions, audit dependencies, realtime dependencies, mock labels, and safety posture.
- Extracted domain modules remain preferred where they already exist; other workspace routes are compatibility-rendered through `CommandCenter` until safe extraction.

## Decommission Status

- Removed from active routing: legacy one-page and blueprint paths.
- Quarantined: deprecated route aliases and compatibility-only shell fragments.
- Retained temporarily: `App.tsx` `CommandCenter`, state wrappers, and embedded API fixtures, because tests and SSR fallback still depend on them.
- Removal candidates after stabilization: duplicate state wrappers, embedded mock fixtures, and old shell fragments after route/component/API tests prove no active references remain.

## Validation Commands

- `npm -w apps/dashboard run typecheck`
- `npm -w apps/dashboard run build`
- `npm -w apps/dashboard test`
- Dashboard route registry, workspace cohort, API realtime, theme token, shared component, redirect, permission, and SSR fallback assertions are covered by the dashboard test suite.

## Unresolved Follow-Up

- Complete physical extraction of remaining workspace bodies from `App.tsx`.
- Move embedded mock DTOs from `api/client.ts` into explicit fixture adapter modules.
- Add browser E2E and accessibility automation once a browser runner is introduced.
- Remove compatibility wrappers and legacy token aliases after import telemetry and tests confirm they are unused.

