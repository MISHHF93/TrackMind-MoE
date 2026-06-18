import test from 'node:test';
import assert from 'node:assert/strict';
import { startingGateNoAutoStartStatement, startingGateOperationsSchemaVersion } from '../dist/index.js';

test('starting gate operations schema version is stable', () => {
  assert.equal(startingGateOperationsSchemaVersion, 'trackmind.starting-gate-operations.v1');
});

test('starting gate guardrail statement blocks automated race starts', () => {
  assert.match(startingGateNoAutoStartStatement, /cannot be automated/i);
  assert.match(startingGateNoAutoStartStatement, /approval/i);
});
