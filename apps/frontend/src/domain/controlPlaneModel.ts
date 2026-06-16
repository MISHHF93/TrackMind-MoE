import type {
  AIControlPlaneModelRegistryDto,
  AIControlPlanePolicyDto,
  AIControlPlaneRecommendationDto,
  AIControlPlaneWorkspaceDto,
} from '@trackmind/shared';
import type { ContextDegradation } from './aiOperatingModel';

export interface AICommandDeckData {
  generatedAt?: string;
  policy: AIControlPlanePolicyDto;
  workspace?: AIControlPlaneWorkspaceDto;
  modelRegistry?: AIControlPlaneModelRegistryDto;
  recommendations: AIControlPlaneRecommendationDto[];
  blockedActions: AIControlPlaneRecommendationDto[];
  events: NonNullable<AIControlPlaneWorkspaceDto['events']>;
  featureStore?: AIControlPlaneModelRegistryDto['featureStore'];
  degradations: ContextDegradation[];
}
