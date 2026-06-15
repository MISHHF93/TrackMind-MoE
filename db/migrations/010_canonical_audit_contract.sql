BEGIN;

ALTER TABLE trackmind.events
  ADD COLUMN IF NOT EXISTS audit_event_id text,
  ADD COLUMN IF NOT EXISTS audit_actor jsonb,
  ADD COLUMN IF NOT EXISTS audit_entity jsonb,
  ADD COLUMN IF NOT EXISTS audit_action text,
  ADD COLUMN IF NOT EXISTS audit_reason text,
  ADD COLUMN IF NOT EXISTS audit_approval_reference jsonb,
  ADD COLUMN IF NOT EXISTS audit_tenant_scope jsonb,
  ADD COLUMN IF NOT EXISTS audit_integrity_reference jsonb;

UPDATE trackmind.events
SET
  audit_event_id = coalesce(audit_event_id, audit_ref, event_id::text),
  audit_actor = coalesce(audit_actor, jsonb_build_object('actorId', actor_id, 'actorType', 'service')),
  audit_entity = coalesce(audit_entity, jsonb_build_object('entityId', aggregate_id::text, 'entityType', event_type, 'tenantId', tenant_id, 'racetrackId', racetrack_id)),
  audit_action = coalesce(audit_action, event_type),
  audit_reason = coalesce(audit_reason, payload->>'reason', event_type),
  audit_approval_reference = coalesce(
    audit_approval_reference,
    CASE
      WHEN approval_ref IS NOT NULL THEN jsonb_build_object('approvalId', approval_ref, 'approvedBy', approved_by, 'decidedAt', approval_timestamp)
      ELSE NULL
    END
  ),
  audit_tenant_scope = coalesce(audit_tenant_scope, jsonb_build_object('tenantId', tenant_id, 'racetrackId', racetrack_id)),
  audit_integrity_reference = coalesce(audit_integrity_reference, jsonb_build_object('hash', immutable_hash_chain, 'previousHash', previous_hash, 'algorithm', 'sha256', 'chainScope', 'tenant'));

ALTER TABLE trackmind.events
  ALTER COLUMN audit_event_id SET NOT NULL,
  ALTER COLUMN audit_actor SET NOT NULL,
  ALTER COLUMN audit_entity SET NOT NULL,
  ALTER COLUMN audit_action SET NOT NULL,
  ALTER COLUMN audit_reason SET NOT NULL,
  ALTER COLUMN audit_tenant_scope SET NOT NULL,
  ALTER COLUMN audit_integrity_reference SET NOT NULL,
  ADD CONSTRAINT events_canonical_audit_actor CHECK (
    jsonb_typeof(audit_actor) = 'object'
    AND btrim(audit_actor->>'actorId') <> ''
    AND btrim(audit_actor->>'actorType') <> ''
  ),
  ADD CONSTRAINT events_canonical_audit_entity CHECK (
    jsonb_typeof(audit_entity) = 'object'
    AND btrim(audit_entity->>'entityId') <> ''
    AND btrim(audit_entity->>'entityType') <> ''
    AND btrim(audit_entity->>'tenantId') <> ''
  ),
  ADD CONSTRAINT events_canonical_audit_scope CHECK (
    jsonb_typeof(audit_tenant_scope) = 'object'
    AND audit_tenant_scope->>'tenantId' = tenant_id
  ),
  ADD CONSTRAINT events_canonical_audit_integrity CHECK (
    jsonb_typeof(audit_integrity_reference) = 'object'
    AND btrim(audit_integrity_reference->>'hash') <> ''
    AND btrim(audit_integrity_reference->>'previousHash') <> ''
    AND audit_integrity_reference->>'algorithm' = 'sha256'
  );

CREATE INDEX IF NOT EXISTS events_audit_event_id_idx ON trackmind.events(audit_event_id);
CREATE INDEX IF NOT EXISTS events_audit_actor_idx ON trackmind.events((audit_actor->>'actorId'), "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_audit_entity_idx ON trackmind.events((audit_entity->>'entityType'), (audit_entity->>'entityId'), "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_audit_scope_idx ON trackmind.events((audit_tenant_scope->>'tenantId'), (audit_tenant_scope->>'racetrackId'), "timestamp" DESC);
CREATE INDEX IF NOT EXISTS events_audit_approval_idx ON trackmind.events((audit_approval_reference->>'approvalId')) WHERE audit_approval_reference IS NOT NULL;

COMMENT ON COLUMN trackmind.events.audit_event_id IS 'Canonical auditEventId.';
COMMENT ON COLUMN trackmind.events.audit_actor IS 'Canonical audit actor object: actorId, actorType, displayName, roles.';
COMMENT ON COLUMN trackmind.events.audit_entity IS 'Canonical audited entity object: entityId, entityType, tenantId, racetrackId.';
COMMENT ON COLUMN trackmind.events.audit_action IS 'Canonical audit action.';
COMMENT ON COLUMN trackmind.events.audit_reason IS 'Canonical audit reason.';
COMMENT ON COLUMN trackmind.events.audit_approval_reference IS 'Canonical approvalReference object when the audit event is approval-linked.';
COMMENT ON COLUMN trackmind.events.audit_tenant_scope IS 'Canonical tenant scope object.';
COMMENT ON COLUMN trackmind.events.audit_integrity_reference IS 'Canonical integrity reference object with sha256 hash chain fields.';

INSERT INTO trackmind.schema_migrations(version, description)
VALUES ('010', 'Canonical audit contract fields for auditable actions')
ON CONFLICT (version) DO NOTHING;

COMMIT;
