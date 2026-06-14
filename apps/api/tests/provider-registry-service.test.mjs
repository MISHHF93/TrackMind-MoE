import assert from 'node:assert/strict';
import test from 'node:test';
import { EnterpriseApiGateway, EnterpriseServiceRegistry } from '../dist/enterpriseApiGateway.js';
import { ProviderRegistryService, providerRegistryApiDefinition } from '../dist/providerRegistryService.js';

const principal = { id: 'data-steward-1', tenantId: 'tenant-a', racetrackId: 'track-main', scopes: ['providers:read', 'providers:write', 'providers:status'] };
const baseProvider = {
  providerId: 'eqb-official-feed',
  displayName: 'Equibase Official Feed',
  providerName: 'Equibase',
  description: 'Licensed racing data feed configured by contract reference.',
  dataClasses: ['entries', 'results', 'odds'],
  connection: {
    connectionType: 'official-api',
    endpoint: 'https://api.provider.example/v1',
    authRef: 'secret://providers/eqb-official-feed',
    format: 'json',
    metadata: { contractId: 'contract-2026-001', providerRegion: 'us-east' },
  },
  syncMode: 'scheduled',
  refreshIntervalSeconds: 300,
  license: {
    licenseStatus: 'licensed',
    commercialUseAllowed: true,
    attributionRequired: true,
    redistributionAllowed: false,
    piiPresent: false,
    allowedUses: ['race-day operations', 'internal analytics'],
    restrictedUses: ['public raw-feed redistribution'],
    retentionDays: 365,
    rightsHolder: 'Equibase',
    attributionText: 'Data licensed from provider.',
    licenseRef: 'license:eqb:2026',
  },
  tags: ['official', 'racing'],
  metadata: { ownerTeam: 'data-platform' },
};

test('provider registry registers licensed provider metadata with audit, events, status, and API export', async () => {
  const service = new ProviderRegistryService();
  const created = await service.register(baseProvider, principal, '2026-06-14T12:00:00.000Z');

  assert.equal(created.providerId, 'eqb-official-feed');
  assert.equal(created.tenantId, 'tenant-a');
  assert.equal(created.racetrackId, 'track-main');
  assert.equal(created.connection.connectionType, 'official-api');
  assert.equal(created.syncMode, 'scheduled');
  assert.equal(created.refreshIntervalSeconds, 300);
  assert.equal(created.status.status, 'configured');
  assert.equal(created.usageControls.redistributionAllowed, false);
  assert.ok(created.usageControls.flags.includes('redistribution-restricted'));

  const healthy = await service.updateStatus(created.providerId, { status: 'healthy', lastSuccessfulSyncAt: '2026-06-14T12:05:00.000Z', latencyMs: 42, message: 'provider heartbeat ok' }, principal, '2026-06-14T12:05:00.000Z');
  assert.equal(healthy.status.status, 'healthy');
  assert.equal(service.getStatus(created.providerId, principal).latencyMs, 42);
  assert.equal(service.auditLog.verify().valid, true);
  assert.equal(service.eventBus.events({ tenantId: 'tenant-a', racetrackId: 'track-main' }).length, 2);

  const registry = new EnterpriseServiceRegistry();
  registry.register(providerRegistryApiDefinition());
  const gateway = new EnterpriseApiGateway(registry);
  assert.equal(gateway.route({ serviceId: 'provider-registry', path: '/', method: 'GET', principal: { id: 'viewer', scopes: ['providers:read'], tenantId: 'tenant-a' }, nowEpochMs: 1 }).allowed, true);
  assert.equal(gateway.route({ serviceId: 'provider-registry', path: '/', method: 'POST', principal: { id: 'viewer', scopes: ['providers:read'], tenantId: 'tenant-a' }, nowEpochMs: 2 }).status, 403);
});

test('provider registry rejects duplicate providers in the same tenant racetrack scope', async () => {
  const service = new ProviderRegistryService();
  await service.register(baseProvider, principal);

  await assert.rejects(() => service.register({ ...baseProvider, displayName: 'Duplicate Official Feed' }, principal), /provider already registered/);

  const otherTrackPrincipal = { ...principal, racetrackId: 'track-training' };
  const otherTrack = await service.register({ ...baseProvider, displayName: 'Training Track Feed' }, otherTrackPrincipal);
  assert.equal(otherTrack.providerId, baseProvider.providerId);
  assert.equal(otherTrack.racetrackId, 'track-training');
  assert.equal(service.list({}, principal).total, 1);
  assert.equal(service.list({}, otherTrackPrincipal).total, 1);
});

