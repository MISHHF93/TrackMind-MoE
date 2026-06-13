# Racetrack Asset & Control Registry (RACR)

The Racetrack Asset & Control Registry is the foundation layer for TrackMind's Racetrack Control Model (RCM). It catalogs controllable physical, digital, operational, and regulatory objects before additional AI agents are introduced.

## Control categories

| Category | Authority | Examples | Policy |
| --- | --- | --- | --- |
| A — Autonomous | AI may act | Dashboard updates, reports, notifications, weather summaries | Low-risk digital execution with audit logging. |
| B — AI Recommended | AI recommends; humans approve | Irrigation schedules, staffing adjustments, maintenance planning, gate-position recommendations | Human approval is required before physical or operational execution. |
| C — Human Controlled | AI advises only | Race starts, race cancellations, official results, steward rulings, horse scratches, medical decisions, payouts | Authorized officials retain control and final accountability. |

## Master asset schema

Every RACR object follows the same digital-twin envelope:

```json
{
  "assetId": "",
  "assetType": "",
  "domain": "racing",
  "ownerAgent": "RaceOps",
  "location": {},
  "state": {},
  "controls": [],
  "sensors": [],
  "regulations": [],
  "riskLevel": "medium",
  "approvalPolicy": "",
  "lastUpdated": ""
}
```

## Seeded registry objects

The initial implementation includes these core RCM assets:

- `START_GATE_01` — a racing-domain starting gate owned by `RaceOps`, with gate-position recommendations, lock-status control boundaries, maintenance-state recommendations, GPS verification, lock telemetry, and racing commission references.
- `IRRIGATION_ZONE_4` — a surface-domain irrigation zone owned by `TrackSurface`, with water-volume recommendations, emergency shutoff as human-only, moisture readings, and flow-meter verification.
- `EMERGENCY_ALERT_SYSTEM` — a safety-domain emergency control object owned by `SecuritySOC`, where alert activation remains human-controlled and AI must never block emergency procedures.

## Starting-gate workflow

1. Race distance is approved by the race office.
2. TrackMind calculates the required gate position from the approved setup.
3. Racing Secretary approval is required if the setup is not already approved.
4. Crew moves the gate under human work-order control.
5. GPS and lock telemetry verify execution.
6. Race office verifies final readiness.

## Implementation notes

The executable registry lives in `apps/api/src/racetrackControlRegistry.ts`. It exports:

- `racetrackAssetControlRegistry` for the seeded catalog.
- `findControlAsset` for defensive registry lookups.
- `controlsRequiringApproval` for governance workflow discovery.
- `validateRaceDistanceSetup` for race-distance approval validation.
- `buildStartingGateMoveRecommendation` for the first gate-positioning workflow.

## RACR v1 foundational registry implementation

The v1 registry is implemented as an authoritative, event-emitting asset repository for all platform asset classes. Each registered object uses the `racr:` global identifier namespace and is stored as a complete immutable version snapshot with lifecycle state, ownership, risk classification, approval requirements, telemetry bindings, maintenance records, Digital Twin relationships, and lineage links.

### Supported enterprise asset coverage

RACR v1 explicitly supports the foundational racetrack asset catalog required by TrackMind Nexus:

- Physical infrastructure: starting gates, irrigation systems, track sectors, cameras, lighting systems, and ambulances.
- Biological and licensed participants: horses, jockeys, veterinarians, and stewards.
- Operational objects: race events, ticketing systems, wagering systems, and AI agents.
- Regulatory objects: regulatory records and compliance controls.

### Control guarantees

- **Schema validation:** required identifiers, tenants, owners, schema versions, telemetry bindings, and critical-asset approval policies are validated before write acceptance.
- **RBAC enforcement:** create, read, update, rollback, soft delete, approval, telemetry binding, and maintenance actions are role-gated.
- **Version history and rollback:** every mutation appends a new version, and rollback creates a new version from a prior snapshot rather than rewriting history.
- **Change auditing:** every accepted command records actor, action, version, timestamp, reason, and changed fields.
- **Soft deletes:** decommissioning moves assets into `deleted` lifecycle state while preserving history and auditability.
- **Event streams:** creation and update commands publish registry events for downstream Digital Twin, CQRS, compliance, and command-center consumers.
- **Lineage and twin relationships:** assets can link to parent assets, replacement chains, configuration sources, and Digital Twin nodes for traceable simulation and operational synchronization.

## Authoritative enterprise inventory envelope

RACR now treats every registered object as an authoritative inventory record across physical, digital, biological, operational, regulatory, and AI-agent domains. Each asset snapshot carries:

- A globally unique `racr:` identifier, tenant boundary, asset type, asset class, owner, accountable role, and immutable version metadata.
- A Digital Twin representation with model reference, twin identifier, state topic, optional command topic, simulation profile, and shadow state.
- Risk classification, approval requirements, approval decisions, operational state, health score, active incidents, and lifecycle controls for draft, active, retired, deleted, and exceptional states.
- Telemetry bindings, maintenance history, lineage, twin relationships, compliance mappings, governance controls, and API exposure metadata.

## API, event stream, and governance contract

The registry exposes command-oriented APIs for listing, creating, updating, telemetry binding, maintenance recording, approvals, state transitions, soft deletes, and rollback. Every accepted command appends a new immutable version, writes an audit entry, and publishes an event stream message so Digital Twin, CQRS projection, command-center, compliance, and AI-governance consumers can synchronize from the registry rather than maintaining parallel inventories.

Governance controls are enforced with role-based access control, critical-asset approval requirements, lifecycle entry and exit criteria, soft-delete preservation, version rollback, compliance mappings, and immutable audit evidence. The supported type catalog includes starting gates, irrigation systems, surface sectors, lighting systems, cameras, vehicles, emergency resources, horses, race events, regulatory records, AI agents, workflows, and a reserved future asset category for controlled expansion.
