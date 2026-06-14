# TrackMind Unified AI/ML Control Plane

TrackMind's Unified AI/ML Machine is documented as a governed control plane, not as proof that real model training or production Azure deployment is complete. The current repository models contracts, metadata, safety controls, observability signals, and UI surfaces that keep AI advisory and human-governed.

## Control Plane Flow

Inputs -> Feature Store -> Model Registry -> Expert Models -> AI Governor -> Approved Outputs.

1. **Inputs** collect tenant-scoped race-day readiness, surface, equine, stewarding, security, weather, facilities, workforce, audit, event, and Digital Twin context through typed DTOs and event envelopes.
2. **Feature Store** metadata preserves feature-set IDs, lineage, input quality, stale-input flags, evidence references, and tenant/racetrack scope.
3. **Model Registry** records model cards, owners, intended use, prohibited use, risk level, evaluation status, approval state, rollback evidence, and monitoring thresholds.
4. **Expert Models** represent domain-specific advisory modules for surface risk, race readiness, equine welfare, gate position, steward evidence support, security anomaly review, weather impact, facilities maintenance, and executive intelligence.
5. **AI Governor** applies protected-action policy, confidence calibration, explainability requirements, approval requirements, blocked-action decisions, audit events, and safety evidence.
6. **Approved Outputs** remain draft or advisory until a backend human approval workflow produces an approval token, immutable audit evidence, event records, and any queued Digital Twin impact metadata.

## Governance Anchors

The control plane is anchored to **ISO/IEC 42001** as the AI management system reference for accountable ownership, lifecycle controls, intended/prohibited use, human oversight, management review evidence, and continuous monitoring.

It is also anchored to the **NIST AI RMF** for trustworthy AI risk management: govern policy and accountability, map operational context and affected assets, measure confidence/explainability/safety/quality signals, and manage risk through approval gates, blocking controls, monitoring, overrides, and rollback evidence.

## Observability Metadata

Platform health and Nexus upgrade metadata track these AI control-plane signals:

- `ai_input_throughput`: governed AI input volume from typed DTOs/events.
- `ai_feature_build_count`: feature-set metadata builds with lineage and evidence.
- `ai_model_selection_count`: selected model/expert-module count for recommendations.
- `ai_recommendation_count`: advisory recommendation records produced.
- `ai_blocked_action_count`: protected or unsafe AI actions blocked by the governor.
- `ai_approval_required_count`: recommendations requiring human approval.
- `ai_adjusted_confidence_distribution`: low/medium/high calibrated confidence buckets.
- `ai_stale_low_quality_input_count`: stale, missing-evidence, or low-quality input signals.
- `ai_event_sync_status`: event bus alignment for AI control-plane events.
- `ai_audit_sync_status`: audit ledger alignment for AI decisions and denials.
- `ai_twin_sync_status`: Digital Twin impact queue/synchronization posture.

## Digital Twin Alignment

Azure Digital Twins is the suitable modeling and synchronization target for AI-agent, workflow, approval, asset, incident, and racetrack context when TrackMind is deployed on Azure. In this repository, AI control-plane metadata connects to the existing `DigitalTwinReference` and Digital Twin runtime abstractions and does not assert that a production Azure Digital Twins deployment is complete.

## Safety Boundary

AI may recommend, summarize, classify, forecast, simulate, and draft. AI may not autonomously start or stop races, declare or modify official results, scratch horses, clear veterinary flags, issue steward rulings, trigger payouts, override emergency personnel, or execute safety-critical controls. Protected outputs require explicit authorized human approval before backend execution.
