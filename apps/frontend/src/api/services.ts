import { normalizeApprovalStatus, type CanonicalApprovalEscalation, type CanonicalApprovalStep } from '@trackmind/shared';
import type {
  AIGovernanceWorkspaceDto,
  AIControlPlanePolicyDto,
  AIControlPlaneRecommendationDto,
  AIConfidenceScoreDto,
  AIRecommendationDto,
  ApprovalDto,
  AuditEventDto,
  ComplianceControlLibraryDto,
  EquineIntelligenceDto,
  EmergencyOperationsDto,
  FederationWorkspaceDto,
  FinanceTicketingWorkspaceDto,
  FacilitiesMaintenanceWorkspaceDto,
  KPIWorkspaceDto,
  OperationsCommandCenterDto,
  PlatformHealthWorkspaceDto,
  RaceDayReadinessDashboardDto,
  RaceOfficeWorkspaceDto,
  RaceDto,
  RacingDataWorkspaceDto,
  SecurityOperationsDto,
  SurfaceIntelligenceDto,
  TrackMapDto,
  BarnOperationsDto,
} from '@trackmind/shared';
import { getJson, type AdapterResult } from './client';
import { apiPaths } from './paths';
import { countMetric, textMetric, type AdvisoryAIRecommendation, type WorkspaceCardAction, type WorkspacePanel, type WorkspaceViewModel } from '../domain/workspaceModel';
import { routeById } from '../routes/routes';
import type { DomainRouteId } from '../domain/support';

type UnknownRecord = Record<string, unknown>;
type AIApprovalRequirement = AIRecommendationDto['approvalRequirement'];
type AIAuditReference = AIRecommendationDto['auditReference'];
type AIRiskLevel = AIRecommendationDto['riskLevel'];

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const dashboardDrillDownRouteMap: Record<string, string> = {
  '/race-office': '/race-day',
  '/surface': '/race-day',
  '/emergency': '/incidents',
  '/operations': '/dashboard',
  '/platform-health': '/admin',
  '/starting-gate': '/race-day',
  '/workforce': '/facilities',
};
const commandCenterLineageDomains: Record<string, string[]> = {
  'race-office': ['readiness'],
  surface: ['surface-weather'],
  weather: ['surface-weather'],
  security: ['security-incidents'],
  approvals: ['approvals'],
  stewards: ['stewards'],
  assets: ['assets'],
  workforce: ['workforce'],
  emergency: ['emergency'],
  facilities: ['facilities'],
  'ai-governance': ['ai'],
  audit: ['audit'],
  platform: ['events'],
};
const routeKpiDomains: Record<DomainRouteId, string[]> = {
  dashboard: ['race-day-operations', 'system-health', 'approval-workflows', 'ai-governance'],
  raceDay: ['race-day-operations', 'approval-workflows'],
  equine: ['equine-welfare', 'veterinary-privacy'],
  approvals: ['approval-workflows'],
  incidents: ['safety-incidents'],
  compliance: ['compliance', 'audit-integrity', 'deployment-readiness'],
  security: ['security', 'safety-incidents'],
  facilities: ['facilities'],
  ticketing: ['ticketing', 'fan-experience'],
  finance: ['finance'],
  federation: ['multi-track-federation'],
  dataHub: ['racing-data-hub', 'data-quality'],
  audit: ['audit-integrity', 'approval-workflows'],
  admin: ['tenant-operations', 'system-health', 'deployment-readiness'],
  settings: ['ai-governance', 'data-quality'],
};

function localApprovalDto(input: {
  id: string;
  action: string;
  target: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  evidence: string[];
  workflowId?: string;
  requiredRoles: string[];
  affectedAssets?: string[];
}): ApprovalDto {
  const canonicalStatus = normalizeApprovalStatus(input.status);
  const approvalSteps: CanonicalApprovalStep[] = [{
    id: `${input.id}-step`,
    approverRoles: input.requiredRoles as CanonicalApprovalStep['approverRoles'],
    minimumApprovals: 1,
    evidenceRequired: ['human-approval-record', 'reason'],
    status: canonicalStatus,
    decisions: [],
  }];
  const escalation: CanonicalApprovalEscalation[] = [{ afterMinutes: 30, approverRoles: input.requiredRoles as CanonicalApprovalEscalation['approverRoles'], reason: `${input.action} approval SLA pending` }];
  return {
    id: input.id,
    approvalRequestId: input.id,
    action: input.action,
    target: input.target,
    requestedBy: input.requestedBy,
    status: canonicalStatus,
    canonicalStatus,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    evidence: input.evidence,
    mock: false,
    workflowId: input.workflowId,
    approverRoles: input.requiredRoles,
    requiredRoles: input.requiredRoles,
    approvalSteps,
    escalation,
    auditLinkage: { auditIds: [], eventIds: [], workflowInstanceId: input.workflowId, correlationId: input.id },
    auditIds: [],
    eventIds: [],
    affectedAssets: input.affectedAssets,
  };
}

function requireReady<T>(result: AdapterResult<T>, label: string): T {
  if (result.status === 'error') throw new Error(`${label} adapter failed: ${result.message ?? 'unknown error'}`);
  if (result.data === undefined) throw new Error(`${label} adapter returned no data.`);
  return result.data;
}

function frontendPathForBackendDrilldown(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    const url = new URL(path, 'https://trackmind.local');
    const pathname = url.pathname;
    const currentRoute = Object.values(routeById).find((route) => route.path === pathname);
    return currentRoute?.path ?? dashboardDrillDownRouteMap[pathname];
  } catch {
    return undefined;
  }
}

function actionForBackendDrilldown(input: { title: string; drillDownPath?: string }): WorkspaceCardAction | undefined {
  const path = frontendPathForBackendDrilldown(input.drillDownPath);
  if (!path) return undefined;
  const route = Object.values(routeById).find((item) => item.path === path);
  const routeLabel = route?.label ?? 'workspace';
  return {
    label: `View ${routeLabel}`,
    path,
    detail: input.drillDownPath && input.drillDownPath !== path
      ? `${input.title} is surfaced through ${routeLabel}.`
      : `Open ${routeLabel} for ${input.title}.`,
  };
}

