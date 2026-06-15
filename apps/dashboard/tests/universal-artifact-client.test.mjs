import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveClient, createMockClient, NexusApiError } from '../dist/api/client.js';

const registrationDraft = {
  artifact: {
    artifactId: 'uaf-test-artifact',
    schemaVersion: 'trackmind.universal-artifact.v1',
    kind: 'model-card',
    name: 'Surface Advisor model card',
    description: 'Model card registration draft from dashboard tests.',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    uri: 's3://trackmind-artifacts/model-card.json',
    contentType: 'application/json',
    checksum: 'sha256:test-artifact',
    tags: ['test'],
    metadata: { owner: 'ai-governance' },
    lineage: { producedBy: 'dashboard-test', upstreamArtifactIds: [], downstreamArtifactIds: [], eventIds: [], digitalTwinRefs: [], correlationId: 'corr-uaf-test' },
  },
  reason: 'register governed model-card artifact',
  requestedBy: 'ai-governor-1',
  evidence: ['model-card-review'],
  approvalPolicy: 'universal-artifact-registration',
  safetyCritical: true,
};

test('Universal Artifact Framework mock DTOs are clearly labeled and read-only', async () => {
  const client = createMockClient();
  const framework = await client.getUniversalArtifactFramework();

  assert.equal(framework.schemaVersion, 'trackmind.universal-artifact-framework.v1');
  assert.equal(framework.mock, true);
  assert.equal(framework.governance.registrationMode, 'draft-approval-only');
  assert.equal(framework.governance.directMutationAllowed, false);
  assert.match(framework.registry.source.label, /mock Universal Artifact Framework/i);
  assert.equal(framework.registry.source.safeForStateMutation, false);
  assert.ok(framework.registry.artifacts.length > 0);
  assert.ok(framework.registry.artifacts.every((artifact) => artifact.mock === true));
  assert.ok(framework.registry.artifacts.every((artifact) => artifact.source.mock === true));
  assert.ok(framework.registry.artifacts.every((artifact) => artifact.governance.directMutationAllowed === false));
  assert.ok(framework.registry.artifacts.every((artifact) => artifact.governance.autonomousExecutionAllowed === false));
  assert.ok(framework.training.runs.every((run) => run.executionAllowed === false));
  assert.ok(framework.storage.objects.every((object) => object.directMutationAllowed === false && object.immutable === true));

  assert.deepEqual(await client.getUniversalArtifactSchema(), framework.schema);
  assert.deepEqual(await client.getUniversalArtifactRegistry(), framework.registry);
  assert.deepEqual(await client.getUniversalArtifactTraining(), framework.training);
  assert.deepEqual(await client.getUniversalArtifactStorage(), framework.storage);
});

test('Universal Artifact Framework live client uses configured backend base path', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body });
    return { ok: true, json: async () => ({ accepted: true, draftId: 'draft-live', approvalRequired: true, approvalId: 'approval-live', eventType: 'universal-artifact.registration.draft.created', audited: true, executionAllowed: false, lifecycleState: 'pending-approval', message: 'queued', mock: false }) };
  };

  try {
    const live = createLiveClient('https://api.example.test/api/v1');
    assert.equal(live.getUniversalArtifactFramework, undefined);
    assert.equal(live.getUniversalArtifactSchema, undefined);
    assert.equal(live.getUniversalArtifactTraining, undefined);
    assert.equal(live.getUniversalArtifactStorage, undefined);
    await live.getUniversalArtifactSchemas();
    await live.getUniversalArtifactRegistry();
    await live.getUniversalArtifactTrainingInputs();
    await live.getUniversalArtifactStorageMap();
    await live.requestUniversalArtifactRegistrationDraft(registrationDraft);

    assert.deepEqual(calls.map((call) => [call.method, call.url]), [
      ['GET', 'https://api.example.test/api/v1/artifacts/schemas'],
      ['GET', 'https://api.example.test/api/v1/artifacts/registry'],
      ['GET', 'https://api.example.test/api/v1/artifacts/training-inputs'],
      ['GET', 'https://api.example.test/api/v1/artifacts/storage-map'],
      ['POST', 'https://api.example.test/api/v1/artifacts/registry/draft-registrations'],
    ]);
    assert.equal(JSON.parse(calls.at(-1).body).safetyCritical, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('Universal Artifact Framework errors retain typed API metadata', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, statusText: 'Unavailable', json: async () => ({ error: { code: 'uaf_unavailable', message: 'artifact storage unavailable', details: ['storage'] } }) });

  try {
    await assert.rejects(() => createLiveClient('https://api.example.test/api/v1').getUniversalArtifactStorageMap(), (error) => {
      assert.ok(error instanceof NexusApiError);
      assert.equal(error.status, 503);
      assert.equal(error.path, '/artifacts/storage-map');
      assert.equal(error.code, 'uaf_unavailable');
      assert.deepEqual(error.details, ['storage']);
      assert.match(error.message, /artifact storage unavailable/);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('Universal Artifact Framework registration remains draft and approval aware', async () => {
  const client = createMockClient();
  assert.equal(client.registerUniversalArtifact, undefined);
  assert.equal(client.executeUniversalArtifactRegistration, undefined);

  const before = await client.getUniversalArtifactRegistry();
  const result = await client.requestUniversalArtifactRegistrationDraft(registrationDraft);
  const after = await client.getUniversalArtifactRegistry();

  assert.equal(result.accepted, true);
  assert.equal(result.approvalRequired, true);
  assert.equal(result.executionAllowed, false);
  assert.equal(result.lifecycleState, 'pending-approval');
  assert.deepEqual(after, before);
});
