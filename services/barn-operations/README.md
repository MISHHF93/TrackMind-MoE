# TrackMind Nexus Barn Operations Service

This folder is reserved for the future Barn Operations bounded-context service described in `docs/TRACKMIND_BUILD_INTENT.md` and sequenced in `docs/TRACKMIND_IMPLEMENTATION_PLAN.md`.

## Current Status

- Contract scaffold only; `openapi.yaml` and `service.catalog.yaml` exist, but no production runtime service is implemented here yet.
- The current reference implementation lives in `apps/api/src/barnOperations.ts` and is exposed through the API facade.
- Use `templates/service-template` before adding service code.
- Preserve tenant isolation, audit logging, event contracts, veterinary privacy, barn access controls, and human-approval boundaries for protected actions.

## Next Work

- Add domain model, command handlers, and read models.
- Add unit, contract, integration, security, privacy, and safety-boundary tests.
