import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canAccessBulkOperation,
  listBulkOperations,
  parseBulkPaste,
  previewBulkOperation,
  selectBulkCommitRows,
} from '../dist/bulkDataEntry.js';

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-bulk-1',
};

test('bulk operations cover required workflows', () => {
  const ids = listBulkOperations().map((operation) => operation.id);
  for (const id of [
    'horse-import',
    'race-entries',
    'trainer-assignments',
    'jockey-assignments',
    'status-updates',
    'inspection-scheduling',
    'notification-targets',
    'kpi-thresholds',
  ]) {
    assert.ok(ids.includes(id), `missing bulk operation ${id}`);
  }
});

test('parseBulkPaste reads CSV headers and coerces booleans and numbers', () => {
  const rows = parseBulkPaste('notification-targets', [
    'targetKind,targetId,channel,enabled,reason',
    'role,racing-secretary,in-app,true,Bulk notification target update for stewards',
  ].join('\n'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].values.targetKind, 'role');
  assert.equal(rows[0].values.enabled, true);
});

test('previewBulkOperation validates rows and supports partial commit selection', () => {
  const rows = parseBulkPaste('notification-targets', [
    'targetKind,targetId,channel,enabled,reason',
    'role,racing-secretary,in-app,true,Bulk notification target update for stewards',
    'invalid,target-1,pager,true,short',
  ].join('\n'));
  const preview = previewBulkOperation('notification-targets', rows, scope);
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.invalidCount, 1);
  assert.equal(preview.canCommit, true);

  const selected = selectBulkCommitRows(preview, { commitValidOnly: true });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].valid, true);
});

test('admin role can access horse import bulk operation', () => {
  assert.equal(canAccessBulkOperation('horse-import', 'admin'), true);
  assert.equal(canAccessBulkOperation('horse-import', 'read-only-auditor'), false);
});

test('status-updates resolves paddock vs eligibility entity kinds', () => {
  const paddockRows = parseBulkPaste('status-updates', [
    'statusTarget,horseId,status,reason',
    'paddock,horse-1,complete,Race-day paddock status bulk update',
  ].join('\n'));
  const paddockPreview = previewBulkOperation('status-updates', paddockRows, scope);
  assert.equal(paddockPreview.rows[0].entityKind, 'paddock-record');

  const eligibilityRows = parseBulkPaste('status-updates', [
    'statusTarget,horseId,status,scratchStatus,reason',
    'eligibility,horse-1,active,scratched,Race-day eligibility bulk update',
  ].join('\n'));
  const eligibilityPreview = previewBulkOperation('status-updates', eligibilityRows, scope);
  assert.equal(eligibilityPreview.rows[0].entityKind, 'race-eligibility');
});
