import assert from 'node:assert/strict';
import test from 'node:test';
import { CoordinatedBarnOperationsService, CentralizedApprovalService, DigitalTwinRuntime, EquineIntelligencePlatform, ImmutableAuditLog, RacetrackAssetRegistryService, UniversalEventBus } from '../dist/index.js';

const admin = { id:'admin-1', roles:['admin'], tenantId:'tenant-1' };
const steward = { id:'steward-1', roles:['steward'], tenantId:'tenant-1', human:true };
const superintendent = { id:'super-1', roles:['track-superintendent'], tenantId:'tenant-1', human:true };

function seeded() {
  const eventBus = new UniversalEventBus(); const auditLog = new ImmutableAuditLog(); const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const service = new CoordinatedBarnOperationsService({ eventBus, auditLog, approvals });
  service.createBarn(admin, { id:'barn-a', name:'Barn A', tenantId:'tenant-1', location:'Backstretch', status:'ready', capacity:2, incidentIds:['incident-1'], trainerIds:[] }, [{ id:'stall-a1', label:'A1' }, { id:'stall-a2', label:'A2' }]);
  return { service, eventBus, auditLog, approvals };
}

test('stall occupancy prevents double assignment', () => { const { service } = seeded(); service.assignHorse({ actor:admin, horseId:'horse-1', barnId:'barn-a', stallId:'stall-a1', assignedAt:'2026-06-13T00:00:00.000Z', reason:'arrival' }); assert.throws(() => service.assignHorse({ actor:admin, horseId:'horse-2', barnId:'barn-a', stallId:'stall-a1', assignedAt:'2026-06-13T00:01:00.000Z', reason:'arrival' }), /stall already occupied/); });

test('horse movement and stall changes emit events, immutable audit records, and Digital Twin patches', () => { const { service, eventBus, auditLog } = seeded(); service.assignHorse({ actor:admin, horseId:'horse-1', barnId:'barn-a', stallId:'stall-a1', assignedAt:'2026-06-13T00:00:00.000Z', reason:'arrival' }); const move = service.moveHorse({ actor:admin, horseId:'horse-1', toBarnId:'barn-a', toStallId:'stall-a2', movedAt:'2026-06-13T00:02:00.000Z', reason:'trainer requested adjacent stall' }); assert.equal(move.fromStallId, 'stall-a1'); assert.ok(eventBus.events({ type:'barn.horse.assigned', aggregateId:'horse-1' }).length >= 2); assert.equal(eventBus.events({ type:'barn.horse.moved', aggregateId:'horse-1' }).length, 1); assert.ok(eventBus.events({ type:'digital-twin.state.patch', aggregateId:'equine:horse-1' }).length >= 2); assert.equal(auditLog.verify().valid, true); assert.ok(auditLog.forensicTimeline({ subjectId:'horse-1' }).some((e)=>e.payload.action === 'horse.movement.recorded')); });

test('barn role permissions block read-only and steward stall mutations', () => { const { service } = seeded(); assert.throws(() => service.assignHorse({ actor:{ id:'auditor-1', roles:['read-only-auditor'], tenantId:'tenant-1' }, horseId:'horse-1', barnId:'barn-a', stallId:'stall-a1', assignedAt:'2026-06-13T00:00:00.000Z', reason:'bad' }), /Actor lacks stall:assign/); assert.throws(() => service.createRestriction({ actor:{ id:'steward-2', roles:['steward'], tenantId:'tenant-1' }, barnId:'barn-a', type:'security', reason:'bad', at:'2026-06-13T00:00:00.000Z' }), /Actor lacks restriction:manage/); });

test('restricted stall assignment requires approval policy token', () => { const { service, approvals } = seeded(); const request = approvals.createRequest({ id:'approval-stall-a2', tenantId:'tenant-1', action:'safety-critical-control', target:'stall-a2', requestedBy:'super-1', actorType:'human', reason:'quarantine exception', evidence:['human-approval-record'] }); approvals.decide(request.id, superintendent, 'approved', 'ops approve', ['human-approval-record'], '2026-06-13T00:01:00.000Z'); approvals.decide(request.id, steward, 'approved', 'steward approve', ['human-approval-record'], '2026-06-13T00:02:00.000Z'); const token = approvals.authorizeExecution({ requestId:request.id, action:'safety-critical-control', target:'stall-a2', tenantId:'tenant-1', actor:superintendent, now:'2026-06-13T00:03:00.000Z' }); service.createRestriction({ actor:admin, barnId:'barn-a', stallId:'stall-a2', type:'quarantine', reason:'monitor horse', at:'2026-06-13T00:03:00.000Z', approvalToken:token }); assert.throws(() => service.assignHorse({ actor:admin, horseId:'horse-9', barnId:'barn-a', stallId:'stall-a2', assignedAt:'2026-06-13T00:04:00.000Z', reason:'without token' }), /requires approval token/); const occ = service.assignHorse({ actor:admin, horseId:'horse-9', barnId:'barn-a', stallId:'stall-a2', assignedAt:'2026-06-13T00:04:00.000Z', reason:'approved exception', approvalToken:token }); assert.equal(occ.stallId, 'stall-a2'); });

