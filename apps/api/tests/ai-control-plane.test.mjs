import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStewardInquiry,
  listAIAgentRegistryRecords,
  listExpertModelRegistry,
  recommendationDraftToGovernanceRecord,
  ResponsibleAIGovernancePlatform,
  routeAIExpertModel,
  runAIExpertRecommendation,
  seedAIControlPlaneGovernance,
} from '../dist/index.js';

const at = '2026-06-14T12:00:00.000Z';

const surfaceFeatures = {
  surface: {
    trackId: 'track-a',
    generatedAt: at,
    telemetry: [
      { id: 't1', sectionId: 'turn-1', surfaceType: 'dirt', latitude: 38.1, longitude: -77.1, moisture: 29, compaction: 282, drainageRate: 5, cushionDepth: 2.7, temperature: 82, rainfall: 3, observedAt: '2026-06-14T11:00:00.000Z' },
      { id: 't2', sectionId: 'stretch', surfaceType: 'synthetic', latitude: 38.2, longitude: -77.2, moisture: 12, compaction: 212, drainageRate: 13, cushionDepth: 3.1, temperature: 80, rainfall: 1, observedAt: '2026-06-14T11:05:00.000Z' },
    ],
    inspections: [{ id: 'i1', sectionId: 'turn-1', inspectedAt: '2026-06-14T11:30:00.000Z', inspector: 'chief-maintainer', surfaceType: 'dirt', footingUniformity: 72, divots: 4, standingWater: true, railWear: 3, observations: ['standing water near inside lane'] }],
    weather: { observedAt: '2026-06-14T11:45:00.000Z', rainfallMm: 5, forecastRainMm: 18, temperature: 83, windMph: 12 },
    maintenanceRecords: [{ id: 'm1', sectionId: 'turn-1', completedAt: '2026-06-14T08:00:00.000Z', action: 'harrow', effectiveness: 6, notes: 'partial improvement' }],
    observations: [{ id: 'o1', sectionId: 'turn-1', observedAt: '2026-06-14T11:40:00.000Z', role: 'jockey', severity: 4, note: 'uneven footing on turn' }],
  },
};

const readinessFeatures = {
  raceId: 'race-7',
  trackId: 'track-a',
  postTime: '2026-06-14T19:00:00.000Z',
  evaluatedAt: at,
  checks: [
    { domain: 'track', label: 'track readiness', score: 66, status: 'blocked', evidence: ['surface:standing-water'], blockers: ['standing water'], approvalRequired: true, ownerRole: 'track-superintendent' },
    { domain: 'gate', label: 'gate readiness', score: 88, status: 'watch', evidence: ['gate:gps-review'], blockers: ['gps verification pending'], approvalRequired: true, ownerRole: 'racing-secretary' },
    { domain: 'stewards', label: 'steward readiness', score: 95, status: 'ready', evidence: ['stewards:panel-ready'], blockers: [], ownerRole: 'steward' },
  ],
};

const currentChange = {
  id: 'chg-race-7',
  kind: 'race-distance',
  requestedBy: 'race-office',
  requestedAt: at,
  evidence: ['survey:baseline'],
  reason: 'baseline race setup',
  status: 'pending-approval',
  approvals: [],
  raceSetup: {
    raceId: 'race-7',
    distanceMeters: 1609,
    advertisedDistanceMeters: 1609,
    surface: 'dirt',
    maxFieldSize: 12,
    gatePlacement: { gateId: 'gate-1', raceId: 'race-7', distanceMeters: 1609, location: { latitude: 38.045, longitude: -76.95, accuracyMeters: 0.3 }, headingDegrees: 90, runUpMeters: 0 },
    surfaceAllocation: { surface: 'dirt', purpose: 'racing', start: '2026-06-14T18:00:00.000Z', end: '2026-06-14T21:00:00.000Z' },
    regulatoryJurisdiction: 'NY',
    sectorIds: ['chute'],
  },
};

const gateFeatures = {
  currentChange,
  proposedMove: { gateId: 'gate-1', newDistanceMeters: 1614, newLocation: { latitude: 38.046, longitude: -76.951, accuracyMeters: 0.4 }, headingDegrees: 92, reason: 'surface condition adjustment', requestedBy: 'ai-gate-advisor', requestedAt: at, evidence: ['survey:gps-fix', 'surface:turn-1-watch'] },
  boundaries: [{ id: 'track-boundary', name: 'Main dirt', surface: 'dirt', polygon: [{ latitude: 38.03, longitude: -76.97 }, { latitude: 38.07, longitude: -76.97 }, { latitude: 38.07, longitude: -76.93 }, { latitude: 38.03, longitude: -76.93 }] }],
  sectors: [{ id: 'chute', name: 'Chute', surface: 'dirt', kind: 'chute', centerline: { points: [{ latitude: 38.045, longitude: -76.95 }, { latitude: 38.046, longitude: -76.951 }] }, lengthMeters: 300, widthMeters: 18, restrictions: [] }],
};

