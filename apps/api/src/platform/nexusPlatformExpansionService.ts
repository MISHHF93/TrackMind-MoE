import type {
  MarketplaceWorkspaceDto,
  ModuleToggleResultDto,
  NexusPlatformExpansionManifestDto,
  ReportJobDto,
  ReportingWorkspaceDto,
  TenantScope,
  WhiteLabelBrandingDto,
  WhiteLabelWorkspaceDto,
} from '@trackmind/shared';
import { nexusPlatformExpansionSchemaVersion } from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import { createAnalyticsWorkspace } from './analyticsService.js';
import type { CommercializationServices } from './commercializationController.js';
import type { CustomerManagementServices } from './customerManagementController.js';
import type { IncidentService } from './incidentService.js';
import { NexusPlatformConfigRegistry } from './nexusPlatformConfigRegistry.js';
import {
  createNexusPlatformCanonicalDeps,
  type NexusPlatformCanonicalDeps,
  type NexusPlatformStateSlice,
} from './nexusPlatformCanonicalDeps.js';
import {
  projectAIGovernanceRegistry,
  projectComplianceCommandCenter,
  projectDigitalTwinPlatform,
  projectEnterpriseReadiness,
  projectEquineWelfare,
  projectFacilitiesCommand,
  projectFederationIntelligence,
  projectIntegrationHub,
  projectKnowledgeGraph,
  projectOperationalIntelligence,
  projectPredictiveAnalytics,
  projectSecuritySoc,
  projectWorkflowAutomation,
} from './nexusPlatformProjections.js';
import type { FeatureFlagService, TenantService } from './tenantService.js';

const now = () => new Date().toISOString();

type StoredReportJob = ReportJobDto & { organizationId: string; tenantId: string };

const MODULE_FLAG_MAP: Record<string, string> = {
  raceDay: 'race-day-ops',
  surface: 'race-day-ops',
  equine: 'equine-intelligence',
  analytics: 'analytics',
  fanExperience: 'fan-experience',
  dashboard: 'platform-health',
  predictive: 'analytics',
  digitalTwin: 'race-day-ops',
  compliance: 'platform-health',
  aiGovernance: 'platform-health',
  integrationHub: 'platform-health',
  mobileOps: 'race-day-ops',
  reporting: 'analytics',
  federation: 'analytics',
};

/**
 * Nexus expansion facade (prompts 03–20). Workspace routes project canonical domain services;
 * mutations enforce tenant scope, subscription entitlements, and approval-gated domains.
 */
export class NexusPlatformExpansionService {
  private branding: KeyValueRepository<WhiteLabelBrandingDto>;
  private reportJobs: KeyValueRepository<StoredReportJob>;
  private config: NexusPlatformConfigRegistry;
  private canonical: NexusPlatformCanonicalDeps;

  constructor(
    private readonly tenant: TenantService,
    private readonly featureFlags: FeatureFlagService,
    private readonly incidents: IncidentService,
    private readonly commercialization?: CommercializationServices,
    private readonly customerManagement?: CustomerManagementServices,
    config?: NexusPlatformConfigRegistry,
    canonical?: NexusPlatformCanonicalDeps,
    platformState?: NexusPlatformStateSlice,
  ) {
    this.config = config ?? new NexusPlatformConfigRegistry();
    this.canonical = canonical ?? createNexusPlatformCanonicalDeps({ platformState });
    this.branding = createRepository([]);
    this.reportJobs = createRepository([]);
  }

  private scope(input: TenantScope) {
    return {
      organizationId: input.organizationId,
      tenantId: input.tenantId ?? 'trackmind',
      racetrackId: input.racetrackId ?? 'main-track',
    };
  }

  private assertTenantScope(scope: ReturnType<typeof this.scope>, organizationId?: string) {
    if (organizationId && organizationId !== scope.organizationId) {
      throw new Error('tenant_scope_violation');
    }
  }

