# Coding Standards

## General standards

- Prefer TypeScript for platform services and React applications; Python is reserved for AI/ML agents, evaluation, and data science services.
- Expose APIs through OpenAPI-first contracts and version public routes with `/v1`, `/v2`, or explicit media types.
- Use domain-driven boundaries: each service owns its schema, command handlers, events, read models, and integration adapters.
- Never bypass the audit logger for user actions, AI recommendations, or external system calls.
- Never put try/catch blocks around imports.

## Service requirements

Each production service must include:

- `README.md` with bounded context, APIs, commands, events, data ownership, runbook, and on-call notes.
- `src/domain` for aggregates, value objects, commands, and domain events.
- `src/application` for command/query handlers and workflow orchestration.
- `src/infrastructure` for persistence, messaging, telemetry, secrets, and external adapters.
- `src/api` for controllers, DTOs, validation, and OpenAPI bindings.
- Unit, contract, integration, and policy tests.

## Event standards

- Event names use `context.entity.verb.vN`, such as `race.card.published.v1`.
- Events must contain `eventId`, `eventType`, `tenantId`, `racetrackId`, `actorId`, `source`, `timestamp`, `payload`, and `version`. Use `correlationId`, `causationId`, `aggregateId`, `auditRef`, `approvalRef`, and `digitalTwinRef` when the workflow has those references.
- Events are append-only; corrections are emitted as compensating events.

## AI standards

- Store prompt templates, model versions, retrieval sources, confidence, and evaluator output for every AI recommendation.
- Use policy gates before executing actions; regulated domains must require human approval.
- Maintain model cards and evaluation reports under `ai/evaluations` before production promotion.
