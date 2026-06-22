import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLocalDraftEnvelope,
  computeBaselineFingerprint,
  computeDraftExpiresAt,
  detectDraftBaselineConflict,
  isDraftExpired,
  parseLocalDraftEnvelope,
  pickRecoverableDraft,
} from '../dist/dataEntryDraftRecovery.js';

test('computeBaselineFingerprint ignores underscore metadata fields', () => {
  const left = computeBaselineFingerprint({ name: 'Star', _recordVersion: '1' });
  const right = computeBaselineFingerprint({ name: 'Star', _recordVersion: '2' });
  assert.equal(left, right);
});

test('detectDraftBaselineConflict when record version changes', () => {
  const conflict = detectDraftBaselineConflict(
    { baselineFingerprint: 'abc', baseRecordVersion: '1', baseRecordUpdatedAt: '2026-06-01T00:00:00.000Z' },
    'abc',
    { baseRecordVersion: '2', baseRecordUpdatedAt: '2026-06-02T00:00:00.000Z' },
  );
  assert.equal(conflict.hasConflict, true);
});

test('local draft envelope round-trips and expires', () => {
  const envelope = buildLocalDraftEnvelope({
    entityKind: 'horse',
    mode: 'create',
    values: { name: 'Draft horse' },
    baseline: { name: '' },
    status: 'autosaved',
    createdAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(isDraftExpired(envelope), true);
  const parsed = parseLocalDraftEnvelope(JSON.stringify(envelope));
  assert.equal(parsed, undefined);

  const fresh = buildLocalDraftEnvelope({
    entityKind: 'compliance-evidence',
    mode: 'create',
    values: { title: 'Evidence draft' },
    baseline: { title: '' },
    status: 'draft',
  });
  assert.ok(parseLocalDraftEnvelope(JSON.stringify(fresh)));
  assert.ok(Date.parse(fresh.expiresAt) > Date.now());
});

test('pickRecoverableDraft prefers newest non-expired draft', () => {
  const older = {
    draftId: 'draft-1',
    entityKind: 'unified-incident',
    mode: 'create',
    values: {},
    scope: { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'op', role: 'admin' },
    status: 'autosaved',
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T10:00:00.000Z',
    expiresAt: computeDraftExpiresAt('2026-06-20T10:00:00.000Z', 14),
  };
  const newer = { ...older, draftId: 'draft-2', updatedAt: '2026-06-21T10:00:00.000Z' };
  assert.equal(pickRecoverableDraft([older, newer], '2026-06-22T10:00:00.000Z')?.draftId, 'draft-2');
});
