# Onboarding Guide

## First day checklist

1. Read `README.md`, `docs/architecture/enterprise-blueprint.md`, `docs/engineering/coding-standards.md`, and `docs/security/security-baseline.md`.
2. Install Node.js LTS, npm, Python 3.11+, Docker, Azure CLI, Bicep, Terraform, and GitHub CLI.
3. Run `npm install`, `npm test`, and `npm run build` from the repository root.
4. Create a feature branch using the documented naming convention.
5. Start from `templates/service-template` for new services or `templates/frontend-template` for new applications.

## New service checklist

- Define bounded context, commands, queries, events, and data ownership.
- Add OpenAPI contract and contract tests.
- Add tenant isolation and RBAC checks before persistence or event publication.
- Add audit events for every command and integration side effect.
- Add dashboards, alerts, runbooks, SLOs, and deployment pipeline entries.
