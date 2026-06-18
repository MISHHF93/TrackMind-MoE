import type { PaddockOperationsDto } from '@trackmind/shared';
import { createSeededPaddockOperations } from '../paddockOperationsPlatform.js';

const now = () => new Date().toISOString();

/** @deprecated Use PaddockOperationsPlatform via createSeededPaddockOperations */
export function createPaddockOperationsWorkspace(tenantId = 'trackmind', racetrackId = 'main-track'): PaddockOperationsDto {
  return createSeededPaddockOperations({ tenantId, racetrackId }, now()).workspace(now());
}
