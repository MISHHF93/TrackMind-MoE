import test from 'node:test';
import assert from 'node:assert/strict';
import { fanExperienceOperationsSchemaVersion, fanExperienceServiceGuardrailStatement } from '../dist/index.js';

test('fan experience schema version is stable', () => {
  assert.equal(fanExperienceOperationsSchemaVersion, 'trackmind.fan-experience-operations.v1');
});

test('fan experience guardrail statement requires approval-governed compensations', () => {
  assert.match(fanExperienceServiceGuardrailStatement, /approval-governed/i);
  assert.match(fanExperienceServiceGuardrailStatement, /refund/i);
});
