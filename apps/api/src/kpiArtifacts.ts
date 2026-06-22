import {
  createModelReadableKPIContext,
  hasPermission,
  registerFacilitiesKpiPack,
  registerSafetyKpiPack,
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
  organizationId?: string;
  tenantId?: string;
  racetrackId?: string;
  role?: Role;
}

type KPIDefinitionSeed = {
  domain: KPIDomain;
  metricSlug?: string;
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
  seed('racing-calendar', 'Calendar conflict pressure', 'Blocking schedule conflicts across seasons, meets, race days, and post times.', 'count', 0, 'conflicts', 0, 'nominal', 'flat', 'horse-operations-coordinator', 'approval-visible', 'race:request-start', ['calendar.conflict.detected', 'calendar.meet.draft.requested'], [{ entityType: 'racing-calendar', entityId: 'main-track' }]),
  seed('trainer-management', 'Trainer compliance coverage', 'Percentage of trainers with compliant posture across licensing, welfare, and steward review metadata.', 'percentage', 100, '%', 95, 'nominal', 'insufficient-history', 'horse-operations-coordinator', 'approval-visible', 'race:request-start', ['trainer-management.compliance.updated', 'trainer-management.created'], [{ entityType: 'trainer-management', entityId: 'main-track' }]),
  seed('jockey-management', 'Jockey eligibility coverage', 'Percentage of jockeys currently eligible to ride based on licensing and compliance records.', 'percentage', 100, '%', 95, 'nominal', 'insufficient-history', 'steward', 'approval-visible', 'race:request-start', ['jockey-management.eligibility.updated', 'jockey-management.created'], [{ entityType: 'jockey-management', entityId: 'main-track' }]),
  seed('veterinary-operations', 'Veterinary clearance coverage', 'Percentage of active horses with current pre-race or return-to-training clearance workflows on file.', 'percentage', 88, '%', 95, 'watch', 'insufficient-history', 'veterinarian', 'regulated-advisory-only', 'vet:review', ['veterinary-operations.clearance.updated', 'veterinary-operations.case.read'], [{ entityType: 'veterinary-operations', entityId: 'main-track' }], 'veterinary-restricted'),
  seed('paddock-operations', 'Paddock parade readiness', 'Percentage of assigned horses parade-ready with inspections and readiness checks complete.', 'percentage', 88, '%', 95, 'watch', 'insufficient-history', 'horse-operations-coordinator', 'approval-visible', 'race:request-start', ['paddock-operations.readiness.recorded', 'paddock-operations.assignment.recorded'], [{ entityType: 'paddock-operations', entityId: 'main-track' }]),
  seed('steward-operations', 'Steward inquiry resolution coverage', 'Percentage of steward inquiries with audit-linked evidence, reviews, and approval workflows on file.', 'percentage', 92, '%', 95, 'watch', 'insufficient-history', 'steward', 'approval-visible', 'discipline:issue', ['steward-operations.approval.requested', 'steward-operations.review.recorded'], [{ entityType: 'steward-operations', entityId: 'main-track' }]),
  seed('starting-gate-operations', 'Starting gate race readiness', 'Percentage of races with gate assignments, readiness checks, and approval-governed start workflows on file; no automated race starts.', 'percentage', 90, '%', 95, 'watch', 'insufficient-history', 'steward', 'approval-visible', 'race:request-start', ['starting-gate-operations.readiness.recorded', 'starting-gate-operations.race-start.approval-requested'], [{ entityType: 'starting-gate-operations', entityId: 'main-track' }]),
  seed('surface-intelligence', 'Track surface readiness score', 'Composite surface intelligence readiness from observations, condition history, inspections, maintenance events, and approval-governed operational workflows.', 'score', 78, 'score', 90, 'watch', 'insufficient-history', 'facilities-manager', 'approval-visible', 'track:readings', ['surface-intelligence.observation.recorded', 'surface-intelligence.inspection.recorded'], [{ entityType: 'surface-intelligence', entityId: 'main-track' }]),
  seed('equine-welfare', 'Equine welfare intelligence score', 'Composite welfare score from indicators, observations, alert pressure, retirement readiness, digital twin coverage, and advisory-only AI recommendation posture.', 'score', 86, 'score', 90, 'watch', 'insufficient-history', 'veterinarian', 'regulated-advisory-only', 'vet:review', ['equine-welfare.observation.recorded', 'equine-welfare.alert.raised', 'equine.profile.viewed'], [{ entityType: 'equine-welfare-intelligence', entityId: 'main-track' }], 'veterinary-restricted'),
  seed('equine-intelligence', 'Equine eligibility readiness', 'Percentage of active horses passing eligibility rules without open compliance flags or unresolved withdrawal periods.', 'percentage', 82, '%', 95, 'watch', 'insufficient-history', 'horse-operations-coordinator', 'approval-visible', 'horse:scratch', ['equine.eligibility.viewed', 'equine.eligibility.updated', 'equine.profile.viewed'], [{ entityType: 'equine-intelligence', entityId: 'main-track' }]),
  seed('equine-intelligence', 'Veterinary privacy audit coverage', 'Percentage of equine profile and veterinary mutations with hash-chained audit events and privacy scope metadata.', 'percentage', 94, '%', 100, 'watch', 'flat', 'veterinarian', 'regulated-advisory-only', 'vet:review', ['equine.veterinary.recorded', 'equine.profile.viewed'], [{ entityType: 'equine-intelligence', entityId: 'main-track' }], 'veterinary-restricted', 'privacy-audit-coverage'),
  seed('equine-intelligence', 'Horse digital twin sync coverage', 'Percentage of equine profiles with primary digital twin references synced to the twin runtime.', 'percentage', 100, '%', 95, 'nominal', 'flat', 'compliance-officer', 'approval-visible', 'read:any', ['equine.profile.created', 'equine.digital-twin.synced'], [{ entityType: 'equine-intelligence', entityId: 'main-track' }], 'tenant-internal', 'twin-sync-coverage'),
  seed('safety-incidents', 'Open safety incident pressure', 'Count-style pressure score from security/emergency incident facade rows.', 'score', 42, 'pressure', 25, 'warning', 'up', 'security-manager', 'approval-visible', 'incident:manage', ['incident.created', 'emergency.alert.raised'], [{ entityType: 'incident', entityId: 'incident:surface-review' }]),
  seed('stewarding', 'Steward evidence readiness', 'Readiness of steward inquiry evidence bundles before any human-only ruling.', 'score', 71, 'score', 90, 'watch', 'flat', 'steward', 'regulated-advisory-only', 'discipline:issue', ['steward.inquiry.opened', 'steward.approval.requested'], [{ entityType: 'inquiry', entityId: 'inq-race-7' }]),
  seed('compliance', 'Compliance control mapping readiness', 'Readiness score from mapped control library evidence, not a certification claim.', 'score', 68, 'score', 85, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['compliance.control.mapped'], [{ entityType: 'control-library', entityId: 'trackmind-control-library' }]),
  seed('compliance', 'Open compliance findings', 'Count of open findings requiring corrective action across mapped controls.', 'count', 1, 'findings', 0, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['compliance.finding.opened'], [{ entityType: 'control-library', entityId: 'trackmind-control-library' }], 'tenant-internal', 'open-findings'),
  seed('compliance', 'Overdue corrective actions', 'Corrective actions past due date in the compliance register.', 'count', 0, 'actions', 0, 'nominal', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['compliance.corrective-action.created'], [{ entityType: 'control-library', entityId: 'trackmind-control-library' }], 'tenant-internal', 'overdue-actions'),
  seed('compliance', 'Sealed evidence package coverage', 'Percentage of evidence packages sealed for internal review.', 'percentage', 100, '%', 90, 'nominal', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['compliance.evidence.collected'], [{ entityType: 'evidence-package', entityId: 'pkg-accreditation-2026-q2' }], 'tenant-internal', 'evidence-package-coverage'),
  seed('compliance', 'Accreditation readiness score', 'Internal accreditation readiness score; not external certification.', 'score', 72, 'score', 85, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['compliance.accreditation.readiness.updated'], [{ entityType: 'accreditation-program', entityId: 'program-integrated-accreditation-2026' }], 'tenant-internal', 'accreditation-readiness'),
  seed('security', 'Security operations coverage', 'Operational coverage from restricted zones, cameras, sensors, and incident facade records.', 'percentage', 74, '%', 95, 'watch', 'down', 'security-manager', 'approval-visible', 'security:manage', ['security.zone.observed', 'camera.health.updated'], [{ entityType: 'security-zone', entityId: 'paddock-restricted-zone' }]),
  seed('ticketing', 'Ticketing contract readiness', 'Readiness-only KPI because no dedicated ticketing DB or shared DTO exists.', 'readiness', 18, 'score', 80, 'readiness-only', 'insufficient-history', 'ticketing-fan-manager', 'none', 'ticketing:manage', ['ticketing.readiness.documented'], [{ entityType: 'workspace', entityId: 'ticketing' }]),
  seed('finance', 'Racing finance readiness score', 'Composite finance score from revenue, race-day and operational expenses, facility costs, purse obligations, reconciliation exceptions, and approval-governed payout posture.', 'score', 84, 'score', 90, 'watch', 'insufficient-history', 'finance-manager', 'regulated-advisory-only', 'finance:payout', ['racing-finance.ticket-revenue.recorded', 'racing-finance.payout.requested', 'racing-finance.purse.allocated'], [{ entityType: 'racing-finance', entityId: 'main-track' }]),
  seed('fan-experience', 'Fan experience readiness score', 'Composite fan experience score from attendance utilization, guest service resolution, hospitality readiness, premium seating occupancy, event satisfaction, and revenue linkage.', 'score', 82, 'score', 88, 'watch', 'insufficient-history', 'ticketing-fan-manager', 'approval-visible', 'ticketing:manage', ['fan-experience.attendance.recorded', 'fan-experience.satisfaction.recorded', 'fan-experience.guest-service.created'], [{ entityType: 'fan-experience', entityId: 'main-track' }]),
  seed('racing-data-hub', 'Provider adapter readiness', 'Racing Data Hub readiness from provider registry, lineage, policy, and quality facade coverage.', 'score', 72, 'score', 90, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['racing-data.provider.reviewed', 'racing-data.lineage.generated'], [{ entityType: 'provider-registry', entityId: 'racing-data' }]),
  seed('multi-track-federation', 'Industry intelligence federation score', 'Composite federation score from anonymized benchmarks, aggregate KPIs, cohort coverage, and governance posture; raw cross-track records are never exposed.', 'score', 72, 'score', 85, 'watch', 'insufficient-history', 'compliance-officer', 'approval-visible', 'compliance:audit', ['federation.benchmark.published', 'industry-intelligence.aggregate.generated', 'federation.aggregate.generated'], [{ entityType: 'industry-intelligence', entityId: 'org-trackmind-network' }], 'federation-aggregate'),
  seed('ai-governance', 'AI recommendation governance completeness', 'Completeness of advisory AI recommendation metadata, evidence, approvals, and audit references.', 'percentage', 91, '%', 95, 'watch', 'up', 'compliance-officer', 'approval-visible', 'ai:approve', ['ai.recommendation.evaluated', 'ai.approval.required'], [{ entityType: 'ai-control-plane', entityId: 'control-plane' }]),
  seed('audit-integrity', 'Audit hash-chain visibility', 'Audit integrity visibility from hash/evidence facade records, not a durable evidence vault claim.', 'percentage', 83, '%', 100, 'watch', 'flat', 'read-only-auditor', 'approval-visible', 'compliance:audit', ['audit.event.appended', 'audit.verification.requested'], [{ entityType: 'audit-ledger', entityId: 'audit-facade' }]),
  seed('approval-workflows', 'Approval workflow traceability', 'Traceability score for governed approval records, evidence, event refs, and audit refs.', 'percentage', 88, '%', 95, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'ai:approve', ['approval.requested', 'approval.workflow.updated'], [{ entityType: 'approval-queue', entityId: 'central-approval-service' }]),
  seed('tenant-operations', 'Tenant scope readiness', 'Readiness of tenant/racetrack metadata boundaries; not proof of enforced RLS.', 'score', 54, 'score', 90, 'readiness-only', 'insufficient-history', 'platform-super-admin', 'approval-visible', 'read:any', ['tenant.scope.reviewed'], [{ entityType: 'tenant', entityId: 'trackmind' }]),
  seed('system-health', 'Platform health score', 'Platform health KPI from backend facade health/service metadata.', 'score', 79, 'score', 95, 'watch', 'flat', 'platform-super-admin', 'none', 'read:any', ['platform.health.checked'], [{ entityType: 'platform-health', entityId: 'trackmind-api' }]),
  seed('data-quality', 'Data quality readiness', 'Quality score derived from data hub quality reports and feature-store placeholder metadata.', 'score', 69, 'score', 90, 'watch', 'flat', 'compliance-officer', 'approval-visible', 'compliance:audit', ['data-quality.report.generated', 'feature.record.generated'], [{ entityType: 'data-quality-report', entityId: 'racing-data-quality' }]),
  seed('veterinary-privacy', 'Veterinary privacy guardrail coverage', 'Coverage KPI for veterinary privacy scoping; sensitive details are restricted.', 'percentage', 82, '%', 100, 'watch', 'flat', 'veterinarian', 'regulated-advisory-only', 'vet:review', ['equine.profile.viewed', 'equine.hisa.verification'], [{ entityType: 'privacy-policy', entityId: 'equine-privacy' }], 'veterinary-restricted'),
  seed('deployment-readiness', 'Deployment readiness evidence score', 'Readiness score from build/test/performance artifacts and documented deployment boundaries.', 'score', 77, 'score', 95, 'watch', 'up', 'platform-super-admin', 'approval-visible', 'read:any', ['deployment.readiness.evaluated'], [{ entityType: 'artifact-index', entityId: 'TRACKMIND_SYSTEM_AUDIT_ARTIFACTS.csv' }]),
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
  metricSlug?: string,
): KPIDefinitionSeed {
  return {
    domain,
    metricSlug,
    name,
    description,
    metricType,
    value,
    unit,
    target,
    threshold: domain === 'safety-incidents'
      ? { warning: target, critical: target * 1.5, targetDirection: 'below', description: 'Safety incident pressure should stay below target; values above target require human review.' }
      : { warning: target * 0.85, critical: target * 0.65, targetDirection: 'above', description: 'Readiness and quality KPIs should meet or exceed target unless explicitly count/pressure based.' },
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
  const baseKpis = seeds.map((definition, index) => toArtifact(definition, generatedAt, tenantId, organizationId, racetrackId, index + 1));
  const facilitiesPack = registerFacilitiesKpiPack({ generatedAt, tenantId, organizationId, racetrackId });
  const safetyPack = registerSafetyKpiPack({ generatedAt, tenantId, organizationId, racetrackId });
  const kpis = [...baseKpis, ...facilitiesPack, ...safetyPack];
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
    if (principal.organizationId && kpi.organizationId !== principal.organizationId) return false;
    if (principal.tenantId && kpi.tenantId !== principal.tenantId) return false;
    if (principal.racetrackId && kpi.racetrackId && kpi.racetrackId !== principal.racetrackId) return false;
    if (kpi.visibility === 'veterinary-restricted' && role !== 'veterinarian' && role !== 'platform-super-admin') return false;
    if (kpi.visibility === 'restricted' && role !== 'platform-super-admin' && role !== kpi.ownerRole) return false;
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
  const kpiId = definition.metricSlug ? `kpi-${definition.domain}-${definition.metricSlug}` : `kpi-${definition.domain}`;
  const calculationRunId = `calc-${kpiId}-v1`;
  const auditReference = {
    auditEventIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    auditIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
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
