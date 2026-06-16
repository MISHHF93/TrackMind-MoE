import { normalizeApprovalStatus, type CanonicalApprovalEscalation, type CanonicalApprovalStep } from '@trackmind/shared';
import type {
  AIGovernanceWorkspaceDto,
  AIControlPlanePolicyDto,
  AIControlPlaneRecommendationDto,
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
const dashboardDrillDownRouteMap: Record<string, string> = {
  '/race-office': '/race-day',
  '/surface': '/race-day',
  '/emergency': '/incidents',
  '/operations': '/dashboard',
  '/platform-health': '/admin',
  '/starting-gate': '/race-day',
  '/workforce': '/facilities',
};
const routeKpiDomains: Record<DomainRouteId, string[]> = {
  dashboard: ['race-day-operations', 'system-health', 'approval-workflows', 'ai-governance'],
  raceDay: ['race-day-operations', 'approval-workflows', 'stewarding'],
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

function frontendPathForBackendDrilldown(path: string | undefined): string {
  if (!path) return routeById.dashboard.path;
  const currentRoute = Object.values(routeById).find((route) => route.path === path);
  return currentRoute?.path ?? dashboardDrillDownRouteMap[path] ?? routeById.dashboard.path;
}

function actionForBackendDrilldown(input: { title: string; drillDownPath?: string }): WorkspaceCardAction {
  const path = frontendPathForBackendDrilldown(input.drillDownPath);
  return {
    label: 'Open workspace',
    path,
    detail: input.drillDownPath && input.drillDownPath !== path
      ? `Backend drilldown ${input.drillDownPath} is surfaced through ${path}.`
      : `Open ${input.title} workspace.`,
  };
}

function aiCardsFromGovernance(workspace?: AIGovernanceWorkspaceDto): AdvisoryAIRecommendation[] {
  if (!workspace) return [];
  return [
    ...(workspace.recommendationQueue ?? []),
    ...(workspace.safetyBlockedActions ?? []),
  ].map((item) => {
    const confidence = item.confidence ?? { calibrated: Number.NaN, band: 'unknown' };
    const approvalRequirement = item.approvalRequirement ?? { required: false, policy: 'Not required' };
    const auditReference = item.auditReference ?? { eventIds: [], auditIds: [], digitalTwinRefs: [] };
    const eventIds = Array.isArray(auditReference.eventIds) ? auditReference.eventIds : [];
    const auditIds = Array.isArray(auditReference.auditIds) ? auditReference.auditIds : [];
    const digitalTwinRefs = Array.isArray(auditReference.digitalTwinRefs) ? auditReference.digitalTwinRefs : [];
    return {
      id: item.id,
      recommendationId: item.recommendationId,
      recommendation: 'recommendation' in item && item.recommendation ? item.recommendation : 'AI recommendation text unavailable.',
      confidence,
      confidenceValue: confidence.calibrated,
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
      evidencePackage: item.evidencePackage,
      modelVersion: item.modelVersion,
      generatedAt: item.generatedAt,
      approvalRequirement,
      auditReference,
      requiresApproval: approvalRequirement.required ?? false,
      eventId: eventIds[0],
      auditId: auditIds[0],
      digitalTwinRefs,
      riskLevel: item.riskLevel ?? 'medium',
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
  return (recommendations ?? []).map((item) => {
    const confidence = item.confidence ?? { calibrated: Number.NaN, band: 'unknown' };
    const approvalRequirement = item.approvalRequirement ?? { required: false, policy: 'Not required' };
    const auditReference = item.auditReference ?? { eventIds: [], auditIds: [], digitalTwinRefs: [] };
    const governorDecision = item.governorDecision ?? { allowed: false, reason: 'Governor decision unavailable.' };
    const eventIds = Array.isArray(auditReference.eventIds) ? auditReference.eventIds : [];
    const auditIds = Array.isArray(auditReference.auditIds) ? auditReference.auditIds : [];
    const digitalTwinRefs = Array.isArray(auditReference.digitalTwinRefs) ? auditReference.digitalTwinRefs : [];
    return {
      id: item.id,
      recommendationId: item.recommendationId,
      recommendation: item.recommendation ?? 'AI recommendation text unavailable.',
      confidence,
      confidenceValue: confidence.calibrated,
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
      evidencePackage: item.evidencePackage,
      modelVersion: item.modelVersion,
      generatedAt: item.generatedAt,
      approvalRequirement,
      auditReference,
      requiresApproval: approvalRequirement.required ?? false,
      eventId: eventIds[0],
      auditId: auditIds[0],
      digitalTwinRefs,
      riskLevel: item.risk?.level ?? 'medium',
      advisoryOnly: true,
      executionAllowed: false,
      blockedAutonomousExecution: true,
      governorAllowed: governorDecision.allowed ?? false,
      governorReason: governorDecision.reason,
      actionLabel: item.action,
      target: item.target,
      status: item.status,
      confidenceBand: confidence.band ?? 'unknown',
      mock: item.mock,
    };
  });
}

function vm(routeId: DomainRouteId, source: WorkspaceViewModel['source'], partial: Omit<WorkspaceViewModel, 'route' | 'source'>): WorkspaceViewModel {
  const domains = new Set(routeKpiDomains[routeId]);
  const allKpis = Array.isArray(partial.kpis) ? partial.kpis : [];
  const allModelContext = Array.isArray(partial.modelReadableKpiContext) ? partial.modelReadableKpiContext : [];
  const kpis = allKpis.filter((kpi) => domains.has(kpi.domain));
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
  const approvalsData = requireReady(approvals, 'Approvals');
  const auditData = requireReady(audit, 'Audit events');
  const controlPlaneData = requireReady(controlPlaneRecommendations, 'AI control-plane recommendations');
  const aiData = requireReady(ai, 'AI governance workspace');
  const kpiData = requireReady(kpiWorkspace, 'KPI workspace');
  const governedCards = aiCardsFromControlPlane(controlPlaneData);
  return {
    approvals: approvalsData,
    auditEvents: auditData,
    aiRecommendations: governedCards.length > 0 ? governedCards : aiCardsFromGovernance(aiData),
    kpis: kpiData.kpis,
    modelReadableKpiContext: kpiData.modelReadableContext,
  };
}

const dashboardService = {
  support: 'live-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [operations, health, context] = await Promise.all([
      getJson<OperationsCommandCenterDto>(apiPaths.dashboard.operations),
      getJson<PlatformHealthWorkspaceDto>(apiPaths.dashboard.platformHealth),
      commonContext(),
    ]);
    const operationsData = requireReady(operations, 'Operations command center');
    const healthData = requireReady(health, 'Platform health');
    const widgets = operationsData.widgets;
    return vm('dashboard', operations.source, {
      generatedAt: operationsData.generatedAt ?? healthData.generatedAt,
      metrics: [
        countMetric('Command widgets', widgets.length, 'Backend operation widgets from /operations/command-center'),
        textMetric('Platform health', healthData.overallStatus, 'Facade platform-health status from /platform/health; not production telemetry', healthData.overallStatus === 'critical' ? 'critical' : 'nominal'),
        countMetric('Approval records', context.approvals.length, 'Seeded approval contract records from /approvals/requests', context.approvals.length ? 'warning' : 'nominal'),
      ],
      panels: widgets.slice(0, 4).map((widget) => {
        const path = frontendPathForBackendDrilldown(widget.drillDownPath);
        return {
          id: widget.id,
          title: widget.title,
          body: widget.detail,
          status: 'facade-only' as const,
          evidence: [widget.source, apiPaths.dashboard.operations, `frontend:${path}`],
          actions: [actionForBackendDrilldown(widget)],
        };
      }),
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
      body: `${control.action} targets ${control.target}; locked approval API ${control.approvalApi}.`,
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
        { label: 'Open approvals', path: '/approvals', detail: 'Open approvals workspace with surface context.' },
        { label: 'Open audit context', path: `/audit?surface=${encodeURIComponent(scorecard.id)}`, detail: 'Open audit workspace with surface context.' },
      ],
    }));
    const trackPanels: WorkspacePanel[] = [{
      id: 'track-configuration-map',
      title: 'Track configuration map',
      body: `Starting gate ${trackData.startingGate.sectorId} at ${trackData.startingGate.metersFromStart}m; ${trackData.trackConfiguration?.workOrders.length ?? 0} approval-blocked gate/configuration work order(s); no live actuator control.`,
      status: 'facade-only',
      evidence: ['TrackMapDto', '/api/v1/track-configuration/map'],
      actions: [
        { label: 'Open approvals', path: '/approvals', detail: 'Open approvals workspace with track configuration context.' },
        { label: 'Open audit context', path: '/audit?trackConfiguration=map', detail: 'Open audit workspace with track configuration context.' },
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
      ...barnData.readiness.slice(0, 2).map((readiness) => ({ id: readiness.barnId, title: `Barn ${readiness.barnId}`, body: `${readiness.status} barn readiness at ${readiness.score}; ${readiness.occupiedStalls}/${readiness.capacity} stalls occupied; blockers ${readiness.blockers.join(', ') || 'none'}.`, status: 'facade-only' as const, evidence: ['BarnOperationsDto', readiness.barnId], actions: [{ label: 'View barn context', path: '/equine', detail: 'Review the Equine workspace barn operations summary.' }, { label: 'Open audit', path: `/audit?barn=${encodeURIComponent(readiness.barnId)}`, detail: 'Review barn operations evidence.' }] })),
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
        textMetric('Certification', 'Readiness only', `Readiness status: ${readinessStatus}; no external certification is claimed`, 'advisory'),
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
          requiredRoles: ['facilities-supervisor', 'operations-command'],
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
    const ticketPanels: WorkspacePanel[] = data.tickets.map((ticket) => ({
      id: ticket.ticketId,
      title: `Ticket ${ticket.ticketId}`,
      body: `${ticket.status} ticket for ${ticket.raceDayId}; value ${formatCurrency(ticket.priceCents)}.`,
      status: 'implemented',
      evidence: ['FinanceTicketingWorkspaceDto', ...data.evidence],
      actions: [
        { label: 'Open audit', path: `/audit?ticket=${encodeURIComponent(ticket.ticketId)}`, detail: 'Review ticketing audit evidence.' },
        { label: 'Review AI policy', path: '/settings', detail: 'Review advisory AI and protected-action boundary context.' },
      ],
    }));
    return vm('ticketing', ticketing.source, {
      generatedAt: data.generatedAt,
      metrics: [
        countMetric('Active tickets', data.summary.activeTickets, 'Active tickets from the finance/ticketing service'),
        textMetric('Active ticket value', formatCurrency(data.summary.grossTicketRevenueCents), 'Sum of active ticket face values in the read model; not captured payment revenue', 'nominal'),
        countMetric('Race days', data.summary.raceDayIds.length, 'Race days represented by ticket records'),
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
    const payoutPanels: WorkspacePanel[] = data.payouts.length
      ? data.payouts.map((payout) => ({
        id: payout.payoutId,
        title: `Payout ${payout.payoutId}`,
        body: `${payout.status} payout for ${payout.recipientId}; amount ${formatCurrency(payout.amountCents)}; dual control ${payout.dualControl.join(' + ')}.`,
        status: 'implemented' as const,
        evidence: ['FinanceTicketingWorkspaceDto', ...data.evidence],
        actions: [
          { label: 'Open approvals', path: '/approvals', detail: 'Review general approval records.' },
          { label: 'Open audit', path: `/audit?payout=${encodeURIComponent(payout.payoutId)}`, detail: 'Review payout audit evidence.' },
        ],
      }))
      : [{
        id: 'finance-payout-boundary',
        title: 'Payout approval boundary',
        body: `${data.payoutApproval}; no payout is released without steward and finance approval.`,
        status: 'implemented' as const,
        evidence: data.evidence,
        actions: [
          { label: 'Open approvals', path: '/approvals', detail: 'Review general approval records.' },
          { label: 'Review AI policy', path: '/settings', detail: 'Review advisory AI and protected-action boundary context.' },
        ],
      }];
    return vm('finance', finance.source, {
      generatedAt: data.generatedAt,
      metrics: [
        textMetric('Active ticket value under view', formatCurrency(data.summary.grossTicketRevenueCents), 'Sum of active ticket face values in the read model; not captured payment revenue'),
        countMetric('Protected payouts', data.summary.protectedPayouts, 'Protected payout records exposed by the finance service; release actions stay approval-gated', data.summary.protectedPayouts ? 'warning' : 'nominal'),
        textMetric('Payout control', data.payoutApproval, 'Finance payout actions are protected by dual-control approval', 'critical'),
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
        textMetric('Raw data exposure', data.rawDataExposure.exposed ? 'Blocked' : 'None', 'Federation is aggregate-only and permission governed', 'nominal'),
        countMetric('Tenant cells', data.tracks.length, 'Tenant and anonymized cohort cells in the federation workspace'),
        countMetric('Benchmark metrics', data.crossTrackBenchmarking.metrics.length, 'Anonymized benchmark metadata only'),
      ],
      panels: [
        { id: 'federation-boundary', title: data.dataSharingPolicy.policyId, body: `Policy-permitted export categories (metadata only, no export endpoint): ${data.dataSharingPolicy.allowedExports.join(', ')}; prohibited fields: ${data.dataSharingPolicy.prohibitedFields.join(', ')}.`, status: 'facade-only', evidence: ['FederationWorkspaceDto'] },
        ...data.tracks.slice(0, 3).map((track) => ({ id: track.tenantId, title: track.displayName, body: `${track.sharingScope} scope; ${track.dataResidency} residency; certification ${track.certificationStatus}.`, status: 'facade-only' as const, evidence: [track.schemaVersion, track.racetrackId] })),
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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const dataHubService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [workspace, context] = await Promise.all([getJson<RacingDataWorkspaceDto>(apiPaths.dataHub.workspace), commonContext()]);
    const data = requireReady(workspace, 'Racing Data API Hub workspace');
    const providerPanels: WorkspacePanel[] = data.providers.slice(0, 3).map((provider, index) => {
      const record = asRecord(provider);
      const license = asRecord(record.license);
      const id = String(record.id ?? record.providerId ?? `provider-${index + 1}`);
      const status = typeof record.enabled === 'boolean' ? (record.enabled ? 'enabled' : 'disabled') : String(record.status ?? record.health ?? 'declared');
      const licenseStatus = String(record.licenseStatus ?? license.licenseStatus ?? 'review required');
      return {
        id,
        title: String(record.displayName ?? record.name ?? record.label ?? record.providerName ?? id),
        body: `Provider facade status is ${status}; license posture ${licenseStatus}; declared sync mode ${String(record.syncMode ?? 'declared')}.`,
        status: 'facade-only',
        evidence: arrayEvidence(record.evidenceRefs, ['RacingDataWorkspaceDto', 'licensed-provider-metadata']),
      };
    });
    const qualityPanels: WorkspacePanel[] = data.qualityReports.slice(0, 3).map((report, index) => {
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
        countMetric('Providers', data.providers.length, 'Licensed provider metadata in the Racing Data API Hub'),
        countMetric('Ingestion jobs', data.ingestionJobs.length, 'Local ingestion job metadata; no external scrape is executed', data.ingestionJobs.length ? 'advisory' : 'nominal'),
        countMetric('Quality reports', data.qualityReports.length, 'Quality and lineage reports for governed provider data'),
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
        return {
          id: event.id,
          title: event.action ?? 'Audit event',
          body: `${event.severity ?? 'info'} event by ${event.actor?.actorId ?? legacyEvent.actorId ?? 'unknown-actor'} on ${event.entity?.entityType ?? legacyEvent.subjectId ?? 'unknown-entity'}; hash ${(event.integrityReference?.hash ?? event.hash ?? 'hash unavailable').slice(0, 12)} follows ${(event.integrityReference?.previousHash ?? event.previousHash ?? 'previous hash unavailable').slice(0, 12)}.`,
          status: 'implemented' as const,
          evidence: [event.hash, event.previousHash, ...(event.evidenceIds ?? [])],
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
          return { id: service.serviceId, title: service.serviceId, body: `${service.status} service at ${service.latencyMs}ms with ${dependencies.length} dependency record(s).`, status: 'facade-only' as const, evidence: dependencies.map((dependency) => `${dependency.id}:${dependency.status}`) };
        }),
        { id: 'deployment-boundary', title: 'Deployment boundary', body: deploymentBoundary.claim, status: 'facade-only', evidence: Array.isArray(deploymentBoundary.assumptions) ? deploymentBoundary.assumptions : [] },
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
        textMetric('Protected execution posture', data.executionEndpointsAvailable ? 'Declared by API' : 'Unavailable', 'Protected execution is not exposed from this frontend; draft/evaluate endpoints are backend-governed.', data.executionEndpointsAvailable ? 'warning' : 'nominal'),
        countMetric('Protected actions', protectedActions.length, 'Actions that require human approval'),
        countMetric('Governance mappings', governanceMapping.length, 'ISO/NIST policy mapping records'),
      ],
      panels: [
        { id: data.policyId, title: 'AI advisory-only policy', body: `Allowed activities: ${allowedActivities.slice(0, 5).join(', ') || 'No allowed activities declared'}. State changes are draft-only: ${String(data.draftOnlyStateChanges)}.`, status: 'facade-only', evidence: requiredEvidence },
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
