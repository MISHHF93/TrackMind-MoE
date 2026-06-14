import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRawPayloadEnvelope,
  raceOfficeRawPayloadNormalizationMapping,
  validateRawPayloadEnvelope,
} from '../dist/index.js';

const receivedAt = '2026-06-14T20:00:00.000Z';

function rawEnvelope(overrides = {}) {
  return {
    rawPayloadId: 'raw-race-card-001',
    provider: 'example-racing-provider',
    providerRefs: [
      { provider: 'example-racing-provider', sourceId: 'SRC-RACE-7', sourceType: 'api', entityType: 'race' },
      { provider: 'example-racing-provider', sourceId: 'SRC-TRACK-TKY', sourceType: 'api', entityType: 'track' },
    ],
    payloadType: 'race-card',
    tenantId: 'tenant-east',
    racetrackId: 'track-001',
    receivedAt,
    sourceSchemaVersion: 'provider.race-card.v2',
    correlationId: 'corr-race-card-001',
    payload: {
      race: {
        id: 'Race 7',
        providerRaceId: ' SRC-RACE-7 ',
        number: 7,
        surfaceCode: 'D',
        distance: { value: 6, unit: 'furlong' },
        date: '2026/06/14',
        postTime: '2026-06-14T21:05:00Z',
        status: 'OPEN',
      },
      track: {
        id: 'Tokyo Main',
        providerTrackId: ' SRC-TRACK-TKY ',
      },
    },
    ...overrides,
  };
}

test('schema validation accepts valid raw payload envelopes and rejects invalid envelopes', () => {
  assert.deepEqual(validateRawPayloadEnvelope(rawEnvelope()), { valid: true, errors: [] });

  const result = validateRawPayloadEnvelope({
    ...rawEnvelope(),
    rawPayloadId: '',
    providerRefs: [],
    receivedAt: 'not-a-date',
    payload: null,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('RawPayloadEnvelope.rawPayloadId is required'));
  assert.ok(result.errors.includes('RawPayloadEnvelope.providerRefs must include at least one provider reference'));
  assert.ok(result.errors.includes('RawPayloadEnvelope.receivedAt must be a valid timestamp'));
  assert.ok(result.errors.includes('RawPayloadEnvelope.payload is required'));
});

test('schema normalization maps D/T/S surface source values to canonical surfaces', () => {
  const cases = [
    ['D', 'dirt'],
    ['T', 'turf'],
    ['S', 'synthetic'],
  ];

  for (const [source, expected] of cases) {
    const result = normalizeRawPayloadEnvelope(rawEnvelope({ payload: { ...rawEnvelope().payload, race: { ...rawEnvelope().payload.race, surfaceCode: source } } }), raceOfficeRawPayloadNormalizationMapping, receivedAt);
    assert.equal(result.valid, true);
    assert.equal(result.artifacts[0].canonical.race.surface, expected);
  }
});

test('schema normalization maps Japanese racing source values from configuration', () => {
  const payload = {
    ...rawEnvelope().payload,
    race: {
      ...rawEnvelope().payload.race,
      surfaceCode: '芝',
      status: '発走前',
    },
  };
  const result = normalizeRawPayloadEnvelope(rawEnvelope({ payload }), raceOfficeRawPayloadNormalizationMapping, receivedAt);

  assert.equal(result.valid, true);
  assert.equal(result.artifacts[0].canonical.race.surface, 'turf');
  assert.equal(result.artifacts[0].canonical.race.status, 'scheduled');
});

test('schema normalization converts furlong distances to meters', () => {
  const result = normalizeRawPayloadEnvelope(rawEnvelope(), raceOfficeRawPayloadNormalizationMapping, receivedAt);

  assert.equal(result.valid, true);
  assert.equal(result.artifacts[0].canonical.race.distanceMeters, 1207.008);
});

test('schema normalization reports missing required source fields', () => {
  const payload = {
    ...rawEnvelope().payload,
    race: {
      ...rawEnvelope().payload.race,
      surfaceCode: '',
    },
  };
  const result = normalizeRawPayloadEnvelope(rawEnvelope({ payload }), raceOfficeRawPayloadNormalizationMapping, receivedAt);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('race.surfaceCode is required'));
});

test('schema normalization preserves raw payload identity and provider provenance', () => {
  const result = normalizeRawPayloadEnvelope(rawEnvelope(), raceOfficeRawPayloadNormalizationMapping, receivedAt);
  const artifact = result.artifacts[0];

  assert.equal(result.valid, true);
  assert.equal(artifact.rawPayloadId, 'raw-race-card-001');
  assert.deepEqual(artifact.providerRefs, rawEnvelope().providerRefs);
  assert.equal(artifact.source.rawPayloadId, 'raw-race-card-001');
  assert.equal(artifact.source.provider, 'example-racing-provider');
  assert.equal(artifact.source.mappingId, 'race-office.raw-payload.v1');
  assert.deepEqual(artifact.source.providerRefs, rawEnvelope().providerRefs);
  assert.deepEqual(artifact.source.fieldProvenance['race.surface'], {
    sourcePath: 'race.surfaceCode',
    sourceValue: 'D',
    transform: 'value-map',
  });
  assert.equal(artifact.canonical.race.id, 'race:race-7');
  assert.equal(artifact.canonical.identity.providerRaceId, 'SRC-RACE-7');
});
