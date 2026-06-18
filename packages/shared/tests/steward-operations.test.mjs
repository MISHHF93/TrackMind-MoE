import test from 'node:test';
import assert from 'node:assert/strict';
import { stewardAdvisoryGuardrailStatement, stewardOperationsSchemaVersion } from '../dist/index.js';

test('steward operations schema version is stable', () => {
  assert.equal(stewardOperationsSchemaVersion, 'trackmind.steward-operations.v1');
});

test('steward advisory guardrail statement enforces non-ruling posture', () => {
  assert.match(stewardAdvisoryGuardrailStatement, /summarize and organize evidence only/i);
  assert.match(stewardAdvisoryGuardrailStatement, /official rulings/i);
  assert.match(stewardAdvisoryGuardrailStatement, /human steward/i);
});
