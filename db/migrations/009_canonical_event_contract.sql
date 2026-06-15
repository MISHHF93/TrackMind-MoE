BEGIN;

ALTER TABLE trackmind.events
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'trackmind',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track',
  ADD COLUMN IF NOT EXISTS actor_id text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'trackmind-api',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_ref text,
  ADD COLUMN IF NOT EXISTS audit_ref text,
  ADD COLUMN IF NOT EXISTS digital_twin_ref text;

ALTER TABLE trackmind.events
  ADD CONSTRAINT events_canonical_event_type CHECK (event_type ~ '^[a-z][A-Za-z0-9-]*(\.[a-z][A-Za-z0-9-]*){2,}\.v[0-9]+$'),
  ADD CONSTRAINT events_canonical_version CHECK (version > 0),
  ADD CONSTRAINT events_canonical_scope CHECK (
    btrim(tenant_id) <> ''
    AND btrim(racetrack_id) <> ''
    AND btrim(actor_id) <> ''
    AND btrim(source) <> ''
  );

CREATE INDEX IF NOT EXISTS events_tenant_racetrack_timestamp_idx ON trackmind.events(tenant_id, racetrack_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_actor_source_idx ON trackmind.events(actor_id, source, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_version_type_idx ON trackmind.events(event_type, version);

COMMENT ON COLUMN trackmind.events.event_id IS 'Canonical eventId.';
COMMENT ON COLUMN trackmind.events.event_type IS 'Canonical eventType using context.entity.verb.vN naming.';
COMMENT ON COLUMN trackmind.events.tenant_id IS 'Canonical tenantId.';
COMMENT ON COLUMN trackmind.events.racetrack_id IS 'Canonical racetrackId.';
COMMENT ON COLUMN trackmind.events.actor_id IS 'Canonical actorId.';
COMMENT ON COLUMN trackmind.events.source IS 'Canonical source service or producer. source_service is retained as a compatibility column.';
COMMENT ON COLUMN trackmind.events."timestamp" IS 'Canonical timestamp.';
COMMENT ON COLUMN trackmind.events.payload IS 'Canonical payload.';
COMMENT ON COLUMN trackmind.events.version IS 'Canonical event schema version.';

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('009', 'Canonical event contract fields and naming constraints for event sourcing')
ON CONFLICT (version) DO NOTHING;

COMMIT;
