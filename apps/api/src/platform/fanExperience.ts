import type { FanExperienceOperationsDto } from '@trackmind/shared';
import { createSeededFanExperience } from '../fanExperiencePlatform.js';

export {
  handleFanExperienceApiRequest,
  handleFanExperienceRequest,
  type FanExperienceRequestType,
} from '../fanExperience.js';

export function createFanExperienceWorkspace(now = new Date().toISOString()): FanExperienceOperationsDto {
  return createSeededFanExperience().workspace(now);
}
