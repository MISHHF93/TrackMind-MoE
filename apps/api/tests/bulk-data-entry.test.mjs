import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { createDataEntryService } from '../dist/dataEntry/dataEntryService.js';
import { createBulkDataEntryService } from '../dist/dataEntry/bulkDataEntryService.js';
import { handleDataEntryRoute } from '../dist/dataEntry/dataEntryRoutes.js';
import { parseBulkPaste } from '@trackmind/shared';

const audit = { ledger: new ImmutableAuditLog() };
const dataEntryService = createDataEntryService(audit);
const bulkService = createBulkDataEntryService(dataEntryService, audit);

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-bulk-api-1',
};

test('bulk operations list is role-filtered', () => {
  const operations = bulkService.listOperations(scope);
  assert.ok(operations.some((operation) => operation.id === 'horse-import'));
  const readOnly = bulkService.listOperations({ ...scope, role: 'read-only-auditor' });
  assert.equal(readOnly.length, 0);
});

test('bulk preview returns per-row validation via route handler', () => {
  const rows = parseBulkPaste('notification-targets', [
    'targetKind,targetId,channel,enabled,reason',
    'role,racing-secretary,in-app,true,Bulk notification target update for stewards',
    'bad,target-1,pager,true,short',
  ].join('\n'));
  const response = handleDataEntryRoute(
    dataEntryService,
    bulkService,
    'POST',
    '/data-entry/bulk/preview',
    { operationId: 'notification-targets', rows },
    scope,
  );
  assert.equal(response?.status, 200);
  assert.equal(response?.body.validCount, 1);
  assert.equal(response?.body.invalidCount, 1);
});

test('bulk commit applies valid rows and writes batch audit with partial failures', () => {
  const rows = parseBulkPaste('notification-targets', [
    'targetKind,targetId,channel,enabled,reason',
    'role,racing-secretary,in-app,true,Bulk notification target update for stewards',
    'bad,target-1,pager,true,short',
  ].join('\n'));
  const result = bulkService.commit('notification-targets', rows, scope, { commitValidOnly: true });
  assert.equal(result.acceptedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.ok(result.batchAuditId);
  assert.equal(result.rows.filter((row) => row.accepted).length, 1);
});

test('bulk commit denied for unauthorized role', () => {
  const rows = parseBulkPaste('notification-targets', [
    'targetKind,targetId,channel,enabled,reason',
    'role,racing-secretary,in-app,true,Bulk notification target update for stewards',
  ].join('\n'));
  assert.throws(
    () => bulkService.commit('notification-targets', rows, { ...scope, role: 'read-only-auditor' }),
    /cannot commit bulk operation/,
  );
});