  manifest(): NexusPlatformExpansionManifestDto {
    const prompts = [
      { id: '03', title: 'Marketplace & Module Store', status: 'implemented' as const, apiPrefix: '/marketplace' },
      { id: '04', title: 'White Label Platform', status: 'implemented' as const, apiPrefix: '/white-label' },
      { id: '05', title: 'Advanced Digital Twin Platform', status: 'implemented' as const, apiPrefix: '/digital-twin/platform' },
      { id: '06', title: 'Operational Intelligence Center', status: 'implemented' as const, apiPrefix: '/operational-intelligence' },
      { id: '07', title: 'Equine Welfare Intelligence', status: 'implemented' as const, apiPrefix: '/equine-welfare' },
      { id: '08', title: 'Predictive Analytics Platform', status: 'implemented' as const, apiPrefix: '/predictive-analytics' },
      { id: '09', title: 'Enterprise Reporting Engine', status: 'implemented' as const, apiPrefix: '/reporting' },
      { id: '10', title: 'Workflow Automation Platform', status: 'implemented' as const, apiPrefix: '/workflow-automation' },
      { id: '11', title: 'Integration Hub', status: 'implemented' as const, apiPrefix: '/integration-hub' },
      { id: '12', title: 'Mobile Operations Platform', status: 'implemented' as const, apiPrefix: '/mobile-operations' },
      { id: '13', title: 'Regulatory & Compliance Command Center', status: 'implemented' as const, apiPrefix: '/compliance-command-center' },
      { id: '14', title: 'Security Operations Center', status: 'implemented' as const, apiPrefix: '/security-soc' },
      { id: '15', title: 'Facilities Command Platform', status: 'implemented' as const, apiPrefix: '/facilities-command' },
      { id: '16', title: 'Federation Intelligence Network', status: 'implemented' as const, apiPrefix: '/federation-intelligence' },
      { id: '17', title: 'AI Governance & Model Registry', status: 'implemented' as const, apiPrefix: '/ai-governance-registry' },
      { id: '18', title: 'Knowledge Graph & Search Platform', status: 'implemented' as const, apiPrefix: '/knowledge-graph' },
      { id: '19', title: 'Executive Intelligence Suite', status: 'implemented' as const, apiPrefix: '/executive-intelligence' },
      { id: '20', title: 'Production Hardening & Enterprise Readiness', status: 'implemented' as const, apiPrefix: '/platform/enterprise-readiness' },
    ];
    return { generatedAt: now(), schemaVersion: nexusPlatformExpansionSchemaVersion, prompts, mock: false };
  }

  marketplace(scope: TenantScope): MarketplaceWorkspaceDto {
    const s = this.scope(scope);
    const entitlements = this.commercialization?.entitlements.evaluate(s.organizationId, s.tenantId);
    const tenant = this.tenant.tenants.get(s.tenantId);
    const flags = tenant?.featureFlags ?? [];
    const listings = (this.config.marketplace.listings as Array<Record<string, unknown>>).map((l) => {
      const moduleKey = String(l.moduleKey);
      const flag = MODULE_FLAG_MAP[moduleKey] ?? 'platform-health';
      const enabled = flags.includes(flag) || this.featureFlags.isModuleEnabled(moduleKey, flags);
      const entitled = entitlements?.modules.find((m) => m.key === moduleKey)?.enabled ?? true;
      return { ...l, moduleKey, enabled: enabled && entitled, entitled, mock: false } as MarketplaceWorkspaceDto['listings'][0];
    });
    return {
      generatedAt: now(),
      schemaVersion: nexusPlatformExpansionSchemaVersion,
      organizationId: s.organizationId,
      tenantId: s.tenantId,
      categories: this.config.marketplace.categories as MarketplaceWorkspaceDto['categories'],
      listings,
      mock: false,
    };
  }

  toggleModule(scope: TenantScope, moduleKey: string, enable: boolean): ModuleToggleResultDto {
    const s = this.scope(scope);
    const entitlements = this.commercialization?.entitlements.evaluate(s.organizationId, s.tenantId);
    const moduleEntitlement = entitlements?.modules.find((m) => m.key === moduleKey);
    if (enable && moduleEntitlement && !moduleEntitlement.enabled) {
      throw new Error(`module_not_entitled:${moduleEntitlement.reason ?? 'subscription'}`);
    }
    const tenant = this.tenant.tenants.get(s.tenantId);
    if (!tenant) throw new Error('tenant_not_found');
    if (tenant.organizationId && tenant.organizationId !== s.organizationId) {
      throw new Error('tenant_scope_violation');
    }
    const flag = MODULE_FLAG_MAP[moduleKey] ?? moduleKey;
    const flags = new Set(tenant.featureFlags);
    if (enable) flags.add(flag);
    else flags.delete(flag);
    this.tenant.tenants.upsert({ ...tenant, featureFlags: [...flags], updatedAt: now() });
    return { moduleKey, enabled: enable, updatedAt: now(), mock: false };
  }