function aiCardsFromGovernance(workspace?: AIGovernanceWorkspaceDto): AdvisoryAIRecommendation[] {
  if (!workspace) return [];
  return [
    ...(Array.isArray(workspace.recommendationQueue) ? workspace.recommendationQueue : []),
    ...(Array.isArray(workspace.safetyBlockedActions) ? workspace.safetyBlockedActions : []),
  ].filter(isUnknownRecord).map((item) => {
    const itemId = textValue(item.id, 'ai-governance-record');
    const recommendationId = textValue(item.recommendationId, itemId);
    const confidence = normalizeConfidence(item.confidence);
    const approvalRequirement = normalizeApprovalRequirement(item.approvalRequirement);
    const auditReference = normalizeAuditReference(item.auditReference);
    const eventIds = Array.isArray(auditReference.eventIds) ? auditReference.eventIds : [];
    const auditIds = Array.isArray(auditReference.auditIds) ? auditReference.auditIds : [];
    const digitalTwinRefs = Array.isArray(auditReference.digitalTwinRefs) ? auditReference.digitalTwinRefs : [];
    return {
      id: itemId,
      recommendationId,
      recommendation: textValue(item.recommendation, 'AI recommendation text unavailable.'),
      confidence,
      confidenceValue: numberValue(confidence.calibrated, Number.NaN),
      evidence: stringArray(item.evidence),
      evidencePackage: item.evidencePackage,
      modelVersion: textValue(item.modelVersion, 'model unavailable'),
      generatedAt: textValue(item.generatedAt, 'generated time unavailable'),
      approvalRequirement,
      auditReference,
      requiresApproval: approvalRequirement.required !== false,
      eventId: textValue(eventIds[0], 'event unavailable'),
      auditId: textValue(auditIds[0], 'audit unavailable'),
      digitalTwinRefs: stringArray(digitalTwinRefs),
      riskLevel: normalizeRiskLevel(item.riskLevel),
      advisoryOnly: true,
      executionAllowed: false,
      blockedAutonomousExecution: true,
      governorAllowed: false,
      governorReason: 'Governance queue entries are advisory and require human review before protected action.',
      status: 'status' in item ? item.status : 'advisory',
      mock: false,
    };
  });
}

function aiCardsFromControlPlane(recommendations?: AIControlPlaneRecommendationDto[]): AdvisoryAIRecommendation[] {
  return (Array.isArray(recommendations) ? recommendations : []).filter(isUnknownRecord).map((item) => {
    const itemId = textValue(item.id, 'ai-control-plane-record');
    const recommendationId = textValue(item.recommendationId, itemId);
    const confidence = normalizeConfidence(item.confidence);
    const approvalRequirement = normalizeApprovalRequirement(item.approvalRequirement);
    const auditReference = normalizeAuditReference(item.auditReference);
    const governorDecision = isUnknownRecord(item.governorDecision) ? item.governorDecision : { allowed: false, reason: 'Governor decision unavailable.' };
    const eventIds = Array.isArray(auditReference.eventIds) ? auditReference.eventIds : [];
    const auditIds = Array.isArray(auditReference.auditIds) ? auditReference.auditIds : [];
    const digitalTwinRefs = Array.isArray(auditReference.digitalTwinRefs) ? auditReference.digitalTwinRefs : [];
    return {
      id: itemId,
      recommendationId,
      recommendation: textValue(item.recommendation, 'AI recommendation text unavailable.'),
      confidence,
      confidenceValue: numberValue(confidence.calibrated, Number.NaN),
      evidence: stringArray(item.evidence),
      evidencePackage: item.evidencePackage,
      modelVersion: textValue(item.modelVersion, 'model unavailable'),
      generatedAt: textValue(item.generatedAt, 'generated time unavailable'),
      approvalRequirement,
      auditReference,
      requiresApproval: approvalRequirement.required !== false,
      eventId: textValue(eventIds[0], 'event unavailable'),
      auditId: textValue(auditIds[0], 'audit unavailable'),
      digitalTwinRefs: stringArray(digitalTwinRefs),
      riskLevel: normalizeRiskLevel(isUnknownRecord(item.risk) ? item.risk.level : item.riskLevel),
      advisoryOnly: true,
      executionAllowed: false,
      blockedAutonomousExecution: true,
      governorAllowed: governorDecision.allowed === true,
      governorReason: textValue(governorDecision.reason, 'Governor decision unavailable.'),
      actionLabel: textValue(item.action, 'action unavailable'),
      target: textValue(item.target, 'target unavailable'),
      status: textValue(item.status, 'advisory'),
      confidenceBand: textValue(confidence.band, 'unknown'),
      mock: item.mock === true,
    };
  });
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function normalizeConfidence(value: unknown): AIConfidenceScoreDto {
  const record = isUnknownRecord(value) ? value : {};
  const raw = numberValue(record.raw, Number.NaN);
  const calibrated = numberValue(record.calibrated, Number.NaN);
  const band = record.band === 'low' || record.band === 'medium' || record.band === 'high' ? record.band : 'low';
  return { raw, calibrated, band, drivers: stringArray(record.drivers) };
}

function normalizeApprovalRequirement(value: unknown): AIApprovalRequirement {
  const record = isUnknownRecord(value) ? value : {};
  return {
    required: record.required !== false,
    policy: textValue(record.policy, 'Approval state unavailable'),
    requiredApproverRoles: stringArray(record.requiredApproverRoles),
    requirementId: stringValue(record.requirementId),
    workflowId: stringValue(record.workflowId),
  };
}

function normalizeAuditReference(value: unknown): AIAuditReference {
  const record = isUnknownRecord(value) ? value : {};
  return {
    auditIds: stringArray(record.auditIds),
    eventIds: stringArray(record.eventIds),
    digitalTwinRefs: stringArray(record.digitalTwinRefs),
    approvalReference: stringValue(record.approvalReference),
    correlationId: stringValue(record.correlationId),
    integrityRef: stringValue(record.integrityRef),
  };
}

function normalizeRiskLevel(value: unknown): AIRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : 'medium';
}

function vm(routeId: DomainRouteId, source: WorkspaceViewModel['source'], partial: Omit<WorkspaceViewModel, 'route' | 'source'>): WorkspaceViewModel {
  const domains = new Set(routeKpiDomains[routeId]);
  const allKpis = Array.isArray(partial.kpis) ? partial.kpis.filter(isUnknownRecord) : [];
  const allModelContext = Array.isArray(partial.modelReadableKpiContext) ? partial.modelReadableKpiContext.filter(isUnknownRecord) : [];
  const kpis = allKpis.filter((kpi) => typeof kpi.domain === 'string' && domains.has(kpi.domain));
  const visibleKpiIds = new Set(kpis.map((kpi) => kpi.kpiId));
  return {
    route: routeById[routeId],
    source,
    ...partial,
    kpis,
    modelReadableKpiContext: allModelContext.filter((context) => visibleKpiIds.has(context.kpiId)),
  };
}

