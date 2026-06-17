import type { AIModelCardRegistryDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createAIModelCardRegistry(): AIModelCardRegistryDto {
  return {
    generatedAt: now(),
    modelCards: [
      { id: 'surface-advisor-v2', name: 'Surface Advisor', version: '2.0.0', riskLevel: 'medium', path: 'ai/model-cards/surface-advisor-v2.md', lastEvaluatedAt: '2026-06-01T00:00:00.000Z' },
    ],
    promptCards: [
      { id: 'surface-intervention-v4', name: 'Surface Intervention', version: '4.0.0', path: 'ai/prompt-cards/surface-intervention-v4.md', lineage: ['surface-intervention-v3', 'surface-advisor-v2'] },
    ],
    mock: false,
  };
}