test('provider registry enforces tenant and racetrack scoped reads', async () => {
  const service = new ProviderRegistryService();
  await service.register(baseProvider, principal);

  const tenantB = { id: 'data-steward-2', tenantId: 'tenant-b', racetrackId: 'track-main', scopes: ['providers:read', 'providers:write'] };
  await service.register({ ...baseProvider, providerId: 'weather-partner-feed', displayName: 'Weather Partner Feed', providerName: 'Weather Partner', dataClasses: ['weather'], license: { ...baseProvider.license, licenseRef: 'license:weather:2026' } }, tenantB);

  assert.equal(service.list({}, principal).total, 1);
  assert.equal(service.list({}, tenantB).total, 1);
  assert.throws(() => service.get('weather-partner-feed', principal), /provider not found/);
  assert.throws(() => service.list({ tenantId: 'tenant-b' }, principal), /tenant isolation violation/);
  assert.throws(() => service.list({ racetrackId: 'other-track' }, principal), /racetrack isolation violation/);
});

test('provider registry preserves restricted license flags and rejects unlicensed or scraping sources', async () => {
  const service = new ProviderRegistryService();
  const restricted = await service.register({
    ...baseProvider,
    providerId: 'vet-clearance-partner',
    displayName: 'Veterinary Clearance Partner',
    providerName: 'Vet Partner',
    dataClasses: ['equine-health', 'regulatory'],
    syncMode: 'webhook',
    refreshIntervalSeconds: undefined,
    license: {
      ...baseProvider.license,
      licenseStatus: 'trial',
      commercialUseAllowed: false,
      attributionRequired: true,
      redistributionAllowed: false,
      piiPresent: true,
      allowedUses: ['veterinary review'],
      restrictedUses: ['marketing', 'redistribution', 'model training'],
      retentionDays: 30,
      licenseRef: 'license:vet-partner:trial',
    },
  }, principal);

  assert.deepEqual(restricted.usageControls.flags, ['commercial-use-restricted', 'redistribution-restricted', 'attribution-required', 'pii-present', 'retention-required']);
  assert.equal(service.list({ piiPresent: true, commercialUseAllowed: false, redistributionAllowed: false, dataClass: 'equine-health' }, principal).total, 1);

  await assert.rejects(() => service.register({ ...baseProvider, providerId: 'expired-provider', license: { ...baseProvider.license, licenseStatus: 'expired' } }, principal), /licenseStatus must be one of/);
  await assert.rejects(() => service.register({ ...baseProvider, providerId: 'scrape-provider', connection: { ...baseProvider.connection, connectionType: 'scrape' } }, principal), /scraping connection types are not allowed/);
  await assert.rejects(() => service.register({ ...baseProvider, providerId: 'secret-inline-provider', connection: { ...baseProvider.connection, metadata: { apiToken: 'do-not-store' } } }, principal), /must reference secrets via authRef/);
});

test('provider registry serializes clone-safe audit snapshots', async () => {
  const service = new ProviderRegistryService();
  await service.register(baseProvider, principal, '2026-06-14T12:00:00.000Z');

  const snapshot = service.serialize({}, principal, '2026-06-14T12:10:00.000Z');
  const encoded = JSON.stringify(snapshot);
  const decoded = JSON.parse(encoded);

  assert.equal(decoded.schemaVersion, 'trackmind.provider-registry.v1');
  assert.equal(decoded.generatedAt, '2026-06-14T12:10:00.000Z');
  assert.equal(decoded.tenantId, 'tenant-a');
  assert.equal(decoded.racetrackId, 'track-main');
  assert.equal(decoded.providers.length, 1);
  assert.equal(decoded.providers[0].license.redistributionAllowed, false);

  snapshot.providers[0].license.allowedUses.push('mutated outside service');
  const current = service.get(baseProvider.providerId, principal);
  assert.equal(current.license.allowedUses.includes('mutated outside service'), false);
});
