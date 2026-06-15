import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DigitalTwinRuntime,
  ImmutableAuditLog,
  ResponsibleAIGovernancePlatform,
  UniversalEventBus,
  analyzeSurfaceSection,
  buildTrackConfigurationExecutionPlan,
  classifyRequest,
  expertModuleRegistry,
  generateGateMoveChange,
  handleApiRequest,
  raceDayReadinessChecklist,
  RaceDayReadinessService,
  requiredApprovalsFor,
  requiredExpertModules,
  routeUserRequest,
} from '../dist/index.js';
import {
  apiContractSchemas,
  protectedActions,
  validateContract,
  validateProtectedActionExecution,
} from '../../../packages/shared/dist/index.js';

const at = '2026-06-14T12:00:00.000Z';

function surfaceInput() {
  return {
    trackId: 'main-track',
    generatedAt: at,
    telemetry: [{ id: 'surface-far-turn-1', sectionId: 'far-turn', surfaceType: 'dirt', latitude: 38.049, longitude: -76.944, moisture: 27, compaction: 276, drainageRate: 6, cushionDepth: 2.8, temperature: 83, rainfall: 3, observedAt: at }],
    inspections: [{ id: 'inspection-far-turn', sectionId: 'far-turn', inspectedAt: at, inspector: 'track-superintendent', surfaceType: 'dirt', footingUniformity: 72, divots: 4, standingWater: true, railWear: 3, observations: ['standing water'] }],
    weather: { observedAt: at, rainfallMm: 5, forecastRainMm: 14, temperature: 83, windMph: 12 },
    maintenanceRecords: [{ id: 'maint-far-turn', sectionId: 'far-turn', completedAt: at, action: 'harrow', effectiveness: 6, notes: 'partial improvement' }],
    observations: [{ id: 'obs-jockey', sectionId: 'far-turn', observedAt: at, role: 'jockey', severity: 4, note: 'uneven footing' }],
  };
}

function trackChange() {
  return {
    id: 'chg-race-7',
    kind: 'race-distance',
    requestedBy: 'racing-secretary-1',
    requestedAt: at,
    evidence: ['distance-sheet', 'survey-control'],
    reason: 'Set gate and rail for Race 7.',
    status: 'pending-approval',
    approvals: [],
    raceSetup: {
      raceId: 'race-7',
      distanceMeters: 1609,
      advertisedDistanceMeters: 1609,
      surface: 'dirt',
      maxFieldSize: 12,
      gatePlacement: { gateId: 'gate-1', raceId: 'race-7', distanceMeters: 1609, location: { latitude: 38.04, longitude: -76.958, accuracyMeters: 0.2 }, headingDegrees: 90, runUpMeters: 0 },
      railPosition: { railId: 'rail-b', offsetMeters: 6, effectiveFrom: at, protectedTurns: ['far-turn'] },
      surfaceAllocation: { surface: 'dirt', purpose: 'racing', start: at, end: '2026-06-14T13:00:00.000Z' },
      regulatoryJurisdiction: 'state-racing-commission',
    },
  };
}

function governedPlatform() {
  const platform = new ResponsibleAIGovernancePlatform();
  const model = { id: 'model-control-plane-v1', name: 'Control Plane Advisor', version: '1.0.0', owner: 'ai-governance', purpose: 'Generate advisory racetrack recommendations', criticality: 'safety-critical', dataClassification: 'restricted', intendedUse: ['advisory-decision-support'], prohibitedUse: ['autonomous-protected-control'], lineage: ['dataset:control-plane-v1', 'training-run:2026-06-14'], evidence: ['model-card', 'validation-report'], registeredAt: at };
  platform.registerModel(model);
  platform.publishPromptTemplate({ id: 'prompt-control-plane-v1', name: 'Control Plane Prompt', version: '1.0.0', owner: 'prompt-review-board', template: 'Advisory only with evidence.', evidence: ['prompt-review'], status: 'approved' });
  platform.registerAgent({ id: 'agent-control-plane', name: 'Control Plane Agent', owner: 'ai-governance', modelVersionId: model.id, promptTemplateId: 'prompt-control-plane-v1', status: 'active', allowedActions: [], restrictedActions: [] });
  return platform;
}

