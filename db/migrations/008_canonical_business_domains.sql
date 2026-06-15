BEGIN;

CREATE TABLE IF NOT EXISTS trackmind.organizations (
  organization_id text PRIMARY KEY,
  legal_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  data_residency text,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_status_allowed CHECK (status IN ('active', 'suspended', 'archived')),
  CONSTRAINT organizations_nonempty CHECK (btrim(organization_id) <> '' AND btrim(legal_name) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.tenants (
  tenant_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  data_boundary text NOT NULL DEFAULT 'racetrack',
  isolation_mode text NOT NULL DEFAULT 'strict',
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_status_allowed CHECK (status IN ('active', 'suspended', 'archived')),
  CONSTRAINT tenants_boundary_allowed CHECK (data_boundary IN ('organization', 'tenant', 'racetrack')),
  CONSTRAINT tenants_strict_isolation CHECK (isolation_mode = 'strict'),
  CONSTRAINT tenants_nonempty CHECK (btrim(tenant_id) <> '' AND btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.tenant_racetracks (
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_aggregate_id uuid NOT NULL REFERENCES trackmind.racetracks(aggregate_id) ON DELETE RESTRICT,
  racetrack_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, racetrack_aggregate_id),
  CONSTRAINT tenant_racetracks_nonempty CHECK (btrim(racetrack_id) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.users (
  user_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  email text,
  identity_kind text NOT NULL,
  roles text[] NOT NULL,
  permissions text[] NOT NULL,
  racetrack_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_identity_kind_allowed CHECK (identity_kind IN ('human', 'service', 'ai-agent')),
  CONSTRAINT users_status_allowed CHECK (status IN ('active', 'suspended', 'inactive')),
  CONSTRAINT users_roles_not_empty CHECK (cardinality(roles) > 0),
  CONSTRAINT users_permissions_not_empty CHECK (cardinality(permissions) > 0),
  CONSTRAINT users_nonempty CHECK (btrim(user_id) <> '' AND btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.facilities (
  facility_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_aggregate_id uuid NOT NULL REFERENCES trackmind.racetracks(aggregate_id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  facility_type text NOT NULL,
  sector_id text,
  asset_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facilities_type_allowed CHECK (facility_type IN ('barn', 'grandstand', 'paddock', 'clinic', 'maintenance', 'security', 'parking', 'stewards-room', 'veterinary')),
  CONSTRAINT facilities_status_allowed CHECK (status IN ('active', 'restricted', 'maintenance', 'closed')),
  CONSTRAINT facilities_nonempty CHECK (btrim(facility_id) <> '' AND btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.security_events (
  security_event_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  racetrack_aggregate_id uuid REFERENCES trackmind.racetracks(aggregate_id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  severity text NOT NULL,
  zone_id text,
  credential_id text,
  camera_id text,
  incident_aggregate_id uuid REFERENCES trackmind.incidents(aggregate_id) ON DELETE RESTRICT,
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  audit_event_id uuid NOT NULL REFERENCES trackmind.events(event_id) ON DELETE RESTRICT,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_events_severity_allowed CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT security_events_evidence_array CHECK (jsonb_typeof(evidence_links) = 'array'),
  CONSTRAINT security_events_nonempty CHECK (btrim(security_event_id) <> '' AND btrim(event_type) <> '' AND btrim(actor_id) <> '')
);

CREATE TABLE IF NOT EXISTS trackmind.compliance_records (
  compliance_record_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES trackmind.tenants(tenant_id) ON DELETE RESTRICT,
  organization_id text NOT NULL REFERENCES trackmind.organizations(organization_id) ON DELETE RESTRICT,
  racetrack_aggregate_id uuid REFERENCES trackmind.racetracks(aggregate_id) ON DELETE RESTRICT,
  framework_id text NOT NULL,
  control_id text NOT NULL,
  status text NOT NULL,
  evidence_ids text[] NOT NULL DEFAULT '{}',
  audit_event_ids uuid[] NOT NULL,
  approval_ids uuid[] NOT NULL DEFAULT '{}',
  readiness_only boolean NOT NULL DEFAULT true,
  external_certification_claimed boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  approved_by text NOT NULL,
  approval_timestamp timestamptz NOT NULL,
  immutable_hash_chain text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_records_status_allowed CHECK (status IN ('mapped', 'effective', 'finding-open', 'remediation-required', 'readiness-only')),
  CONSTRAINT compliance_records_no_cert_claim CHECK (external_certification_claimed = false),
  CONSTRAINT compliance_records_audited CHECK (cardinality(audit_event_ids) > 0),
  CONSTRAINT compliance_records_nonempty CHECK (btrim(compliance_record_id) <> '' AND btrim(framework_id) <> '' AND btrim(control_id) <> '')
);

CREATE INDEX IF NOT EXISTS tenants_organization_idx ON trackmind.tenants(organization_id, status);
CREATE INDEX IF NOT EXISTS users_tenant_roles_gin_idx ON trackmind.users USING gin(roles);
CREATE INDEX IF NOT EXISTS facilities_track_type_idx ON trackmind.facilities(racetrack_aggregate_id, facility_type, status);
CREATE INDEX IF NOT EXISTS security_events_tenant_occurred_idx ON trackmind.security_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS compliance_records_scope_idx ON trackmind.compliance_records(tenant_id, organization_id, framework_id, control_id);

CREATE TRIGGER organizations_immutable BEFORE UPDATE OR DELETE ON trackmind.organizations FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER tenants_immutable BEFORE UPDATE OR DELETE ON trackmind.tenants FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER tenant_racetracks_immutable BEFORE UPDATE OR DELETE ON trackmind.tenant_racetracks FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER users_immutable BEFORE UPDATE OR DELETE ON trackmind.users FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER facilities_immutable BEFORE UPDATE OR DELETE ON trackmind.facilities FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER security_events_immutable BEFORE UPDATE OR DELETE ON trackmind.security_events FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();
CREATE TRIGGER compliance_records_immutable BEFORE UPDATE OR DELETE ON trackmind.compliance_records FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('008', 'Canonical organization, tenant, user, facility, security event, and compliance record business domains')
ON CONFLICT (version) DO NOTHING;

COMMIT;
