export const racingCalendarSchemaVersion = 'trackmind.racing-calendar.v1' as const;

export const calendarLifecycleStatuses = [
  'planned',
  'scheduled',
  'approved',
  'active',
  'completed',
  'cancelled',
] as const;

export type CalendarLifecycleStatus = typeof calendarLifecycleStatuses[number];

export type CalendarConflictSeverity = 'advisory' | 'warning' | 'blocking';
export type CalendarConflictKind =
  | 'meet-date-overlap'
  | 'race-day-duplicate'
  | 'post-time-collision'
  | 'race-number-collision'
  | 'season-boundary-violation'
  | 'readiness-blocker';

export interface RacingSeasonDto {
  id: string;
  racetrackId: string;
  label: string;
  year: number;
  startsOn: string;
  endsOn: string;
  status: CalendarLifecycleStatus;
  meetIds: string[];
  regulatoryAuthority?: string;
  approvalId?: string;
  auditId: string;
  eventId: string;
  updatedAt: string;
}

export interface CalendarMeetDto {
  id: string;
  seasonId: string;
  racetrackId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: CalendarLifecycleStatus;
  raceDayIds: string[];
  meetCode?: string;
  approvalRequired: boolean;
  approvalId?: string;
  auditId: string;
  eventId: string;
  updatedAt: string;
}

export interface CalendarRaceDayDto {
  id: string;
  meetId: string;
  seasonId: string;
  racetrackId: string;
  raceDate: string;
  status: CalendarLifecycleStatus;
  raceIds: string[];
  firstPostTime?: string;
  lastPostTime?: string;
  readinessScore?: number;
  readinessStatus?: 'ready' | 'watch' | 'blocked';
  blockers: string[];
  approvalRequired: boolean;
  auditId: string;
  eventId: string;
  updatedAt: string;
}

export interface RaceScheduleItemDto {
  id: string;
  raceDayId: string;
  meetId: string;
  seasonId: string;
  racetrackId: string;
  raceDate: string;
  raceNumber: number;
  scheduledPostTime: string;
  surface: 'dirt' | 'turf' | 'synthetic';
  distanceFurlongs: number;
  status: CalendarLifecycleStatus;
  operationalStatus?: string;
  approvalRequired: boolean;
  auditId: string;
  eventId: string;
  updatedAt: string;
}

export interface ScheduleConflictDto {
  id: string;
  kind: CalendarConflictKind;
  severity: CalendarConflictSeverity;
  racetrackId: string;
  raceDate?: string;
  subjectIds: string[];
  message: string;
  resolution: string;
  approvalRequired: boolean;
  detectedAt: string;
  auditId: string;
}

export interface CalendarReadinessSummaryDto {
  raceDayId: string;
  raceDate: string;
  racetrackId: string;
  readinessScore: number;
  readinessStatus: 'ready' | 'watch' | 'blocked';
  racesReady: number;
  racesWatch: number;
  racesBlocked: number;
  blockers: string[];
  pendingApprovals: number;
  assessedAt: string;
}

export interface RacingCalendarKpiDto {
  kpiId: string;
  name: string;
  value: number;
  unit: string;
  target: number;
  status: 'nominal' | 'watch' | 'warning' | 'critical' | 'blocked' | 'readiness-only';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  description: string;
}

export interface RacingCalendarWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof racingCalendarSchemaVersion;
  tenantId: string;
  racetrackId: string;
  seasons: RacingSeasonDto[];
  meets: CalendarMeetDto[];
  raceDays: CalendarRaceDayDto[];
  schedules: RaceScheduleItemDto[];
  conflicts: ScheduleConflictDto[];
  readiness: CalendarReadinessSummaryDto[];
  kpis: RacingCalendarKpiDto[];
  approvalControls: Array<{
    id: string;
    label: string;
    action: string;
    target: string;
    reason: string;
    requiredRoles: string[];
    evidence: string[];
    locked: true;
  }>;
  lifecycleLegend: CalendarLifecycleStatus[];
  auditEventIds: string[];
  eventIds: string[];
  mock: false;
}

export interface RacingCalendarDraftResultDto {
  accepted: true;
  draftId: string;
  entityKind: 'season' | 'meet' | 'race-day' | 'schedule';
  entityId?: string;
  approvalRequired: true;
  approvalId?: string;
  eventType: string;
  audited: true;
  auditId: string;
  message: string;
  mock: false;
}

export interface RacingCalendarSeasonsDto {
  generatedAt: string;
  schemaVersion: typeof racingCalendarSchemaVersion;
  seasons: RacingSeasonDto[];
  mock: false;
}

export interface RacingCalendarConflictsDto {
  generatedAt: string;
  schemaVersion: typeof racingCalendarSchemaVersion;
  conflicts: ScheduleConflictDto[];
  blockingCount: number;
  mock: false;
}

export interface RacingCalendarKpisDto {
  generatedAt: string;
  schemaVersion: typeof racingCalendarSchemaVersion;
  kpis: RacingCalendarKpiDto[];
  mock: false;
}
