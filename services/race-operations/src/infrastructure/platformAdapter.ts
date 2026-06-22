import type { RaceOfficeWorkspaceDto } from '@trackmind/shared';
import type { RaceOperationsDashboard, RaceOperationsReadPort, RaceStatus } from '../domain/raceOperationsPort.js';

type PlatformLike = {
  raceOfficeWorkspace(now?: string, mock?: boolean): RaceOfficeWorkspaceDto;
  operationalDashboard(now?: string): RaceOperationsDashboard;
  listRaces(filter?: { trackId?: string; raceDate?: string; status?: RaceStatus }): unknown[];
  getRace(raceId: string): unknown;
  operationalReport(raceId: string): Record<string, unknown>;
};

export function createPlatformReadAdapter(platform: PlatformLike): RaceOperationsReadPort {
  return {
    raceOfficeWorkspace: (now, mock) => platform.raceOfficeWorkspace(now, mock),
    operationalDashboard: (now) => platform.operationalDashboard(now),
    listRaces: (filter) => platform.listRaces(filter),
    getRace: (raceId) => platform.getRace(raceId),
    operationalReport: (raceId) => platform.operationalReport(raceId),
  };
}
