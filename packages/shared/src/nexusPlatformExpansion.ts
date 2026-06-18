export const nexusPlatformExpansionSchemaVersion = 'trackmind.nexus-platform-expansion.v1' as const;

export type TenantScope = { organizationId: string; tenantId?: string; racetrackId?: string };

// 03 — Marketplace
export interface MarketplaceListingDto {
  moduleKey: string;
  categoryId: string;
  name: string;
  description: string;
  tierMinimum: string;
  installable: boolean;
  enabled: boolean;
  entitled: boolean;
  mock: boolean;
}

export interface MarketplaceWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof nexusPlatformExpansionSchemaVersion;
  organizationId: string;
  tenantId: string;
  categories: Array<{ id: string; name: string; order: number }>;
  listings: MarketplaceListingDto[];
  mock: boolean;
}

export interface ModuleToggleResultDto {
  moduleKey: string;
  enabled: boolean;
  updatedAt: string;
  mock: boolean;
}

// 04 — White Label
export interface WhiteLabelBrandingDto {
  id: string;
  organizationId: string;
  tenantId?: string;
  productName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  faviconUrl: string;
  customDomain?: string;
  supportEmail: string;
  loginBannerText: string;
  experienceTheme: string;
  updatedAt: string;
  mock: boolean;
}

export interface WhiteLabelWorkspaceDto {
  generatedAt: string;
  branding: WhiteLabelBrandingDto;
  configurableFields: string[];
  mock: boolean;
}

// 05 — Advanced Digital Twin
export interface DigitalTwinEntitySummaryDto {
  entityKind: string;
  count: number;
  healthy: number;
  degraded: number;
  syncStatus: string;
}

export interface DigitalTwinPlatformWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  entitySummaries: DigitalTwinEntitySummaryDto[];
  supportedKinds: string[];
  syncDraftOnly: true;
  mock: boolean;
}

// 06 — Operational Intelligence Center
export interface OperationalIntelligenceCenterDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  overallStatus: 'nominal' | 'watch' | 'degraded' | 'critical';
  liveKpis: Array<{ label: string; value: number; unit?: string; trend: 'up' | 'down' | 'flat' }>;
  activeIncidents: number;
  openAlerts: number;
  pendingApprovals: number;
  recommendations: Array<{ id: string; summary: string; advisoryOnly: true }>;
  mock: boolean;
}

// 07 — Equine Welfare Intelligence
export interface EquineWelfareScoreDto {
  horseId: string;
  welfareScore: number;
  band: 'excellent' | 'good' | 'watch' | 'concern' | 'critical';
  lifecycleStage: string;
  transportStatus: string;
  retirementReadiness: number;
  factors: string[];
  veterinarianReviewRequired: boolean;
  generatedAt: string;
  mock: boolean;
}

export interface EquineWelfareWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  herdSummary: { total: number; watchCount: number; criticalCount: number; avgScore: number };
  horses: EquineWelfareScoreDto[];
  mock: boolean;
}

// 08 — Predictive Analytics
export interface PredictiveForecastDto {
  id: string;
  domain: 'operations' | 'attendance' | 'incidents' | 'maintenance' | 'welfare';
  label: string;
  horizonDays: number;
  confidence: number;
  forecastValue: number;
  unit: string;
  generatedAt: string;
}

export interface PredictiveAnalyticsWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  forecasts: PredictiveForecastDto[];
  modelReadiness: { score: number; modelsAvailable: string[] };
  mock: boolean;
}

// 09 — Reporting Engine
export interface ReportTemplateDto {
  id: string;
  name: string;
  category: string;
  formats: string[];
  schedulable: boolean;
}

export interface ReportJobDto {
  id: string;
  templateId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  format: string;
  scheduledAt?: string;
  completedAt?: string;
  downloadUrl?: string;
  createdAt: string;
  mock: boolean;
}

export interface ReportingWorkspaceDto {
  generatedAt: string;
  organizationId: string;
  templates: ReportTemplateDto[];
  recentJobs: ReportJobDto[];
  mock: boolean;
}

// 10 — Workflow Automation
export interface WorkflowAutomationTemplateDto {
  id: string;
  name: string;
  domain: string;
  approvalChain: string[];
  triggers: string[];
}

export interface WorkflowAutomationInstanceDto {
  id: string;
  templateId: string;
  status: 'active' | 'paused' | 'completed';
  currentStep: string;
  startedAt: string;
  mock: boolean;
}

export interface WorkflowAutomationWorkspaceDto {
  generatedAt: string;
  templates: WorkflowAutomationTemplateDto[];
  activeInstances: WorkflowAutomationInstanceDto[];
  mock: boolean;
}

