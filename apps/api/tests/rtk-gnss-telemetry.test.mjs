import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiFacadeState, handleApiRequest, MultiConstellationGnssSynchronizer } from '../dist/index.js';

function rtkSample(overrides = {}) {
  const observedAt = overrides.observedAt ?? '2026-06-14T18:00:00.000Z';
  const observation = (constellation, satelliteId, skewMs = 0) => ({
    constellation,
    satelliteId,
    signalId: `${constellation}-L1`,
    pseudorangeMeters: 22000000 + satelliteId.length,
    carrierPhaseCycles: 102030.4,
    dopplerHz: -1200.5,
    cn0DbHz: 42,
    lockTimeMs: 12000,
    observedAt: new Date(Date.parse(observedAt) + skewMs).toISOString(),
  });
  return {
    sampleId: 'rtk-sample-1',
    deviceId: 'rtk-collar-1',
    horseId: 'horse-1',
    raceId: 'race-7',
    tenantId: 'tenant-1',
    racetrackId: 'main-track',
    latitude: 38.0450001,
    longitude: -76.9500001,
    altitudeMeters: 22.4,
    zoneId: 'backstretch',
    observedAt,
    sequence: 1,
    updateRateHz: 20,
    horizontalAccuracyCm: 1.4,
    verticalAccuracyCm: 2.1,
    fixType: 'rtk-fixed',
    correctionSource: 'network-rtk',
    baseStationId: 'base-main-track-1',
    observations: [
      observation('GPS', 'G12', 0),
      observation('GLONASS', 'R08', 4),
      observation('Galileo', 'E19', 7),
      observation('BeiDou', 'C06', 10),
    ],
    evidenceLinks: ['rtk://collar-1/sequence/1', 'ntrip://base-main-track-1'],
    ...overrides,
  };
}

test('multi-constellation GNSS synchronization requires GPS GLONASS Galileo and BeiDou within time tolerance', () => {
  const sync = new MultiConstellationGnssSynchronizer();
  const synchronized = sync.synchronize(rtkSample());
  assert.deepEqual(synchronized.constellations.sort(), ['BeiDou', 'GLONASS', 'GPS', 'Galileo'].sort());
  assert.equal(synchronized.maxTimeSkewMs, 10);
  assert.ok(synchronized.qualityScore >= 0.8);

  assert.throws(() => sync.synchronize(rtkSample({ observations: rtkSample().observations.slice(0, 3) })), /Missing GNSS constellations/);
  assert.throws(() => sync.synchronize(rtkSample({ observations: rtkSample().observations.map((obs, index) => ({ ...obs, observedAt: new Date(Date.parse(obs.observedAt) + index * 20).toISOString() })) })), /synchronization tolerance/);
});

test('RTK ingestion accepts 20Hz centimeter-accurate samples and emits monitoring events', async () => {
  const state = createApiFacadeState();
  const accepted = await handleApiRequest('POST', '/api/v1/telemetry/rtk/ingest', rtkSample(), state);
  assert.equal(accepted.status, 202);
  assert.equal(accepted.body.accepted, true);
  assert.equal(accepted.body.event.eventType, 'LocationUpdatedEvent');
  assert.equal(accepted.body.event.category, 'monitoring');
  assert.equal(accepted.body.event.ai.model_id, 'rtk-gnss-synchronizer-v1');
  assert.deepEqual(accepted.body.event.payload.gnss.constellations.sort(), ['BeiDou', 'GLONASS', 'GPS', 'Galileo'].sort());
  assert.equal(state.cqrs.verifyHashChain().valid, true);
});

test('RTK ingestion rejects samples outside accuracy and fixed-rate requirements', async () => {
  const state = createApiFacadeState();
  const rejected = await handleApiRequest('POST', '/api/v1/telemetry/rtk/ingest', rtkSample({ horizontalAccuracyCm: 8, updateRateHz: 10, fixType: 'rtk-float' }), state);
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.accepted, false);
  assert.match(rejected.body.blockedReason, /20Hz/);
  assert.match(rejected.body.blockedReason, /horizontalAccuracyCm/);
  assert.match(rejected.body.blockedReason, /rtk-fixed/);
});

test('race replay projection returns current digital twin state and historical trace', async () => {
  const state = createApiFacadeState();
  await handleApiRequest('POST', '/api/v1/telemetry/rtk/ingest', rtkSample({ sampleId: 'rtk-sample-1', sequence: 1, observedAt: '2026-06-14T18:00:00.000Z', latitude: 38.0450001 }), state);
  await handleApiRequest('POST', '/api/v1/telemetry/rtk/ingest', rtkSample({ sampleId: 'rtk-sample-2', sequence: 2, observedAt: '2026-06-14T18:00:00.050Z', latitude: 38.0451001, evidenceLinks: ['rtk://collar-1/sequence/2'] }), state);

  const replay = await handleApiRequest('GET', '/api/v1/telemetry/races/race-7/replay', undefined, state);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayMetadata.sampleCount, 2);
  assert.equal(replay.body.historicalTrace.length, 2);
  assert.equal(replay.body.current.length, 1);
  assert.equal(replay.body.current[0].sequence, 2);
  assert.equal(replay.body.current[0].horizontalAccuracyCm, 1.4);

  const current = await handleApiRequest('GET', '/api/v1/telemetry/races/race-7/current', undefined, state);
  assert.equal(current.body[0].horseId, 'horse-1');
  assert.equal(current.body[0].sequence, 2);
});
