import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DigitalTwinGraph,
  TelemetryEngine,
  buildMoistureHeatmap,
  scoreTrackSurface,
  predictMaintenance,
  ingestBiometrics,
  analyzeBiomechanics,
  predictiveInjuryRisk,
  detectUnusualWagering,
  summarizeVision,
  buildEvidenceTimeline,
  mapComplianceControls,
  aiEvaluationMetrics,
  emergencyCommandPlan,
  executiveForecast,
  replayRaceDay,
  ResponsibleAIGovernanceCenter,
} from '../dist/index.js';

test('digital twin graph stores asset relationships and real-time state history', () => {
  const graph = new DigitalTwinGraph();
  graph.upsertNode({ id: 'horse-1', kind: 'biological', labels: ['Horse'], name: 'Sample Horse', state: { stall: 'A1' }, updatedAt: '2026-06-13T00:00:00Z' });
  graph.upsertNode({ id: 'race-1', kind: 'operational', labels: ['Race'], name: 'Race 1', state: { status: 'scheduled' }, updatedAt: '2026-06-13T00:00:00Z' });
  graph.relate({ from: 'horse-1', to: 'race-1', type: 'PARTICIPATES_IN' });
  const updated = graph.applyStateUpdate({ nodeId: 'horse-1', patch: { gps: [38.1, -77.1] }, observedAt: '2026-06-13T00:01:00Z', source: 'gps' });
  assert.deepEqual(updated.state.gps, [38.1, -77.1]);
  assert.equal(graph.neighborhood('horse-1').relationships.length, 1);
  assert.equal(graph.history('horse-1').length, 1);
});

test('telemetry engine validates high volume telemetry batches', () => {
  const engine = new TelemetryEngine(100_000);
  const events = Array.from({ length: 1_000 }, (_, i) => ({ id: `evt-${i}`, source: 'sensor', subjectId: 'track', observedAt: '2026-06-13T00:00:00Z', payload: { moisture: 18 } }));
  const result = engine.ingest(events);
  assert.equal(result.accepted, 1_000);
  assert.equal(result.eventsPerMinuteCapacity, 100_000);
  assert.equal(engine.throughput('2026-06-13T00:00'), 1_000);
});

test('surface, maintenance, biometric, integrity, operations, and governance services produce auditable outputs', () => {
  assert.equal(buildMoistureHeatmap([{ latitude: 1.12345, longitude: 2.12345, moisture: 20, observedAt: '2026-06-13T00:00:00Z' }])[0].samples, 1);
  assert.ok(scoreTrackSurface({ moisture: 18, compaction: 240, depth: 3.5, temperature: 75, rainfall: 0, maintenanceHoursAgo: 1 }).safetyScore > 90);
  assert.equal(predictMaintenance({ assetId: 'gate-1', type: 'gate', ageDays: 1200, faultCount30d: 3, runtimeHours: 6000, criticality: 4 }).priority, 'urgent');
  const sample = ingestBiometrics({ horseId: 'h1', deviceId: 'wear-1', observedAt: '2026-06-13T00:00:00Z', heartRate: 195, gaitSymmetry: 0.8 });
  assert.equal(sample.normalized, true);
  assert.equal(analyzeBiomechanics([sample]).fatigueIndicators, 1);
  assert.equal(predictiveInjuryRisk([sample], 1).veterinarianReviewOnly, true);
  assert.equal(detectUnusualWagering([{ raceId: 'r1', timestamp: 't1', pool: 'win', amount: 100, oddsByRunner: {} }, { raceId: 'r1', timestamp: 't2', pool: 'win', amount: 700, oddsByRunner: {} }])[0].severity, 'high');
  assert.equal(summarizeVision({ cameraId: 'c1', timestamp: 't', detections: [{ task: 'horse-detection', confidence: 0.9, bbox: [0, 0, 1, 1] }] }).horseCount, 1);
  assert.equal(buildEvidenceTimeline([{ cameraId: 'c1', start: '2', end: '3', uri: 'b' }, { cameraId: 'c2', start: '1', end: '2', uri: 'a' }])[0].cameraId, 'c2');
  assert.equal(mapComplianceControls().length, 8);
  assert.equal(aiEvaluationMetrics([{ hallucinated: false, policyCompliant: true, evidenceScore: 1, explainabilityScore: 1, approvalChainOk: true }]).policyComplianceRate, 1);
  assert.equal(emergencyCommandPlan('fire').incidentCommander, 'operations-director');
  assert.equal(executiveForecast({ revenue: 100, attendance: 1000, safetyIncidents: 1, complianceOpenItems: 2, maintenanceRisk: 80 }).maintenanceForecast, 'elevated');
  assert.equal(replayRaceDay([{ timestamp: '2', type: 'end' }, { timestamp: '1', type: 'start' }])[0].type, 'start');
  const center = new ResponsibleAIGovernanceCenter();
  center.record({ id: 'm1', kind: 'model-version', actor: 'mlops', timestamp: '2026-06-13T00:00:00Z', evidence: ['registry'] });
  assert.equal(center.byKind('model-version').length, 1);
});
