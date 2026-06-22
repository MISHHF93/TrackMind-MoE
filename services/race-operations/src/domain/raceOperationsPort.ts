import type { RaceOfficeWorkspaceDto } from '@trackmind/shared';

export type RaceStatus =
  | 'draft'
  | 'scheduled'
  | 'entries-open'
  | 'declared'
  | 'post-positions-drawn'
  | 'ready'
  | 'running'
  | 'official'
  | 'cancelled';

export interface RaceOperationsDashboard {
  generatedAt: string;
  totals: Record<RaceStatus | 'all', number>;
  byTrack: Array<{ trackId: string; races: number; ready: number; running: number; blocked: number }>;
  upcoming: Array<{ raceId: string; trackId: string; raceNumber: number; postTime: string; status: RaceStatus; blockers: string[] }>;
  resourceExceptions: Array<{ raceId: string; resourceId: string; type: string; status: string }>;
  staffingExceptions: Array<{ raceId: string; missing: string[] }>;
  executionAlerts: Array<{ raceId: string; timestamp: string; message: string; severity: string }>;
}

export interface RaceOperationsReadPort {
  raceOfficeWorkspace(now?: string, mock?: boolean): RaceOfficeWorkspaceDto;
  operationalDashboard(now?: string): RaceOperationsDashboard;
  listRaces(filter?: { trackId?: string; raceDate?: string; status?: RaceStatus }): unknown[];
  getRace(raceId: string): unknown;
  operationalReport(raceId: string): Record<string, unknown>;
}
