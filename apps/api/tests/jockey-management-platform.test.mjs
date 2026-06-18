import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  RaceOperationsPlatform,
  createSeededRaceCardManagement,
  createSeededJockeyManagement,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

const config = { stewards: ['steward-1'], racingSecretary: 'sec-1', commission: 'NYSGC', rulesVersion: '2026.1', scratchDeadlineMinutes: 45, maxFieldSize: 14 };
const actor = { id: 'secretary', roles: ['racing-secretary'], human: true };

test('jockey management workspace exposes profiles assignments participation licensing analytics compliance eligibility and KPI dashboard', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const racePlatform = new RaceOperationsPlatform({ approvalService, auditLog, tenantId: 'trackmind' });
  racePlatform.createMeet({ id: 'meet-jk', trackId: 'main-track', name: 'Jockey Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', status: 'open', officialConfig: config }, actor);
  racePlatform.createRaceDay({ id: 'day-jk', meetId: 'meet-jk', trackId: 'main-track', raceDate: '2026-06-14', status: 'entries-open' }, actor);
  racePlatform.createRaceCard('day-jk', { id: 'race-jk-1', trackId: 'main-track', raceDate: '2026-06-14', raceNumber: 1, scheduledPostTime: '2026-06-14T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 50000, eligibility: ['3up'] } }, actor);
  racePlatform.addEntry('race-jk-1', { id: 'entry-jk-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' }, actor.id);
  racePlatform.declareEntry('race-jk-1', 'entry-jk-1', 'jockey-1', 124, actor.id);

  const raceCardManagement = createSeededRaceCardManagement({ racePlatform, approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const jockeyManagement = createSeededJockeyManagement({ raceCardManagement, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = jockeyManagement.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.jockey-management.v1');
  assert.ok(workspace.jockeys.length >= 1);
  const jockey = workspace.jockeys.find((entry) => entry.jockeyId === 'jockey-1');
  assert.ok(jockey);
  assert.ok(jockey.assignments.length >= 1);
  assert.ok(jockey.raceParticipation.length >= 1);
  assert.equal(jockey.licensing.status, 'active');
  assert.ok(jockey.performanceAnalytics.starts >= 1);
  assert.equal(jockey.eligibility.eligible, true);
  assert.ok(jockey.kpis.length >= 4);
  assert.ok(workspace.dashboard.panels.length >= 5);
  assert.ok(workspace.dashboard.totalStarts >= 1);
  assert.deepEqual(validateContract('JockeyManagementWorkspaceDto', workspace, apiContractSchemas.JockeyManagementWorkspaceDto), { valid: true, errors: [] });
});

test('jockey management mutations are audit logged with compliance and eligibility tracking', () => {
  const auditLog = new ImmutableAuditLog();
  const jockeyManagement = createSeededJockeyManagement({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  jockeyManagement.workspace('2026-06-14T12:00:00.000Z');

  const created = jockeyManagement.createJockey({
    jockeyId: 'jockey-new',
    displayName: 'Casey Wright',
    licensing: {
      licenseNumber: 'NY-JK-3003',
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

  jockeyManagement.recordAssignment('jockey-new', { horseId: 'horse-10', horseName: 'Fast Fleet', raceCardId: 'race-10', assignedAt: '2026-06-10', weightLbs: 118, postPosition: 4, evidence: ['assignment-form'] });
  jockeyManagement.recordParticipation('jockey-new', { raceId: 'race-10', raceDate: '2026-06-10', trackId: 'main-track', horseId: 'horse-10', finishPosition: 1, status: 'completed', earningsCents: 2500000, evidence: ['chart'] });
  jockeyManagement.addComplianceRecord('jockey-new', { recordedAt: '2026-06-10T20:00:00.000Z', category: 'conduct', summary: 'Careless riding inquiry opened', status: 'open', stewardInquiryId: 'inq-jockey-new', evidence: ['steward-report'] });
  jockeyManagement.updateEligibility('jockey-new', { eligible: false, status: 'under-review', flags: ['steward-inquiry-open'], failedRules: ['open-compliance-record'] });

  const profile = jockeyManagement.getJockey('jockey-new');
  assert.equal(profile.eligibility.eligible, false);
  assert.ok(profile.links.raceIds.includes('race-10'));
  assert.ok(profile.links.stewardInquiryIds.includes('inq-jockey-new'));
  assert.equal(profile.performanceAnalytics.wins, 1);

  const dashboard = jockeyManagement.kpiDashboard('2026-06-14T12:00:00.000Z');
  assert.ok(dashboard.panels.length >= 5);

  const trail = jockeyManagement.auditTrail('jockey-new');
  assert.ok(trail.records.length >= 5);
  assert.ok(trail.records.every((record) => record.hash && record.previousHash));
  assert.ok(auditLog.all().length >= 5);
});
