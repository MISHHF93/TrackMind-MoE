# TrackMind Nexus Race Operations Service

Runnable microservice template for the Race Operations bounded context.

## Current status

- Read models (`race-office`, `dashboard`, `races`, `race-report`) are served through `RaceOperationsService` in this package.
- Command handlers and approval-gated mutations remain in `apps/api/src/raceOperationsPlatform.ts` until full domain extraction.
- `apps/api` delegates facade read routes through `@trackmind/race-operations-service` via an in-process platform adapter.

## Run locally

```bash
npm run start -w @trackmind/race-operations-service
```

Standalone mode serves operational endpoints with an empty read-model seed. The API facade uses the same service boundary with a seeded `RaceOperationsPlatform` adapter.

## Structure

```text
src/api            HTTP server and route handlers
src/application    RaceOperationsService read-model boundary
src/domain         Read port contracts
src/infrastructure Platform adapter for in-process delegation
tests/contract     OpenAPI and catalog contract tests
```

## Next work

- Extract command handlers and repository persistence from the API monolith.
- Wire Postgres repository and event bus adapters behind the service boundary.
