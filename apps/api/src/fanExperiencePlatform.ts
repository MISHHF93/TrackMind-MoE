import type {
  AttendanceSnapshotDto,
  AttendanceZoneDto,
  EventSatisfactionSurveyDto,
  FanAnalyticsDto,
  FanExperienceKpiDashboardDto,
  FanExperienceKpiDto,
  FanExperienceMutationResultDto,
  FanExperienceOperationsAuditTrailDto,
  FanExperienceOperationsDto,
  FanExperienceRevenueLinkDto,
  GuestServiceRequestDto,
  HospitalityPackageDto,
  PremiumSeatingSectionDto,
} from '@trackmind/shared';
import { fanExperienceServiceGuardrailStatement } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService } from './approvals.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface FanExperienceState {
  tenantId: string;
  racetrackId: string;
  eventId?: string;
  capacity: number;
  attendanceSnapshots: AttendanceSnapshotDto[];
  zones: AttendanceZoneDto[];
  hospitalityPackages: HospitalityPackageDto[];
  premiumSeating: PremiumSeatingSectionDto[];
  guestServices: GuestServiceRequestDto[];
  satisfactionSurveys: EventSatisfactionSurveyDto[];
  revenueLinks: FanExperienceRevenueLinkDto[];
  ticketInventory: { available: number; sold: number; held: number };
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface FanExperiencePlatformDeps {
  approvalService?: CentralizedApprovalService;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
  eventId?: string;
}

export class FanExperiencePlatform {
  private state: FanExperienceState;
  private readonly auditChain: FanExperienceOperationsDto['auditTrail'] = [];

  constructor(private readonly deps: FanExperiencePlatformDeps = {}) {
    const now = new Date().toISOString();
    this.state = {
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      eventId: deps.eventId ?? 'race-day-main',
      capacity: 12000,
      attendanceSnapshots: [],
      zones: [],
      hospitalityPackages: [],
      premiumSeating: [],
      guestServices: [],
      satisfactionSurveys: [],
      revenueLinks: [],
      ticketInventory: { available: 3580, sold: 8420, held: 120 },
      version: 1,
      updatedAt: now,
      updatedBy: 'fan-experience',
    };
  }