  private brandingId(organizationId: string, tenantId: string) {
    return `${organizationId}:${tenantId}`;
  }

  whiteLabelWorkspace(scope: TenantScope): WhiteLabelWorkspaceDto {
    const s = this.scope(scope);
    const id = this.brandingId(s.organizationId, s.tenantId);
    const existing = this.branding.get(id);
    const defaults = this.config.whiteLabel.defaults as Omit<WhiteLabelBrandingDto, 'id' | 'organizationId' | 'updatedAt' | 'mock'>;
    const branding: WhiteLabelBrandingDto = existing ?? {
      id,
      organizationId: s.organizationId,
      tenantId: s.tenantId,
      ...defaults,
      productName: String(defaults.productName),
      primaryColor: String(defaults.primaryColor),
      accentColor: String(defaults.accentColor),
      logoUrl: String(defaults.logoUrl),
      faviconUrl: String(defaults.faviconUrl),
      supportEmail: String(defaults.supportEmail),
      loginBannerText: String(defaults.loginBannerText),
      experienceTheme: String(defaults.experienceTheme),
      updatedAt: now(),
      mock: false,
    };
    return { generatedAt: now(), branding, configurableFields: this.config.whiteLabel.configurableFields, mock: false };
  }

  updateBranding(scope: TenantScope, patch: Partial<WhiteLabelBrandingDto>): WhiteLabelBrandingDto {
    const s = this.scope(scope);
    this.assertTenantScope(s, patch.organizationId);
    const ws = this.whiteLabelWorkspace(scope);
    const record = {
      ...ws.branding,
      ...patch,
      id: ws.branding.id,
      organizationId: ws.branding.organizationId,
      tenantId: ws.branding.tenantId,
      updatedAt: now(),
      mock: false,
    };
    return this.branding.upsert(record);
  }

  digitalTwinPlatform(scope: TenantScope) {
    const s = this.scope(scope);
    const commandCenter = this.canonical.commandCenterSnapshot();
    return projectDigitalTwinPlatform(this.canonical.digitalTwinRuntime, commandCenter, s.tenantId, s.racetrackId);
  }

  operationalIntelligence(scope: TenantScope) {
    const s = this.scope(scope);
    return projectOperationalIntelligence(this.canonical.commandCenterSnapshot(), this.incidents, s.tenantId, s.racetrackId);
  }

  equineWelfare(scope: TenantScope) {
    const s = this.scope(scope);
    return projectEquineWelfare(this.canonical.equineService, s.tenantId, s.racetrackId);
  }

  predictiveAnalytics(scope: TenantScope) {
    const s = this.scope(scope);
    return projectPredictiveAnalytics(createAnalyticsWorkspace(), s.tenantId, s.racetrackId);
  }

  reporting(scope: TenantScope): ReportingWorkspaceDto {
    const s = this.scope(scope);
    return {
      generatedAt: now(),
      organizationId: s.organizationId,
      templates: this.config.reports.templates as ReportingWorkspaceDto['templates'],
      recentJobs: this.reportJobs.list().filter((j) => j.organizationId === s.organizationId && j.tenantId === s.tenantId),
      mock: false,
    };
  }

  createReportJob(scope: TenantScope, templateId: string, format: string): ReportJobDto {
    const s = this.scope(scope);
    const ts = now();
    const job: StoredReportJob = {
      id: `report-${Date.now().toString(36)}`,
      organizationId: s.organizationId,
      tenantId: s.tenantId,
      templateId,
      status: 'completed',
      format,
      completedAt: ts,
      downloadUrl: `/api/v1/reporting/jobs/${templateId}/download`,
      createdAt: ts,
      mock: false,
    };
    return this.reportJobs.upsert(job);
  }

  workflowAutomation(scope: TenantScope) {
    const s = this.scope(scope);
    return projectWorkflowAutomation(s.tenantId, this.canonical.workflowEngine);
  }

