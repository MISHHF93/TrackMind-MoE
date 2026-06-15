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
- `apps/dashboard/tests/race-day-command-dashboard.test.mjs`

## Certificates

This package records internal readiness evidence only. It does not claim external certification.
