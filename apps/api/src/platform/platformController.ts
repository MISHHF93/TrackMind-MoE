import { hasPermission, isRole, type AuditEventDto, type FederationWorkspaceDto, type IncidentDto, type KPIArtifact, type Role } from '@trackmind/shared';
import type { CentralizedApprovalService } from '../approvals.js';
import type { ImmutableAuditLog } from '../auditLog.js';
import type { RacingDataApiFacadeState } from '../racingDataApiHub.js';
import { buildAnalyticsWorkspaceStreamBody, buildKpiTrendsFromArtifacts, createAnalyticsWorkspace } from './analyticsService.js';
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
import { appendAudit, createAuditPersistenceAdapter } from '../auditAdapter.js';
import { createAuditVaultAdapter, type AuditVaultAdapter } from '../auditVaultAdapter.js';
import { DurableApprovalStore } from './approvalStore.js';
import { runApprovalEscalationCycle } from './approvalEscalationWorker.js';
import { federationKpiAggregation, invokeProviderAdapter, toInvokeResult } from './dataHubAdapter.js';
import { createRacingDataLicenseDenied } from '../racingDataApiHub.js';
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
import type { UniversalEventBus } from '../eventBus.js';

type HttpMethod = 'GET' | 'POST';
type HandlerResult = { status: number; body: unknown; headers?: Record<string, string> } | undefined;

