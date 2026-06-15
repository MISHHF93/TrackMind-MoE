import {
  createModelReadableKPIContext,
  hasPermission,
  type KPIDomain,
  type KPIArtifact,
  type KPIApprovalSensitivity,
  type KPIMetricType,
  type KPIStatus,
  type KPIThresholdRule,
  type KPITrend,
  type KPIVisibility,
  type KPIWorkspaceDto,
  type Permission,
  type Role,
} from '@trackmind/shared';

export interface KPIWorkspaceInput {
  generatedAt: string;
  tenantId?: string;
  organizationId?: string;
  racetrackId?: string;
}

export interface KPIVisibilityPrincipal {
  tenantId?: string;
  racetrackId?: string;
  role?: Role;
}

type KPIDefinitionSeed = {
  domain: KPIDomain;
  name: string;
  description: string;
  metricType: KPIMetricType;
  value: number;
  unit: string;
  target: number;
  threshold: KPIThresholdRule;
  status: KPIStatus;
  trend: KPITrend;
  confidence: number;
  dataQualityScore: number;
  sourceEvents: string[];
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  calculationMethod: string;
  refreshCadence: string;
  ownerRole: Role;
  visibility: KPIVisibility;
  approvalSensitivity: KPIApprovalSensitivity;
  requiredPermission?: Permission;
};

