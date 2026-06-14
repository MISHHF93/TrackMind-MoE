import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackMindCommandCenterV1Service } from '../dist/index.js';

const evidence = ['human-approval-record'];

test('Command Center v1 exposes safe endpoint snapshot resources', () => {
  const service = new TrackMindCommandCenterV1Service();
  const snapshot = service.snapshot();
  assert.ok(snapshot.assets.some((asset) => asset.id === 'gate-1'));
  assert.ok(snapshot.trackSectors.some((sector) => sector.id === 'backstretch'));
  assert.equal(snapshot.gatePosition.gateId, 'gate-1');
  assert.equal(snapshot.raceDistanceConfiguration.raceId, 'race-7');
  assert.ok(Array.isArray(snapshot.pendingApprovals));
  assert.ok(Array.isArray(snapshot.auditEvents));
  assert.equal(snapshot.digitalTwinState[0].assetId, 'gate-1');
});

test('starting gate move drafts require approval before Digital Twin state changes', () => {
  const service = new TrackMindCommandCenterV1Service();
  const before = service.snapshot().digitalTwinState[0].version;
  const request = service.createGateMoveDraft({ tenantId: 'track-1', targetSectorId: 'chute', targetMetersFromStart: 120, requestedBy: 'starter-1', reason: 'Distance change setup', evidence: ['gps-plan'] });
  assert.equal(request.action, 'starting-gate-move');
  assert.equal(request.status, 'pending');
  assert.equal(service.snapshot().digitalTwinState[0].version, before);
  assert.throws(() => service.applyApprovedGateMove({ token: undefined, sectorId: 'chute', metersFromStart: 120, actor: 'starter-1' }), /requires approval token/);

  service.approve(request.id, { id: 'secretary-1', roles: ['racing-secretary'], human: true }, 'Race office confirms distance', evidence);
  service.approve(request.id, { id: 'super-1', roles: ['track-superintendent'], human: true }, 'Track ops confirms safe move', evidence);
  const token = service.authorize(request.id, 'starting-gate-move', 'gate-1', 'track-1', { id: 'super-1', roles: ['track-superintendent'], human: true });
  const position = service.applyApprovedGateMove({ token, sectorId: 'chute', metersFromStart: 120, actor: 'starter-1' });
  assert.equal(position.sectorId, 'chute');
  assert.equal(service.snapshot().digitalTwinState[0].version, before + 1);
  assert.ok(service.snapshot().auditEvents.some((event) => event.type === 'configuration-change'));
});

test('race distance configuration follows approval-gated audit and event pattern', () => {
  const service = new TrackMindCommandCenterV1Service();
  const request = service.createRaceDistanceDraft({ tenantId: 'track-1', raceId: 'race-7', distanceMeters: 1400, gateSectorId: 'chute', requestedBy: 'secretary-1', reason: 'Race card update', evidence: ['conditions-book-change'] });
  assert.equal(request.action, 'race-distance-configuration');
  service.approve(request.id, { id: 'secretary-1', roles: ['racing-secretary'], human: true }, 'Race office approved', evidence);
  service.approve(request.id, { id: 'super-1', roles: ['track-superintendent'], human: true }, 'Track operations approved', evidence);
  service.approve(request.id, { id: 'steward-1', roles: ['steward'], human: true }, 'Stewards approved', evidence);
  const token = service.authorize(request.id, 'race-distance-configuration', 'race-7', 'track-1', { id: 'steward-1', roles: ['steward'], human: true });
  const configuration = service.applyApprovedRaceDistance({ token, raceId: 'race-7', distanceMeters: 1400, gateSectorId: 'chute', actor: 'secretary-1' });
  assert.equal(configuration.distanceMeters, 1400);
  assert.ok(service.snapshot().auditEvents.length >= 4);
  assert.ok(service.snapshot().digitalTwinState[0].state.raceDistanceConfiguration.approvedRequestId);
});