export interface PlatformState {
  auditEvents: AuditEventDto[];
  auditLedger: ImmutableAuditLog;
  auditAdapter?: ReturnType<typeof createAuditPersistenceAdapter>;
  auditVault?: AuditVaultAdapter;
  approvalService: CentralizedApprovalService;
  eventBus?: UniversalEventBus;
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
  auditVault: AuditVaultAdapter;
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
  const auditAdapter = state.auditAdapter ?? createAuditPersistenceAdapter(state.auditLedger);
  auditAdapter.syncFromLedger(state.auditEvents);
  const auditVault = state.auditVault ?? createAuditVaultAdapter();
  auditVault.syncFromEvents(state.auditEvents);
  const auditTarget = { ledger: state.auditLedger, adapter: auditAdapter, vault: auditVault, mock: false };
  const incidents = new IncidentService({
    audit: auditTarget,
    eventBus: state.eventBus,
  });
  const approvalStore = new DurableApprovalStore(state.approvalService);
  const base = { tenant, featureFlags, identity, incidents, approvalStore, auditAdapter, auditVault };
  const commercialization = createCommercializationServices(tenant);
  const customerManagement = createCustomerManagementServices(tenant, commercialization);
  const nexusExpansion = createNexusPlatformExpansionServices(tenant, featureFlags, incidents, commercialization, customerManagement, state);
  const kpiPlatform = new KpiPlatformService((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []);
  return { ...base, commercialization, customerManagement, nexusExpansion, kpiPlatform };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function recordRacingDataProviderAudit(
  platform: PlatformServices,
  state: PlatformState,
  providerId: string,
  actor: string,
  tenantId: string,
  racetrackId: string,
  payload: Record<string, unknown>,
): AuditEventDto {
  const auditId = `audit-racing-data-provider-${providerId}-${Date.now().toString(36)}`;
  const audit = appendAudit(
    { ledger: state.auditLedger, adapter: platform.auditAdapter, vault: platform.auditVault },
    {
      id: auditId,
      type: 'data-change' as const,
      actor,
      actorType: 'human' as const,
      timestamp: new Date().toISOString(),
      action: 'racing-data.provider.invoked',
      actionClass: 'compliance' as const,
      subjectId: providerId,
      payload,
      correlationId: String(payload.correlationId ?? providerId),
      tenantId,
      racetrackId,
      severity: 'info',
      regulations: ['RacingDataAPIHub'],
      evidence: [{ id: providerId, uri: `audit://racing-data/providers/${providerId}`, description: 'Licensed provider adapter simulation invoke' }],
    },
  );
  state.auditEvents.push(audit);
  return audit;
}

function recordAiRegistryAudit(
  platform: PlatformServices,
  state: PlatformState,
  action: 'ai.model-card.registered' | 'ai.prompt-card.registered' | 'ai.prompt-lineage.draft.created' | 'ai.prompt-lineage.published',
  subjectId: string,
  actor: string,
  tenantId: string,
  racetrackId: string,
  payload: Record<string, unknown>,
): AuditEventDto {
  const auditId = `audit-ai-registry-${subjectId}-${Date.now().toString(36)}`;
  const audit = appendAudit(
    { ledger: state.auditLedger, adapter: platform.auditAdapter, vault: platform.auditVault },
    {
      id: auditId,
      type: 'ai-recommendation',
      actor,
      actorType: 'human',
      timestamp: new Date().toISOString(),
      action,
      actionClass: 'ai',
      subjectId,
      payload,
      correlationId: subjectId,
      tenantId,
      racetrackId,
      severity: 'info',
      regulations: ['ISO42001', 'NIST-AI-RMF'],
      evidence: [{ id: subjectId, uri: `audit://ai-governance/${subjectId}`, description: action }],
    },
  );
  state.auditEvents.push(audit);
  return audit;
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
    const query = {
      actorId: searchParams.get('actorId') ?? undefined,
      domain: searchParams.get('domain') ?? undefined,
      correlationId: searchParams.get('correlationId') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
      action: (searchParams.get('action') === 'export' ? 'export' : 'search') as 'search' | 'export',
      format: (searchParams.get('format') === 'ndjson' ? 'ndjson' : 'json') as 'json' | 'ndjson',
    };
    const fallbackEvents = state.auditEvents as AuditEventDto[];
    if (query.action === 'export') {
      if (!platform.auditVault.enabled) {
        return { status: 503, body: { ok: false, error: { code: 'audit_vault_disabled', message: 'External audit vault is not enabled.' } } };
      }
      const events = platform.auditAdapter.search(query, fallbackEvents);
      const exportPackage = platform.auditVault.createExport(
        { ...query, generatedBy: actorRole ?? 'audit-search' },
        events,
      );
      return { status: 200, body: exportPackage };
    }
    return {
      status: 200,
      body: platform.auditAdapter.search(query, fallbackEvents),
    };
  }
  if (method === 'GET' && path === '/audit/exports') {
    const exportId = searchParams.get('exportId') ?? undefined;
    if (exportId) {
      const descriptor = platform.auditVault.getExport(exportId);
      if (!descriptor) {
        return { status: 404, body: { ok: false, error: { code: 'not_found', message: `Unknown audit vault export ${exportId}` } } };
      }
      const blob = platform.auditVault.getExportBlob(exportId);
      if (searchParams.get('download') === 'true' && blob) {
        return {
          status: 200,
          headers: { 'content-type': blob.mimeType, 'content-disposition': `attachment; filename="${exportId}.${descriptor.format === 'ndjson' ? 'ndjson' : 'json'}"` },
          body: blob.content,
        };
      }
      return { status: 200, body: descriptor };
    }
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    return {
      status: 200,
      body: {
        generatedAt: new Date().toISOString(),
        exports: platform.auditVault.listExports(limit),
        vaultEnabled: platform.auditVault.enabled,
        vaultRecordCount: platform.auditVault.recordCount(),
        mock: platform.auditVault.mock,
      },
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
          ownerRole: String(input.ownerRole ?? actorRole ?? 'platform-super-admin') as Role,
          visibility: String(input.visibility ?? 'tenant-internal') as KPIArtifact['visibility'],
          approvalSensitivity: String(input.approvalSensitivity ?? 'approval-visible') as KPIArtifact['approvalSensitivity'],
          calculationMethod: String(input.calculationMethod ?? 'Draft KPI calculation from event projections.'),
          refreshCadence: String(input.refreshCadence ?? '5m'),
          sourceEvents: Array.isArray(input.sourceEvents) ? input.sourceEvents.map(String) : ['platform.health.checked'],
          sourceEntities: Array.isArray(input.sourceEntities)
            ? input.sourceEntities.filter(isRecord).map((entity) => ({ entityType: String(entity.entityType), entityId: String(entity.entityId) }))
            : [{ entityType: 'platform-health', entityId: 'trackmind-api' }],
          requestedBy: String(input.requestedBy ?? 'platform-super-admin'),
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
        requestedBy: String(input.requestedBy ?? 'platform-super-admin'),
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
  if (method === 'GET' && path === '/analytics/workspace/stream') {
    const calculated = recalculateAndPersistKpis(state, platform);
    const executive = buildExecutiveScorecard(calculated);
    const kpiTrends = buildKpiTrendsFromArtifacts(calculated);
    const federationAggregation = federationKpiAggregation(state.federation as unknown as FederationWorkspaceDto);
    const workspace = createAnalyticsWorkspace(kpiTrends, executive, calculated, federationAggregation);
    return {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: buildAnalyticsWorkspaceStreamBody(workspace),
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
        assignedTo: String(input.assignedTo ?? 'race-day-operations-manager'),
        actor: String(input.actor ?? actorRole ?? 'security-manager'),
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
  const incidentTimelineStreamMatch = path.match(/^\/incidents\/([^/]+)\/timeline\/stream$/);
  if (method === 'GET' && incidentTimelineStreamMatch) {
    const incidentId = decodeURIComponent(incidentTimelineStreamMatch[1]);
    const body = platform.incidents.buildTimelineStreamBody(incidentId);
    if (!body) return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
    return {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body,
    };
  }
  const incidentTimelineMatch = path.match(/^\/incidents\/([^/]+)\/timeline$/);
  if (method === 'GET' && incidentTimelineMatch) {
    const incidentId = decodeURIComponent(incidentTimelineMatch[1]);
    const since = searchParams.get('since') ?? undefined;
    const timeline = platform.incidents.getTimeline(incidentId, since);
    return timeline
      ? { status: 200, body: timeline }
      : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
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
        description: input.detailedNotes ? String(input.detailedNotes) : input.description ? String(input.description) : undefined,
        note: input.note ? String(input.note) : input.reason ? String(input.reason) : undefined,
        actor: input.actor ? String(input.actor) : undefined,
        incidentType: input.incidentType ? String(input.incidentType) : undefined,
        intakeMode: input.intakeMode as IncidentDto['intakeMode'] | undefined,
        location: input.location ? String(input.location) : undefined,
        summary: input.summary ? String(input.summary) : undefined,
        detailedNotes: input.detailedNotes ? String(input.detailedNotes) : undefined,
        involvedEntities: Array.isArray(input.involvedEntities) ? input.involvedEntities as IncidentDto['involvedEntities'] : undefined,
        evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs.map(String) : undefined,
        recommendedNextAction: input.recommendedNextAction ? String(input.recommendedNextAction) : undefined,
        approvalRequired: input.approvalRequired === true ? true : input.approvalRequired === false ? false : undefined,
        subjectKind: input.subjectKind ? String(input.subjectKind) : undefined,
        subjectId: input.subjectId ? String(input.subjectId) : undefined,
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
      const registered = aiModelCardRegistryStore.registerModel({
        id: String(input.id ?? ''),
        name: String(input.name ?? ''),
        version: String(input.version ?? ''),
        riskLevel: String(input.riskLevel ?? 'medium'),
        path: String(input.path ?? ''),
        lastEvaluatedAt: typeof input.lastEvaluatedAt === 'string' ? input.lastEvaluatedAt : undefined,
      });
      const audit = recordAiRegistryAudit(
        platform,
        state,
        'ai.model-card.registered',
        registered.registeredId,
        actorRole ?? 'compliance-officer',
        tenantId,
        racetrackId,
        {
          registeredId: registered.registeredId,
          version: String(input.version ?? ''),
          reason: typeof input.reason === 'string' ? input.reason : undefined,
        },
      );
      return {
        status: 201,
        body: {
          ...registered,
          auditId: audit.id,
          audited: true,
        },
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'POST' && path === '/ai-governance/model-registry/prompts') {
    const input = isRecord(body) ? body : {};
    try {
      const lineage = Array.isArray(input.lineage) ? input.lineage.map((ref) => String(ref)) : [];
      const registered = aiModelCardRegistryStore.registerPrompt({
        id: String(input.id ?? ''),
        name: String(input.name ?? ''),
        version: String(input.version ?? ''),
        path: String(input.path ?? ''),
        lineage,
      });
      const audit = recordAiRegistryAudit(
        platform,
        state,
        'ai.prompt-card.registered',
        registered.registeredId,
        actorRole ?? 'compliance-officer',
        tenantId,
        racetrackId,
        {
          registeredId: registered.registeredId,
          version: String(input.version ?? ''),
          lineage,
          reason: typeof input.reason === 'string' ? input.reason : undefined,
        },
      );
      return {
        status: 201,
        body: {
          ...registered,
          auditId: audit.id,
          audited: true,
        },
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  if (method === 'POST' && path === '/ai-governance/prompt-lineage/drafts') {
    const input = isRecord(body) ? body : {};
    try {
      const lineage = Array.isArray(input.lineage) ? input.lineage.map((ref) => String(ref)) : [];
      const drafted = aiModelCardRegistryStore.draftPromptLineage({
        id: String(input.id ?? ''),
        name: String(input.name ?? ''),
        version: String(input.version ?? ''),
        path: String(input.path ?? ''),
        lineage,
        reason: typeof input.reason === 'string' ? input.reason : undefined,
        requestedBy: typeof input.requestedBy === 'string' ? input.requestedBy : actorRole ?? 'compliance-officer',
      });
      const audit = recordAiRegistryAudit(
        platform,
        state,
        'ai.prompt-lineage.draft.created',
        drafted.promptId,
        actorRole ?? 'compliance-officer',
        tenantId,
        racetrackId,
        {
          draftId: drafted.draftId,
          promptId: drafted.promptId,
          version: String(input.version ?? ''),
          lineage,
          reason: typeof input.reason === 'string' ? input.reason : undefined,
        },
      );
      return {
        status: 202,
        body: {
          ...drafted,
          auditEventIds: [...drafted.auditEventIds, audit.id],
        },
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  const promptLineagePublishMatch = path.match(/^\/ai-governance\/prompt-lineage\/([^/]+)\/publish$/);
  if (method === 'POST' && promptLineagePublishMatch) {
    const draftId = decodeURIComponent(promptLineagePublishMatch[1]!);
    try {
      const published = aiModelCardRegistryStore.publishPromptLineage(draftId);
      const audit = recordAiRegistryAudit(
        platform,
        state,
        'ai.prompt-lineage.published',
        published.registeredId,
        actorRole ?? 'compliance-officer',
        tenantId,
        racetrackId,
        {
          draftId: published.draftId,
          registeredId: published.registeredId,
        },
      );
      return {
        status: 201,
        body: {
          ...published,
          auditId: audit.id,
          audited: true,
        },
      };
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: (error as Error).message } } };
    }
  }
  const providerAdapterMatch = path.match(/^\/racing-data\/providers\/([^/]+)\/invoke$/);
  if (method === 'POST' && providerAdapterMatch) {
    const providerId = decodeURIComponent(providerAdapterMatch[1]);
    const connectorResult = invokeProviderAdapter(providerId, state.racingData);
    if (!connectorResult.ok) {
      if (connectorResult.code === 'not_found') {
        return { status: 404, body: { ok: false, error: { code: 'not_found', message: connectorResult.message } } };
      }
      if (connectorResult.code === 'license_not_permitted') {
        const provider = state.racingData.providers.find((entry) => entry.providerId === providerId);
        return {
          status: 403,
          body: createRacingDataLicenseDenied('provider invoke', provider, connectorResult.details),
        };
      }
      if (connectorResult.code === 'provider_suspended') {
        return {
          status: 403,
          body: {
            ok: false,
            error: {
              code: 'provider_suspended',
              message: connectorResult.message,
              details: connectorResult.details,
            },
            providerId,
            externalCallsPerformed: false,
            scrapingPerformed: false,
          },
        };
      }
      return {
        status: 429,
        body: {
          ok: false,
          error: { code: 'rate_limit_exceeded', message: connectorResult.message },
          providerId,
          rateLimit: connectorResult.rateLimit,
          externalCallsPerformed: false,
          scrapingPerformed: false,
        },
      };
    }
    const audit = recordRacingDataProviderAudit(
      platform,
      state,
      providerId,
      actorRole ?? 'compliance-officer',
      tenantId,
      racetrackId,
      {
        providerId,
        correlationId: connectorResult.correlationId,
        recordsProcessed: connectorResult.recordsProcessed,
        licenseStatus: connectorResult.licenseStatus,
        rateLimitRemaining: connectorResult.rateLimit.remaining,
        lineageSourceRefs: connectorResult.lineage.sourceRefs,
      },
    );
    return { status: 202, body: toInvokeResult(connectorResult, audit.id) };
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
  if (method === 'GET' && path === '/notifications/delivery-audit-trail') {
    const notificationId = searchParams.get('notificationId') ?? undefined;
    return {
      status: 200,
      body: {
        generatedAt: new Date().toISOString(),
        entries: notificationFramework.deliveryAuditTrail(notificationId),
        mock: false,
      },
    };
  }
  if (method === 'POST' && path === '/notifications/dispatch') {
    if (!isRecord(body)) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: 'Expected JSON body' } } };
    }
    const redispatchId = typeof body.id === 'string' ? body.id : undefined;
    if (redispatchId) {
      const channels = Array.isArray(body.channels)
        ? body.channels.filter((item): item is string => typeof item === 'string')
        : undefined;
      const delivery = notificationFramework.redispatch(redispatchId, channels as Parameters<typeof notificationFramework.redispatch>[1]);
      if (!delivery) return { status: 404, body: { ok: false, error: { code: 'not_found', message: `Notification not found: ${redispatchId}` } } };
      return { status: 200, body: { ok: true, notificationId: redispatchId, delivery, mock: false } };
    }
    const title = String(body.title ?? '');
    const message = String(body.message ?? '');
    const category = String(body.category ?? 'platform');
    const targetRoles = Array.isArray(body.targetRoles)
      ? body.targetRoles.filter((item): item is string => typeof item === 'string')
      : [];
    if (!title || !message || targetRoles.length === 0) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: 'title, message, and targetRoles are required' } } };
    }
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((item): item is string => typeof item === 'string')
      : undefined;
    const result = notificationFramework.dispatch({
      category,
      title,
      message,
      targetRoles,
      severity: typeof body.severity === 'string' ? body.severity : undefined,
      correlationId: typeof body.correlationId === 'string' ? body.correlationId : undefined,
      channels: channels as Parameters<typeof notificationFramework.dispatch>[0]['channels'],
    });
    return { status: 202, body: { ok: true, ...result, mock: false } };
  }
  if (method === 'POST' && path === '/notifications/acknowledge') {
    const id = isRecord(body) ? String(body.id ?? '') : '';
    const ok = notificationFramework.acknowledge(id);
    return { status: ok ? 200 : 404, body: { ok, id } };
  }
  if (method === 'GET' && path === '/platform/modules') {
    const modules = platform.commercialization.planRegistry.listModules().map((module) => module.key);
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
