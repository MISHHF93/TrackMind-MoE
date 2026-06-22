import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHorseTimelineEntries,
  getHorseDataEntryWorkflow,
  horseDataEntryWorkflows,
  validateRetirementConfirmation,
  validateSensitiveOverwrite,
} from '../dist/horseDataEntry.js';
import { validateDataEntryForm } from '../dist/dataEntryFramework.js';

test('horse data entry workflows cover required domains', () => {
  const requiredKinds = [
    'horse',
    'horse-ownership',
    'trainer-assignment',
    'stable-assignment',
    'race-eligibility',
    'transport-record',
    'workout-record',
    'welfare-observation',
    'veterinary-observation',
    'retirement-record',
  ];
  for (const kind of requiredKinds) {
    assert.ok(getHorseDataEntryWorkflow(kind), `missing workflow ${kind}`);
  }
  assert.equal(horseDataEntryWorkflows.length, requiredKinds.length);
});

test('identity and operational sections are separated', () => {
  const identity = horseDataEntryWorkflows.filter((workflow) => workflow.section === 'identity');
  const operational = horseDataEntryWorkflows.filter((workflow) => workflow.section === 'operational');
  assert.ok(identity.some((workflow) => workflow.entityKind === 'horse'));
  assert.ok(identity.some((workflow) => workflow.entityKind === 'horse-ownership'));
  assert.ok(operational.some((workflow) => workflow.entityKind === 'workout-record'));
  assert.ok(operational.every((workflow) => workflow.entityKind !== 'horse'));
});

test('sensitive overwrite and retirement confirmation enforced', () => {
  const overwrite = validateSensitiveOverwrite('horse', 'edit', {});
  assert.equal(overwrite.valid, false);

  const retirement = validateRetirementConfirmation({});
  assert.equal(retirement.valid, false);

  const validRetirement = validateDataEntryForm('retirement-record', {
    horseId: 'horse-1',
    retiredAt: '2026-06-22T12:00',
    retirementReason: 'Owner requested retirement after last start.',
    destination: 'aftercare-farm',
    dataSource: 'manual-entry',
    confirmRetirement: true,
    reason: 'Retirement recorded from equine workspace with audit trail.',
  }, { mode: 'create', role: 'horse-operations-coordinator' });
  assert.equal(validRetirement.valid, true);
});

test('buildHorseTimelineEntries merges registry and audit history', () => {
  const entries = buildHorseTimelineEntries({
    ownershipHistory: [{ ownerId: 'o1', ownerName: 'Stable A', effectiveFrom: '2026-01-01', percentage: 100 }],
    workouts: [{ date: '2026-06-01', distanceFurlongs: 4, timeSeconds: 48, surface: 'dirt' }],
    auditEvents: [{ action: 'identity-updated', actorId: 'secretary', occurredAt: '2026-06-02T10:00:00.000Z' }],
  });
  assert.ok(entries.length >= 3);
  assert.ok(entries.some((entry) => entry.category === 'ownership'));
  assert.ok(entries.some((entry) => entry.category === 'workout'));
});
