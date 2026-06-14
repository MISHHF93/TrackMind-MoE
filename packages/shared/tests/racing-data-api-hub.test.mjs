import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRacingDataApiHubServiceMetadata,
  providerOperationalStatuses,
  racingDataApiHubContractSchemas,
  racingDataApiHubSchemaVersion,
  racingDataClasses,
  racingDataConnectionTypes,
  racingDataLicenseStatuses,
  racingDataSyncModes,
  racingDataUsageScopes,
  validateRacingDataApiHubContract,
  validateRacingDataLicenseMetadata,
} from '../dist/index.js';

const tenant = {
  tenantId: 'tenant-east',
  racetrackId: 'track-main',
  organizationId: 'operator-1',
  jurisdiction: 'US-MD',
  dataBoundary: 'external',
};

const retention = {
  policyId: 'racing-data-retention-365',
  retentionDays: 365,
  legalBasis: 'provider-license-agreement',
};

const lineage = {
  sourceSystem: 'regional-racing-feed-alpha',
  sourceRefs: ['source-schema:entries:v1'],
  ingestionJobId: 'job-entries-1',
  rawPayloadRefs: ['raw-payload-1'],
  normalizedFromRefs: [],
  correlationId: 'corr-racing-hub-1',
  causationIds: ['evt-provider-sync-requested'],
};

const license = {
  licenseStatus: 'active',
  commercialUseAllowed: true,
  redistributionAllowed: false,
  attributionRequired: true,
  requiresAttribution: true,
  piiPresent: true,
  dataClasses: ['entries', 'horse-profile', 'participant-profile'],
  usageScope: ['internal-operations', 'analytics', 'commercial-product'],
  retention,
  termsRef: 'terms:regional-feed-alpha:2026',
  attributionText: 'Data provider attribution required by contract.',
  effectiveFrom: '2026-06-01T00:00:00.000Z',
  evidenceRefs: ['license-evidence-1'],
};

test('Racing Data API Hub metadata declares provider-agnostic shared DTO coverage', () => {
  const metadata = createRacingDataApiHubServiceMetadata('2026-06-14T22:20:00.000Z');

  assert.equal(metadata.schemaVersion, racingDataApiHubSchemaVersion);
  assert.equal(metadata.providerAgnostic, true);
  assert.equal(metadata.hardCodedProviderBehaviorAllowed, false);
  assert.deepEqual(metadata.governance.attributionCompatibilityFields, ['attributionRequired', 'requiresAttribution']);
  for (const dto of ['ProviderConfig', 'ProviderStatus', 'RawProviderPayload', 'IngestionJob', 'ProviderConnectorDescriptor', 'NormalizationMapping', 'CanonicalRacingDataEnvelope', 'RacingDataApiHubServiceMetadata']) {
    assert.ok(metadata.dtoNames.includes(dto), `${dto} missing`);
    assert.ok(racingDataApiHubContractSchemas[dto] || dto === 'RacingDataApiHubServiceMetadata', `${dto} contract missing`);
  }
  for (const connectionType of ['rest', 'graphql', 'sftp', 'stream', 'webhook', 'manual-upload']) assert.ok(racingDataConnectionTypes.includes(connectionType));
  for (const syncMode of ['pull', 'push', 'batch', 'streaming', 'manual']) assert.ok(racingDataSyncModes.includes(syncMode));
  for (const dataClass of ['race-card', 'entries', 'results', 'scratches', 'horse-profile', 'participant-profile', 'compliance']) assert.ok(racingDataClasses.includes(dataClass));
  for (const scope of ['internal-operations', 'analytics', 'commercial-product', 'federation-exchange']) assert.ok(racingDataUsageScopes.includes(scope));
});

