# TrackMind Nexus Implementation Traceability

This manifest maps the vertical-slice execution prompts to current reference implementations, API routes, tests, and known extraction gaps. It is intentionally descriptive: production services must still preserve approval gates, immutable audit trails, event lineage, tenant isolation, and advisory-only AI boundaries.

| Prompt | Current Code | Runtime Route | Tests | Remaining Gap |
| --- | --- | --- | --- | --- |
| Race Office | `apps/api/src/raceOperationsPlatform.ts`; surfaced through `apps/frontend/src/routes/routes.ts` and `apps/frontend/src/api/services.ts` | `/api/v1/race-operations/race-office` | `apps/api/tests/race-office-vertical-slice.test.mjs`, `apps/api/tests/race-operations-platform.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Extract standalone `services/race-operations` runtime and replace any placeholder facade fields with service read models. |
| Surface Intelligence | `apps/api/src/trackSurface.ts`; legacy `/surface-intelligence` alias routes to the Race Day shell | `/api/v1/surface-intelligence/workspace`, `/api/v1/track-surface/measurements` | `apps/api/tests/surface-intelligence.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Governed live weather/provider integration remains placeholder-labeled; frontend does not yet load this route directly. |
| Equine Intelligence | `apps/api/src/equineIntelligencePlatform.ts`, `apps/api/src/services/equine`, `apps/frontend/src/api/services.ts` | `/api/v1/horses/{id}/*`, `/api/v1/equine-intelligence/horses/{id}` | `apps/api/tests/equine-privacy-api.test.mjs`, `apps/api/tests/equine-four-layer-platform.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Keep veterinary privacy scope server-side; frontend shows restricted status by default. |
| Barn Operations | `apps/api/src/barnOperations.ts`; legacy `/barns` and `/barn-operations` aliases route to the Equine shell | `/api/v1/barn-operations/workspace` | `apps/api/tests/barn-operations.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Extract standalone service and wire the frontend adapter when the dedicated barn read model is ready. |
| Steward Center | `apps/api/src/stewarding.ts`, `apps/api/src/services/stewardingService.ts` | `/api/v1/stewarding/inquiries`, `/api/v1/services/stewarding/*` | `apps/api/tests/stewarding-center.test.mjs`, `apps/api/tests/apex-domain-services.test.mjs` | Harden final-ruling backend invariants and move stewarding out of compatibility-rendered dashboard sections. |
| Security Operations | `apps/api/src/securityOps.ts`, `apps/api/src/services/securityService.ts`, `apps/frontend/src/api/services.ts` | `/api/v1/security-operations/workspace`, `/api/v1/services/security/*` | `apps/api/tests/security-ops-end-to-end.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Extract standalone `services/security` if needed and add deeper route-level masking tests. |
| Emergency Operations | `apps/api/src/emergencyOperations.ts`, `apps/api/src/services/safetyService.ts` | `/api/v1/emergency-operations/workspace`, `/api/v1/services/safety/emergency-actions` | `apps/api/tests/emergency-operations.test.mjs`, `apps/api/tests/apex-domain-services.test.mjs` | Add emergency-native mutation routes with command-role enforcement and post-action evidence semantics. |
| Compliance Control Library | `apps/api/src/complianceControlLibrary.ts`, `apps/api/src/compliance` | `/api/v1/compliance/control-library`, `/api/v1/compliance/*` | `apps/api/tests/compliance-control-library.test.mjs`, `apps/api/tests/ai-act-compliance-framework.test.mjs` | Add shared contract schema for control-library DTO and complete corrective-action lifecycle methods. |
| Responsible AI Governance | `apps/api/src/responsibleAiGovernor.ts`, `apps/api/src/aiControlPlane.ts`, `apps/agents/router`, `apps/frontend/src/pages/WorkspacePage.tsx` | `/api/v1/ai-governance/workspace`, `/api/v1/ai-control-plane/*`, router endpoints | `apps/api/tests/responsible-ai-governance-end-to-end.test.mjs`, `apps/api/tests/ai-control-plane.test.mjs`, `apps/agents/router/tests`, `apps/frontend/tests/frontend-contracts.test.mjs` | Add first-class model cards and prompt cards beyond evidence string references; frontend actions remain disabled until governed endpoints exist. |
| Platform Observability | `apps/api/src/platformObservability.ts`, `apps/frontend/src/api/services.ts` | `/api/v1/platform/health` | `apps/api/tests/platform-observability.test.mjs`, `apps/api/tests/runtime-server.test.mjs`, `apps/frontend/tests/frontend-contracts.test.mjs` | Wire production Azure telemetry dashboards and live dependency checks. |

## Bounded-Context Service Scaffolds

Contract-only scaffolds now exist under:

- `services/events`
- `services/barn-operations`
- `services/race-operations`
- `services/safety`
- `services/stewarding`
- `services/tenant`

These folders are not production runtimes yet. Their `service.catalog.yaml` files point to current reference implementations and declare the protected actions that must remain approval-gated during extraction.
