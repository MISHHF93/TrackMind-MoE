BEGIN;

CREATE TABLE trackmind.dtdl_models (
  model_id text PRIMARY KEY,
  entity_type trackmind.twin_entity_type NOT NULL,
  dtdl_version text NOT NULL DEFAULT '3.0' CHECK (dtdl_version = '3.0'),
  display_name text NOT NULL,
  definition jsonb NOT NULL,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dtdl_context_required CHECK (definition ? '@context'),
  CONSTRAINT dtdl_type_required CHECK (definition ? '@type'),
  CONSTRAINT dtdl_id_matches CHECK (definition->>'@id' = model_id)
);

CREATE TRIGGER dtdl_models_immutable
BEFORE UPDATE OR DELETE ON trackmind.dtdl_models
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

CREATE TABLE trackmind.digital_twin_projection (
  aggregate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id text NOT NULL UNIQUE,
  entity_type trackmind.twin_entity_type NOT NULL,
  dtdl_model_id text NOT NULL REFERENCES trackmind.dtdl_models(model_id),
  current_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  last_event_id uuid,
  created_by text NOT NULL,
  approved_by text,
  approval_timestamp timestamptz,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX digital_twin_projection_entity_idx ON trackmind.digital_twin_projection(entity_type, version DESC);
CREATE INDEX digital_twin_projection_state_gin_idx ON trackmind.digital_twin_projection USING gin(current_state);

CREATE TABLE trackmind.racetracks (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL,
  commission_name text,
  geojson jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trackmind.persons (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  roles trackmind.person_role[] NOT NULL,
  license_number text,
  organization text,
  credential_status text NOT NULL DEFAULT 'active',
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_roles_not_empty CHECK (array_length(roles, 1) IS NOT NULL)
);

CREATE TABLE trackmind.horses (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  registered_name text NOT NULL,
  microchip_id text UNIQUE,
  foaled date,
  welfare_status text NOT NULL DEFAULT 'active',
  trainer_aggregate_id uuid REFERENCES trackmind.persons(aggregate_id),
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trackmind.races (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  racetrack_aggregate_id uuid NOT NULL REFERENCES trackmind.racetracks(aggregate_id),
  race_number int NOT NULL CHECK (race_number > 0),
  race_date date NOT NULL,
  post_time timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  distance_meters int CHECK (distance_meters > 0),
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (racetrack_aggregate_id, race_date, race_number)
);

CREATE TABLE trackmind.restricted_zones (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  racetrack_aggregate_id uuid NOT NULL REFERENCES trackmind.racetracks(aggregate_id),
  zone_code text NOT NULL,
  name text NOT NULL,
  boundary_geojson jsonb NOT NULL,
  access_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (racetrack_aggregate_id, zone_code)
);

CREATE VIEW trackmind.resticted_zones AS
SELECT * FROM trackmind.restricted_zones;

COMMENT ON VIEW trackmind.resticted_zones IS
  'Compatibility view for the RestictedZone spelling used in migration requirements; canonical table is trackmind.restricted_zones.';

CREATE TABLE trackmind.sensors (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  racetrack_aggregate_id uuid NOT NULL REFERENCES trackmind.racetracks(aggregate_id),
  sensor_code text NOT NULL,
  sensor_type text NOT NULL,
  location jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'online',
  restricted_zone_aggregate_id uuid REFERENCES trackmind.restricted_zones(aggregate_id),
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (racetrack_aggregate_id, sensor_code)
);

CREATE TABLE trackmind.cameras (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  racetrack_aggregate_id uuid NOT NULL REFERENCES trackmind.racetracks(aggregate_id),
  camera_code text NOT NULL,
  stream_uri text,
  field_of_view jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'online',
  restricted_zone_aggregate_id uuid REFERENCES trackmind.restricted_zones(aggregate_id),
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (racetrack_aggregate_id, camera_code)
);

CREATE TABLE trackmind.incidents (
  aggregate_id uuid PRIMARY KEY REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  twin_id text NOT NULL UNIQUE,
  racetrack_aggregate_id uuid REFERENCES trackmind.racetracks(aggregate_id),
  race_aggregate_id uuid REFERENCES trackmind.races(aggregate_id),
  restricted_zone_aggregate_id uuid REFERENCES trackmind.restricted_zones(aggregate_id),
  severity text NOT NULL CHECK (severity IN ('info', 'advisory', 'warning', 'critical')),
  status text NOT NULL DEFAULT 'open',
  occurred_at timestamptz NOT NULL,
  summary text NOT NULL,
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persons_roles_gin_idx ON trackmind.persons USING gin(roles);
CREATE INDEX horses_trainer_idx ON trackmind.horses(trainer_aggregate_id);
CREATE INDEX races_track_date_idx ON trackmind.races(racetrack_aggregate_id, race_date);
CREATE INDEX incidents_status_idx ON trackmind.incidents(status, severity, occurred_at DESC);
CREATE INDEX sensors_status_idx ON trackmind.sensors(status, sensor_type);
CREATE INDEX cameras_status_idx ON trackmind.cameras(status);

CREATE TRIGGER racetracks_immutable BEFORE UPDATE OR DELETE ON trackmind.racetracks FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER persons_immutable BEFORE UPDATE OR DELETE ON trackmind.persons FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER horses_immutable BEFORE UPDATE OR DELETE ON trackmind.horses FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER races_immutable BEFORE UPDATE OR DELETE ON trackmind.races FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER restricted_zones_immutable BEFORE UPDATE OR DELETE ON trackmind.restricted_zones FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER sensors_immutable BEFORE UPDATE OR DELETE ON trackmind.sensors FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER cameras_immutable BEFORE UPDATE OR DELETE ON trackmind.cameras FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER incidents_immutable BEFORE UPDATE OR DELETE ON trackmind.incidents FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('002', 'DTDL v3 model registry, digital twin projection table, and immutable core entity tables')
ON CONFLICT (version) DO NOTHING;

COMMIT;
