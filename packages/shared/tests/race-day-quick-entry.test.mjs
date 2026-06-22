import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getRaceDayQuickAction,
  raceDayQuickActionList,
  raceDayQuickActions,
} from '../dist/raceDayQuickEntry.js';

test('race day quick entry covers operational workflows', () => {
  const required = [
    'paddock-check-in',
    'horse-arrival',
    'readiness-update',
    'incident-report',
    'steward-note',
    'gate-delay',
    'surface-observation',
    'compliance-flag',
    'approval-request',
  ];
  for (const action of required) {
    assert.ok(action in raceDayQuickActions, `missing ${action}`);
    const def = getRaceDayQuickAction(action);
    assert.ok(def.statusOptions.length >= 3, `${action} needs quick status options`);
  }
  assert.equal(raceDayQuickActionList.length, required.length);
});

test('one-tap options exist for high-frequency race-day updates', () => {
  const checkIn = getRaceDayQuickAction('paddock-check-in');
  const oneTap = checkIn.statusOptions.filter((option) => option.oneTap);
  assert.ok(oneTap.length >= 3);

  const gateDelay = getRaceDayQuickAction('gate-delay');
  assert.ok(gateDelay.statusOptions.every((option) => option.payload?.reason || option.value === 'other'));
});
