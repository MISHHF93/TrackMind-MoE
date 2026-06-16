# TrackMind Maintenance Guide

This guide keeps local development and sustainment work aligned with the active code surface. Source code remains authoritative for executable contracts.

## Lifecycle Map

- Active runtime: `apps/api`, `apps/frontend`, `apps/agents`, and `packages/shared`.
- Contract scaffolds: `services/*`, `templates/service-template`, `compliance/`, and deployment pipeline templates.
- Database contracts: `db/migrations`, `db/seeds`, and `scripts/validate-migrations.mjs`.
- Deployment baseline: `infra/azure`, `infra/docker`, `.github/workflows/ci.yml`, and `vercel.json`.
- Target architecture docs: architecture pages that describe future durable services, Azure Digital Twins, production integrations, Terraform, Helm, Kubernetes, or separate mobile/ops apps unless the matching assets exist in the repository.
- Disposable generated output: `dist/`, `apps/*/dist/`, `packages/*/dist/`, `node_modules/`, `artifacts/`, `visual-audit/`, `.pytest_cache/`, dashboard screenshots, coverage reports, and `*.tsbuildinfo`.

## Local Health Checks

Run from the repository root that contains `package.json`:

```bash
npm install
python -m pip install -r apps/agents/router/requirements.txt pytest httpx
npm run migrations:validate
npm run typecheck
npm test
npm run build:vite
```

For API-only checks:

```bash
npm run build:api
npm run start:api
```

For frontend local development:

```bash
npm run start:frontend
```

Local Vite development expects the API on `http://127.0.0.1:4000` and proxies `/api/v1`. Hosted static deployments must set `VITE_TRACKMIND_API_BASE_URL` to the deployed API URL, including `/api/v1`.

## Cleanup Rules

- Regenerate or delete local dashboard screenshots when they are no longer needed; they are ignored by `dashboard-*.png`.
- Treat `tree.txt` as a local snapshot, not a source of truth. Regenerate it after structural changes or remove it.
- Do not edit generated `dist` output directly. Rebuild with the relevant npm script.
- Do not add scaffold folders to production workspaces until they have package metadata, source, tests, and CI ownership.

## Deployment Notes

- `infra/docker/docker-compose.yml` is a PostgreSQL baseline only. It does not start the API, frontend, or Python agents.
- Azure Container Apps deployment expects prebuilt API and agent images. Keep image provenance, migration execution, and runtime secrets documented before treating it as production-ready.
- The API container must bind to `HOST=0.0.0.0` and `PORT=4000` for external Container Apps ingress.

## Review Priorities

Before expanding new runtime surfaces, keep these contracts aligned:

- API contracts and permissions: `packages/shared/src/apiContracts.ts` and `packages/shared/src/accessControl.ts`.
- Frontend route/API manifest: `apps/frontend/src/routes/routes.ts` and `apps/frontend/src/api/paths.ts`.
- Governance boundary: centralized approval, audit, and Responsible AI contracts under `apps/api/src` and `packages/shared/src`.
- Database evolution: migration ordering, seed compatibility, tenant scope columns, and audit/event references.
