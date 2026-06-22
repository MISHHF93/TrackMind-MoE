/** Platform foundation DTOs for Wave 01–20 implementation */

export interface OrganizationDto {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'suspended';
  tenantIds: string[];
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface TenantDto {
  id: string;
  organizationId: string;
  name: string;
  status: 'active' | 'provisioning' | 'suspended';
  racetrackIds: string[];
  dataBoundary: string;
  isolationMode: 'shared-schema' | 'dedicated-schema' | 'dedicated-database';
  featureFlags: string[];
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface RacetrackDto {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  jurisdiction: string;
  status: 'operational' | 'maintenance' | 'closed';
  timezone: string;
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface RepositoryEnvironmentDto {
  mode: 'in-memory' | 'postgres';
  wired: boolean;
  postgresReady: boolean;
  usingFallback: boolean;
  pgClientAvailable: boolean;
}

export interface EnvironmentConfigDto {
  environment: 'development' | 'staging' | 'production';
  apiBasePath: string;
  persistenceMode: 'in-memory' | 'postgres';
  repository: RepositoryEnvironmentDto;
  featureFlagDefaults: string[];
  retentionDays: number;
  observabilityEnabled: boolean;
  generatedAt: string;
  mock: boolean;
}

export interface FeatureFlagDefinitionDto {
  key: string;
  description: string;
  defaultEnabled: boolean;
  environments: Record<string, boolean>;
  moduleKeys: string[];
  mock: boolean;
}

export interface FeatureFlagEvaluationDto {
  key: string;
  enabled: boolean;
  source: 'tenant' | 'environment' | 'default';
  environment: string;
  mock: boolean;
}

export interface PlatformFoundationWorkspaceDto {
  generatedAt: string;
  organizations: OrganizationDto[];
  tenants: TenantDto[];
  racetracks: RacetrackDto[];
  users: PlatformUserDto[];
  featureFlags: FeatureFlagDefinitionDto[];
  environment: EnvironmentConfigDto;
  mock: boolean;
}

export interface PlatformUserDto {
  id: string;
  tenantId: string;
  organizationId: string;
  displayName: string;
  email: string;
  roles: string[];
  status: 'active' | 'pending' | 'suspended';
  lastLoginAt?: string;
  createdAt: string;
  mock: boolean;
}

export interface IdentityWorkspaceDto {
  generatedAt: string;
  users: PlatformUserDto[];
  roleAssignments: Array<{ userId: string; role: string; tenantId: string; assignedAt: string }>;
  accessRequests: Array<{ id: string; userId: string; requestedRole: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string }>;
  mock: boolean;
}

export interface AuditSearchQueryDto {
  actorId?: string;
  domain?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  action?: 'search' | 'export';
  format?: 'json' | 'ndjson';
}

export interface AuditVaultExportDto {
  exportId: string;
  generatedAt: string;
  generatedBy: string;
  recordCount: number;
  contentHash: string;
  format: 'json' | 'ndjson';
  mimeType: string;
  downloadUri: string;
  sealed: true;
  mock: boolean;
  query?: AuditSearchQueryDto;
}

export interface AuditVaultExportListDto {
  generatedAt: string;
  exports: AuditVaultExportDto[];
  vaultEnabled: boolean;
  vaultRecordCount: number;
  mock: boolean;
}

export interface IncidentDto {
  id: string;
  tenantId: string;
  racetrackId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'triaged' | 'responding' | 'resolved' | 'closed';
  category: 'safety' | 'security' | 'facility' | 'equine' | 'operational';
  reportedBy: string;
  assignedTo?: string;
  /** Unified intake: domain incident type */
  incidentType?: string;
  intakeMode?: 'triage' | 'full';
  location?: string;
  summary?: string;
  detailedNotes?: string;
  involvedEntities?: Array<{ kind: string; id: string; label?: string }>;
  evidenceRefs?: string[];
  recommendedNextAction?: string;
  approvalRequired?: boolean;
  subjectKind?: string;
  subjectId?: string;
  timeline: Array<{ at: string; action: string; actor: string; note?: string }>;
  auditIds: string[];
  eventIds: string[];
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface IncidentTimelineEntryDto {
  at: string;
  action: string;
  actor: string;
  note?: string;
}

export interface IncidentTimelineDto {
  incidentId: string;
  generatedAt: string;
  revision: number;
  updatedAt: string;
  status: IncidentDto['status'];
  entries: IncidentTimelineEntryDto[];
  since?: string | null;
  hasMore: boolean;
  mock: boolean;
}

export interface PostIncidentReviewDto {
  id: string;
  incidentId: string;
  findings: Array<{ finding: string; severity: IncidentDto['severity']; owner: string }>;
  correctiveActions: Array<{ id: string; action: string; owner: string; dueDays: number }>;
  evidencePackage: string[];
  auditIds: string[];
  eventIds: string[];
  status: 'draft' | 'submitted' | 'approved';
  submittedBy: string;
  submittedAt: string;
  mock: boolean;
}

export type { PaddockOperationsDto } from './paddockOperations.js';

export interface RaceScheduleDto {
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  raceDate: string;
  races: Array<{ raceId: string; raceNumber: number; postTime: string; status: string; surface: string }>;
  timeline: Array<{ at: string; label: string; status: string }>;
  mock: boolean;
}

export interface AnalyticsWorkspaceDto {
  generatedAt: string;
  executiveSummary: Array<{ label: string; value: number; trend: 'up' | 'down' | 'flat'; unit?: string }>;
  kpiTrends: Array<{ kpiId: string; label: string; points: Array<{ at: string; value: number }> }>;
  forecastingReadiness: { score: number; modelsAvailable: string[]; dataQualityScore: number };
  federationBenchmarks: Array<{ metric: string; trackValue: number; industryMedian: number; anonymized: boolean }>;
  mock: boolean;
}

export interface FanExperienceWorkspaceDto {
  generatedAt: string;
  attendance: { current: number; capacity: number; utilizationPercent: number };
  guestServices: Array<{ id: string; category: string; status: string; waitMinutes: number }>;
  crowdDensity: Array<{ zone: string; level: string }>;
  hospitalityReadiness: { score: number; openIssues: number };
  ticketInventory: { available: number; sold: number; held: number };
  mock: boolean;
}

export interface FinancePlatformWorkspaceDto {
  generatedAt: string;
  revenue: { today: number; mtd: number; currency: string };
  expenses: { today: number; mtd: number; currency: string };
  budget: { allocated: number; spent: number; remaining: number; currency: string };
  payouts: Array<{ id: string; amount: number; status: string; approvalId?: string }>;
  reconciliation: { pending: number; matched: number; exceptions: number };
  mock: boolean;
}

export interface AIModelCardDto {
  id: string;
  name: string;
  version: string;
  riskLevel: string;
  path: string;
  lastEvaluatedAt: string;
}

export interface AIPromptCardDto {
  id: string;
  name: string;
  version: string;
  path: string;
  lineage: string[];
}

export interface AIModelCardRegistryDto {
  generatedAt: string;
  modelCards: AIModelCardDto[];
  promptCards: AIPromptCardDto[];
  mock: boolean;
}

export interface AIModelCardRegistrationInput {
  id: string;
  name: string;
  version: string;
  riskLevel: string;
  path: string;
  lastEvaluatedAt?: string;
}

export interface AIPromptCardRegistrationInput {
  id: string;
  name: string;
  version: string;
  path: string;
  lineage: string[];
}

export interface AIPromptLineageDraftInput {
  id: string;
  name: string;
  version: string;
  path: string;
  lineage: string[];
  reason?: string;
  requestedBy?: string;
}

export interface AIPromptLineageDraftResultDto {
  accepted: true;
  draftId: string;
  promptId: string;
  eventType: 'ai.prompt-lineage.draft.created';
  draftOnly: true;
  message: string;
  auditEventIds: string[];
  mock: boolean;
}

export interface AIPromptLineagePublishResultDto {
  accepted: true;
  draftId: string;
  registeredId: string;
  registry: AIModelCardRegistryDto;
  eventType: 'ai.prompt-lineage.published';
  message: string;
  auditId?: string;
  audited?: boolean;
  mock: boolean;
}

export interface AIModelCardRegistryMutationResultDto {
  accepted: true;
  registry: AIModelCardRegistryDto;
  registeredId: string;
  eventType: string;
  message: string;
  auditId?: string;
  audited?: boolean;
  mock: boolean;
}

export interface AIModelCardListDto {
  generatedAt: string;
  modelCards: AIModelCardDto[];
  mock: boolean;
}

export interface AIPromptCardListDto {
  generatedAt: string;
  promptCards: AIPromptCardDto[];
  mock: boolean;
}

export interface AIGovernanceKpiPackDto {
  generatedAt: string;
  kpiPackId: 'ai-governance-kpi-pack-v1';
  modelCardCount: number;
  promptCardCount: number;
  expertModelCount: number;
  lineageCoveragePercent: number;
  recommendationRegistryCompleteness: number;
  moeRoutingDomains: number;
  kpis: Array<{ kpiId: string; label: string; value: number; unit: string; status: string }>;
  mock: boolean;
}

export interface EmergencyWorkflowActivationInput {
  id: string;
  planId: string;
  scenario: 'severe-weather' | 'medical-emergency' | 'fire-incident' | 'infrastructure-failure' | 'evacuation' | 'security-incident' | 'business-continuity' | 'disaster-recovery';
  severity: 'watch' | 'minor' | 'major' | 'critical';
  location: string;
  activatedBy: string;
  roles?: string[];
  tenantId?: string;
  racetrackId?: string;
}

export interface EmergencyApprovalPostureDto {
  mode: 'post-action-evidence' | 'approval-request-created';
  action: 'emergency-action';
  target: string;
  aiMayBlock: false;
  emergencyPersonnelAuthority: true;
  approvalRequestId?: string;
  reason: string;
}

export interface EmergencyMutationResultDto {
  accepted: true;
  subjectId: string;
  auditId: string;
  eventType: string;
  message: string;
  approvalPosture: EmergencyApprovalPostureDto;
  evidencePackage: string[];
  workspace: Record<string, unknown>;
  mock: boolean;
}

export interface EmergencyWorkflowMutationResultDto extends EmergencyMutationResultDto {
  workflowId: string;
}

export interface GlobalSearchResultDto {
  id: string;
  kind: 'horse' | 'race' | 'trainer' | 'jockey' | 'incident' | 'approval' | 'audit' | 'facility' | 'recommendation' | 'kpi' | 'asset' | 'twin';
  title: string;
  subtitle?: string;
  path: string;
  score: number;
  mock: boolean;
}

export interface GlobalSearchResponseDto {
  query: string;
  results: GlobalSearchResultDto[];
  generatedAt: string;
  mock: boolean;
}

export interface NotificationInboxDto {
  generatedAt: string;
  notifications: Array<{
    id: string;
    category: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    targetRoles: string[];
    status: 'unread' | 'acknowledged';
    createdAt: string;
  }>;
  mock: boolean;
}

export interface SecurityZoneLiveDto {
  generatedAt: string;
  zones: Array<{ zoneId: string; name: string; occupancy: number; status: string; lastEventAt: string }>;
  mock: boolean;
}

export interface ModuleEnablementDto {
  moduleKey: string;
  enabled: boolean;
}

export interface AccessRequestDto {
  id: string;
  tenantId: string;
  userId: string;
  requestedRole: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface PlatformRoleDto {
  role: string;
  displayName: string;
  group: string;
  privileged: boolean;
  assignable: boolean;
  permissions: string[];
}

export interface RoleAssignmentDto {
  userId: string;
  role: string;
  tenantId: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface RoleAssignmentResultDto {
  userId: string;
  role: string;
  tenantId: string;
  assignedAt: string;
  user: PlatformUserDto;
}

export interface TenantRbacPolicyDto {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
  roles: string[];
  requiresApproval: boolean;
  privileged: boolean;
  effect?: 'allow' | 'deny';
  updatedAt: string;
}

export interface TenantRbacPolicyStoreDto {
  generatedAt: string;
  tenantId: string;
  policies: TenantRbacPolicyDto[];
  mock: boolean;
}

export interface TenantSessionDto {
  sessionId: string;
  userId: string;
  tenantId: string;
  organizationId: string;
  roles: string[];
  issuedAt: string;
  expiresAt: string;
  authProvider: string;
}

export interface AuthProviderDescriptorDto {
  providerId: string;
  mode: 'noop' | 'header-role' | 'entra' | 'abstract';
  sessionTtlMinutes: number;
  summary: string;
}

export interface AuthProviderWorkspaceDto {
  generatedAt: string;
  provider: AuthProviderDescriptorDto;
  activeSessions: number;
  mock: boolean;
}

export interface KpiRecalculationResultDto {
  generatedAt: string;
  kpis: Array<{ kpiId: string; value: number; label?: string }>;
  mock: boolean;
}

export interface FanExperienceRequestResultDto {
  ok: true;
  requestId: string;
  type: string;
  status: 'draft-created';
  mock: boolean;
}

export interface ProviderAdapterInvokeResultDto {
  providerId: string;
  status: 'simulated';
  recordsProcessed: number;
  executedAt: string;
  mock: boolean;
  audited: true;
  auditId: string;
  correlationId: string;
  lineage: {
    correlationId: string;
    sourceRefs: string[];
    upstreamRefs: string[];
    downstreamRefs: string[];
  };
  rateLimit: {
    limit: number;
    remaining: number;
    windowSeconds: number;
  };
  externalCallsPerformed: false;
  scrapingPerformed: false;
  licenseStatus: string;
}

export interface FederationKpiAggregationDto {
  metric: string;
  aggregatedValue: number;
  trackCount: number;
  generatedAt: string;
}

export interface NotificationAcknowledgeResultDto {
  ok: boolean;
  id: string;
}

export interface EquineHorseProfileDto {
  horseId: string;
  role: string;
  identity: Record<string, unknown>;
  privacy: { scope: string; redactedFields: string[]; reason: string };
  mock: boolean;
}

export interface EquineEligibilityDto {
  horseId: string;
  eligible: boolean;
  failedRules: string[];
  warnings: string[];
  status: Record<string, unknown>;
  mock: boolean;
}

export interface EquineAuditChainDto {
  horseId: string;
  events: Array<Record<string, unknown>>;
  verification: { valid: boolean; checked?: number; failures?: Array<Record<string, unknown>> };
}

export interface EquineVeterinaryMutationResultDto {
  horseId: string;
  record: Record<string, unknown>;
  eligibility: Record<string, unknown>;
  auditEventId: string;
}

export interface EquineEligibilityMutationResultDto {
  horseId: string;
  eligibility: Record<string, unknown>;
  auditEventId: string;
}
