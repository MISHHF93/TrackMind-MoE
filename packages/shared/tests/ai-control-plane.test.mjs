import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptAIRecommendationOutputToForecastArtifact,
  adaptAIRecommendationOutputToInsightArtifact,
  adaptAIRecommendationOutputToRecommendationArtifact,
  adaptFeatureRecordToFeatureArtifact,
  aiControlPlaneBlockedActions,
  aiControlPlaneContractSchemas,
  aiControlPlaneFlow,
  aiControlPlaneModuleIds,
  aiGovernanceFrameworkAnchors,
  buildSurfaceFeatureRecord,
  createDefaultAIControlPolicyConfig,
  nexusComplianceFrameworks,
  selectCanonicalAITrainingInputs,
  validateAIControlPolicyConfig,
  validateAIOutputArtifact,
  validateAIRecommendationOutput,
  validateUnifiedAIInput,
} from '../dist/index.js';

test('unified AI input schema covers source, domain, data, confidence, and quality shape', () => {
  const input = {
    inputId: 'input-surface-1',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    timestamp: '2026-06-14T20:00:00.000Z',
    source: 'iot',
    domain: 'surface',
    assetId: 'sector:far-turn',
    data: { moisturePct: 27, compactionKpa: 276 },
    confidence: 0.91,
    quality: { isComplete: true, isFresh: true, outlierScore: 0.12 },
  };

  assert.ok(aiControlPlaneContractSchemas.UnifiedAIInput.some((rule) => rule.path === 'quality.outlierScore'));
  assert.deepEqual(validateUnifiedAIInput(input), { valid: true, errors: [] });
  assert.equal(validateUnifiedAIInput({ ...input, source: 'spreadsheet' }).valid, false);
  assert.equal(validateUnifiedAIInput({ ...input, quality: { ...input.quality, outlierScore: 1.7 } }).valid, false);
});

test('AI control plane publishes the required module ids and blocked autonomous actions', () => {
  assert.deepEqual(aiControlPlaneFlow, ['Inputs', 'Feature Store', 'Model Registry', 'Expert Models', 'AI Governor', 'Approved Outputs']);
  assert.deepEqual(aiControlPlaneModuleIds, [
    'ai-router',
    'feature-builder',
    'surface-risk-model',
    'race-readiness-model',
    'gate-position-model',
    'equine-advisory-model',
    'security-anomaly-model',
    'weather-impact-model',
    'maintenance-forecast-model',
    'steward-evidence-assistant',
    'responsible-ai-governor',
  ]);
  for (const action of ['race-start', 'safety-critical-control', 'surface-harrowing', 'gate-release', 'maintenance-return-to-service']) {
    assert.ok(aiControlPlaneBlockedActions.includes(action), action);
  }
});

test('AI recommendation outputs require evidence, affected assets, approval roles, and blocked execution when governed', () => {
  const recommendation = {
    recommendationId: 'rec-surface-1',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    type: 'risk-assessment',
    recommendationType: 'risk-assessment',
    domain: 'surface',
    affectedAssets: ['sector:far-turn', 'twin:surface:far-turn'],
    summary: 'Far Turn risk is high; draft maintenance approval before race start.',
    evidence: ['surface:moisture=27', 'surface:drainage=6'],
    evidencePackage: { evidencePackageId: 'evidence-package:rec-surface-1', evidence: [{ evidenceId: 'surface:moisture=27', kind: 'telemetry', source: 'surface' }], lineage: ['agent:surface', 'model:model-surface-risk-v1'], hash: 'sha256:rec-surface-1' },
    confidence: 0.88,
    confidenceScore: { raw: 0.88, calibrated: 0.84, band: 'medium', drivers: ['surface-telemetry', 'risk:high'] },
    modelVersion: 'model-surface-risk-v1',
    policyReferences: ['trackmind-ai-advisory-only-v1', 'approval-policy:steward'],
    riskLevel: 'high',
    generatedAt: '2026-06-14T20:00:00.000Z',
    requiresApproval: true,
    requiredApproverRoles: ['track-superintendent', 'steward'],
    approvalRequirement: { required: true, policy: 'steward', requiredApproverRoles: ['track-superintendent', 'steward'] },
    auditReference: { auditEventIds: ['audit-rec-surface-1'], eventIds: ['event-rec-surface-1'], digitalTwinRefs: ['twin:surface:far-turn'], correlationId: 'corr-rec-surface-1', integrityRef: 'evidence-package:rec-surface-1' },
    advisoryOnly: true,
    executionAllowed: false,
    blockedAutonomousExecution: true,
  };

  assert.deepEqual(validateAIRecommendationOutput(recommendation), { valid: true, errors: [] });
  const missingApproval = validateAIRecommendationOutput({ ...recommendation, requiredApproverRoles: [], blockedAutonomousExecution: false });
  assert.equal(missingApproval.valid, false);
  assert.ok(missingApproval.errors.some((error) => error.includes('requiredApproverRoles')));
  assert.ok(missingApproval.errors.some((error) => error.includes('blockedAutonomousExecution')));
  assert.equal(validateAIRecommendationOutput({ ...recommendation, evidence: [] }).valid, false);
  assert.equal(validateAIRecommendationOutput({ ...recommendation, auditReference: { ...recommendation.auditReference, auditEventIds: [] } }).valid, false);
  assert.equal(validateAIRecommendationOutput({ ...recommendation, executionAllowed: true }).valid, false);
  assert.equal(validateAIRecommendationOutput({ ...recommendation, recommendationType: 'forecast' }).valid, false);
  assert.equal(validateAIRecommendationOutput({ ...recommendation, policyReferences: [] }).valid, false);
});