async function commonContext() {
  const [approvals, audit, controlPlaneRecommendations, ai, kpiWorkspace] = await Promise.all([
    getJson<ApprovalDto[]>(apiPaths.approvals.list),
    getJson<AuditEventDto[]>(apiPaths.audit.events),
    getJson<AIControlPlaneRecommendationDto[]>(apiPaths.dashboard.aiControlPlaneRecommendations),
    getJson<AIGovernanceWorkspaceDto>(apiPaths.dashboard.aiGovernanceWorkspace),
    getJson<KPIWorkspaceDto>(apiPaths.kpis.workspace),
  ]);
  const approvalsData = Array.isArray(approvals.data) ? approvals.data : [];
  const auditData = Array.isArray(audit.data) ? audit.data : [];
  const controlPlaneData = Array.isArray(controlPlaneRecommendations.data) ? controlPlaneRecommendations.data : [];
  const aiData = ai.data;
  const kpiData = kpiWorkspace.data;
  const governedCards = aiCardsFromControlPlane(controlPlaneData);
  return {
    approvals: approvalsData,
    auditEvents: auditData,
    aiRecommendations: governedCards.length > 0 ? governedCards : aiCardsFromGovernance(aiData),
    kpis: Array.isArray(kpiData?.kpis) ? kpiData.kpis.filter(isUnknownRecord) : [],
    modelReadableKpiContext: Array.isArray(kpiData?.modelReadableContext) ? kpiData.modelReadableContext.filter(isUnknownRecord) : [],
  };
}

const dashboardService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [operations, health, context] = await Promise.all([
      getJson<OperationsCommandCenterDto>(apiPaths.dashboard.operations),
      getJson<PlatformHealthWorkspaceDto>(apiPaths.dashboard.platformHealth),
      commonContext(),
    ]);
    const operationsData = requireReady(operations, 'Operations command center');
    const healthData = health.status === 'ready' && health.data ? health.data : {
      generatedAt: operationsData.generatedAt,
      overallStatus: 'degraded',
    } as PlatformHealthWorkspaceDto;
    const widgets = Array.isArray(operationsData.widgets) ? operationsData.widgets : [];
    const activeLayout = Array.isArray(operationsData.savedLayouts) ? operationsData.savedLayouts.find((layout) => layout.id === operationsData.activeLayoutId) : undefined;
    const activeWidgetIds = new Set(activeLayout?.widgetIds ?? widgets.map((widget) => widget.id));
    const visibleWidgets = widgets.filter((widget) => activeWidgetIds.has(widget.id));
    const lineage = Array.isArray(operationsData.dataLineage) ? operationsData.dataLineage : [];
    const alerts = Array.isArray(operationsData.alerts) ? operationsData.alerts : [];
    const liveEvents = Array.isArray(operationsData.liveEvents) ? operationsData.liveEvents : [];
    return vm('dashboard', operations.source, {
      generatedAt: operationsData.generatedAt ?? healthData.generatedAt,
      metrics: [
        countMetric('Rendered command cards', visibleWidgets.length, 'Rendered command card snapshots from the active layout'),
        textMetric('Service status', healthData.overallStatus, 'Reference health metadata from /platform/health; not deployed infrastructure evidence', healthData.overallStatus === 'critical' ? 'critical' : healthData.overallStatus === 'degraded' ? 'warning' : 'nominal'),
        countMetric('Approval records', context.approvals.length, 'Seeded approval contract records from /approvals/requests', context.approvals.length ? 'warning' : 'nominal'),
      ],
      panels: [
        ...visibleWidgets.map((widget) => {
        const path = frontendPathForBackendDrilldown(widget.drillDownPath);
        const action = actionForBackendDrilldown(widget);
        const lineageDomains = commandCenterLineageDomains[widget.domain] ?? [widget.domain];
        const widgetLineage = lineage.filter((entry) => lineageDomains.includes(entry.domain)).map((entry) => entry.reference);
        return {
          id: widget.id,
          title: widget.title,
          body: widget.detail,
          status: 'facade-only' as const,
          evidence: [widget.source, apiPaths.dashboard.operations, ...widgetLineage, path ? `frontend:${path}` : 'frontend:unmapped-drilldown'],
          actions: action ? [action] : [],
        };
        }),
        ...alerts.slice(0, 2).map((alert) => {
          const path = frontendPathForBackendDrilldown(alert.actionPath);
          const route = path ? Object.values(routeById).find((item) => item.path === path) : undefined;
          return { id: `supplemental-${alert.id}`, title: `Supplemental alert snapshot: ${alert.title}`, body: `${alert.severity} alert metadata; acknowledgement state is reported only (${String(alert.acknowledged)}).`, status: 'facade-only' as const, evidence: alert.evidence, actions: path ? [{ label: `View ${route?.label ?? 'alert workspace'}`, path, detail: 'Review the workspace referenced by this supplemental alert snapshot.' }] : [] };
        }),
        ...liveEvents.slice(0, 2).map((event) => ({ id: `supplemental-${event.id}`, title: `Supplemental event snapshot: ${event.summary}`, body: `${event.severity} static command-center event metadata from ${event.source}; no streaming subscription is active in this card.`, status: 'facade-only' as const, evidence: [event.type, event.domain] })),
      ],
      ...context,
    });
  },
};