test('barn assets, equine profile, runtime twins, events, and dashboard stay coordinated', async () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const twinRuntime = new DigitalTwinRuntime({ eventBus, auditLog });
  const assetRegistry = new RacetrackAssetRegistryService({ eventBus, auditLog });
  const equine = new EquineIntelligencePlatform();
  const equineActor = { id:'race-office-1', roles:['racing-secretary'], tenantId:'tenant-1', human:true };
  equine.createProfile({ horseId:'horse-42', tenantId:'tenant-1', name:'Integrated Runner', lifecycleStatus:'active' }, equineActor);
  const service = new CoordinatedBarnOperationsService({ eventBus, auditLog, twinRuntime, assetRegistry, equinePlatform:equine });
  service.createBarn(admin, { id:'barn-integrated', name:'Integrated Barn', tenantId:'tenant-1', location:'Backstretch', status:'ready', capacity:2, incidentIds:[], trainerIds:[] }, [{ id:'stall-i1', label:'I1' }, { id:'stall-i2', label:'I2' }]);
  const occ = service.assignHorse({ actor:admin, horseId:'horse-42', barnId:'barn-integrated', stallId:'stall-i1', assignedAt:'2026-06-13T01:00:00.000Z', reason:'arrival' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(occ.twinId, 'equine:horse-42');
  assert.equal(twinRuntime.getTwin('equine:horse-42').state.barnId, 'barn-integrated');
  assert.equal(equine.viewProfile('horse-42', equineActor).barnAssignments.at(-1).barnId, 'barn-integrated');
  assert.equal(assetRegistry.get('barn:barn-integrated', { id:'asset-reader', tenantId:'tenant-1', scopes:['assets:read'] }).assetType, 'Barn');
  assert.ok(eventBus.events({ type:'barn.asset.synced', aggregateId:'barn-integrated' }).length >= 1);
  const snapshot = service.snapshot();
  assert.equal(snapshot.dashboard.totalBarns, 1);
  assert.equal(snapshot.dashboard.occupiedStalls, 1);
  assert.ok(snapshot.assetLinks.some((link) => link.assetId === 'stall:stall-i1'));
  assert.ok(snapshot.twinSync.some((sync) => sync.twinId === 'equine:horse-42' && sync.status === 'synced'));
  assert.equal(auditLog.verify().valid, true);
});

test('restricted trainer and access assignments are approval and audit gated', () => {
  const { service, approvals, auditLog } = seeded();
  const pending = approvals.createRequest({ id:'approval-pending-barn-a', tenantId:'tenant-1', action:'safety-critical-control', target:'barn-a', requestedBy:'super-1', actorType:'human', reason:'restricted barn assignment review', evidence:['human-approval-record'] });
  const request = approvals.createRequest({ id:'approval-barn-a', tenantId:'tenant-1', action:'safety-critical-control', target:'barn-a', requestedBy:'super-1', actorType:'human', reason:'restricted barn assignment', evidence:['human-approval-record'] });
  approvals.decide(request.id, superintendent, 'approved', 'ops approve', ['human-approval-record'], '2026-06-13T00:01:00.000Z');
  approvals.decide(request.id, steward, 'approved', 'steward approve', ['human-approval-record'], '2026-06-13T00:02:00.000Z');
  const token = approvals.authorizeExecution({ requestId:request.id, action:'safety-critical-control', target:'barn-a', tenantId:'tenant-1', actor:superintendent, now:'2026-06-13T00:03:00.000Z' });
  service.inspect({ actor:admin, barnId:'barn-a', score:50, findings:['biosecurity watch'], at:'2026-06-13T00:03:00.000Z' });
  assert.throws(() => service.assignTrainer({ actor:admin, barnId:'barn-a', trainerId:'trainer-restricted', at:'2026-06-13T00:04:00.000Z' }), /requires approval token/);
  const assignment = service.assignTrainer({ actor:admin, barnId:'barn-a', trainerId:'trainer-restricted', at:'2026-06-13T00:04:00.000Z', approvalToken:token });
  const access = service.recordAccess({ actor:{ id:'security-9', roles:['security'], tenantId:'tenant-1' }, barnId:'barn-a', purpose:'restricted patrol', at:'2026-06-13T00:05:00.000Z', approvalToken:token });
  const snapshot = service.snapshot();

  assert.equal(assignment.approvalRequestId, 'approval-barn-a');
  assert.equal(access.approvalRequestId, 'approval-barn-a');
  assert.ok(snapshot.approvalRequests.some((approval) => approval.id === pending.id));
  assert.ok(snapshot.facilityReadiness[0].approvalRequired);
  assert.ok(auditLog.forensicTimeline({ subjectId:'barn-a' }).some((entry) => entry.payload.approvalToken?.requestId === 'approval-barn-a' || entry.payload.approvalRequestId === 'approval-barn-a'));
});
