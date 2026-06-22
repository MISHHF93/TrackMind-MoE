import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInlineMetadataPatchPayload,
  canInlineEdit,
  inlineEditBlockedEntityScopes,
  isApprovalGovernedInlineEdit,
  requiresDestructiveConfirm,
  resolveInlineEditPolicy,
  validateInlineMetadataPatch,
} from '../dist/inlineEditPolicy.js';

test('blocked entity scopes reject inline editing', () => {
  for (const scope of inlineEditBlockedEntityScopes) {
    const policy = resolveInlineEditPolicy(scope, 'status');
    assert.equal(policy.governance, 'blocked');
    assert.match(policy.blockedReason ?? '', /not permitted/i);
  }
});

test('operational note tags and follow-up are inline editable', () => {
  assert.equal(canInlineEdit('operational-note', 'tags'), true);
  assert.equal(canInlineEdit('operational-note', 'followUpRequired', 'true'), true);
});

test('compliance evidence approved status is approval governed', () => {
  assert.equal(isApprovalGovernedInlineEdit('compliance-evidence', 'reviewStatus', 'approved'), true);
  assert.equal(canInlineEdit('compliance-evidence', 'reviewStatus', 'approved'), false);
  assert.equal(canInlineEdit('compliance-evidence', 'reviewStatus', 'submitted'), true);
});

test('security incident resolve requires destructive confirm', () => {
  assert.equal(requiresDestructiveConfirm('security-incident', 'status', 'resolved'), true);
  assert.equal(canInlineEdit('security-incident', 'status', 'triaged'), true);
});

test('validateInlineMetadataPatch enforces confirmation for destructive changes', () => {
  const payload = buildInlineMetadataPatchPayload({
    entityScope: 'security-incident',
    entityId: 'inc-1',
    fieldKey: 'status',
    value: 'resolved',
    actorId: 'security-operator',
  });
  const denied = validateInlineMetadataPatch(payload);
  assert.equal(denied.valid, false);
  assert.match(denied.errors.join(' '), /confirmation/i);

  const confirmed = validateInlineMetadataPatch({ ...payload, confirmedDestructive: true });
  assert.equal(confirmed.valid, true);
});