test('Provider config and status serialize with license and tenant metadata intact', () => {
  const config = {
    schemaVersion: racingDataApiHubSchemaVersion,
    providerId: 'provider-alpha',
    displayName: 'Regional feed alpha',
    enabled: true,
    tenant,
    jurisdiction: 'US-MD',
    connectionType: 'rest',
    syncMode: 'pull',
    refreshInterval: 'PT15M',
    endpointRefs: ['endpoint:provider-alpha:entries'],
    credentialsRef: 'secret:racing-data-provider-alpha',
    dataClasses: ['entries', 'horse-profile', 'participant-profile'],
    usageScope: ['internal-operations', 'analytics', 'commercial-product'],
    license,
    lineage,
    evidenceRefs: ['provider-config-evidence-1'],
    auditRefs: ['audit-provider-config-1'],
    eventRefs: ['racing-data.provider.configured.v1'],
  };

  assert.deepEqual(validateRacingDataApiHubContract('ProviderConfig', config), { valid: true, errors: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(config)), config);

  const status = {
    schemaVersion: racingDataApiHubSchemaVersion,
    providerId: 'provider-alpha',
    tenant,
    status: 'healthy',
    connectionType: 'rest',
    syncMode: 'pull',
    refreshInterval: 'PT15M',
    lastCheckedAt: '2026-06-14T22:21:00.000Z',
    lastSuccessfulSyncAt: '2026-06-14T22:20:00.000Z',
    nextSyncAt: '2026-06-14T22:35:00.000Z',
    health: { latencyMs: 184, errorRate: 0, rateLimitRemaining: 1000, messages: ['ready'] },
    licenseStatus: 'active',
    commercialUseAllowed: true,
    redistributionAllowed: false,
    attributionRequired: true,
    requiresAttribution: true,
    piiPresent: true,
    dataClasses: ['entries'],
    usageScope: ['internal-operations', 'analytics', 'commercial-product'],
    evidenceRefs: ['provider-status-evidence-1'],
    auditRefs: ['audit-provider-status-1'],
    eventRefs: ['racing-data.provider.health-checked.v1'],
  };

  assert.deepEqual(validateRacingDataApiHubContract('ProviderStatus', status), { valid: true, errors: [] });
  assert.ok(providerOperationalStatuses.includes(status.status));
  assert.ok(racingDataLicenseStatuses.includes(status.licenseStatus));
});

test('Raw payloads, ingestion jobs, mappings, and canonical envelopes validate as provider-neutral contracts', () => {
  const rawPayload = {
    schemaVersion: racingDataApiHubSchemaVersion,
    payloadId: 'raw-payload-1',
    providerId: 'provider-alpha',
    ingestionJobId: 'job-entries-1',
    tenant,
    receivedAt: '2026-06-14T22:20:00.000Z',
    connectionType: 'rest',
    syncMode: 'pull',
    contentType: 'application/json',
    raw: { records: [{ externalEntryId: 'entry-ext-1' }] },
    license,
    piiPresent: true,
    dataClasses: ['entries'],
    lineage,
    evidenceRefs: ['raw-evidence-1'],
    auditRefs: ['audit-raw-1'],
    eventRefs: ['racing-data.raw-payload.received.v1'],
  };

  const job = {
    schemaVersion: racingDataApiHubSchemaVersion,
    jobId: 'job-entries-1',
    providerId: 'provider-alpha',
    tenant,
    status: 'completed',
    connectionType: 'rest',
    syncMode: 'pull',
    refreshInterval: 'PT15M',
    requestedAt: '2026-06-14T22:19:00.000Z',
    startedAt: '2026-06-14T22:19:05.000Z',
    completedAt: '2026-06-14T22:20:00.000Z',
    dataClasses: ['entries'],
    usageScope: ['internal-operations', 'analytics', 'commercial-product'],
    licenseSnapshot: license,
    counts: { received: 1, normalized: 1, rejected: 0 },
    rawPayloadRefs: ['raw-payload-1'],
    canonicalEnvelopeRefs: ['canonical-envelope-1'],
    errors: [],
    lineage,
    evidenceRefs: ['job-evidence-1'],
    auditRefs: ['audit-job-1'],
    eventRefs: ['racing-data.ingestion.completed.v1'],
  };

  const mapping = {
    schemaVersion: racingDataApiHubSchemaVersion,
    mappingId: 'mapping-provider-alpha-entries-v1',
    providerId: 'provider-alpha',
    tenant,
    status: 'active',
    sourceSchemaRef: 'source-schema:entries:v1',
    targetSchemaVersion: racingDataApiHubSchemaVersion,
    dataClass: 'entries',
    fieldMappings: [{ sourcePath: '$.records[*].externalEntryId', targetPath: '$.entries[*].sourceEntryId', required: true, dataClass: 'entries' }],
    qualityRules: [{ ruleId: 'entry-id-required', path: '$.entries[*].sourceEntryId', severity: 'error', description: 'Entry ID is required.' }],
    piiPaths: ['$.entries[*].participantName'],
    license,
    lineage,
    evidenceRefs: ['mapping-evidence-1'],
    auditRefs: ['audit-mapping-1'],
    eventRefs: ['racing-data.mapping.activated.v1'],
  };

  const envelope = {
    schemaVersion: racingDataApiHubSchemaVersion,
    envelopeId: 'canonical-envelope-1',
    providerId: 'provider-alpha',
    tenant,
    jurisdiction: 'US-MD',
    canonicalDataClass: 'entries',
    dataClasses: ['entries'],
    receivedAt: '2026-06-14T22:20:00.000Z',
    normalizedAt: '2026-06-14T22:20:05.000Z',
    payload: { entries: [{ sourceEntryId: 'entry-ext-1', raceId: 'race-7' }] },
    sourcePayloadRefs: ['raw-payload-1'],
    license,
    usageScope: ['internal-operations', 'analytics', 'commercial-product'],
    retention,
    piiPresent: true,
    lineage,
    evidenceRefs: ['canonical-evidence-1'],
    auditRefs: ['audit-canonical-1'],
    eventRefs: ['racing-data.canonical-envelope.created.v1'],
  };

  for (const [name, value] of [
    ['RawProviderPayload', rawPayload],
    ['IngestionJob', job],
    ['NormalizationMapping', mapping],
    ['CanonicalRacingDataEnvelope', envelope],
  ]) {
    assert.deepEqual(validateRacingDataApiHubContract(name, value), { valid: true, errors: [] }, name);
  }
});

