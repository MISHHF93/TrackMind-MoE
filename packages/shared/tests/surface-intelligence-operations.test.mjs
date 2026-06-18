import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceIntelligenceSchemaVersion, surfaceOperationalGuardrailStatement } from '../dist/index.js';

test('surface intelligence schema version is stable', () => {
  assert.equal(surfaceIntelligenceSchemaVersion, 'trackmind.surface-intelligence.v1');
});

test('surface operational guardrail statement requires approval-gated workflows', () => {
  assert.match(surfaceOperationalGuardrailStatement, /approval-gated/i);
  assert.match(surfaceOperationalGuardrailStatement, /irrigation/i);
});
