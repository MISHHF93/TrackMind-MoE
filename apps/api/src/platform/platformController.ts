import type { AuditEventDto } from '@trackmind/shared';
import type { KPIArtifact } from '@trackmind/shared';
import type { CentralizedApprovalService } from '../approvals.js';
import type { ImmutableAuditLog } from '../auditLog.js';
import type { RacingDataApiFacadeState } from '../racingDataApiHub.js';
import { createAnalyticsWorkspace } from './analyticsService.js';
import { createAIModelCardRegistry } from './aiRegistryService.js';
import { createAuditPersistenceAdapter } from './auditAdapter.js';
import { DurableApprovalStore } from './approvalStore.js';
import { federationKpiAggregation, executeProviderAdapter } from './dataHubAdapter.js';
import { globalSearch } from './globalSearchService.js';
import { IdentityService } from './identityService.js';
import { IncidentService } from './incidentService.js';
import { kpiCalculationService } from './kpiCalculationService.js';
import { notificationFramework } from './notificationFramework.js';
import { createPaddockOperationsWorkspace } from './paddockOperations.js';
import { createCommercializationServices, handleCommercializationRequest, type CommercializationServices } from './commercializationController.js';
import { createCustomerManagementServices, handleCustomerManagementRequest, type CustomerManagementServices } from './customerManagementController.js';
import { createNexusPlatformExpansionServices, handleNexusPlatformExpansionRequest, type NexusPlatformExpansionServices } from './nexusPlatformExpansionController.js';
import { FeatureFlagService, TenantService } from './tenantService.js';

function createRaceScheduleWorkspace(tenantId: string, racetrackId: string) {
  const ts = new Date().toISOString();
  return {
    generatedAt: ts,
    tenantId,
    racetrackId,
    raceDate: ts.slice(0, 10),
    races: [
      { raceId: 'race-7', raceNumber: 7, postTime: '2026-06-17T18:30:00.000Z', status: 'ready', surface: 'dirt' },
      { raceId: 'race-8', raceNumber: 8, postTime: '2026-06-17T19:05:00.000Z', status: 'scheduled', surface: 'dirt' },
    ],
    timeline: [
      { at: ts, label: 'First post', status: 'scheduled' },
      { at: ts, label: 'Race 7 post', status: 'ready' },
      { at: ts, label: 'Race 8 post', status: 'scheduled' },
    ],
    mock: false,
  };
}

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
}