function recommendation(action, overrides = {}) {
  return {
    id: `rec-${action.replace(/[^a-z0-9]+/gi, '-')}`,
    agentId: 'agent-control-plane',
    modelVersionId: 'model-control-plane-v1',
    promptTemplateId: 'prompt-control-plane-v1',
    activity: 'create-recommendation',
    action,
    target: 'race-7',
    recommendation: `Create advisory package for ${action}.`,
    confidence: 0.75,
    affectedAssets: ['race:race-7', 'twin:race-7'],
    evidence: ['evidence:readiness', 'evidence:surface', 'evidence:steward'],
    lineage: ['agent:agent-control-plane', 'model:model-control-plane-v1', 'prompt:prompt-control-plane-v1', 'event:control-plane'],
    approvalPolicy: 'none',
    riskLevel: 'medium',
    createdAt: at,
    ...overrides,
  };
}

test('formula checks cover surface risk, race readiness, gate move risk, adjusted confidence, and permissions', () => {
  const surface = analyzeSurfaceSection('far-turn', surfaceInput());
  assert.equal(surface.conditionScore, 23);
  assert.equal(surface.safetyScore, 23);
  assert.equal(surface.riskLevel, 'critical');
  assert.ok(surface.recommendations.some((item) => /closure/i.test(item)));

  const service = new RaceDayReadinessService();
  const checks = raceDayReadinessChecklist(at).map((check) => check.domain === 'gate' ? { ...check, score: 60, status: 'watch', blockers: ['gate move approval pending'], approvalRequired: true } : check.domain === 'weather' ? { ...check, score: 65, status: 'watch', blockers: ['lightning cell active'], approvalRequired: true } : check);
  const readiness = service.evaluate({ raceId: 'race-7', trackId: 'main-track', postTime: '2026-06-14T13:00:00.000Z', evaluatedAt: at, checks });
  assert.equal(readiness.overallScore, 92);
  assert.equal(readiness.status, 'watch');
  assert.equal(readiness.approvals.length, 2);

  const moved = generateGateMoveChange(trackChange(), { gateId: 'gate-1', newDistanceMeters: 1620, newLocation: { latitude: 38.041, longitude: -76.957, accuracyMeters: 0.2 }, headingDegrees: 90, reason: 'Move gate after rail adjustment.', requestedBy: 'starter-1', requestedAt: at, evidence: ['gps-fix', 'crew-attestation'] });
  const plan = buildTrackConfigurationExecutionPlan(moved);
  assert.equal(moved.status, 'pending-approval');
  assert.ok(moved.raceSetup.calculations.regulatoryFlags.includes('distance-variance-review'));
  assert.equal(plan.noLiveActuatorControl, true);
  assert.equal(plan.simulation.score, 75);

  const platform = governedPlatform();
  const adjusted = platform.recordRecommendation(recommendation('surface-forecast', { confidence: 0.75, evidence: ['ev-1', 'ev-2', 'ev-3'], riskLevel: 'high' }));
  assert.equal(adjusted.confidenceScore.raw, 0.75);
  assert.equal(adjusted.confidenceScore.calibrated, 0.78);
  assert.equal(adjusted.confidenceScore.band, 'medium');

  const denied = validateProtectedActionExecution({ action: 'execute-gate-move', recommendationId: 'rec-gate', tenantId: 'tenant-1', target: 'gate-1' });
  assert.equal(denied.allowed, false);
});

