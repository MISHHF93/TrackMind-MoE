import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNexusUpgradeEventEnvelope,
  createTrackMindNexusUpgradePackage,
  nexusComplianceFrameworks,
  nexusDigitalTwinAssetKinds,
  nexusHisaOperationalOversightCategories,
  nexusUniversalSchemaCoverageIds,
  nexusUniversalEvidenceFrameworks,
  trackMindCloudTierIds,
  trackMindDeployableModeIds,
  trackMindSaasRequiredDomains,
  trackMindSaasRequiredControls,
  trackMindOSComponentIds,
  nexusUpgradeAreaIds,
  nexusWorkspaceIds,
  createTrackMindTenantUxBoundaryMetadata,
  validateTrackMindSaasModel,
  validateTrackMindNexusUpgradePackage,
  validateTrackMindTenantUxBoundaryMetadata,
} from '../dist/index.js';

test('TrackMind Nexus upgrade package covers all required areas and workspaces', () => {
  const pkg = createTrackMindNexusUpgradePackage('2026-06-14T20:37:00.000Z');
  assert.equal(pkg.platform, 'TrackMind Nexus');
  assert.equal(pkg.azureFirst, true);
  assert.equal(pkg.safetyCritical, true);
  assert.equal(pkg.humanGoverned, true);
  assert.deepEqual(validateTrackMindNexusUpgradePackage(pkg), { valid: true, errors: [] });
  assert.equal(pkg.workspaces.length, nexusWorkspaceIds.length);
  assert.ok(nexusWorkspaceIds.includes('api-hub'));
  assert.ok(pkg.workspaces.some((workspace) => workspace.id === 'api-hub' && workspace.route === '/api-hub' && workspace.apiPath === '/api/v1/racing-data'));
  assert.equal(pkg.areas.length, nexusUpgradeAreaIds.length);
  for (const framework of nexusComplianceFrameworks) assert.ok(pkg.complianceFrameworks.includes(framework));
  for (const kind of nexusDigitalTwinAssetKinds) assert.ok(pkg.digitalTwinAssetKinds.includes(kind));
});

test('Nexus event contracts require audit, tenant, racetrack, correlation, and Digital Twin metadata', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  const eventTypes = pkg.eventContracts.map((contract) => contract.eventType);
  for (const eventType of ['ai.input.ingested.v1','ai.features.built.v1','ai.model.selected.v1','ai.recommendation.created.v1','ai.governor.reviewed.v1','ai.action.blocked.v1','ai.approval.required.v1','ai.dashboard.updated.v1']) {
    assert.ok(eventTypes.includes(eventType), `${eventType} missing`);
  }
  assert.ok(eventTypes.includes('approval.protectedAction.approved.v1'));
  assert.ok(eventTypes.includes('audit.event.recorded.v1'));
  for (const contract of pkg.eventContracts) {
    assert.match(contract.eventType, /\.v1$/);
    assert.equal(contract.auditRequired, true);
    assert.equal(contract.replayable, true);
    for (const metadata of ['eventType','version','timestamp','actor','correlationId','causationId','aggregateId','tenantId','racetrackId','payload','auditRef','digitalTwinRef']) {
      assert.ok(contract.requiredMetadata.includes(metadata), `${contract.eventType} missing ${metadata}`);
    }
  }
});

test('Nexus Digital Twin catalog covers shared domain kernel classes', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  for (const kind of ['racetrack','race-meet','race-day','race','horse','jockey','trainer','owner','veterinarian','steward','barn','stall','track-sector','facility','sensor','vehicle','workflow','approval','incident','ai-agent']) {
    assert.ok(pkg.digitalTwinAssetKinds.includes(kind), `${kind} missing`);
  }
});

