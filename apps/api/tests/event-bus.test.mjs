import test from 'node:test';
import assert from 'node:assert/strict';
import { bindAuditLogToEvents, ImmutableAuditLog, registerNexusEventCatalog, UniversalEventBus } from '../dist/index.js';

const owner = { service: 'race-ops', team: 'Racing Operations', accountableRole: 'Racing Secretary', contact: 'raceops@example.test' };

test('universal event bus registers governed schemas and enriches published events', async () => {
  const bus = new UniversalEventBus();
  const signals = [];
  bus.onSignal((signal) => signals.push(signal));
  const schemaRef = bus.registerEvent({
    type: 'race-start-requested',
    version: 2,
    description: 'Race start command request',
    owner,
    payloadFields: ['raceId', 'requestedBy'],
    compliance: 'regulated',
    dependencies: [{ eventType: 'track-reading-ingested', versionRange: '^1', required: true }],
    operationalMetadata: { retention: '7y', tier: 'mission-critical' },
    validate: (payload) => Boolean(payload.raceId && payload.requestedBy),
  });
  assert.equal(schemaRef, 'race-start-requested.v2');

  const delivered = [];
  bus.subscribe('race-start-requested', (event) => delivered.push(event), { name: 'race-start-projection' });
  const event = await bus.publish({ type: 'race-start-requested', payload: { raceId: 'RACE-1', requestedBy: 'steward-1' }, correlationId: 'corr-1', causationId: 'cmd-1', parentEventIds: ['track-ok-1'], aggregateId: 'race:RACE-1', trace: { traceId: 'trace-1' } });

  assert.equal(event.version, 2);
  assert.equal(event.schemaRef, 'race-start-requested.v2');
  assert.equal(event.owner.service, 'race-ops');
  assert.equal(event.compliance, 'regulated');
  assert.equal(event.lineage.causationId, 'cmd-1');
  assert.equal(event.trace.traceId, 'trace-1');
  assert.equal(delivered.length, 1);
  assert.ok(signals.some((signal) => signal.name === 'event.published' && signal.correlationId === 'corr-1'));
  assert.equal(bus.governanceCatalog()[0].dependencies[0].eventType, 'track-reading-ingested');
});

test('universal event bus retries, dead-letters failures, and replays event streams', async () => {
  const bus = new UniversalEventBus();
  bus.registerEvent({ type: 'incident-created', version: 1, description: 'Incident opened', owner, payloadFields: ['incidentId'], compliance: 'confidential', validate: (payload) => Boolean(payload.incidentId) });
  let attempts = 0;
  bus.subscribe('incident-created', () => { attempts += 1; throw new Error('projection unavailable'); }, { name: 'incident-projection', retry: { maxAttempts: 2 } });
  await bus.publish({ type: 'incident-created', payload: { incidentId: 'INC-1' }, correlationId: 'corr-incident' });

  assert.equal(attempts, 2);
  assert.equal(bus.deadLetterQueue().length, 1);
  assert.equal(bus.deadLetterQueue()[0].handlerName, 'incident-projection');

  const replayed = await bus.replay({ type: 'incident-created', fromSequence: 1 });
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0].correlationId, 'corr-incident');
  assert.equal(bus.events({ correlationId: 'corr-incident' }).length, 1);
});

test('nexus event catalog enforces service metadata and propagates audit context', async () => {
  const bus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  bindAuditLogToEvents(bus, auditLog);
  const refs = registerNexusEventCatalog(bus);
  assert.ok(refs.includes('asset.registry.changed.v1'));

  await assert.rejects(
    () => bus.publish({
      type: 'asset.registry.changed.v1',
      payload: { assetId: 'asset-1', assetType: 'StartingGate', lifecycleStatus: 'active', riskClassification: 'high' },
      producer: 'asset-registry',
    }),
    /tenantId is required/,
  );

  const event = await bus.publish({
    type: 'asset.registry.changed.v1',
    payload: { assetId: 'asset-1', assetType: 'StartingGate', lifecycleStatus: 'active', riskClassification: 'high' },
    tenantId: 'trk-1',
    racetrackId: 'main-track',
    aggregateId: 'asset-1',
    correlationId: 'corr-asset-1',
    causationId: 'cmd-asset-1',
    auditRef: 'audit-asset-1',
    digitalTwinRef: 'twin:main-track:asset-1',
    actor: { id: 'asset-service', type: 'service' },
    subject: { id: 'asset-1', type: 'asset', tenantId: 'trk-1' },
    evidence: ['work-order-1'],
    producer: 'asset-registry',
  });

  assert.equal(event.schemaRef, 'asset.registry.changed.v1');
  assert.equal(event.context.tenantId, 'trk-1');
  assert.equal(event.context.racetrackId, 'main-track');
  assert.equal(event.context.auditRef, 'audit-asset-1');
  assert.equal(event.context.digitalTwinRef, 'twin:main-track:asset-1');
  assert.equal(bus.validateEvent(event).valid, true);

  const replayed = await bus.replay({ tenantId: 'trk-1', racetrackId: 'main-track', correlationId: 'corr-asset-1' });
  assert.equal(replayed.length, 1);

  const audit = auditLog.all().find((entry) => entry.id === `audit:${event.id}`);
  assert.equal(audit.tenantId, 'trk-1');
  assert.equal(audit.subjectId, 'asset-1');
  assert.equal(audit.correlationId, 'corr-asset-1');
  assert.ok(audit.evidenceIds.includes('audit-asset-1'));

  const catalog = bus.eventCatalog({ eventTypePrefix: 'asset.' });
  assert.ok(catalog.events.some((contract) => contract.schemaRef === 'asset.registry.changed.v1' && contract.standards.auditRequired));
});

test('dead letters retain tenant correlation context for operational replay', async () => {
  const bus = new UniversalEventBus();
  registerNexusEventCatalog(bus);
  let attempts = 0;
  bus.subscribe('workflow.instance.transitioned.v1', () => { attempts += 1; throw new Error('workflow projection offline'); }, { name: 'workflow-projection', retry: { maxAttempts: 1 } });

  await bus.publish({
    type: 'workflow.instance.transitioned.v1',
    payload: { workflowId: 'wf-1', fromState: 'pending-approval', toState: 'approved', assignedTo: 'steward-1' },
    tenantId: 'trk-1',
    racetrackId: 'main-track',
    aggregateId: 'wf-1',
    correlationId: 'corr-workflow-1',
    auditRef: 'audit-workflow-1',
    digitalTwinRef: 'twin:workflow:wf-1',
    actor: { id: 'workflow-engine', type: 'service' },
    subject: { id: 'wf-1', type: 'workflow', tenantId: 'trk-1' },
    evidence: ['approval-token-1'],
    producer: 'workflow-engine',
  });

  const dead = bus.deadLetterQueue({ tenantId: 'trk-1', correlationId: 'corr-workflow-1' });
  assert.equal(dead.length, 1);
  assert.equal(dead[0].eventType, 'workflow.instance.transitioned.v1');
  assert.equal(dead[0].replayable, true);

  const processed = await bus.processDeadLetters({ handlerName: 'workflow-projection' });
  assert.equal(processed.retried, 1);
  assert.equal(processed.remaining, 1);
  assert.equal(attempts, 2);
});
