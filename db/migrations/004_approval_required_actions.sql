BEGIN;

CREATE TABLE trackmind.approval_required_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id uuid NOT NULL REFERENCES trackmind.digital_twin_projection(aggregate_id) ON DELETE RESTRICT,
  action_type text NOT NULL,
  requested_payload jsonb NOT NULL,
  reason text NOT NULL,
  status trackmind.approval_status NOT NULL DEFAULT 'pending',
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  approved_by text,
  approval_timestamp timestamptz,
  immutable_hash_chain text NOT NULL UNIQUE,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  source_service text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_action_evidence_array CHECK (jsonb_typeof(evidence_links) = 'array'),
  CONSTRAINT approval_payload_object CHECK (jsonb_typeof(requested_payload) = 'object'),
  CONSTRAINT approved_actions_have_approver CHECK (
    status <> 'approved' OR (approved_by IS NOT NULL AND approval_timestamp IS NOT NULL)
  )
);

CREATE TABLE trackmind.approval_action_events (
  approval_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES trackmind.approval_required_actions(action_id) ON DELETE RESTRICT,
  status trackmind.approval_status NOT NULL,
  actor text NOT NULL,
  decision_reason text,
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  approved_by text,
  approval_timestamp timestamptz,
  immutable_hash_chain text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_action_event_evidence_array CHECK (jsonb_typeof(evidence_links) = 'array')
);

CREATE INDEX approval_required_actions_status_idx ON trackmind.approval_required_actions(status, requested_at DESC);
CREATE INDEX approval_required_actions_aggregate_idx ON trackmind.approval_required_actions(aggregate_id, status);
CREATE INDEX approval_required_actions_evidence_gin_idx ON trackmind.approval_required_actions USING gin(evidence_links);
CREATE INDEX approval_action_events_action_idx ON trackmind.approval_action_events(action_id, occurred_at DESC);

CREATE TRIGGER approval_action_events_immutable
BEFORE UPDATE OR DELETE ON trackmind.approval_action_events
FOR EACH ROW EXECUTE FUNCTION trackmind.prevent_update_or_delete();

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('004', 'Approval-required action queue and immutable approval event trail')
ON CONFLICT (version) DO NOTHING;

COMMIT;
