import test from 'node:test';
import assert from 'node:assert/strict';
import { racingFinanceOperationsSchemaVersion, racingFinanceAuditabilityStatement } from '../dist/index.js';

test('racing finance schema version is stable', () => {
  assert.equal(racingFinanceOperationsSchemaVersion, 'trackmind.racing-finance-operations.v1');
});

test('racing finance auditability statement requires approval-governed payouts', () => {
  assert.match(racingFinanceAuditabilityStatement, /hash-chained/i);
  assert.match(racingFinanceAuditabilityStatement, /approval-governed/i);
});
