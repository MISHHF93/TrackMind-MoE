import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContract, apiContractSchemas, apiEndpointContracts } from '../../../packages/shared/dist/index.js';

test('prompt lineage draft/publish service mutations stay draft-only until publish', async () => {
  const { AIModelCardRegistryStore } = await import('../dist/platform/aiRegistryService.js');
  const store = new AIModelCardRegistryStore();
  const draft = store.draftPromptLineage({
    id: 'surface-intervention-v6',
    name: 'Surface Intervention',
    version: '6.0.0',
    path: 'ai/prompt-cards/surface-intervention-v6.md',
    lineage: ['surface-intervention-v4', 'surface-advisor-v2'],
    reason: 'prompt-lineage mutation verification',
  });

  assert.equal(draft.eventType, 'ai.prompt-lineage.draft.created');
  assert.equal(draft.draftOnly, true);
  assert.ok(draft.draftId);
  assert.equal(store.listPromptCards().promptCards.some((card) => card.id === 'surface-intervention-v6'), false);

  const published = store.publishPromptLineage(draft.draftId);
  assert.equal(published.eventType, 'ai.prompt-lineage.published');
  assert.equal(published.registeredId, 'surface-intervention-v6');
  assert.ok(published.registry.promptCards.some((card) => card.id === 'surface-intervention-v6'));
  assert.throws(() => store.publishPromptLineage(draft.draftId), /already published/i);
});

test('prompt lineage mutation contracts and endpoint catalog are registered', () => {
  const draftDto = {
    accepted: true,
    draftId: 'prompt-lineage-draft-test',
    promptId: 'surface-intervention-v6',
    eventType: 'ai.prompt-lineage.draft.created',
    draftOnly: true,
    message: 'draft recorded',
    auditEventIds: ['audit-test'],
    mock: false,
  };
  assert.deepEqual(
    validateContract('AIPromptLineageDraftResultDto', draftDto, apiContractSchemas.AIPromptLineageDraftResultDto),
    { valid: true, errors: [] },
  );

  const publishDto = {
    accepted: true,
    draftId: 'prompt-lineage-draft-test',
    registeredId: 'surface-intervention-v6',
    registry: { generatedAt: '2026-06-21T00:00:00.000Z', modelCards: [], promptCards: [], mock: false },
    eventType: 'ai.prompt-lineage.published',
    message: 'published',
    auditId: 'audit-publish',
    audited: true,
    mock: false,
  };
  assert.deepEqual(
    validateContract('AIPromptLineagePublishResultDto', publishDto, apiContractSchemas.AIPromptLineagePublishResultDto),
    { valid: true, errors: [] },
  );

  const draftEndpoint = apiEndpointContracts.find((entry) => entry.operationId === 'draftAIPromptLineage');
  const publishEndpoint = apiEndpointContracts.find((entry) => entry.operationId === 'publishAIPromptLineage');
  assert.equal(draftEndpoint?.path, '/api/v1/ai-governance/prompt-lineage/drafts');
  assert.equal(publishEndpoint?.path, '/api/v1/ai-governance/prompt-lineage/{draftId}/publish');
  assert.match(draftEndpoint?.description ?? '', /draft only/i);
});
