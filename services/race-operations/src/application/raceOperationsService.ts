import type { RaceOfficeWorkspaceDto } from '@trackmind/shared';
import type { RaceOperationsDashboard, RaceOperationsReadPort, RaceStatus } from '../domain/raceOperationsPort.js';

export interface RaceOperationsServiceOptions {
  readPort: RaceOperationsReadPort;
  tenantId?: string;
  clock?: () => string;
}

export class RaceOperationsService {
  private readonly readPort: RaceOperationsReadPort;
  private readonly tenantId: string;
  private readonly clock: () => string;

  constructor(options: RaceOperationsServiceOptions) {
    this.readPort = options.readPort;
    this.tenantId = options.tenantId ?? 'default-tenant';
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  get boundedContext() {
    return 'race-operations' as const;
  }

  get tenantScope() {
    return this.tenantId;
  }

  raceOfficeWorkspace(now = this.clock(), mock = false): RaceOfficeWorkspaceDto {
    return { ...this.readPort.raceOfficeWorkspace(now, mock), mock };
  }

  operationalDashboard(now = this.clock()): RaceOperationsDashboard {
    return this.readPort.operationalDashboard(now);
  }

  listRaces(filter: { trackId?: string; raceDate?: string; status?: RaceStatus } = {}) {
    return this.readPort.listRaces(filter);
  }

  getRace(raceId: string) {
    return this.readPort.getRace(raceId);
  }

  operationalReport(raceId: string) {
    return this.readPort.operationalReport(raceId);
  }
}

export function createRaceOperationsService(options: RaceOperationsServiceOptions) {
  return new RaceOperationsService(options);
}
