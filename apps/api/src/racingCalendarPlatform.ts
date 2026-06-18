import type {
  CalendarLifecycleStatus,
  CalendarMeetDto,
  CalendarRaceDayDto,
  CalendarReadinessSummaryDto,
  RaceScheduleItemDto,
  RacingCalendarConflictsDto,
  RacingCalendarDraftResultDto,
  RacingCalendarKpiDto,
  RacingCalendarKpisDto,
  RacingCalendarSeasonsDto,
  RacingCalendarWorkspaceDto,
  RacingSeasonDto,
  ScheduleConflictDto,
} from '@trackmind/shared';
import type { CentralizedApprovalService } from './approvals.js';
import type { ImmutableAuditLog } from './auditLog.js';
import type { UniversalEventBus } from './eventBus.js';
import { RaceOperationsPlatform, type RaceCard, type RaceDay, type RaceMeet, type RaceStatus } from './raceOperationsPlatform.js';
import type { RaceDayReadinessDashboard, RaceDayReadinessService } from './raceDayReadiness.js';

export type { CalendarLifecycleStatus };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface RacingCalendarDeps {
  racePlatform: RaceOperationsPlatform;
  readinessService?: RaceDayReadinessService;
  readinessDashboard?: RaceDayReadinessDashboard;
  approvalService?: CentralizedApprovalService;
  auditLog?: ImmutableAuditLog;
  eventBus?: UniversalEventBus;
  tenantId?: string;
  racetrackId?: string;
}

export interface RacingSeasonRecord {
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

const meetOpsToCalendar: Record<RaceMeet['status'], CalendarLifecycleStatus> = {
  draft: 'planned',
  open: 'active',
  closed: 'completed',
  cancelled: 'cancelled',
};

const dayOpsToCalendar: Record<RaceDay['status'], CalendarLifecycleStatus> = {
  draft: 'planned',
  carding: 'scheduled',
  'entries-open': 'approved',
  ready: 'active',
  closed: 'completed',
  cancelled: 'cancelled',
};

const raceOpsToCalendar = (status: RaceStatus, readiness?: RaceCard['readiness']): CalendarLifecycleStatus => {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'official') return 'completed';
  if (['running', 'ready'].includes(status)) return 'active';
  if (readiness?.ready) return 'approved';
  if (['declared', 'post-positions-drawn', 'entries-open'].includes(status)) return 'scheduled';
  return 'planned';
};

export class RacingCalendarPlatform {
  private readonly seasons = new Map<string, RacingSeasonRecord>();
  private readonly auditIds: string[] = [];
  private readonly eventIds: string[] = [];

  constructor(private readonly deps: RacingCalendarDeps) {}

