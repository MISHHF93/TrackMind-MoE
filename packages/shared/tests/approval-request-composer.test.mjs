import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvalSourceDomains,
  buildComposerEvidence,
  buildControlledActionFromComposer,
  resolveComposerTarget,
  validateApprovalComposer,
} from '../dist/approvalRequestComposer.js';

test('approval source domains cover required origins', () => {
  const domains = approvalSourceDomains.map((definition) => definition.domain);
  assert.deepEqual(domains, [
    'ai-recommendation',
    'incident-action',
    'race-day-action',
    'compliance-action',
    'security-action',
    'finance-action',
    'administrative-change',
  ]);
});

test('validateApprovalComposer enforces quick vs full requirements', () => {
  const quickInvalid = validateApprovalComposer({}, 'quick');
  assert.equal(quickInvalid.valid, false);

  const quickValid = validateApprovalComposer({
    requestTitle: 'Gate move approval',
    sourceDomain: 'race-day-action',
    requestedAction: 'starting-gate-move',
    reason: 'Need steward approval before gate repositioning for race 7.',
    riskLevel: 'high',
    requestedApproverRole: 'steward',
    composeMode: 'quick',
  }, 'quick');
  assert.equal(quickValid.valid, true);

  const fullMissingEvidence = validateApprovalComposer({
    requestTitle: 'Compliance filing',
    sourceDomain: 'compliance-action',
    requestedAction: 'compliance-filing-approval',
    reason: 'Quarterly regulatory filing requires officer sign-off.',
    riskLevel: 'medium',
    requestedApproverRole: 'compliance-officer',
    composeMode: 'full',
  }, 'full');
  assert.equal(fullMissingEvidence.valid, false);

  const fullValid = validateApprovalComposer({
    requestTitle: 'Compliance filing',
    sourceDomain: 'compliance-action',
    requestedAction: 'compliance-filing-approval',
    reason: 'Quarterly regulatory filing requires officer sign-off.',
    riskLevel: 'medium',
    requestedApproverRole: 'compliance-officer',
    supportingEvidence: 'audit:compliance-q2\nfiling:draft-42',
    composeMode: 'full',
  }, 'full');
  assert.equal(fullValid.valid, true);
});

test('buildControlledActionFromComposer maps target and evidence', () => {
  const controlled = buildControlledActionFromComposer(
    { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'steward-1' },
    {
      requestTitle: 'Incident follow-up',
      sourceDomain: 'incident-action',
      requestedAction: 'steward-decision',
      reason: 'Steward review required after paddock incident report.',
      riskLevel: 'high',
      requestedApproverRole: 'steward',
      relatedIncidentId: 'inc-42',
      supportingEvidence: 'incident:inc-42\ncamera:gate-3',
      composeMode: 'full',
    },
    'full',
  );

  assert.equal(controlled.action, 'steward-decision');
  assert.equal(controlled.target, 'incident:inc-42');
  assert.ok(controlled.reason.includes('Incident follow-up'));
  assert.ok(controlled.evidence.includes('composer:incident:inc-42'));
  assert.ok(controlled.evidence.includes('incident:inc-42'));
});

test('resolveComposerTarget prefers related entity then incident then recommendation', () => {
  assert.equal(resolveComposerTarget({ relatedEntityKind: 'race', relatedEntityId: 'race-7' }), 'race:race-7');
  assert.equal(resolveComposerTarget({ relatedIncidentId: 'inc-1' }), 'incident:inc-1');
  assert.equal(resolveComposerTarget({ relatedRecommendationId: 'rec-9' }), 'recommendation:rec-9');
  assert.match(resolveComposerTarget({ sourceDomain: 'finance-action', requestTitle: 'Payout review' }), /^finance-action:/);
});

test('buildComposerEvidence tags domain and audit linkage', () => {
  const evidence = buildComposerEvidence({
    sourceDomain: 'ai-recommendation',
    requestTitle: 'Surface harrowing',
    riskLevel: 'medium',
    requestedApproverRole: 'track-superintendent',
    composeMode: 'quick',
    supportingEvidence: 'ai:rec-100',
  });
  assert.ok(evidence.includes('approval-request-composer'));
  assert.ok(evidence.includes('composer:domain:ai-recommendation'));
  assert.ok(evidence.includes('ai:rec-100'));
});
