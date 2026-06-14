import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalRacingDataService, canonicalRacingDataServiceBlueprint } from '../dist/index.js';

const ref = (sourceRecordId, sourceEntityType = 'race-card') => ({
  providerId: 'equibase',
  sourceSystem: 'official-feed',
  sourceEntityType,
  sourceRecordId,
});

const provenance = (sourceRecordId, sourceEntityType = 'race-card', official = false) => ({
  providerRef: ref(sourceRecordId, sourceEntityType),
  receivedAt: '2026-06-13T12:00:00Z',
  normalizedAt: '2026-06-13T12:01:00Z',
  normalizedBy: 'canonical-ingestion-worker-06',
  feedId: 'feed-race-day-2026-06-13',
  evidence: [`provider:${sourceRecordId}`, 'normalization-contract:v1'],
  official,
});

function seedCanonicalRace(service) {
  service.ingestNormalizedHorseIdentity({
    tenantId: 'tenant-1',
    horse: { id: 'horse-1', tenantId: 'tenant-1', name: 'Canonical Runner', registrationNumber: 'REG-1', providerRefs: [ref('horse-1', 'horse')] },
    provenance: provenance('horse-1', 'horse'),
  });

  return service.ingestNormalizedRaceCard({
    tenantId: 'tenant-1',
    raceCard: { id: 'card-2026-06-13', tenantId: 'tenant-1', racetrackId: 'trk-1', raceDate: '2026-06-13', status: 'official', raceIds: ['race-7'], providerRefs: [ref('card-2026-06-13')] },
    races: [{ id: 'race-7', tenantId: 'tenant-1', racetrackId: 'trk-1', raceCardId: 'card-2026-06-13', raceDate: '2026-06-13', raceNumber: 7, scheduledPostTime: '2026-06-13T21:00:00Z', surface: 'dirt', distanceFurlongs: 6, status: 'official', entryIds: ['entry-1'], resultId: 'result-race-7', providerRefs: [ref('race-7', 'race')] }],
    entries: [{ id: 'entry-1', tenantId: 'tenant-1', raceId: 'race-7', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1', jockeyId: 'jockey-1', programNumber: '1', postPosition: 1, finishPosition: 1, providerRefs: [ref('entry-1', 'entry')] }],
    result: { id: 'result-race-7', tenantId: 'tenant-1', raceId: 'race-7', status: 'official', official: true, officialAt: '2026-06-13T21:03:00Z', finishOrder: [{ entryId: 'entry-1', horseId: 'horse-1', position: 1 }], chartUri: 's3://charts/race-7.pdf', stewardRulingIds: [], providerRefs: [ref('result-race-7', 'result')] },
    provenance: provenance('card-2026-06-13', 'race-card', true),
  });
}

test('canonical racing data service stores normalized race card, race, entry, result, and horse identity artifacts', () => {
  const service = new CanonicalRacingDataService();
  const bundle = seedCanonicalRace(service);

  assert.equal(bundle.race.id, 'race-7');
  assert.equal(bundle.raceCard.id, 'card-2026-06-13');
  assert.equal(bundle.entries[0].payload.horseId, 'horse-1');
  assert.equal(bundle.result.payload.official, true);
  assert.equal(bundle.result.safetySemantics.officialResultLocked, true);

  const horse = service.getArtifact('tenant-1', 'HorseIdentity', 'horse-1');
  assert.equal(horse.payload.name, 'Canonical Runner');
  assert.equal(horse.provenance[0].normalizedBy, 'canonical-ingestion-worker-06');
  assert.equal(service.canonicalState('tenant-1').totals.RaceEntry, 1);
});

test('canonical racing data service queries by tenant, race, and provider reference without cross-tenant leakage', () => {
  const service = new CanonicalRacingDataService();
  seedCanonicalRace(service);
  service.ingestNormalizedHorseIdentity({
    tenantId: 'tenant-2',
    horse: { id: 'horse-1', tenantId: 'tenant-2', name: 'Other Tenant Runner', providerRefs: [ref('horse-1', 'horse')] },
    provenance: provenance('horse-1', 'horse'),
  });

  const byRace = service.queryByRace('tenant-1', 'race-7');
  assert.equal(byRace.entries.length, 1);
  assert.equal(byRace.result.payload.finishOrder[0].horseId, 'horse-1');

  const byProvider = service.queryByProviderRef('tenant-1', { providerId: 'equibase', sourceRecordId: 'entry-1' });
  assert.equal(byProvider.length, 1);
  assert.equal(byProvider[0].kind, 'RaceEntry');

  const otherTenant = service.queryByProviderRef('tenant-2', { providerId: 'equibase', sourceRecordId: 'horse-1' });
  assert.equal(otherTenant.length, 1);
  assert.equal(otherTenant[0].payload.name, 'Other Tenant Runner');
});

test('canonical racing data service preserves official result and steward note safety semantics', () => {
  const service = new CanonicalRacingDataService();
  seedCanonicalRace(service);

  assert.throws(() => service.ingestNormalizedRaceResult({
    tenantId: 'tenant-1',
    result: { id: 'result-race-7', tenantId: 'tenant-1', raceId: 'race-7', status: 'official', official: true, officialAt: '2026-06-13T21:04:00Z', finishOrder: [{ entryId: 'entry-1', horseId: 'horse-1', position: 2 }], stewardRulingIds: [], providerRefs: [ref('result-race-7-correction', 'result')] },
    provenance: provenance('result-race-7-correction', 'result', true),
  }), /Official race results are locked/);

  assert.throws(() => service.ingestNormalizedStewardRuling({
    tenantId: 'tenant-1',
    ruling: { id: 'ruling-bad', tenantId: 'tenant-1', raceId: 'race-7', issuedAt: '2026-06-13T21:10:00Z', issuedBy: 'steward-1', decision: 'change order', notes: 'bad mutation', evidenceIds: ['ev-1'], officialResultsModified: true },
    provenance: provenance('ruling-bad', 'steward-ruling'),
  }), /may not mutate official race results/);

  const ruling = service.ingestNormalizedStewardRuling({
    tenantId: 'tenant-1',
    ruling: { id: 'ruling-1', tenantId: 'tenant-1', raceId: 'race-7', issuedAt: '2026-06-13T21:10:00Z', issuedBy: 'steward-1', decision: 'no change', notes: 'inquiry reviewed; official order unchanged', evidenceIds: ['ev-1'], officialResultsModified: false, providerRefs: [ref('ruling-1', 'steward-ruling')] },
    provenance: provenance('ruling-1', 'steward-ruling'),
  });

  const bundle = service.queryByRace('tenant-1', 'race-7');
  assert.equal(ruling.safetySemantics.stewardNotesMayModifyOfficialResults, false);
  assert.equal(ruling.payload.officialResultRef, 'result-race-7');
  assert.equal(bundle.result.payload.finishOrder[0].position, 1);
  assert.equal(bundle.stewardRulings.length, 1);
});

test('canonical racing data blueprint documents read-mostly normalized ingestion boundaries', () => {
  const blueprint = canonicalRacingDataServiceBlueprint();
  assert.equal(blueprint.writeModel, 'normalized-ingestion-only');
  assert.ok(blueprint.artifacts.includes('RegulatoryRecord'));
  assert.match(blueprint.safetySemantics, /Official results are locked/);
});