test('expert registry and router choose correct experts by domain and use case', async () => {
  const domains = expertModuleRegistry.map((module) => module.domain);
  assert.deepEqual([...requiredExpertModules].sort(), domains.sort());
  assert.equal(new Set(domains).size, domains.length);

  assert.ok(classifyRequest('Forecast surface moisture and draft a maintenance work order for the far turn').includes('TrackSurface'));
  assert.ok(classifyRequest('Scratch horse 4 and clear vet flag after veterinarian review').includes('VetCompliance'));
  assert.ok(classifyRequest('Investigate security camera anomaly in restricted emergency zone').includes('SecuritySOC'));
  assert.ok(classifyRequest('Executive KPI forecast for revenue and attendance').includes('ExecutiveDecisionSupport'));

  const approvals = requiredApprovalsFor('Declare winner, modify official result, trigger payout, execute gate move, and close track');
  for (const action of ['official-results', 'modify-official-results', 'payout', 'starting-gate-move', 'track-closure']) {
    assert.ok(approvals.includes(action), `${action} missing`);
  }

  const routed = await routeUserRequest('Execute gate move and close track after a surface drainage failure', 'rec-route-control-plane');
  assert.ok(routed.domains.includes('ResponsibleAIGovernor'));
  assert.ok(routed.requiredApprovals.includes('starting-gate-move'));
  assert.ok(routed.requiredApprovals.includes('track-closure'));
  assert.equal(routed.governance.automationAllowed, false);
});

test('protected controls cannot execute while advisory actions remain queued', () => {
  const protectedControls = ['start-race', 'stop-race', 'declare-winner', 'modify-result', 'scratch-horse', 'clear-veterinary-flag', 'issue-steward-ruling', 'trigger-payout', 'execute-gate-move', 'close-track', 'reopen-track', 'override-emergency-personnel'];
  for (const action of protectedControls) {
    const platform = governedPlatform();
    const record = platform.recordRecommendation(recommendation(action, { riskLevel: 'critical' }));
    assert.ok(['pending-approval', 'safety-blocked'].includes(record.status), action);
    assert.ok(protectedActions.includes(record.action), `${record.action} must be protected`);
    const result = platform.executeRecommendation(record.id, 'agent-control-plane');
    assert.equal(result.executed, false);
    assert.ok(platform.governanceWorkspace().blockedAutonomousExecutionLogs.some((item) => item.recommendationId === record.id), action);
  }

  for (const activity of ['summarize', 'classify', 'forecast', 'detect-anomaly', 'draft-work-order', 'create-recommendation', 'notify-humans', 'generate-report', 'update-dashboard']) {
    const platform = governedPlatform();
    const record = platform.recordRecommendation(recommendation(`advisory-${activity}`, { id: `rec-${activity}`, activity, riskLevel: 'low' }));
    assert.equal(record.status, 'queued', activity);
    assert.equal(record.governorReview.approvalRequired, false);
    assert.match(record.governorReview.reason ?? '', /does not allow autonomous execution/);
    assert.ok(platform.governanceWorkspace().recommendationQueue.some((item) => item.id === record.id));
  }
});

test('recommendation and governor records retain audit, event, and Digital Twin references', () => {
  const platform = governedPlatform();
  const queued = platform.recordRecommendation(recommendation('surface-forecast', { id: 'rec-traceable', approvalPolicy: 'single-human', riskLevel: 'high' }));
  const blocked = platform.recordRecommendation(recommendation('execute-gate-move', { id: 'rec-blocked-trace', riskLevel: 'critical' }));
  platform.executeRecommendation(blocked.id, 'agent-control-plane');
  const workspace = platform.governanceWorkspace();

  assert.ok(workspace.evidencePackages.some((pkg) => pkg.recommendationId === queued.id && pkg.hash.startsWith('sha256:')));
  assert.ok(workspace.approvalRequirements.some((approval) => approval.recommendationId === queued.id && approval.evidence.includes('human-approval-record')));
  assert.ok(workspace.digitalTwinImpacts.some((impact) => impact.recommendationId === blocked.id && impact.eventType && impact.auditId));
  assert.ok(workspace.events.every((event) => event.id && event.type && event.subjectId && event.lineage.length > 0));
  assert.ok(workspace.auditTrails.some((audit) => audit.subject === blocked.id && audit.action === 'ai.recommendation.blocked'));
});

