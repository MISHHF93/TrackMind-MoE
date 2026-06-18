import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, ImmutableAuditLog, RaceOperationsPlatform, createSeededRaceCardManagement } from '../dist/index.js';
import { apiContractSchemas, raceCardLifecycleStatuses, validateContract } from '@trackmind/shared';

const config = { stewards: ['steward-1'], racingSecretary: 'sec-1', commission: 'NYSGC', rulesVersion: '2026.1', scratchDeadlineMinutes: 45, maxFieldSize: 14 };
const actor = { id: 'secretary', roles: ['racing-secretary'], human: true };

test('race card workspace exposes cards entries lifecycle and audit trail', () => {
  const approvalService = new CentralizedApprovalService();
  const auditLog = new ImmutableAuditLog();
  const racePlatform = new RaceOperationsPlatform({ approvalService, auditLog, tenantId: 'tenant-1' });
  racePlatform.createMeet({ id: 'meet-rc', trackId: 'trk-1', name: 'Card Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', status: 'open', officialConfig: config }, actor);
  racePlatform.createRaceDay({ id: 'day-rc', meetId: 'meet-rc', trackId: 'trk-1', raceDate: '2026-06-14', status: 'entries-open' }, actor);
  racePlatform.createRaceCard('day-rc', { id: 'race-rc-1', trackId: 'trk-1', raceDate: '2026-06-14', raceNumber: 1, scheduledPostTime: '2026-06-14T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 50000, eligibility: ['3up'] } }, actor);

  const platform = createSeededRaceCardManagement({ racePlatform, approvalService, auditLog, tenantId: 'tenant-1', racetrackId: 'trk-1' });
  const workspace = platform.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.race-card-management.v1');
  assert.ok(workspace.raceCards.length >= 1);
  assert.deepEqual(workspace.lifecycleLegend, [...raceCardLifecycleStatuses]);
  assert.ok(workspace.auditTrail.length >= 0);
  assert.deepEqual(validateContract('RaceCardWorkspaceDto', workspace, apiContractSchemas.RaceCardWorkspaceDto), { valid: true, errors: [] });
});

test('race card mutations audit entries assignments conditions purse and lifecycle', () => {
  const approvalService = new CentralizedApprovalService();
  const auditLog = new ImmutableAuditLog();
  const platform = createSeededRaceCardManagement({ approvalService, auditLog, tenantId: 'tenant-1', racetrackId: 'trk-1' });
  platform.workspace('2026-06-14T12:00:00.000Z');

  const created = platform.createCard({
    raceDayId: 'day-new',
    racetrackId: 'trk-1',
    raceDate: '2026-06-20',
    raceNumber: 5,
    scheduledPostTime: '2026-06-20T20:00:00Z',
    classification: { classLevel: 'Maiden Special Weight', stakesGrade: 'maiden' },
    purse: { basePurse: 35000, currency: 'USD' },
  });
  assert.equal(created.lifecycleStatus, 'draft');
  assert.ok(created.auditId);

  const entry = platform.addEntry(created.raceCardId, { horseId: 'horse-a', trainerId: 'trainer-a', ownerIds: ['owner-a'] });
  assert.equal(entry.eventType, 'race-card.entry.added.v1');

  const card = platform.getCard(created.raceCardId);
  const entryId = card.entries[0].id;
  platform.assignJockey(created.raceCardId, entryId, 'jockey-a');
  platform.assignPostPosition(created.raceCardId, entryId, 3);
  platform.updateConditions(created.raceCardId, { distanceFurlongs: 7, surface: 'turf' });
  platform.updatePurse(created.raceCardId, { basePurse: 40000 });

  const review = platform.transitionLifecycle(created.raceCardId, 'review');
  assert.equal(review.lifecycleStatus, 'review');
  const approved = platform.transitionLifecycle(created.raceCardId, 'approved');
  assert.equal(approved.approvalRequired, true);
  assert.ok(approved.approvalId);

  const trail = platform.auditTrail(created.raceCardId);
  assert.ok(trail.length >= 6);
  assert.ok(trail.every((record) => record.hash && record.previousHash));
  assert.ok(auditLog.all().length >= 6);
});
