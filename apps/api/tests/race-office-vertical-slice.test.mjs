import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, ImmutableAuditLog, RaceOperationsPlatform, RaceOperationsRepository, UniversalEventBus } from '../dist/index.js';

const config = { stewards:['steward-1'], racingSecretary:'sec-1', commission:'NYSGC', rulesVersion:'2026.1', scratchDeadlineMinutes:45, maxFieldSize:14 };
const condition = { surface:'dirt', distanceFurlongs:6, classLevel:'Allowance', purse:90000, eligibility:['3up'] };

test('race office vertical slice persists meet day card and emits audit/events for lifecycle', async () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new UniversalEventBus();
  const seen = [];
  eventBus.subscribe('*', (event) => seen.push(event), { name:'race-office-spy' });
  const repository = new RaceOperationsRepository();
  const platform = new RaceOperationsPlatform({ auditLog, eventBus, repository, tenantId:'tenant-1' });
  platform.createMeet({ id:'meet-1', trackId:'trk-1', name:'Spring Meet', startsOn:'2026-06-01', endsOn:'2026-06-30', officialConfig:config }, { id:'secretary', roles:['racing-secretary'] });
  platform.createRaceDay({ id:'day-1', meetId:'meet-1', trackId:'trk-1', raceDate:'2026-06-14' }, { id:'secretary', roles:['racing-secretary'] });
  const card = platform.createRaceCard('day-1', { id:'race-1', trackId:'ignored', raceDate:'ignored', raceNumber:1, scheduledPostTime:'2026-06-14T18:00:00Z', conditions:condition }, { id:'secretary', roles:['racing-secretary'] });
  platform.addEntry(card.id, { id:'entry-1', horseId:'horse-1', trainerId:'trainer-1', ownerId:'owner-1' });
  platform.declareEntry(card.id, 'entry-1', 'jockey-1', 124);
  platform.drawPostPositions(card.id);
  assert.equal(platform.listMeets('trk-1').length, 1);
  assert.equal(platform.listRaceDays({ meetId:'meet-1' })[0].raceIds[0], 'race-1');
  assert.ok(auditLog.forensicTimeline({ subjectId:'race-1' }).length >= 4);
  assert.ok(seen.some((event) => event.type === 'race.card.created'));
  assert.ok(platform.apiDefinition().endpoints.some((endpoint) => endpoint.path.includes('/race-days/{dayId}/cards')));
});

test('race office validates roles and approval-required scratch/config/status actions', () => {
  const approvalService = new CentralizedApprovalService();
  const platform = new RaceOperationsPlatform({ approvalService, tenantId:'tenant-1' });
  assert.throws(() => platform.createMeet({ id:'bad', trackId:'trk-1', name:'Bad', startsOn:'2026-06-01', endsOn:'2026-06-30', officialConfig:config }, { id:'auditor', roles:['read-only-auditor'] }), /lacks/);
  platform.createMeet({ id:'meet-2', trackId:'trk-1', name:'Summer Meet', startsOn:'2026-06-01', endsOn:'2026-06-30', officialConfig:config }, { id:'secretary', roles:['racing-secretary'] });
  platform.createRaceDay({ id:'day-2', meetId:'meet-2', trackId:'trk-1', raceDate:'2026-06-14' }, { id:'secretary', roles:['racing-secretary'] });
  platform.createRaceCard('day-2', { id:'race-2', trackId:'trk-1', raceDate:'2026-06-14', raceNumber:2, scheduledPostTime:'2026-06-14T19:00:00Z', conditions:condition }, { id:'secretary', roles:['racing-secretary'] });
  platform.addEntry('race-2', { id:'entry-2', horseId:'horse-2', trainerId:'trainer-2', ownerId:'owner-2' });
  assert.throws(() => platform.scratchEntryWithApproval('race-2', 'entry-2', 'vet', undefined), /requires approval token/);
  const req = platform.requestSafetyCriticalAction('race-office-scratch', 'race-2', 'Vet scratch', { id:'secretary', roles:['racing-secretary'] });
  approvalService.decide(req.id, { id:'vet-1', roles:['veterinarian'], human:true }, 'approved', 'exam complete', ['human-approval-record']);
  approvalService.decide(req.id, { id:'steward-1', roles:['steward'], human:true }, 'approved', 'panel approved', ['human-approval-record']);
  const token = approvalService.authorizeExecution({ requestId:req.id, action:'race-office-scratch', target:'race-2', tenantId:'tenant-1', actor:{ id:'steward-1', roles:['steward'], human:true } });
  assert.equal(platform.scratchEntryWithApproval('race-2', 'entry-2', 'vet', token).entries[0].scratched, true);
  const cancelReq = platform.requestSafetyCriticalAction('race-cancellation', 'race-2', 'weather', { id:'steward-1', roles:['steward'] });
  approvalService.decide(cancelReq.id, { id:'steward-1', roles:['steward'], human:true }, 'approved', 'unsafe weather', ['human-approval-record']);
  const cancelToken = approvalService.authorizeExecution({ requestId:cancelReq.id, action:'race-cancellation', target:'race-2', tenantId:'tenant-1', actor:{ id:'steward-1', roles:['steward'], human:true } });
  assert.equal(platform.changeRaceStatus('race-2', 'cancelled', cancelToken).status, 'cancelled');
});
