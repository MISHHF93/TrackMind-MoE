import test from 'node:test';
import assert from 'node:assert/strict';
import { apiContractSchemas, apiEndpointContracts, validateContract } from '@trackmind/shared';
import { createApiFacadeState, handleApiRequest } from '../dist/index.js';

const aiOutputKinds = ['Insight','Recommendation','Forecast'];

function inferAIArtifactKind(rec) {
  const activity = String(rec.activity ?? rec.action ?? rec.recommendation ?? '').toLowerCase();
  if (activity.includes('forecast')) return 'Forecast';
  if (activity.includes('prioritize') || activity.includes('summar') || activity.includes('classif') || activity.includes('simulat')) return 'Insight';
  return 'Recommendation';
}

function assertArtifactEndpointContract(operationId, path, response, method = 'GET') {
  const endpoint = apiEndpointContracts.find((candidate) => candidate.operationId === operationId);
  assert.ok(endpoint, `${operationId} missing`);
  assert.equal(endpoint.method, method);
  assert.equal(endpoint.path, path);
  assert.equal(endpoint.response, response);
  assert.match(endpoint.description, /Artifact/i);
  assert.doesNotMatch(endpoint.description, /direct execution|autonomous execution path/i);
  return endpoint;
}

test('API artifact endpoint contracts are registered as read or draft-only operations', () => {
  const readEndpoints = [
    ['getUniversalArtifactRegistry', '/api/v1/artifacts/registry', 'UniversalArtifactRegistryDto'],
    ['getUniversalArtifactSchemas', '/api/v1/artifacts/schemas', 'UniversalArtifactSchemaCatalogDto'],
    ['getUniversalArtifactTrainingInputs', '/api/v1/artifacts/training-inputs', 'UniversalArtifactTrainingInputsDto'],
    ['getUniversalArtifactStorageMap', '/api/v1/artifacts/storage-map', 'UniversalArtifactStorageMapDto'],
  ].map(([operationId, path, response]) => assertArtifactEndpointContract(operationId, path, response));

  assert.ok(readEndpoints.every((endpoint) => endpoint.emits.length === 0));
  assert.ok(readEndpoints.every((endpoint) => endpoint.audits.length > 0));

  const draft = assertArtifactEndpointContract('createUniversalArtifactDraftRegistration', '/api/v1/artifacts/registry/draft-registrations', 'UniversalArtifactDraftRegistrationResultDto', 'POST');
  assert.ok(draft.emits.includes('artifact.registration.draft.created'));
  assert.ok(draft.emits.includes('approval.requested'));
  assert.ok(draft.audits.includes('artifact.registration.draft.created'));
  assert.match(draft.description, /draft only/i);

  assert.equal(apiEndpointContracts.some((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/') && /execute|publish|mutate|control/i.test(endpoint.path)), false);
});

test('API facade current artifact runtime routes are guarded until implementation exists', async () => {
  const state = createApiFacadeState();
  const routeChecks = [
    ['/api/v1/artifacts/registry', 'UniversalArtifactRegistryDto'],
    ['/api/v1/artifacts/schemas', 'UniversalArtifactSchemaCatalogDto'],
    ['/api/v1/artifacts/training-inputs', 'UniversalArtifactTrainingInputsDto'],
    ['/api/v1/artifacts/storage-map', 'UniversalArtifactStorageMapDto'],
  ];

  for (const [route, contractName] of routeChecks) {
    const response = await handleApiRequest('GET', route, undefined, state);
    if (response.status === 404) {
      assert.equal(response.body.error.code, 'not_found', `${route} should fail closed while unimplemented`);
      continue;
    }
    assert.equal(response.status, 200, route);
    assert.deepEqual(validateContract(contractName, response.body, apiContractSchemas[contractName]), { valid: true, errors: [] });
    assert.equal(response.body.readOnly, true, route);
    assert.equal(response.body.executionEndpointsAvailable, false, route);
  }

  const draft = await handleApiRequest('POST', '/api/v1/artifacts/registry/draft-registrations', { artifactId: 'artifact:recommendation' }, state);
  if (draft.status === 404) {
    assert.equal(draft.body.error.code, 'not_found');
  } else {
    assert.equal(draft.status, 202);
    assert.deepEqual(validateContract('UniversalArtifactDraftRegistrationResultDto', draft.body, apiContractSchemas.UniversalArtifactDraftRegistrationResultDto), { valid: true, errors: [] });
    assert.equal(draft.body.executionAllowed, false);
    assert.equal(draft.body.operationalMutationAllowed, false);
  }

  for (const route of ['/api/v1/artifacts/registry/execute', '/api/v1/artifacts/registry/publish', '/api/v1/artifacts/execute']) {
    const response = await handleApiRequest('POST', route, { artifactId: 'artifact:recommendation' }, state);
    assert.equal(response.status, 404, route);
    assert.equal(response.body.error.code, 'not_found');
  }
});

test('API AI, event, audit, and Digital Twin runtime facades can seed Universal Artifact records', async () => {
  const state = createApiFacadeState();
  const [ai, events, audits, twins] = await Promise.all([
    handleApiRequest('GET', '/api/v1/ai-control-plane/workspace', undefined, state),
    handleApiRequest('GET', '/api/v1/events/catalog', undefined, state),
    handleApiRequest('GET', '/api/v1/audit/events', undefined, state),
    handleApiRequest('GET', '/api/v1/digital-twin/standard', undefined, state),
  ]);

  assert.equal(ai.status, 200);
  assert.equal(events.status, 200);
  assert.equal(audits.status, 200);
  assert.equal(twins.status, 200);
  assert.equal(events.body.standards.auditRequired, true);
  assert.ok(events.body.standards.requiredReferences.includes('digitalTwinRef'));
  assert.ok(audits.body.length > 0);
  assert.ok(twins.body.length > 0);

  const aiArtifacts = [...ai.body.recommendations, ...ai.body.blockedActions].map((rec) => ({
    id: `artifact:${rec.id}`,
    kind: inferAIArtifactKind(rec),
    name: rec.recommendation,
    description: rec.governorDecision.reason,
    schemaRef: `trackmind.artifact.${inferAIArtifactKind(rec).toLowerCase()}.v1`,
    ownerDomain: 'ai-governance',
    lifecycleStatus: rec.status === 'safety-blocked' ? 'draft' : 'published',
    readOnly: true,
    advisoryOnly: true,
    operationalMutationAllowed: false,
    autonomousExecutionAllowed: false,
    approvalRequiredForMutation: true,
    auditIds: rec.references.auditIds,
    eventTypes: rec.references.eventIds,
    digitalTwinRefs: rec.references.digitalTwinRefs,
    evidence: rec.evidence,
    mock: rec.mock,
  }));

  assert.ok(aiArtifacts.length > 0);
  assert.ok(aiArtifacts.every((artifact) => aiOutputKinds.includes(artifact.kind)));
  assert.ok(aiArtifacts.every((artifact) => artifact.advisoryOnly && artifact.autonomousExecutionAllowed === false));
  assert.ok(aiArtifacts.every((artifact) => artifact.auditIds.length > 0 && artifact.eventTypes.length > 0 && artifact.digitalTwinRefs.length > 0));
});

test('API AI recommendations are artifact-compatible outputs, never direct execution outputs', async () => {
  const response = await handleApiRequest('GET', '/api/v1/ai-control-plane/workspace');
  assert.equal(response.status, 200);
  assert.equal(response.body.policy.executionEndpointsAvailable, false);
  assert.equal(response.body.policy.draftOnlyStateChanges, true);

  const recommendations = [...response.body.recommendations, ...response.body.blockedActions];
  assert.ok(recommendations.length > 0);
  for (const rec of recommendations) {
    assert.ok(aiOutputKinds.includes(inferAIArtifactKind(rec)), rec.id);
    assert.equal(rec.governorDecision.allowed, false, rec.id);
    assert.equal(rec.governorDecision.approvalRequired, true, rec.id);
    assert.equal(rec.risk.humanReviewRequired, true, rec.id);
    assert.ok(rec.references.auditIds.length > 0, `${rec.id} audit refs missing`);
    assert.ok(rec.references.eventIds.length > 0, `${rec.id} event refs missing`);
    assert.ok(rec.references.digitalTwinRefs.length > 0, `${rec.id} twin refs missing`);
  }

  const execute = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/execute', { recommendationId: recommendations[0].id });
  assert.equal(execute.status, 404);
  assert.equal(execute.body.error.code, 'not_found');
});
