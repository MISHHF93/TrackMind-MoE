# Security Baseline

## Identity and access

- Use Microsoft Entra ID for workforce identity and managed identities for service-to-service access.
- Enforce least privilege with Azure RBAC, scoped app roles, just-in-time privileged access, and conditional access.
- Require tenant, track, role, and purpose claims for privileged operations.

## Network and secrets

- Use private endpoints for databases, Key Vault, event services, observability, and AI endpoints.
- Store secrets, certificates, and signing keys in Azure Key Vault only.
- Disable public ingress except through approved API gateways and edge services.

## Application security

- Validate every command and query with schema validation.
- Enforce row-level or partition-level tenant isolation.
- Emit structured audit events for authentication, authorization failures, approvals, policy denials, data exports, and privileged changes.
- Run SAST, dependency scanning, IaC scanning, secret scanning, container scanning, and DAST before production release.

## Compliance-by-design

- Map controls to SOC 2, ISO 27001, NIST AI RMF, ISO 42001, PCI DSS where payment data is present, ARCI, and HISA-relevant operating controls.
- Keep evidence immutable, timestamped, tenant-scoped, and exportable.