test('AI output artifact adapters preserve confidence, risk, evidence, and block execution', () => {
  const output = {
    recommendationId: 'rec-forecast-1',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    type: 'forecast',
    recommendationType: 'forecast',
    domain: 'weather',
    affectedAssets: ['track:main', 'race:7'],
    summary: 'Forecast lightning risk for Race 7 and recommend human weather review.',
    evidence: ['weather:lightning=5mi', 'forecast:rain=18mm'],
    evidencePackage: { evidencePackageId: 'evidence-package:rec-forecast-1', evidence: [{ evidenceId: 'weather:lightning=5mi', kind: 'telemetry', source: 'weather' }], lineage: ['agent:weather', 'model:model-weather-impact-v1'], hash: 'sha256:rec-forecast-1' },
    confidence: 0.87,
    confidenceScore: { raw: 0.87, calibrated: 0.83, band: 'medium', drivers: ['weather-telemetry', 'risk:high'] },
    modelVersion: 'model-weather-impact-v1',
    policyReferences: ['trackmind-ai-advisory-only-v1', 'approval-policy:steward'],
    riskLevel: 'high',
    generatedAt: '2026-06-14T20:00:00.000Z',
    requiresApproval: true,
    requiredApproverRoles: ['steward', 'track-superintendent'],
    approvalRequirement: { required: true, policy: 'steward', requiredApproverRoles: ['steward', 'track-superintendent'] },
    auditReference: { auditEventIds: ['audit-rec-forecast-1'], eventIds: ['event-rec-forecast-1'], digitalTwinRefs: ['twin:race-7'], correlationId: 'corr-rec-forecast-1', integrityRef: 'evidence-package:rec-forecast-1' },
    advisoryOnly: true,
    executionAllowed: false,
    blockedAutonomousExecution: true,
  };

  const recommendation = adaptAIRecommendationOutputToRecommendationArtifact(output, { tenantId: 'tenant-1', racetrackId: 'track-1', createdAt: '2026-06-14T20:00:00.000Z' });
  const insight = adaptAIRecommendationOutputToInsightArtifact(output, { tenantId: 'tenant-1', racetrackId: 'track-1', createdAt: '2026-06-14T20:00:00.000Z' });
  const forecast = adaptAIRecommendationOutputToForecastArtifact(output, { tenantId: 'tenant-1', racetrackId: 'track-1', createdAt: '2026-06-14T20:00:00.000Z', horizon: '2h' });

  for (const artifact of [recommendation, insight, forecast]) {
    assert.deepEqual(validateAIOutputArtifact(artifact), { valid: true, errors: [] });
    assert.equal(artifact.confidence, 0.83);
    assert.equal(artifact.riskLevel, 'high');
    assert.deepEqual(artifact.evidence, output.evidence);
    assert.equal(artifact.executionAllowed, false);
    assert.equal(artifact.blockedAutonomousExecution, true);
  }
  assert.equal(recommendation.outputClass, 'Recommendation');
  assert.equal(insight.outputClass, 'Insight');
  assert.equal(forecast.outputClass, 'Forecast');
  assert.equal(forecast.payload.forecastType, 'weather-forecast');
  assert.equal(forecast.payload.horizon, '2h');

  const unsafe = validateAIOutputArtifact({ ...recommendation, artifactClass: 'Action', outputClass: 'Action', executionAllowed: true });
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.errors.some((error) => error.includes('Insight, Recommendation, or Forecast')));
  assert.ok(unsafe.errors.some((error) => error.includes('executionAllowed')));
});