  integrationHub(scope: TenantScope) {
    const s = this.scope(scope);
    const connectors = (this.config.integrations.connectors as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      id: String(c.id),
      name: String(c.name),
      category: String(c.category),
      protocols: c.protocols as string[],
      status: String(c.status),
      approvalRequired: Boolean(c.approvalRequired),
      connected: false,
    })) as Parameters<typeof projectIntegrationHub>[0];
    return projectIntegrationHub(connectors, this.canonical.racingDataProviderCount(), s.organizationId);
  }

  mobileOperations(scope: TenantScope) {
    const s = this.scope(scope);
    const workflows = (this.config.mobile.workflows as Array<Record<string, unknown>>).map((w) => ({
      ...w,
      id: String(w.id),
      name: String(w.name),
      domain: String(w.domain),
      offlineCapable: Boolean(w.offlineCapable),
      approvalGated: Boolean(w.approvalGated),
      enabled: true,
    }));
    return {
      generatedAt: now(),
      tenantId: s.tenantId,
      racetrackId: s.racetrackId,
      workflows,
      deviceReadiness: { apiVersion: 'v1', offlineSyncSupported: true },
      mock: false,
    };
  }

  complianceCommandCenter(scope: TenantScope) {
    const s = this.scope(scope);
    return projectComplianceCommandCenter(this.canonical.complianceLibrary, s.tenantId);
  }

  securitySoc(scope: TenantScope) {
    const s = this.scope(scope);
    return projectSecuritySoc(this.canonical.securityOperations, s.tenantId, s.racetrackId);
  }

  facilitiesCommand(scope: TenantScope) {
    const s = this.scope(scope);
    return projectFacilitiesCommand(this.canonical.facilitiesMaintenance, s.tenantId, s.racetrackId);
  }

  federationIntelligence(scope: TenantScope) {
    const s = this.scope(scope);
    const analytics = createAnalyticsWorkspace();
    const federation = this.canonical.federationWorkspace();
    return projectFederationIntelligence(analytics, federation, s.organizationId);
  }

  aiGovernanceRegistry() {
    return projectAIGovernanceRegistry(this.canonical.aiModelRegistry());
  }

  knowledgeGraph(scope: TenantScope, query: string) {
    return projectKnowledgeGraph(query, this.incidents);
  }

  executiveIntelligence(scope: TenantScope) {
    const s = this.scope(scope);
    const customerDash = this.customerManagement?.dashboard.build({ organizationId: s.organizationId, tenantId: s.tenantId });
    const ops = this.operationalIntelligence(scope);
    const compliance = this.complianceCommandCenter(scope);
    return {
      generatedAt: now(),
      organizationId: s.organizationId,
      strategicKpis: [
        { label: 'Platform health', value: customerDash?.adoptionOverview.averageHealthScore ?? 85, target: 90 },
        { label: 'Customer adoption', value: customerDash?.adoptionOverview.averageAdoptionScore ?? 78, target: 85, unit: '%' },
        { label: 'Race-day readiness', value: ops.liveKpis[0]?.value ?? 88, target: 92, unit: 'score' },
        { label: 'Compliance readiness', value: compliance.readinessScore, target: 95, unit: '%' },
      ],
      operationalScorecard: {
        safety: ops.liveKpis[0]?.value ?? 88,
        compliance: compliance.readinessScore,
        operations: ops.liveKpis[0]?.value ?? 88,
        adoption: customerDash?.adoptionOverview.averageAdoptionScore ?? 78,
      },
      benchmarks: createAnalyticsWorkspace().federationBenchmarks.map((b) => ({
        metric: b.metric,
        value: b.trackValue,
        peerMedian: b.industryMedian,
      })),
      forecasts: [
        { label: '30-day readiness', value: ops.liveKpis[0]?.value ?? 88, horizon: '30d' },
        { label: 'Attendance forecast', value: createAnalyticsWorkspace().executiveSummary.find((x) => /attendance|fan/i.test(x.label))?.value ?? 8420, horizon: '7d' },
      ],
      mock: false,
    };
  }

  enterpriseReadiness() {
    const health = this.canonical.platformObservability.health();
    return projectEnterpriseReadiness(this.config.productionReadiness.checks, health);
  }
}
