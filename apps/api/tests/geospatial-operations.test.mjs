import test from 'node:test';
import assert from 'node:assert/strict';
import { GeospatialOperationsService } from '../dist/index.js';

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
