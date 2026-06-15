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
import { countMetric, textMetric, type AdvisoryAIRecommendation, type WorkspacePanel, type WorkspaceViewModel } from '../domain/workspaceModel';
import { routeById } from '../routes/routes';
import type { DomainRouteId } from '../domain/support';

type UnknownRecord = Record<string, unknown>;
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

function requireReady<T>(result: AdapterResult<T>, label: string): T {
  if (result.status === 'error') throw new Error(`${label} adapter failed: ${result.message ?? 'unknown error'}`);
  if (result.data === undefined) throw new Error(`${label} adapter returned no data.`);
  return result.data;
}

function aiCardsFromGovernance(workspace?: AIGovernanceWorkspaceDto): AdvisoryAIRecommendation[] {
  if (!workspace) return [];
  return [
    ...(workspace.recommendationQueue ?? []),
    ...(workspace.safetyBlockedActions ?? []),
  ].map((item) => ({
    id: item.id,
    recommendationId: item.recommendationId,
    recommendation: 'recommendation' in item && item.recommendation ? item.recommendation : 'AI recommendation requires human review.',
    confidence: 'confidenceScore' in item && item.confidenceScore ? item.confidenceScore.calibrated : 'confidence' in item ? item.confidence : 0,
    evidence: item.evidence ?? [],
    modelVersion: item.modelVersion,
    generatedAt: item.generatedAt,
    approvalRequirement: item.approvalRequirement,
    auditReference: item.auditReference,
    requiresApproval: item.approvalRequirement.required,
    eventId: item.auditReference.eventIds[0] ?? `event:${item.id}`,
    auditId: item.auditReference.auditIds[0] ?? `audit:${item.id}`,
    digitalTwinRefs: item.auditReference.digitalTwinRefs,
    riskLevel: 'riskLevel' in item ? item.riskLevel : 'high',
    governorAllowed: false,
    governorReason: 'Governance queue entries are advisory and require human review before protected action.',
    status: 'status' in item ? item.status : 'advisory',
    mock: false,
  }));
}

function aiCardsFromControlPlane(recommendations?: AIControlPlaneRecommendationDto[]): AdvisoryAIRecommendation[] {
  return (recommendations ?? []).map((item) => ({
    id: item.id,
    recommendationId: item.recommendationId,
    recommendation: item.recommendation,
    confidence: item.confidence.calibrated,
    evidence: item.evidence,
    modelVersion: item.modelVersion,
    generatedAt: item.generatedAt,
    approvalRequirement: item.approvalRequirement,
    auditReference: item.auditReference,
    requiresApproval: item.approvalRequirement.required,
    eventId: item.auditReference.eventIds[0] ?? `event:${item.id}`,
    auditId: item.auditReference.auditIds[0] ?? `audit:${item.id}`,
    digitalTwinRefs: item.auditReference.digitalTwinRefs,
    riskLevel: item.risk.level,
    governorAllowed: item.governorDecision.allowed,
    governorReason: item.governorDecision.reason,
    actionLabel: item.action,
    target: item.target,
    status: item.status,
    confidenceBand: item.confidence.band,
    mock: item.mock,
  }));
}

