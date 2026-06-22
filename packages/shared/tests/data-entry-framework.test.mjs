import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dataEntryEntityKinds,
  detectDirtyState,
  getDefaultFormValues,
  isDataEntryEntityKind,
  validateDataEntryForm,
} from '../dist/dataEntryFramework.js';

test('data entry registry covers major operational entities', () => {
  const required = [
    'horse', 'horse-ownership', 'stable-assignment', 'race-eligibility', 'transport-record',
    'workout-record', 'retirement-record', 'race', 'race-card', 'unified-incident', 'incident', 'approval', 'approval-request-composer', 'audit-note',
    'veterinary-observation', 'welfare-observation', 'trainer-assignment',
    'jockey-assignment', 'paddock-record', 'security-incident',
    'facilities-inspection', 'compliance-evidence', 'kpi-definition', 'administrative-record',
  ];
  for (const kind of required) {
    assert.ok(isDataEntryEntityKind(kind), `missing entity kind ${kind}`);
  }
  assert.ok(dataEntryEntityKinds.length >= required.length);
});

test('validateDataEntryForm enforces required fields and audit reason', () => {
  const invalid = validateDataEntryForm('facilities-incident', {
    title: '',
    severity: 'medium',
    description: 'short',
    reason: 'too short',
  }, { mode: 'create', role: 'track-superintendent' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('title')));

  const valid = validateDataEntryForm('facilities-incident', {
    title: 'Elevator fault',
    severity: 'high',
    description: 'Door failed to close on level 2; area cordoned off.',
    reason: 'Recorded from facilities console for triage.',
  }, { mode: 'create', role: 'track-superintendent' });
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedValues.title, 'Elevator fault');
});

test('getDefaultFormValues applies field defaults', () => {
  const values = getDefaultFormValues('kpi-definition', 'create');
  assert.equal(values.targetDirection, 'above');
});

test('detectDirtyState compares normalized snapshots', () => {
  const baseline = { title: 'A', severity: 'medium' };
  const dirty = detectDirtyState({ title: 'B', severity: 'medium' }, baseline);
  assert.equal(dirty.isDirty, true);
  assert.deepEqual(dirty.changedFields, ['title']);
});
