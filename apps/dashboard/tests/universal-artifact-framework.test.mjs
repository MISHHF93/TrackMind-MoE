import test from 'node:test';
import assert from 'node:assert/strict';
import { apiContractSchemas, apiEndpointContracts, validateContract } from '@trackmind/shared';
import { createLiveClient, createMockClient } from '../dist/api/client.js';

const now = '2026-06-14T22:00:00.000Z';
const aiOutputKinds = ['Insight','Recommendation','Forecast'];

function artifact(kind, overrides = {}) {
  return {
    id: `dashboard-artifact:${kind.toLowerCase()}`,
    kind,
    name: `${kind} dashboard artifact`,
    description: 'Dashboard Universal Artifact compatibility seed.',
    schemaRef: `trackmind.artifact.${kind.toLowerCase()}.v1`,
    ownerDomain: 'dashboard',
    lifecycleStatus: 'published',
    readOnly: true,
    advisoryOnly: aiOutputKinds.includes(kind),
    operationalMutationAllowed: false,
    autonomousExecutionAllowed: false,
    approvalRequiredForMutation: true,
    auditIds: [`audit:${kind.toLowerCase()}`],
    eventTypes: [`artifact.${kind.toLowerCase()}.viewed.v1`],
    digitalTwinRefs: ['twin:track:main-track'],
    evidence: [`evidence:${kind.toLowerCase()}`],
    mock: true,
    ...overrides,
  };
}

test('dashboard mock client can project current workspaces into Universal Artifact records', async () => {
  const client = createMockClient();
  const [ai, tus, compliance, surface] = await Promise.all([
    client.getAIControlPlaneWorkspace(),
    client.getTUSStandardization(),
    client.getComplianceLibrary(),
    client.getSurfaceIntelligence(),
  ]);
  const recommendation = ai.recommendations[0];
  const blocked = ai.blockedActions[0];
  const twin = tus.twins[0];
  const compliancePackage = compliance.evidencePackages[0];
  const surfaceForecast = surface.forecasts?.[0];

  const registry = {
    generatedAt: now,
    schemaVersion: 'trackmind.artifacts.registry.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    artifactKinds: ['Asset','Event','DigitalTwin','Audit','Compliance','Recommendation','Insight','Forecast'],
    artifacts: [
      artifact('Asset', { id: `artifact:asset:${tus.assets[0].assetId}`, ownerDomain: 'assets', auditIds: tus.assets[0].audit.map((item) => item.id), eventTypes: tus.assets[0].telemetry.map((item) => item.stream), digitalTwinRefs: [tus.assets[0].twin.twinId], evidence: tus.assets[0].risk.evidence }),
      artifact('DigitalTwin', { id: `artifact:twin:${twin.twinId}`, ownerDomain: 'digital-twin', auditIds: twin.audit.map((item) => item.id), eventTypes: twin.telemetry.map((item) => item.stream), digitalTwinRefs: [twin.twinId], evidence: twin.risk.evidence }),
      artifact('Audit', { id: `artifact:audit:${ai.auditEventTwinReferences.auditIds[0]}`, ownerDomain: 'audit', auditIds: [ai.auditEventTwinReferences.auditIds[0]], eventTypes: ai.auditEventTwinReferences.eventIds.slice(0, 1), digitalTwinRefs: ai.auditEventTwinReferences.digitalTwinRefs.slice(0, 1), evidence: ai.featureStoreSummary.evidenceRefs.slice(0, 1) }),
      artifact('Compliance', { id: `artifact:compliance:${compliancePackage.id}`, ownerDomain: 'compliance', auditIds: compliancePackage.auditRecordIds, eventTypes: compliancePackage.eventIds, digitalTwinRefs: compliancePackage.digitalTwinRefs, evidence: compliancePackage.evidenceIds }),
      artifact('Recommendation', { id: `artifact:recommendation:${recommendation.id}`, ownerDomain: 'ai-governance', auditIds: recommendation.references.auditIds, eventTypes: recommendation.references.eventIds, digitalTwinRefs: recommendation.references.digitalTwinRefs, evidence: recommendation.evidence }),
      artifact('Insight', { id: `artifact:insight:${blocked.id}`, ownerDomain: 'ai-governance', lifecycleStatus: 'draft', auditIds: blocked.references.auditIds, eventTypes: blocked.references.eventIds, digitalTwinRefs: blocked.references.digitalTwinRefs, evidence: blocked.evidence }),
      artifact('Forecast', { id: `artifact:forecast:${surfaceForecast?.id ?? 'surface-risk'}`, ownerDomain: 'surface', auditIds: [surface.timeline[0].auditId], eventTypes: [surface.timeline[0].eventId], digitalTwinRefs: surface.digitalTwinSync.map((sync) => sync.twinId), evidence: surfaceForecast?.drivers ?? surface.riskBadges[0].drivers }),
    ],
    governance: { draftRegistrationOnly: true, approvalRequired: true, audited: true, autonomousExecutionAllowed: false, operationalMutationAllowed: false },
    mock: true,
  };

  assert.deepEqual(validateContract('UniversalArtifactRegistryDto', registry, apiContractSchemas.UniversalArtifactRegistryDto), { valid: true, errors: [] });
  assert.ok(registry.artifacts.every((item) => item.readOnly && item.operationalMutationAllowed === false && item.autonomousExecutionAllowed === false));
  assert.ok(registry.artifacts.every((item) => item.auditIds.length > 0 && item.eventTypes.length > 0 && item.digitalTwinRefs.length > 0));
  assert.ok(registry.artifacts.filter((item) => aiOutputKinds.includes(item.kind)).every((item) => item.advisoryOnly));
});

