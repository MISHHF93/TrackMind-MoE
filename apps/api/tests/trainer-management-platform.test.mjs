import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  EquineIntelligencePlatform,
  ImmutableAuditLog,
  RaceOperationsPlatform,
  createSeededHorseRegistry,
  createSeededRaceCardManagement,
  createSeededTrainerManagement,
  createSeededBarnOperationsService,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

const config = { stewards: ['steward-1'], racingSecretary: 'sec-1', commission: 'NYSGC', rulesVersion: '2026.1', scratchDeadlineMinutes: 45, maxFieldSize: 14 };
const actor = { id: 'secretary', roles: ['racing-secretary'], human: true };

test('trainer management workspace exposes profiles licensing assignments performance compliance KPIs and links', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const racePlatform = new RaceOperationsPlatform({ approvalService, auditLog, tenantId: 'trackmind' });
  racePlatform.createMeet({ id: 'meet-tr', trackId: 'main-track', name: 'Trainer Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', status: 'open', officialConfig: config }, actor);
  racePlatform.createRaceDay({ id: 'day-tr', meetId: 'meet-tr', trackId: 'main-track', raceDate: '2026-06-14', status: 'entries-open' }, actor);
  racePlatform.createRaceCard('day-tr', { id: 'race-tr-1', trackId: 'main-track', raceDate: '2026-06-14', raceNumber: 1, scheduledPostTime: '2026-06-14T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 50000, eligibility: ['3up'] } }, actor);
  racePlatform.addEntry('race-tr-1', { id: 'entry-tr-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' }, actor.id);

  const equinePlatform = new EquineIntelligencePlatform({ auditLog });
  const horseRegistry = createSeededHorseRegistry({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const raceCardManagement = createSeededRaceCardManagement({ racePlatform, approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const barnOperations = createSeededBarnOperationsService();
  const trainerManagement = createSeededTrainerManagement({
    horseRegistry,
    raceCardManagement,
    barnOperations,
    auditLog,
    tenantId: 'trackmind',
    racetrackId: 'main-track',
  });

  const workspace = trainerManagement.workspace('2026-06-14T12:00:00.000Z');
  assert.equal(workspace.schemaVersion, 'trackmind.trainer-management.v1');
  assert.ok(workspace.trainers.length >= 1);
  const trainer = workspace.trainers.find((entry) => entry.trainerId === 'trainer-1');
  assert.ok(trainer);
  assert.equal(trainer.displayName, 'Trainer A');
  assert.equal(trainer.licensing.status, 'active');
  assert.ok(trainer.horseAssignments.length >= 1);
  assert.ok(trainer.stableAssignments.length >= 1);
  assert.ok(trainer.performanceHistory.length >= 1);
  assert.equal(trainer.compliancePosture.status, 'compliant');
  assert.ok(trainer.links.horseIds.includes('horse-1'));
  assert.ok(trainer.links.barnIds.includes('barn-2'));
  assert.ok(trainer.links.incidentIds.length >= 1);
  assert.ok(trainer.kpis.length >= 4);
  assert.ok(workspace.kpis.length >= 5);
  assert.deepEqual(validateContract('TrainerManagementWorkspaceDto', workspace, apiContractSchemas.TrainerManagementWorkspaceDto), { valid: true, errors: [] });
});

test('trainer management mutations are audit logged and maintain entity links', () => {
  const auditLog = new ImmutableAuditLog();
  const trainerManagement = createSeededTrainerManagement({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  trainerManagement.workspace('2026-06-14T12:00:00.000Z');

  const created = trainerManagement.createTrainer({
    trainerId: 'trainer-new',
    displayName: 'New Trainer',
    licensing: {
      licenseNumber: 'NY-TR-2002',
      issuingAuthority: 'NYSGC',
      jurisdiction: 'US-NY',
      status: 'active',
      issuedOn: '2025-01-01',
      expiresOn: '2028-01-01',
      restrictions: [],
      evidence: ['license-application'],
    },
  });
  assert.ok(created.auditId);

  trainerManagement.assignHorse('trainer-new', { horseId: 'horse-9', horseName: 'Speed Runner', assignedAt: '2026-06-01', evidence: ['assignment-form'] });
  trainerManagement.recordPerformance('trainer-new', { raceId: 'race-99', raceDate: '2026-06-10', trackId: 'main-track', horseId: 'horse-9', finishPosition: 2, status: 'completed', evidence: ['chart'] });
  trainerManagement.linkIncident('trainer-new', 'incident-sample-1');

  const profile = trainerManagement.getTrainer('trainer-new');
  assert.ok(profile.links.horseIds.includes('horse-9'));
  assert.ok(profile.links.raceIds.includes('race-99'));
  assert.ok(profile.links.incidentIds.includes('incident-sample-1'));

  const trail = trainerManagement.auditTrail('trainer-new');
  assert.ok(trail.records.length >= 4);
  assert.ok(trail.records.every((record) => record.hash && record.previousHash));
  assert.ok(auditLog.all().length >= 4);
});