const inquiry = createStewardInquiry({
  id: 'inq-1',
  raceId: 'race-7',
  openedAt: at,
  openedBy: 'steward-1',
  involvedHorses: [{ horseId: 'horse-4', name: 'Rail Runner', programNumber: '4', officialResultLocked: true }],
  involvedJockeys: [{ jockeyId: 'jockey-4', name: 'Sam Rivera', licenseId: 'LIC-4', horseId: 'horse-4' }],
  evidenceReferences: [{ id: 'ev-headon', kind: 'video', uri: 's3://clip', capturedAt: at, addedBy: 'video-review', description: 'Head-on replay', hash: 'sha256:clip' }],
  ruleReferences: [{ id: 'rule-interference', jurisdiction: 'NY', rulebook: 'Racing Rules', section: '4035.2', citation: 'Interference', summary: 'Human stewards review interference.' }],
});

function requests() {
  return [
    { id: 'draft-surface', domain: 'surface-risk', recommendationType: 'risk-assessment', features: surfaceFeatures, requestedAt: at },
    { id: 'draft-readiness', domain: 'race-readiness', recommendationType: 'readiness', features: readinessFeatures, requestedAt: at },
    { id: 'draft-gate', domain: 'gate-position', recommendationType: 'position-recommendation', features: gateFeatures, requestedAt: at },
    { id: 'draft-equine', domain: 'equine-advisory', recommendationType: 'advisory', features: { profile: { horseId: 'horse-4', workoutHistory: [{ date: '2026-06-10', distanceFurlongs: 5 }], raceHistory: [{ date: '2026-06-01', raceId: 'race-5' }], vetFlags: [{ id: 'flag-1', status: 'open', reason: 'placeholder review' }], restDays: 5, medicationStatus: 'placeholder-unknown', shoeingEquipmentNotes: [] }, horseName: 'Rail Runner' }, requestedAt: at },
    { id: 'draft-security', domain: 'security-anomaly', recommendationType: 'anomaly', features: { scope: 'enterprise', signals: [{ id: 'sig-1', type: 'restricted-area', source: 'access-control', subject: 'credential-1', location: 'zone-medication', observedAt: at, description: 'Denied critical-zone access', severity: 'high', confidence: 0.91, restrictedArea: true, evidenceUris: ['video://cam-med-1'] }] }, requestedAt: at },
    { id: 'draft-weather', domain: 'weather-impact', recommendationType: 'impact-forecast', features: { trackId: 'track-a', affectedRaceIds: ['race-7'], weather: { observedAt: at, rainfallMm: 6, forecastRainMm: 22, temperature: 91, windMph: 21, lightningMiles: 5 } }, requestedAt: at },
    { id: 'draft-maintenance', domain: 'maintenance-forecasting', recommendationType: 'maintenance-forecast', features: { signals: [{ assetId: 'GATE_01', type: 'gate', ageDays: 800, faultCount30d: 4, runtimeHours: 1800, criticality: 4 }] }, requestedAt: at },
    { id: 'draft-steward', domain: 'steward-evidence', recommendationType: 'evidence-assistance', features: { inquiry, generatedAt: at, missingEvidence: ['pan replay pending'] }, requestedAt: at },
    { id: 'draft-executive', domain: 'executive-intelligence', recommendationType: 'executive-briefing', features: { generatedAt: at, briefingItems: [{ domain: 'surface-risk', status: 'critical', riskLevel: 'critical', summary: 'Surface standing water', evidence: ['surface:standing-water'], protectedActions: ['race-start'] }, { domain: 'security-anomaly', status: 'watch', riskLevel: 'high', summary: 'Medication zone alert', evidence: ['security:sig-1'], protectedActions: ['emergency-action'] }] }, requestedAt: at },
  ];
}

