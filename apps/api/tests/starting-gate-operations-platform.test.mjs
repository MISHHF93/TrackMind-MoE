import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  RaceOperationsPlatform,
  createSeededRaceCardManagement,
  createSeededStartingGateOperations,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

const config = { stewards: ['steward-1'], racingSecretary: 'sec-1', commission: 'NYSGC', rulesVersion: '2026.1', scratchDeadlineMinutes: 45, maxFieldSize: 14 };
const actor = { id: 'starter', roles: ['steward'], human: true };

test('starting gate operations workspace exposes assignments readiness delays incidents and race readiness indicators', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const racePlatform = new RaceOperationsPlatform({ approvalService, auditLog, tenantId: 'trackmind' });
  racePlatform.createMeet({ id: 'meet-gate', trackId: 'main-track', name: 'Gate Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', status: 'open', officialConfig: config }, actor);
  racePlatform.createRaceDay({ id: 'day-gate', meetId: 'meet-gate', trackId: 'main-track', raceDate: '2026-06-14', status: 'entries-open' }, actor);
  racePlatform.createRaceCard('day-gate', { id: 'race-gate-1', trackId: 'main-track', raceDate: '2026-06-14', raceNumber: 1, scheduledPostTime: '2026-06-14T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 50000, eligibility: ['3up'] } }, actor);
  racePlatform.addEntry('race-gate-1', { id: 'entry-gate-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' }, actor.id);
  racePlatform.declareEntry('race-gate-1', 'entry-gate-1', 'jockey-1', 124, actor.id);
  racePlatform.drawPostPositions('race-gate-1', actor.id);
  racePlatform.assignGates('race-gate-1', 'G', actor.id);

  const raceCardManagement = createSeededRaceCardManagement({ racePlatform, approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const startingGateOperations = createSeededStartingGateOperations({ raceCardManagement, racePlatform, approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = startingGateOperations.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.starting-gate-operations.v1');
  assert.ok(workspace.assignments.length >= 1);
  assert.ok(workspace.readinessChecks.length >= 2);
  assert.equal(workspace.guardrails.mayAutoStartRace, false);
  assert.equal(workspace.guardrails.raceStartAutomation, false);
  assert.equal(workspace.guardrails.approvalGovernedWorkflows, true);
  assert.ok(workspace.approvalControls.every((control) => control.automatedExecutionBlocked === true));
  assert.ok(workspace.raceReadinessIndicators.length >= 6);
  assert.ok(workspace.dashboard.panels.length >= 5);
  assert.deepEqual(validateContract('StartingGateOperationsDto', workspace, apiContractSchemas.StartingGateOperationsDto), { valid: true, errors: [] });
});

test('starting gate delay and race-start approval mutations use approval workflows without starting races', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const startingGateOperations = createSeededStartingGateOperations({ approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const raceId = startingGateOperations.workspace().assignments[0]?.raceId ?? 'race-7';

  const approval = startingGateOperations.requestRaceStartApproval(raceId, {
    reason: 'Gate ready pending steward approval',
    evidence: ['crew-ready', 'horses-loaded'],
    requestedBy: 'starter-live',
  });
  assert.ok(approval.approvalRequestId);
  assert.match(approval.message, /Race start automation is disabled/i);

  const delay = startingGateOperations.reportDelay({
    raceId,
    reportedAt: '2026-06-14T12:00:00.000Z',
    reportedBy: 'starter-live',
    reason: 'Equipment adjustment at gate',
    estimatedMinutes: 8,
    status: 'active',
    evidence: ['gate-crew'],
  });
  assert.ok(delay.approvalRequestId);

  const workspace = startingGateOperations.workspace('2026-06-14T12:00:00.000Z');
  const raceStartIndicator = workspace.raceReadinessIndicators.find((indicator) => indicator.raceId === raceId && indicator.indicator === 'race-start-approval');
  assert.ok(raceStartIndicator);
  assert.equal(raceStartIndicator.status, 'approval-required');
  assert.ok(approvalService.allRequests().some((request) => request.action === 'race-start' && request.target === raceId));
  assert.ok(auditLog.all().length >= 1);
});
