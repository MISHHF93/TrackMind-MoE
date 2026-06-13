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
