BEGIN;

ALTER TABLE trackmind.events
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'administrative',
  ADD COLUMN IF NOT EXISTS ai_model_id text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS evidence_links text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS annex_iv_uri text,
  ADD COLUMN IF NOT EXISTS approval_id uuid;

ALTER TABLE trackmind.events
  ADD CONSTRAINT events_category_allowed CHECK (event_category IN ('safety-critical', 'monitoring', 'administrative')),
  ADD CONSTRAINT events_ai_metadata_complete CHECK (
    ai_model_id IS NULL OR (
      ai_confidence IS NOT NULL
      AND ai_confidence >= 0
      AND ai_confidence <= 1
      AND cardinality(evidence_links) > 0
    )
  ),
  ADD CONSTRAINT events_safety_critical_governance CHECK (
    event_category <> 'safety-critical'
    OR (approval_id IS NOT NULL AND approved_by IS NOT NULL AND approval_timestamp IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS events_category_timestamp_idx ON trackmind.events(event_category, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_ai_model_timestamp_idx ON trackmind.events(ai_model_id, "timestamp" DESC) WHERE ai_model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_evidence_links_gin_idx ON trackmind.events USING gin(evidence_links);

CREATE OR REPLACE FUNCTION trackmind.enforce_safety_critical_event_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type IN (
    'race_start',
    'race_stop',
    'emergency_action',
    'scratch_decision',
    'medication_admin',
    'RaceStartedEvent',
    'RaceStoppedEvent',
    'HorseScratchedEvent',
    'MedicationAdministeredEvent',
    'IncidentReportedEvent'
  ) THEN
    NEW.event_category := 'safety-critical';
  END IF;

  IF NEW.event_type IN ('sensor_reading', 'camera_detection', 'location_update', 'SensorReadingEvent', 'CameraDetectionEvent', 'LocationUpdatedEvent') THEN
    NEW.event_category := 'monitoring';
  END IF;

  IF NEW.event_category = 'safety-critical' AND (NEW.approval_id IS NULL OR NEW.approved_by IS NULL OR NEW.approval_timestamp IS NULL) THEN
    RAISE EXCEPTION 'Safety-critical event % requires approval_id, approved_by, and approval_timestamp', NEW.event_type;
  END IF;

  IF NEW.ai_model_id IS NOT NULL AND (NEW.ai_confidence IS NULL OR cardinality(NEW.evidence_links) = 0) THEN
    RAISE EXCEPTION 'AI event % requires ai_confidence and evidence_links', NEW.event_type;
  END IF;

  RETURN NEW;
END;
$$;

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
    'event_category', NEW.event_category,
    'payload', NEW.payload,
    'timestamp', NEW."timestamp",
    'source_service', NEW.source_service,
    'created_by', NEW.created_by,
    'approved_by', NEW.approved_by,
    'approval_timestamp', NEW.approval_timestamp,
    'approval_id', NEW.approval_id,
    'ai_model_id', NEW.ai_model_id,
    'ai_confidence', NEW.ai_confidence,
    'evidence_links', NEW.evidence_links,
    'annex_iv_uri', NEW.annex_iv_uri,
    'previous_hash', NEW.previous_hash
  );
  NEW.immutable_hash_chain := coalesce(
    NEW.immutable_hash_chain,
    trackmind.hash_payload(NEW.previous_hash, hash_payload, NEW."timestamp")
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_00_enforce_safety_critical_metadata
BEFORE INSERT ON trackmind.events
FOR EACH ROW EXECUTE FUNCTION trackmind.enforce_safety_critical_event_metadata();

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
  IF EXISTS (SELECT 1 FROM trackmind.digital_twin_projection WHERE aggregate_id = NEW.aggregate_id) THEN
    IF NOT (NEW.payload ? 'state') THEN
      RETURN NEW;
    END IF;

    UPDATE trackmind.digital_twin_projection
      SET current_state = NEW.payload->'state',
          version = version + 1,
          last_event_id = NEW.event_id,
          approved_by = coalesce(NEW.approved_by, approved_by),
          approval_timestamp = coalesce(NEW.approval_timestamp, approval_timestamp),
          immutable_hash_chain = NEW.immutable_hash_chain,
          updated_at = NEW."timestamp"
    WHERE aggregate_id = NEW.aggregate_id;
    RETURN NEW;
  END IF;

  next_entity_type := NULLIF(NEW.payload->>'entity_type', '')::trackmind.twin_entity_type;
  next_twin_id := NEW.payload->>'twin_id';
  next_model_id := NEW.payload->>'dtdl_model_id';

  IF next_entity_type IS NULL OR next_twin_id IS NULL OR next_model_id IS NULL THEN
    RETURN NEW;
  END IF;

  next_state := coalesce(NEW.payload->'state', NEW.payload);

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

CREATE TABLE IF NOT EXISTS trackmind.current_race_state_projection (
  race_id uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  status text NOT NULL,
  active_horse_ids uuid[] NOT NULL DEFAULT '{}',
  scratched_horse_ids uuid[] NOT NULL DEFAULT '{}',
  incident_ids uuid[] NOT NULL DEFAULT '{}',
  last_event_id uuid NOT NULL REFERENCES trackmind.events(event_id),
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL
);

CREATE TABLE IF NOT EXISTS trackmind.horse_location_history_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id uuid NOT NULL,
  zone_id text NOT NULL,
  latitude numeric(10,7),
  longitude numeric(10,7),
  observed_at timestamptz NOT NULL,
  source_event_id uuid NOT NULL REFERENCES trackmind.events(event_id),
  immutable_hash_chain text NOT NULL
);

CREATE INDEX IF NOT EXISTS horse_location_history_horse_idx ON trackmind.horse_location_history_projection(horse_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS horse_location_history_zone_idx ON trackmind.horse_location_history_projection(zone_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS trackmind.security_zone_occupancy_projection (
  zone_id text PRIMARY KEY,
  occupant_ids text[] NOT NULL DEFAULT '{}',
  active_incident_ids uuid[] NOT NULL DEFAULT '{}',
  latest_camera_event_id uuid REFERENCES trackmind.events(event_id),
  last_observed_at timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL
);

CREATE OR REPLACE FUNCTION trackmind.apply_race_day_event_to_projections()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  race_uuid uuid;
  horse_uuid uuid;
  incident_uuid uuid;
  zone text;
  occupant text;
BEGIN
  IF NEW.event_type IN ('race_start', 'RaceStartedEvent') THEN
    race_uuid := coalesce((NEW.payload->>'raceId')::uuid, NEW.aggregate_id);
    INSERT INTO trackmind.current_race_state_projection(race_id, aggregate_id, status, last_event_id, updated_at, immutable_hash_chain)
    VALUES (race_uuid, NEW.aggregate_id, 'running', NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
    ON CONFLICT (race_id) DO UPDATE
      SET status = 'running',
          last_event_id = EXCLUDED.last_event_id,
          version = trackmind.current_race_state_projection.version + 1,
          updated_at = EXCLUDED.updated_at,
          immutable_hash_chain = EXCLUDED.immutable_hash_chain;
  END IF;

  IF NEW.event_type IN ('race_stop', 'RaceStoppedEvent') THEN
    race_uuid := coalesce((NEW.payload->>'raceId')::uuid, NEW.aggregate_id);
    INSERT INTO trackmind.current_race_state_projection(race_id, aggregate_id, status, last_event_id, updated_at, immutable_hash_chain)
    VALUES (race_uuid, NEW.aggregate_id, 'stopped', NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
    ON CONFLICT (race_id) DO UPDATE
      SET status = 'stopped',
          last_event_id = EXCLUDED.last_event_id,
          version = trackmind.current_race_state_projection.version + 1,
          updated_at = EXCLUDED.updated_at,
          immutable_hash_chain = EXCLUDED.immutable_hash_chain;
  END IF;

  IF NEW.event_type IN ('scratch_decision', 'HorseScratchedEvent') THEN
    race_uuid := coalesce((NEW.payload->>'raceId')::uuid, NEW.aggregate_id);
    horse_uuid := (NEW.payload->>'horseId')::uuid;
    INSERT INTO trackmind.current_race_state_projection(race_id, aggregate_id, status, scratched_horse_ids, last_event_id, updated_at, immutable_hash_chain)
    VALUES (race_uuid, NEW.aggregate_id, 'scheduled', ARRAY[horse_uuid], NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
    ON CONFLICT (race_id) DO UPDATE
      SET scratched_horse_ids = array(SELECT DISTINCT unnest(trackmind.current_race_state_projection.scratched_horse_ids || horse_uuid)),
          active_horse_ids = array_remove(trackmind.current_race_state_projection.active_horse_ids, horse_uuid),
          last_event_id = EXCLUDED.last_event_id,
          version = trackmind.current_race_state_projection.version + 1,
          updated_at = EXCLUDED.updated_at,
          immutable_hash_chain = EXCLUDED.immutable_hash_chain;
  END IF;

  IF NEW.event_type IN ('emergency_action', 'IncidentReportedEvent') THEN
    incident_uuid := coalesce((NEW.payload->>'incidentId')::uuid, NEW.event_id);
    race_uuid := NULLIF(NEW.payload->>'raceId', '')::uuid;
    zone := NEW.payload->>'zoneId';
    IF race_uuid IS NOT NULL THEN
      INSERT INTO trackmind.current_race_state_projection(race_id, aggregate_id, status, incident_ids, last_event_id, updated_at, immutable_hash_chain)
      VALUES (race_uuid, NEW.aggregate_id, 'scheduled', ARRAY[incident_uuid], NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (race_id) DO UPDATE
        SET incident_ids = array(SELECT DISTINCT unnest(trackmind.current_race_state_projection.incident_ids || incident_uuid)),
            last_event_id = EXCLUDED.last_event_id,
            version = trackmind.current_race_state_projection.version + 1,
            updated_at = EXCLUDED.updated_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
    IF zone IS NOT NULL THEN
      INSERT INTO trackmind.security_zone_occupancy_projection(zone_id, active_incident_ids, last_observed_at, immutable_hash_chain)
      VALUES (zone, ARRAY[incident_uuid], NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (zone_id) DO UPDATE
        SET active_incident_ids = array(SELECT DISTINCT unnest(trackmind.security_zone_occupancy_projection.active_incident_ids || incident_uuid)),
            last_observed_at = EXCLUDED.last_observed_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
  END IF;

  IF NEW.event_type IN ('location_update', 'LocationUpdatedEvent') THEN
    horse_uuid := NULLIF(NEW.payload->>'horseId', '')::uuid;
    zone := NEW.payload->>'zoneId';
    occupant := coalesce(NEW.payload->>'horseId', NEW.payload->>'personId', NEW.payload->>'subjectId');
    IF horse_uuid IS NOT NULL AND zone IS NOT NULL THEN
      INSERT INTO trackmind.horse_location_history_projection(horse_id, zone_id, latitude, longitude, observed_at, source_event_id, immutable_hash_chain)
      VALUES (horse_uuid, zone, (NEW.payload->>'latitude')::numeric, (NEW.payload->>'longitude')::numeric, NEW."timestamp", NEW.event_id, NEW.immutable_hash_chain);
    END IF;
    IF zone IS NOT NULL AND occupant IS NOT NULL THEN
      INSERT INTO trackmind.security_zone_occupancy_projection(zone_id, occupant_ids, latest_camera_event_id, last_observed_at, immutable_hash_chain)
      VALUES (zone, ARRAY[occupant], NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (zone_id) DO UPDATE
        SET occupant_ids = array(SELECT DISTINCT unnest(trackmind.security_zone_occupancy_projection.occupant_ids || occupant)),
            latest_camera_event_id = EXCLUDED.latest_camera_event_id,
            last_observed_at = EXCLUDED.last_observed_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER events_apply_race_day_projections
AFTER INSERT ON trackmind.events
FOR EACH ROW EXECUTE FUNCTION trackmind.apply_race_day_event_to_projections();

CREATE OR REPLACE FUNCTION trackmind.verify_event_hash_chain()
RETURNS TABLE(event_id uuid, aggregate_id uuid, valid boolean, reason text)
LANGUAGE sql
AS $$
  WITH ordered AS (
    SELECT
      e.*,
      lag(e.immutable_hash_chain) OVER (PARTITION BY e.aggregate_id ORDER BY e."timestamp", e.event_id) AS expected_previous_hash,
      trackmind.hash_payload(
        e.previous_hash,
        jsonb_build_object(
          'event_id', e.event_id,
          'aggregate_id', e.aggregate_id,
          'event_type', e.event_type,
          'event_category', e.event_category,
          'payload', e.payload,
          'timestamp', e."timestamp",
          'source_service', e.source_service,
          'created_by', e.created_by,
          'approved_by', e.approved_by,
          'approval_timestamp', e.approval_timestamp,
          'approval_id', e.approval_id,
          'ai_model_id', e.ai_model_id,
          'ai_confidence', e.ai_confidence,
          'evidence_links', e.evidence_links,
          'annex_iv_uri', e.annex_iv_uri,
          'previous_hash', e.previous_hash
        ),
        e."timestamp"
      ) AS expected_event_hash,
      trackmind.hash_payload(
        e.previous_hash,
        jsonb_build_object(
          'event_id', e.event_id,
          'aggregate_id', e.aggregate_id,
          'event_type', e.event_type,
          'payload', e.payload,
          'timestamp', e."timestamp",
          'source_service', e.source_service,
          'created_by', e.created_by,
          'approved_by', e.approved_by,
          'approval_timestamp', e.approval_timestamp,
          'previous_hash', e.previous_hash
        ),
        e."timestamp"
      ) AS legacy_expected_event_hash
    FROM trackmind.events e
  )
  SELECT
    event_id,
    aggregate_id,
    previous_hash = coalesce(expected_previous_hash, 'GENESIS')
      AND immutable_hash_chain IN (expected_event_hash, legacy_expected_event_hash) AS valid,
    CASE
      WHEN previous_hash <> coalesce(expected_previous_hash, 'GENESIS') THEN 'previous-hash-mismatch'
      WHEN immutable_hash_chain NOT IN (expected_event_hash, legacy_expected_event_hash) THEN 'event-hash-mismatch'
      WHEN previous_hash = coalesce(expected_previous_hash, 'GENESIS') AND immutable_hash_chain IN (expected_event_hash, legacy_expected_event_hash) THEN 'ok'
      ELSE 'previous-hash-mismatch'
    END AS reason
  FROM ordered;
$$;

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('006', 'CQRS race-day projections, AI metadata, governance checks, and event hash-chain verification')
ON CONFLICT (version) DO NOTHING;

COMMIT;
