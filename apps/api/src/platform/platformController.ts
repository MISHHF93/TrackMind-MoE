import { hasPermission, isRole, type AuditEventDto, type FederationWorkspaceDto, type IncidentDto, type KPIArtifact, type Role } from '@trackmind/shared';
import type { CentralizedApprovalService } from '../approvals.js';
import type { ImmutableAuditLog } from '../auditLog.js';
import type { RacingDataApiFacadeState } from '../racingDataApiHub.js';
import { buildKpiTrendsFromArtifacts, createAnalyticsWorkspace } from './analyticsService.js';
import {
  buildDomainOwnershipRegistry,
  buildExecutiveScorecard,
  buildGovernedArtifactRegistry,
  buildPlatformMaturityReview,
  buildReadinessScorecards,
  buildWorkflowHealth,
  validateGovernanceLineage,
} from './governancePlatformService.js';
import { createAIModelCardRegistry, createAIModelCardList, createAIGovernanceKpiPack, createAIPromptCardList, aiModelCardRegistryStore } from './aiRegistryService.js';
import { createAuditPersistenceAdapter } from '../auditAdapter.js';
import { DurableApprovalStore } from './approvalStore.js';
import { runApprovalEscalationCycle } from './approvalEscalationWorker.js';
import { federationKpiAggregation, executeProviderAdapter } from './dataHubAdapter.js';
import { globalSearch } from './globalSearchService.js';
import { IdentityService } from './identityService.js';
import { IncidentService } from './incidentService.js';
import { kpiCalculationService } from './kpiCalculationService.js';
import { KpiPlatformService } from './kpiPlatformService.js';
import { createMockPlatformHealth } from '../platformObservability.js';
import { notificationFramework } from './notificationFramework.js';
import { createPaddockOperationsWorkspace } from './paddockOperations.js';
import { createRaceScheduleWorkspace } from './raceScheduleService.js';
import { createCommercializationServices, handleCommercializationRequest, type CommercializationServices } from './commercializationController.js';
import { createCustomerManagementServices, handleCustomerManagementRequest, type CustomerManagementServices } from './customerManagementController.js';
import { createNexusPlatformExpansionServices, handleNexusPlatformExpansionRequest, type NexusPlatformExpansionServices } from './nexusPlatformExpansionController.js';
import { FeatureFlagService } from './featureFlags.js';
import { TenantService } from './tenantService.js';

type HttpMethod = 'GET' | 'POST';
type HandlerResult = { status: number; body: unknown } | undefined;

export interface PlatformState {
  auditEvents: AuditEventDto[];
  auditLedger: ImmutableAuditLog;
  approvalService: CentralizedApprovalService;
  kpis: { kpis?: KPIArtifact[] };
  racingData: RacingDataApiFacadeState;
  federation: Record<string, unknown>;
  equine: { horse?: { horseId: string; name?: string } };
  aiControlPlane?: { recommendations?: unknown[] };
}

export interface PlatformServices {
  tenant: TenantService;
  featureFlags: FeatureFlagService;
  identity: IdentityService;
  incidents: IncidentService;
  approvalStore: DurableApprovalStore;
  auditAdapter: ReturnType<typeof createAuditPersistenceAdapter>;
  commercialization: CommercializationServices;
  customerManagement: CustomerManagementServices;
  nexusExpansion: NexusPlatformExpansionServices;
  kpiPlatform: KpiPlatformService;
}

function buildKpiCalculationInput(
  kpis: KPIArtifact[],
  platform: PlatformServices,
  racingData: PlatformState['racingData'],
): Parameters<typeof kpiCalculationService.calculateFromProjections>[1] {
  const readiness = buildReadinessScorecards(kpis);
  return {
    eventCount: platform.incidents.list().length,
    approvalPendingCount: platform.approvalStore.list().filter((a) => a.status === 'pending').length,
    incidentOpenCount: platform.incidents.list().filter((i) => !['resolved', 'closed'].includes(i.status)).length,
    readinessScore: readiness.operational.score,
    domainScores: {
      'race-day-operations': readiness.operational.score,
      'equine-welfare': readiness.equine.score,
      compliance: readiness.compliance.score,
      facilities: readiness.facilities.score,
      security: readiness.security.score,
      'data-quality': kpis.find((kpi) => kpi.domain === 'data-quality')?.value,
      'system-health': kpis.find((kpi) => kpi.domain === 'system-health')?.value,
    },
    dataQualityScore: racingData.dataQualityReports?.[0]?.score != null
      ? Math.round(racingData.dataQualityReports[0].score * 100)
      : undefined,
  };
}