test('Nexus safety controls keep AI advisory and block autonomous protected execution', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  const actions = pkg.safetyControls.map((control) => control.protectedAction);
  for (const action of ['start-race','stop-race','declare-official-results','modify-official-results','scratch-horse','clear-veterinary-flag','issue-steward-ruling','trigger-payout','override-emergency-personnel','execute-safety-critical-control']) {
    assert.ok(actions.includes(action), `${action} missing`);
  }
  for (const control of pkg.safetyControls) {
    assert.equal(control.aiMayDraft, true);
    assert.equal(control.autonomousExecutionAllowed, false);
    assert.ok(control.evidenceRequired.includes('human-approval-record'));
    assert.ok(control.requiredRoles.length > 0);
  }
});

test('Nexus upgrade package declares Unified AI/ML Control Plane metadata', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  assert.deepEqual(pkg.aiControlPlane.flow, ['inputs','feature-store','model-registry','expert-models','ai-governor','approved-outputs']);
  assert.ok(pkg.aiControlPlane.governanceAnchors.includes('ISO-42001'));
  assert.ok(pkg.aiControlPlane.governanceAnchors.includes('NIST-AI-RMF'));
  assert.match(pkg.aiControlPlane.digitalTwinTarget, /suitable modeling and synchronization target/);
  for (const metric of ['ai_input_throughput','ai_feature_build_count','ai_model_selection_count','ai_recommendation_count','ai_blocked_action_count','ai_approval_required_count','ai_adjusted_confidence_distribution','ai_stale_low_quality_input_count','ai_event_sync_status','ai_audit_sync_status','ai_twin_sync_status']) {
    assert.ok(pkg.aiControlPlane.observabilityMetrics.includes(metric), `${metric} missing`);
  }
  for (const stage of pkg.aiControlPlane.flow) {
    assert.ok(pkg.aiControlPlane.modules.some((module) => module.stage === stage), `${stage} module missing`);
  }
  assert.ok(pkg.aiControlPlane.eventTypes.includes('ai.input.ingested.v1'));
  assert.ok(pkg.aiControlPlane.eventTypes.includes('ai.approval.required.v1'));
  assert.ok(pkg.aiControlPlane.auditActions.includes('ai.recommendation.blocked'));
  assert.ok(pkg.aiControlPlane.tests.includes('Digital Twin impact queue'));
});

test('Nexus package standardizes universal evidence package metadata', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  const evidence = pkg.universalEvidencePackage;
  assert.equal(evidence.tenantId, 'track-1');
  assert.equal(evidence.racetrackId, 'mock-main-track');
  assert.ok(evidence.sourceRefs.some((source) => source.objectType === 'source-object'));
  assert.ok(evidence.sourceRefs.some((source) => source.objectType === 'workflow'));
  assert.ok(evidence.sourceRefs.some((source) => source.objectType === 'control'));
  assert.ok(evidence.auditRefs.length > 0);
  assert.ok(evidence.eventRefs.includes('compliance.evidence.collected.v1'));
  assert.ok(evidence.digitalTwinRefs.includes('race:race-7'));
  assert.ok(evidence.aiRecommendationRefs.includes('rec-race-start-readiness'));
  for (const framework of nexusUniversalEvidenceFrameworks) {
    assert.ok(evidence.frameworkMappings.some((mapping) => mapping.frameworkId === framework && mapping.evidenceUse === 'reusable'), `${framework} missing`);
  }
  assert.ok(evidence.frameworkMappings.some((mapping) => mapping.frameworkId === 'NIST-AI-RMF'));
  for (const category of nexusHisaOperationalOversightCategories) assert.ok(evidence.hisaOperationalOversightCategories.includes(category), `${category} missing`);
  assert.equal(evidence.accreditationReadiness.readinessOnly, true);
  assert.equal(evidence.accreditationReadiness.externalCertificationClaimed, false);
});

