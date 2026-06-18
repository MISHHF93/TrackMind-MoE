import { createSeededRacingFinance } from '../racingFinancePlatform.js';
import type { RacingFinanceOperationsDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createFinancePlatformWorkspace(): RacingFinanceOperationsDto {
  return createSeededRacingFinance().workspace(now());
}
