import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiFacadeState, createCqrsCommandHandler, handleApiRequest, InMemoryEventHubPublisher, EventSourcedStore } from '../dist/index.js';

test('race start command requires approval metadata before emitting RaceStartedEvent', async () => {
  const state = createApiFacadeState();
  const blocked = await handleApiRequest('POST', '/api/v1/races/race-7/start', {
    starterId: 'starter-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    model_id: 'model-race-readiness-v1',
    confidence: 0.91,
    evidence_links: ['readiness://race-7'],
  }, state);

  assert.equal(blocked.status, 403);
  assert.match(blocked.body.blockedReason, /approval_id/);

  const accepted = await handleApiRequest('POST', '/api/v1/races/race-7/start', {
    starterId: 'starter-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    approval_id: 'approval-race-start-1',
    approver_id: 'steward-1',
    approval_timestamp: '2026-06-14T18:00:00.000Z',
    model_id: 'model-race-readiness-v1',
    confidence: 0.91,
    evidence_links: ['readiness://race-7', 'approval://approval-race-start-1'],
    annex_iv_uri: 'https://trackmind.example/ai-act/annex-iv/race-readiness',
  }, state);

  assert.equal(accepted.status, 202);
  assert.equal(accepted.body.event.eventType, 'RaceStartedEvent');
  assert.equal(accepted.body.event.category, 'safety-critical');
  assert.equal(accepted.body.event.previousEventHash, 'genesis');
  assert.equal(accepted.body.event.governance.approval_id, 'approval-race-start-1');
  assert.equal(accepted.body.event.governance.approver_id, 'steward-1');
  assert.equal(accepted.body.event.ai.model_id, 'model-race-readiness-v1');
  assert.equal(accepted.body.projection.currentRaceState[0].status, 'running');

  const verification = await handleApiRequest('GET', '/api/v1/events/cqrs/hash-chain', undefined, state);
  assert.equal(verification.body.valid, true);
  assert.equal(verification.body.checked, 1);
});

test('monitoring commands are auto-approved but logged into projections and Event Hubs records', async () => {
  const publisher = new InMemoryEventHubPublisher('trackmind-eh-ns', 'domain-events');
  const store = new EventSourcedStore(publisher, { namespace: 'trackmind-eh-ns', hubName: 'domain-events' });
  const handler = createCqrsCommandHandler(store);

  const location = await handler.recordMonitoring({
    type: 'location_update',
    aggregateId: 'horse-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'gps-collar-1',
    ai: { confidence: 0.98, evidence_links: ['gps://collar-1'] },
    payload: { horseId: 'horse-1', zoneId: 'paddock', latitude: 38.04, longitude: -76.95 },
    occurredAt: '2026-06-14T18:00:10.000Z',
  });
  const camera = await handler.recordMonitoring({
    type: 'camera_detection',
    aggregateId: 'zone:paddock',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'camera-4',
    ai: { model_id: 'vision-zone-v2', confidence: 0.88, evidence_links: ['video://camera-4/frame-12'] },
    payload: { zoneId: 'paddock', subjectId: 'person-1' },
    occurredAt: '2026-06-14T18:00:12.000Z',
  });

  assert.equal(location.accepted, true);
  assert.equal(camera.accepted, true);
  assert.equal(location.event.governance.approval_id, undefined);
  assert.notEqual(camera.event.previousEventHash, 'genesis');

  const projection = handler.rebuildProjections();
  assert.deepEqual(projection.horseLocationHistory[0].history.map((entry) => entry.zoneId), ['paddock']);
  assert.ok(projection.securityZoneOccupancy.find((zone) => zone.zoneId === 'paddock').occupantIds.includes('person-1'));
  assert.equal(publisher.published().length, 2);
  assert.equal(publisher.published()[0].namespace, 'trackmind-eh-ns');
});

test('scratch and incident events rebuild race and security materialized views from replay', async () => {
  const handler = createCqrsCommandHandler();
  await handler.handle({
    id: 'cmd-scratch-1',
    type: 'scratch_decision',
    aggregateId: 'race-8',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'vet-1',
    approvalRequired: true,
    approvalId: 'approval-scratch-1',
    approverId: 'steward-1',
    approvalTimestamp: '2026-06-14T18:01:00.000Z',
    ai: { confidence: 0.8, evidence_links: ['exam://horse-1'] },
    payload: { raceId: 'race-8', horseId: 'horse-1', reason: 'vet scratch', scratchedAt: '2026-06-14T18:01:00.000Z' },
  });
  await handler.reportIncident({
    incidentId: 'incident-zone-1',
    raceId: 'race-8',
    zoneId: 'paddock',
    incidentType: 'restricted-zone-alert',
    severity: 'critical',
    description: 'Unauthorized restricted-zone occupancy.',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'security-1',
    approval_id: 'approval-incident-1',
    approver_id: 'security-lead-1',
    approval_timestamp: '2026-06-14T18:01:30.000Z',
    evidence_links: ['video://paddock/incident-zone-1'],
    confidence: 0.93,
  });

  const projection = handler.rebuildProjections();
  const race = projection.currentRaceState.find((item) => item.raceId === 'race-8');
  assert.ok(race.scratchedHorseIds.includes('horse-1'));
  assert.ok(race.incidentIds.includes('incident-zone-1'));
  const zone = projection.securityZoneOccupancy.find((item) => item.zoneId === 'paddock');
  assert.ok(zone.activeIncidentIds.includes('incident-zone-1'));
  assert.equal(handler.verifyHashChain().valid, true);
});

test('administrative events require batch approval metadata unless explicitly auto-batched', async () => {
  const handler = createCqrsCommandHandler();
  const blocked = await handler.handle({
    id: 'cmd-finance-1',
    type: 'finance_transfer',
    aggregateId: 'transfer-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'finance-service',
    payload: { amountCents: 10000, batchId: 'batch-1' },
  });
  assert.equal(blocked.accepted, false);
  assert.match(blocked.blockedReason, /batch approval/);

  const accepted = await handler.handle({
    id: 'cmd-ticket-1',
    type: 'ticket_sales',
    aggregateId: 'ticket-batch-1',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    actorId: 'ticketing-service',
    approvalRequired: false,
    payload: { tickets: 25, grossCents: 125000, batchPolicy: 'auto-approved-low-risk' },
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.event.category, 'administrative');
});
