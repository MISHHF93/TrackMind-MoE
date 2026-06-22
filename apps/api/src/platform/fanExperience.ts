import type { FanExperienceOperationsDto } from '@trackmind/shared';
import { createSeededFanExperience } from '../fanExperiencePlatform.js';

export {
  handleFanExperienceApiRequest,
  handleFanExperienceRequest,
  type FanExperienceRequestType,
  type FanExperienceApiOptions,
} from '../fanExperience.js';
export { createTicketingAdapterRegistry } from '../ticketingAdapter.js';

export function createFanExperienceWorkspace(now = new Date().toISOString()): FanExperienceOperationsDto {
  return createSeededFanExperience().workspace(now);
}
