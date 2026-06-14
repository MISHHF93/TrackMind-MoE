import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ConnectorRuntime,
  ImmutableAuditLog,
  InMemoryRawLandingService,
  ManualPayloadConnectorAdapter,
  MockProviderConnectorAdapter,
  UniversalEventBus,
  hashRawProviderPayload,
} from '../dist/index.js';

const licenseContext = {
  licenseId: 'racing-data-license-1',
  terms: 'Internal evaluation only',
  attribution: 'Racing Data API Hub',
  permittedUse: ['ingest', 'validate', 'normalize'],
  restrictions: ['no-redistribution'],
  metadata: { steward: 'data-governance' },
};

function deterministicRuntime(deps = {}) {
  let sequence = 0;
  return new ConnectorRuntime({
    now: () => '2026-06-14T18:00:00.000Z',
    idFactory: (prefix) => `${prefix}-${++sequence}`,
    ...deps,
  });
}

test('connector runtime preserves raw manual provider payload artifacts', async () => {
  const runtime = deterministicRuntime();
  runtime.registerAdapter(new ManualPayloadConnectorAdapter({
    providerId: 'manual-racing-feed',
    providerName: 'Manual Racing Feed',
    sourceFormat: 'json',
    sourceEndpoint: 'manual://race-card-upload',
    licenseContext,
    metadata: { providerTier: 'manual' },
  }));
  const original = { raceId: 'race-7', runners: [{ horse: 'Sea Runner', post: 3 }], nested: { b: 2, a: 1 } };

  const result = await runtime.ingest('manual-racing-feed', {
    payload: original,
    receivedAt: '2026-06-14T17:59:00.000Z',
    metadata: { batchId: 'batch-1' },
    correlationId: 'corr-manual-1',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
  });
  original.runners[0].post = 9;

  assert.equal(result.job.status, 'completed');
  assert.equal(result.artifact.artifactType, 'raw-provider-payload');
  assert.deepEqual(result.artifact.originalPayload, { raceId: 'race-7', runners: [{ horse: 'Sea Runner', post: 3 }], nested: { b: 2, a: 1 } });
  assert.equal(result.artifact.sourceFormat, 'json');
  assert.equal(result.artifact.sourceEndpoint, 'manual://race-card-upload');
  assert.equal(result.artifact.receivedAt, '2026-06-14T17:59:00.000Z');
  assert.equal(result.artifact.providerMetadata.batchId, 'batch-1');
  assert.deepEqual(result.artifact.licenseContext, licenseContext);
});

test('raw payload hashes are stable and deterministic', async () => {
  const left = { b: 2, a: { y: true, x: ['first', 'second'] } };
  const right = { a: { x: ['first', 'second'], y: true }, b: 2 };

  assert.equal(hashRawProviderPayload(left), hashRawProviderPayload(right));
  assert.ok(hashRawProviderPayload(left).startsWith('sha256:'));

  const runtime = deterministicRuntime();
  runtime.registerAdapter(new MockProviderConnectorAdapter({
    providerId: 'mock-results',
    providerName: 'Mock Results Provider',
    payload: left,
    licenseContext,
  }));

  const first = await runtime.ingest('mock-results', { correlationId: 'corr-hash-1' });
  const second = await runtime.ingest('mock-results', { payload: right, correlationId: 'corr-hash-2' });

  assert.equal(first.artifact.payloadHash, second.artifact.payloadHash);
});

test('successful ingestion jobs record pending to completed lifecycle transitions', async () => {
  const landing = new InMemoryRawLandingService();
  const runtime = deterministicRuntime({ landingService: landing });
  runtime.registerAdapter(new MockProviderConnectorAdapter({
    providerId: 'mock-entries',
    providerName: 'Mock Entry Provider',
    payload: { entries: [{ raceId: 'race-1', runner: 'horse-1' }] },
    sourceEndpoint: 'mock://entries',
    licenseContext,
  }));

  const result = await runtime.ingest('mock-entries', { correlationId: 'corr-life-1' });

  assert.deepEqual(result.job.transitions.map((transition) => transition.status), ['pending', 'running', 'validated', 'normalized', 'completed']);
  assert.equal(result.job.artifactId, result.artifact.id);
  assert.equal(result.job.payloadHash, result.artifact.payloadHash);
  assert.deepEqual(result.eventRefs, [`event:${result.job.id}:provider.ingestion.completed`]);
  assert.deepEqual(result.auditRefs, [`audit:${result.job.id}:completed`]);
  assert.deepEqual(landing.get(result.artifact.id).eventRefs, result.eventRefs);
  assert.deepEqual(landing.get(result.artifact.id).auditRefs, result.auditRefs);
});

test('rejected payload path preserves raw artifact and validation errors', async () => {
  const runtime = deterministicRuntime();
  runtime.registerAdapter(new MockProviderConnectorAdapter({
    providerId: 'mock-null-feed',
    providerName: 'Mock Null Feed',
    payload: null,
    sourceEndpoint: 'mock://null-feed',
    licenseContext,
  }));

  const result = await runtime.ingest('mock-null-feed', { correlationId: 'corr-rejected-1' });

  assert.equal(result.job.status, 'rejected');
  assert.deepEqual(result.job.transitions.map((transition) => transition.status), ['pending', 'running', 'rejected']);
  assert.deepEqual(result.job.validationErrors, ['originalPayload is required']);
  assert.equal(result.artifact.originalPayload, null);
  assert.equal(result.artifact.sourceEndpoint, 'mock://null-feed');
  assert.deepEqual(result.eventRefs, [`event:${result.job.id}:provider.ingestion.rejected`]);
  assert.deepEqual(result.auditRefs, [`audit:${result.job.id}:rejected`]);
});

test('connector runtime preserves license context and records event/audit metadata when helpers are provided', async () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const runtime = deterministicRuntime({ eventBus, auditLog });
  runtime.registerAdapter(new MockProviderConnectorAdapter({
    providerId: 'licensed-provider',
    providerName: 'Licensed Provider',
    payload: { raceId: 'race-9', odds: [{ runner: 'horse-9', price: '5/2' }] },
    sourceEndpoint: 'mock://licensed-provider/odds',
    licenseContext,
  }));

  const result = await runtime.ingest('licensed-provider', {
    correlationId: 'corr-license-1',
    tenantId: 'tenant-licensed',
    racetrackId: 'track-licensed',
  });

  assert.deepEqual(result.artifact.licenseContext, licenseContext);
  assert.equal(auditLog.all().length, 1);
  assert.equal(auditLog.all()[0].id, result.auditRefs[0]);
  assert.equal(auditLog.all()[0].tenantId, 'tenant-licensed');
  assert.equal(eventBus.events({ correlationId: 'corr-license-1' }).length, 1);
  assert.equal(eventBus.events({ correlationId: 'corr-license-1' })[0].id, result.eventRefs[0]);
  assert.equal(eventBus.events({ correlationId: 'corr-license-1' })[0].payload.payloadHash, result.artifact.payloadHash);
});
