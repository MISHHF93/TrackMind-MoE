import test from 'node:test';
import assert from 'node:assert/strict';
import { GeospatialOperationsService } from '../dist/geospatialOperations.js';
import { buildTrackConfigurationSnapshot } from '../dist/trackConfiguration.js';

const baseAsset = (assetId, assetType, tags, location, maintenance = 'ok') => ({
  assetId, externalIds: [], name: assetId, assetType, domain: 'operations', lifecycleStatus: 'active', riskLevel: 'medium',
  maintenance: { status: maintenance }, ownership: { ownerAgent: 'operations', stewardTeam: 'ops' }, location, state: {}, controls: [], sensors: [], regulations: [], tags,
  digitalTwin: { twinId: `twin:${assetId}`, relationship: 'represents' }, approvalPolicyId: 'standard-asset-approval', createdAt: '2026-06-13T10:00:00Z', updatedAt: '2026-06-13T10:05:00Z', version: 1, metadata: {}
});

test('geospatial operations renders Digital Twin racetrack map with filters, overlays, playback, and simulations', () => {
  const service = new GeospatialOperationsService({ trackId: 'belmont-main' });
  service.upsertFeature({ id: 'sector:stretch', layer: 'sector', label: 'Home Stretch', geometry: { type: 'LineString', coordinates: [{ latitude: 38.04, longitude: -76.96 }, { latitude: 38.05, longitude: -76.94 }] }, status: 'nominal', timestamp: '2026-06-13T10:00:00Z', source: 'track-configuration', properties: { surface: 'dirt' } });
  service.ingestAssets([
    baseAsset('gate-1', 'starting gate', ['gate'], { latitude: 38.041, longitude: -76.959 }),
    baseAsset('barn-2', 'barn facility', ['barn', 'facility'], { latitude: 38.06, longitude: -76.955 }),
    baseAsset('camera-9', 'ptz camera', ['camera'], { latitude: 38.045, longitude: -76.949 }, 'overdue'),
    baseAsset('ambulance-1', 'equine ambulance', ['emergency'], { latitude: 38.052, longitude: -76.951 })
  ]);
  service.ingestTelemetry([{ id: 'surface-1', source: 'sensor', subjectId: 'surface-probe-1', observedAt: '2026-06-13T10:06:00Z', payload: { latitude: 38.046, longitude: -76.948, moisture: 19, compaction: 72, status: 'warning' } }]);
  service.ingestTwinState([{ twinId: 'twin:gate-1', assetId: 'gate-1', name: 'Starting Gate Twin', assetType: 'starting gate', domain: 'operations', state: { location: { latitude: 38.041, longitude: -76.959 } }, health: 'healthy', telemetryReferences: [], eventHistory: [], dependencies: [], relationships: [], riskIndicators: [], approvalRequirements: [], simulationCapabilities: [], version: 3, createdAt: '2026-06-13T09:00:00Z', updatedAt: '2026-06-13T10:07:00Z' }]);
  service.addSimulationOverlay({ scenario: 'rail-move-race-7', twinId: 'twin:gate-1', baselineVersion: 3, predictedHealth: 'degraded', projectedRiskScore: 61, state: {}, approvalRequired: true, assumptions: [] });

  const map = service.render({}, 16);
  assert.equal(map.trackId, 'belmont-main');
  assert.ok(map.layers.some((layer) => layer.layer === 'emergency-resource'));
  assert.ok(map.features.some((feature) => feature.layer === 'starting-gate'));
  assert.ok(map.features.some((feature) => feature.layer === 'barn'));
  assert.ok(map.features.some((feature) => feature.layer === 'camera' && feature.status === 'warning'));
  assert.ok(map.features.some((feature) => feature.layer === 'telemetry' && feature.properties.moisture === 19));
  assert.equal(map.digitalTwinState[0].version, 3);
  assert.equal(map.simulationOverlays[0].approvalRequired, true);
  assert.ok(map.playback.length >= 3);
  assert.deepEqual(service.render({ layers: ['camera'] }).features.map((feature) => feature.layer), ['camera']);
  assert.equal(service.apiDefinition().basePath, '/api/v1/geospatial');
});

test('geospatial operations ingests track configuration snapshots for gate, rail, and turf layers', () => {
  const service = new GeospatialOperationsService({ trackId: 'belmont-main' });
  const snapshot = buildTrackConfigurationSnapshot(
    [{ id: 'main-turf', name: 'Main Turf', surface: 'turf', polygon: [{ latitude: 38.0, longitude: -77.0 }, { latitude: 38.0, longitude: -76.9 }, { latitude: 38.1, longitude: -76.9 }, { latitude: 38.1, longitude: -77.0 }] }],
    [{ id: 'stretch', name: 'Stretch', surface: 'turf', kind: 'straight', centerline: { points: [{ latitude: 38.04, longitude: -76.96 }, { latitude: 38.05, longitude: -76.94 }] }, lengthMeters: 500, widthMeters: 24, restrictions: ['portable-rail-clearance'] }],
    [],
    [{
      raceId: 'race-7',
      distanceMeters: 1600,
      surface: 'turf',
      maxFieldSize: 12,
      gatePlacement: { gateId: 'gate-a', raceId: 'race-7', distanceMeters: 1600, location: { latitude: 38.05, longitude: -76.95 }, headingDegrees: 92 },
      railPosition: { railId: 'rail-b', offsetMeters: 6, effectiveFrom: '2026-06-13T17:00:00Z', protectedTurns: ['far-turn'] },
      turfConfiguration: { lane: 'B', going: 'good', irrigationMillimeters: 2, mowingHeightMillimeters: 110, resting: false },
      surfaceAllocation: { surface: 'turf', purpose: 'racing', start: '2026-06-13T18:00:00Z', end: '2026-06-13T22:00:00Z' },
      regulatoryJurisdiction: 'US-HISA-state-racing-commission',
    }],
    '2026-06-13T10:00:00Z'
  );
  service.ingestTrackConfiguration(snapshot);
  const map = service.render({}, 16);
  assert.ok(map.features.some((feature) => feature.id === 'gate:gate-a:race-7' && feature.layer === 'starting-gate'));
  assert.ok(map.features.some((feature) => feature.id === 'rail:rail-b:race-7' && feature.layer === 'rail'));
  assert.ok(map.features.some((feature) => feature.id === 'turf:B:race-7' && feature.properties.going === 'good'));
});
