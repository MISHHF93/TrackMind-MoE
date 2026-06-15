# Surface Advisor v2 Model Card

## Identity

- Model id: `model-surface-advisor-v2`
- Name: Surface Advisor
- Version: `2.0.0`
- Owner: `ai-governance`
- Criticality: safety-critical advisory
- Runtime reference: `apps/api/src/server.ts`, `apps/api/src/aiControlPlane.ts`, `apps/api/src/responsibleAiGovernor.ts`

## Intended Use

Surface Advisor supports track-superintendent and race-day command workflows by recommending surface inspections, maintenance prioritization, and draft work orders from labelled telemetry and inspection evidence.

Allowed activities:

- Recommend.
- Summarize.
- Classify.
- Prioritize.
- Forecast.
- Simulate.
- Create draft actions that require human approval.

## Prohibited Use

The model must not autonomously:

- Close or reopen a track.
- Start, stop, cancel, or release a race.
- Dispatch equipment.
- Override steward, veterinarian, race-office, security, or emergency authority.
- Mutate Digital Twin, workflow, audit, approval, or official racing records.

## Inputs

- Surface telemetry such as moisture, compaction, cushion depth, drainage, temperature, rainfall, and sensor warnings.
- Inspection records and observations.
- Weather observations and forecasts.
- Maintenance records.
- Digital Twin references for track sectors and surface sensors.

## Outputs

Each output must include:

- `recommendationId`
- `modelVersion`
- `generatedAt`
- confidence score and drivers
- evidence refs
- approval requirement
- audit refs
- event refs
- Digital Twin refs
- limitations

## Governance

Human review is required for any protected or operational action. The TypeScript API governance layer is the system of record for approval requirements, audit references, event references, and dashboard DTOs.

## Known Limitations

- Current repo implementation is seeded facade data, not a trained production model deployment.
- External weather, sensor, and provider integrations are not production-wired in this repository.
- Evaluation values in the seeded workspace are readiness metadata and must not be presented as formal certification.
