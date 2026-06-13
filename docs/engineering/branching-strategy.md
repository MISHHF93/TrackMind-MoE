# Branching and Release Strategy

- `main` is always releasable and protected by required reviews, status checks, signed commits where possible, and security scans.
- Feature branches use `feature/<ticket>-<summary>`.
- Fix branches use `fix/<ticket>-<summary>`.
- Release branches use `release/<major>.<minor>` and accept only stabilization fixes.
- Hotfix branches use `hotfix/<incident>-<summary>` and are merged back to `main` and active release branches.
- Pull requests must include summary, risk, tests, rollback plan, security/compliance impact, and screenshots for visible UI changes.
- Semantic versioning applies to service APIs, event schemas, packages, and deployable artifacts.
