import type {
  SurfaceConditionHistoryEntryDto,
  SurfaceInspectionWorkflowDto,
  SurfaceIntelligenceAuditTrailDto,
  SurfaceIntelligenceKpiDashboardDto,
  SurfaceIntelligenceKpiDto,
  SurfaceIntelligenceMutationResultDto,
  SurfaceIntelligenceOperationsDto,
  SurfaceMaintenanceEventDto,
  SurfaceObservationDto,
  SurfaceReadinessIndicatorDto,
  SurfaceTrendAnalyticsDto,
} from '@trackmind/shared';
import { surfaceOperationalGuardrailStatement } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService } from './approvals.js';
import {
  buildSurfaceIntelligenceWorkspace,
  requestSurfaceOperationalAction,
  type MaintenanceRecord,
  type OperationalObservation,
  type SurfaceInspection,
  type SurfaceIntelligenceInput,
  type SurfaceOperationalActionType,
  type SurfaceTelemetryReading,
  type WeatherIntegration,
} from './trackSurface.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface SurfaceIntelligenceState {
  tenantId: string;
  racetrackId: string;
  trackId: string;
  telemetry: SurfaceTelemetryReading[];
  weather: WeatherIntegration;
  observations: SurfaceObservationDto[];
  maintenanceEvents: SurfaceMaintenanceEventDto[];
  inspectionWorkflows: SurfaceInspectionWorkflowDto[];
  conditionHistory: SurfaceConditionHistoryEntryDto[];
  pendingApprovalRequestIds: string[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface SurfaceIntelligenceDeps {
  approvalService?: CentralizedApprovalService;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
  trackId?: string;
  seedInput?: SurfaceIntelligenceInput;
}

export class SurfaceIntelligencePlatform {
  private state: SurfaceIntelligenceState;
  private readonly auditChain: SurfaceIntelligenceOperationsDto['auditTrail'] = [];

  constructor(private readonly deps: SurfaceIntelligenceDeps = {}) {
    const now = new Date().toISOString();
    const seed = deps.seedInput;
    this.state = {
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      trackId: deps.trackId ?? seed?.trackId ?? 'main-track',
      telemetry: seed?.telemetry ?? [],
      weather: seed?.weather ?? { observedAt: now, rainfallMm: 0, forecastRainMm: 0, temperature: 70, windMph: 0 },
      observations: [],
      maintenanceEvents: [],
      inspectionWorkflows: [],
      conditionHistory: [],
      pendingApprovalRequestIds: [],
      version: 1,
      updatedAt: now,
      updatedBy: 'surface-intelligence',
    };
    if (seed) this.hydrateFromSeed(seed, now);
  }

  workspace(now = new Date().toISOString()): SurfaceIntelligenceOperationsDto {
    const input = this.buildInput(now);
    const base = buildSurfaceIntelligenceWorkspace(input);
    this.recordConditionHistory(base, now);
    const trendAnalytics = this.buildTrendAnalytics();
    const readinessIndicators = this.buildReadinessIndicators(base, now);
    const dashboard = this.buildDashboard(base, now);
    return {
      schemaVersion: 'trackmind.surface-intelligence.v1',
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      trackId: base.trackId,
      generatedAt: base.generatedAt,
      overallScore: base.overallScore,
      readinessScore: dashboard.readinessScore,
      approvalState: base.approvalState,
      operationalActionsRequireHumanApproval: true,
      guardrails: {
        advisoryOnly: true,
        operationalActionsRequireHumanApproval: true,
        guardrailStatement: surfaceOperationalGuardrailStatement,
      },
      observations: this.state.observations.map(clone),
      conditionHistory: this.state.conditionHistory.map(clone),
      maintenanceEvents: this.state.maintenanceEvents.map(clone),
      inspectionWorkflows: this.state.inspectionWorkflows.map(clone),
      trendAnalytics,
      readinessIndicators,
      statusCards: base.statusCards,
      conditionScorecards: base.conditionScorecards,
      metricPanels: base.metricPanels,
      sectors: base.sectors,
      timeline: base.timeline,
      inspectionTimeline: base.inspectionTimeline,
      heatmap: base.heatmap,
      heatmapSectors: base.heatmapSectors,
      recommendations: base.recommendations,
      riskBadges: base.riskBadges,
      weatherObservation: base.weatherObservation,
      digitalTwinSync: base.digitalTwinSync,
      approvalActions: base.approvalActions,
      forecasts: base.forecasts,
      drainageAnalysis: base.drainageAnalysis,
      anomalies: base.anomalies,
      irrigationRecommendations: base.irrigationRecommendations,
      surfaceRiskAnalysis: base.surfaceRiskAnalysis,
      dashboard,
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  kpiDashboard(now = new Date().toISOString()): SurfaceIntelligenceKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(sectionId?: string, now = new Date().toISOString()): SurfaceIntelligenceAuditTrailDto {
    const records = sectionId
      ? this.auditChain.filter((record) => record.sectionId === sectionId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.surface-intelligence.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  recordObservation(input: Omit<SurfaceObservationDto, 'observationId' | 'auditId'>, actor = 'facilities-manager'): SurfaceIntelligenceMutationResultDto {
    const auditId = id('audit-surface');
    const observation: SurfaceObservationDto = { ...clone(input), observationId: id('surface-observation'), auditId };
    this.state.observations.push(observation);
    return this.commit('surface-intelligence.observation.recorded', `Recorded ${input.role} observation for ${input.sectionId}`, auditId, input.sectionId, actor);
  }

  recordInspection(input: {
    sectionId: string;
    inspectedAt: string;
    inspectorId: string;
    surfaceType: SurfaceInspection['surfaceType'];
    footingUniformity: number;
    divots: number;
    standingWater: boolean;
    railWear: number;
    findings: string[];
    workflowId?: string;
  }, actor = 'facilities-manager'): SurfaceIntelligenceMutationResultDto {
    const auditId = id('audit-surface');
    const inspectionId = id('surface-inspection');
    if (input.workflowId) {
      const workflow = this.state.inspectionWorkflows.find((entry) => entry.workflowId === input.workflowId);
      if (workflow) {
        workflow.status = input.standingWater || input.divots > 3 ? 'pending-approval' : 'complete';
        workflow.inspectedAt = input.inspectedAt;
        workflow.inspectorId = input.inspectorId;
        workflow.findings = [...input.findings];
        workflow.footingUniformity = input.footingUniformity;
        workflow.standingWater = input.standingWater;
        workflow.requiresFollowUp = input.standingWater || input.divots > 3 || input.railWear > 3;
        workflow.inspectionId = inspectionId;
      }
    }
    return this.commit('surface-intelligence.inspection.recorded', `Recorded inspection for ${input.sectionId}`, auditId, input.sectionId, actor);
  }

  openInspectionWorkflow(input: Omit<SurfaceInspectionWorkflowDto, 'workflowId' | 'auditId' | 'status' | 'requiresFollowUp'>, actor = 'facilities-manager'): SurfaceIntelligenceMutationResultDto {
    const auditId = id('audit-surface');
    const workflow: SurfaceInspectionWorkflowDto = {
      ...clone(input),
      workflowId: id('surface-inspection-workflow'),
      status: 'scheduled',
      requiresFollowUp: false,
      auditId,
    };
    this.state.inspectionWorkflows.push(workflow);
    return this.commit('surface-intelligence.inspection-workflow.opened', `Opened ${workflow.inspectionType} inspection workflow for ${workflow.sectionId}`, auditId, workflow.sectionId, actor);
  }

  recordMaintenance(input: Omit<SurfaceMaintenanceEventDto, 'eventId' | 'auditId'>, actor = 'facilities-manager'): SurfaceIntelligenceMutationResultDto {
    const auditId = id('audit-surface');
    const event: SurfaceMaintenanceEventDto = { ...clone(input), eventId: id('surface-maintenance'), auditId };
    this.state.maintenanceEvents.push(event);
    return this.commit('surface-intelligence.maintenance.recorded', `Recorded ${input.action} maintenance for ${input.sectionId}`, auditId, input.sectionId, actor);
  }

  requestOperationalAction(input: {
    action: SurfaceOperationalActionType;
    sectionId: string;
    reason: string;
    requestedBy?: string;
    payload?: Record<string, unknown>;
  }, actor = 'facilities-manager', now = new Date().toISOString()): SurfaceIntelligenceMutationResultDto {
    if (!this.deps.approvalService) throw new Error('Approval service integration required for surface operational actions');
    const draft = requestSurfaceOperationalAction({
      action: input.action,
      trackId: this.state.trackId,
      sectionId: input.sectionId,
      requestedBy: input.requestedBy ?? actor,
      reason: input.reason,
      payload: input.payload,
      requestedAt: now,
    });
    const approvalActionMap: Record<SurfaceOperationalActionType, string> = {
      irrigation: 'surface-irrigation',
      harrowing: 'surface-harrowing',
      rolling: 'surface-rolling',
      'track-closure-recommendation': 'surface-track-closure-recommendation',
      'surface-configuration-change': 'safety-critical-control',
    };
    const approval = this.deps.approvalService.createRequest({
      action: approvalActionMap[input.action] as Parameters<CentralizedApprovalService['createRequest']>[0]['action'],
      target: `${this.state.trackId}:${input.sectionId}`,
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      requestedBy: input.requestedBy ?? actor,
      actorType: 'human',
      reason: input.reason,
      evidence: ['surface-operational-action', draft.event.id, draft.auditRecord.id],
    });
    this.state.pendingApprovalRequestIds.push(approval.id);
    const auditId = id('audit-surface');
    const result = this.commit('surface-intelligence.operational-action.requested', `Requested approval for ${input.action} on ${input.sectionId}`, auditId, input.sectionId, actor, approval.id);
    return { ...result, approvalRequestId: approval.id };
  }

  private hydrateFromSeed(seed: SurfaceIntelligenceInput, now: string): void {
    for (const observation of seed.observations) {
      this.state.observations.push({
        observationId: observation.id,
        sectionId: observation.sectionId,
        observedAt: observation.observedAt,
        observerId: observation.role,
        role: observation.role,
        severity: observation.severity,
        note: observation.note,
        evidence: [`seed:${observation.id}`],
        auditId: id('audit-surface-seed'),
      });
    }
    for (const record of seed.maintenanceRecords) {
      this.state.maintenanceEvents.push({
        eventId: record.id,
        sectionId: record.sectionId,
        completedAt: record.completedAt,
        action: record.action,
        effectiveness: record.effectiveness,
        notes: record.notes,
        performedBy: 'maintenance-crew',
        evidence: [`seed:${record.id}`],
        auditId: id('audit-surface-seed'),
      });
    }
    for (const inspection of seed.inspections) {
      this.state.inspectionWorkflows.push({
        workflowId: id('surface-inspection-workflow'),
        sectionId: inspection.sectionId,
        inspectionType: inspection.standingWater ? 'incident-follow-up' : 'routine',
        status: inspection.standingWater ? 'pending-approval' : 'complete',
        scheduledAt: inspection.inspectedAt,
        inspectedAt: inspection.inspectedAt,
        inspectorId: inspection.inspector,
        findings: inspection.observations,
        footingUniformity: inspection.footingUniformity,
        standingWater: inspection.standingWater,
        requiresFollowUp: inspection.standingWater || inspection.divots > 3,
        inspectionId: inspection.id,
        auditId: id('audit-surface-seed'),
      });
    }
    this.state.updatedAt = now;
  }

  private buildInput(now: string): SurfaceIntelligenceInput {
    const observations: OperationalObservation[] = this.state.observations.map((observation) => ({
      id: observation.observationId,
      sectionId: observation.sectionId,
      observedAt: observation.observedAt,
      role: observation.role === 'facilities-manager' ? 'maintenance' : observation.role,
      severity: observation.severity,
      note: observation.note,
    }));
    const maintenanceRecords: MaintenanceRecord[] = this.state.maintenanceEvents.map((event) => ({
      id: event.eventId,
      sectionId: event.sectionId,
      completedAt: event.completedAt,
      action: event.action,
      effectiveness: event.effectiveness,
      notes: event.notes,
    }));
    const inspections: SurfaceInspection[] = this.state.inspectionWorkflows
      .filter((workflow) => workflow.inspectedAt && workflow.inspectorId)
      .map((workflow) => ({
        id: workflow.inspectionId ?? workflow.workflowId,
        sectionId: workflow.sectionId,
        inspectedAt: workflow.inspectedAt!,
        inspector: workflow.inspectorId!,
        surfaceType: this.state.telemetry.find((reading) => reading.sectionId === workflow.sectionId)?.surfaceType ?? 'dirt',
        footingUniformity: workflow.footingUniformity ?? 80,
        divots: workflow.requiresFollowUp ? 4 : 1,
        standingWater: workflow.standingWater ?? false,
        railWear: workflow.requiresFollowUp ? 3 : 1,
        observations: workflow.findings,
      }));
    return {
      trackId: this.state.trackId,
      generatedAt: now,
      telemetry: this.state.telemetry.map(clone),
      inspections,
      weather: { ...this.state.weather, observedAt: now },
      maintenanceRecords,
      observations,
    };
  }

  private recordConditionHistory(base: ReturnType<typeof buildSurfaceIntelligenceWorkspace>, now: string): void {
    for (const sector of base.sectors) {
      const existing = this.state.conditionHistory.find((entry) => entry.sectionId === sector.id && entry.recordedAt === now);
      if (existing) continue;
      const auditId = id('audit-surface-history');
      this.state.conditionHistory.push({
        historyId: id('surface-condition-history'),
        sectionId: sector.id,
        recordedAt: now,
        conditionScore: sector.conditionScore,
        safetyScore: sector.safetyScore,
        consistencyScore: sector.consistencyScore,
        moisture: sector.moisture,
        compaction: sector.compaction,
        cushionDepth: sector.cushionDepth,
        drainageRate: sector.drainageRate,
        riskLevel: String(sector.riskLevel),
        auditId,
      });
    }
    if (this.state.conditionHistory.length > 120) {
      this.state.conditionHistory = this.state.conditionHistory.slice(-120);
    }
  }

  private buildTrendAnalytics(): SurfaceTrendAnalyticsDto[] {
    const sectionIds = [...new Set(this.state.conditionHistory.map((entry) => entry.sectionId))];
    return sectionIds.flatMap((sectionId) => {
      const history = this.state.conditionHistory.filter((entry) => entry.sectionId === sectionId).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      return (['condition-score', 'moisture', 'compaction', 'drainage-rate'] as const).map((metric) => {
        const points = history.map((entry) => ({
          at: entry.recordedAt,
          value: metric === 'condition-score' ? entry.conditionScore : metric === 'moisture' ? entry.moisture : metric === 'compaction' ? entry.compaction : entry.drainageRate,
        }));
        const trend = points.length < 2 ? 'insufficient-history' as const : points.at(-1)!.value > points[0]!.value + 2 ? 'up' as const : points.at(-1)!.value < points[0]!.value - 2 ? 'down' as const : 'flat' as const;
        return {
          sectionId,
          metric,
          trend,
          points,
          summary: trend === 'insufficient-history' ? 'Insufficient history for trend analysis' : `${metric} trending ${trend} across ${points.length} snapshots`,
        };
      });
    });
  }

  private buildReadinessIndicators(base: ReturnType<typeof buildSurfaceIntelligenceWorkspace>, now: string): SurfaceReadinessIndicatorDto[] {
    const openWorkflows = this.state.inspectionWorkflows.filter((workflow) => !['complete', 'deferred'].includes(workflow.status)).length;
    const maintenanceToday = this.state.maintenanceEvents.filter((event) => event.completedAt.startsWith(now.slice(0, 10))).length;
    const anomalyCount = base.anomalies?.length ?? 0;
    const pendingApprovals = this.state.pendingApprovalRequestIds.length + (base.recommendations?.length ?? 0);
    return [
      indicator('overall-score', base.overallScore >= 85 ? 'ready' : base.overallScore >= 70 ? 'watch' : 'blocked', String(base.overallScore), 'Composite surface readiness score from telemetry, inspections, and maintenance.', base.overallScore < 70 ? ['surface score below race-ready threshold'] : []),
      indicator('inspection-coverage', openWorkflows ? 'watch' : 'ready', `${openWorkflows} open`, 'Open surface inspection workflows awaiting completion or approval.', openWorkflows ? ['inspection workflows open'] : []),
      indicator('maintenance-recency', maintenanceToday ? 'ready' : 'watch', `${maintenanceToday} today`, 'Maintenance events recorded for current race day.', maintenanceToday ? [] : ['no maintenance events recorded today']),
      indicator('anomaly-pressure', anomalyCount ? 'watch' : 'ready', `${anomalyCount} active`, 'Detected surface anomalies from normalized telemetry.', anomalyCount ? ['surface anomalies detected'] : []),
      indicator('approval-queue', pendingApprovals ? 'watch' : 'ready', `${pendingApprovals} pending`, 'Approval-gated surface operational recommendations and requests.', pendingApprovals ? ['pending surface approvals'] : []),
    ];
  }

  private buildDashboard(base: ReturnType<typeof buildSurfaceIntelligenceWorkspace>, now: string): SurfaceIntelligenceKpiDashboardDto {
    const openInspectionWorkflows = this.state.inspectionWorkflows.filter((workflow) => !['complete', 'deferred'].includes(workflow.status)).length;
    const maintenanceEventsToday = this.state.maintenanceEvents.filter((event) => event.completedAt.startsWith(now.slice(0, 10))).length;
    const activeAnomalies = base.anomalies?.length ?? 0;
    const pendingApprovals = this.state.pendingApprovalRequestIds.length;
    const readinessScore = Math.max(0, Math.min(100, Math.round(base.overallScore - openInspectionWorkflows * 4 - activeAnomalies * 3 - pendingApprovals * 2)));
    const panels: SurfaceIntelligenceKpiDto[] = [
      kpi('surface-kpi-score', 'Surface condition score', 'Composite surface intelligence score across all track sectors.', base.overallScore, 'score', 90, base.overallScore >= 85 ? 'nominal' : base.overallScore >= 70 ? 'watch' : 'warning', [{ entityType: 'surface-intelligence', entityId: this.state.racetrackId }], []),
      kpi('surface-kpi-inspections', 'Open inspection workflows', 'Surface inspection workflows awaiting completion or approval.', openInspectionWorkflows, 'workflows', 0, openInspectionWorkflows > 0 ? 'watch' : 'nominal', [{ entityType: 'track-sector', entityId: 'far-turn' }], []),
      kpi('surface-kpi-maintenance', 'Maintenance events today', 'Recorded maintenance events for the current race day.', maintenanceEventsToday, 'events', 1, maintenanceEventsToday > 0 ? 'nominal' : 'watch', [{ entityType: 'surface-intelligence', entityId: this.state.racetrackId }], []),
      kpi('surface-kpi-anomalies', 'Active anomalies', 'Telemetry anomalies requiring superintendent review.', activeAnomalies, 'anomalies', 0, activeAnomalies > 0 ? 'warning' : 'nominal', [{ entityType: 'track-sector', entityId: 'far-turn' }], []),
      kpi('surface-kpi-approvals', 'Pending approvals', 'Approval-gated surface operational actions awaiting human authorization.', pendingApprovals, 'approvals', 0, pendingApprovals > 0 ? 'watch' : 'nominal', [{ entityType: 'approval', entityId: 'surface-operations' }], []),
    ];
    return { overallScore: base.overallScore, openInspectionWorkflows, maintenanceEventsToday, activeAnomalies, pendingApprovals, readinessScore, panels };
  }

  private commit(eventType: string, message: string, auditId: string, sectionId: string | undefined, actor: string, approvalRequestId?: string): SurfaceIntelligenceMutationResultDto {
    this.state.version += 1;
    this.state.updatedAt = new Date().toISOString();
    this.state.updatedBy = actor;
    const recordedAuditId = this.recordChange(actor, eventType, message, auditId, sectionId, approvalRequestId);
    return {
      accepted: true,
      sectionId,
      auditId: recordedAuditId,
      eventType,
      message: `${message}. Operational actions remain approval-gated.`,
      approvalRequestId,
      mock: false,
    };
  }

  private recordChange(actor: string, action: string, changeSummary: string, auditId = id('audit-surface'), sectionId?: string, approvalRequestId?: string): string {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const record = {
      auditId,
      sectionId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ auditId, action, changeSummary, previousHash, approvalRequestId }),
      changeSummary,
      evidence: approvalRequestId ? [`approval:${approvalRequestId}`] : [],
    };
    this.auditChain.push(record);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: sectionId ?? this.state.trackId,
        payload: { action, changeSummary, approvalRequestId },
        tenantId: this.state.tenantId,
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return auditId;
  }
}

function kpi(
  kpiId: string,
  name: string,
  description: string,
  value: number,
  unit: string,
  target: number,
  status: SurfaceIntelligenceKpiDto['status'],
  sourceEntities: SurfaceIntelligenceKpiDto['sourceEntities'],
  auditIds: string[],
): SurfaceIntelligenceKpiDto {
  return {
    kpiId,
    name,
    description,
    value,
    unit,
    target,
    status,
    trend: 'insufficient-history',
    sourceEntities,
    auditReference: { auditIds: [...auditIds], eventIds: [] },
  };
}

function indicator(
  indicatorName: SurfaceReadinessIndicatorDto['indicator'],
  status: SurfaceReadinessIndicatorDto['status'],
  value: string,
  detail: string,
  blockers: string[],
): SurfaceReadinessIndicatorDto {
  return { indicator: indicatorName, status, value, detail, blockers };
}

export function createSurfaceFacadeInput(timestamp: string): SurfaceIntelligenceInput {
  return {
    trackId: 'main-track',
    generatedAt: timestamp,
    telemetry: [
      { id: 'surface-live-1', sectionId: 'far-turn', surfaceType: 'dirt', latitude: 38.049, longitude: -76.944, moisture: 27, compaction: 276, drainageRate: 6, cushionDepth: 2.8, temperature: 83, rainfall: 3, observedAt: timestamp },
      { id: 'surface-live-2', sectionId: 'backstretch', surfaceType: 'dirt', latitude: 38.041, longitude: -76.958, moisture: 14, compaction: 205, drainageRate: 11, cushionDepth: 3.7, temperature: 82, rainfall: 1, observedAt: timestamp },
      { id: 'surface-live-3', sectionId: 'stretch', surfaceType: 'synthetic', latitude: 38.044, longitude: -76.949, moisture: 12, compaction: 212, drainageRate: 13, cushionDepth: 3.1, temperature: 80, rainfall: 1, observedAt: timestamp },
    ],
    inspections: [{ id: 'surface-inspection-live-1', sectionId: 'far-turn', inspectedAt: timestamp, inspector: 'facilities-manager', surfaceType: 'dirt', footingUniformity: 72, divots: 4, standingWater: true, railWear: 3, observations: ['standing water near inside lane'] }],
    weather: { observedAt: timestamp, rainfallMm: 5, forecastRainMm: 14, temperature: 83, windMph: 12 },
    maintenanceRecords: [
      { id: 'surface-maint-live-1', sectionId: 'far-turn', completedAt: timestamp, action: 'harrow', effectiveness: 6, notes: 'partial improvement before additional drainage review' },
      { id: 'surface-maint-live-2', sectionId: 'backstretch', completedAt: timestamp, action: 'water', effectiveness: 8, notes: 'routine moisture adjustment' },
    ],
    observations: [{ id: 'surface-observation-live-1', sectionId: 'far-turn', observedAt: timestamp, role: 'jockey', severity: 4, note: 'uneven footing on turn' }],
  };
}

export function createSeededSurfaceIntelligence(deps: SurfaceIntelligenceDeps, now = new Date().toISOString()): SurfaceIntelligencePlatform {
  const seedInput = deps.seedInput ?? createSurfaceFacadeInput(now);
  const platform = new SurfaceIntelligencePlatform({ ...deps, seedInput });
  platform.workspace(now);
  platform.openInspectionWorkflow({
    sectionId: 'stretch',
    inspectionType: 'pre-race',
    scheduledAt: now,
    findings: [],
  });
  return platform;
}
