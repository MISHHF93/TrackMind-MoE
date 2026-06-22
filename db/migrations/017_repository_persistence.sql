BEGIN;

CREATE TABLE IF NOT EXISTS trackmind.repository_records (
  namespace text NOT NULL,
  record_id text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, record_id),
  CONSTRAINT repository_records_namespace_nonempty CHECK (btrim(namespace) <> ''),
  CONSTRAINT repository_records_record_id_nonempty CHECK (btrim(record_id) <> '')
);

CREATE INDEX IF NOT EXISTS repository_records_namespace_updated_idx
  ON trackmind.repository_records (namespace, updated_at DESC);

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('017', 'Wave 01 platform repository JSONB persistence')
ON CONFLICT (version) DO NOTHING;

COMMIT;