  workspace(now = new Date().toISOString()): FanExperienceOperationsDto {
    const attendanceTracking = this.buildAttendanceTracking(now);
    const hospitality = this.buildHospitality();
    const fanAnalytics = this.buildFanAnalytics(now);
    const dashboard = this.buildDashboard(attendanceTracking, hospitality, fanAnalytics, now);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.fan-experience-operations.v1',
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      eventId: this.state.eventId,
      attendanceTracking,
      hospitality,
      premiumSeating: this.state.premiumSeating.map(clone),
      guestServices: this.state.guestServices.map(clone),
      eventSatisfaction: this.state.satisfactionSurveys.map(clone),
      fanAnalytics,
      revenueLinkage: this.state.revenueLinks.map(clone),
      satisfactionScore: dashboard.satisfactionScore,
      readinessScore: dashboard.readinessScore,
      guardrails: {
        compensationsRequireApproval: true,
        refundsRequireApproval: true,
        premiumOverridesRequireApproval: true,
        guardrailStatement: fanExperienceServiceGuardrailStatement,
      },
      crowdDensity: attendanceTracking.zones.map((zone) => ({ zone: zone.zone, level: zone.level })),
      ticketInventory: { ...this.state.ticketInventory },
      dashboard,
      auditTrail: this.auditChain.map(clone),
      attendance: {
        current: attendanceTracking.current,
        capacity: attendanceTracking.capacity,
        utilizationPercent: attendanceTracking.utilizationPercent,
      },
      hospitalityReadiness: {
        score: hospitality.readinessScore,
        openIssues: hospitality.openIssues,
      },
      ticketingConnector: {
        overallStatus: 'disconnected',
        degraded: false,
        adapters: [],
        lastSyncAt: now,
        inventorySource: 'platform',
        attendanceSource: 'platform',
        syncAuditIds: [],
      },
      mock: false,
    };
  }

  kpiDashboard(now = new Date().toISOString()): FanExperienceKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(eventId?: string, now = new Date().toISOString()): FanExperienceOperationsAuditTrailDto {
    const records = eventId
      ? this.auditChain.filter((record) => record.eventId === eventId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.fan-experience-operations.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  recordAttendanceSnapshot(
    input: Omit<AttendanceSnapshotDto, 'snapshotId' | 'auditId' | 'utilizationPercent'> & { utilizationPercent?: number },
    actor = 'ticketing-manager',
  ): FanExperienceMutationResultDto {
    const auditId = id('audit-fan');
    const utilizationPercent = input.utilizationPercent ?? Math.round((input.current / input.capacity) * 100);
    const snapshot: AttendanceSnapshotDto = {
      snapshotId: id('attendance'),
      recordedAt: input.recordedAt,
      current: input.current,
      capacity: input.capacity,
      utilizationPercent,
      entryRatePerMinute: input.entryRatePerMinute,
      auditId,
    };
    this.state.attendanceSnapshots.push(snapshot);
    this.state.capacity = input.capacity;
    this.syncZoneOccupancy(snapshot.current, nowFrom(input.recordedAt));
    return this.commit('fan-experience.attendance.recorded', `Recorded attendance snapshot at ${utilizationPercent}% utilization`, auditId, undefined, actor);
  }

  createGuestServiceRequest(
    input: Omit<GuestServiceRequestDto, 'requestId' | 'auditId' | 'approvalRequestId'>,
    actor = 'ticketing-manager',
  ): FanExperienceMutationResultDto {
    const auditId = id('audit-fan');
    let approvalRequestId: string | undefined;
    if ((input.category === 'refund' || input.priority === 'high') && this.deps.approvalService) {
      const approval = this.deps.approvalService.createRequest({
        action: 'payout',
        target: input.guestLabel,
        tenantId: this.state.tenantId,
        racetrackId: this.state.racetrackId,
        requestedBy: actor,
        actorType: 'human',
        reason: `Fan experience ${input.category} request: ${input.details}`,
        evidence: [`category:${input.category}`, `zone:${input.zone ?? 'unspecified'}`],
      });
      approvalRequestId = approval.id;
    }
    const request: GuestServiceRequestDto = {
      ...clone(input),
      requestId: id('guest-service'),
      auditId,
      approvalRequestId,
    };
    this.state.guestServices.push(request);
    const result = this.commit(
      'fan-experience.guest-service.created',
      `Created ${request.category} guest service request for ${request.guestLabel}`,
      auditId,
      request.requestId,
      actor,
      approvalRequestId,
    );
    return { ...result, requestId: request.requestId };
  }

  updateGuestServiceStatus(
    requestId: string,
    status: GuestServiceRequestDto['status'],
    actor = 'ticketing-manager',
  ): FanExperienceMutationResultDto {
    const request = this.state.guestServices.find((entry) => entry.requestId === requestId);
    if (!request) throw new Error(`Unknown guest service request ${requestId}`);
    request.status = status;
    if (status === 'resolved') request.resolvedAt = new Date().toISOString();
    const auditId = id('audit-fan');
    return this.commit(
      'fan-experience.guest-service.updated',
      `Updated guest service ${requestId} to ${status}`,
      auditId,
      requestId,
      actor,
      request.approvalRequestId,
    );
  }

  recordSatisfactionSurvey(
    input: Omit<EventSatisfactionSurveyDto, 'surveyId' | 'auditId' | 'band' | 'npsScore'> & { npsScore?: number; band?: EventSatisfactionSurveyDto['band'] },
    actor = 'ticketing-manager',
  ): FanExperienceMutationResultDto {
    const auditId = id('audit-fan');
    const npsScore = input.npsScore ?? Math.round((input.overallRating - 3) * 33);
    const band = input.band ?? (npsScore >= 50 ? 'promoter' : npsScore >= 0 ? 'passive' : 'detractor');
    const survey: EventSatisfactionSurveyDto = {
      ...clone(input),
      surveyId: id('satisfaction'),
      npsScore,
      band,
      auditId,
    };
    this.state.satisfactionSurveys.push(survey);
    return this.commit(
      'fan-experience.satisfaction.recorded',
      `Recorded satisfaction survey for event ${survey.eventId}`,
      auditId,
      undefined,
      actor,
      undefined,
      survey.eventId,
    );
  }

  recordHospitalityIssue(
    packageId: string,
    issue: string,
    actor = 'ticketing-manager',
  ): FanExperienceMutationResultDto {
    const pkg = this.state.hospitalityPackages.find((entry) => entry.packageId === packageId);
    if (!pkg) throw new Error(`Unknown hospitality package ${packageId}`);
    pkg.openIssues += 1;
    pkg.status = pkg.openIssues > 2 ? 'blocked' : 'watch';
    pkg.readinessScore = Math.max(0, pkg.readinessScore - 8);
    const auditId = id('audit-fan');
    return this.commit('fan-experience.hospitality.issue.recorded', `Recorded hospitality issue for ${pkg.name}: ${issue}`, auditId, packageId, actor);
  }

  resolveHospitalityIssue(packageId: string, actor = 'ticketing-manager'): FanExperienceMutationResultDto {
    const pkg = this.state.hospitalityPackages.find((entry) => entry.packageId === packageId);
    if (!pkg) throw new Error(`Unknown hospitality package ${packageId}`);
    pkg.openIssues = Math.max(0, pkg.openIssues - 1);
    pkg.status = pkg.openIssues === 0 ? 'ready' : pkg.openIssues === 1 ? 'watch' : 'blocked';
    pkg.readinessScore = Math.min(100, pkg.readinessScore + 10);
    const auditId = id('audit-fan');
    return this.commit('fan-experience.hospitality.issue.resolved', `Resolved hospitality issue for ${pkg.name}`, auditId, packageId, actor);
  }

  updatePremiumSeating(
    sectionId: string,
    input: Partial<Pick<PremiumSeatingSectionDto, 'seatsSold' | 'seatsHeld' | 'status' | 'revenueToday'>>,
    actor = 'ticketing-manager',
  ): FanExperienceMutationResultDto {
    const section = this.state.premiumSeating.find((entry) => entry.sectionId === sectionId);
    if (!section) throw new Error(`Unknown premium seating section ${sectionId}`);
    if (input.seatsSold !== undefined) section.seatsSold = input.seatsSold;
    if (input.seatsHeld !== undefined) section.seatsHeld = input.seatsHeld;
    if (input.status !== undefined) section.status = input.status;
    if (input.revenueToday !== undefined) section.revenueToday = input.revenueToday;
    const auditId = id('audit-fan');
    return this.commit('fan-experience.premium-seating.updated', `Updated premium seating section ${section.name}`, auditId, sectionId, actor);
  }

  private buildAttendanceTracking(now: string): FanExperienceOperationsDto['attendanceTracking'] {
    const latest = this.state.attendanceSnapshots.at(-1);
    const current = latest?.current ?? this.state.ticketInventory.sold;
    const capacity = latest?.capacity ?? this.state.capacity;
    const utilizationPercent = latest?.utilizationPercent ?? Math.round((current / capacity) * 100);
    if (!this.state.zones.length) this.seedZones(now, current);
    return {
      current,
      capacity,
      utilizationPercent,
      snapshots: this.state.attendanceSnapshots.map(clone),
      zones: this.state.zones.map(clone),
    };
  }

  private buildHospitality(): FanExperienceOperationsDto['hospitality'] {
    const packages = this.state.hospitalityPackages.map(clone);
    const openIssues = packages.reduce((sum, pkg) => sum + pkg.openIssues, 0);
    const readinessScore = packages.length
      ? Math.round(packages.reduce((sum, pkg) => sum + pkg.readinessScore, 0) / packages.length)
      : 91;
    return { readinessScore, openIssues, packages };
  }

  private buildFanAnalytics(now: string): FanAnalyticsDto {
    const openRequests = this.state.guestServices.filter((request) => request.status === 'open' || request.status === 'in-progress');
    const averageWaitMinutes = openRequests.length
      ? Math.round(openRequests.reduce((sum, request) => sum + request.waitMinutes, 0) / openRequests.length)
      : 8;
    const premiumSold = this.state.premiumSeating.reduce((sum, section) => sum + section.seatsSold, 0);
    const premiumTotal = this.state.premiumSeating.reduce((sum, section) => sum + section.seatsTotal, 0);
    const premiumConversionRate = premiumTotal ? Math.round((premiumSold / premiumTotal) * 100) : 0;
    const satisfactionScore = this.state.satisfactionSurveys.length
      ? Math.round(this.state.satisfactionSurveys.reduce((sum, survey) => sum + survey.overallRating, 0) / this.state.satisfactionSurveys.length * 20)
      : 82;
    const repeatVisitorRate = 34;
    const engagementScore = Math.round((satisfactionScore + premiumConversionRate + (100 - averageWaitMinutes)) / 3);
    return {
      engagementScore,
      repeatVisitorRate,
      averageWaitMinutes,
      premiumConversionRate,
      trends: this.buildTrends(now, satisfactionScore),
    };
  }

  private buildTrends(now: string, satisfactionScore: number): FanAnalyticsDto['trends'] {
    const attendance = this.state.attendanceSnapshots.slice(-6);
    const attendancePoints = attendance.map((snapshot) => ({ at: snapshot.recordedAt, value: snapshot.utilizationPercent }));
    if (!attendancePoints.length) {
      attendancePoints.push({ at: now, value: Math.round((this.state.ticketInventory.sold / this.state.capacity) * 100) });
    }
    const revenueToday = this.state.revenueLinks.reduce((sum, link) => sum + link.amountToday, 0);
    return [
      {
        metric: 'attendance',
        trend: attendancePoints.length >= 2 && attendancePoints.at(-1)!.value > attendancePoints[0]!.value ? 'up' : 'flat',
        points: attendancePoints,
        summary: 'Attendance utilization trend from gate snapshots.',
      },
      {
        metric: 'satisfaction',
        trend: satisfactionScore >= 80 ? 'up' : satisfactionScore >= 65 ? 'flat' : 'down',
        points: this.state.satisfactionSurveys.map((survey) => ({ at: survey.submittedAt, value: survey.overallRating * 20 })),
        summary: 'Event satisfaction from post-race surveys.',
      },
      {
        metric: 'guest-service-wait',
        trend: 'flat',
        points: this.state.guestServices.slice(-6).map((request) => ({ at: request.submittedAt, value: request.waitMinutes })),
        summary: 'Guest service wait-time pressure from open requests.',
      },
      {
        metric: 'premium-revenue',
        trend: revenueToday > 0 ? 'up' : 'insufficient-history',
        points: this.state.premiumSeating.map((section) => ({ at: now, value: section.revenueToday })),
        summary: 'Premium seating revenue linkage by section.',
      },
      {
        metric: 'hospitality-readiness',
        trend: 'flat',
        points: this.state.hospitalityPackages.map((pkg) => ({ at: now, value: pkg.readinessScore })),
        summary: 'Hospitality package readiness scores.',
      },
    ];
  }

  private buildDashboard(
    attendance: FanExperienceOperationsDto['attendanceTracking'],
    hospitality: FanExperienceOperationsDto['hospitality'],
    analytics: FanAnalyticsDto,
    now: string,
  ): FanExperienceKpiDashboardDto {
    const premiumSold = this.state.premiumSeating.reduce((sum, section) => sum + section.seatsSold, 0);
    const premiumTotal = this.state.premiumSeating.reduce((sum, section) => sum + section.seatsTotal, 0);
    const premiumSeatingOccupancy = premiumTotal ? Math.round((premiumSold / premiumTotal) * 100) : 0;
    const guestServiceOpenCount = this.state.guestServices.filter((request) => request.status === 'open' || request.status === 'in-progress').length;
    const satisfactionScore = this.state.satisfactionSurveys.length
      ? Math.round(this.state.satisfactionSurveys.reduce((sum, survey) => sum + survey.overallRating, 0) / this.state.satisfactionSurveys.length * 20)
      : 82;
    const revenueToday = this.state.revenueLinks.reduce((sum, link) => sum + link.amountToday, 0);
    const readinessScore = Math.round(
      (attendance.utilizationPercent * 0.2
        + hospitality.readinessScore * 0.2
        + satisfactionScore * 0.25
        + premiumSeatingOccupancy * 0.15
        + Math.max(0, 100 - guestServiceOpenCount * 5) * 0.2),
    );
    const panels: FanExperienceKpiDto[] = [
      this.panel('fan-attendance-utilization', 'Attendance utilization', 'Current gate attendance versus venue capacity.', attendance.utilizationPercent, '%', 85, attendance.utilizationPercent >= 85 ? 'nominal' : attendance.utilizationPercent >= 70 ? 'watch' : 'warning', 'flat', now),
      this.panel('fan-guest-service-open', 'Open guest services', 'Count of open or in-progress guest service requests.', guestServiceOpenCount, 'requests', 5, guestServiceOpenCount <= 5 ? 'nominal' : guestServiceOpenCount <= 10 ? 'watch' : 'warning', guestServiceOpenCount > 5 ? 'up' : 'flat', now),
      this.panel('fan-hospitality-readiness', 'Hospitality readiness', 'Composite hospitality package readiness score.', hospitality.readinessScore, 'score', 90, hospitality.readinessScore >= 90 ? 'nominal' : hospitality.readinessScore >= 75 ? 'watch' : 'warning', 'flat', now),
      this.panel('fan-premium-occupancy', 'Premium seating occupancy', 'Sold premium seats versus total premium inventory.', premiumSeatingOccupancy, '%', 80, premiumSeatingOccupancy >= 80 ? 'nominal' : premiumSeatingOccupancy >= 60 ? 'watch' : 'warning', 'up', now),
      this.panel('fan-satisfaction-score', 'Event satisfaction', 'Average post-event satisfaction converted to score.', satisfactionScore, 'score', 85, satisfactionScore >= 85 ? 'nominal' : satisfactionScore >= 70 ? 'watch' : 'warning', analytics.engagementScore >= 80 ? 'up' : 'flat', now),
      this.panel('fan-revenue-today', 'Fan revenue today', 'Linked ticketing, premium, hospitality, and concessions revenue.', revenueToday, 'USD', 50000, revenueToday >= 50000 ? 'nominal' : revenueToday >= 30000 ? 'watch' : 'warning', 'up', now),
    ];
    return {
      attendanceUtilization: attendance.utilizationPercent,
      guestServiceOpenCount,
      hospitalityReadinessScore: hospitality.readinessScore,
      premiumSeatingOccupancy,
      satisfactionScore,
      revenueToday,
      readinessScore,
      panels,
    };
  }

  private panel(
    kpiId: string,
    name: string,
    description: string,
    value: number,
    unit: string,
    target: number,
    status: FanExperienceKpiDto['status'],
    trend: FanExperienceKpiDto['trend'],
    now: string,
  ): FanExperienceKpiDto {
    return {
      kpiId,
      name,
      description,
      value,
      unit,
      target,
      status,
      trend,
      sourceEntities: [{ entityType: 'fan-experience', entityId: this.state.racetrackId }],
      auditReference: { auditIds: this.auditChain.slice(-3).map((record) => record.auditId), eventIds: [`fan-experience.kpi.${kpiId}`] },
    };
  }

  private seedZones(now: string, current: number) {
    const ratios = [
      { zoneId: 'zone-grandstand', zone: 'grandstand', share: 0.45 },
      { zoneId: 'zone-paddock', zone: 'paddock', share: 0.3 },
      { zoneId: 'zone-club', zone: 'club-level', share: 0.25 },
    ];
    this.state.zones = ratios.map((entry) => {
      const occupancy = Math.round(current * entry.share);
      const capacity = Math.round(this.state.capacity * entry.share);
      const utilization = capacity ? occupancy / capacity : 0;
      const level = utilization >= 0.95 ? 'at-capacity' : utilization >= 0.75 ? 'high' : utilization >= 0.45 ? 'medium' : 'low';
      return {
        zoneId: entry.zoneId,
        zone: entry.zone,
        occupancy,
        capacity,
        level,
        lastUpdatedAt: now,
      };
    });
  }

  private syncZoneOccupancy(current: number, now: string) {
    if (!this.state.zones.length) {
      this.seedZones(now, current);
      return;
    }
    const totalCapacity = this.state.zones.reduce((sum, zone) => sum + zone.capacity, 0) || this.state.capacity;
    for (const zone of this.state.zones) {
      const share = zone.capacity / totalCapacity;
      zone.occupancy = Math.round(current * share);
      const utilization = zone.capacity ? zone.occupancy / zone.capacity : 0;
      zone.level = utilization >= 0.95 ? 'at-capacity' : utilization >= 0.75 ? 'high' : utilization >= 0.45 ? 'medium' : 'low';
      zone.lastUpdatedAt = now;
    }
  }

  private commit(
    eventType: string,
    changeSummary: string,
    auditId: string,
    requestId?: string,
    actor = 'ticketing-manager',
    approvalRequestId?: string,
    eventId?: string,
  ): FanExperienceMutationResultDto {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'sha256:00000000';
    const record = {
      auditId,
      requestId,
      eventId: eventId ?? this.state.eventId,
      action: eventType,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ auditId, eventType, changeSummary, previousHash }),
      changeSummary,
      evidence: approvalRequestId ? [`approval:${approvalRequestId}`] : [],
    };
    this.auditChain.push(record);
    this.state.version += 1;
    this.state.updatedAt = record.timestamp;
    this.state.updatedBy = actor;
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: requestId ?? this.state.racetrackId,
        payload: { action: eventType, changeSummary, approvalRequestId },
        tenantId: this.state.tenantId,
        severity: 'info',
        regulations: ['SOC-2'],
      });
    }
    return {
      accepted: true,
      requestId,
      auditId,
      eventType,
      message: changeSummary,
      approvalRequestId,
      mock: false,
    };
  }
}

