# TrackMind Nexus Documentation Index

This directory documents TrackMind Nexus architecture and governance. Source code remains the authority for executable contracts; docs link to those canonical files instead of redefining them.

## Source Of Truth

- Product and safety intent: `docs/TRACKMIND_BUILD_INTENT.md`
- **Feature implementation master plan (20 waves):** `docs/architecture/FEATURE_IMPLEMENTATION_MASTER_PLAN.md`
- Implementation checklist: `docs/TRACKMIND_IMPLEMENTATION_PLAN.md`
- Technical architecture overview: `docs/architecture.md`
- Event standard: `docs/architecture/event-backbone.md`
- API contract manifest: `packages/shared/src/apiContracts.ts`
- Domain, RBAC, KPI, AI, approval, and audit contracts: `packages/shared/src/`
- Frontend route manifest: `apps/frontend/src/routes/routes.ts`
- Service scaffold metadata: `services/*/service.catalog.yaml`
- Database evolution: `db/migrations/` and `scripts/validate-migrations.mjs`
- Maintenance and local operations: `docs/operations/maintenance.md`

## Historical Documents

Documents that describe an implementation sequence or snapshot should be treated as historical unless they explicitly point to a current canonical source above.