test('AI control-plane events, audits, tenant context, and advisory twin sync are wired', () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const runtime = new DigitalTwinRuntime({ eventBus, auditLog });
  runtime.registerAsset({
    assetId: 'AI_TWIN_ASSET',
    externalIds: [],
    tenantId: 'tenant-ai',
    name: 'AI Advisory Twin Asset',
    assetType: 'TrackSector',
    domain: 'surface',
    riskLevel: 'medium',
    maintenance: { status: 'ok', lastInspectionAt: at },
    ownership: { ownerAgent: 'TrackSurface', stewardTeam: 'surface-team' },
    location: { sectorId: 'far-turn' },
    state: { status: 'watch' },
    controls: [],
    sensors: [],
    regulations: [{ authority: 'HISA', reference: 'Surface safety', appliesTo: ['surface-review'] }],
    tags: ['surface'],
    approvalPolicyId: 'surface-human-review',
    metadata: {},
    createdAt: at,
    updatedAt: at,
  });

  const platform = new ResponsibleAIGovernancePlatform({ eventBus, auditLog });
  const model = { id: 'model-ai-wired-v1', name: 'Wired AI Model', version: '1.0.0', owner: 'ai-governance', purpose: 'Test control-plane wiring', criticality: 'safety-critical', dataClassification: 'restricted', intendedUse: ['advisory'], prohibitedUse: ['autonomous-control'], lineage: ['dataset:wired'], evidence: ['model-card', 'validation-report'], registeredAt: at };
  platform.registerModel(model);
  platform.publishPromptTemplate({ id: 'prompt-ai-wired-v1', name: 'Wired prompt', version: '1.0.0', owner: 'prompt-review', template: 'Advisory only.', evidence: ['prompt-review'], status: 'approved' });
  platform.registerAgent({ id: 'agent-ai-wired', name: 'Wired Agent', owner: 'ai-governance', modelVersionId: model.id, promptTemplateId: 'prompt-ai-wired-v1', status: 'active', allowedActions: [], restrictedActions: ['race-start'], digitalTwinRefs: ['twin:AI_TWIN_ASSET'] });

  platform.recordInputIngestion({ id: 'input-ai-1', source: 'telemetry', actor: 'ingestion-service', tenantId: 'tenant-ai', racetrackId: 'track-ai', correlationId: 'corr-ai-1', inputRef: 'telemetry:surface', inputHash: 'sha256:input-ai-1', dataClassification: 'restricted', evidence: ['ev-input'], ingestedAt: at, digitalTwinRefs: ['twin:AI_TWIN_ASSET'] });
  platform.recordFeatureBuild({ id: 'features-ai-1', inputId: 'input-ai-1', featureSetId: 'surface-risk', actor: 'feature-builder', tenantId: 'tenant-ai', racetrackId: 'track-ai', correlationId: 'corr-ai-1', causationId: 'input-ai-1', features: ['moistureDeviation'], evidence: ['ev-features'], builtAt: at, digitalTwinRefs: ['twin:AI_TWIN_ASSET'] });
  platform.recordModelSelection({ id: 'selection-ai-1', featureBuildId: 'features-ai-1', modelVersionId: model.id, actor: 'model-router', tenantId: 'tenant-ai', racetrackId: 'track-ai', correlationId: 'corr-ai-1', causationId: 'features-ai-1', candidateModelIds: [model.id], selectionReason: 'Only approved wired model.', evidence: ['ev-selection'], selectedAt: at, digitalTwinRefs: ['twin:AI_TWIN_ASSET'] });
  const rec = platform.recordRecommendation(recommendation('race-start', { id: 'rec-ai-wired-blocked', agentId: 'agent-ai-wired', modelVersionId: model.id, promptTemplateId: 'prompt-ai-wired-v1', tenantId: 'tenant-ai', racetrackId: 'track-ai', correlationId: 'corr-ai-1', causationId: 'selection-ai-1', riskLevel: 'critical', digitalTwinRefs: ['twin:AI_TWIN_ASSET'], affectedAssets: ['AI_TWIN_ASSET'], digitalTwinImpacts: [{ twinId: 'twin:AI_TWIN_ASSET', assetId: 'AI_TWIN_ASSET', kind: 'asset', patch: { command: 'unsafe' }, approvalRequired: true }] }));
  platform.executeRecommendation(rec.id, 'agent-ai-wired');
  platform.recordDashboardUpdate({ id: 'dashboard-ai-1', dashboardId: 'ai-governance', actor: 'dashboard-service', tenantId: 'tenant-ai', racetrackId: 'track-ai', correlationId: 'corr-ai-dashboard', causationId: rec.id, summary: 'AI dashboard updated.', metrics: { blockedActions: 1 }, evidence: ['ev-dashboard'], updatedAt: at, digitalTwinRefs: ['twin:AI_TWIN_ASSET'] });

  const requiredTypes = ['ai.input.ingested', 'ai.features.built', 'ai.model.selected', 'ai.recommendation.created', 'ai.governor.reviewed', 'ai.action.blocked', 'ai.approval.required', 'ai.dashboard.updated'];
  for (const type of requiredTypes) {
    const event = eventBus.events({ type })[0];
    assert.ok(event, `${type} missing`);
    assert.equal(event.context.tenantId, 'tenant-ai');
    assert.ok(event.context.auditRef);
    assert.equal(event.context.racetrackId.startsWith('track-ai'), true);
  }

  const blockedAudit = auditLog.all().find((entry) => entry.action === 'ai.action.blocked' && entry.subjectId === rec.id);
  assert.equal(blockedAudit.tenantId, 'tenant-ai');
  assert.equal(blockedAudit.correlationId, 'corr-ai-1');
  assert.equal(blockedAudit.decision, 'blocked');
  assert.ok(blockedAudit.payload.digitalTwinRefs.includes('twin:AI_TWIN_ASSET'));

  const twin = runtime.getTwin('twin:AI_TWIN_ASSET');
  assert.equal(twin.state.aiRecommendationSummary, rec.recommendation);
  assert.equal(twin.state.riskLevel, 'critical');
  assert.deepEqual(twin.state.evidenceIds, rec.evidence);
  assert.equal(twin.state.approvalRequired, true);
  assert.equal(twin.state.command, undefined);
});

