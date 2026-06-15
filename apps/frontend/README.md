# TrackMind Nexus Frontend

## Bounded Context

This is the single canonical frontend shell for TrackMind Nexus. It is backend-contract driven and exposes only live API routes, facade-backed routes, documented stubs, or explicit mock adapters.

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
- One theme system: `src/theme/tokens.css`
- One API path source: `src/api/paths.ts`
- One API adapter layer: `src/api/client.ts` and `src/api/services.ts`
- One explicit mock adapter: `src/mocks/domainMocks.ts`
- One shared domain mapping layer: `src/domain`

## Safety Posture

AI recommendations are advisory only. The UI may view details, request approval, open audit trails, or open evidence. It does not render direct execution controls for protected race-day, veterinary, emergency, payout, disciplinary, or enforcement actions.
