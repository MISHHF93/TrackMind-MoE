BEGIN;

CREATE OR REPLACE FUNCTION trackmind.logical_id_from_twin(twin text, fallback text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(nullif(regexp_replace(coalesce(twin, ''), '^twin:[^:]+:', ''), ''), fallback);
$$;

ALTER TABLE trackmind.events
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network';

CREATE OR REPLACE FUNCTION trackmind.normalize_canonical_event_storage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.organization_id := coalesce(nullif(NEW.payload->>'organizationId', ''), nullif(NEW.payload->>'organization_id', ''), nullif(NEW.organization_id, ''), 'org-trackmind-network');
  NEW.tenant_id := coalesce(nullif(NEW.payload->>'tenantId', ''), nullif(NEW.payload->>'tenant_id', ''), nullif(NEW.tenant_id, ''), 'trackmind');
  NEW.racetrack_id := coalesce(nullif(NEW.payload->>'racetrackId', ''), nullif(NEW.payload->>'racetrack_id', ''), nullif(NEW.racetrack_id, ''), 'main-track');
  NEW.actor_id := coalesce(nullif(NEW.payload->>'actorId', ''), nullif(NEW.payload->>'actor_id', ''), nullif(NEW.actor_id, ''), nullif(NEW.created_by, ''), 'system');
  NEW.source := coalesce(nullif(NEW.source_service, ''), nullif(NEW.source, ''), 'trackmind-api');
  NEW.source_service := coalesce(nullif(NEW.source_service, ''), NEW.source);
  NEW.version := coalesce(NEW.version, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_00_normalize_canonical_storage ON trackmind.events;
CREATE TRIGGER events_00_normalize_canonical_storage
BEFORE INSERT ON trackmind.events
FOR EACH ROW EXECUTE FUNCTION trackmind.normalize_canonical_event_storage();

CREATE INDEX IF NOT EXISTS events_organization_tenant_racetrack_idx ON trackmind.events(organization_id, tenant_id, racetrack_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_canonical_refs_idx ON trackmind.events(tenant_id, racetrack_id, approval_ref, audit_ref) WHERE approval_ref IS NOT NULL OR audit_ref IS NOT NULL;

COMMENT ON COLUMN trackmind.events.organization_id IS 'Canonical organizationId for tenant-scoped storage; event payload remains the source of event-specific data.';
COMMENT ON COLUMN trackmind.events.source_service IS 'Compatibility producer column. Canonical producer is trackmind.events.source.';
COMMENT ON COLUMN trackmind.events.approval_id IS 'Compatibility UUID approval column. Canonical approval linkage is approval_ref and audit_approval_reference.';

ALTER TABLE trackmind.digital_twin_projection
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text;

UPDATE trackmind.digital_twin_projection
SET
  organization_id = coalesce(nullif(organization_id, ''), nullif(current_state->>'organizationId', ''), 'org-trackmind-network'),
  tenant_id = coalesce(nullif(tenant_id, ''), nullif(current_state->>'tenantId', ''), 'trackmind'),
  racetrack_id = coalesce(nullif(racetrack_id, ''), nullif(current_state->>'racetrackId', ''), nullif(current_state->>'racetrack_id', ''), 'main-track');

ALTER TABLE trackmind.digital_twin_projection
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ADD CONSTRAINT digital_twin_projection_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS digital_twin_projection_scope_twin_idx ON trackmind.digital_twin_projection(tenant_id, racetrack_id, twin_id);
CREATE INDEX IF NOT EXISTS digital_twin_projection_scope_entity_idx ON trackmind.digital_twin_projection(tenant_id, racetrack_id, entity_type, updated_at DESC);

ALTER TABLE trackmind.racetracks
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text;
ALTER TABLE trackmind.racetracks DISABLE TRIGGER USER;
UPDATE trackmind.racetracks
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), trackmind.logical_id_from_twin(twin_id, aggregate_id::text));
ALTER TABLE trackmind.racetracks ENABLE TRIGGER USER;
ALTER TABLE trackmind.racetracks
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ADD CONSTRAINT racetracks_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS racetracks_tenant_racetrack_id_idx ON trackmind.racetracks(tenant_id, racetrack_id);

ALTER TABLE trackmind.persons
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS person_id text;
ALTER TABLE trackmind.persons DISABLE TRIGGER USER;
UPDATE trackmind.persons
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    person_id = coalesce(nullif(person_id, ''), trackmind.logical_id_from_twin(twin_id, aggregate_id::text));
ALTER TABLE trackmind.persons ENABLE TRIGGER USER;
ALTER TABLE trackmind.persons
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN person_id SET NOT NULL,
  ADD CONSTRAINT persons_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(person_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS persons_scope_person_id_idx ON trackmind.persons(tenant_id, racetrack_id, person_id);

ALTER TABLE trackmind.horses
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS horse_id text;
ALTER TABLE trackmind.horses DISABLE TRIGGER USER;
UPDATE trackmind.horses
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    horse_id = coalesce(nullif(horse_id, ''), trackmind.logical_id_from_twin(twin_id, aggregate_id::text));
ALTER TABLE trackmind.horses ENABLE TRIGGER USER;
ALTER TABLE trackmind.horses
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN horse_id SET NOT NULL,
  ADD CONSTRAINT horses_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(horse_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS horses_scope_horse_id_idx ON trackmind.horses(tenant_id, racetrack_id, horse_id);
CREATE INDEX IF NOT EXISTS horses_scope_status_idx ON trackmind.horses(tenant_id, racetrack_id, welfare_status);

ALTER TABLE trackmind.races
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS race_id text,
  ADD COLUMN IF NOT EXISTS race_day_id text,
  ADD COLUMN IF NOT EXISTS race_meet_id text;
ALTER TABLE trackmind.races DISABLE TRIGGER USER;
UPDATE trackmind.races r
SET organization_id = coalesce(nullif(r.organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(r.tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(r.racetrack_id, ''), rt.racetrack_id, 'main-track'),
    race_id = coalesce(nullif(r.race_id, ''), trackmind.logical_id_from_twin(r.twin_id, r.aggregate_id::text)),
    race_day_id = coalesce(nullif(r.race_day_id, ''), r.race_date::text)
FROM trackmind.racetracks rt
WHERE rt.aggregate_id = r.racetrack_aggregate_id;
UPDATE trackmind.races
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    race_id = coalesce(nullif(race_id, ''), trackmind.logical_id_from_twin(twin_id, aggregate_id::text)),
    race_day_id = coalesce(nullif(race_day_id, ''), race_date::text);
ALTER TABLE trackmind.races ENABLE TRIGGER USER;
ALTER TABLE trackmind.races
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN race_id SET NOT NULL,
  ALTER COLUMN race_day_id SET NOT NULL,
  ADD CONSTRAINT races_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(race_id) <> '' AND btrim(race_day_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS races_scope_race_id_idx ON trackmind.races(tenant_id, racetrack_id, race_id);
CREATE INDEX IF NOT EXISTS races_scope_day_idx ON trackmind.races(tenant_id, racetrack_id, race_day_id, race_number);

ALTER TABLE trackmind.restricted_zones
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS zone_id text;
ALTER TABLE trackmind.restricted_zones DISABLE TRIGGER USER;
UPDATE trackmind.restricted_zones z
SET organization_id = coalesce(nullif(z.organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(z.tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(z.racetrack_id, ''), rt.racetrack_id, 'main-track'),
    zone_id = coalesce(nullif(z.zone_id, ''), trackmind.logical_id_from_twin(z.twin_id, z.zone_code))
FROM trackmind.racetracks rt
WHERE rt.aggregate_id = z.racetrack_aggregate_id;
UPDATE trackmind.restricted_zones
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    zone_id = coalesce(nullif(zone_id, ''), trackmind.logical_id_from_twin(twin_id, zone_code));
ALTER TABLE trackmind.restricted_zones ENABLE TRIGGER USER;
ALTER TABLE trackmind.restricted_zones
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN zone_id SET NOT NULL,
  ADD CONSTRAINT restricted_zones_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(zone_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS restricted_zones_scope_zone_id_idx ON trackmind.restricted_zones(tenant_id, racetrack_id, zone_id);

ALTER TABLE trackmind.sensors
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS sensor_id text;
ALTER TABLE trackmind.sensors DISABLE TRIGGER USER;
UPDATE trackmind.sensors s
SET organization_id = coalesce(nullif(s.organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(s.tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(s.racetrack_id, ''), rt.racetrack_id, 'main-track'),
    sensor_id = coalesce(nullif(s.sensor_id, ''), trackmind.logical_id_from_twin(s.twin_id, s.sensor_code))
FROM trackmind.racetracks rt
WHERE rt.aggregate_id = s.racetrack_aggregate_id;
UPDATE trackmind.sensors
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    sensor_id = coalesce(nullif(sensor_id, ''), trackmind.logical_id_from_twin(twin_id, sensor_code));
ALTER TABLE trackmind.sensors ENABLE TRIGGER USER;
ALTER TABLE trackmind.sensors
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN sensor_id SET NOT NULL,
  ADD CONSTRAINT sensors_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(sensor_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS sensors_scope_sensor_id_idx ON trackmind.sensors(tenant_id, racetrack_id, sensor_id);
CREATE INDEX IF NOT EXISTS sensors_scope_status_idx ON trackmind.sensors(tenant_id, racetrack_id, status, sensor_type);

ALTER TABLE trackmind.cameras
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS camera_id text;
ALTER TABLE trackmind.cameras DISABLE TRIGGER USER;
UPDATE trackmind.cameras c
SET organization_id = coalesce(nullif(c.organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(c.tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(c.racetrack_id, ''), rt.racetrack_id, 'main-track'),
    camera_id = coalesce(nullif(c.camera_id, ''), trackmind.logical_id_from_twin(c.twin_id, c.camera_code))
FROM trackmind.racetracks rt
WHERE rt.aggregate_id = c.racetrack_aggregate_id;
UPDATE trackmind.cameras
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    camera_id = coalesce(nullif(camera_id, ''), trackmind.logical_id_from_twin(twin_id, camera_code));
ALTER TABLE trackmind.cameras ENABLE TRIGGER USER;
ALTER TABLE trackmind.cameras
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN camera_id SET NOT NULL,
  ADD CONSTRAINT cameras_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(camera_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS cameras_scope_camera_id_idx ON trackmind.cameras(tenant_id, racetrack_id, camera_id);
CREATE INDEX IF NOT EXISTS cameras_scope_status_idx ON trackmind.cameras(tenant_id, racetrack_id, status);

ALTER TABLE trackmind.incidents
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS racetrack_id text,
  ADD COLUMN IF NOT EXISTS incident_id text;
ALTER TABLE trackmind.incidents DISABLE TRIGGER USER;
UPDATE trackmind.incidents i
SET organization_id = coalesce(nullif(i.organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(i.tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(i.racetrack_id, ''), rt.racetrack_id, 'main-track'),
    incident_id = coalesce(nullif(i.incident_id, ''), trackmind.logical_id_from_twin(i.twin_id, i.aggregate_id::text))
FROM trackmind.racetracks rt
WHERE rt.aggregate_id = i.racetrack_aggregate_id;
UPDATE trackmind.incidents
SET organization_id = coalesce(nullif(organization_id, ''), 'org-trackmind-network'),
    tenant_id = coalesce(nullif(tenant_id, ''), 'trackmind'),
    racetrack_id = coalesce(nullif(racetrack_id, ''), 'main-track'),
    incident_id = coalesce(nullif(incident_id, ''), trackmind.logical_id_from_twin(twin_id, aggregate_id::text));
ALTER TABLE trackmind.incidents ENABLE TRIGGER USER;
ALTER TABLE trackmind.incidents
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN racetrack_id SET NOT NULL,
  ALTER COLUMN incident_id SET NOT NULL,
  ADD CONSTRAINT incidents_canonical_scope CHECK (btrim(organization_id) <> '' AND btrim(tenant_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(incident_id) <> '');
CREATE UNIQUE INDEX IF NOT EXISTS incidents_scope_incident_id_idx ON trackmind.incidents(tenant_id, racetrack_id, incident_id);
CREATE INDEX IF NOT EXISTS incidents_scope_status_idx ON trackmind.incidents(tenant_id, racetrack_id, status, severity, occurred_at DESC);

ALTER TABLE trackmind.tenant_racetracks
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network';
CREATE UNIQUE INDEX IF NOT EXISTS tenant_racetracks_scope_idx ON trackmind.tenant_racetracks(tenant_id, racetrack_id);

ALTER TABLE trackmind.facilities
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track';
CREATE INDEX IF NOT EXISTS facilities_scope_type_idx ON trackmind.facilities(tenant_id, racetrack_id, facility_type, status);

ALTER TABLE trackmind.security_events
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track';
CREATE INDEX IF NOT EXISTS security_events_scope_occurred_idx ON trackmind.security_events(tenant_id, racetrack_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_scope_type_idx ON trackmind.security_events(tenant_id, racetrack_id, event_type, severity);

ALTER TABLE trackmind.compliance_records
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track';
CREATE INDEX IF NOT EXISTS compliance_records_scope_status_idx ON trackmind.compliance_records(tenant_id, racetrack_id, framework_id, control_id, status);

ALTER TABLE trackmind.current_race_state_projection
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network',
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'trackmind',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track',
  ALTER COLUMN race_id TYPE text USING race_id::text,
  ALTER COLUMN active_horse_ids TYPE text[] USING active_horse_ids::text[],
  ALTER COLUMN scratched_horse_ids TYPE text[] USING scratched_horse_ids::text[],
  ALTER COLUMN incident_ids TYPE text[] USING incident_ids::text[];
ALTER TABLE trackmind.current_race_state_projection DROP CONSTRAINT IF EXISTS current_race_state_projection_pkey;
ALTER TABLE trackmind.current_race_state_projection ADD PRIMARY KEY (tenant_id, racetrack_id, race_id);
CREATE INDEX IF NOT EXISTS current_race_state_scope_status_idx ON trackmind.current_race_state_projection(tenant_id, racetrack_id, status, updated_at DESC);

ALTER TABLE trackmind.horse_location_history_projection
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network',
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'trackmind',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track',
  ALTER COLUMN horse_id TYPE text USING horse_id::text;
CREATE INDEX IF NOT EXISTS horse_location_history_scope_horse_idx ON trackmind.horse_location_history_projection(tenant_id, racetrack_id, horse_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS horse_location_history_scope_zone_idx ON trackmind.horse_location_history_projection(tenant_id, racetrack_id, zone_id, observed_at DESC);

ALTER TABLE trackmind.security_zone_occupancy_projection
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'org-trackmind-network',
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'trackmind',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track',
  ALTER COLUMN active_incident_ids TYPE text[] USING active_incident_ids::text[];
ALTER TABLE trackmind.security_zone_occupancy_projection DROP CONSTRAINT IF EXISTS security_zone_occupancy_projection_pkey;
ALTER TABLE trackmind.security_zone_occupancy_projection ADD PRIMARY KEY (tenant_id, racetrack_id, zone_id);
CREATE INDEX IF NOT EXISTS security_zone_occupancy_scope_observed_idx ON trackmind.security_zone_occupancy_projection(tenant_id, racetrack_id, last_observed_at DESC);

CREATE OR REPLACE FUNCTION trackmind.apply_race_day_event_to_projections()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  event_organization_id text := coalesce(nullif(NEW.organization_id, ''), 'org-trackmind-network');
  event_tenant_id text := coalesce(nullif(NEW.tenant_id, ''), 'trackmind');
  event_racetrack_id text := coalesce(nullif(NEW.racetrack_id, ''), 'main-track');
  race_ref text;
  horse_ref text;
  incident_ref text;
  zone_ref text;
  occupant_ref text;
BEGIN
  IF NEW.event_type = 'race.lifecycle.started.v1' THEN
    race_ref := coalesce(nullif(NEW.payload->>'raceId', ''), NEW.aggregate_id::text);
    INSERT INTO trackmind.current_race_state_projection(organization_id, tenant_id, racetrack_id, race_id, aggregate_id, status, last_event_id, updated_at, immutable_hash_chain)
    VALUES (event_organization_id, event_tenant_id, event_racetrack_id, race_ref, NEW.aggregate_id, 'running', NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
    ON CONFLICT (tenant_id, racetrack_id, race_id) DO UPDATE
      SET status = 'running',
          last_event_id = EXCLUDED.last_event_id,
          version = trackmind.current_race_state_projection.version + 1,
          updated_at = EXCLUDED.updated_at,
          immutable_hash_chain = EXCLUDED.immutable_hash_chain;
  END IF;

  IF NEW.event_type = 'race.lifecycle.stopped.v1' THEN
    race_ref := coalesce(nullif(NEW.payload->>'raceId', ''), NEW.aggregate_id::text);
    INSERT INTO trackmind.current_race_state_projection(organization_id, tenant_id, racetrack_id, race_id, aggregate_id, status, last_event_id, updated_at, immutable_hash_chain)
    VALUES (event_organization_id, event_tenant_id, event_racetrack_id, race_ref, NEW.aggregate_id, 'stopped', NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
    ON CONFLICT (tenant_id, racetrack_id, race_id) DO UPDATE
      SET status = 'stopped',
          last_event_id = EXCLUDED.last_event_id,
          version = trackmind.current_race_state_projection.version + 1,
          updated_at = EXCLUDED.updated_at,
          immutable_hash_chain = EXCLUDED.immutable_hash_chain;
  END IF;

  IF NEW.event_type = 'horse.status.scratched.v1' THEN
    race_ref := coalesce(nullif(NEW.payload->>'raceId', ''), NEW.aggregate_id::text);
    horse_ref := nullif(NEW.payload->>'horseId', '');
    IF horse_ref IS NOT NULL THEN
      INSERT INTO trackmind.current_race_state_projection(organization_id, tenant_id, racetrack_id, race_id, aggregate_id, status, scratched_horse_ids, last_event_id, updated_at, immutable_hash_chain)
      VALUES (event_organization_id, event_tenant_id, event_racetrack_id, race_ref, NEW.aggregate_id, 'scheduled', ARRAY[horse_ref], NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (tenant_id, racetrack_id, race_id) DO UPDATE
        SET scratched_horse_ids = array(SELECT DISTINCT unnest(trackmind.current_race_state_projection.scratched_horse_ids || horse_ref)),
            active_horse_ids = array_remove(trackmind.current_race_state_projection.active_horse_ids, horse_ref),
            last_event_id = EXCLUDED.last_event_id,
            version = trackmind.current_race_state_projection.version + 1,
            updated_at = EXCLUDED.updated_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
  END IF;

  IF NEW.event_type = 'incident.case.reported.v1' THEN
    incident_ref := coalesce(nullif(NEW.payload->>'incidentId', ''), NEW.event_id::text);
    race_ref := nullif(NEW.payload->>'raceId', '');
    zone_ref := nullif(NEW.payload->>'zoneId', '');
    IF race_ref IS NOT NULL THEN
      INSERT INTO trackmind.current_race_state_projection(organization_id, tenant_id, racetrack_id, race_id, aggregate_id, status, incident_ids, last_event_id, updated_at, immutable_hash_chain)
      VALUES (event_organization_id, event_tenant_id, event_racetrack_id, race_ref, NEW.aggregate_id, 'scheduled', ARRAY[incident_ref], NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (tenant_id, racetrack_id, race_id) DO UPDATE
        SET incident_ids = array(SELECT DISTINCT unnest(trackmind.current_race_state_projection.incident_ids || incident_ref)),
            last_event_id = EXCLUDED.last_event_id,
            version = trackmind.current_race_state_projection.version + 1,
            updated_at = EXCLUDED.updated_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
    IF zone_ref IS NOT NULL THEN
      INSERT INTO trackmind.security_zone_occupancy_projection(organization_id, tenant_id, racetrack_id, zone_id, active_incident_ids, last_observed_at, immutable_hash_chain)
      VALUES (event_organization_id, event_tenant_id, event_racetrack_id, zone_ref, ARRAY[incident_ref], NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (tenant_id, racetrack_id, zone_id) DO UPDATE
        SET active_incident_ids = array(SELECT DISTINCT unnest(trackmind.security_zone_occupancy_projection.active_incident_ids || incident_ref)),
            last_observed_at = EXCLUDED.last_observed_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
  END IF;

  IF NEW.event_type = 'location.position.updated.v1' THEN
    horse_ref := nullif(NEW.payload->>'horseId', '');
    zone_ref := nullif(NEW.payload->>'zoneId', '');
    occupant_ref := coalesce(nullif(NEW.payload->>'horseId', ''), nullif(NEW.payload->>'personId', ''), nullif(NEW.payload->>'subjectId', ''));
    IF horse_ref IS NOT NULL AND zone_ref IS NOT NULL THEN
      INSERT INTO trackmind.horse_location_history_projection(organization_id, tenant_id, racetrack_id, horse_id, zone_id, latitude, longitude, observed_at, source_event_id, immutable_hash_chain)
      VALUES (event_organization_id, event_tenant_id, event_racetrack_id, horse_ref, zone_ref, (NEW.payload->>'latitude')::numeric, (NEW.payload->>'longitude')::numeric, NEW."timestamp", NEW.event_id, NEW.immutable_hash_chain);
    END IF;
    IF zone_ref IS NOT NULL AND occupant_ref IS NOT NULL THEN
      INSERT INTO trackmind.security_zone_occupancy_projection(organization_id, tenant_id, racetrack_id, zone_id, occupant_ids, latest_camera_event_id, last_observed_at, immutable_hash_chain)
      VALUES (event_organization_id, event_tenant_id, event_racetrack_id, zone_ref, ARRAY[occupant_ref], NEW.event_id, NEW."timestamp", NEW.immutable_hash_chain)
      ON CONFLICT (tenant_id, racetrack_id, zone_id) DO UPDATE
        SET occupant_ids = array(SELECT DISTINCT unnest(trackmind.security_zone_occupancy_projection.occupant_ids || occupant_ref)),
            latest_camera_event_id = EXCLUDED.latest_camera_event_id,
            last_observed_at = EXCLUDED.last_observed_at,
            immutable_hash_chain = EXCLUDED.immutable_hash_chain;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE trackmind.kpi_definitions
  ADD COLUMN IF NOT EXISTS kpi_scope_key text GENERATED ALWAYS AS (tenant_id || ':' || coalesce(racetrack_id, '__federation__') || ':' || kpi_id) STORED;
ALTER TABLE trackmind.kpi_thresholds
  ADD COLUMN IF NOT EXISTS kpi_scope_key text GENERATED ALWAYS AS (tenant_id || ':' || coalesce(racetrack_id, '__federation__') || ':' || kpi_id) STORED;
ALTER TABLE trackmind.kpi_snapshots
  ADD COLUMN IF NOT EXISTS kpi_scope_key text GENERATED ALWAYS AS (tenant_id || ':' || coalesce(racetrack_id, '__federation__') || ':' || kpi_id) STORED;
ALTER TABLE trackmind.kpi_source_mappings
  ADD COLUMN IF NOT EXISTS kpi_scope_key text GENERATED ALWAYS AS (tenant_id || ':' || coalesce(racetrack_id, '__federation__') || ':' || kpi_id) STORED;
ALTER TABLE trackmind.kpi_audit_links
  ADD COLUMN IF NOT EXISTS kpi_scope_key text GENERATED ALWAYS AS (tenant_id || ':' || coalesce(racetrack_id, '__federation__') || ':' || kpi_id) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS kpi_definitions_scope_key_idx ON trackmind.kpi_definitions(kpi_scope_key);
CREATE INDEX IF NOT EXISTS kpi_snapshots_scope_calculated_idx ON trackmind.kpi_snapshots(tenant_id, racetrack_id, kpi_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS kpi_thresholds_scope_effective_idx ON trackmind.kpi_thresholds(tenant_id, racetrack_id, kpi_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS kpi_source_mappings_scope_idx ON trackmind.kpi_source_mappings(tenant_id, racetrack_id, source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS kpi_audit_links_scope_idx ON trackmind.kpi_audit_links(tenant_id, racetrack_id, audit_event_id, link_type);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_thresholds_scope_fk') THEN
    ALTER TABLE trackmind.kpi_thresholds ADD CONSTRAINT kpi_thresholds_scope_fk FOREIGN KEY (kpi_scope_key) REFERENCES trackmind.kpi_definitions(kpi_scope_key) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_snapshots_scope_fk') THEN
    ALTER TABLE trackmind.kpi_snapshots ADD CONSTRAINT kpi_snapshots_scope_fk FOREIGN KEY (kpi_scope_key) REFERENCES trackmind.kpi_definitions(kpi_scope_key) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_source_mappings_scope_fk') THEN
    ALTER TABLE trackmind.kpi_source_mappings ADD CONSTRAINT kpi_source_mappings_scope_fk FOREIGN KEY (kpi_scope_key) REFERENCES trackmind.kpi_definitions(kpi_scope_key) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_audit_links_scope_fk') THEN
    ALTER TABLE trackmind.kpi_audit_links ADD CONSTRAINT kpi_audit_links_scope_fk FOREIGN KEY (kpi_scope_key) REFERENCES trackmind.kpi_definitions(kpi_scope_key) ON DELETE CASCADE;
  END IF;
END;
$$;

COMMENT ON TABLE trackmind.approval_action_events IS 'Compatibility approval decision journal. Canonical approval request state, steps, escalation, and audit linkage live on trackmind.approval_required_actions.';
COMMENT ON COLUMN trackmind.approval_required_actions.action_id IS 'Compatibility UUID primary key. Canonical approval identifier is approval_request_id.';
CREATE INDEX IF NOT EXISTS approval_required_actions_scope_request_idx ON trackmind.approval_required_actions(tenant_id, racetrack_id, approval_request_id);
CREATE INDEX IF NOT EXISTS approval_action_events_action_status_idx ON trackmind.approval_action_events(action_id, status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS trackmind.race_meets (
  race_meet_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  meet_code text,
  season text NOT NULL,
  opens_on date NOT NULL,
  closes_on date NOT NULL,
  status text NOT NULL,
  regulatory_authority text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT race_meets_status_allowed CHECK (status IN ('scheduled','open','closed','cancelled')),
  CONSTRAINT race_meets_nonempty CHECK (btrim(race_meet_id) <> '' AND btrim(racetrack_id) <> '' AND btrim(season) <> ''),
  CONSTRAINT race_meets_dates CHECK (opens_on <= closes_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS race_meets_scope_code_idx ON trackmind.race_meets(tenant_id, racetrack_id, (coalesce(meet_code, race_meet_id)));
CREATE INDEX IF NOT EXISTS race_meets_scope_status_idx ON trackmind.race_meets(tenant_id, racetrack_id, status, opens_on DESC);

CREATE TABLE IF NOT EXISTS trackmind.race_days (
  race_day_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  race_meet_id text REFERENCES trackmind.race_meets(race_meet_id) ON DELETE RESTRICT,
  race_date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT race_days_status_allowed CHECK (status IN ('scheduled','open','closed','cancelled')),
  CONSTRAINT race_days_nonempty CHECK (btrim(race_day_id) <> '' AND btrim(racetrack_id) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS race_days_scope_date_idx ON trackmind.race_days(tenant_id, racetrack_id, race_date);
CREATE INDEX IF NOT EXISTS race_days_scope_status_idx ON trackmind.race_days(tenant_id, racetrack_id, status, race_date DESC);

CREATE TABLE IF NOT EXISTS trackmind.race_entries (
  race_entry_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  race_id text NOT NULL,
  horse_id text NOT NULL,
  jockey_id text,
  post_position int,
  status text NOT NULL DEFAULT 'entered',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT race_entries_status_allowed CHECK (status IN ('entered','scratched','finished','disqualified')),
  CONSTRAINT race_entries_post_position CHECK (post_position IS NULL OR post_position > 0),
  CONSTRAINT race_entries_nonempty CHECK (btrim(race_entry_id) <> '' AND btrim(race_id) <> '' AND btrim(horse_id) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS race_entries_scope_horse_idx ON trackmind.race_entries(tenant_id, racetrack_id, race_id, horse_id);
CREATE INDEX IF NOT EXISTS race_entries_scope_status_idx ON trackmind.race_entries(tenant_id, racetrack_id, race_id, status);

CREATE TABLE IF NOT EXISTS trackmind.horse_owner_links (
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  horse_id text NOT NULL,
  owner_id text NOT NULL,
  ownership_type text NOT NULL DEFAULT 'individual',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, racetrack_id, horse_id, owner_id),
  CONSTRAINT horse_owner_links_type CHECK (ownership_type IN ('individual','partnership','stable','corporation')),
  CONSTRAINT horse_owner_links_nonempty CHECK (btrim(horse_id) <> '' AND btrim(owner_id) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.horse_veterinarian_links (
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  horse_id text NOT NULL,
  veterinarian_id text NOT NULL,
  authority_scope text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, racetrack_id, horse_id, veterinarian_id),
  CONSTRAINT horse_veterinarian_links_scope CHECK (authority_scope IN ('exam','clearance','regulatory')),
  CONSTRAINT horse_veterinarian_links_nonempty CHECK (btrim(horse_id) <> '' AND btrim(veterinarian_id) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.steward_panels (
  steward_panel_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  jurisdiction text NOT NULL,
  steward_ids text[] NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT steward_panels_members CHECK (cardinality(steward_ids) > 0),
  CONSTRAINT steward_panels_nonempty CHECK (btrim(steward_panel_id) <> '' AND btrim(jurisdiction) <> '')
);
CREATE INDEX IF NOT EXISTS steward_panels_scope_active_idx ON trackmind.steward_panels(tenant_id, racetrack_id, active);
CREATE INDEX IF NOT EXISTS steward_panels_stewards_gin_idx ON trackmind.steward_panels USING gin(steward_ids);

CREATE TABLE IF NOT EXISTS trackmind.barns (
  barn_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  facility_id text REFERENCES trackmind.facilities(facility_id) ON DELETE RESTRICT,
  sector_id text,
  status text NOT NULL,
  capacity int NOT NULL CHECK (capacity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barns_status_allowed CHECK (status IN ('ready','restricted','maintenance','closed')),
  CONSTRAINT barns_nonempty CHECK (btrim(barn_id) <> '' AND btrim(racetrack_id) <> '')
);
CREATE INDEX IF NOT EXISTS barns_scope_status_idx ON trackmind.barns(tenant_id, racetrack_id, status);

CREATE TABLE IF NOT EXISTS trackmind.stalls (
  stall_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  barn_id text NOT NULL REFERENCES trackmind.barns(barn_id) ON DELETE RESTRICT,
  label text NOT NULL,
  status text NOT NULL,
  occupancy_horse_id text,
  restriction_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stalls_status_allowed CHECK (status IN ('available','occupied','restricted','maintenance')),
  CONSTRAINT stalls_nonempty CHECK (btrim(stall_id) <> '' AND btrim(label) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS stalls_barn_label_idx ON trackmind.stalls(tenant_id, racetrack_id, barn_id, label);
CREATE INDEX IF NOT EXISTS stalls_scope_status_idx ON trackmind.stalls(tenant_id, racetrack_id, status);

CREATE TABLE IF NOT EXISTS trackmind.assets (
  asset_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  asset_type text NOT NULL,
  risk_classification text NOT NULL,
  sector_id text,
  facility_id text REFERENCES trackmind.facilities(facility_id) ON DELETE RESTRICT,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assets_type_allowed CHECK (asset_type IN ('starting-gate','sensor','camera','vehicle','control','facility-equipment','emergency-equipment','rfid-reader')),
  CONSTRAINT assets_risk_allowed CHECK (risk_classification IN ('low','medium','high','critical')),
  CONSTRAINT assets_status_allowed CHECK (status IN ('online','offline','standby','warning','maintenance')),
  CONSTRAINT assets_nonempty CHECK (btrim(asset_id) <> '' AND btrim(racetrack_id) <> '')
);
CREATE INDEX IF NOT EXISTS assets_scope_type_status_idx ON trackmind.assets(tenant_id, racetrack_id, asset_type, status);
CREATE INDEX IF NOT EXISTS assets_scope_risk_idx ON trackmind.assets(tenant_id, racetrack_id, risk_classification);

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('012', 'Canonical database design: tenant/racetrack scope, logical IDs, scoped indexes, projections, KPI keys, and missing domain relationships')
ON CONFLICT (version) DO NOTHING;

COMMIT;
