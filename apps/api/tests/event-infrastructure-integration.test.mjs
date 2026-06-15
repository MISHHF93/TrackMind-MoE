import test from 'node:test';
import assert from 'node:assert/strict';
import { bindAuditLogToEvents, DigitalTwinRuntime, ImmutableAuditLog, RacetrackAssetRegistryService, UniversalEventBus } from '../dist/index.js';

const principal = { id: 'ops-user', scopes: ['assets:write', 'assets:read', 'assets:approve'], tenantId: 'trk-1' };
const owner = { service: 'ops-command', team: 'Racing Operations', accountableRole: 'Operations Controller' };
const assetInput = {
  assetId: 'EVENT_GATE_01',
  externalIds: ['event-gate-01'],
  name: 'Event Starting Gate',
  assetType: 'StartingGate',
  domain: 'racing',
  riskLevel: 'high',
  maintenance: { status: 'ok', lastInspectionAt: '2026-06-13T08:00:00Z' },
  ownership: { ownerAgent: 'RaceOps', stewardTeam: 'gate-crew' },
  location: { railPositionMeters: 1200 },
  state: { batteryStatus: 72, locked: true },
  controls: [{ name: 'lock-status', category: 'C_HUMAN_CONTROLLED', description: 'Confirm lock before start.', requiresApprovalFrom: ['Starter'], executionMode: 'human-only' }],
  sensors: [{ id: 'event-gate-battery-01', type: 'battery', verifies: ['batteryStatus'], required: true }],
  regulations: [{ authority: 'StateRacingCommission', reference: 'Start procedures', appliesTo: ['lock-status'] }],
  tags: ['gate'],
  approvalPolicyId: 'critical-asset-dual-control',
  metadata: { dependsOn: ['twin:POWER_PANEL_01'] },
};

test('event infrastructure propagates operational actions into audit logs and digital twins', async () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const signals = [];
  eventBus.onSignal((signal) => signals.push(signal));
  bindAuditLogToEvents(eventBus, auditLog);
  const runtime = new DigitalTwinRuntime({ eventBus, auditLog });
  const registry = new RacetrackAssetRegistryService({ eventBus, auditLog });

  await registry.create(assetInput, principal);

  const createdEvents = eventBus.events({ type: 'racetrack.asset.created', aggregateId: 'EVENT_GATE_01' });
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0].correlationId.startsWith('corr-'), true);
  assert.equal(createdEvents[0].trace.traceId.length > 0, true);
  assert.equal(createdEvents[0].schemaRef, 'racetrack.asset.created.v1');

  const twin = runtime.queryTwins({ assetId: 'EVENT_GATE_01' })[0];
  assert.equal(twin.twinId, 'twin:EVENT_GATE_01');
  assert.equal(twin.eventHistory[0].sourceEventId, createdEvents[0].id);

  const auditRecords = auditLog.all();
  assert.ok(auditRecords.some((entry) => entry.id === `audit:${createdEvents[0].id}` && entry.payload.eventType === 'racetrack.asset.created.v1'));
  assert.ok(auditRecords.some((entry) => entry.type === 'digital-twin-update' && entry.subjectId === 'twin:EVENT_GATE_01'));
  assert.equal(auditLog.verify().valid, true);
  assert.ok(signals.some((signal) => signal.name === 'handler.delivered' && signal.handlerName === 'digital-twin-runtime'));
});

test('event contracts validate schemas, expose discovery, version events, replay streams, and process dead letters', async () => {
  const bus = new UniversalEventBus();
  bus.registerProducer({ name: 'ops-command', service: 'ops-command', emits: ['ops.action.requested'], owner });
  bus.registerEvent({
    type: 'ops.action.requested',
    version: 2,
    description: 'Operational command event contract',
    owner,
    payloadFields: ['actionId', 'target'],
    compliance: 'regulated',
    examples: [{ actionId: 'ACT-1', target: 'gate', priority: 'high' }],
    validate: (payload) => payload.priority === 'high' || ['priority must be high'],
  });

  const propagated = [];
  bus.registerConsumer({ name: 'ops-projection', service: 'ops-read-model', consumes: ['ops.action.requested'], owner });
  bus.consumer('ops-projection').subscribe('ops.action.requested', (event) => propagated.push(event));
  await assert.rejects(() => bus.producer('ops-command').publish({ type: 'ops.action.requested', version: 2, payload: { actionId: 'ACT-0' } }), /schema validation/);

  const event = await bus.producer('ops-command').publish({
    type: 'ops.action.requested',
    version: 2,
    payload: { actionId: 'ACT-1', target: 'gate', priority: 'high' },
    correlationId: 'corr-action-1',
    aggregateId: 'action:ACT-1',
    trace: { traceId: 'trace-action-1', spanId: 'span-action-1' },
  });
  assert.equal(propagated.length, 1);
  assert.equal(event.version, 2);
  assert.equal(event.correlationId, 'corr-action-1');
  assert.equal(event.trace.traceId, 'trace-action-1');

  let deadLetterAttempts = 0;
  bus.subscribe('ops.action.requested', () => { deadLetterAttempts += 1; throw new Error('offline projection'); }, { name: 'offline-projection', retry: { maxAttempts: 1 } });
  await bus.producer('ops-command').publish({ type: 'ops.action.requested', version: 2, payload: { actionId: 'ACT-2', target: 'gate', priority: 'high' } });
  assert.equal(bus.deadLetterQueue().length, 1);
  const processed = await bus.processDeadLetters({ handlerName: 'offline-projection' });
  assert.equal(processed.retried, 1);
  assert.equal(deadLetterAttempts, 2);

  const replayed = await bus.replay({ type: 'ops.action.requested', fromSequence: 1 });
  assert.equal(replayed.length, 2);
  const discovery = bus.discover({ ownerService: 'ops-command' });
  assert.ok(discovery.events.some((contract) => contract.schemaRef === 'ops.action.requested.v2' && contract.latest));
  assert.ok(discovery.producers.some((producer) => producer.name === 'ops-command'));
  assert.ok(discovery.consumers.some((consumer) => consumer.name === 'ops-projection'));
});