test('canonical training input selection only admits curated source artifacts and preserves feature derivation metadata', () => {
  const featureRecord = buildSurfaceFeatureRecord({
    metadata: { tenantId: 'tenant-1', racetrackId: 'track-1', domain: 'surface', correlationId: 'corr-feature-1', asOf: '2026-06-14T20:00:00.000Z', source: 'feature-builder', assetId: 'surface:far-turn' },
    observedAt: '2026-06-14T19:45:00.000Z',
    surfaceType: 'dirt',
    moisturePct: 27,
    compactionPsi: 276,
    cushionDepthInches: 2.8,
    drainageRateMmPerHour: 6,
    temperatureF: 83,
    rainfallMm: 5,
    forecastRainMm: 14,
    maintenanceCompletedAt: '2026-06-14T16:00:00.000Z',
    evidence: ['telemetry:surface-1', 'event:inspection-1'],
  });
  const featureArtifact = adaptFeatureRecordToFeatureArtifact(featureRecord, {
    sourceArtifactClasses: ['Telemetry', 'Event'],
    sourceRefs: ['telemetry:surface-1', 'event:inspection-1'],
    featureSetId: 'surface-risk-v1',
  });

  assert.equal(featureArtifact.artifactClass, 'Feature');
  assert.equal(featureArtifact.trainingUse, 'not-eligible');
  assert.equal(featureArtifact.derivation.featureRecordId, featureRecord.id);
  assert.equal(featureArtifact.derivation.featureSetId, 'surface-risk-v1');
  assert.deepEqual(featureArtifact.derivation.sourceArtifactClasses, ['Telemetry', 'Event']);
  assert.equal(featureArtifact.derivation.correlationId, 'corr-feature-1');
  assert.equal(featureArtifact.derivation.derivedFromCuratedArtifactsOnly, true);
  assert.equal(featureArtifact.payload.dataQuality.score, featureRecord.dataQuality.score);

  const curatedAsset = {
    artifactId: 'asset:surface:far-turn',
    artifactClass: 'Asset',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    createdAt: '2026-06-14T20:00:00.000Z',
    sourceSystem: 'asset-registry',
    payload: { assetId: 'surface:far-turn' },
    evidence: ['asset-registry:surface:far-turn'],
    lineage: ['asset-registry'],
    curated: true,
    dataClassification: 'restricted',
    digitalTwinRefs: ['twin:surface:far-turn'],
  };
  const uncuratedTelemetry = { ...curatedAsset, artifactId: 'telemetry:raw-1', artifactClass: 'Telemetry', curated: false };
  const selection = selectCanonicalAITrainingInputs([curatedAsset, uncuratedTelemetry, featureArtifact]);

  assert.deepEqual(selection.selected.map((artifact) => artifact.artifactClass), ['Asset']);
  assert.equal(selection.selected[0].trainingUse, 'eligible');
  assert.equal(selection.rejected.length, 2);
  assert.ok(selection.rejected.some((item) => item.artifactId === 'telemetry:raw-1' && /curated/i.test(item.reason)));
  assert.ok(selection.rejected.some((item) => item.artifactId === featureArtifact.artifactId && /not an approved/i.test(item.reason)));
});

test('default AI control policy stays human-in-the-loop and anchors ISO/IEC 42001 plus NIST AI RMF metadata', () => {
  const policy = createDefaultAIControlPolicyConfig();
  assert.equal(policy.defaultMode, 'human_in_the_loop');
  assert.equal(policy.allowAutonomousLowRiskActions, false);
  assert.deepEqual(validateAIControlPolicyConfig(policy), { valid: true, errors: [] });
  assert.ok(policy.blockedActions.includes('race-start'));
  assert.ok(policy.blockedActions.includes('security-restricted-zone-action'));
  assert.ok(policy.approvalRoles.surface.includes('track-superintendent'));
  assert.ok(aiGovernanceFrameworkAnchors.some((anchor) => anchor.frameworkId === 'ISO-42001' && anchor.standard === 'ISO/IEC 42001'));
  assert.ok(aiGovernanceFrameworkAnchors.some((anchor) => anchor.frameworkId === 'NIST-AI-RMF' && anchor.requiredMetadata.includes('govern')));
  assert.ok(nexusComplianceFrameworks.includes('NIST-AI-RMF'));

  const weakened = validateAIControlPolicyConfig({ ...policy, blockedActions: policy.blockedActions.filter((action) => action !== 'race-start') });
  assert.equal(weakened.valid, false);
  assert.ok(weakened.errors.some((error) => error.includes('race-start')));
});
