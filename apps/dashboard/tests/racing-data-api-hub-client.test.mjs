import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveClient, createMockClient, NexusApiError } from '../dist/api/client.js';

test('Racing Data API Hub mock adapter exposes provider, canonical, governance, and draft-only DTOs', async () => {
  const client = createMockClient();
  const hub = await client.getRacingDataApiHub();

  assert.equal(hub.metadata.serviceId, 'racing-data-api-hub');
  assert.equal(hub.metadata.providerAgnostic, true);
  assert.equal(hub.providers[0].license.attributionRequired, hub.providers[0].license.requiresAttribution);
  assert.equal(hub.rawPayloadReviews[0].review.safetyCriticalMutationAllowed, false);
  assert.equal(hub.canonical.raceCards[0].lineage.correlationId, 'corr-racing-data-race-7');
  assert.equal(hub.canonical.results[0].approvalRequiredForMutation, true);
  assert.equal(hub.entityResolution.approvalRequiredForMerges, true);
  assert.equal(hub.digitalTwinSync.targetTwinRefs.includes('twin:race:race-7'), true);
  assert.equal(hub.licensePolicies[0].redistributionAllowed, false);
  assert.equal(hub.digitalTwinSync.directMutationAllowed, false);

  const featureDraft = await client.requestRacingDataFeatureStoreExport({ requestedBy:'data-steward-1', reason:'test', dataClasses:['race-card'], target:'feature-store', filters:{ raceId:'race-7' }, evidence:['test'], approvalPolicy:'data-governance-review' });
  assert.equal(featureDraft.approvalRequired, true);
  assert.equal(featureDraft.executionAllowed, false);
  assert.equal(featureDraft.eventType, 'racing-data.feature-store-export.draft.created');
});

test('Racing Data API Hub live adapter uses /api/v1/racing-data paths and draft POSTs', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ accepted:true, approvalRequired:true, executionAllowed:false, audited:true }) };
  };

  try {
    const live = createLiveClient('https://api.example.test/api/v1');
    await live.listRacingDataProviders();
    await live.listRacingDataProviderStatuses();
    await live.getRacingDataProvider('provider 1');
    await live.listRacingDataIngestionJobs();
    await live.getRacingDataIngestionJob('job 1');
    await live.listRacingDataRawPayloadReviews();
    await live.getRacingDataRawPayloadReview('payload 1');
    await live.listRacingDataCanonicalRaceCards();
    await live.listRacingDataCanonicalRaces();
    await live.listRacingDataCanonicalHorses();
    await live.listRacingDataCanonicalEntries();
    await live.listRacingDataCanonicalResults();
    await live.getRacingDataEntityResolution();
    await live.listRacingDataQualityReports();
    await live.getRacingDataLineage();
    await live.listRacingDataLicensePolicies();
    await live.getRacingDataDigitalTwinSyncDescriptor();
    await live.createRacingDataIngestionJobDraft({ providerId:'provider-1', requestedBy:'data-steward-1', reason:'test', dataClasses:['race-card'], usageScope:['race-day-operations'], evidence:['test'], approvalPolicy:'data-governance-review' });
    await live.requestRacingDataFeatureStoreExport({ requestedBy:'data-steward-1', reason:'test', dataClasses:['race-card'], target:'feature-store', filters:{}, evidence:['test'], approvalPolicy:'data-governance-review' });
    await live.requestRacingDataDataLakeExport({ requestedBy:'data-steward-1', reason:'test', dataClasses:['race-card'], target:'data-lake', filters:{}, evidence:['test'], approvalPolicy:'data-governance-review' });

    assert.deepEqual(calls.map((call) => call.url), [
      'https://api.example.test/api/v1/racing-data/providers',
      'https://api.example.test/api/v1/racing-data/providers/statuses',
      'https://api.example.test/api/v1/racing-data/providers/provider%201',
      'https://api.example.test/api/v1/racing-data/ingestion-jobs',
      'https://api.example.test/api/v1/racing-data/ingestion-jobs/job%201',
      'https://api.example.test/api/v1/racing-data/raw-payloads/review',
      'https://api.example.test/api/v1/racing-data/raw-payloads/review/payload%201',
      'https://api.example.test/api/v1/racing-data/canonical/race-cards',
      'https://api.example.test/api/v1/racing-data/canonical/races',
      'https://api.example.test/api/v1/racing-data/canonical/horses',
      'https://api.example.test/api/v1/racing-data/canonical/entries',
      'https://api.example.test/api/v1/racing-data/canonical/results',
      'https://api.example.test/api/v1/racing-data/entity-resolution',
      'https://api.example.test/api/v1/racing-data/data-quality/reports',
      'https://api.example.test/api/v1/racing-data/lineage',
      'https://api.example.test/api/v1/racing-data/license-policies',
      'https://api.example.test/api/v1/racing-data/digital-twin/sync-descriptor',
      'https://api.example.test/api/v1/racing-data/ingestion-jobs/draft-requests',
      'https://api.example.test/api/v1/racing-data/exports/feature-store',
      'https://api.example.test/api/v1/racing-data/exports/data-lake',
    ]);
    assert.deepEqual(calls.slice(-3).map((call) => call.init.method), ['POST','POST','POST']);
  } finally {
    globalThis.fetch = original;
  }
});

test('Racing Data API Hub live errors retain path and request metadata', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:false, status:409, statusText:'Conflict', headers: { get: (name) => name.toLowerCase() === 'x-trackmind-request-id' ? 'req-racing-409' : undefined }, json: async () => ({ error:{ code:'license_restricted', message:'license review required', details:['license-policy-mock-racing-feed'], timestamp:'2026-06-14T00:00:00.000Z' } }) });

  try {
    await assert.rejects(() => createLiveClient('https://api.example.test/api/v1').requestRacingDataDataLakeExport({ requestedBy:'data-steward-1', reason:'test', dataClasses:['results'], target:'data-lake', filters:{}, evidence:['test'], approvalPolicy:'data-governance-review' }), (error) => {
      assert.ok(error instanceof NexusApiError);
      assert.equal(error.status, 409);
      assert.equal(error.path, '/racing-data/exports/data-lake');
      assert.equal(error.code, 'license_restricted');
      assert.deepEqual(error.details, ['license-policy-mock-racing-feed']);
      assert.equal(error.requestId, 'req-racing-409');
      assert.equal(error.timestamp, '2026-06-14T00:00:00.000Z');
      assert.equal(error.method, 'POST');
      assert.equal(error.url, 'https://api.example.test/api/v1/racing-data/exports/data-lake');
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('Racing Data API Hub live network errors retain adapter metadata', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network unavailable');
  };

  try {
    await assert.rejects(() => createLiveClient('https://api.example.test/api/v1').listRacingDataProviders(), (error) => {
      assert.ok(error instanceof NexusApiError);
      assert.equal(error.status, 0);
      assert.equal(error.statusText, 'NetworkError');
      assert.equal(error.path, '/racing-data/providers');
      assert.equal(error.code, 'request_failed');
      assert.equal(error.method, 'GET');
      assert.equal(error.url, 'https://api.example.test/api/v1/racing-data/providers');
      assert.deepEqual(error.details, ['network unavailable']);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});
