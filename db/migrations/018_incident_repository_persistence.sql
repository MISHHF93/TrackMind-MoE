BEGIN;

-- Incident lifecycle records persist via trackmind.repository_records namespaces:
--   platform.incidents          — IncidentDto JSONB payloads (create/update/triage/review)
--   platform.incident-reviews   — PostIncidentReviewDto JSONB payloads
-- Table and indexes were provisioned in 017_repository_persistence.sql.

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('018', 'Phase 3 Swarm 07 durable incident store via repository_records namespaces')
ON CONFLICT (version) DO NOTHING;

COMMIT;
