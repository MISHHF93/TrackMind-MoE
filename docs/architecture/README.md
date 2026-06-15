# Architecture Docs

Use `docs/architecture.md` as the architecture entry point.

Canonical architecture references:

- Event backbone: `event-backbone.md`
- Universal Artifact Framework: `universal-artifact-framework.md`
- KPI artifacts: `kpi-artifacts.md`
- Racing Data API Hub: `racing-data-api-hub.md`
- Implementation traceability: `IMPLEMENTATION_TRACEABILITY.md`

Historical or sequence documents should not override shared contracts in `packages/shared/src/` or runtime manifests in `apps/frontend/src/routes/routes.ts` and `packages/shared/src/apiContracts.ts`.
