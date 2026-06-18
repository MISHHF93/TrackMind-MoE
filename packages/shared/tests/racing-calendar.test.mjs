import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarLifecycleStatuses } from '../dist/index.js';

test('racing calendar lifecycle statuses are defined', () => {
  assert.deepEqual(calendarLifecycleStatuses, ['planned', 'scheduled', 'approved', 'active', 'completed', 'cancelled']);
});