test('AI control-plane API endpoints return safe DTOs and no execute endpoint exists', async () => {
  const workspace = await handleApiRequest('GET', '/api/v1/ai-control-plane/workspace');
  assert.equal(workspace.status, 200);
  assert.deepEqual(validateContract('AIControlPlaneWorkspaceDto', workspace.body, apiContractSchemas.AIControlPlaneWorkspaceDto), { valid: true, errors: [] });
  for (const recommendation of [...workspace.body.recommendations, ...workspace.body.blockedActions]) {
    assert.deepEqual(validateContract('AIControlPlaneRecommendationDto', recommendation, apiContractSchemas.AIControlPlaneRecommendationDto), { valid: true, errors: [] });
  }
  assert.equal(workspace.body.policy.executionEndpointsAvailable, false);
  assert.equal(workspace.body.policy.draftOnlyStateChanges, true);
  assert.ok(workspace.body.blockedActions.every((action) => action.governorDecision.allowed === false && action.governorDecision.approvalRequired));
  assert.ok(workspace.body.auditEventTwinReferences.auditIds.length > 0);
  assert.ok(workspace.body.auditEventTwinReferences.eventIds.length > 0);
  assert.ok(workspace.body.auditEventTwinReferences.digitalTwinRefs.length > 0);

  const models = await handleApiRequest('GET', '/api/v1/ai-control-plane/models');
  assert.equal(models.status, 200);
  assert.ok(models.body.models.length > 0);
  assert.ok(models.body.expertModules.length > 0);

  const draft = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/draft', { recommendationId: 'rec-draft-safe' });
  assert.equal(draft.status, 202);
  assert.equal(draft.body.executionAllowed, false);
  assert.match(draft.body.message, /no autonomous execution endpoint was invoked/i);

  const missing = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/execute', { recommendationId: 'rec-draft-safe' });
  assert.equal(missing.status, 404);
});
