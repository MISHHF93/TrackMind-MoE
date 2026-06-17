# TrackMind Nexus Frontend

## Bounded Context

This is the single canonical frontend shell for TrackMind Nexus. It is backend-contract driven and exposes live API routes, facade-backed routes, and governed approval workflows through a unified adapter layer.

## Commands

- `npm run start -w apps/frontend`
- `npm run typecheck -w apps/frontend`
- `npm run test -w apps/frontend`
- `npm run build -w apps/frontend`

## Architecture Boundary

- One entrypoint: `src/main.tsx`
- One app component: `src/app/App.tsx`
- One router: `src/app/router.tsx` (React Router)
- One route inventory: `src/routes/routes.ts`
- One shell: `src/shell/AppShell.tsx`
- Design system: `src/design/components/*` + `src/design/tokens.css`
- API layer: `src/api/client.ts`, `src/api/paths.ts`, `src/api/mutations.ts`, `src/api/sse.ts`, `src/api/agents.ts`
- Session/auth: `src/auth/session.ts`, `src/auth/TenantSessionProvider.tsx`, `src/auth/role-switcher.tsx`
- Workspace pages: `src/workspaces/*` backed by TanStack Query hooks in `src/hooks/useWorkspaceData.ts`

## Safety Posture

AI recommendations are advisory only. The UI may view details, open approval records, open audit trails, or open evidence. Protected actions route through approval drafts (`Request … approval`) — never direct execution controls for regulated race-day, veterinary, emergency, payout, disciplinary, or enforcement actions.

## Dev Stack

- React 19 + Vite + TypeScript
- React Router v7
- TanStack Query
- Tailwind CSS v4 + Radix primitives

## Environment

- `VITE_TRACKMIND_API_BASE_URL` — override API base (default `/api/v1` via Vite proxy to port 4000)
- `VITE_TRACKMIND_AGENTS_URL` — MoE router base (default `/agents` proxy to port 8001)