  workspace(now = new Date().toISOString()): RacingCalendarWorkspaceDto {
    this.ensureDefaultSeason(now);
    const seasons = this.listSeasons();
    const meets = this.listMeets(now);
    const raceDays = this.listRaceDays(now);
    const schedules = this.listSchedules(now);
    const conflicts = this.detectConflicts(now);
    const readiness = this.summarizeReadiness(now);
    const kpis = this.computeKpis({ seasons, meets, raceDays, schedules, conflicts, readiness, now });
    const approvalControls = this.approvalControls(meets, raceDays, schedules);

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-calendar.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      seasons,
      meets,
      raceDays,
      schedules,
      conflicts,
      readiness,
      kpis,
      approvalControls,
      lifecycleLegend: [...['planned', 'scheduled', 'approved', 'active', 'completed', 'cancelled'] as CalendarLifecycleStatus[]],
      auditEventIds: [...this.auditIds],
      eventIds: [...this.eventIds],
      mock: false,
    };
  }

  listSeasonsView(now = new Date().toISOString()): RacingCalendarSeasonsDto {
    this.ensureDefaultSeason(now);
    return { generatedAt: now, schemaVersion: 'trackmind.racing-calendar.v1', seasons: this.listSeasons(), mock: false };
  }

  listConflicts(now = new Date().toISOString()): RacingCalendarConflictsDto {
    const conflicts = this.detectConflicts(now);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-calendar.v1',
      conflicts,
      blockingCount: conflicts.filter((c) => c.severity === 'blocking').length,
      mock: false,
    };
  }

  calendarKpis(now = new Date().toISOString()): RacingCalendarKpisDto {
    const workspace = this.workspace(now);
    return { generatedAt: now, schemaVersion: 'trackmind.racing-calendar.v1', kpis: workspace.kpis, mock: false };
  }

  requestSeasonDraft(input: { label: string; year: number; startsOn: string; endsOn: string; racetrackId?: string }, actor = 'racing-secretary'): RacingCalendarDraftResultDto {
    if (input.endsOn < input.startsOn) throw new Error('Season end date must be on or after start date');
    const racetrackId = input.racetrackId ?? this.deps.racetrackId ?? 'main-track';
    const seasonId = id('season');
    const auditId = this.recordAudit('calendar.season.draft.requested', seasonId, actor, { input });
    const eventId = this.recordEvent('calendar.season.draft.requested.v1', seasonId, actor, { input });
    const approvalId = this.deps.approvalService?.createRequest({
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId,
      action: 'race-office-configuration',
      target: seasonId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Draft racing season ${input.label} requires racing secretary approval before publication.`,
      evidence: ['season-calendar-draft', 'human-approval-record'],
    })?.id;

    const season: RacingSeasonRecord = {
      id: seasonId,
      racetrackId,
      label: input.label,
      year: input.year,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      status: 'planned',
      meetIds: [],
      approvalId,
      auditId,
      eventId,
      updatedAt: new Date().toISOString(),
    };
    this.seasons.set(seasonId, season);

    return {
      accepted: true,
      draftId: id('draft-season'),
      entityKind: 'season',
      entityId: seasonId,
      approvalRequired: true,
      approvalId,
      eventType: 'calendar.season.draft.requested.v1',
      audited: true,
      auditId,
      message: 'Season draft recorded. Publication remains approval-gated; no meet dates are activated until authorized.',
      mock: false,
    };
  }

  requestMeetDraft(input: { seasonId: string; name: string; startsOn: string; endsOn: string; racetrackId?: string }, actor = 'racing-secretary'): RacingCalendarDraftResultDto {
    const season = this.requireSeason(input.seasonId);
    const racetrackId = input.racetrackId ?? season.racetrackId;
    const meetId = id('meet');
    const auditId = this.recordAudit('calendar.meet.draft.requested', meetId, actor, { seasonId: season.id, input });
    const eventId = this.recordEvent('calendar.meet.draft.requested.v1', meetId, actor, { seasonId: season.id, input });
    const approvalId = this.deps.approvalService?.createRequest({
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId,
      action: 'race-office-configuration',
      target: meetId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Draft meet ${input.name} requires approval before calendar activation.`,
      evidence: ['meet-calendar-draft', 'human-approval-record'],
    })?.id;

    this.deps.racePlatform.createMeet({
      id: meetId,
      trackId: racetrackId,
      name: input.name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      status: 'draft',
      officialConfig: { stewards: ['steward-calendar'], racingSecretary: actor, commission: 'state-racing-commission', rulesVersion: '2026.06', scratchDeadlineMinutes: 45, maxFieldSize: 14 },
    }, { id: actor, roles: ['racing-secretary'], human: true });

    season.meetIds = [...new Set([...season.meetIds, meetId])];
    season.updatedAt = new Date().toISOString();
    this.seasons.set(season.id, season);

    return {
      accepted: true,
      draftId: id('draft-meet'),
      entityKind: 'meet',
      entityId: meetId,
      approvalRequired: true,
      approvalId,
      eventType: 'calendar.meet.draft.requested.v1',
      audited: true,
      auditId,
      message: 'Meet draft recorded on the racing calendar. Meet activation requires human approval.',
      mock: false,
    };
  }

  requestRaceDayDraft(input: { meetId: string; raceDate: string; racetrackId?: string }, actor = 'racing-secretary'): RacingCalendarDraftResultDto {
    const meet = this.deps.racePlatform.listMeets().find((m) => m.id === input.meetId);
    if (!meet) throw new Error(`Unknown meet ${input.meetId}`);
    const racetrackId = input.racetrackId ?? meet.trackId;
    const dayId = id('day');
    const auditId = this.recordAudit('calendar.race-day.draft.requested', dayId, actor, { meetId: meet.id, input });
    const eventId = this.recordEvent('calendar.race-day.draft.requested.v1', dayId, actor, { meetId: meet.id, input });
    const approvalId = this.deps.approvalService?.createRequest({
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId,
      action: 'race-office-configuration',
      target: dayId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Draft race day ${input.raceDate} requires approval before entries open.`,
      evidence: ['race-day-calendar-draft', 'human-approval-record'],
    })?.id;

    this.deps.racePlatform.createRaceDay({ id: dayId, meetId: meet.id, trackId: racetrackId, raceDate: input.raceDate, status: 'draft' }, { id: actor, roles: ['racing-secretary'], human: true });

    return {
      accepted: true,
      draftId: id('draft-day'),
      entityKind: 'race-day',
      entityId: dayId,
      approvalRequired: true,
      approvalId,
      eventType: 'calendar.race-day.draft.requested.v1',
      audited: true,
      auditId,
      message: 'Race day draft recorded. Opening entries requires authorized calendar approval.',
      mock: false,
    };
  }

  requestScheduleDraft(input: { raceDayId: string; raceNumber: number; scheduledPostTime: string; surface: 'dirt' | 'turf' | 'synthetic'; distanceFurlongs: number }, actor = 'racing-secretary'): RacingCalendarDraftResultDto {
    const day = this.deps.racePlatform.listRaceDays().find((d) => d.id === input.raceDayId);
    if (!day) throw new Error(`Unknown race day ${input.raceDayId}`);
    const raceId = id('race');
    const auditId = this.recordAudit('calendar.schedule.draft.requested', raceId, actor, { raceDayId: day.id, input });
    const eventId = this.recordEvent('calendar.schedule.draft.requested.v1', raceId, actor, { raceDayId: day.id, input });
    const approvalId = this.deps.approvalService?.createRequest({
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: day.trackId,
      action: 'race-office-configuration',
      target: raceId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Draft race ${input.raceNumber} post time requires approval before publication.`,
      evidence: ['schedule-calendar-draft', 'human-approval-record'],
    })?.id;

    this.deps.racePlatform.createRaceCard(day.id, {
      id: raceId,
      trackId: day.trackId,
      raceDate: day.raceDate,
      raceNumber: input.raceNumber,
      scheduledPostTime: input.scheduledPostTime,
      conditions: { surface: input.surface, distanceFurlongs: input.distanceFurlongs, classLevel: 'Open', purse: 0, eligibility: [] },
    }, { id: actor, roles: ['racing-secretary'], human: true });

    return {
      accepted: true,
      draftId: id('draft-schedule'),
      entityKind: 'schedule',
      entityId: raceId,
      approvalRequired: true,
      approvalId,
      eventType: 'calendar.schedule.draft.requested.v1',
      audited: true,
      auditId,
      message: 'Race schedule draft recorded. Post time publication remains approval-gated.',
      mock: false,
    };
  }

  private listSeasons(): RacingSeasonDto[] {
    return [...this.seasons.values()].map(clone).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  }

  private listMeets(now: string): CalendarMeetDto[] {
    const seasons = this.listSeasons();
    return this.deps.racePlatform.listMeets().map((meet) => {
      const season = seasons.find((s) => s.meetIds.includes(meet.id)) ?? seasons[0];
      const calendarStatus = this.meetCalendarStatus(meet);
      return {
        id: meet.id,
        seasonId: season?.id ?? 'season-unassigned',
        racetrackId: meet.trackId,
        name: meet.name,
        startsOn: meet.startsOn,
        endsOn: meet.endsOn,
        status: calendarStatus,
        raceDayIds: this.deps.racePlatform.listRaceDays({ meetId: meet.id }).map((d) => d.id),
        approvalRequired: calendarStatus === 'planned' || calendarStatus === 'scheduled',
        auditId: `audit:calendar:meet:${meet.id}`,
        eventId: `event:calendar:meet:${meet.id}`,
        updatedAt: meet.updatedAt ?? now,
      };
    });
  }

  private listRaceDays(now: string): CalendarRaceDayDto[] {
    const seasons = this.listSeasons();
    const readiness = this.deps.readinessDashboard;
    return this.deps.racePlatform.listRaceDays().map((day) => {
      const season = seasons.find((s) => s.meetIds.includes(day.meetId)) ?? seasons[0];
      const races = this.deps.racePlatform.listRaces({ trackId: day.trackId, raceDate: day.raceDate });
      const postTimes = races.map((r) => r.scheduledPostTime).sort();
      const dayReadiness = readiness?.races.filter((r) => races.some((race) => race.id === r.raceId)) ?? [];
      const avgScore = dayReadiness.length ? Math.round(dayReadiness.reduce((s, r) => s + r.score, 0) / dayReadiness.length) : undefined;
      const readinessStatus: CalendarRaceDayDto['readinessStatus'] = dayReadiness.some((r) => r.status === 'blocked') ? 'blocked' : dayReadiness.some((r) => r.status === 'watch') ? 'watch' : dayReadiness.length ? 'ready' : undefined;
      const blockers = races.flatMap((r) => r.readiness?.blockers ?? []).filter(Boolean);
      const calendarStatus = this.dayCalendarStatus(day, readinessStatus);

      return {
        id: day.id,
        meetId: day.meetId,
        seasonId: season?.id ?? 'season-unassigned',
        racetrackId: day.trackId,
        raceDate: day.raceDate,
        status: calendarStatus,
        raceIds: [...day.raceIds],
        firstPostTime: postTimes[0],
        lastPostTime: postTimes.at(-1),
        readinessScore: avgScore,
        readinessStatus,
        blockers: [...new Set(blockers)],
        approvalRequired: calendarStatus === 'planned' || calendarStatus === 'scheduled',
        auditId: `audit:calendar:day:${day.id}`,
        eventId: `event:calendar:day:${day.id}`,
        updatedAt: day.updatedAt ?? now,
      };
    }).sort((a, b) => a.raceDate.localeCompare(b.raceDate));
  }

  private listSchedules(now: string): RaceScheduleItemDto[] {
    const seasons = this.listSeasons();
    const days = this.deps.racePlatform.listRaceDays();
    return this.deps.racePlatform.listRaces().map((race) => {
      const day = days.find((d) => d.raceIds.includes(race.id)) ?? days.find((d) => d.raceDate === race.raceDate && d.trackId === race.trackId);
      const season = seasons.find((s) => day && s.meetIds.includes(day.meetId)) ?? seasons[0];
      const calendarStatus = raceOpsToCalendar(race.status, race.readiness);
      return {
        id: race.id,
        raceDayId: day?.id ?? `day:${race.raceDate}`,
        meetId: day?.meetId ?? 'meet-unassigned',
        seasonId: season?.id ?? 'season-unassigned',
        racetrackId: race.trackId,
        raceDate: race.raceDate,
        raceNumber: race.raceNumber,
        scheduledPostTime: race.scheduledPostTime,
        surface: race.conditions.surface,
        distanceFurlongs: race.conditions.distanceFurlongs,
        status: calendarStatus,
        operationalStatus: race.status,
        approvalRequired: calendarStatus === 'planned' || calendarStatus === 'scheduled',
        auditId: `audit:calendar:race:${race.id}`,
        eventId: `event:calendar:race:${race.id}`,
        updatedAt: race.updatedAt ?? now,
      };
    }).sort((a, b) => a.scheduledPostTime.localeCompare(b.scheduledPostTime));
  }

  private detectConflicts(now: string): ScheduleConflictDto[] {
    const conflicts: ScheduleConflictDto[] = [];
    const meets = this.deps.racePlatform.listMeets();
    const days = this.deps.racePlatform.listRaceDays();
    const races = this.deps.racePlatform.listRaces();
    const seasons = this.listSeasons();

    for (let i = 0; i < meets.length; i++) {
      for (let j = i + 1; j < meets.length; j++) {
        const a = meets[i];
        const b = meets[j];
        if (a.trackId !== b.trackId) continue;
        if (a.endsOn >= b.startsOn && b.endsOn >= a.startsOn) {
          conflicts.push(this.conflict('meet-date-overlap', 'warning', a.trackId, undefined, [a.id, b.id], `Meet ${a.name} overlaps meet ${b.name}`, 'Adjust meet boundaries or cancel one meet before approval.', now));
        }
      }
    }

    const dayKeys = new Map<string, string[]>();
    for (const day of days) {
      const key = `${day.trackId}:${day.raceDate}`;
      dayKeys.set(key, [...(dayKeys.get(key) ?? []), day.id]);
    }
    for (const [key, ids] of dayKeys) {
      if (ids.length > 1) {
        const [trackId, raceDate] = key.split(':');
        conflicts.push(this.conflict('race-day-duplicate', 'blocking', trackId, raceDate, ids, `Duplicate race days on ${raceDate}`, 'Consolidate to a single race day per track and date.', now));
      }
    }

    const racesByDay = new Map<string, RaceCard[]>();
    for (const race of races) {
      const key = `${race.trackId}:${race.raceDate}`;
      racesByDay.set(key, [...(racesByDay.get(key) ?? []), race]);
    }
    for (const [key, dayRaces] of racesByDay) {
      const [trackId, raceDate] = key.split(':');
      const numbers = new Map<number, string[]>();
      const times = new Map<string, string[]>();
      for (const race of dayRaces) {
        numbers.set(race.raceNumber, [...(numbers.get(race.raceNumber) ?? []), race.id]);
        times.set(race.scheduledPostTime, [...(times.get(race.scheduledPostTime) ?? []), race.id]);
      }
      for (const [raceNumber, ids] of numbers) {
        if (ids.length > 1) conflicts.push(this.conflict('race-number-collision', 'blocking', trackId, raceDate, ids, `Race number ${raceNumber} assigned to multiple races`, 'Resequence race numbers before calendar approval.', now));
      }
      for (const [postTime, ids] of times) {
        if (ids.length > 1) conflicts.push(this.conflict('post-time-collision', 'blocking', trackId, raceDate, ids, `Post time ${postTime} collision`, 'Adjust post times to maintain safe spacing.', now));
      }
    }

    for (const day of days) {
      const season = seasons.find((s) => s.meetIds.includes(day.meetId));
      if (season && (day.raceDate < season.startsOn || day.raceDate > season.endsOn)) {
        conflicts.push(this.conflict('season-boundary-violation', 'warning', day.trackId, day.raceDate, [day.id, season.id], `Race day ${day.raceDate} outside season ${season.label}`, 'Move race day inside season boundaries or extend season with approval.', now));
      }
    }

    for (const race of races) {
      if ((race.readiness?.blockers.length ?? 0) > 0) {
        conflicts.push(this.conflict('readiness-blocker', 'warning', race.trackId, race.raceDate, [race.id], `Race ${race.raceNumber} readiness blockers: ${race.readiness!.blockers.join('; ')}`, 'Resolve readiness blockers before activating race day.', now));
      }
    }

    return conflicts;
  }

  private summarizeReadiness(now: string): CalendarReadinessSummaryDto[] {
    const dashboard = this.deps.readinessDashboard ?? this.deps.readinessService?.dashboard(now);
    const days = this.listRaceDays(now);
    if (!dashboard) {
      return days.map((day) => ({
        raceDayId: day.id,
        raceDate: day.raceDate,
        racetrackId: day.racetrackId,
        readinessScore: day.readinessScore ?? 0,
        readinessStatus: day.readinessStatus ?? 'watch',
        racesReady: 0,
        racesWatch: 0,
        racesBlocked: 0,
        blockers: day.blockers,
        pendingApprovals: 0,
        assessedAt: now,
      }));
    }

    return days.map((day) => {
      const races = dashboard.races.filter((r) => this.deps.racePlatform.listRaces({ trackId: day.racetrackId, raceDate: day.raceDate }).some((race) => race.id === r.raceId));
      return {
        raceDayId: day.id,
        raceDate: day.raceDate,
        racetrackId: day.racetrackId,
        readinessScore: races.length ? Math.round(races.reduce((s, r) => s + r.score, 0) / races.length) : dashboard.averageScore,
        readinessStatus: races.some((r) => r.status === 'blocked') ? 'blocked' : races.some((r) => r.status === 'watch') ? 'watch' : 'ready',
        racesReady: races.filter((r) => r.status === 'ready').length,
        racesWatch: races.filter((r) => r.status === 'watch').length,
        racesBlocked: races.filter((r) => r.status === 'blocked').length,
        blockers: day.blockers,
        pendingApprovals: dashboard.approvals.filter((a) => races.some((r) => r.raceId === a.raceId) && a.status === 'pending').length,
        assessedAt: dashboard.generatedAt,
      };
    });
  }

  private computeKpis(input: {
    seasons: RacingSeasonDto[];
    meets: CalendarMeetDto[];
    raceDays: CalendarRaceDayDto[];
    schedules: RaceScheduleItemDto[];
    conflicts: ScheduleConflictDto[];
    readiness: CalendarReadinessSummaryDto[];
    now: string;
  }): RacingCalendarKpiDto[] {
    const activeDays = input.raceDays.filter((d) => d.status === 'active' || d.status === 'approved').length;
    const blockingConflicts = input.conflicts.filter((c) => c.severity === 'blocking').length;
    const readinessScores = input.readiness.map((r) => r.readinessScore);
    const avgReadiness = readinessScores.length ? Math.round(readinessScores.reduce((s, v) => s + v, 0) / readinessScores.length) : 0;
    const approvedPct = input.schedules.length ? Math.round((input.schedules.filter((s) => ['approved', 'active', 'completed'].includes(s.status)).length / input.schedules.length) * 100) : 0;

    return [
      kpi('kpi-calendar-season-coverage', 'Season coverage', input.seasons.length, 'seasons', 1, input.seasons.length >= 1 ? 'nominal' : 'warning', 'flat', 'Active racing seasons on the calendar'),
      kpi('kpi-calendar-meet-count', 'Scheduled meets', input.meets.filter((m) => m.status !== 'cancelled').length, 'meets', input.meets.length, 'nominal', 'flat', 'Meets in planned through active lifecycle'),
      kpi('kpi-calendar-race-days', 'Race days scheduled', input.raceDays.length, 'days', input.raceDays.length, activeDays > 0 ? 'nominal' : 'watch', 'up', 'Race days across all meets'),
      kpi('kpi-calendar-conflicts', 'Schedule conflicts', blockingConflicts, 'conflicts', 0, blockingConflicts === 0 ? 'nominal' : 'critical', blockingConflicts > 0 ? 'up' : 'flat', 'Blocking calendar conflicts requiring resolution'),
      kpi('kpi-calendar-readiness', 'Race-day readiness score', avgReadiness, 'score', 90, avgReadiness >= 90 ? 'nominal' : avgReadiness >= 70 ? 'watch' : 'critical', 'flat', 'Average readiness across scheduled race days'),
      kpi('kpi-calendar-approval-coverage', 'Approved schedule coverage', approvedPct, '%', 95, approvedPct >= 95 ? 'nominal' : 'watch', 'flat', 'Share of races in approved/active/completed lifecycle'),
    ];
  }

  private approvalControls(meets: CalendarMeetDto[], raceDays: CalendarRaceDayDto[], schedules: RaceScheduleItemDto[]) {
    return [
      ...meets.filter((m) => m.approvalRequired).map((m) => control('race-office-configuration', m.id, `Approve meet ${m.name}`, 'Meet calendar activation requires racing secretary approval.', ['racing-secretary', 'steward'])),
      ...raceDays.filter((d) => d.approvalRequired).map((d) => control('race-office-configuration', d.id, `Approve race day ${d.raceDate}`, 'Race day opening requires authorized calendar approval.', ['racing-secretary'])),
      ...schedules.filter((s) => s.approvalRequired).map((s) => control('race-office-configuration', s.id, `Approve race ${s.raceNumber} schedule`, 'Post time publication requires calendar approval.', ['racing-secretary', 'steward'])),
    ];
  }

  private ensureDefaultSeason(now: string): void {
    if (this.seasons.size > 0) return;
    const meets = this.deps.racePlatform.listMeets();
    if (!meets.length) return;
    const startsOn = meets.map((m) => m.startsOn).sort()[0];
    const endsOn = meets.map((m) => m.endsOn).sort().at(-1) ?? startsOn;
    const year = Number(startsOn.slice(0, 4));
    const seasonId = `season-${year}`;
    const auditId = `audit:calendar:season:${seasonId}`;
    const eventId = `event:calendar:season:${seasonId}`;
    this.seasons.set(seasonId, {
      id: seasonId,
      racetrackId: meets[0].trackId,
      label: `${year} Racing Season`,
      year,
      startsOn,
      endsOn,
      status: meets.some((m) => m.status === 'open') ? 'active' : 'scheduled',
      meetIds: meets.map((m) => m.id),
      regulatoryAuthority: 'state-racing-commission',
      auditId,
      eventId,
      updatedAt: now,
    });
    this.auditIds.push(auditId);
    this.eventIds.push(eventId);
  }

  private meetCalendarStatus(meet: RaceMeet): CalendarLifecycleStatus {
    const mapped = meetOpsToCalendar[meet.status] ?? 'planned';
    if (mapped === 'active' && meet.status === 'open') return 'active';
    if (meet.status === 'draft') return 'scheduled';
    return mapped;
  }

  private dayCalendarStatus(day: RaceDay, readiness?: 'ready' | 'watch' | 'blocked'): CalendarLifecycleStatus {
    const mapped = dayOpsToCalendar[day.status] ?? 'planned';
    if (mapped === 'active') return 'active';
    if (readiness === 'ready' && ['entries-open', 'ready'].includes(day.status)) return 'approved';
    return mapped;
  }

  private requireSeason(seasonId: string): RacingSeasonRecord {
    const season = this.seasons.get(seasonId);
    if (!season) throw new Error(`Unknown season ${seasonId}`);
    return season;
  }

  private conflict(kind: ScheduleConflictDto['kind'], severity: ScheduleConflictDto['severity'], racetrackId: string, raceDate: string | undefined, subjectIds: string[], message: string, resolution: string, now: string): ScheduleConflictDto {
    const conflictId = id('conflict');
    const auditId = this.recordAudit('calendar.conflict.detected', conflictId, 'calendar-service', { kind, subjectIds, message });
    return { id: conflictId, kind, severity, racetrackId, raceDate, subjectIds, message, resolution, approvalRequired: severity === 'blocking', detectedAt: now, auditId };
  }

  private recordAudit(action: string, subjectId: string, actor: string, payload: Record<string, unknown>): string {
    const auditId = id('audit-calendar');
    this.auditIds.push(auditId);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({ id: auditId, type: 'workflow-action', actor, timestamp: new Date().toISOString(), subjectId, payload: { action, ...payload }, tenantId: this.deps.tenantId ?? 'trackmind', severity: 'info', regulations: ['HISA', 'ARCI'] });
    }
    return auditId;
  }

  private recordEvent(eventType: string, subjectId: string, actor: string, payload: Record<string, unknown>): string {
    const eventId = id('evt-calendar');
    this.eventIds.push(eventId);
    void this.deps.eventBus?.publish({ id: eventId, type: eventType, payload: { subjectId, actor, ...payload }, aggregateId: subjectId, producer: 'racing-calendar', metadata: { compliance: 'regulated', team: 'racing-operations', accountableRole: 'racing-secretary' } });
    return eventId;
  }
}

function kpi(kpiId: string, name: string, value: number, unit: string, target: number, status: RacingCalendarKpiDto['status'], trend: RacingCalendarKpiDto['trend'], description: string): RacingCalendarKpiDto {
  return { kpiId, name, value, unit, target, status, trend, description };
}

function control(action: string, target: string, label: string, reason: string, requiredRoles: string[]) {
  return { id: `${action}-${target}`, label, action, target, reason, requiredRoles, evidence: ['calendar-draft', 'human-approval-record'], locked: true as const };
}

export function createSeededRacingCalendarPlatform(deps: RacingCalendarDeps, now = new Date().toISOString()): RacingCalendarPlatform {
  const platform = new RacingCalendarPlatform(deps);
  platform.workspace(now);
  return platform;
}