test('model registry contains all TrackMind Nexus control-plane expert records with ISO and NIST controls', () => {
  const registry = listExpertModelRegistry();
  const expectedDomains = ['surface-risk', 'race-readiness', 'gate-position', 'equine-advisory', 'security-anomaly', 'weather-impact', 'maintenance-forecasting', 'steward-evidence', 'executive-intelligence'];

  assert.deepEqual(registry.map((record) => record.controlPlaneDomain).sort(), expectedDomains.sort());
  assert.equal(new Set(registry.map((record) => record.id)).size, 9);
  assert.ok(registry.every((record) => record.deterministicPlaceholder));
  assert.ok(registry.every((record) => record.advisoryOnly));
  assert.ok(registry.every((record) => record.blockedAutonomousExecution));
  assert.ok(registry.every((record) => record.protectedControlExecutionAllowed === false));
  assert.ok(registry.every((record) => record.governanceControls.some((control) => control.framework === 'ISO42001')));
  assert.ok(registry.every((record) => record.governanceControls.some((control) => control.framework === 'NIST-AI-RMF')));

  const agentRecords = listAIAgentRegistryRecords(at);
  assert.equal(agentRecords.length, registry.length);
  assert.ok(agentRecords.every((record) => record.agent.modelVersionId === record.evaluation.modelId));
  assert.ok(agentRecords.every((record) => record.agent.promptTemplateId === record.promptTemplate.id));
  assert.ok(agentRecords.every((record) => record.governanceControls.some((control) => control.framework === 'ISO42001')));
});

test('AI router selects expert models by input domain and requested recommendation type', () => {
  for (const request of requests()) {
    const model = routeAIExpertModel(request);
    assert.equal(model.controlPlaneDomain, request.domain);
    assert.ok(model.recommendationTypes.includes(request.recommendationType));
  }

  assert.throws(() => routeAIExpertModel({ domain: 'surface-risk', recommendationType: 'executive-briefing' }), /does not support/);
});

test('each deterministic expert emits recommendation drafts with evidence and blocked autonomous execution', () => {
  const drafts = requests().map((request) => runAIExpertRecommendation(request));

  assert.equal(drafts.length, 9);
  for (const draft of drafts) {
    assert.equal(draft.advisoryOnly, true);
    assert.equal(draft.blockedAutonomousExecution, true);
    assert.equal(draft.protectedControlExecutionAllowed, false);
    assert.ok(draft.recommendation.length > 10);
    assert.ok(draft.evidence.length > 0);
    assert.ok(draft.confidence > 0 && draft.confidence <= 1);
    assert.ok(['low', 'medium', 'high', 'critical'].includes(draft.riskLevel));
    assert.ok(Array.isArray(draft.requiredApprovals));
    assert.ok(draft.affectedAssets.length > 0);
    assert.ok(draft.lineage.some((item) => item.startsWith('model:')));
    assert.ok(draft.limitations.some((item) => /Recommendation only/i.test(item)));
    if (draft.draftAction) assert.equal(draft.draftAction.executionAllowed, false);
  }
});

test('gate and steward experts preserve protected-action constraints', () => {
  const gate = runAIExpertRecommendation(requests().find((request) => request.domain === 'gate-position'));
  assert.equal(gate.draftAction.action, 'starting-gate-move');
  assert.equal(gate.draftAction.physicalMovementAllowed, false);
  assert.match(gate.recommendation, /no live actuator|physical gate movement|locked/i);
  assert.ok(gate.protectedActions.includes('safety-critical-control'));

  const steward = runAIExpertRecommendation(requests().find((request) => request.domain === 'steward-evidence'));
  assert.equal(steward.draftAction.officialRuling, false);
  assert.equal(steward.draftAction.mayModifyOfficialResults, false);
  assert.ok(steward.protectedActions.includes('steward-ruling'));
  assert.match(steward.recommendation, /did not issue a ruling/i);
});

test('control-plane registry seeds existing Responsible AI governance structures', () => {
  const platform = new ResponsibleAIGovernancePlatform();
  const records = seedAIControlPlaneGovernance(platform, at);
  const workspace = platform.governanceWorkspace();

  assert.equal(records.length, 9);
  assert.equal(workspace.modelVersions.length, 9);
  assert.equal(workspace.promptTemplates.length, 9);
  assert.equal(workspace.activeAgents.length, 9);
  assert.ok(workspace.modelVersions.every((model) => model.evidence.some((item) => /ISO42001|NIST-AI-RMF|docs\/compliance/.test(item))));
  assert.ok(workspace.evaluationStatus.every((status) => status.readiness.deployable));

  const draft = runAIExpertRecommendation(requests()[0]);
  const record = recommendationDraftToGovernanceRecord(draft);
  const governed = platform.recordRecommendation(record);
  assert.equal(governed.status, 'pending-approval');
  assert.equal(governed.activity, 'recommend');
  assert.ok(governed.explainability.humanReviewRequired);
});
