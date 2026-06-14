import test from 'node:test';
import assert from 'node:assert/strict';
import { DigitalTwinFoundationPlatform } from '../dist/digitalTwinFoundation.js';

test('digital twin foundation synchronizes full racetrack objects with playback, controls, simulation, risk, dependencies, and audit', () => {
  const platform = new DigitalTwinFoundationPlatform();
  platform.registerTwin({ id: 'facility-paddock', kind: 'facility', name: 'Paddock', tenantId: 'trk-1', updatedAt: '2026-06-13T00:00:00Z', state: { occupancy: 12 }, geospatial: { latitude: 38.1, longitude: -77.1, zoneId: 'paddock' } });
  platform.registerTwin({ id: 'horse-7', kind: 'horse', name: 'Horse 7', tenantId: 'trk-1', updatedAt: '2026-06-13T00:00:00Z', state: { stall: 'A7' }, dependencies: ['facility-paddock'], regulatoryRefs: ['HISA-safety'] });
  platform.registerTwin({ id: 'sensor-hr-7', kind: 'sensor', name: 'Horse 7 wearable', tenantId: 'trk-1', updatedAt: '2026-06-13T00:00:00Z', state: { online: true } });
  platform.relate({ from: 'horse-7', to: 'facility-paddock', type: 'LOCATED_AT', evidence: ['stable-roster'] });
  platform.relate({ from: 'horse-7', to: 'sensor-hr-7', type: 'MONITORED_BY', evidence: ['device-registry'] });
  platform.bindTelemetry('horse-7', { sensorId: 'sensor-hr-7', metric: 'heartRate', unit: 'bpm', freshnessSeconds: 5 });
  platform.addControlInterface('facility-paddock', { id: 'gate-lockdown', action: 'lock-paddock-gates', mode: 'manual-approval-required', requiredApprovals: ['steward', 'security'] });

  const synced = platform.synchronize({ twinId: 'horse-7', expectedVersion: 2, observedAt: '2026-06-13T00:00:05Z', sourceSystem: 'wearable-stream', patch: { heartRate: 191 }, telemetry: { sensorId: 'sensor-hr-7', metric: 'heartRate', value: 191, unit: 'bpm' } });

  assert.equal(synced.version, 3);
  assert.equal(synced.health, 'critical');
  assert.ok(synced.riskScore >= 80);
  assert.ok(synced.healthIndicators.some((indicator) => indicator.status === 'critical'));
  assert.equal(platform.playback('horse-7').length, 3);
  assert.equal(platform.simulationEnvironment(['horse-7', 'facility-paddock'], 'race-day-delay').controlsIsolated, true);
  assert.equal(platform.dependencyGraph(['horse-7']).length, 2);
  assert.equal(platform.healthIndicatorsFor('horse-7').at(-1).name, 'telemetry-source');
  assert.equal(platform.audit('horse-7').at(-1).actor, 'wearable-stream');
});
