# Technical Documentation

## Architecture

TrackMind uses a Command -> Event -> Projection flow:

```mermaid
flowchart LR
  Command[Approval-Gated Command] --> Policy[Policy Engine]
  Policy --> Approval[Human Approval]
  Approval --> Event[Azure Event Hubs Event]
  Event --> Projection[Race, Horse, Security Projections]
  Event --> Audit[Immutable Audit Log]
```

## Test Results

- `apps/api/tests/apex-domain-services.test.mjs`
- `apps/api/tests/cqrs-event-architecture.test.mjs`
- `apps/frontend/tests/frontend-contracts.test.mjs` verifies the canonical frontend shell, route registry, scoped API adapter headers, mock isolation, KPI adapter wiring, Vite proxy boundary, and absence of direct regulated action controls.

## Certificates

This package records internal readiness evidence only. It does not claim external certification.
