import type { PaddockOperationsDto } from '@trackmind/shared';
import type { PaddockOperationsDeps } from '../paddockOperationsPlatform.js';
import { createSeededPaddockOperations } from '../paddockOperationsPlatform.js';

const now = () => new Date().toISOString();

export function createPaddockOperationsWorkspace(
  tenantId = 'trackmind',
  racetrackId = 'main-track',
  deps: Omit<PaddockOperationsDeps, 'tenantId' | 'racetrackId'> = {},
): PaddockOperationsDto {
  return createSeededPaddockOperations({ tenantId, racetrackId, ...deps }, now()).workspace(now());
}