const raceDayService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [races, raceOffice, readiness, surface, trackConfiguration, context] = await Promise.all([
      getJson<RaceDto[]>(apiPaths.raceDay.races),
      getJson<RaceOfficeWorkspaceDto>(apiPaths.raceDay.raceOffice),
      getJson<RaceDayReadinessDashboardDto>(apiPaths.raceDay.readiness),
      getJson<SurfaceIntelligenceDto>(apiPaths.raceDay.surface),
      getJson<TrackMapDto>(apiPaths.raceDay.trackConfiguration),
      commonContext(),
    ]);
    const raceRows = requireReady(races, 'Race summaries');
    const raceOfficeData = requireReady(raceOffice, 'Race office workspace');
    const readinessData = requireReady(readiness, 'Race-day readiness dashboard');
    const surfaceData = requireReady(surface, 'Surface intelligence workspace');
    const trackData = requireReady(trackConfiguration, 'Track configuration map');
    const approvalControls = raceOfficeData.approvalControls;
    const racePanels: WorkspacePanel[] = readinessData.races.map((race) => ({
      id: race.raceId,
      title: `Race ${race.raceId}`,
      body: `${race.status} readiness at ${race.score} with ${race.warnings} warning(s) and ${race.approvals} approval requirement(s).`,
      status: 'facade-only',
      evidence: ['RaceDayReadinessDashboardDto', '/api/v1/race-day-readiness/dashboard'],
    }));
    const warningPanels: WorkspacePanel[] = readinessData.warnings.slice(0, 3).map((warning) => ({
      id: warning.id,
      title: `${warning.domain} readiness warning`,
      body: `${warning.severity}: ${warning.message}. Recommended action: ${warning.recommendedAction}.`,
      status: 'facade-only',
      evidence: warning.evidence,
    }));
    const controlPanels: WorkspacePanel[] = approvalControls.slice(0, 2).map((control) => ({
      id: control.id,
      title: `Locked control: ${control.action}`,
      body: `${control.action} targets ${control.target}; service-owned approval workflow metadata only. No frontend request submission or protected execution control is exposed.`,
      status: 'facade-only',
      evidence: control.evidence,
    }));
    const surfacePanels: WorkspacePanel[] = surfaceData.conditionScorecards.slice(0, 2).map((scorecard) => ({
      id: scorecard.id,
      title: scorecard.label,
      body: `${scorecard.status} surface sector scored ${scorecard.score}; drivers ${scorecard.drivers.join(', ') || 'none'}.`,
      status: 'facade-only',
      evidence: ['SurfaceIntelligenceDto', scorecard.id],
      actions: [
        { label: 'View approval context', path: '/approvals', detail: 'Review general approval records; this link does not filter by surface.' },
        { label: 'View audit context note', path: `/audit?surface=${encodeURIComponent(scorecard.id)}`, detail: 'Review audit workspace with a surface context note; records are not filtered by this link.' },
      ],
    }));
    const trackPanels: WorkspacePanel[] = [{
      id: 'track-configuration-map',
      title: 'Track configuration map',
      body: `Starting gate ${trackData.startingGate.sectorId} at ${trackData.startingGate.metersFromStart}m; ${trackData.trackConfiguration?.workOrders.length ?? 0} gate/configuration work package(s) in the read model; no live actuator control.`,
      status: 'facade-only',
      evidence: ['TrackMapDto', '/api/v1/track-configuration/map'],
      actions: [
        { label: 'View approval context', path: '/approvals', detail: 'Review general approval records; this link does not filter by track configuration.' },
        { label: 'View audit context note', path: '/audit?trackConfiguration=map', detail: 'Review audit workspace with a track configuration context note; records are not filtered by this link.' },
      ],
    }];
    return vm('raceDay', races.source, {
      generatedAt: readinessData.generatedAt || raceOfficeData.cards[0]?.updatedAt || raceOfficeData.raceDays[0]?.updatedAt || '',
      metrics: [
        textMetric('Readiness average', `${readinessData.averageScore}%`, 'Facade readiness score across race-day domains', readinessData.blocked ? 'critical' : readinessData.watch ? 'warning' : 'nominal'),
        countMetric('Races', raceRows.length, 'Race readiness summaries from /races'),
        textMetric('Surface score', `${surfaceData.overallScore}%`, 'Surface intelligence workspace uses the canonical surface API', surfaceData.overallScore >= 80 ? 'nominal' : 'warning'),
        countMetric('Track sectors', trackData.sectors.length, 'Track map sectors from /track-configuration/map'),
        countMetric('Approval controls', readinessData.approvals.length + approvalControls.length, 'Race-day controls remain approval-only', 'warning'),
        textMetric('Direct execution', 'Locked', 'Race starts, stops, results, scratches, cancellations, and configuration changes are not exposed as frontend execution actions', 'critical'),
      ],
      panels: [...racePanels, ...warningPanels, ...controlPanels, ...surfacePanels, ...trackPanels],
      ...context,
    });
  },
};

const equineService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [horse, barnOperations, context] = await Promise.all([getJson<EquineIntelligenceDto>(apiPaths.equine.horse), getJson<BarnOperationsDto>(apiPaths.equine.barnOperations), commonContext()]);
    const data = requireReady(horse, 'Equine intelligence horse profile');
    const barnData = requireReady(barnOperations, 'Barn operations workspace');
    const eligibilityRuleIds = data.eligibilityRules?.map((rule) => rule.id) ?? data.eligibilityStatus.failedRules;
    const transportationRecordCount = data.transportationRecords?.length ?? 0;
    const panels: WorkspacePanel[] = [
      { id: data.horse.horseId, title: data.horse.name, body: `${data.welfareStatus.level} welfare status at score ${data.welfareStatus.latestScore}; barn ${data.barnAssignment.barnId}, stall ${data.barnAssignment.stallId}.`, status: 'facade-only', evidence: ['EquineIntelligenceDto', '/equine-intelligence/horses/{horseId}'] },
      { id: 'equine-eligibility', title: 'Eligibility review', body: `${data.eligibilityStatus.complianceStatus}; flags ${data.eligibilityStatus.flags.join(', ') || 'none'}; failed rules ${data.eligibilityStatus.failedRules.join(', ') || 'none'}.`, status: 'facade-only', evidence: eligibilityRuleIds },
      { id: 'equine-relationships', title: 'Ownership and trainer context', body: `${data.ownership[0]?.ownerName ?? 'Owner pending'} owns ${data.ownership[0]?.percentage ?? 0}%; trainer ${data.trainerAssignments[0]?.trainerName ?? 'pending'} license ${data.trainerAssignments[0]?.licenseStatus ?? 'unknown'}.`, status: 'facade-only', evidence: ['ownership', 'trainerAssignments'] },
      { id: 'equine-activity', title: 'Race and workout activity', body: `${data.raceHistory.length} race record(s), ${data.workoutHistory.length} workout(s), ${transportationRecordCount} transport record(s) in the profile.`, status: 'facade-only', evidence: ['raceHistory', 'workoutHistory', 'transportationRecords'] },
      ...barnData.readiness.slice(0, 2).map((readiness) => ({ id: readiness.barnId, title: `Barn ${readiness.barnId}`, body: `${readiness.status} barn readiness at ${readiness.score}; ${readiness.occupiedStalls}/${readiness.capacity} stalls occupied; blockers ${readiness.blockers.join(', ') || 'none'}.`, status: 'facade-only' as const, evidence: ['BarnOperationsDto', readiness.barnId], actions: [{ label: 'View barn context', path: '/equine', detail: 'Review the Equine workspace barn operations summary.' }, { label: 'View audit context note', path: `/audit?barn=${encodeURIComponent(readiness.barnId)}`, detail: 'Review audit workspace with a barn context note; records are not filtered by this link.' }] })),
    ];
    return vm('equine', horse.source, {
      metrics: [
        textMetric('Lifecycle', data.horse.lifecycleStatus, 'Horse lifecycle from EquineIntelligenceDto'),
        textMetric('Eligibility', data.eligibilityStatus.complianceStatus, 'Eligibility status from the EquineIntelligenceDto facade', data.eligibilityStatus.eligible ? 'nominal' : 'warning'),
        textMetric('Veterinary status', data.veterinaryStatus.status, 'Detailed veterinary records are omitted from this facade', 'advisory'),
        countMetric('Barn readiness rows', barnData.readiness.length, 'Barn operations workspace uses the /barn-operations/workspace API facade', 'nominal', [{ label: 'View audit context', path: '/audit', detail: 'Review available barn operations evidence.' }]),
        countMetric('Twin refs', data.digitalTwinReferences.length, 'Equine digital twin references attached to this profile'),
      ],
      panels,
      ...context,
    });
  },
};