test('dashboard mock client keeps AI artifact outputs advisory and approval-gated', async () => {
  const client = createMockClient();
  const workspace = await client.getAIControlPlaneWorkspace();
  const outputs = [...workspace.recommendations, ...workspace.blockedActions].map((rec) => ({
    kind: rec.activity === 'forecast' ? 'Forecast' : rec.status === 'safety-blocked' ? 'Insight' : 'Recommendation',
    rec,
  }));

  assert.equal(client.executeAIControlPlaneRecommendation, undefined);
  assert.equal(workspace.policy.executionEndpointsAvailable, false);
  assert.ok(outputs.every((output) => aiOutputKinds.includes(output.kind)));
  assert.ok(outputs.every(({ rec }) => rec.governorDecision.allowed === false));
  assert.ok(outputs.every(({ rec }) => rec.governorDecision.approvalRequired === true));
  assert.ok(outputs.every(({ rec }) => rec.references.auditIds.length > 0 && rec.references.eventIds.length > 0 && rec.references.digitalTwinRefs.length > 0));
});

test('dashboard live client artifact compatibility is contract-first until adapter methods exist', async () => {
  const live = createLiveClient('https://api.example.test/api/v1');
  const expected = [
    ['getUniversalArtifactRegistry', 'GET', 'https://api.example.test/api/v1/artifacts/registry'],
    ['getUniversalArtifactSchemas', 'GET', 'https://api.example.test/api/v1/artifacts/schemas'],
    ['getUniversalArtifactTrainingInputs', 'GET', 'https://api.example.test/api/v1/artifacts/training-inputs'],
    ['getUniversalArtifactStorageMap', 'GET', 'https://api.example.test/api/v1/artifacts/storage-map'],
    ['createUniversalArtifactDraftRegistration', 'POST', 'https://api.example.test/api/v1/artifacts/registry/draft-registrations'],
  ];
  const missing = expected.filter(([method]) => typeof live[method] !== 'function');

  assert.equal(live.executeUniversalArtifact, undefined);
  assert.equal(live.publishUniversalArtifact, undefined);
  assert.equal(live.mutateUniversalArtifact, undefined);

  if (missing.length > 0) {
    assert.equal(missing.length, expected.length, 'Universal Artifact dashboard client should be implemented all at once to avoid partial adapter drift');
    assert.ok(apiEndpointContracts.some((endpoint) => endpoint.operationId === 'getUniversalArtifactRegistry'));
    return;
  }

  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET' });
    const body = url.endsWith('/draft-registrations')
      ? { accepted: true, status: 'draft', draftId: 'draft-dashboard', artifactId: 'artifact:recommendation', approvalRequired: true, audited: true, eventType: 'artifact.registration.draft.created', executionAllowed: false, operationalMutationAllowed: false, message: 'Draft registration only.', mock: false }
      : { generatedAt: now, schemaVersion: 'trackmind.artifacts.registry.v1', readOnly: true, executionEndpointsAvailable: false, artifactKinds: [], artifacts: [], governance: { draftRegistrationOnly: true, approvalRequired: true, audited: true, autonomousExecutionAllowed: false, operationalMutationAllowed: false }, mock: false };
    return { ok: true, json: async () => body };
  };
  try {
    await live.getUniversalArtifactRegistry();
    await live.getUniversalArtifactSchemas();
    await live.getUniversalArtifactTrainingInputs();
    await live.getUniversalArtifactStorageMap();
    await live.createUniversalArtifactDraftRegistration({ artifactId: 'artifact:recommendation' });
  } finally {
    globalThis.fetch = original;
  }

  assert.deepEqual(calls.map((call) => [call.method, call.url]), expected.map(([, method, url]) => [method, url]));
  assert.equal(calls.some((call) => /execute|publish|mutate/i.test(call.url)), false);
});

test('dashboard uses shared Universal Artifact endpoint catalog without introducing execution routes', () => {
  const endpoints = apiEndpointContracts.filter((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/'));
  assert.equal(endpoints.length, 5);
  assert.ok(endpoints.some((endpoint) => endpoint.operationId === 'createUniversalArtifactDraftRegistration' && endpoint.method === 'POST'));
  assert.ok(endpoints.filter((endpoint) => endpoint.method === 'GET').every((endpoint) => endpoint.emits.length === 0));
  assert.ok(endpoints.every((endpoint) => endpoint.audits.length > 0));
  assert.equal(endpoints.some((endpoint) => /execute|publish|mutate/i.test(endpoint.operationId + endpoint.path)), false);
});
