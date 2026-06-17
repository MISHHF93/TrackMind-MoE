# TrackMind Nexus Frontend Architecture

## Overview

The frontend is a contract-driven React 19 application that maps each operating console to backend read models in `packages/shared` and `apps/api`. Mutations flow through approval-gated POST endpoints only.

## Layering

```text
main.tsx
  AppProviders (QueryClient, TenantSession, Workspace context)
    RouterProvider
      AppShell (sidebar, command bar, action dock, live status)
        WorkspacePage (per route)
```

## Workspace Pattern

1. Route metadata in `src/routes/routes.ts` declares permissions, navigation group, and backend path groups.
2. `useWorkspaceData(routeId)` fetches all paths in `routeApiPathGroups` in parallel.
3. `WorkspacePage` renders metrics, priority queue, advisories, and raw feed tabs.
4. `setWorkspaceState` updates shell posture and governed action dock for the active console.

## Governance UX

- Action dock buttons with `protectedAction` open `GovernedActionDialog` → `POST /approvals/controlled-actions`.
- Approvals workspace exposes `Approve` / `Reject` for pending items.
- MoE assistant is advisory-only; suggestions do not mutate operational state.

## Realtime

`useEventStream` connects to `GET /api/v1/events/stream` (SSE heartbeat) and invalidates workspace queries on heartbeat.

## Verification

- `npm run test -w apps/frontend` — contract and safety invariant tests
- `npm run typecheck -w apps/frontend`
- Manual smoke: `npm run start` from repo root, switch roles, open approvals, verify SSE indicator and assistant panel

## Visual Smoke Checklist

- [ ] Light and dark theme toggle persists
- [ ] Role switcher filters sidebar routes by RBAC
- [ ] Command palette (Cmd+K) navigates to consoles
- [ ] Dashboard loads metrics from backend feeds
- [ ] Approvals page shows queue and approve/reject controls
- [ ] Action dock shows "Request … approval" labels (not direct execution)
- [ ] Live status bar shows SSE connection state
- [ ] MoE assistant opens and handles degraded router state gracefully