const approvalsService = {
  support: 'live-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const context = await commonContext();
    return vm('approvals', 'live-api', {
      metrics: [countMetric('Approval records', context.approvals.length, 'View-only approval request records', context.approvals.length ? 'warning' : 'nominal')],
      panels: context.approvals.length
        ? context.approvals.map((approval) => ({ id: approval.id, title: approval.action, body: `${approval.status} for ${approval.target}; roles ${approval.requiredRoles?.join(', ') ?? 'declared by policy'}`, status: 'implemented', evidence: approval.evidence }))
        : [{ id: 'approval-empty-state', title: 'No pending approval records', body: 'The live approval route is reachable and currently returns an empty queue for this tenant and role.', status: 'implemented', evidence: ['ApprovalDto[]', '/api/v1/approvals/requests'] }],
      ...context,
    });
  },
};

const incidentsService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [security, emergency, context] = await Promise.all([getJson<SecurityOperationsDto>(apiPaths.incidents.security), getJson<EmergencyOperationsDto>(apiPaths.incidents.emergency), commonContext()]);
    const securityData = requireReady(security, 'Security operations workspace');
    const emergencyData = requireReady(emergency, 'Emergency operations workspace');
    const incidentRows = [
      ...securityData.incidents.map((incident) => ({ id: incident.id, title: incident.title, body: `${incident.status} in ${incident.zoneId}`, evidence: [incident.auditId, ...incident.eventIds] })),
      ...emergencyData.events.map((event) => ({ id: event.id, title: event.type, body: `${event.severity} emergency signal for ${event.subjectId}`, evidence: [event.auditId] })),
    ];
    return vm('incidents', security.source, {
      metrics: [
        countMetric('Security incidents', securityData.incidents.length, 'Security incident rows from /security-operations/workspace', securityData.incidents.length ? 'warning' : 'nominal'),
        textMetric('Emergency status', emergencyData.activeEmergencyStatus, 'Emergency workspace status remains human-commanded', emergencyData.activeEmergencyStatus.includes('critical') ? 'critical' : 'warning'),
        countMetric('Emergency resources', emergencyData.resources.length, 'Response resources visible to command staff', emergencyData.resources.length ? 'warning' : 'nominal'),
      ],
      panels: [
        ...incidentRows.slice(0, 4).map((incident, index) => ({ id: incident.id || `incident-${index}`, title: incident.title || 'Incident', body: incident.body || 'Audit-linked incident signal', status: 'facade-only' as const, evidence: incident.evidence.length ? incident.evidence : ['security-operations', 'emergency-operations'] })),
        ...emergencyData.resources.slice(0, 2).map((resource) => ({ id: resource.id, title: resource.label, body: `${resource.kind} resource is ${resource.status} in ${resource.zoneId}; capacity ${resource.capacity}.`, status: 'facade-only' as const, evidence: ['EmergencyOperationsDto', resource.id] })),
      ],
      ...context,
    });
  },
};

const complianceService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [library, context] = await Promise.all([getJson<ComplianceControlLibraryDto>(apiPaths.compliance.library), commonContext()]);
    const libraryData = requireReady(library, 'Compliance control library');
    const controls = libraryData.controls;
    const readinessStatus = `${libraryData.readiness.score}% score, ${libraryData.readiness.openFindings} open finding(s)`;
    return vm('compliance', library.source, {
      metrics: [
        countMetric('Frameworks', libraryData.frameworks.length, 'Compliance frameworks mapped by the control library'),
        countMetric('Controls', controls.length, 'Compliance controls from backend facade'),
        textMetric('Internal readiness', 'Readiness only', `Readiness status: ${readinessStatus}; no external certification is claimed`, 'advisory'),
      ],
      panels: [
        ...libraryData.frameworks.slice(0, 2).map((framework) => ({ id: framework.id, title: framework.name, body: `Readiness authority reference: ${framework.authority}; candidate evidence artifact: ${framework.accreditationArtifact}; no external certification or approval claimed.`, status: 'facade-only' as const, evidence: framework.domains })),
        ...controls.slice(0, 4).map((control, index) => ({ id: control.id || `control-${index}`, title: control.title || 'Control', body: control.description || control.status || 'Mapped readiness control', status: 'facade-only' as const, evidence: control.evidenceIds?.length ? control.evidenceIds : ['compliance-control-library'] })),
      ],
      ...context,
    });
  },
};

