import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { createDataEntryService } from '../dist/dataEntry/dataEntryService.js';
import { handleDataEntryRoute } from '../dist/dataEntry/dataEntryRoutes.js';
import { buildReferenceCatalogFromWorkspace } from '@trackmind/shared';

const audit = { ledger: new ImmutableAuditLog() };
const service = createDataEntryService(audit);

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-dq-api-1',
};

const references = buildReferenceCatalogFromWorkspace({
  horses: [{ horseId: 'horse-1', lifecycleStatus: 'active' }],
  trainers: [{ trainerId: 'trainer-1', licenseStatus: 'active' }],
});

test('quality-validate route returns structured issues', () => {
  const response = handleDataEntryRoute(
    service,
    undefined,
    'POST',
    '/data-entry/quality-validate',
    {
      entityKind: 'trainer-assignment',
      mode: 'create',
      values: {
        horseId: 'horse-missing',
        trainerId: 'trainer-1',
        trainerName: 'Jane Smith',
        effectiveFrom: '2026-06-22',
        licenseStatus: 'active',
        dataSource: 'registry-import',
        reason: 'Bulk trainer assignment for import batch',
      },
      references,
    },
    scope,
  );
  assert.equal(response?.status, 422);
  assert.equal(response?.body.schemaVersion, 'trackmind.data-quality-validation.v1');
  assert.ok(Array.isArray(response?.body.issues));
  assert.ok(response?.body.issues.some((issue) => issue.code === 'stale-reference-missing'));
});

test('validate route accepts references for combined validation', () => {
  const response = handleDataEntryRoute(
    service,
    undefined,
    'POST',
    '/data-entry/validate',
    {
      entityKind: 'horse',
      mode: 'create',
      values: {
        name: 'Star Runner',
        dataSource: 'registry-import',
        reason: 'Horse import validation test batch',
      },
      references,
    },
    scope,
  );
  assert.equal(response?.status, 200);
  assert.equal(response?.body.valid, true);
});
