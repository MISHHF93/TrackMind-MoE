# TrackMind Nexus Vertical Slice Execution Prompts

## Purpose

These one-paragraph Codex execution prompts define coordinated vertical slices for incrementally building TrackMind Nexus. Each slice must be implemented by reading the repository first, preserving existing safety/governance boundaries, and adding tests that prove event, audit, approval, Digital Twin, permission, and frontend contract behavior where applicable.

## Prompt 1 — Race Office Vertical Slice

Read the repository first, then implement the Race Office vertical slice end to end. Add or update backend models, APIs, validation, persistence, events, audit records, approvals, and frontend screens for race meets, race days, race cards, race conditions, entries, declarations, scratches, post positions, and race readiness. Every race-office change must emit events, create audit records, synchronize with Digital Twin state where applicable, and require approval for safety-critical actions such as scratches, race status changes, official configuration changes, or race cancellation. Add tests for API contracts, lifecycle transitions, role permissions, approval-required actions, and frontend routing.

## Prompt 2 — Surface Intelligence Vertical Slice

Read the repository first, then implement the Surface Intelligence vertical slice across backend and frontend. Add models and APIs for track sectors, surface measurements, moisture, compaction, cushion depth, drainage, weather observations, maintenance recommendations, inspections, and surface condition scores. Wire all measurements to events, audit logs, Digital Twin state updates, and frontend heatmap-ready data structures. Build the Surface Intelligence workspace with status cards, sector table, measurement timeline, risk badges, recommendation panel, and mock-safe map overlay. Require approval for any operational action such as irrigation, harrowing, rolling, track closure recommendation, or surface configuration change.

## Prompt 3 — Equine Intelligence Vertical Slice

Read the repository first, then implement the Equine Intelligence vertical slice end to end. Add backend models, APIs, validation, events, audit records, approvals, and frontend screens for horse profiles, ownership, trainer assignment, race history, workout history, veterinary status placeholders, eligibility status, welfare status, barn assignment, and Digital Twin references. AI or system-generated equine risk recommendations must be advisory only and require veterinarian review before affecting operations. Add tests covering permissions, auditability, veterinarian-review requirements, frontend detail pages, and mock/live API adapter behavior.

## Prompt 4 — Barn Operations Vertical Slice

Read the repository first, then build Barn Operations as a coordinated frontend-backend module. Implement barns, stalls, horse occupancy, movement records, access records, inspections, restrictions, trainer assignments, veterinary visit records, and barn incident links. Wire all horse movement and stall assignment changes to events, audit records, Digital Twin updates, and approval policies where needed. Build frontend views for barn map/list, stall occupancy, horse movement timeline, access history, and barn readiness. Add tests for occupancy constraints, movement auditability, role permissions, and frontend rendering.

## Prompt 5 — Steward Center Vertical Slice

Read the repository first, then implement the Steward Center vertical slice. Add backend models and APIs for inquiries, objections, incidents under review, involved horses, involved jockeys, evidence references, rule references, decision drafts, final rulings, appeal packages, and audit records. Build frontend screens for inquiry queue, case detail, evidence timeline, rule reference panel, decision draft workflow, and approval/finalization controls. AI may summarize evidence and draft recommendations but must never issue official rulings or modify official results. Add tests enforcing human-only final rulings, audit trail completeness, and role-based access.

## Prompt 6 — Security Operations Vertical Slice

Read the repository first, then implement Security Operations end to end. Add backend models, APIs, events, audit records, and frontend screens for access-control events, restricted zones, camera assets, security incidents, investigations, watchlist placeholders, visitor logs, credential checks, and escalation workflows. Build dashboard widgets for active alerts, restricted-zone events, camera health, incident timeline, and investigation queue. Ensure privacy-sensitive fields are permission-protected and all security actions are auditable. Add tests for access control, event creation, sensitive data masking, and frontend incident workflows.

## Prompt 7 — Emergency Operations Vertical Slice

Read the repository first, then implement Emergency Operations across backend and frontend. Add models, APIs, workflows, events, audit records, and UI screens for emergency plans, incident command roles, emergency resources, medical response, fire response, severe weather response, evacuation zones, communication checklists, drills, and after-action reports. Emergency actions must support human override and must never be blocked by AI. Build command views with active emergency status, resource map, checklist progress, communication log, and audit timeline. Add tests for emergency workflow creation, role permissions, and audit/event generation.

## Prompt 8 — Compliance Control Library Vertical Slice

Read the repository first, then implement the Compliance Control Library. Add backend and frontend support for compliance frameworks, controls, obligations, evidence records, control owners, assessments, findings, corrective actions, review cycles, and audit readiness scores. Include initial framework placeholders for ISO 42001, ISO 27001, ISO 27701, ISO 31000, ISO 22301, SOC 2, PCI DSS, HISA, ARCI, and local racing commission rules. Wire evidence collection to audit records and workflows. Add tests for control lifecycle, evidence linking, owner permissions, and dashboard rendering.

## Prompt 9 — Responsible AI Governance Vertical Slice

Read the repository first, then implement Responsible AI Governance end to end. Add models, APIs, workflows, events, audit records, and frontend screens for AI agents, model versions, prompt templates, evaluations, recommendation records, risk classifications, approval requirements, evidence packages, overrides, rollback records, and monitoring metrics. Build an AI Governance workspace showing active agents, recommendation queue, safety-blocked actions, evaluation status, and audit trails. Enforce that every AI recommendation has evidence, confidence, affected assets, required approval policy, and traceable lineage. Add tests proving restricted actions cannot be executed by AI.

## Prompt 10 — Platform Observability Vertical Slice

Read the repository first, then implement Platform Observability across services and frontend. Add consistent logging, metrics, tracing, health checks, dependency reporting, event throughput metrics, Digital Twin sync status, workflow status, approval queue metrics, audit ledger metrics, API latency metrics, and frontend error reporting. Build a Platform Health workspace showing service health, event bus health, audit health, approval engine health, AI governance health, and Digital Twin health. Add tests for health endpoints, telemetry schema consistency, and frontend degraded-state behavior.