const securityService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [security, context] = await Promise.all([getJson<SecurityOperationsDto>(apiPaths.security.workspace), commonContext()]);
    const data = requireReady(security, 'Security operations workspace');
    const cameraHealth = data.dashboard.cameraHealth;
    return vm('security', security.source, {
      metrics: [
        countMetric('Incidents', data.incidents.length, 'Role-gated security incidents from /security-operations/workspace', data.incidents.length ? 'warning' : 'nominal'),
        countMetric('Cameras online', cameraHealth.online, 'Camera health is backend facade metadata'),
        countMetric('Investigations', data.investigations.length, 'Security investigation records with open status'),
      ],
      panels: [
        ...data.incidents.slice(0, 3).map((incident) => ({ id: incident.id, title: incident.title, body: `${incident.severity} incident in ${incident.zoneId}; ${incident.status}`, status: 'facade-only' as const, evidence: [incident.auditId, ...incident.eventIds] })),
        ...data.cameras.slice(0, 3).map((camera) => ({ id: camera.id, title: camera.label, body: `${camera.health} camera in ${camera.zoneId}`, status: 'facade-only' as const, evidence: ['SecurityOperationsDto', camera.lastHeartbeatAt] })),
      ],
      ...context,
    });
  },
};
const facilitiesService = {
  support: 'live-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [facilities, context] = await Promise.all([getJson<FacilitiesMaintenanceWorkspaceDto>(apiPaths.facilities.workspace), commonContext()]);
    const data = requireReady(facilities, 'Facilities maintenance workspace');
    const assetPanels: WorkspacePanel[] = data.assets.slice(0, 4).map((asset) => ({
      id: asset.assetId,
      title: asset.name,
      body: `${asset.readinessStatus} asset health ${asset.healthScore}; maintenance ${asset.maintenanceStatus}; predicted failure risk ${asset.predictedFailureRisk}%.`,
      status: 'implemented',
      evidence: [asset.sourceOfTruth, asset.twinId ?? 'digital-twin-pending', ...asset.openWorkOrderIds],
    }));
    const workOrderPanels: WorkspacePanel[] = data.workOrders.slice(0, 2).map((order) => ({
      id: order.id,
      title: order.title,
      body: `${order.priority} priority work order is ${order.status}; approval request ${order.approvalRequestId ?? 'none for read-only record'}.`,
      status: 'implemented',
      evidence: [order.workflowInstanceId ?? 'workflow-pending', ...order.evidence],
    }));
    return vm('facilities', facilities.source, {
      generatedAt: data.generatedAt,
      metrics: [
        textMetric('Readiness', `${data.readiness.score}% ${data.readiness.status}`, 'Facilities readiness from service-backed RACR assets', data.readiness.status === 'ready' ? 'nominal' : data.readiness.status === 'watch' ? 'warning' : 'critical'),
        countMetric('Assets', data.assets.length, 'Facilities assets from the maintenance service'),
        countMetric('Open work orders', data.workOrders.filter((order) => order.status !== 'completed').length, 'Approval-gated maintenance work orders', data.workOrders.length ? 'warning' : 'nominal'),
      ],
      panels: [...assetPanels, ...workOrderPanels],
      ...context,
      approvals: [
        ...context.approvals,
        ...data.approvals.map((approval) => localApprovalDto({
          id: approval.id,
          action: approval.action,
          target: approval.target,
          requestedBy: approval.requestedBy ?? 'facilities-service',
          status: approval.status,
          createdAt: approval.createdAt ?? data.generatedAt,
          expiresAt: approval.expiresAt ?? data.generatedAt,
          evidence: approval.evidence,
          workflowId: approval.workflowId,
      requiredRoles: ['track-superintendent', 'admin'],
          affectedAssets: [approval.target],
        })),
      ],
    });
  },
};

const ticketingService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [ticketing, context] = await Promise.all([getJson<FinanceTicketingWorkspaceDto>(apiPaths.finance.ticketing), commonContext()]);
    const data = requireReady(ticketing, 'Finance ticketing workspace');
    const summary = data.summary ?? { activeTickets: 0, refundedTickets: 0, voidTickets: 0, grossTicketRevenueCents: Number.NaN, protectedPayouts: 0, raceDayIds: [] };
    const evidence = arrayEvidence(data.evidence, ['FinanceTicketingWorkspaceDto']);
    const tickets = Array.isArray(data.tickets) ? data.tickets.filter((ticket) => ticket && typeof ticket.ticketId === 'string' && ticket.ticketId.trim()) : [];
    const ticketPanels: WorkspacePanel[] = tickets.map((ticket) => ({
      id: ticket.ticketId,
      title: `Ticket ${ticket.ticketId}`,
      body: `${ticket.status ?? 'unknown'} ticket for ${ticket.raceDayId ?? 'race day unavailable'}; active face value ${formatCurrency(ticket.priceCents)}.`,
      status: 'implemented',
      evidence: ['FinanceTicketingWorkspaceDto', ...evidence],
      actions: [
        { label: 'View audit context note', path: `/audit?ticket=${encodeURIComponent(ticket.ticketId)}`, detail: 'Review audit workspace with a ticket context note; records are not filtered by this link.' },
        { label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrails and protected-action boundary context.' },
      ],
    }));
    return vm('ticketing', ticketing.source, {
      generatedAt: data.generatedAt,
      metrics: [
        countMetric('Active tickets', summary.activeTickets, 'Active tickets from the finance/ticketing service'),
        textMetric('Active ticket value', formatCurrency(summary.grossTicketRevenueCents), 'Sum of active ticket face values in the read model; not captured payment revenue', 'nominal'),
        countMetric('Race days', Array.isArray(summary.raceDayIds) ? summary.raceDayIds.length : 0, 'Race days represented by ticket records'),
      ],
      panels: ticketPanels,
      ...context,
    });
  },
};

const financeService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [finance, context] = await Promise.all([getJson<FinanceTicketingWorkspaceDto>(apiPaths.finance.ticketing), commonContext()]);
    const data = requireReady(finance, 'Finance workspace');
    const summary = data.summary ?? { activeTickets: 0, refundedTickets: 0, voidTickets: 0, grossTicketRevenueCents: Number.NaN, protectedPayouts: 0, raceDayIds: [] };
    const evidence = arrayEvidence(data.evidence, ['FinanceTicketingWorkspaceDto']);
    const payouts = Array.isArray(data.payouts) ? data.payouts.filter((payout) => payout && typeof payout.payoutId === 'string' && payout.payoutId.trim()) : [];
    const payoutPanels: WorkspacePanel[] = payouts.length
      ? payouts.map((payout) => {
        const dualControl = Array.isArray(payout.dualControl) ? payout.dualControl.filter((role): role is string => typeof role === 'string' && role.trim().length > 0) : [];
        return {
        id: payout.payoutId,
        title: `Payout ${payout.payoutId}`,
        body: `${payout.status ?? 'unknown'} payout for ${payout.recipientId ?? 'recipient unavailable'}; amount ${formatCurrency(payout.amountCents)}; dual control ${dualControl.join(' + ') || 'not reported'}.`,
        status: 'implemented' as const,
        evidence: ['FinanceTicketingWorkspaceDto', ...evidence],
        actions: [
          { label: 'View approval context', path: '/approvals', detail: 'Review general approval records.' },
          { label: 'View audit context note', path: `/audit?payout=${encodeURIComponent(payout.payoutId)}`, detail: 'Review audit workspace with a payout context note; records are not filtered by this link.' },
        ],
      };
      })
      : [{
        id: 'finance-payout-boundary',
        title: 'Payout approval boundary',
        body: `${data.payoutApproval ?? 'Payout approval policy unavailable'}; no payout is released without steward and finance approval.`,
        status: 'implemented' as const,
        evidence,
        actions: [
          { label: 'View approval context', path: '/approvals', detail: 'Review general approval records.' },
          { label: 'Review AI guardrails', path: '/settings', detail: 'Review read-only AI guardrails and protected-action boundary context.' },
        ],
      }];
    return vm('finance', finance.source, {
      generatedAt: data.generatedAt,
      metrics: [
        textMetric('Active ticket value under view', formatCurrency(summary.grossTicketRevenueCents), 'Sum of active ticket face values in the read model; not captured payment revenue'),
        countMetric('Released payouts', summary.protectedPayouts, 'Payout records in this read model represent released payout state; pending APEX approval workload is not included here', summary.protectedPayouts ? 'warning' : 'nominal'),
        textMetric('Payout control', data.payoutApproval ?? 'Approval policy unavailable', 'Finance payout actions are protected by dual-control approval', 'critical'),
      ],
      panels: payoutPanels,
      ...context,
    });
  },
};

