BEGIN;

ALTER TYPE trackmind.approval_status ADD VALUE IF NOT EXISTS 'escalated';

ALTER TABLE trackmind.approval_required_actions
  ADD COLUMN IF NOT EXISTS approval_request_id text,
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'trackmind',
  ADD COLUMN IF NOT EXISTS racetrack_id text NOT NULL DEFAULT 'main-track',
  ADD COLUMN IF NOT EXISTS approver_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_instance_id text,
  ADD COLUMN IF NOT EXISTS workflow_task_id text,
  ADD COLUMN IF NOT EXISTS audit_linkage jsonb NOT NULL DEFAULT '{"auditIds":[],"eventIds":[],"correlationId":""}'::jsonb;

UPDATE trackmind.approval_required_actions
SET
  approval_request_id = coalesce(approval_request_id, action_id::text),
  expires_at = coalesce(expires_at, requested_at + interval '30 minutes'),
  audit_linkage = CASE
    WHEN audit_linkage->>'correlationId' = '' THEN jsonb_set(audit_linkage, '{correlationId}', to_jsonb(action_id::text))
    ELSE audit_linkage
  END;

ALTER TABLE trackmind.approval_required_actions
  ALTER COLUMN approval_request_id SET NOT NULL,
  ALTER COLUMN expires_at SET NOT NULL,
  ADD CONSTRAINT approval_required_actions_canonical_status CHECK (status IN ('pending','approved','rejected','expired','escalated')),
  ADD CONSTRAINT approval_required_actions_scope CHECK (btrim(tenant_id) <> '' AND btrim(racetrack_id) <> ''),
  ADD CONSTRAINT approval_required_actions_roles_array CHECK (jsonb_typeof(approver_roles) = 'array'),
  ADD CONSTRAINT approval_required_actions_steps_array CHECK (jsonb_typeof(approval_steps) = 'array'),
  ADD CONSTRAINT approval_required_actions_escalation_array CHECK (jsonb_typeof(escalation_rules) = 'array'),
  ADD CONSTRAINT approval_required_actions_audit_linkage CHECK (
    jsonb_typeof(audit_linkage) = 'object'
    AND jsonb_typeof(audit_linkage->'auditIds') = 'array'
    AND jsonb_typeof(audit_linkage->'eventIds') = 'array'
    AND btrim(audit_linkage->>'correlationId') <> ''
  );

CREATE UNIQUE INDEX IF NOT EXISTS approval_required_actions_request_id_idx ON trackmind.approval_required_actions(approval_request_id);
CREATE INDEX IF NOT EXISTS approval_required_actions_scope_status_idx ON trackmind.approval_required_actions(tenant_id, racetrack_id, status, expires_at);
CREATE INDEX IF NOT EXISTS approval_required_actions_roles_gin_idx ON trackmind.approval_required_actions USING gin(approver_roles);
CREATE INDEX IF NOT EXISTS approval_required_actions_audit_linkage_gin_idx ON trackmind.approval_required_actions USING gin(audit_linkage);

COMMENT ON COLUMN trackmind.approval_required_actions.approval_request_id IS 'Canonical approvalRequestId from the shared approval engine.';
COMMENT ON COLUMN trackmind.approval_required_actions.approver_roles IS 'Canonical approver role list for the current approval policy.';
COMMENT ON COLUMN trackmind.approval_required_actions.approval_steps IS 'Canonical approval steps with roles, evidence requirements, decisions, and step status.';
COMMENT ON COLUMN trackmind.approval_required_actions.escalation_rules IS 'Canonical escalation rules with afterMinutes, approverRoles, reason, and optional escalatedAt.';
COMMENT ON COLUMN trackmind.approval_required_actions.audit_linkage IS 'Canonical audit linkage object: auditIds, eventIds, workflow refs, and correlationId.';

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('011', 'Canonical approval engine fields for regulated action workflows')
ON CONFLICT (version) DO NOTHING;

COMMIT;
