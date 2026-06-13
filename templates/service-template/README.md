# Service Template

Use this template for every TrackMind Nexus microservice.

## Required structure

```text
src/api
src/application
src/domain
src/infrastructure
tests/unit
tests/contract
tests/integration
openapi.yaml
service.catalog.yaml
```

## Production gates

- OpenAPI contract published and versioned.
- Tenant isolation enforced on all requests and events.
- Command handlers emit audit events.
- Domain events follow `domain.entity.action.vN` naming.
- Health, readiness, liveness, metrics, and tracing endpoints are implemented.
- CI runs unit, contract, SAST, dependency, container, and IaC checks.
