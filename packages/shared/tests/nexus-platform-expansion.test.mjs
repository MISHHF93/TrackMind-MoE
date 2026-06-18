import assert from 'node:assert/strict';
import test from 'node:test';
import { computeReadinessBand, welfareBand } from '../dist/nexusPlatformExpansion.js';

test('welfare and readiness band helpers', () => {
  assert.equal(welfareBand(95), 'excellent');
  assert.equal(welfareBand(45), 'concern');
  assert.equal(computeReadinessBand(92), 'production-ready');
  assert.equal(computeReadinessBand(60), 'in-progress');
});
