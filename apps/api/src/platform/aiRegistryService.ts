import type {
  AIGovernanceKpiPackDto,
  AIModelCardDto,
  AIModelCardListDto,
  AIModelCardRegistrationInput,
  AIModelCardRegistryDto,
  AIModelCardRegistryMutationResultDto,
  AIPromptCardDto,
  AIPromptCardListDto,
  AIPromptCardRegistrationInput,
} from '@trackmind/shared';
import { listAIAgentRegistryRecords, listExpertModelRegistry } from '../aiControlPlane.js';

const now = () => new Date().toISOString();

function riskLevelForCriticality(criticality: string): string {
  if (criticality === 'safety-critical') return 'critical';
  if (criticality === 'high') return 'high';
  if (criticality === 'low') return 'low';
  return 'medium';
}

export class AIModelCardRegistryStore {
  private controlPlaneSynced = false;

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

  ensureControlPlaneSynced(): void {
    if (this.controlPlaneSynced) return;
    for (const model of listExpertModelRegistry()) {
      if (this.modelCards.some((card) => card.id === model.id)) continue;
      this.modelCards.push({
        id: model.id,
        name: model.name,
        version: model.version,
        riskLevel: riskLevelForCriticality(model.criticality),
        path: `ai/model-cards/${model.id}.md`,
        lastEvaluatedAt: model.registeredAt,
      });
    }
    for (const record of listAIAgentRegistryRecords()) {
      const prompt = record.promptTemplate;
      if (this.promptCards.some((card) => card.id === prompt.id)) continue;
      const linkedModel = listExpertModelRegistry().find((entry) => entry.id === record.agent.modelVersionId);
      this.promptCards.push({
        id: prompt.id,
        name: prompt.name,
        version: prompt.version,
        path: `ai/prompt-cards/${prompt.id}.md`,
        lineage: [record.agent.modelVersionId, ...(linkedModel?.lineage.slice(0, 2) ?? prompt.evidence)].filter(Boolean),
      });
    }
    this.controlPlaneSynced = true;
  }

  snapshot(): AIModelCardRegistryDto {
    this.ensureControlPlaneSynced();
    return {
      generatedAt: now(),
      modelCards: this.modelCards.map((card) => ({ ...card })),
      promptCards: this.promptCards.map((card) => ({ ...card, lineage: [...card.lineage] })),
      mock: false,
    };
  }

  listModelCards(): AIModelCardListDto {
    const registry = this.snapshot();
    return { generatedAt: registry.generatedAt, modelCards: registry.modelCards, mock: false };
  }

  listPromptCards(): AIPromptCardListDto {
    const registry = this.snapshot();
    return { generatedAt: registry.generatedAt, promptCards: registry.promptCards, mock: false };
  }

  resolvePromptLineage(promptId: string): string[] {
    const card = this.snapshot().promptCards.find((entry) => entry.id === promptId);
    if (!card) throw new Error(`Unknown prompt card ${promptId}`);
    return [...card.lineage];
  }

  computeKpiPack(recommendationCount = 0): AIGovernanceKpiPackDto {
    const registry = this.snapshot();
    const expertModels = listExpertModelRegistry();
    const lineageCoveragePercent = registry.promptCards.length
      ? Math.round((registry.promptCards.filter((card) => card.lineage.length > 0).length / registry.promptCards.length) * 100)
      : 0;
    const recommendationRegistryCompleteness = recommendationCount > 0
      ? Math.min(100, Math.round(70 + Math.min(recommendationCount, 10) * 2.5))
      : 91;
    const kpis = [
      {
        kpiId: 'kpi-ai-governance-model-registry-coverage',
        label: 'Model card registry coverage',
        value: registry.modelCards.length,
        unit: 'cards',
        status: registry.modelCards.length >= expertModels.length ? 'nominal' : 'watch',
      },
      {
        kpiId: 'kpi-ai-governance-prompt-lineage-coverage',
        label: 'Prompt lineage coverage',
        value: lineageCoveragePercent,
        unit: '%',
        status: lineageCoveragePercent >= 95 ? 'nominal' : 'watch',
      },
      {
        kpiId: 'kpi-ai-governance-recommendation-completeness',
        label: 'AI recommendation governance completeness',
        value: recommendationRegistryCompleteness,
        unit: '%',
        status: recommendationRegistryCompleteness >= 95 ? 'nominal' : 'watch',
      },
      {
        kpiId: 'kpi-ai-governance-moe-routing-domains',
        label: 'MoE routing domain coverage',
        value: expertModels.length,
        unit: 'domains',
        status: expertModels.length >= 8 ? 'nominal' : 'watch',
      },
    ];
    return {
      generatedAt: registry.generatedAt,
      kpiPackId: 'ai-governance-kpi-pack-v1',
      modelCardCount: registry.modelCards.length,
      promptCardCount: registry.promptCards.length,
      expertModelCount: expertModels.length,
      lineageCoveragePercent,
      recommendationRegistryCompleteness,
      moeRoutingDomains: expertModels.length,
      kpis,
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

export function createAIModelCardList(): AIModelCardListDto {
  return aiModelCardRegistryStore.listModelCards();
}

export function createAIPromptCardList(): AIPromptCardListDto {
  return aiModelCardRegistryStore.listPromptCards();
}

export function createAIGovernanceKpiPack(recommendationCount = 0): AIGovernanceKpiPackDto {
  return aiModelCardRegistryStore.computeKpiPack(recommendationCount);
}