const federationService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [federation, context] = await Promise.all([getJson<FederationWorkspaceDto>(apiPaths.federation.workspace), commonContext()]);
    const data = requireReady(federation, 'Federation workspace');
    return vm('federation', federation.source, {
      metrics: [
        textMetric('Raw data exposure', data.rawDataExposure.exposed ? 'Detected' : 'None', data.rawDataExposure.exposed ? 'Raw exposure requires governance review' : 'Federation is aggregate-only and permission governed', data.rawDataExposure.exposed ? 'critical' : 'nominal', [{ label: 'View federation context', path: '/federation', detail: 'Review aggregate federation metadata.' }]),
        countMetric('Federation profiles', data.tracks.length, 'Track-scope federation profiles; tenant-only profiles are not aggregate sharing claims', 'nominal', [{ label: 'View federation context', path: '/federation', detail: 'Review aggregate federation metadata.' }]),
        countMetric('Benchmark metrics', data.crossTrackBenchmarking.metrics.length, 'Anonymized benchmark metadata only'),
      ],
      panels: [
        { id: 'federation-boundary', title: data.dataSharingPolicy.policyId, body: `Aggregate sharing categories (metadata only, no export endpoint): ${data.dataSharingPolicy.allowedExports.join(', ')}; prohibited fields: ${data.dataSharingPolicy.prohibitedFields.join(', ')}.`, status: 'facade-only', evidence: ['FederationWorkspaceDto'] },
        ...data.tracks.slice(0, 3).map((track, index) => ({ id: `federation-profile-${index + 1}`, title: `${track.displayName} ${track.sharingScope} federation profile`, body: `${track.sharingScope} scope; ${track.dataResidency} residency; readiness status ${track.certificationStatus}.`, status: 'facade-only' as const, evidence: [track.schemaVersion, track.racetrackId] })),
        { id: 'federation-raw-boundary', title: 'Raw data exposure boundary', body: `${data.rawDataExposure.exposed ? 'Raw exposure detected' : 'No raw cross-track data exposure'}; endpoints ${data.rawDataExposure.endpoints.length}.`, status: 'facade-only', evidence: data.tenantIsolation.enforcement },
      ],
      ...context,
    });
  },
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function arrayEvidence(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : fallback;
}

function formatCurrency(cents: unknown): string {
  return typeof cents === 'number' && Number.isFinite(cents)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
    : 'Unavailable';
}

const dataHubService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [workspace, context] = await Promise.all([getJson<RacingDataWorkspaceDto>(apiPaths.dataHub.workspace), commonContext()]);
    const data = requireReady(workspace, 'Racing Data API Hub workspace');
    const providerStatuses = Array.isArray(data.statuses) ? data.statuses.map(asRecord) : [];
    const statusByProviderId = new Map<string, UnknownRecord>();
    providerStatuses.forEach((status) => {
      const providerId = String(status.providerId ?? status.id ?? '');
      if (providerId) statusByProviderId.set(providerId, status);
    });
    const providers = Array.isArray(data.providers) ? data.providers : [];
    const providerPanels: WorkspacePanel[] = providers.slice(0, 3).map((provider, index) => {
      const record = asRecord(provider);
      const license = asRecord(record.license);
      const id = String(record.id ?? record.providerId ?? `provider-${index + 1}`);
      const providerStatus = statusByProviderId.get(id);
      const status = String(providerStatus?.status ?? providerStatus?.health ?? record.status ?? record.health ?? 'declared');
      const configured = typeof record.enabled === 'boolean' ? (record.enabled ? 'enabled' : 'disabled') : 'configuration not reported';
      const licenseStatus = String(providerStatus?.licenseStatus ?? record.licenseStatus ?? license.licenseStatus ?? 'review required');
      return {
        id,
        title: `${String(record.displayName ?? record.name ?? record.label ?? record.providerName ?? id)} facade`,
        body: `Seeded provider operational status is ${status}; provider configuration is ${configured}; declared license-readiness posture ${licenseStatus}; configured sync mode ${String(record.syncMode ?? 'declared')}. No live provider pull is claimed.`,
        status: 'facade-only',
        evidence: arrayEvidence(record.evidenceRefs, ['RacingDataWorkspaceDto', 'licensed-provider-metadata']),
      };
    });
    const qualityReports = Array.isArray(data.qualityReports) ? data.qualityReports : [];
    const qualityPanels: WorkspacePanel[] = qualityReports.slice(0, 3).map((report, index) => {
      const record = asRecord(report);
      const rawScore = typeof record.qualityScore === 'number' ? Math.round(record.qualityScore * 100) : record.score;
      const score = typeof rawScore === 'number' ? `${rawScore}%` : String(rawScore ?? 'not scored');
      return {
        id: String(record.id ?? record.reportId ?? `quality-report-${index + 1}`),
        title: String(record.kind ?? record.label ?? record.dataClass ?? 'Data quality report'),
        body: `Quality ${score}; ${String(record.dataQualityImpactSummary ?? record.licenseImpactSummary ?? 'provider data checks completed')}.`,
        status: 'facade-only',
        evidence: arrayEvidence(record.evidence, arrayEvidence(record.evidenceRefs, ['data-quality-report'])),
      };
    });
    return vm('dataHub', workspace.source, {
      generatedAt: data.generatedAt,
      metrics: [
        countMetric('Providers', providers.length, 'Licensed provider metadata in the Racing Data API Hub'),
        countMetric('Ingestion jobs', Array.isArray(data.ingestionJobs) ? data.ingestionJobs.length : 0, 'Local ingestion job metadata; no external scrape is executed', Array.isArray(data.ingestionJobs) && data.ingestionJobs.length ? 'advisory' : 'nominal'),
        countMetric('Quality reports', qualityReports.length, 'Quality and lineage reports for governed provider data'),
      ],
      panels: [
        ...providerPanels,
        ...qualityPanels,
        { id: 'data-hub-boundary', title: 'External integration boundary', body: 'The workspace represents licensed-provider readiness, entity resolution, export controls, and lineage. It does not claim live external provider pulls from the frontend.', status: 'facade-only', evidence: ['RacingDataWorkspaceDto', '/api/v1/racing-data'] },
      ],
      ...context,
    });
  },
};