const seeds: KPIDefinitionSeed[] = [
  seed('race-day-operations', 'Race-day readiness score', 'Facade readiness score from race summaries, warnings, and pending approvals.', 'score', 87, 'score', 90, 'watch', 'flat', 'steward', 'regulated-advisory-only', 'race:request-start', ['race.readiness.calculated', 'approval.requested'], [{ entityType: 'race-day', entityId: 'race-day-main' }]),
  seed('equine-welfare', 'Equine welfare review coverage', 'Readiness KPI for visible equine welfare review coverage; veterinary details remain redacted.', 'percentage', 76, '%', 95, 'warning', 'insufficient-history', 'veterinarian', 'regulated-advisory-only', 'vet:review', ['equine.welfare.reviewed'], [{ entityType: 'horse', entityId: 'horse-1' }], 'veterinary-restricted'),
  seed('safety-incidents', 'Open safety incident pressure', 'Count-style pressure score from security/emergency incident facade rows.', 'score', 42, 'pressure', 25, 'warning', 'up', 'security', 'approval-visible', 'incident:manage', ['incident.created', 'emergency.alert.raised'], [{ entityType: 'incident', entityId: 'incident:surface-review' }]),
  seed('stewarding', 'Steward evidence readiness', 'Readiness of steward inquiry evidence bundles before any human-only ruling.', 'score', 71, 'score', 90, 'watch', 'flat', 'steward', 'regulated-advisory-only', 'discipline:issue', ['steward.inquiry.opened', 'steward.approval.requested'], [{ entityType: 'inquiry', entityId: 'inq-race-7' }]),
  seed('compliance', 'Compliance control mapping readiness', 'Readiness score from mapped control library evidence, not a certification claim.', 'score', 68, 'score', 85, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['compliance.control.mapped'], [{ entityType: 'control-library', entityId: 'trackmind-control-library' }]),
  seed('security', 'Security operations coverage', 'Operational coverage from restricted zones, cameras, sensors, and incident facade records.', 'percentage', 74, '%', 95, 'watch', 'down', 'security', 'approval-visible', 'security:manage', ['security.zone.observed', 'camera.health.updated'], [{ entityType: 'security-zone', entityId: 'paddock-restricted-zone' }]),
  seed('facilities', 'Facilities readiness metadata', 'Mock/facade readiness KPI for facilities maintenance; no durable work-order DB is claimed.', 'readiness', 63, 'score', 85, 'readiness-only', 'insufficient-history', 'track-superintendent', 'approval-visible', 'track:readings', ['facility.readiness.facade.generated'], [{ entityType: 'facility', entityId: 'facilities-workspace' }]),
  seed('ticketing', 'Ticketing contract readiness', 'Readiness-only KPI because no dedicated ticketing DB or shared DTO exists.', 'readiness', 18, 'score', 80, 'readiness-only', 'insufficient-history', 'ticketing-manager', 'none', 'ticketing:manage', ['ticketing.readiness.documented'], [{ entityType: 'workspace', entityId: 'ticketing' }]),
  seed('finance', 'Finance settlement readiness', 'Readiness-only KPI for protected payout workflow support; no finance ledger is claimed.', 'readiness', 21, 'score', 80, 'readiness-only', 'insufficient-history', 'finance', 'regulated-advisory-only', 'finance:payout', ['finance.readiness.documented', 'approval.requested'], [{ entityType: 'workspace', entityId: 'finance' }]),
  seed('fan-experience', 'Fan experience signal readiness', 'Readiness-only KPI over documented fan/ticketing surfaces, not live sentiment data.', 'readiness', 24, 'score', 80, 'readiness-only', 'insufficient-history', 'ticketing-manager', 'none', 'ticketing:manage', ['fan-experience.readiness.documented'], [{ entityType: 'workspace', entityId: 'fan-experience' }]),
  seed('racing-data-hub', 'Provider adapter readiness', 'Racing Data Hub readiness from provider registry, lineage, policy, and quality facade coverage.', 'score', 72, 'score', 90, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['racing-data.provider.reviewed', 'racing-data.lineage.generated'], [{ entityType: 'provider-registry', entityId: 'racing-data' }]),
  seed('multi-track-federation', 'Federated aggregate safety readiness', 'Aggregate-only federation KPI; raw cross-track records are not exposed.', 'score', 58, 'score', 85, 'readiness-only', 'insufficient-history', 'compliance-officer', 'approval-visible', 'compliance:audit', ['federation.aggregate.generated'], [{ entityType: 'federation', entityId: 'federation-workspace' }], 'federation-aggregate'),
  seed('ai-governance', 'AI recommendation governance completeness', 'Completeness of advisory AI recommendation metadata, evidence, approvals, and audit references.', 'percentage', 91, '%', 95, 'watch', 'up', 'compliance-officer', 'approval-visible', 'ai:approve', ['ai.recommendation.evaluated', 'ai.approval.required'], [{ entityType: 'ai-control-plane', entityId: 'control-plane' }]),
  seed('audit-integrity', 'Audit hash-chain visibility', 'Audit integrity visibility from hash/evidence facade records, not a durable evidence vault claim.', 'percentage', 83, '%', 100, 'watch', 'flat', 'read-only-auditor', 'approval-visible', 'compliance:audit', ['audit.event.appended', 'audit.verification.requested'], [{ entityType: 'audit-ledger', entityId: 'audit-facade' }]),
  seed('approval-workflows', 'Approval workflow traceability', 'Traceability score for governed approval records, evidence, event refs, and audit refs.', 'percentage', 88, '%', 95, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'ai:approve', ['approval.requested', 'approval.workflow.updated'], [{ entityType: 'approval-queue', entityId: 'central-approval-service' }]),
  seed('tenant-operations', 'Tenant scope readiness', 'Readiness of tenant/racetrack metadata boundaries; not proof of enforced RLS.', 'score', 54, 'score', 90, 'readiness-only', 'insufficient-history', 'admin', 'approval-visible', 'read:any', ['tenant.scope.reviewed'], [{ entityType: 'tenant', entityId: 'trackmind' }]),
  seed('system-health', 'Platform health score', 'Platform health KPI from backend facade health/service metadata.', 'score', 79, 'score', 95, 'watch', 'flat', 'admin', 'none', 'read:any', ['platform.health.checked'], [{ entityType: 'platform-health', entityId: 'trackmind-api' }]),
  seed('data-quality', 'Data quality readiness', 'Quality score derived from data hub quality reports and feature-store placeholder metadata.', 'score', 69, 'score', 90, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['data-quality.report.generated', 'feature.record.generated'], [{ entityType: 'data-quality-report', entityId: 'racing-data-quality' }]),
  seed('veterinary-privacy', 'Veterinary privacy guardrail coverage', 'Coverage KPI for veterinary privacy scoping; sensitive details are restricted.', 'percentage', 82, '%', 100, 'watch', 'flat', 'veterinarian', 'regulated-advisory-only', 'vet:review', ['equine.privacy.filtered'], [{ entityType: 'privacy-policy', entityId: 'equine-privacy' }], 'veterinary-restricted'),
  seed('deployment-readiness', 'Deployment readiness evidence score', 'Readiness score from build/test/performance artifacts and documented deployment boundaries.', 'score', 77, 'score', 95, 'watch', 'up', 'admin', 'approval-visible', 'read:any', ['deployment.readiness.evaluated'], [{ entityType: 'artifact-index', entityId: 'TRACKMIND_SYSTEM_AUDIT_ARTIFACTS.csv' }]),
];

