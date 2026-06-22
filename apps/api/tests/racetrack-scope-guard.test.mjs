import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ScopeMismatchError,
  assertRacetrackScope,
  filterByScope,
} from '../dist/platform/scopeGuard.js';

test('racetrack-scoped role rejects other track records', () => {
  assert.throws(
    () => assertRacetrackScope(
      { role: 'steward', tenantId: 'trackmind', racetrackId: 'main-track' },
      { tenantId: 'trackmind', racetrackId: 'north-chute' },
    ),
    ScopeMismatchError,
  );
});

test('platform role bypasses racetrack scope checks', () => {
  assert.doesNotThrow(() => assertRacetrackScope(
    { role: 'platform-super-admin', tenantId: 'trackmind', racetrackId: 'main-track' },
    { tenantId: 'trackmind', racetrackId: 'north-chute' },
  ));
});

test('filterByScope removes cross-track items for racetrack roles', () => {
  const items = filterByScope(
    { role: 'paddock-official', tenantId: 'trackmind', racetrackId: 'main-track' },
    [
      { id: 'a', tenantId: 'trackmind', racetrackId: 'main-track' },
      { id: 'b', tenantId: 'trackmind', racetrackId: 'north-chute' },
    ],
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'a');
});
