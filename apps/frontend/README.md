# TrackMind Nexus Frontend

## Bounded Context

This is the single canonical frontend shell for TrackMind Nexus. It is backend-contract driven and exposes only live API routes, facade-backed routes, or documented stubs through the central adapter layer.

## Commands

- `npm run start -w apps/frontend`
- `npm run typecheck -w apps/frontend`
- `npm run test -w apps/frontend`
- `npm run build -w apps/frontend`

## Architecture Boundary

- One entrypoint: `src/main.tsx`
- One app component: `src/App.tsx`
- One router: `src/routes/Router.tsx`
- One route inventory: `src/routes/routes.ts`
- One shell: `src/shell/AppShell.tsx`
- One design-system component surface: `src/components/ui.tsx`
- One theme system: `src/theme/tokens.css`
- One API path source: `src/api/paths.ts`
- One API adapter layer: `src/api/client.ts` and `src/api/services.ts`
- No generic mock-domain adapter; route data must flow through `src/api/paths.ts`, `src/api/client.ts`, and `src/api/services.ts`.
- One shared domain mapping layer: `src/domain`
- Reusable page, table, metric, status, timeline, alert, approval, recommendation, audit, empty, and loading UI must be imported from `src/components/ui.tsx`; pages should not define local card shells for those patterns.

## Safety Posture

AI recommendations are advisory only. The UI may view details, open approval records, open audit trails, or open evidence. It does not render direct execution controls for protected race-day, veterinary, emergency, payout, disciplinary, or enforcement actions.
