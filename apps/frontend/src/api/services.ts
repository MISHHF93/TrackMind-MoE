import type {
  AIGovernanceWorkspaceDto,
  AIControlPlaneRecommendationDto,
  AIRecommendationDto,
  ApprovalDto,
  AuditEventDto,
  EquineIntelligenceDto,
  FederationWorkspaceDto,
  KPIWorkspaceDto,
  OperationsCommandCenterDto,
  PlatformHealthWorkspaceDto,
  RaceDto,
} from '@trackmind/shared';
import { getJson, type AdapterResult } from './client';
import { apiPaths } from './paths';
import { mockUnsupportedDomain } from '../mocks/domainMocks';
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

function asArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter((item): item is UnknownRecord => Boolean(item && typeof item === 'object')) : [];
}

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

export const dashboardService = {
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

export const raceDayService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [races, raceOffice, context] = await Promise.all([
      getJson<RaceDto[]>(apiPaths.raceDay.races),
      getJson<UnknownRecord>(apiPaths.raceDay.raceOffice),
      commonContext(),
    ]);
    const raceRows = requireReady(races, 'Race summaries');
    const raceOfficeData = requireReady(raceOffice, 'Race office workspace');
    return vm('raceDay', races.source, {
      generatedAt: String(raceOfficeData.generatedAt ?? ''),
      metrics: [
        countMetric('Races', raceRows.length, 'Race readiness summaries from /races'),
        countMetric('Blocked approvals', raceRows.reduce((sum, race) => sum + race.approvals, 0), 'Race-day controls remain approval-only', 'warning'),
        textMetric('Direct execution', 'Locked', 'Race starts/stops/results are not exposed as frontend actions', 'critical'),
      ],
      panels: raceRows.map((race) => ({ id: race.raceId, title: `Race ${race.raceId}`, body: `${race.status} score ${race.score}; warnings ${race.warnings}`, status: 'facade-only', evidence: ['RaceDto', '/api/v1/races'] })),
      ...context,
    });
  },
};

export const equineService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [horse, context] = await Promise.all([getJson<EquineIntelligenceDto>(apiPaths.equine.horse), commonContext()]);
    const data = requireReady(horse, 'Equine intelligence horse profile');
    return vm('equine', horse.source, {
      metrics: [
        textMetric('Lifecycle', data.horse.lifecycleStatus, 'Horse lifecycle from EquineIntelligenceDto'),
        textMetric('Eligibility', data.eligibilityStatus.complianceStatus, 'Eligibility is role/privacy scoped', data.eligibilityStatus.eligible ? 'nominal' : 'warning'),
        textMetric('Veterinary privacy', data.veterinaryStatus.status, 'Restricted data is not shown by default', 'advisory'),
      ],
      panels: [
        { id: data.horse.horseId, title: data.horse.name, body: `${data.welfareStatus.level} welfare status; barn ${data.barnAssignment.barnId}`, status: 'facade-only', evidence: ['EquineIntelligenceDto', '/equine-intelligence/horses/{horseId}'] },
      ],
      ...context,
    });
  },
};

export const approvalsService = {
  support: 'live-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const context = await commonContext();
    return vm('approvals', 'live-api', {
      metrics: [countMetric('Approval records', context.approvals.length, 'Human decision records only', context.approvals.length ? 'warning' : 'nominal')],
      panels: context.approvals.map((approval) => ({ id: approval.id, title: approval.action, body: `${approval.status} for ${approval.target}; roles ${approval.requiredRoles?.join(', ') ?? 'declared by policy'}`, status: 'implemented', evidence: approval.evidence })),
      ...context,
    });
  },
};

export const incidentsService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [security, emergency, context] = await Promise.all([getJson<UnknownRecord>(apiPaths.incidents.security), getJson<UnknownRecord>(apiPaths.incidents.emergency), commonContext()]);
    const securityData = requireReady(security, 'Security operations workspace');
    const emergencyData = requireReady(emergency, 'Emergency operations workspace');
    const incidentRows = [...asArray(securityData.incidents), ...asArray(emergencyData.events)];
    return vm('incidents', security.source, {
      metrics: [countMetric('Incident signals', incidentRows.length, 'Security and emergency facade incident/event rows', incidentRows.length ? 'warning' : 'nominal')],
      panels: incidentRows.slice(0, 6).map((incident, index) => ({ id: String(incident.id ?? `incident-${index}`), title: String(incident.title ?? incident.type ?? 'Incident'), body: String(incident.summary ?? incident.description ?? incident.status ?? 'Audit-linked incident signal'), status: 'facade-only', evidence: ['security-operations', 'emergency-operations'] })),
      ...context,
    });
  },
};

