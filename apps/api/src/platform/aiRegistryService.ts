import type {
  AIModelCardDto,
  AIModelCardRegistrationInput,
  AIModelCardRegistryDto,
  AIModelCardRegistryMutationResultDto,
  AIPromptCardDto,
  AIPromptCardRegistrationInput,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

export class AIModelCardRegistryStore {
  private modelCards: AIModelCardDto[] = [
    {
      id: 'surface-advisor-v2',
      name: 'Surface Advisor',
      version: '2.0.0',
      riskLevel: 'medium',
      path: 'ai/model-cards/surface-advisor-v2.md',
      lastEvaluatedAt: '2026-06-01T00:00:00.000Z',
    },
  ];

  private promptCards: AIPromptCardDto[] = [
    {
      id: 'surface-intervention-v4',
      name: 'Surface Intervention',
      version: '4.0.0',
      path: 'ai/prompt-cards/surface-intervention-v4.md',
      lineage: ['surface-intervention-v3', 'surface-advisor-v2'],
    },
  ];

  snapshot(): AIModelCardRegistryDto {
    return {
      generatedAt: now(),
      modelCards: this.modelCards.map((card) => ({ ...card })),
      promptCards: this.promptCards.map((card) => ({ ...card, lineage: [...card.lineage] })),
      mock: false,
    };
  }

  registerModel(input: AIModelCardRegistrationInput): AIModelCardRegistryMutationResultDto {
    if (!input.id?.trim() || !input.name?.trim() || !input.version?.trim() || !input.path?.trim()) {
      throw new Error('Model card registration requires id, name, version, and path');
    }
    const card: AIModelCardDto = {
      id: input.id.trim(),
      name: input.name.trim(),
      version: input.version.trim(),
      riskLevel: input.riskLevel?.trim() || 'medium',
      path: input.path.trim(),
      lastEvaluatedAt: input.lastEvaluatedAt ?? now(),
    };
    const existingIndex = this.modelCards.findIndex((entry) => entry.id === card.id);
    if (existingIndex >= 0) this.modelCards[existingIndex] = card;
    else this.modelCards.push(card);
    return {
      accepted: true,
      registry: this.snapshot(),
      registeredId: card.id,
      eventType: 'ai.model-card.registered',
      message: `Model card ${card.id}@${card.version} registered with governed lineage metadata.`,
      mock: false,
    };
  }

  registerPrompt(input: AIPromptCardRegistrationInput): AIModelCardRegistryMutationResultDto {
    if (!input.id?.trim() || !input.name?.trim() || !input.version?.trim() || !input.path?.trim()) {
      throw new Error('Prompt card registration requires id, name, version, and path');
    }
    if (!Array.isArray(input.lineage) || input.lineage.length === 0) {
      throw new Error('Prompt card registration requires at least one lineage reference');
    }
    const card: AIPromptCardDto = {
      id: input.id.trim(),
      name: input.name.trim(),
      version: input.version.trim(),
      path: input.path.trim(),
      lineage: input.lineage.map((ref) => String(ref).trim()).filter(Boolean),
    };
    const existingIndex = this.promptCards.findIndex((entry) => entry.id === card.id);
    if (existingIndex >= 0) this.promptCards[existingIndex] = card;
    else this.promptCards.push(card);
    return {
      accepted: true,
      registry: this.snapshot(),
      registeredId: card.id,
      eventType: 'ai.prompt-card.registered',
      message: `Prompt card ${card.id}@${card.version} registered with lineage ${card.lineage.join(' -> ')}.`,
      mock: false,
    };
  }
}

export const aiModelCardRegistryStore = new AIModelCardRegistryStore();

export function createAIModelCardRegistry(): AIModelCardRegistryDto {
  return aiModelCardRegistryStore.snapshot();
}