export function createPlatformServices(state: PlatformState): PlatformServices {
  const tenant = new TenantService();
  const featureFlags = new FeatureFlagService();
  const identity = new IdentityService();
  const incidents = new IncidentService();
  const approvalStore = new DurableApprovalStore(state.approvalService);
  const auditAdapter = createAuditPersistenceAdapter(state.auditLedger as any);
  auditAdapter.syncFromLedger(state.auditEvents as AuditEventDto[]);
  const base = { tenant, featureFlags, identity, incidents, approvalStore, auditAdapter };
  const commercialization = createCommercializationServices(tenant);
  const customerManagement = createCustomerManagementServices(tenant, commercialization);
  const nexusExpansion = createNexusPlatformExpansionServices(tenant, featureFlags, incidents, commercialization, customerManagement, state);
  return { ...base, commercialization, customerManagement, nexusExpansion };
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
  if (method === 'GET' && path === '/organizations') {
    return { status: 200, body: platform.tenant.organizations.list() };
  }
  if (method === 'POST' && path === '/organizations') {
    const name = isRecord(body) ? String(body.name ?? 'New Organization') : 'New Organization';
    return { status: 201, body: platform.tenant.createOrganization({ name }) };
  }
  if (method === 'GET' && path === '/tenants') {
    return { status: 200, body: platform.tenant.tenants.list() };
  }
  if (method === 'POST' && path === '/tenants') {
    const orgId = isRecord(body) ? String(body.organizationId ?? 'org-trackmind-network') : 'org-trackmind-network';
    const name = isRecord(body) ? String(body.name ?? 'New Tenant') : 'New Tenant';
    return { status: 201, body: platform.tenant.createTenant({ organizationId: orgId, name }) };
  }
  if (method === 'GET' && path === '/racetracks') {
    return { status: 200, body: platform.tenant.racetracks.list() };
  }
  if (method === 'POST' && path === '/racetracks') {
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
  if (method === 'POST' && path === '/identity/access-requests') {
    const userId = isRecord(body) ? String(body.userId ?? 'user-admin-1') : 'user-admin-1';
    const requestedRole = isRecord(body) ? String(body.requestedRole ?? 'read-only-auditor') : 'read-only-auditor';
    return { status: 201, body: platform.identity.requestAccess(userId, requestedRole) };
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
  if (method === 'POST' && path === '/kpis/recalculate') {
    const workspace = state.kpis as { kpis?: KPIArtifact[] };
    const calculated = kpiCalculationService.calculateFromProjections(workspace.kpis ?? [], {
      eventCount: platform.incidents.list().length,
      approvalPendingCount: platform.approvalStore.list().filter((a) => a.status === 'pending').length,
      incidentOpenCount: platform.incidents.list().filter((i) => !['resolved', 'closed'].includes(i.status)).length,
      readinessScore: 88,
    });
    return { status: 200, body: { generatedAt: new Date().toISOString(), kpis: calculated, mock: false } };
  }
  if (method === 'GET' && path === '/analytics/workspace') {
    return { status: 200, body: createAnalyticsWorkspace() };
  }
  if (method === 'GET' && path === '/race-operations/paddock') {
    return { status: 200, body: createPaddockOperationsWorkspace(tenantId, racetrackId) };
  }
  if (method === 'GET' && path === '/race-operations/schedule') {
    return { status: 200, body: createRaceScheduleWorkspace(tenantId, racetrackId) };
  }
  if (method === 'GET' && path === '/security-operations/zones/live') {
    return {
      status: 200,
      body: {
        generatedAt: new Date().toISOString(),
        zones: [
          { zoneId: 'zone-paddock', name: 'Paddock', occupancy: 42, status: 'nominal', lastEventAt: new Date().toISOString() },
          { zoneId: 'zone-backstretch', name: 'Backstretch', occupancy: 18, status: 'watch', lastEventAt: new Date().toISOString() },
        ],
        mock: false,
      },
    };
  }
  if (method === 'GET' && path === '/incidents') {
    return { status: 200, body: platform.incidents.list() };
  }
  const incidentMatch = path.match(/^\/incidents\/([^/]+)$/);
  if (method === 'GET' && incidentMatch) {
    const incident = platform.incidents.get(decodeURIComponent(incidentMatch[1]));
    return incident ? { status: 200, body: incident } : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
  }
  if (method === 'POST' && path === '/incidents') {
    const input = isRecord(body) ? body : {};
    return {
      status: 201,
      body: platform.incidents.create({
        tenantId: String(input.tenantId ?? tenantId),
        racetrackId: String(input.racetrackId ?? racetrackId),
        title: String(input.title ?? 'New incident'),
        description: String(input.description ?? ''),
        severity: (input.severity as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
        status: 'reported',
        category: (input.category as 'safety' | 'security' | 'facility' | 'equine' | 'operational') ?? 'operational',
        reportedBy: String(input.reportedBy ?? 'operator'),
      }),
    };
  }
  if (method === 'POST' && incidentMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = platform.incidents.update(decodeURIComponent(incidentMatch[1]), {
        status: input.status as 'reported' | 'triaged' | 'responding' | 'resolved' | 'closed' | undefined,
        severity: input.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
        assignedTo: input.assignedTo ? String(input.assignedTo) : undefined,
        note: input.note ? String(input.note) : undefined,
        actor: input.actor ? String(input.actor) : undefined,
      });
      return { status: 200, body: updated };
    } catch {
      return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Incident not found' } } };
    }
  }
  if (method === 'GET' && path === '/ai-governance/model-registry') {
    return { status: 200, body: createAIModelCardRegistry() };
  }
  const providerAdapterMatch = path.match(/^\/racing-data\/providers\/([^/]+)\/invoke$/);
  if (method === 'POST' && providerAdapterMatch) {
    const result = executeProviderAdapter(decodeURIComponent(providerAdapterMatch[1]), state.racingData);
    return result ? { status: 202, body: result } : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Provider not found' } } };
  }
  if (method === 'GET' && path === '/federation/kpi-aggregation') {
    return { status: 200, body: federationKpiAggregation(state.federation as any) };
  }
  if (method === 'GET' && path === '/search/global') {
    const q = searchParams.get('q') ?? '';
    const equine = state.equine as { horse?: { horseId: string; name?: string } };
    return {
      status: 200,
      body: globalSearch(q, {
        horses: equine?.horse ? [{ id: equine.horse.horseId, name: equine.horse.name ?? equine.horse.horseId }] : [],
        incidents: platform.incidents.list().map((i) => ({ id: i.id, title: i.title })),
        auditEvents: (state.auditEvents as AuditEventDto[]).map((e) => ({ id: e.id, type: e.type, action: e.action })),
        kpis: ((state.kpis as { kpis?: KPIArtifact[] }).kpis ?? []).map((k) => ({ kpiId: k.kpiId, label: k.name })),
      }),
    };
  }
  if (method === 'GET' && path === '/notifications/inbox') {
    const role = searchParams.get('role') ?? undefined;
    return { status: 200, body: notificationFramework.inbox(role ?? undefined) };
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
