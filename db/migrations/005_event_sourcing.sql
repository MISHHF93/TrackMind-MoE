BEGIN;

CREATE TABLE trackmind.events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  source_service text NOT NULL,
  visibility trackmind.event_visibility NOT NULL DEFAULT 'internal',
  previous_hash text,
  created_by text NOT NULL,
  approved_by text,
  approval_timestamp timestamptz,
  immutable_hash_chain text UNIQUE,
  causation_id uuid,
  correlation_id uuid,
  CONSTRAINT event_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT approved_event_metadata CHECK (
    approved_by IS NULL OR approval_timestamp IS NOT NULL
  )
);

CREATE INDEX events_aggregate_timestamp_idx ON trackmind.events(aggregate_id, "timestamp" DESC);
CREATE INDEX events_type_timestamp_idx ON trackmind.events(event_type, "timestamp" DESC);
CREATE INDEX events_payload_gin_idx ON trackmind.events USING gin(payload);
CREATE INDEX events_correlation_idx ON trackmind.events(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION trackmind.assign_event_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior_hash text;
  hash_payload jsonb;
BEGIN
  SELECT e.immutable_hash_chain
    INTO prior_hash
  FROM trackmind.events e
  WHERE e.aggregate_id = NEW.aggregate_id
  ORDER BY e."timestamp" DESC, e.event_id DESC
  LIMIT 1;

  NEW.previous_hash := coalesce(NEW.previous_hash, prior_hash, 'GENESIS');
  hash_payload := jsonb_build_object(
    'event_id', NEW.event_id,
    'aggregate_id', NEW.aggregate_id,
    'event_type', NEW.event_type,
    'payload', NEW.payload,
    'timestamp', NEW."timestamp",
    'source_service', NEW.source_service,
    'created_by', NEW.created_by,
    'approved_by', NEW.approved_by,
    'approval_timestamp', NEW.approval_timestamp,
    'previous_hash', NEW.previous_hash
  );
  NEW.immutable_hash_chain := coalesce(
    NEW.immutable_hash_chain,
    trackmind.hash_payload(NEW.previous_hash, hash_payload, NEW."timestamp")
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trackmind.apply_event_to_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_state jsonb;
  next_entity_type trackmind.twin_entity_type;
  next_twin_id text;
  next_model_id text;
BEGIN
  next_state := coalesce(NEW.payload->'state', NEW.payload);

  IF EXISTS (SELECT 1 FROM trackmind.digital_twin_projection WHERE aggregate_id = NEW.aggregate_id) THEN
    UPDATE trackmind.digital_twin_projection
      SET current_state = next_state,
          version = version + 1,
          last_event_id = NEW.event_id,
          approved_by = coalesce(NEW.approved_by, approved_by),
          approval_timestamp = coalesce(NEW.approval_timestamp, approval_timestamp),
          immutable_hash_chain = NEW.immutable_hash_chain,
          updated_at = NEW."timestamp"
    WHERE aggregate_id = NEW.aggregate_id;
    RETURN NEW;
  END IF;

  next_entity_type := (NEW.payload->>'entity_type')::trackmind.twin_entity_type;
  next_twin_id := NEW.payload->>'twin_id';
  next_model_id := NEW.payload->>'dtdl_model_id';

  IF next_entity_type IS NULL OR next_twin_id IS NULL OR next_model_id IS NULL THEN
    RAISE EXCEPTION 'First event for aggregate % must include entity_type, twin_id, and dtdl_model_id', NEW.aggregate_id;
  END IF;

  INSERT INTO trackmind.digital_twin_projection (
    aggregate_id,
    twin_id,
    entity_type,
    dtdl_model_id,
    current_state,
    version,
    last_event_id,
    created_by,
    approved_by,
    approval_timestamp,
    immutable_hash_chain,
    created_at,
    updated_at
  ) VALUES (
    NEW.aggregate_id,
    next_twin_id,
    next_entity_type,
    next_model_id,
    next_state,
    1,
    NEW.event_id,
    NEW.created_by,
    NEW.approved_by,
    NEW.approval_timestamp,
    NEW.immutable_hash_chain,
    NEW."timestamp",
    NEW."timestamp"
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER events_assign_hash_chain
BEFORE INSERT ON trackmind.events
FOR EACH ROW EXECUTE FUNCTION trackmind.assign_event_hash_chain();

CREATE TRIGGER events_apply_projection
AFTER INSERT ON trackmind.events
FOR EACH ROW EXECUTE FUNCTION trackmind.apply_event_to_projection();

CREATE TRIGGER events_immutable
BEFORE UPDATE OR DELETE ON trackmind.events
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

ALTER TABLE trackmind.digital_twin_projection
  ADD CONSTRAINT digital_twin_projection_last_event_fk
  FOREIGN KEY (last_event_id) REFERENCES trackmind.events(event_id) DEFERRABLE INITIALLY DEFERRED;

CREATE MATERIALIZED VIEW trackmind.digital_twin_current_state AS
SELECT
  p.aggregate_id,
  p.twin_id,
  p.entity_type,
  p.dtdl_model_id,
  p.current_state,
  p.version,
  p.last_event_id,
  p.updated_at,
  p.created_by,
  p.approved_by,
  p.approval_timestamp,
  p.immutable_hash_chain
FROM trackmind.digital_twin_projection p
WITH NO DATA;

CREATE UNIQUE INDEX digital_twin_current_state_pk ON trackmind.digital_twin_current_state(aggregate_id);
CREATE INDEX digital_twin_current_state_entity_idx ON trackmind.digital_twin_current_state(entity_type, version DESC);

CREATE MATERIALIZED VIEW trackmind.current_horse_twins AS
SELECT
  p.aggregate_id,
  p.twin_id,
  p.current_state->>'registered_name' AS registered_name,
  p.current_state->>'welfare_status' AS welfare_status,
  p.version,
  p.updated_at,
  p.immutable_hash_chain
FROM trackmind.digital_twin_projection p
WHERE p.entity_type = 'Horse'
WITH NO DATA;

CREATE UNIQUE INDEX current_horse_twins_pk ON trackmind.current_horse_twins(aggregate_id);

CREATE MATERIALIZED VIEW trackmind.current_race_twins AS
SELECT
  p.aggregate_id,
  p.twin_id,
  p.current_state->>'status' AS status,
  (p.current_state->>'race_number')::int AS race_number,
  p.current_state->>'racetrack_twin_id' AS racetrack_twin_id,
  p.version,
  p.updated_at,
  p.immutable_hash_chain
FROM trackmind.digital_twin_projection p
WHERE p.entity_type = 'Race'
WITH NO DATA;

CREATE UNIQUE INDEX current_race_twins_pk ON trackmind.current_race_twins(aggregate_id);

CREATE OR REPLACE FUNCTION trackmind.refresh_current_state_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW trackmind.digital_twin_current_state;
  REFRESH MATERIALIZED VIEW trackmind.current_horse_twins;
  REFRESH MATERIALIZED VIEW trackmind.current_race_twins;
END;
$$;

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('005', 'Immutable event sourcing table, hash chain trigger, projection updater, and current-state materialized views')
ON CONFLICT (version) DO NOTHING;

COMMIT;
