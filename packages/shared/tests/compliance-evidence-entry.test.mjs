import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildComplianceEvidenceIntakePayload,
  complianceEvidenceLinkTargetKinds,
  defaultComplianceEvidenceSeed,
  parseComplianceEvidenceLinkTargets,
  validateComplianceEvidenceEntry,
} from '../dist/complianceEvidenceEntry.js';

test('compliance evidence link target kinds cover attachable entities', () => {
  const kinds = complianceEvidenceLinkTargetKinds.map((entry) => entry.kind);
  assert.deepEqual(kinds, ['incident', 'approval', 'control', 'audit', 'kpi-definition', 'regulatory-workflow']);
});

test('validateComplianceEvidenceEntry rejects edit mode', () => {
  const result = validateComplianceEvidenceEntry({
    title: 'Security audit export',
    controlId: 'ctrl-security-audit',
    domain: 'security',
    evidenceType: 'log-export',
    source: 'audit-ledger',
    notes: 'Weekly security audit export for control review.',
    reason: 'Quarterly evidence refresh',
  }, 'edit', 'quick');
  assert.equal(result.valid, false);
});

test('parseComplianceEvidenceLinkTargets parses line format', () => {
  const targets = parseComplianceEvidenceLinkTargets('incident:inc-1\napproval:approval-race-start:Race start approval');
  assert.equal(targets.length, 2);
  assert.equal(targets[0]?.targetKind, 'incident');
  assert.equal(targets[1]?.label, 'Race start approval');
});

test('buildComplianceEvidenceIntakePayload maps retention and link targets', () => {
  const payload = buildComplianceEvidenceIntakePayload(
    { actorId: 'compliance-officer' },
    {
      title: 'Immutable audit chain export',
      controlId: 'ctrl-security-audit',
      frameworkIds: 'ISO-27001\nSOC-2',
      policyCitation: 'Information security monitoring and logging',
      domain: 'security',
      evidenceType: 'audit-trail',
      source: 'immutable-audit-log',
      notes: 'Hash-chain verification export attached for control assessment.',
      linkTargets: 'audit:audit-incident-1\ncontrol:ctrl-security-audit',
      reviewStatus: 'pending-review',
      retentionPolicy: 'regulated-records-7y',
      retainedUntil: '2033-06-22',
      legalHold: true,
      startReviewWorkflow: true,
      reason: 'Quarterly control evidence collection',
    },
    'full',
  );
  assert.equal(payload.title, 'Immutable audit chain export');
  assert.ok(Array.isArray(payload.frameworkIds) && payload.frameworkIds.length === 2);
  assert.equal(payload.linkTargets.length, 2);
  assert.equal(payload.retentionPolicy, 'regulated-records-7y');
  assert.equal(payload.legalHold, true);
  assert.equal(payload.startReviewWorkflow, true);
});

test('defaultComplianceEvidenceSeed includes retention defaults', () => {
  const seed = defaultComplianceEvidenceSeed('ctrl-trust-services', 'compliance-officer', 'SOC-2');
  assert.equal(seed.controlId, 'ctrl-trust-services');
  assert.equal(seed.retentionPolicy, 'regulated-records-7y');
});
