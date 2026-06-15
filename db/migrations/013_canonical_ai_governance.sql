-- Canonical AI governance persistence.
-- AI outputs are advisory artifacts only; regulated execution remains locked behind human approval workflows.

BEGIN;

CREATE TABLE IF NOT EXISTS trackmind.ai_recommendations (
  recommendation_id text PRIMARY KEY,
  organization_id text NOT NULL DEFAULT 'org-trackmind-network',
  tenant_id text NOT NULL DEFAULT 'trackmind',
  racetrack_id text NOT NULL DEFAULT 'main-track',
  agent_id text NOT NULL,
  model_version text NOT NULL,
  prompt_template_id text,
  recommendation_type text NOT NULL,
  domain text NOT NULL,
  summary text NOT NULL,
  affected_assets text[] NOT NULL DEFAULT ARRAY[]::text[],
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence jsonb NOT NULL,
  approval_requirement jsonb NOT NULL,
  audit_reference jsonb NOT NULL,
  advisory_only boolean NOT NULL DEFAULT true CHECK (advisory_only = true),
  execution_allowed boolean NOT NULL DEFAULT false CHECK (execution_allowed = false),
  blocked_autonomous_execution boolean NOT NULL DEFAULT true CHECK (blocked_autonomous_execution = true),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(confidence) = 'object'),
  CHECK (jsonb_typeof(approval_requirement) = 'object'),
  CHECK (jsonb_typeof(audit_reference) = 'object'),
  CHECK (jsonb_array_length(coalesce(audit_reference->'auditIds', '[]'::jsonb)) > 0),
  CHECK (jsonb_array_length(coalesce(audit_reference->'eventIds', '[]'::jsonb)) > 0)
);

CREATE TABLE IF NOT EXISTS trackmind.ai_evidence_packages (
  evidence_package_id text PRIMARY KEY,
  recommendation_id text NOT NULL REFERENCES trackmind.ai_recommendations(recommendation_id) ON DELETE CASCADE,
  tenant_id text NOT NULL DEFAULT 'trackmind',
  racetrack_id text NOT NULL DEFAULT 'main-track',
  evidence jsonb NOT NULL,
  lineage text[] NOT NULL DEFAULT ARRAY[]::text[],
  integrity_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(evidence) = 'array'),
  CHECK (jsonb_array_length(evidence) > 0)
);

CREATE TABLE IF NOT EXISTS trackmind.ai_governor_reviews (
  governor_review_id text PRIMARY KEY,
  recommendation_id text NOT NULL REFERENCES trackmind.ai_recommendations(recommendation_id) ON DELETE CASCADE,
  tenant_id text NOT NULL DEFAULT 'trackmind',
  racetrack_id text NOT NULL DEFAULT 'main-track',
  action text NOT NULL,
  canonical_action text,
  decision text NOT NULL CHECK (decision IN ('requires-human-approval', 'blocked', 'approved')),
  reason text NOT NULL,
  approval_required boolean NOT NULL,
  required_approver_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  can_execute boolean NOT NULL DEFAULT false CHECK (can_execute = false),
  blocked_autonomous_execution boolean NOT NULL DEFAULT true CHECK (blocked_autonomous_execution = true),
  audit_id text NOT NULL,
  event_id text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trackmind.ai_blocked_execution_logs (
  blocked_execution_id text PRIMARY KEY,
  recommendation_id text NOT NULL REFERENCES trackmind.ai_recommendations(recommendation_id) ON DELETE CASCADE,
  tenant_id text NOT NULL DEFAULT 'trackmind',
  racetrack_id text NOT NULL DEFAULT 'main-track',
  action text NOT NULL,
  target text NOT NULL,
  actor text NOT NULL,
  reason text NOT NULL,
  confidence jsonb NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  evidence text[] NOT NULL DEFAULT ARRAY[]::text[],
  audit_id text NOT NULL,
  event_id text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_recommendations_scope_generated_idx
  ON trackmind.ai_recommendations(tenant_id, racetrack_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS ai_recommendations_scope_risk_idx
  ON trackmind.ai_recommendations(tenant_id, racetrack_id, risk_level);

CREATE INDEX IF NOT EXISTS ai_evidence_packages_recommendation_idx
  ON trackmind.ai_evidence_packages(recommendation_id);

CREATE INDEX IF NOT EXISTS ai_governor_reviews_recommendation_idx
  ON trackmind.ai_governor_reviews(recommendation_id);

CREATE INDEX IF NOT EXISTS ai_blocked_execution_logs_recommendation_idx
  ON trackmind.ai_blocked_execution_logs(recommendation_id);

DROP VIEW IF EXISTS trackmind.resticted_zones;

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('013', 'Canonical AI governance recommendation, evidence, governor review, and blocked execution records')
ON CONFLICT (version) DO NOTHING;

COMMIT;
