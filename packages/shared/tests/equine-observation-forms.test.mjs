import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVeterinaryObservationPayload,
  buildWelfareObservationPayload,
  redactObservationForRole,
  validateEquineObservationEntry,
  welfareScoreFromSeverity,
} from '../dist/equineObservationForms.js';

test('validateEquineObservationEntry rejects edit mode for immutable history', () => {
  const result = validateEquineObservationEntry('welfare-observation', {
    horseId: 'horse-1',
    observationType: 'behavior',
    observedAt: '2026-06-22T10:00',
    severity: 'medium',
    notes: 'Horse calm in stall.',
    reason: 'Routine barn check',
  }, 'edit', 'quick');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('immutable')));
});

test('validateEquineObservationEntry enforces quick vs professional requirements', () => {
  const quickValid = validateEquineObservationEntry('welfare-observation', {
    horseId: 'horse-1',
    observationType: 'hydration',
    observedAt: '2026-06-22T10:00',
    severity: 'low',
    notes: 'Water intake normal.',
    reason: 'Paddock walk-through',
  }, 'create', 'quick');
  assert.equal(quickValid.valid, true);

  const professionalMissingScope = validateEquineObservationEntry('veterinary-observation', {
    horseId: 'horse-1',
    observationType: 'lameness',
    observedAt: '2026-06-22T10:00',
    severity: 'high',
    notes: 'Left front shortened stride noted on jog.',
    reason: 'Pre-race exam',
  }, 'create', 'professional');
  assert.equal(professionalMissingScope.valid, false);
});

test('buildVeterinaryObservationPayload maps privacy and race-day metadata', () => {
  const payload = buildVeterinaryObservationPayload(
    { actorId: 'vet-1', role: 'veterinarian' },
    {
      horseId: 'horse-7',
      observationType: 'lameness',
      observedAt: '2026-06-22T12:00:00.000Z',
      observedBy: 'vet-1',
      severity: 'high',
      notes: 'Mild left-front lameness at jog — monitor before gate.',
      followUpNeeded: true,
      clearanceState: 'pending-review',
      privacyScope: 'veterinary-confidential',
      raceDayImpact: 'gate-delay',
      reason: 'Pre-race veterinary check',
    },
    'professional',
  );
  assert.equal(payload.privacyScope, 'veterinary-confidential');
  assert.equal(payload.raceDayImpact, 'gate-delay');
  assert.equal(payload.followUpNeeded, true);
  assert.ok(Array.isArray(payload.evidence) && payload.evidence.includes('follow-up:required'));
});

test('buildWelfareObservationPayload infers score from severity when omitted', () => {
  const payload = buildWelfareObservationPayload(
    { actorId: 'welfare-1', role: 'steward' },
    {
      horseId: 'horse-7',
      observationType: 'behavior',
      observedAt: '2026-06-22T12:00:00.000Z',
      observedBy: 'welfare-1',
      role: 'steward',
      severity: 'high',
      notes: 'Agitated in paddock — handler requested.',
      reason: 'Paddock patrol',
    },
    'quick',
  );
  assert.equal(payload.score, welfareScoreFromSeverity('high'));
});

test('redactObservationForRole hides confidential notes from stewards', () => {
  const redacted = redactObservationForRole({
    observationId: 'obs-1',
    horseId: 'horse-1',
    observedAt: '2026-06-22T10:00:00.000Z',
    notes: 'Detailed medication and diagnosis notes that must not leak.',
    privacyScope: 'veterinary-confidential',
    severity: 'high',
    auditId: 'audit-1',
  }, 'steward');
  assert.equal(redacted.redacted, true);
  assert.notEqual(String(redacted.notes), 'Detailed medication and diagnosis notes that must not leak.');
});

test('redactObservationForRole blocks care-team scope from ticketing manager', () => {
  const redacted = redactObservationForRole({
    observationId: 'obs-2',
    horseId: 'horse-1',
    observedAt: '2026-06-22T10:00:00.000Z',
    notes: 'Care team only observation.',
    privacyScope: 'care-team',
    severity: 'medium',
    auditId: 'audit-2',
  }, 'ticketing-manager');
  assert.equal(redacted.redacted, true);
  assert.equal(redacted.notes, 'Restricted observation detail');
});
