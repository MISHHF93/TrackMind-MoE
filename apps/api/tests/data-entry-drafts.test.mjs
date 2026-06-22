import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { createDataEntryService } from '../dist/dataEntry/dataEntryService.js';

const audit = { ledger: new ImmutableAuditLog() };

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-1',
};

test('data entry drafts autosave with explicit draft status', () => {
  const service = createDataEntryService(audit);
  const draft = service.saveDraft({
    entityKind: 'horse',
    mode: 'create',
    values: { name: 'Draft Runner' },
    scope,
    explicit: false,
    baseline: { name: '' },
  });
  assert.equal(draft.status, 'autosaved');
  assert.ok(draft.baselineFingerprint);
  assert.ok(draft.expiresAt);
});

test('data entry draft conflict detected when baseline changes', () => {
  const service = createDataEntryService(audit);
  const draft = service.saveDraft({
    entityKind: 'unified-incident',
    mode: 'edit',
    values: { summary: 'Updated incident notes' },
    scope,
    recordId: 'inc-1',
    baseline: { summary: 'Original', _recordVersion: '1' },
  });
  const conflict = service.checkDraftConflict(draft.draftId, scope, {
    summary: 'Server changed',
    _recordVersion: '2',
    _recordUpdatedAt: '2026-06-22T12:00:00.000Z',
  });
  assert.equal(conflict.conflict.hasConflict, true);
});

test('list drafts filters by entity kind and actor scope', () => {
  const service = createDataEntryService(audit);
  service.saveDraft({
    entityKind: 'horse',
    mode: 'create',
    values: { name: 'Horse draft' },
    scope,
    baseline: { name: '' },
  });
  service.saveDraft({
    entityKind: 'compliance-evidence',
    mode: 'create',
    values: { title: 'Evidence draft' },
    scope,
    baseline: { title: '' },
  });
  const horseDrafts = service.listDrafts('horse', scope);
  assert.equal(horseDrafts.length, 1);
  assert.equal(horseDrafts[0]?.entityKind, 'horse');
});

test('submit purges drafts for the session', () => {
  const service = createDataEntryService(audit);
  const draft = service.saveDraft({
    entityKind: 'race-card',
    mode: 'create',
    values: {
      raceDayId: 'day-1',
      raceDate: '2026-06-22',
      raceNumber: 1,
      scheduledPostTime: '2026-06-22T18:00',
      surface: 'dirt',
      distanceFurlongs: 6,
      classLevel: 'Open',
      basePurse: 10000,
      reason: 'Draft race card',
    },
    scope,
    baseline: {},
  });
  service.submit('race-card', draft.values, scope, 'create');
  assert.equal(service.loadDraft(draft.draftId, scope), undefined);
});
