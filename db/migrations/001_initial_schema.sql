BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS age;

CREATE SCHEMA IF NOT EXISTS trackmind;

CREATE TYPE trackmind.twin_entity_type AS ENUM (
  'Horse',
  'Person',
  'Racetrack',
  'Race',
  'Incident',
  'RestrictedZone',
  'Sensor',
  'Camera'
);

CREATE TYPE trackmind.person_role AS ENUM (
  'trainer',
  'jockey',
  'official'
);

CREATE TYPE trackmind.approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled'
);

CREATE TYPE trackmind.event_visibility AS ENUM (
  'internal',
  'stewards',
  'racing-officials',
  'public-safety',
  'system'
);

CREATE OR REPLACE FUNCTION trackmind.hash_payload(
  previous_hash text,
  payload jsonb,
  occurred_at timestamptz DEFAULT now()
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      coalesce(previous_hash, '') || '|' || coalesce(payload, '{}'::jsonb)::text || '|' || occurred_at::text,
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION trackmind.prevent_update_or_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable; append an event instead', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION trackmind.require_approval_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.approved_by IS NULL OR NEW.approval_timestamp IS NULL THEN
    RAISE EXCEPTION 'approved_by and approval_timestamp are mandatory for %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS trackmind.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL
);

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('001', 'Initial TrackMind digital twin schema foundation with pgcrypto and Apache AGE extension')
ON CONFLICT (version) DO NOTHING;

COMMIT;
