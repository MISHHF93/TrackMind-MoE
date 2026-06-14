import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustConfidence,
  apiContractSchemas,
  apiEndpointContracts,
  buildFeatureStoreRecords,
  buildGateFeatureRecord,
  buildRaceFeatureRecord,
  buildSurfaceFeatureRecord,
  calculateGateMoveRisk,
  calculateRaceReadiness,
  calculateSurfaceRisk,
  clamp01,
  normalizeRange,
  scoreDataQuality,
  targetDeviationRisk,
  validateContract,
} from '../dist/index.js';

const asOf = '2026-06-13T12:00:00Z';
const metadata = (domain, extra = {}) => ({
  tenantId: 'tenant-001',
  racetrackId: 'track-main',
  domain,
  correlationId: 'corr-feature-store-test',
  asOf,
  source: 'unit-test-builder',
  ...extra,
});

test('feature formulas use deterministic weighted equations', () => {
  assert.equal(calculateSurfaceRisk({ moistureRisk: 0.5, compactionRisk: 0.4, cushionDepthRisk: 0.3, weatherRisk: 0.2, maintenanceGapRisk: 0.1 }), 0.35);
  assert.equal(calculateRaceReadiness({ surfaceReadiness: 0.8, gateReadiness: 0.7, vetReadiness: 1, stewardReadiness: 0.9, emergencyReadiness: 0.6, securityReadiness: 0.5, weatherReadiness: 0.4 }), 0.765);
  assert.equal(calculateGateMoveRisk({ distanceChangeRisk: 0.6, gpsUncertainty: 0.5, inspectionAgeRisk: 0.4, weatherRisk: 0.3, crewAvailabilityRisk: 0.2 }), 0.465);
});

test('feature normalization, clamping, quality, and confidence adjustment are bounded', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(3), 1);
  assert.equal(normalizeRange(5, 0, 10), 0.5);
  assert.equal(normalizeRange(5, 0, 10, true), 0.5);
  assert.equal(targetDeviationRisk(28, 18, 3, 15), 0.5833);

  const quality = scoreDataQuality({
    requiredFields: ['a', 'b', 'c', 'd'],
    presentFields: ['a', 'b', 'c'],
    observedAt: '2026-06-13T11:30:00Z',
    asOf,
    staleAfterMinutes: 60,
    outlierScore: 0.25,
  });
  assert.equal(quality.completenessScore, 0.75);
  assert.equal(quality.freshnessScore, 0.5);
  assert.equal(quality.outlierQualityScore, 0.75);
  assert.equal(quality.score, 0.65);
  assert.equal(adjustConfidence({ modelConfidence: 0.9, dataQualityScore: 0.8, evidenceCompleteness: 0.75, freshnessScore: 0.5 }), 0.27);
});

test('feature builders create unified records with metadata, quality, and scores', () => {
  const surface = buildSurfaceFeatureRecord({
    metadata: metadata('surface', { assetId: 'surface-turn-1', subjectId: 'turn-1' }),
    observedAt: '2026-06-13T11:30:00Z',
    surfaceType: 'dirt',
    moisturePct: 27,
    compactionPsi: 276,
    cushionDepthInches: 2.8,
    drainageRateMmPerHour: 6,
    temperatureF: 83,
    rainfallMm: 5,
    forecastRainMm: 14,
    maintenanceCompletedAt: '2026-06-13T08:00:00Z',
  });
  assert.equal(surface.schemaVersion, 'trackmind.feature-store.v1');
  assert.equal(surface.metadata.tenantId, 'tenant-001');
  assert.equal(surface.metadata.racetrackId, 'track-main');
  assert.equal(surface.metadata.domain, 'surface');
  assert.equal(surface.placeholder, true);
  assert.ok(surface.scores.surfaceRisk > 0.3);
  assert.ok(surface.scores.surfaceReadiness < 0.7);
  assert.equal(surface.dataQuality.missingFields.length, 0);
  assert.deepEqual(validateContract('FeatureRecordDto', surface, apiContractSchemas.FeatureRecordDto), { valid: true, errors: [] });

  const gate = buildGateFeatureRecord({
    metadata: metadata('gate', { assetId: 'gate-main', subjectId: 'race-7' }),
    observedAt: '2026-06-13T11:45:00Z',
    currentMetersFromStart: 1200,
    targetMetersFromStart: 1300,
    gpsAccuracyMeters: 8,
    gpsVerified: true,
    inspectionAt: '2026-06-13T10:00:00Z',
    crewAvailablePct: 75,
    weatherRisk: 0.4,
  });
  assert.ok(gate.scores.gateMoveRisk > 0);
  assert.ok(gate.scores.gateReadiness < 1);

  const race = buildRaceFeatureRecord({
    metadata: metadata('race', { subjectId: 'race-7' }),
    observedAt: '2026-06-13T11:50:00Z',
    distanceMeters: 1300,
    entries: 8,
    scratches: 1,
    postTime: '2026-06-13T12:20:00Z',
    surfaceReadiness: surface.scores.surfaceReadiness,
    gateReadiness: gate.scores.gateReadiness,
    vetReadiness: 0.95,
    stewardReadiness: 0.9,
    emergencyReadiness: 0.85,
    securityReadiness: 0.8,
    weatherReadiness: 0.6,
  });
  assert.equal(race.metadata.subjectId, 'race-7');
  assert.ok(race.scores.raceReadiness > 0.6);
  assert.ok(race.scores.scratchRate > 0);
});

test('feature store batch builder covers horse, security, weather, and operations records', () => {
  const records = buildFeatureStoreRecords({
    horses: [{
      metadata: metadata('horse', { subjectId: 'horse-42' }),
      observedAt: '2026-06-13T11:00:00Z',
      workoutCountLast30Days: 3,
      averageWorkoutDistanceFurlongs: 4,
      raceStartsLast90Days: 2,
      historyStarts: 9,
      restDays: 21,
      openVetFlags: 0,
      eligibilityStatus: 'eligible',
      latestWorkoutAt: '2026-06-10T12:00:00Z',
    }],
    security: [{
      metadata: metadata('security', { assetId: 'security-zone-1' }),
      observedAt: '2026-06-13T11:55:00Z',
      camerasOnline: 18,
      camerasTotal: 20,
      accessDenied: 2,
      accessEvents: 100,
      restrictedAlerts: 1,
      activeIncidents: 1,
      criticalAlerts: 0,
    }],
    weather: [{
      metadata: metadata('weather', { assetId: 'weather-feed-main' }),
      observedAt: '2026-06-13T11:58:00Z',
      rainfallMm: 5,
      windMph: 14,
      lightningMiles: 18,
      humidityPct: 74,
      forecastRainMm: 12,
      forecastConfidence: 0.8,
    }],
    operations: [{
      metadata: metadata('operations', { subjectId: 'race-day-ops' }),
      observedAt: '2026-06-13T11:40:00Z',
      scheduledStaff: 50,
      checkedInStaff: 45,
      emergencyResourcesReady: 8,
      emergencyResourcesTotal: 10,
      openIncidents: 1,
      criticalIncidents: 0,
      unresolvedEmergencyTasks: 1,
    }],
  });

  assert.deepEqual(new Set(records.map((record) => record.metadata.domain)), new Set(['horse', 'security', 'weather', 'operations']));
  assert.ok(records.every((record) => record.id.startsWith(`feature:${record.metadata.domain}:tenant-001:`)));
  assert.ok(records.every((record) => record.dataQuality.score >= 0 && record.dataQuality.score <= 1));
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/ai-control-plane/features' && endpoint.response === 'FeatureRecordDto[]'));
});