// 11 — Integration Hub
export interface IntegrationConnectorDto {
  id: string;
  name: string;
  category: string;
  protocols: string[];
  status: string;
  approvalRequired: boolean;
  connected: boolean;
}

export interface IntegrationHubWorkspaceDto {
  generatedAt: string;
  organizationId: string;
  connectors: IntegrationConnectorDto[];
  racingDataProviders: number;
  mock: boolean;
}

// 12 — Mobile Operations
export interface MobileWorkflowDto {
  id: string;
  name: string;
  domain: string;
  offlineCapable: boolean;
  approvalGated: boolean;
  enabled: boolean;
}

export interface MobileOperationsWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  workflows: MobileWorkflowDto[];
  deviceReadiness: { apiVersion: string; offlineSyncSupported: boolean };
  mock: boolean;
}

// 13 — Compliance Command Center
export interface ComplianceCommandCenterDto {
  generatedAt: string;
  tenantId: string;
  readinessScore: number;
  controlsMapped: number;
  controlsEffective: number;
  openFindings: number;
  evidencePackages: number;
  frameworks: string[];
  mock: boolean;
}

// 14 — Security SOC
export interface SecuritySocWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  alertCount: number;
  investigationCount: number;
  zoneStatus: Array<{ zoneId: string; status: string; occupancy: number }>;
  accessEvents24h: number;
  mock: boolean;
}

// 15 — Facilities Command
export interface FacilitiesCommandWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  openWorkOrders: number;
  pendingInspections: number;
  assetsOnline: number;
  assetsMaintenance: number;
  surfaceScore: number;
  mock: boolean;
}

// 16 — Federation Intelligence
export interface FederationIntelligenceWorkspaceDto {
  generatedAt: string;
  organizationId: string;
  anonymized: true;
  benchmarkMetrics: Array<{ metric: string; trackValue: number; industryMedian: number }>;
  industryInsights: Array<{ id: string; title: string; summary: string }>;
  governancePosture: { crossTenantJoinsAllowed: false; aggregateOnly: true };
  mock: boolean;
}

// 17 — AI Governance Registry
export interface AIGovernanceRegistryWorkspaceDto {
  generatedAt: string;
  modelCount: number;
  promptTemplateCount: number;
  pendingReviews: number;
  blockedActions: number;
  lineageCoverage: number;
  observabilityStatus: string;
  models: Array<{ id: string; name: string; version: string; riskLevel: string; approvalRequired: boolean }>;
  mock: boolean;
}

// 18 — Knowledge Graph & Search
export interface KnowledgeGraphNodeDto {
  id: string;
  kind: string;
  label: string;
  score?: number;
}

export interface KnowledgeGraphWorkspaceDto {
  generatedAt: string;
  query: string;
  nodes: KnowledgeGraphNodeDto[];
  edges: Array<{ from: string; to: string; relationship: string }>;
  entityResolutionPending: number;
  mock: boolean;
}

// 19 — Executive Intelligence Suite
export interface ExecutiveIntelligenceSuiteDto {
  generatedAt: string;
  organizationId: string;
  strategicKpis: Array<{ label: string; value: number; target: number; unit?: string }>;
  operationalScorecard: { safety: number; compliance: number; operations: number; adoption: number };
  benchmarks: Array<{ metric: string; value: number; peerMedian: number }>;
  forecasts: Array<{ label: string; value: number; horizon: string }>;
  mock: boolean;
}

// 20 — Production Readiness
export interface ProductionReadinessCheckDto {
  id: string;
  category: string;
  title: string;
  weight: number;
  status: 'pass' | 'partial' | 'fail';
  score: number;
}

export interface EnterpriseReadinessDto {
  generatedAt: string;
  schemaVersion: typeof nexusPlatformExpansionSchemaVersion;
  overallScore: number;
  readinessBand: 'production-ready' | 'stabilizing' | 'in-progress' | 'foundational';
  checks: ProductionReadinessCheckDto[];
  convergence: {
    platformAreas: number;
    implementedAreas: number;
    partialAreas: number;
    saasOperatingSystem: string;
  };
  mock: boolean;
}

export interface NexusPlatformExpansionManifestDto {
  generatedAt: string;
  schemaVersion: typeof nexusPlatformExpansionSchemaVersion;
  prompts: Array<{ id: string; title: string; status: 'implemented' | 'partial'; apiPrefix: string }>;
  mock: boolean;
}

export function computeReadinessBand(score: number): EnterpriseReadinessDto['readinessBand'] {
  if (score >= 90) return 'production-ready';
  if (score >= 75) return 'stabilizing';
  if (score >= 55) return 'in-progress';
  return 'foundational';
}

export function welfareBand(score: number): EquineWelfareScoreDto['band'] {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'concern';
  return 'critical';
}
