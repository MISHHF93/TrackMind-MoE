import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, ImmutableAuditLog, RaceOperationsPlatform, RaceOperationsRepository, RacingCalendarPlatform } from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

const config = { stewards: ['steward-1'], racingSecretary: 'sec-1', commission: 'NYSGC', rulesVersion: '2026.1', scratchDeadlineMinutes: 45, maxFieldSize: 14 };

test('racing calendar workspace exposes seasons meets race days schedules conflicts readiness and KPIs', () => {
  const approvalService = new CentralizedApprovalService();
  const auditLog = new ImmutableAuditLog();
  const racePlatform = new RaceOperationsPlatform({ approvalService, auditLog, tenantId: 'tenant-1' });
  racePlatform.createMeet({ id: 'meet-cal', trackId: 'trk-1', name: 'Calendar Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', status: 'open', officialConfig: config }, { id: 'secretary', roles: ['racing-secretary'], human: true });
  racePlatform.createRaceDay({ id: 'day-cal', meetId: 'meet-cal', trackId: 'trk-1', raceDate: '2026-06-14', status: 'entries-open' }, { id: 'secretary', roles: ['racing-secretary'], human: true });
  racePlatform.createRaceCard('day-cal', { id: 'race-cal-1', trackId: 'trk-1', raceDate: '2026-06-14', raceNumber: 1, scheduledPostTime: '2026-06-14T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 50000, eligibility: ['3up'] } }, { id: 'secretary', roles: ['racing-secretary'], human: true });

  const calendar = new RacingCalendarPlatform({ racePlatform, approvalService, auditLog, tenantId: 'tenant-1', racetrackId: 'trk-1' });
  const workspace = calendar.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.racing-calendar.v1');
  assert.ok(workspace.seasons.length >= 1);
  assert.equal(workspace.meets.length, 1);
  assert.equal(workspace.raceDays.length, 1);
  assert.equal(workspace.schedules.length, 1);
  assert.ok(workspace.lifecycleLegend.includes('approved'));
  assert.ok(workspace.kpis.some((kpi) => kpi.kpiId === 'kpi-calendar-readiness'));
  assert.deepEqual(validateContract('RacingCalendarWorkspaceDto', workspace, apiContractSchemas.RacingCalendarWorkspaceDto), { valid: true, errors: [] });
});

test('racing calendar draft requests create approval-gated seasons meets days and schedules', () => {
  const approvalService = new CentralizedApprovalService();
  const racePlatform = new RaceOperationsPlatform({ approvalService, tenantId: 'tenant-1' });
  racePlatform.createMeet({ id: 'meet-base', trackId: 'trk-1', name: 'Base Meet', startsOn: '2026-07-01', endsOn: '2026-07-31', officialConfig: config }, { id: 'secretary', roles: ['racing-secretary'], human: true });
  const calendar = new RacingCalendarPlatform({ racePlatform, approvalService, tenantId: 'tenant-1', racetrackId: 'trk-1' });
  calendar.workspace('2026-06-14T12:00:00.000Z');
  const season = calendar.requestSeasonDraft({ label: 'Fall 2026', year: 2026, startsOn: '2026-09-01', endsOn: '2026-11-30' });
  assert.equal(season.approvalRequired, true);
  assert.ok(season.approvalId);
  const meet = calendar.requestMeetDraft({ seasonId: season.entityId, name: 'Fall Meet', startsOn: '2026-09-01', endsOn: '2026-09-30' });
  assert.equal(meet.entityKind, 'meet');
  const day = calendar.requestRaceDayDraft({ meetId: meet.entityId, raceDate: '2026-09-14' });
  assert.equal(day.entityKind, 'race-day');
  const schedule = calendar.requestScheduleDraft({ raceDayId: day.entityId, raceNumber: 3, scheduledPostTime: '2026-09-14T20:00:00Z', surface: 'turf', distanceFurlongs: 8 });
  assert.equal(schedule.entityKind, 'schedule');
  assert.ok(approvalService.allRequests().length >= 4);
});

test('racing calendar detects post-time and race-number collisions', () => {
  const repository = new RaceOperationsRepository();
  const racePlatform = new RaceOperationsPlatform({ repository, tenantId: 'tenant-1' });
  racePlatform.createMeet({ id: 'meet-conflict', trackId: 'trk-1', name: 'Conflict Meet', startsOn: '2026-06-01', endsOn: '2026-06-30', officialConfig: config }, { id: 'secretary', roles: ['racing-secretary'], human: true });
  racePlatform.createRaceDay({ id: 'day-conflict', meetId: 'meet-conflict', trackId: 'trk-1', raceDate: '2026-06-15' }, { id: 'secretary', roles: ['racing-secretary'], human: true });
  const base = { trackId: 'trk-1', raceDate: '2026-06-15', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Maiden', purse: 30000, eligibility: ['3yo'] }, entries: [], approvals: {}, regulatoryControls: ['HISA'], twinLinks: [], telemetryStreams: [], staffingAssignments: [], resources: [], updatedAt: '2026-06-15T12:00:00.000Z' };
  repository.saveRace({ ...base, id: 'race-a', raceNumber: 4, scheduledPostTime: '2026-06-15T19:00:00Z', status: 'scheduled' });
  repository.saveRace({ ...base, id: 'race-b', raceNumber: 4, scheduledPostTime: '2026-06-15T19:30:00Z', status: 'scheduled' });
  repository.saveDay({ id: 'day-conflict', meetId: 'meet-conflict', trackId: 'trk-1', raceDate: '2026-06-15', status: 'entries-open', raceIds: ['race-a', 'race-b'], updatedAt: '2026-06-15T12:00:00.000Z' });

  const calendar = new RacingCalendarPlatform({ racePlatform, tenantId: 'tenant-1', racetrackId: 'trk-1' });
  const conflicts = calendar.listConflicts('2026-06-15T12:00:00.000Z');
  assert.ok(conflicts.blockingCount >= 1);
  assert.ok(conflicts.conflicts.some((c) => c.kind === 'race-number-collision'));
});