function recalculateAndPersistKpis(state: PlatformState, platform: PlatformServices): KPIArtifact[] {
  const workspace = state.kpis as { kpis?: KPIArtifact[] };
  const synced = platform.kpiPlatform.syncArtifacts(workspace.kpis ?? []);
  const calculated = kpiCalculationService.calculateFromProjections(
    synced,
    buildKpiCalculationInput(synced, platform, state.racingData),
  );
  state.kpis = { kpis: calculated };
  return calculated;
}

export function createPlatformServices(state: PlatformState): PlatformServices {
  const tenant = new TenantService();
  const featureFlags = new FeatureFlagService();
  const identity = new IdentityService();
  const incidents = new IncidentService({
    audit: { ledger: state.auditLedger, adapter: createAuditPersistenceAdapter(state.auditLedger as any), mock: false },
  });
  const approvalStore = new DurableApprovalStore(state.approvalService);
  const auditAdapter = createAuditPersistenceAdapter(state.auditLedger);
  auditAdapter.syncFromLedger(state.auditEvents);
  const base = { tenant, featureFlags, identity, incidents, approvalStore, auditAdapter };
  const commercialization = createCommercializationServices(tenant);
  const customerManagement = createCustomerManagementServices(tenant, commercialization);
  const nexusExpansion = createNexusPlatformExpansionServices(tenant, featureFlags, incidents, commercialization, customerManagement, state);
  const kpiPlatform = new KpiPlatformService((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []);
  return { ...base, commercialization, customerManagement, nexusExpansion, kpiPlatform };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function handlePlatformRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  state: PlatformState,
  platform: PlatformServices,
  searchParams: URLSearchParams,
  actorRole?: Role,
): HandlerResult {
  const tenantId = searchParams.get('tenantId') ?? 'trackmind';
  const racetrackId = searchParams.get('racetrackId') ?? 'main-track';
  const organizationId = searchParams.get('organizationId') ?? 'org-trackmind-network';
  const tenant = platform.tenant.tenants.get(tenantId);
  const tenantFlags = tenant?.featureFlags ?? [];

  const commercializationResponse = handleCommercializationRequest(method, path, body, platform.commercialization, searchParams);
  if (commercializationResponse) return commercializationResponse;

  const customerManagementResponse = handleCustomerManagementRequest(method, path, body, platform.customerManagement, searchParams);
  if (customerManagementResponse) return customerManagementResponse;

  const nexusExpansionResponse = handleNexusPlatformExpansionRequest(method, path, body, platform.nexusExpansion, searchParams);
  if (nexusExpansionResponse) return nexusExpansionResponse;

  if (method === 'GET' && path === '/platform/foundation') {
    return { status: 200, body: platform.tenant.workspace() };
  }
  if (method === 'GET' && path === '/platform/environment') {
    return { status: 200, body: platform.tenant.environmentConfig() };
  }
  if (method === 'GET' && (path === '/organizations' || path === '/platform/organizations')) {
    return { status: 200, body: platform.tenant.organizations.list() };
  }
  if (method === 'POST' && (path === '/organizations' || path === '/platform/organizations')) {
    const name = isRecord(body) ? String(body.name ?? 'New Organization') : 'New Organization';
    return { status: 201, body: platform.tenant.createOrganization({ name }) };
  }
  if (method === 'GET' && (path === '/tenants' || path === '/platform/tenants')) {
    return { status: 200, body: platform.tenant.tenants.list() };
  }
  if (method === 'POST' && (path === '/tenants' || path === '/platform/tenants')) {
    const orgId = isRecord(body) ? String(body.organizationId ?? 'org-trackmind-network') : 'org-trackmind-network';
    const name = isRecord(body) ? String(body.name ?? 'New Tenant') : 'New Tenant';
    return { status: 201, body: platform.tenant.createTenant({ organizationId: orgId, name }) };
  }
  if (method === 'GET' && (path === '/racetracks' || path === '/platform/racetracks')) {
    return { status: 200, body: platform.tenant.racetracks.list() };
  }
  if (method === 'POST' && (path === '/racetracks' || path === '/platform/racetracks')) {
    const input = isRecord(body) ? body : {};
    return {
      status: 201,
      body: platform.tenant.createRacetrack({
        tenantId: String(input.tenantId ?? tenantId),
        organizationId: String(input.organizationId ?? 'org-trackmind-network'),
        name: String(input.name ?? 'New Racetrack'),
        jurisdiction: String(input.jurisdiction ?? 'US'),
      }),
    };
  }
  if (method === 'GET' && path === '/platform/feature-flags') {
    return { status: 200, body: platform.featureFlags.list() };
  }
  if (method === 'GET' && path === '/platform/feature-flags/evaluate') {
    const key = searchParams.get('key');
    if (key) return { status: 200, body: platform.featureFlags.evaluate(key, tenantFlags) };
    return { status: 200, body: platform.featureFlags.evaluateAll(tenantFlags) };
  }
  if (method === 'GET' && path === '/identity/workspace') {
    return { status: 200, body: platform.identity.workspace() };
  }
  if (method === 'GET' && path === '/platform/users') {
    return { status: 200, body: platform.identity.listUsers(tenantId) };
  }
  if (method === 'POST' && path === '/platform/users') {
    const input = isRecord(body) ? body : {};
    try {
      return {
        status: 201,
        body: platform.identity.createUser({
          tenantId: String(input.tenantId ?? tenantId),
          organizationId: String(input.organizationId ?? organizationId),
          displayName: String(input.displayName ?? 'New User'),
          email: String(input.email ?? 'user@trackmind.local'),
          roles: Array.isArray(input.roles) ? input.roles.map(String).filter(isRole) as Role[] : undefined,
          status: (input.status === 'active' || input.status === 'pending' || input.status === 'suspended')
            ? input.status
            : undefined,
        }),
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'GET' && path === '/platform/roles') {
    return { status: 200, body: platform.identity.listRoles() };
  }
  if (method === 'POST' && path === '/platform/roles') {
    const input = isRecord(body) ? body : {};
    try {
      return {
        status: 201,
        body: platform.identity.assignRole(
          String(input.userId ?? ''),
          String(input.role ?? '') as Role,
          String(input.tenantId ?? tenantId),
          actorRole,
        ),
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'GET' && path === '/platform/access-requests') {
    return { status: 200, body: platform.identity.listAccessRequests(tenantId) };
  }
  if (method === 'POST' && path === '/platform/access-requests') {
    const input = isRecord(body) ? body : {};
    if (input.requestId && input.decision) {
      if (!actorRole || !hasPermission(actorRole, 'access:approve')) {
        return {
          status: 403,
          body: { ok: false, error: { code: 'forbidden', message: 'Reviewer role requires access:approve permission' } },
        };
      }
      try {
        return {
          status: 200,
          body: platform.identity.reviewAccessRequest(
            String(input.requestId),
            input.decision === 'approved' ? 'approved' : 'rejected',
            String(input.reviewedBy ?? actorRole),
          ),
        };
      } catch (error) {
        return { status: 404, body: { ok: false, error: { code: 'not_found', message: (error as Error).message } } };
      }
    }
    const userId = String(input.userId ?? 'user-steward-1');
    const requestedRole = String(input.requestedRole ?? 'read-only-auditor');
    try {
      return {
        status: 201,
        body: platform.identity.requestAccess(userId, requestedRole, String(input.tenantId ?? tenantId)),
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'POST' && path === '/identity/access-requests') {
    const userId = isRecord(body) ? String(body.userId ?? 'user-admin-1') : 'user-admin-1';
    const requestedRole = isRecord(body) ? String(body.requestedRole ?? 'read-only-auditor') : 'read-only-auditor';
    return { status: 201, body: platform.identity.requestAccess(userId, requestedRole, tenantId) };
  }
  if (method === 'GET' && path === '/audit/search') {
    return {
      status: 200,
      body: platform.auditAdapter.search(
        {
          actorId: searchParams.get('actorId') ?? undefined,
          domain: searchParams.get('domain') ?? undefined,
          correlationId: searchParams.get('correlationId') ?? undefined,
          from: searchParams.get('from') ?? undefined,
          to: searchParams.get('to') ?? undefined,
          limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
          offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
        },
        state.auditEvents as AuditEventDto[],
      ),
    };
  }
  if (method === 'GET' && path === '/approvals/durable') {
    platform.approvalStore.processExpirations();
    return { status: 200, body: platform.approvalStore.list() };
  }
  if (method === 'POST' && path === '/approvals/escalation/simulate') {
    const input = isRecord(body) ? body : {};
    const simulatedAt = typeof input.now === 'string' ? input.now : new Date().toISOString();
    const result = runApprovalEscalationCycle({
      approvalService: state.approvalService,
      durableStore: platform.approvalStore,
      now: simulatedAt,
      reminderLeadMinutes: typeof input.reminderLeadMinutes === 'number' ? input.reminderLeadMinutes : undefined,
    });
    return {
      status: 200,
      body: {
        ...result,
        approvals: platform.approvalStore.list(),
        mock: false,
      },
    };
  }
  if (method === 'POST' && path === '/kpis/recalculate') {
    const calculated = recalculateAndPersistKpis(state, platform);
    return { status: 200, body: { generatedAt: new Date().toISOString(), kpis: calculated, mock: false } };
  }
  if (method === 'GET' && path === '/kpis/registry') {
    const workspace = state.kpis as { kpis?: KPIArtifact[] };
    return {
      status: 200,
      body: platform.kpiPlatform.registry({ tenantId, organizationId, racetrackId }, workspace.kpis ?? []),
    };
  }
  if (method === 'GET' && path === '/kpis/definitions') {
    return { status: 200, body: platform.kpiPlatform.listDefinitions({ tenantId, organizationId, racetrackId }) };
  }
  const kpiDefinitionMatch = path.match(/^\/kpis\/definitions\/([^/]+)$/);
  if (method === 'GET' && kpiDefinitionMatch) {
    const definition = platform.kpiPlatform.getDefinition(decodeURIComponent(kpiDefinitionMatch[1]));
    return definition
      ? { status: 200, body: definition }
      : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'KPI definition not found' } } };
  }
  if (method === 'POST' && path === '/kpis/definitions/draft-requests') {
    const input = isRecord(body) ? body : {};
    try {
      return {
        status: 202,
        body: platform.kpiPlatform.createDefinitionDraft({
          kpiId: String(input.kpiId ?? `kpi-custom-${Date.now().toString(36)}`),
          domain: String(input.domain ?? 'system-health') as KPIArtifact['domain'],
          name: String(input.name ?? 'Custom KPI'),
          description: String(input.description ?? 'Draft KPI definition'),
          metricType: String(input.metricType ?? 'score') as KPIArtifact['metricType'],
          unit: String(input.unit ?? 'score'),
          target: Number(input.target ?? 90),
          ownerRole: String(input.ownerRole ?? actorRole ?? 'admin') as Role,
          visibility: String(input.visibility ?? 'tenant-internal') as KPIArtifact['visibility'],
          approvalSensitivity: String(input.approvalSensitivity ?? 'approval-visible') as KPIArtifact['approvalSensitivity'],
          calculationMethod: String(input.calculationMethod ?? 'Draft KPI calculation from event projections.'),
          refreshCadence: String(input.refreshCadence ?? '5m'),
          sourceEvents: Array.isArray(input.sourceEvents) ? input.sourceEvents.map(String) : ['platform.health.checked'],
          sourceEntities: Array.isArray(input.sourceEntities)
            ? input.sourceEntities.filter(isRecord).map((entity) => ({ entityType: String(entity.entityType), entityId: String(entity.entityId) }))
            : [{ entityType: 'platform-health', entityId: 'trackmind-api' }],
          requestedBy: String(input.requestedBy ?? 'admin'),
          reason: String(input.reason ?? 'KPI definition draft request'),
          evidence: Array.isArray(input.evidence) ? input.evidence.map(String) : ['kpi-definition-draft'],
        }, { tenantId, organizationId, racetrackId }),
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'GET' && path === '/kpis/thresholds') {
    return { status: 200, body: platform.kpiPlatform.listThresholds({ tenantId, organizationId, racetrackId }) };
  }
  if (method === 'POST' && path === '/kpis/thresholds/draft-requests') {
    const input = isRecord(body) ? body : {};
    try {
      const result = platform.kpiPlatform.createThresholdDraft({
        kpiId: String(input.kpiId),
        warning: input.warning != null ? Number(input.warning) : undefined,
        critical: input.critical != null ? Number(input.critical) : undefined,
        targetDirection: String(input.targetDirection ?? 'above') as KPIArtifact['threshold']['targetDirection'],
        description: String(input.description ?? 'Threshold change draft'),
        requestedBy: String(input.requestedBy ?? 'admin'),
        reason: String(input.reason ?? 'KPI threshold change request'),
        evidence: Array.isArray(input.evidence) ? input.evidence.map(String) : ['kpi-threshold-draft'],
      }, { tenantId, organizationId, racetrackId }, state.approvalService);
      recalculateAndPersistKpis(state, platform);
      return { status: 202, body: result };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'GET' && path === '/kpis/sources') {
    const workspace = state.kpis as { kpis?: KPIArtifact[] };
    return { status: 200, body: platform.kpiPlatform.consolidatedSources(workspace.kpis ?? []) };
  }
  if (method === 'GET' && path === '/platform/domain-ownership') {
    return { status: 200, body: buildDomainOwnershipRegistry((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []) };
  }
  if (method === 'GET' && path === '/platform/governance-lineage/validation') {
    const recommendations = Array.isArray(state.aiControlPlane?.recommendations)
      ? state.aiControlPlane.recommendations
      : [];
    return {
      status: 200,
      body: validateGovernanceLineage({
        kpis: (state.kpis as { kpis?: KPIArtifact[] }).kpis ?? [],
        auditEvents: state.auditEvents as AuditEventDto[],
        recommendations,
        approvalService: state.approvalService,
        notificationCount: notificationFramework.count(),
      }),
    };
  }
  if (method === 'GET' && path === '/platform/readiness-scorecards') {
    return { status: 200, body: buildReadinessScorecards((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []) };
  }
  if (method === 'GET' && path === '/platform/executive-scorecard') {
    return { status: 200, body: buildExecutiveScorecard((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []) };
  }
  if (method === 'GET' && path === '/platform/workflow-health') {
    return { status: 200, body: buildWorkflowHealth(createMockPlatformHealth()) };
  }
  if (method === 'GET' && path === '/platform/governed-artifacts') {
    return { status: 200, body: buildGovernedArtifactRegistry((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? [], state.approvalService) };
  }
  if (method === 'GET' && path === '/platform/maturity-review') {
    const kpis = (state.kpis as { kpis?: KPIArtifact[] }).kpis ?? [];
    const readiness = buildReadinessScorecards(kpis);
    const executive = buildExecutiveScorecard(kpis);
    const recommendations = Array.isArray(state.aiControlPlane?.recommendations)
      ? state.aiControlPlane.recommendations
      : [];
    const lineageReport = validateGovernanceLineage({
      kpis,
      auditEvents: state.auditEvents as AuditEventDto[],
      recommendations,
      approvalService: state.approvalService,
      notificationCount: notificationFramework.count(),
    });
    return {
      status: 200,
      body: buildPlatformMaturityReview({
        lineageReport,
        readiness,
        executive,
        workflowHealth: buildWorkflowHealth(createMockPlatformHealth()),
        notificationCoverage: notificationFramework.count() > 0,
      }),
    };
  }
  if (method === 'GET' && path === '/analytics/workspace') {
    const calculated = recalculateAndPersistKpis(state, platform);
    const executive = buildExecutiveScorecard(calculated);
    const kpiTrends = buildKpiTrendsFromArtifacts(calculated);
    const federationAggregation = federationKpiAggregation(state.federation as unknown as FederationWorkspaceDto);
    return { status: 200, body: createAnalyticsWorkspace(kpiTrends, executive, calculated, federationAggregation) };
  }
  if (method === 'GET' && path === '/race-operations/paddock') {
    return { status: 200, body: createPaddockOperationsWorkspace(tenantId, racetrackId) };
  }
  if (method === 'GET' && path === '/race-operations/schedule') {
    return { status: 200, body: createRaceScheduleWorkspace({ tenantId, racetrackId }) };
  }
  if (method === 'GET' && path === '/incidents') {
    return { status: 200, body: platform.incidents.list() };
  }
  if (method === 'GET' && path === '/incidents/kpi-pack') {
    return { status: 200, body: platform.incidents.computeSafetyKpiPack() };
  }
  const incidentTriageMatch = path.match(/^\/incidents\/([^/]+)\/triage$/);
  if (method === 'POST' && incidentTriageMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = platform.incidents.triage(decodeURIComponent(incidentTriageMatch[1]), {
        severity: (input.severity as IncidentDto['severity']) ?? 'medium',
        assignedTo: String(input.assignedTo ?? 'incident-commander'),
        actor: String(input.actor ?? actorRole ?? 'security'),
        note: input.note ? String(input.note) : undefined,
      });
      recalculateAndPersistKpis(state, platform);
      return { status: 200, body: updated };
    } catch {
      return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
    }
  }
  const incidentReviewMatch = path.match(/^\/incidents\/([^/]+)\/post-incident-review$/);
  if (method === 'POST' && incidentReviewMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const findings = Array.isArray(input.findings)
        ? input.findings.filter(isRecord).map((finding) => ({
            finding: String(finding.finding ?? ''),
            severity: (finding.severity as IncidentDto['severity']) ?? 'medium',
            owner: String(finding.owner ?? 'safety-officer'),
          }))
        : [{ finding: String(input.finding ?? 'Review completed'), severity: 'medium' as const, owner: String(input.owner ?? 'safety-officer') }];
      const result = platform.incidents.submitPostIncidentReview(decodeURIComponent(incidentReviewMatch[1]), {
        findings,
        submittedBy: String(input.submittedBy ?? actorRole ?? 'safety-officer'),
        evidence: Array.isArray(input.evidence) ? input.evidence.map(String) : undefined,
      });
      recalculateAndPersistKpis(state, platform);
      return { status: 201, body: result };
    } catch {
      return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
    }
  }
  const incidentMatch = path.match(/^\/incidents\/([^/]+)$/);
  if (method === 'GET' && incidentMatch) {
    const incident = platform.incidents.get(decodeURIComponent(incidentMatch[1]));
    return incident ? { status: 200, body: incident } : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
  }
  if (method === 'POST' && path === '/incidents') {
    const input = isRecord(body) ? body : {};
    const created = platform.incidents.create({
      tenantId: String(input.tenantId ?? tenantId),
      racetrackId: String(input.racetrackId ?? racetrackId),
      title: String(input.title ?? 'New incident'),
      description: String(input.description ?? ''),
      severity: (input.severity as IncidentDto['severity']) ?? 'medium',
      status: 'reported',
      category: (input.category as IncidentDto['category']) ?? 'operational',
      reportedBy: String(input.reportedBy ?? 'operator'),
    });
    recalculateAndPersistKpis(state, platform);
    return { status: 201, body: created };
  }
  if (method === 'POST' && incidentMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = platform.incidents.update(decodeURIComponent(incidentMatch[1]), {
        status: input.status as IncidentDto['status'] | undefined,
        severity: input.severity as IncidentDto['severity'] | undefined,
        assignedTo: input.assignedTo ? String(input.assignedTo) : undefined,
        note: input.note ? String(input.note) : undefined,
        actor: input.actor ? String(input.actor) : undefined,
      });
      recalculateAndPersistKpis(state, platform);
      return { status: 200, body: updated };
    } catch {
      return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
    }
  }
  if (method === 'GET' && path === '/ai-governance/model-registry') {
    return { status: 200, body: createAIModelCardRegistry() };
  }
  if (method === 'GET' && path === '/ai-governance/model-cards') {
    return { status: 200, body: createAIModelCardList() };
  }
  if (method === 'GET' && path === '/ai-governance/prompt-cards') {
    return { status: 200, body: createAIPromptCardList() };
  }
  if (method === 'GET' && path === '/ai-governance/kpi-pack') {
    const recommendations = state.aiControlPlane?.recommendations;
    const recommendationCount = Array.isArray(recommendations) ? recommendations.length : 0;
    return { status: 200, body: createAIGovernanceKpiPack(recommendationCount) };
  }
  if (method === 'POST' && path === '/ai-governance/model-registry/models') {
    const input = isRecord(body) ? body : {};
    try {
      return { status: 201, body: aiModelCardRegistryStore.registerModel({
        id: String(input.id ?? ''),
        name: String(input.name ?? ''),
        version: String(input.version ?? ''),
        riskLevel: String(input.riskLevel ?? 'medium'),
        path: String(input.path ?? ''),
        lastEvaluatedAt: typeof input.lastEvaluatedAt === 'string' ? input.lastEvaluatedAt : undefined,
      }) };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'POST' && path === '/ai-governance/model-registry/prompts') {
    const input = isRecord(body) ? body : {};
    try {
      const lineage = Array.isArray(input.lineage) ? input.lineage.map((ref) => String(ref)) : [];
      return { status: 201, body: aiModelCardRegistryStore.registerPrompt({
        id: String(input.id ?? ''),
        name: String(input.name ?? ''),
        version: String(input.version ?? ''),
        path: String(input.path ?? ''),
        lineage,
      }) };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  const providerAdapterMatch = path.match(/^\/racing-data\/providers\/([^/]+)\/invoke$/);
  if (method === 'POST' && providerAdapterMatch) {
    const result = executeProviderAdapter(decodeURIComponent(providerAdapterMatch[1]), state.racingData);
    return result ? { status: 202, body: result } : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Provider not found' } } };
  }
  if (method === 'GET' && path === '/federation/kpi-aggregation') {
    return { status: 200, body: federationKpiAggregation(state.federation as unknown as FederationWorkspaceDto) };
  }
  if (method === 'GET' && path === '/search/global') {
    const q = searchParams.get('q') ?? '';
    const equine = state.equine as { horse?: { horseId: string; name?: string } };
    const recommendations = Array.isArray(state.aiControlPlane?.recommendations)
      ? state.aiControlPlane.recommendations.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      : [];
    return {
      status: 200,
      body: globalSearch(q, {
        horses: equine?.horse ? [{ id: equine.horse.horseId, name: equine.horse.name ?? equine.horse.horseId }] : [],
        incidents: platform.incidents.list().map((i) => ({ id: i.id, title: i.title })),
        auditEvents: (state.auditEvents as AuditEventDto[]).map((e) => ({ id: e.id, type: e.type, action: e.action })),
        kpis: ((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []).map((k) => ({ kpiId: k.kpiId, label: k.name })),
        twins: [{ id: 'twin:horse:horse-1', label: equine?.horse?.name ?? 'Horse Twin', twinType: 'horse' }],
        recommendations: recommendations.map((item, index) => ({
          id: String(item.id ?? `rec-${index + 1}`),
          title: String(item.title ?? item.summary ?? 'AI recommendation'),
        })),
      }),
    };
  }
  if (method === 'GET' && path === '/notifications/inbox') {
    const role = searchParams.get('role') ?? undefined;
    return { status: 200, body: notificationFramework.inbox(role ?? undefined) };
  }
  if (method === 'GET' && path === '/notifications/delivery-adapters') {
    return {
      status: 200,
      body: {
        generatedAt: new Date().toISOString(),
        adapters: notificationFramework.deliveryAdapters(),
        stats: notificationFramework.deliveryStats(),
        mock: false,
      },
    };
  }
  if (method === 'POST' && path === '/notifications/acknowledge') {
    const id = isRecord(body) ? String(body.id ?? '') : '';
    const ok = notificationFramework.acknowledge(id);
    return { status: ok ? 200 : 404, body: { ok, id } };
  }
  if (method === 'GET' && path === '/platform/modules') {
    const modules = ['dashboard', 'raceDay', 'equine', 'analytics', 'fanExperience', 'incidents', 'finance', 'admin'];
    const entitlement = platform.commercialization.entitlements.evaluate(organizationId, tenantId);
    return {
      status: 200,
      body: modules.map((key) => {
        const licensed = entitlement.modules.find((m) => m.key === key)?.enabled ?? false;
        const flagEnabled = platform.featureFlags.isModuleEnabled(key, tenantFlags);
        return { moduleKey: key, enabled: licensed && flagEnabled };
      }),
    };
  }

  return undefined;
}