function vm(routeId: DomainRouteId, source: WorkspaceViewModel['source'], partial: Omit<WorkspaceViewModel, 'route' | 'source'>): WorkspaceViewModel {
  const domains = new Set(routeKpiDomains[routeId]);
  return { route: routeById[routeId], source, ...partial, kpis: partial.kpis.filter((kpi) => domains.has(kpi.domain)) };
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
        textMetric('Platform health', healthData.overallStatus, 'System health comes from /platform/health', healthData.overallStatus === 'critical' ? 'critical' : 'nominal'),
        countMetric('Approval queue', context.approvals.length, 'Human approvals from /approvals/requests', context.approvals.length ? 'warning' : 'nominal'),
      ],
      panels: widgets.slice(0, 4).map((widget) => ({ id: widget.id, title: widget.title, body: widget.detail, status: 'implemented', evidence: [widget.source, widget.drillDownPath] })),
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
      title: control.label,
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
        { label: 'Open approvals', path: '/approvals', detail: 'Review surface approval requirements.' },
        { label: 'Open audit', path: `/audit?surface=${encodeURIComponent(scorecard.id)}`, detail: 'Review surface evidence.' },
      ],
    }));
    const trackPanels: WorkspacePanel[] = [{
      id: 'track-configuration-map',
      title: 'Track configuration map',
      body: `Starting gate ${trackData.startingGate.sectorId} at ${trackData.startingGate.metersFromStart}m; ${trackData.trackConfiguration?.workOrders.length ?? 0} gate/configuration work order(s).`,
      status: 'facade-only',
      evidence: ['TrackMapDto', '/api/v1/track-configuration/map'],
      actions: [
        { label: 'Open approvals', path: '/approvals', detail: 'Review track configuration approvals.' },
        { label: 'Open audit', path: '/audit?trackConfiguration=map', detail: 'Review track configuration audit records.' },
      ],
    }];
    return vm('raceDay', races.source, {
      generatedAt: readinessData.generatedAt || raceOfficeData.cards[0]?.updatedAt || raceOfficeData.raceDays[0]?.updatedAt || '',
      metrics: [
        textMetric('Readiness average', `${readinessData.averageScore}%`, 'Service-backed dashboard score across race-day domains', readinessData.blocked ? 'critical' : readinessData.watch ? 'warning' : 'nominal'),
        countMetric('Races', raceRows.length, 'Race readiness summaries from /races'),
        textMetric('Surface score', `${surfaceData.overallScore}%`, 'Surface intelligence workspace backs /surface aliases', surfaceData.overallScore >= 80 ? 'nominal' : 'warning'),
        countMetric('Track sectors', trackData.sectors.length, 'Track map sectors from /track-configuration/map'),
        countMetric('Approval controls', readinessData.approvals.length + approvalControls.length, 'Race-day controls remain approval-only', 'warning'),
        textMetric('Direct execution', 'Locked', 'Race starts/stops/results are not exposed as frontend actions', 'critical'),
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
      ...barnData.readiness.slice(0, 2).map((readiness) => ({ id: readiness.barnId, title: `Barn ${readiness.barnId}`, body: `${readiness.status} barn readiness at ${readiness.score}; ${readiness.occupiedStalls}/${readiness.capacity} stalls occupied; blockers ${readiness.blockers.join(', ') || 'none'}.`, status: 'facade-only' as const, evidence: ['BarnOperationsDto', readiness.barnId], actions: [{ label: 'Open facilities', path: '/facilities', detail: 'Review facilities assets and maintenance.' }, { label: 'Open audit', path: `/audit?barn=${encodeURIComponent(readiness.barnId)}`, detail: 'Review barn operations evidence.' }] })),
    ];
    return vm('equine', horse.source, {
      metrics: [
        textMetric('Lifecycle', data.horse.lifecycleStatus, 'Horse lifecycle from EquineIntelligenceDto'),
        textMetric('Eligibility', data.eligibilityStatus.complianceStatus, 'Eligibility is role/privacy scoped', data.eligibilityStatus.eligible ? 'nominal' : 'warning'),
        textMetric('Veterinary privacy', data.veterinaryStatus.status, 'Restricted data is not shown by default', 'advisory'),
        countMetric('Barn readiness rows', barnData.readiness.length, 'Barn operations workspace backs /barns and /barn-operations aliases'),
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
      metrics: [countMetric('Approval records', context.approvals.length, 'Human decision records only', context.approvals.length ? 'warning' : 'nominal')],
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
        ...libraryData.frameworks.slice(0, 2).map((framework) => ({ id: framework.id, title: framework.name, body: `${framework.authority}; artifact ${framework.accreditationArtifact}.`, status: 'facade-only' as const, evidence: framework.domains })),
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
        countMetric('Investigations', data.investigations.length, 'Open security investigation records'),
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
      body: `${order.priority} priority work order is ${order.status}; approval ${order.approvalRequestId ?? 'not required'}.`,
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
        ...data.approvals.map((approval) => ({
          id: approval.id,
          action: approval.action,
          target: approval.target,
          requestedBy: approval.requestedBy ?? 'facilities-service',
          status: approval.status as ApprovalDto['status'],
          createdAt: approval.createdAt ?? data.generatedAt,
          expiresAt: approval.expiresAt ?? data.generatedAt,
          evidence: approval.evidence,
          mock: false,
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
        { label: 'Open policy', path: '/settings', detail: 'Review payment and protected-data policy.' },
      ],
    }));
    return vm('ticketing', ticketing.source, {
      generatedAt: data.generatedAt,
      metrics: [
        countMetric('Active tickets', data.summary.activeTickets, 'Active tickets from the finance/ticketing service'),
        textMetric('Ticket revenue', formatCurrency(data.summary.grossTicketRevenueCents), 'Gross active-ticket revenue computed by the backend service', 'nominal'),
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
          { label: 'Open approvals', path: '/approvals', detail: 'Review finance approval chain.' },
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
          { label: 'Open approvals', path: '/approvals', detail: 'Review protected payout approvals.' },
          { label: 'Open policy', path: '/settings', detail: 'Review protected payout policy.' },
        ],
      }];
    return vm('finance', finance.source, {
      generatedAt: data.generatedAt,
      metrics: [
        textMetric('Revenue under view', formatCurrency(data.summary.grossTicketRevenueCents), 'Ticket revenue from service state'),
        countMetric('Protected payouts', data.summary.protectedPayouts, 'Released payout records after approval gateway execution', data.summary.protectedPayouts ? 'warning' : 'nominal'),
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
        { id: 'federation-boundary', title: data.dataSharingPolicy.policyId, body: `Allowed exports: ${data.dataSharingPolicy.allowedExports.join(', ')}; prohibited fields: ${data.dataSharingPolicy.prohibitedFields.join(', ')}.`, status: 'facade-only', evidence: ['FederationWorkspaceDto'] },
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
        body: `Provider is ${status}; license posture ${licenseStatus}; sync mode ${String(record.syncMode ?? 'declared')}.`,
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
    const events = requireReady(audit, 'Audit events');
    const critical = events.filter((event) => event.severity === 'critical').length;
    const actors = new Set(events.map((event) => event.actor));
    return vm('audit', audit.source, {
      metrics: [
        countMetric('Audit events', events.length, 'Hash-chained audit records from /audit/events'),
        countMetric('Critical events', critical, 'Critical audit severity count', critical ? 'critical' : 'nominal'),
        countMetric('Actors', actors.size, 'Distinct actors represented in the audit ledger'),
      ],
      panels: events.slice(0, 8).map((event) => ({
        id: event.id,
        title: event.type,
        body: `${event.severity} event by ${event.actor}; hash ${event.hash.slice(0, 12)} follows ${event.previousHash.slice(0, 12)}.`,
        status: 'implemented',
        evidence: [event.hash, event.previousHash, ...(event.evidenceIds ?? [])],
      })),
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
    return vm('admin', health.source, {
      generatedAt: data.generatedAt,
      metrics: [
        textMetric('Platform status', data.overallStatus, 'Platform health from /platform/health', data.overallStatus === 'healthy' ? 'nominal' : data.overallStatus === 'degraded' ? 'warning' : 'critical'),
        countMetric('Services', data.services.length, 'Service health records from the platform health facade'),
        countMetric('Pending approvals', data.approvalEngine.pending, 'Approval engine queue state from platform health', data.approvalEngine.pending ? 'warning' : 'nominal'),
      ],
      panels: [
        ...data.services.slice(0, 4).map((service) => ({ id: service.serviceId, title: service.serviceId, body: `${service.status} service at ${service.latencyMs}ms with ${service.dependencies.length} dependency record(s).`, status: 'facade-only' as const, evidence: service.dependencies.map((dependency) => `${dependency.id}:${dependency.status}`) })),
        { id: 'deployment-boundary', title: 'Deployment boundary', body: data.deploymentBoundary.claim, status: 'facade-only', evidence: data.deploymentBoundary.assumptions },
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
    return vm('settings', policy.source, {
      metrics: [
        textMetric('Execution endpoints', data.executionEndpointsAvailable ? 'Available' : 'Unavailable', 'AI policy endpoint reports whether execution routes are available', data.executionEndpointsAvailable ? 'warning' : 'nominal'),
        countMetric('Protected actions', data.protectedActions.length, 'Actions that require human approval'),
        countMetric('Governance mappings', data.governanceMapping.length, 'ISO/NIST policy mapping records'),
      ],
      panels: [
        { id: data.policyId, title: 'AI advisory-only policy', body: `Allowed activities: ${data.allowedActivities.slice(0, 5).join(', ')}. State changes are draft-only: ${String(data.draftOnlyStateChanges)}.`, status: 'facade-only', evidence: data.requiredEvidence },
        ...data.governanceMapping.slice(0, 3).map((mapping, index) => ({ id: `governance-mapping-${index}`, title: mapping.framework, body: `${mapping.controls.length} control mapping(s); evidence ${mapping.evidence.join(', ') || 'policy evidence pending'}.`, status: 'facade-only' as const, evidence: mapping.evidence })),
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
