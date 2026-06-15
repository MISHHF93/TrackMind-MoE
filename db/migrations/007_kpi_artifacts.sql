BEGIN;

CREATE TABLE IF NOT EXISTS trackmind.kpi_definitions (
  kpi_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  racetrack_id text,
  domain text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  artifact_type text NOT NULL DEFAULT 'KPI',
  metric_type text NOT NULL,
  unit text NOT NULL,
  target numeric NOT NULL,
  calculation_method text NOT NULL,
  refresh_cadence text NOT NULL,
  owner_role text NOT NULL,
  visibility text NOT NULL,
  approval_sensitivity text NOT NULL,
  model_readable boolean NOT NULL DEFAULT false,
  version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_definitions_artifact_type CHECK (artifact_type = 'KPI'),
  CONSTRAINT kpi_definitions_scope CHECK (tenant_id <> '' AND organization_id <> ''),
  CONSTRAINT kpi_definitions_federation_scope CHECK (
    domain <> 'multi-track-federation'
    OR (visibility = 'federation-aggregate' AND racetrack_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS trackmind.kpi_thresholds (
  threshold_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id text NOT NULL REFERENCES trackmind.kpi_definitions(kpi_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  racetrack_id text,
  warning numeric,
  critical numeric,
  target_direction text NOT NULL,
  description text NOT NULL,
  approval_id uuid,
  audit_event_id uuid,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_thresholds_direction CHECK (target_direction IN ('above', 'below', 'between', 'exact'))
);

CREATE TABLE IF NOT EXISTS trackmind.kpi_snapshots (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id text NOT NULL REFERENCES trackmind.kpi_definitions(kpi_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  racetrack_id text,
  value numeric NOT NULL,
  status text NOT NULL,
  trend text NOT NULL,
  confidence numeric(5,4) NOT NULL,
  data_quality_score numeric(5,4) NOT NULL,
  calculation_run_id text NOT NULL,
  calculation_version text NOT NULL,
  calculated_at timestamptz NOT NULL,
  source_events text[] NOT NULL DEFAULT '{}',
  source_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  audit_event_ids text[] NOT NULL DEFAULT '{}',
  integrity_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_snapshots_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT kpi_snapshots_data_quality CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
  CONSTRAINT kpi_snapshots_sources CHECK (cardinality(source_events) > 0)
);

CREATE TABLE IF NOT EXISTS trackmind.kpi_source_mappings (
  mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id text NOT NULL REFERENCES trackmind.kpi_definitions(kpi_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  racetrack_id text,
  source_event_type text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trackmind.kpi_audit_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id text NOT NULL REFERENCES trackmind.kpi_definitions(kpi_id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  racetrack_id text,
  audit_event_id text NOT NULL,
  event_id text,
  calculation_run_id text,
  link_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_audit_links_type CHECK (link_type IN ('definition-change', 'threshold-change', 'calculation-run', 'agent-context-export', 'snapshot-read'))
);

CREATE INDEX IF NOT EXISTS kpi_definitions_scope_idx ON trackmind.kpi_definitions(tenant_id, racetrack_id, domain);
CREATE INDEX IF NOT EXISTS kpi_snapshots_kpi_calculated_idx ON trackmind.kpi_snapshots(kpi_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS kpi_thresholds_kpi_effective_idx ON trackmind.kpi_thresholds(kpi_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS kpi_source_mappings_kpi_idx ON trackmind.kpi_source_mappings(kpi_id, source_event_type);
CREATE INDEX IF NOT EXISTS kpi_audit_links_kpi_idx ON trackmind.kpi_audit_links(kpi_id, link_type);

ALTER TABLE trackmind.kpi_definitions
  ADD CONSTRAINT kpi_definitions_domain_allowed CHECK (domain IN (
    'race-day-operations','equine-welfare','safety-incidents','stewarding','compliance',
    'security','facilities','ticketing','finance','fan-experience','racing-data-hub',
    'multi-track-federation','ai-governance','audit-integrity','approval-workflows',
    'tenant-operations','system-health','data-quality','veterinary-privacy','deployment-readiness'
  )),
  ADD CONSTRAINT kpi_definitions_metric_type_allowed CHECK (metric_type IN ('count','rate','score','duration','currency','percentage','ratio','readiness')),
  ADD CONSTRAINT kpi_definitions_visibility_allowed CHECK (visibility IN ('public','tenant-internal','restricted','veterinary-restricted','federation-aggregate')),
  ADD CONSTRAINT kpi_definitions_approval_sensitivity_allowed CHECK (approval_sensitivity IN ('none','approval-visible','approval-required-for-threshold-change','regulated-advisory-only')),
  ADD CONSTRAINT kpi_definitions_target_nonnegative CHECK (target >= 0),
  ADD CONSTRAINT kpi_definitions_nonempty_text CHECK (
    btrim(kpi_id) <> '' AND btrim(domain) <> '' AND btrim(name) <> ''
    AND btrim(version) <> '' AND (racetrack_id IS NULL OR btrim(racetrack_id) <> '')
  );

ALTER TABLE trackmind.kpi_thresholds
  ADD CONSTRAINT kpi_thresholds_nonempty_scope CHECK (btrim(tenant_id) <> '' AND (racetrack_id IS NULL OR btrim(racetrack_id) <> '')),
  ADD CONSTRAINT kpi_thresholds_nonnegative_values CHECK ((warning IS NULL OR warning >= 0) AND (critical IS NULL OR critical >= 0)),
  ADD CONSTRAINT kpi_thresholds_order CHECK (
    target_direction IN ('between','exact')
    OR (target_direction = 'above' AND (warning IS NULL OR critical IS NULL OR warning >= critical))
    OR (target_direction = 'below' AND (warning IS NULL OR critical IS NULL OR warning <= critical))
  ),
  ADD CONSTRAINT kpi_thresholds_approval_fk FOREIGN KEY (approval_id) REFERENCES trackmind.approval_required_actions(action_id) ON DELETE RESTRICT,
  ADD CONSTRAINT kpi_thresholds_audit_event_fk FOREIGN KEY (audit_event_id) REFERENCES trackmind.events(event_id) ON DELETE RESTRICT;

ALTER TABLE trackmind.kpi_snapshots
  ADD CONSTRAINT kpi_snapshots_status_allowed CHECK (status IN ('nominal','watch','warning','critical','blocked','readiness-only')),
  ADD CONSTRAINT kpi_snapshots_trend_allowed CHECK (trend IN ('up','down','flat','insufficient-history')),
  ADD CONSTRAINT kpi_snapshots_source_entities_array CHECK (jsonb_typeof(source_entities) = 'array');

ALTER TABLE trackmind.kpi_source_mappings
  ADD CONSTRAINT kpi_source_mappings_nonempty CHECK (
    btrim(tenant_id) <> '' AND btrim(source_event_type) <> ''
    AND btrim(source_entity_type) <> '' AND btrim(source_entity_id) <> ''
  );

ALTER TABLE trackmind.kpi_audit_links
  ADD CONSTRAINT kpi_audit_links_nonempty_refs CHECK (
    btrim(tenant_id) <> '' AND btrim(audit_event_id) <> ''
    AND (event_id IS NULL OR btrim(event_id) <> '')
  );

CREATE OR REPLACE FUNCTION trackmind.enforce_kpi_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition record;
  child_organization_id text;
BEGIN
  SELECT tenant_id, organization_id, racetrack_id
  INTO definition
  FROM trackmind.kpi_definitions
  WHERE kpi_id = NEW.kpi_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KPI % does not exist for %', NEW.kpi_id, TG_TABLE_NAME;
  END IF;

  child_organization_id := to_jsonb(NEW)->>'organization_id';

  IF NEW.tenant_id <> definition.tenant_id
    OR NEW.racetrack_id IS DISTINCT FROM definition.racetrack_id
    OR (child_organization_id IS NOT NULL AND child_organization_id <> definition.organization_id) THEN
    RAISE EXCEPTION 'KPI scope mismatch for % in %', NEW.kpi_id, TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER kpi_thresholds_scope
BEFORE INSERT ON trackmind.kpi_thresholds
FOR EACH ROW EXECUTE FUNCTION trackmind.enforce_kpi_scope();

CREATE TRIGGER kpi_snapshots_scope
BEFORE INSERT ON trackmind.kpi_snapshots
FOR EACH ROW EXECUTE FUNCTION trackmind.enforce_kpi_scope();

CREATE TRIGGER kpi_source_mappings_scope
BEFORE INSERT ON trackmind.kpi_source_mappings
FOR EACH ROW EXECUTE FUNCTION trackmind.enforce_kpi_scope();

CREATE TRIGGER kpi_audit_links_scope
BEFORE INSERT ON trackmind.kpi_audit_links
FOR EACH ROW EXECUTE FUNCTION trackmind.enforce_kpi_scope();

CREATE TRIGGER kpi_definitions_immutable
BEFORE UPDATE OR DELETE ON trackmind.kpi_definitions
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

CREATE TRIGGER kpi_thresholds_immutable
BEFORE UPDATE OR DELETE ON trackmind.kpi_thresholds
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

CREATE TRIGGER kpi_snapshots_immutable
BEFORE UPDATE OR DELETE ON trackmind.kpi_snapshots
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

CREATE TRIGGER kpi_source_mappings_immutable
BEFORE UPDATE OR DELETE ON trackmind.kpi_source_mappings
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

CREATE TRIGGER kpi_audit_links_immutable
BEFORE UPDATE OR DELETE ON trackmind.kpi_audit_links
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('007', 'Governed KPI artifact definitions, thresholds, snapshots, source mappings, and audit links')
ON CONFLICT (version) DO NOTHING;

COMMIT;