const auditService = {
  support: 'live-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [audit, context] = await Promise.all([getJson<AuditEventDto[]>(apiPaths.audit.events), commonContext()]);
    const auditData = requireReady(audit, 'Audit events');
    const events = Array.isArray(auditData) ? auditData : [];
    const critical = events.filter((event) => event.severity === 'critical').length;
    const actors = new Set(events.map((event) => event.actor?.actorId ?? event.actorId ?? 'unknown-actor'));
    return vm('audit', audit.source, {
      metrics: [
        countMetric('Audit events', events.length, 'Audit event records with hash references from /audit/events'),
        countMetric('Critical events', critical, 'Critical audit severity count', critical ? 'critical' : 'nominal'),
        countMetric('Actors', actors.size, 'Distinct actors represented in the audit ledger'),
      ],
      panels: events.slice(0, 8).map((event) => {
        const legacyEvent = event as { actorId?: string; subjectId?: string };
        const hash = event.integrityReference?.hash ?? event.hash;
        const previousHash = event.integrityReference?.previousHash ?? event.previousHash;
        const evidence = [hash, previousHash, ...(event.evidenceIds ?? [])].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        return {
          id: event.id,
          title: event.action ?? 'Audit event',
          body: `${event.severity ?? 'info'} event by ${event.actor?.actorId ?? legacyEvent.actorId ?? 'unknown-actor'} on ${event.entity?.entityType ?? legacyEvent.subjectId ?? 'unknown-entity'}; reported hash reference ${(hash ?? 'hash unavailable').slice(0, 12)} and previous reference ${(previousHash ?? 'previous hash unavailable').slice(0, 12)}.`,
          status: 'implemented' as const,
          evidence,
        };
      }),
      ...context,
      auditEvents: events,
    });
  },
};
const adminService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [health, context] = await Promise.all([getJson<PlatformHealthWorkspaceDto>(apiPaths.admin.platformHealth), commonContext()]);
    const data = requireReady(health, 'Platform health');
    const services = Array.isArray(data.services) ? data.services : [];
    const approvalEngine = data.approvalEngine ?? { pending: 0 };
    const deploymentBoundary = data.deploymentBoundary ?? { claim: 'Deployment boundary not reported by facade.', assumptions: [] };
    return vm('admin', health.source, {
      generatedAt: data.generatedAt,
      metrics: [
        textMetric('Platform status', data.overallStatus, 'Facade-level platform health metadata from /platform/health', data.overallStatus === 'healthy' ? 'nominal' : data.overallStatus === 'degraded' ? 'warning' : 'critical'),
        countMetric('Services', services.length, 'Facade-level service health records'),
        countMetric('Pending approvals', approvalEngine.pending, 'Approval engine queue metadata from platform health', approvalEngine.pending ? 'warning' : 'nominal'),
      ],
      panels: [
        ...services.slice(0, 4).map((service) => {
          const dependencies = Array.isArray(service.dependencies) ? service.dependencies : [];
          return { id: service.serviceId, title: service.serviceId, body: `${service.status} seeded service-health record with reported latency ${service.latencyMs}ms and ${dependencies.length} dependency record(s).`, status: 'facade-only' as const, evidence: dependencies.map((dependency) => `${dependency.id}:${dependency.status}`) };
        }),
        { id: 'deployment-boundary', title: 'Deployment boundary', body: `${deploymentBoundary.claim} This is facade metadata, not a live deployment attestation.`, status: 'facade-only', evidence: Array.isArray(deploymentBoundary.assumptions) ? deploymentBoundary.assumptions : [] },
      ],
      ...context,
    });
  },
};
const settingsService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [policy, context] = await Promise.all([getJson<AIControlPlanePolicyDto>(apiPaths.settings.policy), commonContext()]);
    const data = requireReady(policy, 'AI control-plane policy');
    const protectedActions = Array.isArray(data.protectedActions) ? data.protectedActions : [];
    const governanceMapping = Array.isArray(data.governanceMapping) ? data.governanceMapping : [];
    const allowedActivities = Array.isArray(data.allowedActivities) ? data.allowedActivities : [];
    const requiredEvidence = Array.isArray(data.requiredEvidence) ? data.requiredEvidence : [];
    return vm('settings', policy.source, {
      metrics: [
        textMetric('Protected execution posture', data.executionEndpointsAvailable ? 'Declared by API' : 'Unavailable', 'Protected execution is not exposed from this frontend; draft/evaluate review endpoints are backend-governed.', data.executionEndpointsAvailable ? 'warning' : 'nominal'),
        countMetric('Protected actions', protectedActions.length, 'Actions that require human approval'),
        countMetric('Governance mappings', governanceMapping.length, 'ISO/NIST policy mapping records'),
      ],
      panels: [
        { id: data.policyId, title: 'AI advisory-only policy', body: `Allowed activities: ${allowedActivities.slice(0, 5).join(', ') || 'No allowed activities declared'}. Draft/evaluate state changes remain draft-only: ${String(data.draftOnlyStateChanges)}. Protected execution remains unavailable from the frontend.`, status: 'facade-only', evidence: requiredEvidence },
        ...governanceMapping.slice(0, 3).map((mapping, index) => {
          const controls = Array.isArray(mapping.controls) ? mapping.controls : [];
          const evidence = Array.isArray(mapping.evidence) ? mapping.evidence : [];
          return { id: `governance-mapping-${index}`, title: mapping.framework, body: `${controls.length} control mapping(s); evidence ${evidence.join(', ') || 'policy evidence pending'}.`, status: 'facade-only' as const, evidence };
        }),
      ],
      ...context,
    });
  },
};

export const domainServices = {
  dashboard: dashboardService,
  raceDay: raceDayService,
  equine: equineService,
  approvals: approvalsService,
  incidents: incidentsService,
  compliance: complianceService,
  security: securityService,
  facilities: facilitiesService,
  ticketing: ticketingService,
  finance: financeService,
  federation: federationService,
  dataHub: dataHubService,
  audit: auditService,
  admin: adminService,
  settings: settingsService,
} as const;
