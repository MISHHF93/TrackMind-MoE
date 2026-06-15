# TrackMind Nexus Event Backbone

The event backbone is the shared contract layer for TrackMind Nexus services. `packages/shared/src/foundation.ts` owns the canonical event envelope, and `apps/api/src/eventBus.ts` is the only runtime publish/subscribe facade. Every event normalizes to `eventId`, `eventType`, `tenantId`, `racetrackId`, `actorId`, `source`, `timestamp`, `payload`, and `version`.

## Contract Model

Event contracts are registered through `UniversalEventBus.registerEvent()` or as a catalog with `registerNexusEventCatalog()`. Nexus catalog events use `context.entity.verb.vN` names and declare:

- Owner service, team, and accountable role.
- Required payload fields.
- Compliance classification.
- Required service metadata: `eventId`, `eventType`, `tenantId`, `racetrackId`, `actorId`, `source`, `timestamp`, `version`, `correlationId`, `aggregateId`, `actor`, `subject`, `auditRef`, evidence, and `digitalTwinRef` when applicable.
- Replayability, CQRS projection hints, frontend consumers, and observability signals.

Events that already include `.vN` in the event name use that name as the schema reference. Legacy events that use a separate `version` still keep the existing `event-name.vN` schema reference.

## Publishing Standard

Every service publisher should include:

- `tenantId` and `racetrackId` when the event affects a racetrack tenant.
- `actorId` through the `actor` object and `source` through the producer/service name.
- `correlationId` from the command, request, workflow, or parent event. If omitted, the bus generates one.
- `causationId` and `parentEventIds` when handling another command or event.
- `aggregateId` for replay, read-model rebuild, audit timelines, and Digital Twin synchronization.
- `actor`, `subject`, `evidence`, `auditRef`, and relevant `digitalTwinRef`, `approvalRef`, or `workflowRef`.

The bus validates registered payload fields and, for Nexus contracts, validates the TrackMind Nexus event envelope before storing or delivering the event.

## Consumers And Failures

Consumers register with `subscribe()` or `consumer(name).subscribe()`. Delivery retries use each subscription retry policy. Failed handlers are captured in the dead-letter queue with event type, handler, reason, attempts, tenant, racetrack, correlation ID, and replayability.

Use `deadLetterQueue({ tenantId, correlationId, eventType })` for triage and `processDeadLetters()` after the consumer is healthy. Dead-letter retries emit `dead-letter.retried` signals and preserve the original event context.

## Replay And Audit

`replay()` supports filtering by event type, sequence range, occurrence time, tenant, racetrack, aggregate, and correlation ID. Replay can optionally redeliver events to consumers.

`bindAuditLogToEvents()` writes every accepted event into the immutable audit ledger with canonical event ID/type, schema reference, trace, lineage, Nexus context, tenant/racetrack scope, actor/source, workflow reference, subject, correlation ID, regulations, and evidence IDs. The audit sink is intentionally a normal event consumer so delivery failures are visible through the same handler signals and dead-letter mechanics.

## Integration Expectations

Services should integrate through the shared bus rather than building isolated event channels:

- Approval services emit request, decision, expiration, and execution-authorization events with approval references.
- Workflow services emit state transitions with workflow and approval context.
- Digital Twin services consume registry, telemetry, and state patch events and write their own audit trail.
- Platform observability reads event counts, registered schemas, dead letters, and handler signals.
- Frontend workspaces discover catalog contracts through `/api/v1/events/catalog` and consume stream heartbeats through `/api/v1/events/stream`.
