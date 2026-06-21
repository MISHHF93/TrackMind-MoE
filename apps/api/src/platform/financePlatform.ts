import { createSeededRacingFinance, type RacingFinancePlatform, type RacingFinancePlatformDeps } from '../racingFinancePlatform.js';
import type {
  RacingFinanceAuditTrailDto,
  RacingFinanceKpiDashboardDto,
  RacingFinanceOperationsDto,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

let platformInstance: RacingFinancePlatform | undefined;

function getFinancePlatform(deps: RacingFinancePlatformDeps = {}): RacingFinancePlatform {
  if (!platformInstance) platformInstance = createSeededRacingFinance(deps);
  return platformInstance;
}

/** Wave 17 finance workspace read model — distinct from `/services/finance/ticketing`. */
export function createFinancePlatformWorkspace(at = now(), deps: RacingFinancePlatformDeps = {}): RacingFinanceOperationsDto {
  return getFinancePlatform(deps).workspace(at);
}

export function createFinanceKpiDashboard(at = now(), deps: RacingFinancePlatformDeps = {}): RacingFinanceKpiDashboardDto {
  return getFinancePlatform(deps).kpiDashboard(at);
}

export function createFinanceAuditTrail(raceDayId?: string, at = now(), deps: RacingFinancePlatformDeps = {}): RacingFinanceAuditTrailDto {
  return getFinancePlatform(deps).auditTrail(raceDayId, at);
}

export function resetFinancePlatformState(): void {
  platformInstance = undefined;
}