export const complianceService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [library, context] = await Promise.all([getJson<UnknownRecord>(apiPaths.compliance.library), commonContext()]);
    const libraryData = requireReady(library, 'Compliance control library');
    const controls = asArray(libraryData.controls);
    return vm('compliance', library.source, {
      metrics: [countMetric('Controls', controls.length, 'Compliance control library from backend facade'), textMetric('Certification', 'Readiness only', 'No external certification is claimed', 'advisory')],
      panels: controls.slice(0, 6).map((control, index) => ({ id: String(control.id ?? `control-${index}`), title: String(control.title ?? control.framework ?? 'Control'), body: String(control.description ?? control.status ?? 'Mapped readiness control'), status: 'facade-only', evidence: ['compliance-control-library'] })),
      ...context,
    });
  },
};

export const securityService = domainRecordService('security', 'security', apiPaths.security.workspace, 'Security operation state is backend facade-supported and role-gated.');
export const facilitiesService = domainRecordService('facilities', 'facilities', apiPaths.facilities.workspace, 'Facilities maintenance is a backend mock/facade workspace; execution remains approval-gated.', 'mock-adapter');

export const ticketingService = mockService('ticketing', 'Ticketing has shared permissions and documented intent, but no dedicated backend route in the active API facade.');
export const financeService = mockService('finance', 'Finance has permissions and protected payout rules, but no dedicated active screen route; payouts remain forbidden without approval.');

export const federationService = {
  support: 'facade-api' as const,
  async load(): Promise<WorkspaceViewModel> {
    const [federation, context] = await Promise.all([getJson<FederationWorkspaceDto>(apiPaths.federation.workspace), commonContext()]);
    const data = requireReady(federation, 'Federation workspace');
    return vm('federation', federation.source, {
      metrics: [
        textMetric('Raw data exposure', data.rawDataExposure.exposed ? 'Blocked' : 'None', 'Federation is aggregate-only and permission governed', 'nominal'),
        countMetric('Benchmark metrics', data.crossTrackBenchmarking.metrics.length, 'Anonymized benchmark metadata only'),
      ],
      panels: [
        { id: 'federation-boundary', title: data.dataSharingPolicy.policyId, body: `Allowed exports: ${data.dataSharingPolicy.allowedExports.join(', ')}; prohibited fields: ${data.dataSharingPolicy.prohibitedFields.join(', ')}`, status: 'facade-only', evidence: ['FederationWorkspaceDto'] },
      ],
      ...context,
    });
  },
};

export const dataHubService = domainRecordService('dataHub', 'data-hub', apiPaths.dataHub.workspace, 'Racing Data API Hub exposes licensed-provider readiness only; no active external integration is claimed.');
export const auditService = domainRecordService('audit', 'audit', apiPaths.audit.events, 'Audit view uses hash-chain event records and approval references.');
export const adminService = domainRecordService('admin', 'admin', apiPaths.admin.platformHealth, 'Admin has no dedicated backend contract; this page reads platform metadata only.', 'documented-stub');
export const settingsService = domainRecordService('settings', 'settings', apiPaths.settings.policy, 'Settings has no dedicated backend contract; this page reads AI policy metadata only.', 'documented-stub');

function domainRecordService(routeId: DomainRouteId, domain: string, path: string, detail: string, support: WorkspaceViewModel['source'] = 'facade-api') {
  return {
    support,
    async load(): Promise<WorkspaceViewModel> {
      const [result, context] = await Promise.all([getJson<unknown>(path), commonContext()]);
      const data = requireReady(result, `${domain} workspace`);
      const rows = Array.isArray(data) ? data as unknown[] : [data];
      return vm(routeId, support, {
        metrics: [countMetric('Records', rows.length, detail, rows.length ? 'nominal' : 'advisory')],
        panels: rows.slice(0, 6).map((row, index) => recordPanel(domain, row, index)),
        ...context,
      });
    },
  };
}

function mockService(routeId: DomainRouteId, detail: string) {
  return {
    support: 'mock-adapter' as const,
    async load(): Promise<WorkspaceViewModel> {
      const fallback = mockUnsupportedDomain(routeId, detail);
      return vm(routeId, 'mock-adapter', {
        generatedAt: fallback.generatedAt,
        metrics: [textMetric('Backend support', 'Mock adapter', detail, 'advisory')],
        panels: fallback.panels.map((panel) => ({ id: panel.id, title: panel.label, body: panel.detail, status: panel.status, evidence: panel.evidence })),
        approvals: [],
        aiRecommendations: fallback.aiRecommendations,
        auditEvents: fallback.auditEvents,
        kpis: [],
      });
    },
  };
}

function recordPanel(domain: string, row: unknown, index: number): WorkspacePanel {
  const record = row && typeof row === 'object' ? row as UnknownRecord : {};
  return {
    id: String(record.id ?? record.serviceId ?? record.generatedAt ?? `${domain}-${index}`),
    title: String(record.name ?? record.label ?? record.serviceId ?? `${domain} record ${index + 1}`),
    body: String(record.description ?? record.status ?? record.overallStatus ?? record.schemaVersion ?? 'Backend facade record'),
    status: 'facade-only',
    evidence: [domain, 'backend route adapter'],
  };
}

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
