import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ImmutableAuditLog,
  createSeededVeterinaryOperations,
  resolveVeterinaryAccess,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('veterinary operations workspace exposes records examinations observations treatments clearance welfare and privacy context', () => {
  const auditLog = new ImmutableAuditLog();
  const platform = createSeededVeterinaryOperations({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const vetAccess = resolveVeterinaryAccess('vet-live', 'veterinarian');
  const workspace = platform.workspace('2026-06-14T12:00:00.000Z', vetAccess);

  assert.equal(workspace.schemaVersion, 'trackmind.veterinary-operations.v1');
  assert.ok(workspace.cases.length >= 2);
  const horse1 = workspace.cases.find((entry) => entry.horseId === 'horse-1');
  assert.ok(horse1);
  assert.ok(horse1.records.length >= 1);
  assert.ok(horse1.examinations.length >= 1);
  assert.ok(horse1.observations.length >= 1);
  assert.ok(horse1.treatments.length >= 1);
  assert.ok(horse1.clearanceWorkflows.length >= 1);
  assert.ok(horse1.welfareIndicators.length >= 1);
  assert.equal(horse1.records.some((entry) => entry.redacted), false);
  assert.ok(workspace.dashboard.panels.length >= 5);
  assert.deepEqual(validateContract('VeterinaryOperationsWorkspaceDto', workspace, apiContractSchemas.VeterinaryOperationsWorkspaceDto), { valid: true, errors: [] });
});

test('veterinary operations redacts confidential records for unauthorized roles and audits all access', () => {
  const auditLog = new ImmutableAuditLog();
  const platform = createSeededVeterinaryOperations({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const secretaryAccess = resolveVeterinaryAccess('racing-secretary-live', 'racing-secretary');
  const horseCase = platform.getCase('horse-1', secretaryAccess, '2026-06-14T12:00:00.000Z');

  assert.ok(horseCase);
  assert.ok(horseCase.records.every((entry) => entry.redacted === true));
  assert.ok(horseCase.examinations.every((entry) => entry.redacted === true));
  assert.ok(horseCase.treatments.every((entry) => entry.treatmentType && entry.summary === 'Restricted treatment detail'));
  assert.equal(horseCase.records[0]?.medication, undefined);
  assert.equal(horseCase.records[0]?.diagnosis, undefined);

  const trail = platform.auditTrail('horse-1');
  assert.ok(trail.records.some((record) => record.action === 'veterinary-operations.case.read'));
  assert.ok(trail.records.every((record) => record.hash && record.previousHash));
  assert.ok(auditLog.all().length >= 1);
});

test('veterinary operations mutations require veterinarian role and are audit logged', () => {
  const auditLog = new ImmutableAuditLog();
  const platform = createSeededVeterinaryOperations({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const vetAccess = resolveVeterinaryAccess('vet-live', 'veterinarian');
  const secretaryAccess = resolveVeterinaryAccess('secretary', 'racing-secretary');

  assert.throws(
    () => platform.addRecord('horse-1', {
      recordedAt: '2026-06-14T12:00:00.000Z',
      veterinarianId: 'vet-live',
      category: 'examination',
      summary: 'Should fail',
      privacyScope: 'veterinary-confidential',
      evidence: [],
    }, secretaryAccess),
    /Veterinary write operations require veterinarian role/,
  );

  const created = platform.addRecord('horse-1', {
    recordedAt: '2026-06-14T13:00:00.000Z',
    veterinarianId: 'vet-live',
    category: 'clearance',
    summary: 'Post-exam clearance note',
    privacyScope: 'racing-officials',
    evidence: ['clearance-form'],
  }, vetAccess);
  assert.ok(created.auditId);

  const horseBeforeClearance = platform.getCase('horse-1', vetAccess);
  assert.ok(horseBeforeClearance);
  assert.ok(horseBeforeClearance.clearanceWorkflows[0]);
  platform.advanceClearanceWorkflow('horse-1', horseBeforeClearance.clearanceWorkflows[0].workflowId, { status: 'cleared', evidence: ['steward-signoff'] }, vetAccess);
  const updated = platform.getCase('horse-1', vetAccess);
  assert.ok(updated);
  assert.equal(updated.clearanceWorkflows.at(-1)?.status, 'cleared');
  assert.ok(platform.auditTrail('horse-1').records.length >= 3);
});
