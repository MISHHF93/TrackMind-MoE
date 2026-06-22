import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canAccessEntityPickerKind,
  entityPickerKindForField,
  entityPickerKinds,
  filterEntityPickerItems,
  isEntityPickerKind,
  listAccessibleEntityPickerKinds,
  scoreEntityPickerMatch,
} from '../dist/entityPicker.js';

test('entity picker kinds cover required entity types', () => {
  for (const kind of [
    'horse', 'race', 'race-day', 'trainer', 'jockey', 'user', 'incident',
    'facility', 'approval', 'policy', 'kpi-definition',
    'compliance-evidence', 'security-event', 'audit-record', 'federation-participant',
  ]) {
    assert.ok(isEntityPickerKind(kind), `missing picker kind ${kind}`);
  }
  assert.equal(entityPickerKinds.length, 15);
});

test('entityId resolves picker kind from audit subject entityKind', () => {
  assert.equal(entityPickerKindForField('entityId', { entityKind: 'horse' }), 'horse');
  assert.equal(entityPickerKindForField('entityId', { entityKind: 'incident' }), 'incident');
  assert.equal(entityPickerKindForField('entityId', { entityKind: 'unknown-kind' }), undefined);
  assert.equal(entityPickerKindForField('policyId'), 'policy');
});

test('entity picker permissions filter kinds by role', () => {
  const adminKinds = listAccessibleEntityPickerKinds('platform-super-admin').map((entry) => entry.kind);
  assert.ok(adminKinds.includes('horse'));
  assert.ok(adminKinds.includes('kpi-definition'));

  const auditorKinds = listAccessibleEntityPickerKinds('read-only-auditor');
  assert.ok(auditorKinds.some((entry) => entry.kind === 'horse'));
  assert.ok(auditorKinds.some((entry) => entry.kind === 'kpi-definition'));
});

test('filterEntityPickerItems ranks prefix matches ahead of substring matches', () => {
  const items = filterEntityPickerItems([
    { id: 'horse-2', kind: 'horse', label: 'Northern Dancer II', tenantId: 'trackmind', racetrackId: 'main-track', score: 0.5 },
    { id: 'horse-1', kind: 'horse', label: 'Star Runner', tenantId: 'trackmind', racetrackId: 'main-track', score: 0.5 },
  ], 'star');
  assert.equal(items[0]?.id, 'horse-1');
  assert.ok(scoreEntityPickerMatch(['Star Runner', 'horse-1'], 'star') > 0);
});
