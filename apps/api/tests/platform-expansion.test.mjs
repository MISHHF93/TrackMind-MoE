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
  graph.relate({ from: 'horse-1', to: 'race-1', type: 'DEPENDS_ON' });
  const updated = graph.applyStateUpdate({ nodeId: 'horse-1', patch: { gps: [38.1, -77.1] }, observedAt: '2026-06-13T00:01:00Z', source: 'gps' });
  assert.deepEqual(updated.state.gps, [38.1, -77.1]);
  assert.equal(graph.neighborhood('horse-1').relationships.length, 2);
  assert.equal(graph.history('horse-1').length, 1);
  assert.equal(graph.dependencyGraph(['horse-1']).relationships.length, 1);
  assert.deepEqual(graph.stateAt('horse-1', '2026-06-13T00:01:00Z').gps, [38.1, -77.1]);
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

import {
  designFederatedRacetrackArchitecture,
  RacingKnowledgeGraph,
  DigitalTwinRuntimeEngine,
  EventSourcedCqrsStore,
  evaluateTrackAccreditation,
  nationalCommandDashboard,
  monteCarloRaceDay,
  weatherIntelligence,
  surfaceIntelligenceLab,
  validateExplainableDecision,
  responsibleAiGovernanceBlueprint,
  ModelRegistry,
  ComplianceEvidenceVault,
  integrityMonitoringService,
  visionOrchestrationPlatform,
  equineDigitalPassport,
  predictiveInjuryResearchSandbox,
  enterpriseArchitectureArtifacts,
} from '../dist/index.js';

test('enterprise-scale federation, graph, twins, CQRS, governance, and command services are modeled', () => {
  const federation = designFederatedRacetrackArchitecture([{ id: 'trk-1', name: 'Track 1', region: 'east', tier: 'local-track', dataResidency: 'US' }]);
  assert.equal(federation.maxRacetracks, 500);
  assert.equal(federation.capacityOk, true);
  assert.ok(federation.isolation.includes('per-track encryption keys'));

  const kg = new RacingKnowledgeGraph();
  kg.upsert({ id: 'horse-1', kind: 'horse', name: 'Example Horse' });
  kg.upsert({ id: 'incident-1', kind: 'incident', name: 'Inquiry' });
  kg.connect({ from: 'horse-1', to: 'incident-1', relationship: 'INVOLVED_IN', evidence: ['steward-report'] });
  assert.equal(kg.trace('horse-1').edges.length, 1);

  const runtime = new DigitalTwinRuntimeEngine();
  assert.equal(runtime.targetAssetCapacity, 10_000_000);
  assert.equal(runtime.sync({ id: 'gate-1', tenantId: 'trk-1', updatedAt: '2026-06-13T00:00:00Z', state: { open: false } }).version, 1);

  const store = new EventSourcedCqrsStore();
  store.append({ id: 'e1', aggregateId: 'race-1', type: 'RaceScheduled', version: 1, occurredAt: '2026-06-13T00:00:00Z', payload: { status: 'scheduled' } });
  assert.equal(store.project('race-1', (state, event) => ({ ...state, ...event.payload }), {}).status, 'scheduled');

  assert.equal(evaluateTrackAccreditation([{ domain: 'operations', score: 95, evidence: ['ops'] }, { domain: 'maintenance', score: 92, evidence: ['maint'] }, { domain: 'safety', score: 94, evidence: ['safe'] }, { domain: 'compliance', score: 93, evidence: ['comp'] }]).status, 'accredited');
  assert.equal(nationalCommandDashboard([{ tenantId: 'trk-1', assetId: 'a1', latitude: 1, longitude: 2, health: 'critical', metric: 9 }]).criticalAssets, 1);
  assert.equal(monteCarloRaceDay([{ delayMinutes: 10, incidentProbability: 0.05, cost: 1000 }], 100).recommendation, 'proceed');
  assert.equal(weatherIntelligence({ sensorRainMm: 1, forecastRainMm: 2, windMph: 5 }).risk, 'normal');
  assert.equal(surfaceIntelligenceLab({ moisture: 18, compaction: 240, drainageRate: 10, wearIndex: 2, maintenanceEffectiveness: 10 }).action, 'race-ready');
  assert.equal(validateExplainableDecision({ id: 'd1', evidence: ['obs'], confidence: 0.9, confidenceInterval: [0.8, 0.95], approvals: ['steward'] }).valid, true);
  assert.equal(responsibleAiGovernanceBlueprint().length, 4);

  const registry = new ModelRegistry();
  registry.register({ id: 'm1', lineage: ['data-1'], approvals: ['mlops'], evaluations: { safety: 0.91 }, deployed: false });
  assert.equal(registry.deployable('m1'), true);
  const vault = new ComplianceEvidenceVault();
  vault.add({ id: 'audit-1', type: 'inspection', hash: 'sha256:abc', retainedUntil: '2032-01-01' });
  assert.equal(vault.query('inspection').length, 1);
  assert.equal(integrityMonitoringService([{ id: 'w1', type: 'wagering', zScore: 5.1, evidence: ['pool'] }])[0].severity, 'critical');
  assert.equal(visionOrchestrationPlatform([{ id: 'v1', task: 'horse-detection', approved: true, edgeTargets: ['cam-1'] }]).deployableModels, 1);
  assert.equal(equineDigitalPassport({ horseId: 'h1', welfareEvents: ['exam'], races: ['r1'], complianceFlags: [] }).eligible, true);
  assert.equal(predictiveInjuryResearchSandbox(true).decisionUse, 'prohibited');
  assert.ok(enterpriseArchitectureArtifacts.threatModel.includes('tampering'));
});