test('TrackMind OS Tier 7 SaaS model declares cloud tiers and deployable modes without billing or provisioning', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  const model = pkg.tier7SaasModel;
  assert.equal(model.title, 'TrackMind OS Tier 7 SaaS Model');
  assert.equal(model.billingImplemented, false);
  assert.equal(model.provisioningImplemented, false);
  assert.deepEqual(model.tiers.map((tier) => tier.id), [...trackMindCloudTierIds]);
  assert.deepEqual(model.deployableModes.map((mode) => mode.id), [...trackMindDeployableModeIds]);
  assert.deepEqual(validateTrackMindSaasModel(model), { valid: true, errors: [] });
});

test('TrackMind Cloud tier entitlements cover every required SaaS domain', () => {
  const domains = new Set(createTrackMindNexusUpgradePackage().tier7SaasModel.tiers.flatMap((tier) => tier.featureEntitlements.map((feature) => feature.domain)));
  for (const domain of trackMindSaasRequiredDomains) assert.ok(domains.has(domain), `missing entitlement domain ${domain}`);
});

test('TrackMind Cloud tiers carry required controls, tenant isolation posture, and upgrade paths', () => {
  const tiers = createTrackMindNexusUpgradePackage().tier7SaasModel.tiers;
  for (const tier of tiers) {
    assert.ok(tier.requiredControls.length > 0, `${tier.id} controls missing`);
    assert.ok(tier.deploymentAssumptions.length > 0, `${tier.id} deployment assumptions missing`);
    assert.ok(tier.tenantIsolationPosture.model.length > 0, `${tier.id} isolation model missing`);
    assert.ok(tier.tenantIsolationPosture.dataBoundary.includes('tenant'), `${tier.id} tenant data boundary missing`);
  }
  for (const control of trackMindSaasRequiredControls) {
    assert.ok(tiers.some((tier) => tier.requiredControls.includes(control)), `required control uncovered ${control}`);
  }
  assert.equal(tiers.find((tier) => tier.id === 'starter')?.upgradePath.next, 'professional');
  assert.equal(tiers.find((tier) => tier.id === 'professional')?.upgradePath.next, 'enterprise');
  assert.equal(tiers.find((tier) => tier.id === 'enterprise')?.upgradePath.next, 'national');
  assert.equal(tiers.find((tier) => tier.id === 'national')?.upgradePath.next, undefined);
});

test('tenant UX boundary metadata exposes scores, candidate wording, and no-leakage guardrails', () => {
  const tenants = createTrackMindTenantUxBoundaryMetadata();
  assert.deepEqual(validateTrackMindTenantUxBoundaryMetadata(tenants), { valid: true, errors: [] });
  assert.deepEqual(tenants.map((tenant) => tenant.racetrackId), ['saratoga','belmont','mock-fallback']);

  for (const tenant of tenants) {
    assert.match(tenant.tenantIsolationLabel, /tenant/i);
    assert.match(tenant.roleBoundaryLabel, /role/i);
    assert.match(tenant.certifiedTrackCandidateStatement, /candidate|readiness/i);
    assert.match(tenant.certifiedTrackCandidateStatement, /no external certification|no external/i);
    assert.equal(tenant.externalCertificationClaimed, false);
    for (const field of ['safetyScore','complianceScore','operationalScore','accreditationScore']) {
      assert.equal(typeof tenant.scorecard[field], 'number');
      assert.ok(tenant.scorecard[field] >= 0 && tenant.scorecard[field] <= 100);
    }
    assert.equal(tenant.federation.allowsCrossTenantAggregation, false);
    assert.equal(tenant.federation.aggregationScope, 'tenant-only');
    assert.match(tenant.federation.aggregationLabel, /no cross-tenant|tenant-only/i);
    assert.ok(tenant.leakageGuardrails.some((guardrail) => /cross-tenant|mix/i.test(guardrail)));
  }
});

