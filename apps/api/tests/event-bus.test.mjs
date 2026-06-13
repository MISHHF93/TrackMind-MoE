import test from 'node:test';
import assert from 'node:assert/strict';
import { UniversalEventBus } from '../dist/index.js';

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
