CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE racetracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL,
  commission_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE race_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  racetrack_id uuid NOT NULL REFERENCES racetracks(id),
  race_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  UNIQUE (racetrack_id, race_date)
);

CREATE TABLE races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_day_id uuid NOT NULL REFERENCES race_days(id),
  race_number int NOT NULL,
  post_time timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  official_results jsonb,
  UNIQUE (race_day_id, race_number)
);

CREATE TABLE horses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  foaled date,
  safety_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  medication_status_placeholder text NOT NULL DEFAULT 'placeholder-unknown'
);

CREATE TABLE jockeys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, license_number text);
CREATE TABLE trainers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, license_number text);
CREATE TABLE veterinarians (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, license_number text);
CREATE TABLE stewards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, license_number text);

CREATE TABLE race_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES races(id),
  horse_id uuid NOT NULL REFERENCES horses(id),
  jockey_id uuid REFERENCES jockeys(id),
  trainer_id uuid REFERENCES trainers(id),
  post_position int,
  status text NOT NULL DEFAULT 'entered',
  UNIQUE (race_id, horse_id)
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_day_id uuid NOT NULL REFERENCES race_days(id),
  zone text NOT NULL,
  status text NOT NULL,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  purchased_at timestamptz
);

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_day_id uuid REFERENCES race_days(id),
  severity text NOT NULL,
  location text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE track_condition_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_day_id uuid NOT NULL REFERENCES race_days(id),
  sensor_id text,
  moisture numeric CHECK (moisture BETWEEN 0 AND 100),
  cushion_depth numeric CHECK (cushion_depth >= 0),
  compaction numeric CHECK (compaction >= 0),
  temperature numeric,
  rainfall numeric CHECK (rainfall >= 0),
  wind numeric CHECK (wind >= 0),
  lightning_distance numeric CHECK (lightning_distance >= 0),
  gate_status text,
  lighting_status text,
  camera_health text,
  anomalies jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE steward_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES races(id),
  objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_clips jsonb NOT NULL DEFAULT '[]'::jsonb,
  involved_horses jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  steward_notes text,
  decision_draft text,
  final_decision text,
  appeal_export_uri text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('draft','pending-approval','approved','rejected','expired','overridden')),
  request text NOT NULL,
  recommendation jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES ai_recommendations(id),
  protected_action text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','pending-approval','approved','rejected','expired','overridden')),
  approver text,
  reason text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  downstream_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor text NOT NULL,
  payload jsonb NOT NULL,
  previous_hash text NOT NULL,
  hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_audit_log_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();