test('Licensing and connector validators reject incompatible attribution and provider-specific behavior', () => {
  assert.deepEqual(validateRacingDataLicenseMetadata(license), { valid: true, errors: [] });

  const attributionMismatch = validateRacingDataLicenseMetadata({ ...license, requiresAttribution: false });
  assert.equal(attributionMismatch.valid, false);
  assert.ok(attributionMismatch.errors.some((error) => error.includes('attributionRequired and requiresAttribution must match')));

  const commercialWithoutScope = validateRacingDataLicenseMetadata({ ...license, usageScope: ['internal-operations', 'analytics'] });
  assert.equal(commercialWithoutScope.valid, false);
  assert.ok(commercialWithoutScope.errors.some((error) => error.includes('commercial-product usage scope')));

  const connector = {
    schemaVersion: racingDataApiHubSchemaVersion,
    connectorId: 'generic-rest-pull-connector',
    title: 'Generic REST pull connector',
    description: 'Provider-neutral connector descriptor for REST polling integrations.',
    providerAgnostic: true,
    hardCodedProviderBehaviorAllowed: false,
    supportedConnectionTypes: ['rest'],
    supportedSyncModes: ['pull', 'batch'],
    supportedDataClasses: ['entries', 'results', 'scratches'],
    credentialRequirements: [{ name: 'api-token', required: true, secret: true }],
    healthCheck: { supported: true, interval: 'PT5M', auditAction: 'racing-data.provider.health-check' },
    emits: ['racing-data.provider.health-checked.v1'],
    audits: ['racing-data.provider.health-check'],
    evidenceRefs: ['connector-design-evidence'],
  };

  assert.deepEqual(validateRacingDataApiHubContract('ProviderConnectorDescriptor', connector), { valid: true, errors: [] });

  const unsafeConnector = validateRacingDataApiHubContract('ProviderConnectorDescriptor', { ...connector, providerAgnostic: false, hardCodedProviderBehaviorAllowed: true });
  assert.equal(unsafeConnector.valid, false);
  assert.ok(unsafeConnector.errors.includes('ProviderConnectorDescriptor.providerAgnostic must be true'));
  assert.ok(unsafeConnector.errors.includes('ProviderConnectorDescriptor.hardCodedProviderBehaviorAllowed must be false'));
});
