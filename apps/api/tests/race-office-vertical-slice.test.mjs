import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, DigitalTwinRuntime, ImmutableAuditLog, RaceOperationsPlatform, RaceOperationsRepository, UniversalEventBus } from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

const config = { stewards:['steward-1'], racingSecretary:'sec-1', commission:'NYSGC', rulesVersion:'2026.1', scratchDeadlineMinutes:45, maxFieldSize:14 };
const condition = { surface:'dirt', distanceFurlongs:6, classLevel:'Allowance', purse:90000, eligibility:['3up'] };
const human = (id, roles) => ({ id, roles, human:true });
const approveRequest = (approvalService, request, action, target, approvers, now = '2026-06-14T17:30:00Z') => {
  approvers.forEach(([id, roles], index) => approvalService.decide(request.id, human(id, roles), 'approved', `approved step ${index + 1}`, ['human-approval-record'], `2026-06-14T17:${31 + index}:00Z`));
  return approvalService.authorizeExecution({ requestId:request.id, action, target, tenantId:'tenant-1', actor:human('executor', ['admin']), now });
};

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

test('race office enforces scheduling rules, approved condition changes, readiness, and twin sync', async () => {
  const approvalService = new CentralizedApprovalService();
  const auditLog = new ImmutableAuditLog();
  const eventBus = new UniversalEventBus();
  const twinRuntime = new DigitalTwinRuntime({ eventBus, auditLog });
  twinRuntime.registerAsset({
    assetId:'RACE_OPS_3', tenantId:'tenant-1', externalIds:['race-ops-3'], name:'Race Ops 3 Twin', assetType:'RaceCard', domain:'racing', lifecycleStatus:'active', riskLevel:'medium',
    maintenance:{ status:'ok' }, ownership:{ ownerAgent:'RaceOps', stewardTeam:'race-office' }, location:{ trackId:'trk-1' }, state:{ raceStatus:'scheduled' },
    controls:[], sensors:[], regulations:[{ authority:'HISA', reference:'race-card', appliesTo:['race-office'] }], tags:['race-office'], digitalTwin:{ twinId:'twin:RACE_OPS_3', relationship:'represents' }, approvalPolicyId:'standard-asset-approval',
    createdAt:'2026-06-14T16:00:00Z', updatedAt:'2026-06-14T16:00:00Z', version:1, metadata:{}
  });
  const seen = [];
  eventBus.subscribe('*', (event) => seen.push(event), { name:'race-office-integration-spy' });
  const platform = new RaceOperationsPlatform({ approvalService, auditLog, eventBus, twinRuntime, tenantId:'tenant-1' });
  const tightConfig = { ...config, maxFieldSize:2 };

  platform.createMeet({ id:'meet-3', trackId:'trk-1', name:'Fall Meet', startsOn:'2026-06-01', endsOn:'2026-06-30', officialConfig:tightConfig }, { id:'secretary', roles:['racing-secretary'] });
  platform.createRaceDay({ id:'day-3', meetId:'meet-3', trackId:'trk-1', raceDate:'2026-06-14' }, { id:'secretary', roles:['racing-secretary'] });
  platform.createRaceCard('day-3', { id:'race-ops-3', trackId:'ignored', raceDate:'ignored', raceNumber:3, scheduledPostTime:'2026-06-14T18:00:00Z', conditions:condition, twinLinks:['twin:RACE_OPS_3'] }, { id:'secretary', roles:['racing-secretary'] });
  assert.throws(() => platform.createRaceCard('day-3', { id:'race-conflict', trackId:'ignored', raceDate:'ignored', raceNumber:3, scheduledPostTime:'2026-06-14T18:05:00Z', conditions:condition }, { id:'secretary', roles:['racing-secretary'] }), /schedule conflict/);

  platform.addEntry('race-ops-3', { id:'entry-a', horseId:'horse-a', trainerId:'trainer-a', ownerId:'owner-a' });
  platform.addEntry('race-ops-3', { id:'entry-b', horseId:'horse-b', trainerId:'trainer-b', ownerId:'owner-b' });
  platform.addEntry('race-ops-3', { id:'entry-c', horseId:'horse-c', trainerId:'trainer-c', ownerId:'owner-c' });
  platform.declareEntry('race-ops-3', 'entry-a', 'jockey-a', 124);
  platform.declareEntry('race-ops-3', 'entry-b', 'jockey-b', 122);
  assert.throws(() => platform.declareEntry('race-ops-3', 'entry-c', 'jockey-c', 120), /field exceeds/);
  platform.closeDeclarations('race-ops-3');
  platform.drawPostPositions('race-ops-3', 42);
  platform.assignGates('race-ops-3', 'MAIN');
  assert.equal(platform.assessReadiness('race-ops-3', [{ streamId:'weather', type:'weather', observedAt:'2026-06-14T17:40:00Z', healthy:true, value:'clear' }]).ready, false);
  platform.coordinateStaffing('race-ops-3', { stewards:['steward-1'], veterinarians:['vet-1'], gateCrew:['gate-1'], outriders:['out-1'], trackMaintenance:['maint-1'], security:['sec-1'] });
  platform.allocateResources('race-ops-3', [{ id:'gate-main', type:'starting-gate', zone:'chute', status:'allocated' }]);
  for (const step of ['racingOffice','stewards','veterinarian']) platform.approveWorkflow('race-ops-3', step, 'approved');
  assert.equal(platform.assessReadiness('race-ops-3', [{ streamId:'weather', type:'weather', observedAt:'2026-06-14T17:45:00Z', healthy:true, value:'clear' }]).ready, true);

  const distanceReq = platform.requestSafetyCriticalAction('race-distance-configuration', 'race-ops-3', 'Approved distance correction', { id:'secretary', roles:['racing-secretary'] });
  const distanceToken = approveRequest(approvalService, distanceReq, 'race-distance-configuration', 'race-ops-3', [['secretary', ['racing-secretary']], ['surface-ops', ['track-superintendent']], ['steward-1', ['steward']]]);
  assert.equal(platform.updateConditionsWithApproval('race-ops-3', { distanceFurlongs:8.5 }, distanceToken).conditions.distanceFurlongs, 8.5);
  const scheduleReq = platform.requestSafetyCriticalAction('race-office-configuration', 'race-ops-3', 'Move post time after approved operational hold', { id:'secretary', roles:['racing-secretary'] });
  const scheduleToken = approveRequest(approvalService, scheduleReq, 'race-office-configuration', 'race-ops-3', [['secretary', ['racing-secretary']], ['surface-ops', ['track-superintendent']], ['steward-1', ['steward']]]);
  assert.equal(platform.rescheduleRaceWithApproval('race-ops-3', '2026-06-14T18:10:00Z', scheduleToken).scheduledPostTime, '2026-06-14T18:10:00Z');

  const workspace = platform.raceOfficeWorkspace('2026-06-14T17:50:00Z');
  assert.deepEqual(validateContract('RaceOfficeWorkspaceDto', workspace, apiContractSchemas.RaceOfficeWorkspaceDto), { valid:true, errors:[] });
  assert.equal(workspace.cards[0].conditions.distanceFurlongs, 8.5);
  assert.equal(workspace.cards[0].entries.filter((entry) => entry.declared && !entry.scratched).length, 2);
  assert.equal(workspace.lifecycle[0].nextAction, 'request race-start approval');
  assert.ok(workspace.approvalControls.some((control) => control.action === 'race-distance-configuration' && control.approvalApi.includes('/track-configuration/draft-requests')));
  assert.ok(workspace.approvalControls.every((control) => control.locked && control.safetyCritical));
  assert.ok(auditLog.forensicTimeline({ subjectId:'race-ops-3' }).some((entry) => entry.correlationId?.includes('race.schedule.changed')));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(seen.some((event) => event.type === 'race.conditions.updated'));
  assert.equal(twinRuntime.getTwin('twin:RACE_OPS_3').state.scheduledPostTime, '2026-06-14T18:10:00Z');
});