function seed(
  domain: KPIDomain,
  name: string,
  description: string,
  metricType: KPIMetricType,
  value: number,
  unit: string,
  target: number,
  status: KPIStatus,
  trend: KPITrend,
  ownerRole: Role,
  approvalSensitivity: KPIApprovalSensitivity,
  requiredPermission: Permission,
  sourceEvents: string[],
  sourceEntities: Array<{ entityType: string; entityId: string }>,
  visibility: KPIVisibility = 'tenant-internal',
): KPIDefinitionSeed {
  return {
    domain,
    name,
    description,
    metricType,
    value,
    unit,
    target,
    threshold: { warning: target * 0.85, critical: target * 0.65, targetDirection: 'above', description: 'Readiness and quality KPIs should meet or exceed target unless explicitly count/pressure based.' },
    status,
    trend,
    confidence: status === 'readiness-only' ? 0.62 : 0.82,
    dataQualityScore: status === 'readiness-only' ? 0.58 : 0.79,
    sourceEvents,
    sourceEntities,
    calculationMethod: `Deterministic ${domain} KPI calculation over TrackMind seeded facade/readiness artifacts; not production telemetry.`,
    refreshCadence: '5m',
    ownerRole,
    visibility,
    approvalSensitivity,
    requiredPermission,
  };
}

export function createKPIWorkspace(input: KPIWorkspaceInput): KPIWorkspaceDto {
  const generatedAt = input.generatedAt;
  const tenantId = input.tenantId ?? 'trackmind';
  const organizationId = input.organizationId ?? 'org-trackmind-network';
  const racetrackId = input.racetrackId ?? 'main-track';
  const kpis = seeds.map((definition, index) => toArtifact(definition, generatedAt, tenantId, organizationId, racetrackId, index + 1));
  return {
    generatedAt,
    tenantId,
    organizationId,
    racetrackId,
    kpis,
    modelReadableContext: kpis.filter((kpi) => kpi.modelReadable).map(createModelReadableKPIContext),
    governance: {
      modelReadableOnly: true,
      aiMutationAllowed: false,
      regulatedExecutionAllowed: false,
      federatedKpisAggregateOnly: true,
    },
    mock: false,
  };
}

export function filterKPIWorkspace(workspace: KPIWorkspaceDto, principal: KPIVisibilityPrincipal): KPIWorkspaceDto {
  const role = principal.role ?? 'read-only-auditor';
  const kpis = workspace.kpis.filter((kpi) => {
    if (principal.tenantId && kpi.tenantId !== principal.tenantId) return false;
    if (principal.racetrackId && kpi.racetrackId && kpi.racetrackId !== principal.racetrackId) return false;
    if (kpi.visibility === 'veterinary-restricted' && role !== 'veterinarian' && role !== 'admin') return false;
    if (kpi.visibility === 'restricted' && role !== 'admin' && role !== kpi.ownerRole) return false;
    if (kpi.requiredPermission && !hasPermission(role, kpi.requiredPermission)) return false;
    return true;
  });
  return {
    ...workspace,
    kpis,
    modelReadableContext: kpis.filter((kpi) => kpi.modelReadable).map(createModelReadableKPIContext),
  };
}

function toArtifact(definition: KPIDefinitionSeed, generatedAt: string, tenantId: string, organizationId: string, racetrackId: string, ordinal: number): KPIArtifact {
  const kpiId = `kpi-${definition.domain}`;
  const calculationRunId = `calc-${kpiId}-v1`;
  const auditReference = {
    auditEventIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    eventIds: definition.sourceEvents,
    correlationId: `corr-${kpiId}`,
    calculationRunId,
    integrityRef: `sha256:${kpiId}:v1`,
  };
  const historicalSnapshot = {
    snapshotId: `snapshot-${kpiId}-seed`,
    kpiId,
    value: definition.value,
    status: definition.status,
    trend: definition.trend,
    confidence: definition.confidence,
    dataQualityScore: definition.dataQualityScore,
    calculatedAt: generatedAt,
    sourceEvents: definition.sourceEvents,
    auditReference,
  };
  return {
    kpiId,
    tenantId,
    organizationId,
    racetrackId: definition.visibility === 'federation-aggregate' ? undefined : racetrackId,
    domain: definition.domain,
    name: definition.name,
    description: definition.description,
    artifactType: 'KPI',
    metricType: definition.metricType,
    value: definition.value,
    unit: definition.unit,
    target: definition.target,
    threshold: definition.threshold,
    status: definition.status,
    trend: definition.trend,
    confidence: definition.confidence,
    dataQualityScore: definition.dataQualityScore,
    sourceEvents: definition.sourceEvents,
    sourceEntities: definition.sourceEntities,
    calculationMethod: definition.calculationMethod,
    refreshCadence: definition.refreshCadence,
    lastCalculatedAt: generatedAt,
    ownerRole: definition.ownerRole,
    visibility: definition.visibility,
    approvalSensitivity: definition.approvalSensitivity,
    requiredPermission: definition.requiredPermission,
    auditReference,
    modelReadable: definition.visibility !== 'veterinary-restricted',
    version: `1.0.${ordinal}`,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    historicalSnapshots: [historicalSnapshot],
  };
}