test('TrackMind OS metadata covers OS components, Universal Schema dimensions, and readiness controls honestly', () => {
  const pkg = createTrackMindNexusUpgradePackage();
  assert.deepEqual(pkg.trackMindOS.map((component) => component.id), [...trackMindOSComponentIds]);
  assert.deepEqual(pkg.universalSchemaCoverage.map((coverage) => coverage.id), [...nexusUniversalSchemaCoverageIds]);
  const honestStatuses = new Set(['implemented','partial','readiness-metadata','placeholder']);
  for (const component of pkg.trackMindOS) {
    assert.ok(honestStatuses.has(component.status), `${component.id} status must be honest`);
    assert.ok(component.routeIds.length > 0, `${component.id} route IDs missing`);
    assert.ok(component.routePaths.every((route) => route.startsWith('/')), `${component.id} route paths must be absolute`);
    assert.ok(component.universalSchemaCoverage.length > 0, `${component.id} schema coverage missing`);
    assert.ok(component.observabilityControls.length > 0, `${component.id} observability controls missing`);
    assert.ok(component.safetyControls.length > 0, `${component.id} safety controls missing`);
    assert.notEqual(component.certifiedTrackReadiness, 'implemented');
    assert.notEqual(component.federation, 'implemented');
    assert.match(component.caveat, /does not claim production certification|metadata only/i);
  }
  for (const coverage of pkg.universalSchemaCoverage) {
    assert.ok(honestStatuses.has(coverage.status), `${coverage.id} status must be honest`);
    assert.ok(coverage.models.length > 0, `${coverage.id} models missing`);
    assert.ok(coverage.routeIds.length > 0, `${coverage.id} routes missing`);
    assert.ok(coverage.readinessControls.length > 0, `${coverage.id} readiness controls missing`);
  }
  const osCoverage = new Set(pkg.trackMindOS.flatMap((component) => component.universalSchemaCoverage));
  for (const coverageId of nexusUniversalSchemaCoverageIds) assert.ok(osCoverage.has(coverageId), `${coverageId} uncovered by TrackMind OS metadata`);
});

test('platform readiness metadata covers SaaS tiers, certified track, unified model, intelligence core, and federation without overclaiming', () => {
  const readiness = createTrackMindNexusUpgradePackage().platformReadiness;
  assert.deepEqual(readiness.saasTiers.map((tier) => tier.id), ['starter','professional','enterprise','national-federation']);
  assert.equal(readiness.certifiedTrack.status, 'readiness-metadata');
  assert.equal(readiness.federation.status, 'placeholder');
  assert.notEqual(readiness.certifiedTrack.status, 'implemented');
  assert.notEqual(readiness.federation.status, 'implemented');
  assert.ok(readiness.unifiedDataModel.controls.some((control) => /Universal Schema/.test(control)));
  assert.ok(readiness.intelligenceCore.controls.some((control) => /AI control plane/.test(control)));
  assert.ok(readiness.observabilityControls.some((control) => control.controls.includes('frontend error reporting')));
  assert.ok(readiness.safetyControls.some((control) => control.controls.includes('autonomous execution blocked')));
  assert.match(readiness.certifiedTrack.caveat, /does not claim/);
  assert.match(readiness.federation.caveat, /no tenant provisioning/i);
});

test('Nexus upgrade event envelope validates against shared event contract', () => {
  const envelope = buildNexusUpgradeEventEnvelope({
    eventId: 'evt-upgrade-1',
    eventType: 'asset.registry.changed.v1',
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    actorId: 'asset-service',
    subjectId: 'asset-1',
    subjectType: 'asset',
    correlationId: 'corr-1',
    auditRef: 'audit-1',
    digitalTwinRef: 'twin:track-1:asset-1',
  });
  assert.equal(envelope.tenantId, 'tenant-1');
  assert.equal(envelope.payload.racetrackId, 'track-1');
  assert.equal(envelope.payload.auditRef, 'audit-1');
  assert.equal(envelope.payload.digitalTwinRef, 'twin:track-1:asset-1');
});
