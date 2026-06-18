import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  RaceOperationsPlatform,
  createSeededRaceCardManagement,
  createSeededPaddockOperations,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

const config = { stewards: ['steward-1'], racingSecretary: 'sec-1', commission: 'NYSGC', rulesVersion: '2026.1', scratchDeadlineMinutes: 45, maxFieldSize: 14 };
const actor = { id: 'secretary', roles: ['racing-secretary'], human: true };

test('paddock operations workspace exposes assignments arrivals inspections readiness personnel incidents and KPI dashboard', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const racePlatform = new RaceOperationsPlatform({ approvalService, auditLog, tenantId: 'trackmind' });
  racePlatform.createMeet({ id: 'meet-pad', trackId: 'main-track', name: 'Paddock Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', status: 'open', officialConfig: config }, actor);
  racePlatform.createRaceDay({ id: 'day-pad', meetId: 'meet-pad', trackId: 'main-track', raceDate: '2026-06-14', status: 'entries-open' }, actor);
  racePlatform.createRaceCard('day-pad', { id: 'race-pad-1', trackId: 'main-track', raceDate: '2026-06-14', raceNumber: 1, scheduledPostTime: '2026-06-14T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 50000, eligibility: ['3up'] } }, actor);
  racePlatform.addEntry('race-pad-1', { id: 'entry-pad-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' }, actor.id);
  racePlatform.declareEntry('race-pad-1', 'entry-pad-1', 'jockey-1', 124, actor.id);

  const raceCardManagement = createSeededRaceCardManagement({ racePlatform, approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const paddockOperations = createSeededPaddockOperations({ raceCardManagement, racePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = paddockOperations.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.paddock-operations.v1');
  assert.ok(workspace.assignments.length >= 1);
  assert.ok(workspace.arrivals.length >= 1);
  assert.ok(workspace.inspections.length >= 1);
  assert.ok(workspace.readinessChecks.length >= 1);
  assert.ok(workspace.personnelAssignments.length >= 1);
  assert.ok(workspace.raceDayLinks.raceIds.length >= 1);
  assert.ok(workspace.dashboard.panels.length >= 5);
  assert.deepEqual(validateContract('PaddockOperationsDto', workspace, apiContractSchemas.PaddockOperationsDto), { valid: true, errors: [] });
});

test('paddock operations mutations are audit logged and linked to race-day operations', () => {
  const auditLog = new ImmutableAuditLog();
  const paddockOperations = createSeededPaddockOperations({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  paddockOperations.workspace('2026-06-14T12:00:00.000Z');

  const created = paddockOperations.reportIncident({
    raceId: 'race-7',
    horseId: 'horse-2',
    reportedAt: '2026-06-14T12:00:00.000Z',
    reportedBy: 'paddock-judge',
    severity: 'medium',
    status: 'open',
    title: 'Loose horse near paddock gate',
    summary: 'Horse broke halter near paddock gate B.',
    zoneId: 'zone-paddock',
    evidence: ['security-camera'],
  });
  assert.ok(created.auditId);

  const incidentId = paddockOperations.workspace('2026-06-14T12:00:00.000Z').incidents.at(-1)?.incidentId;
  assert.ok(incidentId);
  paddockOperations.updateIncidentStatus(incidentId, 'contained');
  const workspace = paddockOperations.workspace('2026-06-14T12:00:00.000Z');
  assert.equal(workspace.incidents.at(-1)?.status, 'contained');

  const trail = paddockOperations.auditTrail(undefined, '2026-06-14T12:00:00.000Z');
  assert.ok(trail.records.length >= 3);
  assert.ok(trail.records.every((record) => record.hash && record.previousHash));
  assert.ok(auditLog.all().length >= 1);
});
