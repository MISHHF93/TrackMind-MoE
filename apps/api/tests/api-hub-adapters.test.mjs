import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiHubIntegrationAdapter,
  ImmutableAuditLog,
  UniversalEventBus,
  apiHubEventTypes,
  buildDigitalTwinSyncRequestDescriptor,
  createApiFacadeState,
} from '../dist/index.js';

const baseContext = {
  tenantId: 'tenant-api-hub',
  racetrackId: 'track-api-hub',
  providerId: 'provider-trackfeed-basic',
  correlationId: 'corr-api-hub-1',
  causationId: 'job-race-card-1',
  jobId: 'job-race-card-1',
  auditRefs: ['audit-provider-contract-1'],
  twinRefs: ['twin:race:race-7'],
  evidence: ['provider-contract', 'feed-manifest'],
  occurredAt: '2026-06-14T18:00:00.000Z',
};

function adapterWithMemory() {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const adapter = new ApiHubIntegrationAdapter({ eventBus, auditLog });
  return { adapter, eventBus, auditLog };
}

test('api hub registers the requested canonical event definitions', () => {
  const state = createApiFacadeState();
  const catalogTypes = new Set(state.eventCatalog.events.map((event) => event.type));

  for (const eventType of apiHubEventTypes) assert.ok(catalogTypes.has(eventType), eventType);
  assert.ok(state.eventCatalog.integrations.includes('api-hub'));
});

test('api hub emits ingestion and normalization events while preserving refs', async () => {
  const { adapter, eventBus } = adapterWithMemory();

  await adapter.registerProvider(baseContext, { providerName: 'TrackFeed Basic', sourceSystem: 'trackfeed' });
  await adapter.startIngestionJob(baseContext, { jobId: baseContext.jobId, mode: 'incremental' });
  await adapter.receiveRawPayload(baseContext, { payloadId: 'raw-race-card-7', rawPayloadRef: 'landing://raw-race-card-7', rawPayloadHash: 'sha256:raw-race-card-7', contentType: 'application/json' });
  await adapter.validatePayload({ ...baseContext, causationId: 'raw-race-card-7' }, { payloadId: 'raw-race-card-7', schemaId: 'provider.trackfeed.race-card.v1', canonicalType: 'RaceCard' });
  const canonical = await adapter.createCanonicalRecord({ ...baseContext, causationId: 'raw-race-card-7' }, { canonicalRecordId: 'canonical-race-card-7', entityType: 'RaceCard', record: { raceId: 'race-7', status: 'entries-open' } });

  const events = eventBus.events({ correlationId: 'corr-api-hub-1' });
  assert.deepEqual(events.map((event) => event.type), ['ProviderRegistered', 'IngestionJobStarted', 'RawPayloadReceived', 'PayloadValidated', 'CanonicalRecordCreated']);
  assert.ok(events.every((event) => event.context.tenantId === 'tenant-api-hub' && event.context.racetrackId === 'track-api-hub'));
  assert.ok(events.every((event) => event.payload.providerId === 'provider-trackfeed-basic'));
  assert.ok(events.every((event) => event.payload.auditRefs.includes('audit-provider-contract-1')));
  assert.ok(events.every((event) => event.payload.twinRefs.includes('twin:race:race-7')));
  assert.equal(canonical.event.lineage.causationId, 'raw-race-card-7');
  assert.equal(canonical.event.payload.artifactId, 'canonical-race-card-7');
});

test('api hub emits rejection and license block events with immutable audit records', async () => {
  const { adapter, eventBus, auditLog } = adapterWithMemory();

  await adapter.rejectPayload({ ...baseContext, artifactId: 'raw-bad-card-7' }, { payloadId: 'raw-bad-card-7', reason: 'schema-mismatch', errors: ['raceDate is required'] });
  const blocked = await adapter.detectLicenseRestriction({ ...baseContext, artifactId: 'dataset-race-card-7', evidence: ['license-trackfeed-basic-2026'] }, {
    licenseId: 'license-trackfeed-basic-2026',
    reason: 'public redistribution is prohibited',
    restrictedFields: ['rawOdds', 'proprietarySpeedFigure'],
    blockedUse: 'public_redistribution',
  });

  assert.equal(eventBus.events({ type: 'PayloadRejected', correlationId: 'corr-api-hub-1' }).length, 1);
  assert.equal(blocked.event.type, 'LicenseRestrictionDetected');
  assert.equal(blocked.audit.decision, 'blocked');
  assert.equal(blocked.audit.action, 'api-hub.license-restriction.detected');
  assert.equal(blocked.audit.tenantId, 'tenant-api-hub');
  assert.ok(blocked.event.context.auditRefs.includes(blocked.audit.id));
  assert.ok(auditLog.verify().valid);
  assert.ok(auditLog.all().some((entry) => entry.id === blocked.audit.id && entry.evidenceIds.includes('license-trackfeed-basic-2026')));
});

test('api hub publishes external data audits and audit-created events', async () => {
  const { adapter, eventBus, auditLog } = adapterWithMemory();

  const { audit, publication } = await adapter.createExternalDataAudit({
    ...baseContext,
    artifactId: 'canonical-race-card-7',
    action: 'api-hub.external-data.audit-created',
    payload: { sourceSystem: 'trackfeed', checksum: 'sha256:canonical-race-card-7' },
  });

  assert.equal(audit.action, 'api-hub.external-data.audit-created');
  assert.equal(audit.correlationId, 'corr-api-hub-1');
  assert.equal(publication.event.type, 'ExternalDataAuditCreated');
  assert.equal(publication.event.payload.auditId, audit.id);
  assert.ok(publication.event.context.auditRefs.includes(audit.id));
  assert.equal(eventBus.events({ type: 'ExternalDataAuditCreated' }).length, 1);
  assert.ok(auditLog.verify().valid);
});

test('digital twin sync requests are descriptor-only and never invoke physical controls', async () => {
  const { adapter, eventBus, auditLog } = adapterWithMemory();
  const descriptor = buildDigitalTwinSyncRequestDescriptor({
    ...baseContext,
    artifactId: 'canonical-race-card-7',
    patch: { providerRecordVersion: 3, raceStatus: 'entries-open' },
  });

  assert.equal(descriptor.descriptorOnly, true);
  assert.equal(descriptor.advisoryOnly, true);
  assert.equal(descriptor.physicalControlsInvoked, false);
  assert.equal(descriptor.executionAllowed, false);
  assert.equal(descriptor.syncTargets[0].twinId, 'twin:race:race-7');

  const publication = await adapter.requestDigitalTwinSync({
    ...baseContext,
    artifactId: 'canonical-race-card-7',
    patch: { providerRecordVersion: 3, raceStatus: 'entries-open' },
  });

  assert.equal(publication.event.type, 'DigitalTwinSyncRequested');
  assert.equal(publication.event.payload.descriptor.physicalControlsInvoked, false);
  assert.equal(publication.event.payload.descriptor.executionAllowed, false);
  assert.equal(eventBus.events({ type: 'digital-twin.state.patch' }).length, 0);
  assert.ok(auditLog.all().some((entry) => entry.action === 'api-hub.digital-twin-sync.requested'));
});