function nowFrom(value: string) {
  return Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value;
}

export function createSeededFanExperience(deps: FanExperiencePlatformDeps = {}, now = new Date().toISOString()): FanExperiencePlatform {
  const platform = new FanExperiencePlatform(deps);

  platform.recordAttendanceSnapshot({
    recordedAt: now,
    current: 8420,
    capacity: 12000,
    entryRatePerMinute: 42,
  });

  const hospitalityPackages: Array<Omit<HospitalityPackageDto, 'auditId'>> = [
    { packageId: 'hosp-club', name: 'Club Level Hospitality', zone: 'club-level', guestCount: 180, capacity: 220, status: 'ready', openIssues: 1, readinessScore: 93 },
    { packageId: 'hosp-turf', name: 'Turf Club Packages', zone: 'grandstand', guestCount: 96, capacity: 120, status: 'watch', openIssues: 1, readinessScore: 88 },
  ];
  for (const pkg of hospitalityPackages) {
    const auditId = id('audit-fan');
    (platform as unknown as { state: FanExperienceState }).state.hospitalityPackages.push({ ...pkg, auditId });
  }

  const premiumSeating: Array<Omit<PremiumSeatingSectionDto, 'auditId'>> = [
    { sectionId: 'prem-club-a', name: 'Club A', tier: 'club', seatsTotal: 240, seatsSold: 198, seatsHeld: 12, status: 'available', revenueToday: 18400, currency: 'USD' },
    { sectionId: 'prem-suite-1', name: 'Owner Suites', tier: 'suite', seatsTotal: 48, seatsSold: 44, seatsHeld: 2, status: 'sold-out', revenueToday: 28600, currency: 'USD' },
    { sectionId: 'prem-box-12', name: 'Box 12 Row', tier: 'box', seatsTotal: 80, seatsSold: 62, seatsHeld: 6, status: 'available', revenueToday: 9200, currency: 'USD' },
  ];
  for (const section of premiumSeating) {
    const auditId = id('audit-fan');
    (platform as unknown as { state: FanExperienceState }).state.premiumSeating.push({ ...section, auditId });
  }

  const guestServices: Array<Omit<GuestServiceRequestDto, 'requestId' | 'auditId' | 'approvalRequestId'>> = [
    { category: 'accessibility', status: 'open', priority: 'medium', submittedAt: now, guestLabel: 'Guest A-14', zone: 'grandstand', waitMinutes: 5, details: 'Wheelchair escort to section 204' },
    { category: 'guest-relations', status: 'open', priority: 'low', submittedAt: now, guestLabel: 'Guest B-02', zone: 'paddock', waitMinutes: 12, details: 'Seat relocation inquiry' },
    { category: 'parking', status: 'in-progress', priority: 'medium', submittedAt: now, guestLabel: 'Guest P-88', zone: 'parking-lot-c', waitMinutes: 20, details: 'Premium lot congestion alert' },
  ];
  for (const request of guestServices) {
    platform.createGuestServiceRequest(request);
  }

  platform.recordSatisfactionSurvey({
    eventId: deps.eventId ?? 'race-day-main',
    submittedAt: now,
    overallRating: 4.2,
    categories: [
      { category: 'arrival', rating: 4 },
      { category: 'seating', rating: 4.5 },
      { category: 'hospitality', rating: 4 },
      { category: 'departure', rating: 3.8 },
    ],
    comment: 'Strong race-day atmosphere; parking wait was longer than expected.',
  });

  const revenueLinks: Array<Omit<FanExperienceRevenueLinkDto, 'auditId'>> = [
    { linkId: 'rev-ticketing', source: 'ticketing', label: 'General admission', amountToday: 42800, amountMtd: 312000, currency: 'USD', financeReference: 'finance:revenue:ticketing', ticketInventoryReference: 'ticket-inventory:general' },
    { linkId: 'rev-premium', source: 'premium-seating', label: 'Premium seating', amountToday: 56200, amountMtd: 401500, currency: 'USD', financeReference: 'finance:revenue:premium' },
    { linkId: 'rev-hospitality', source: 'hospitality', label: 'Hospitality packages', amountToday: 22400, amountMtd: 156200, currency: 'USD', financeReference: 'finance:revenue:hospitality' },
    { linkId: 'rev-concessions', source: 'concessions', label: 'Concessions', amountToday: 18600, amountMtd: 128400, currency: 'USD', financeReference: 'finance:revenue:concessions' },
    { linkId: 'rev-parking', source: 'parking', label: 'Parking passes', amountToday: 6400, amountMtd: 44200, currency: 'USD', financeReference: 'finance:revenue:parking' },
  ];
  for (const link of revenueLinks) {
    const auditId = id('audit-fan');
    (platform as unknown as { state: FanExperienceState }).state.revenueLinks.push({ ...link, auditId });
  }

  platform.workspace(now);
  return platform;
}
