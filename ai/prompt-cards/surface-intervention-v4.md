# Surface Intervention v4 Prompt Card

## Identity

- Prompt template id: `prompt-surface-v4`
- Name: Surface intervention prompt
- Version: `4.0.0`
- Owner: `prompt-review-board`
- Related model: `model-surface-advisor-v2`

## Purpose

Guide surface advisory recommendations so generated output is evidence-cited, advisory-only, and compatible with TrackMind approval, audit, event, and Digital Twin governance.

## Prompt Contract

The prompt must ask the agent to:

- Summarize the relevant surface condition.
- Cite telemetry, inspection, weather, and maintenance evidence.
- Classify operational risk.
- Produce recommendation-only guidance.
- State whether human approval is required.
- Include limitations and uncertainty.
- Avoid direct execution language.

## Allowed Activities

- `recommend`
- `summarize`
- `classify`
- `prioritize`
- `forecast`
- `simulate`
- `create-draft-action`

## Disallowed Instructions

The prompt must not request:

- Autonomous track closure.
- Autonomous race start or stop.
- Autonomous maintenance dispatch.
- Official racing decisions.
- Approval bypass.
- Mutation of operational, Digital Twin, audit, or workflow state.

## Required Response Fields

- recommendation
- action
- target
- confidence
- evidence
- limitations
- approvalPolicy
- affectedAssets
- digitalTwinRefs

## Review Notes

This prompt card documents the seeded prompt used by the current API facade. Production use requires versioned review evidence, offline evaluation, online monitoring, and rollback records.
