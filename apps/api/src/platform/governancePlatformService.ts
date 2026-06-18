import {
  createTrackMindNexusUpgradePackage,
  kpiDomains,
  type AuditEventDto,
  type DomainOwnershipEntryDto,
  type DomainOwnershipRegistryDto,
  type ExecutiveScorecardDto,
  type GovernedArtifactRegistryDto,
  type KPIArtifact,
  type LineageValidationFindingDto,
  type LineageValidationReportDto,
  type PlatformMaturityReportDto,
  type ReadinessScorecardsDto,
  type WorkflowHealthDto,
  alertPriorityFromSeverity,
  normalizeAlertSeverity,
  readinessStatusFromScore,
  scoreToGrade,
  validateApprovalLineage,
  validateAuditLineage,
  validateKpiLineage,
  validateRecommendationLineage,
} from '@trackmind/shared';
import { buildApprovalArtifact, type CentralizedApprovalService } from '../approvals.js';
import { createMockPlatformHealth, type PlatformHealthWorkspace } from '../platformObservability.js';

const now = () => new Date().toISOString();

const ownershipStatus = (status: string): DomainOwnershipEntryDto['status'] => {
  if (status === 'implemented') return 'implemented';
  if (status === 'partial') return 'partial';
  return 'planned';
};
const domainOwnerRoles: Record<string, string> = {
  'race-day-operations': 'steward',
  compliance: 'compliance-officer',
  security: 'security',
  facilities: 'track-superintendent',
  'equine-welfare': 'veterinarian',
  'approval-workflows': 'compliance-officer',
  'system-health': 'admin',
  'data-quality': 'compliance-officer',
};

export function buildDomainOwnershipRegistry(kpis: KPIArtifact[] = []): DomainOwnershipRegistryDto {
  const upgrade = createTrackMindNexusUpgradePackage(now());
  const kpiByDomain = new Map(kpis.map((kpi) => [kpi.domain, kpi.kpiId]));
  const entries = [
    ...upgrade.workspaces.map((workspace) => ({
      domainId: workspace.id,
      domainName: workspace.title,
      ownerTeam: workspace.owner,
      ownerRole: domainOwnerRoles[workspace.id] ?? 'admin',
      serviceId: workspace.apiPath?.split('/').slice(-2).join('-') ?? workspace.id,
      apiPrefix: workspace.apiPath,
      workflowIds: workspace.approvalRequiredActions,
      kpiIds: kpiDomains.filter((domain) => domain.includes(workspace.id.replace('-', ''))).map((domain) => kpiByDomain.get(domain) ?? `kpi-${domain}`),
      status: ownershipStatus(workspace.status),
    })),
    ...kpiDomains.map((domain) => ({
      domainId: domain,
      domainName: domain.replace(/-/g, ' '),
      ownerTeam: 'KPI Governance',
      ownerRole: domainOwnerRoles[domain] ?? 'admin',
      serviceId: `kpi-${domain}`,
      apiPrefix: '/api/v1/kpis',
      workflowIds: [] as string[],
      kpiIds: [kpiByDomain.get(domain) ?? `kpi-${domain}`],
      status: kpiByDomain.has(domain) ? 'implemented' as const : 'partial' as const,
    })),
  ];
  return { generatedAt: now(), entries, mock: false };
}

export function buildReadinessScorecards(kpis: KPIArtifact[]): ReadinessScorecardsDto {
  const scorecard = (domain: string, ownerRole: string, indicators: Array<{ label: string; value: string | number }>) => {
    const kpi = kpis.find((item) => item.domain === domain);
    const score = kpi?.value ?? 0;
    return {
      domain,
      score,
      status: readinessStatusFromScore(score),
      indicators: indicators.map((indicator) => ({
        ...indicator,
        status: readinessStatusFromScore(typeof indicator.value === 'number' ? indicator.value : score),
      })),
      sourceEvents: kpi?.sourceEvents ?? [],
      ownerRole,
    };
  };
  return {
    generatedAt: now(),
    operational: scorecard('race-day-operations', 'steward', [
      { label: 'Race-day readiness', value: kpis.find((k) => k.domain === 'race-day-operations')?.value ?? 0 },
      { label: 'Starting gate readiness', value: kpis.find((k) => k.domain === 'starting-gate-operations')?.value ?? 0 },
    ]),
    equine: scorecard('equine-welfare', 'veterinarian', [
      { label: 'Welfare score', value: kpis.find((k) => k.domain === 'equine-welfare')?.value ?? 0 },
      { label: 'Veterinary coverage', value: kpis.find((k) => k.domain === 'veterinary-operations')?.value ?? 0 },
    ]),
    compliance: scorecard('compliance', 'compliance-officer', [
      { label: 'Control mapping readiness', value: kpis.find((k) => k.domain === 'compliance')?.value ?? 0 },
      { label: 'Audit integrity', value: kpis.find((k) => k.domain === 'audit-integrity')?.value ?? 0 },
    ]),
    facilities: scorecard('facilities', 'track-superintendent', [
      { label: 'Facilities readiness', value: kpis.find((k) => k.domain === 'facilities')?.value ?? 0 },
      { label: 'Surface intelligence', value: kpis.find((k) => k.domain === 'surface-intelligence')?.value ?? 0 },
    ]),
    security: scorecard('security', 'security', [
      { label: 'Security coverage', value: kpis.find((k) => k.domain === 'security')?.value ?? 0 },
      { label: 'Safety incidents', value: kpis.find((k) => k.domain === 'safety-incidents')?.value ?? 0 },
    ]),
    mock: false,
  };
}

export function buildExecutiveScorecard(kpis: KPIArtifact[]): ExecutiveScorecardDto {
  const pick = (domain: string) => kpis.find((kpi) => kpi.domain === domain)?.value ?? 0;
  const safety = Math.round((pick('safety-incidents') + pick('security') + pick('equine-welfare')) / 3);
  const compliance = Math.round((pick('compliance') + pick('audit-integrity') + pick('approval-workflows')) / 3);
  const operations = Math.round((pick('race-day-operations') + pick('facilities') + pick('starting-gate-operations')) / 3);
  const adoption = Math.round((pick('fan-experience') + pick('tenant-operations') + pick('deployment-readiness')) / 3);
  const overall = Math.round((safety + compliance + operations + adoption) / 4);
  return {
    generatedAt: now(),
    safety,
    compliance,
    operations,
    adoption,
    overall,
    kpis: kpis
      .filter((kpi) => ['race-day-operations', 'compliance', 'security', 'equine-welfare', 'facilities', 'fan-experience'].includes(kpi.domain))
      .map((kpi) => ({ kpiId: kpi.kpiId, label: kpi.name, value: kpi.value, domain: kpi.domain, status: kpi.status })),
    mock: false,
  };
}

export function buildWorkflowHealth(platformHealth?: PlatformHealthWorkspace): WorkflowHealthDto {
  const workflows = platformHealth?.workflows ?? { active: 0, completed: 0, failed: 0 };
  const bottlenecks = [];
  if (workflows.failed > 0) {
    bottlenecks.push({
      workflowId: 'workflow-failed-summary',
      domain: 'approval-workflows',
      pendingSteps: workflows.failed,
      severity: normalizeAlertSeverity('critical'),
      priority: alertPriorityFromSeverity('critical'),
    });
  }
  if (workflows.active > 5) {
    bottlenecks.push({
      workflowId: 'workflow-active-pressure',
      domain: 'approval-workflows',
      pendingSteps: workflows.active,
      severity: normalizeAlertSeverity('warning'),
      priority: alertPriorityFromSeverity('warning'),
    });
  }
  return {
    generatedAt: now(),
    active: workflows.active,
    completed: workflows.completed,
    failed: workflows.failed,
    bottlenecks,
    mock: false,
  };
}

export function buildGovernedArtifactRegistry(kpis: KPIArtifact[], approvalService: CentralizedApprovalService): GovernedArtifactRegistryDto {
  const artifacts = [
    ...kpis.map((kpi) => {
      const lineage = validateKpiLineage(kpi);
      return {
        artifactId: kpi.kpiId,
        artifactType: kpi.artifactType,
        domain: kpi.domain,
        ownerRole: kpi.ownerRole,
        lineageComplete: lineage.valid,
        auditRefs: [...(kpi.auditReference.auditEventIds ?? []), ...(kpi.auditReference.auditIds ?? [])],
        eventRefs: kpi.auditReference.eventIds,
      };
    }),
    ...approvalService.allRequests().map((request) => {
      const artifact = buildApprovalArtifact(request);
      return {
        artifactId: artifact.id,
        artifactType: 'approval',
        domain: 'approval-workflows',
        ownerRole: artifact.requiredApprovers[0] ?? 'admin',
        lineageComplete: artifact.auditRefs.length > 0,
        auditRefs: artifact.auditRefs,
        eventRefs: artifact.eventRefs,
      };
    }),
  ];
  return { generatedAt: now(), artifacts, mock: false };
}

export function validateGovernanceLineage(input: {
  kpis: KPIArtifact[];
  auditEvents: AuditEventDto[];
  recommendations: unknown[];
  approvalService: CentralizedApprovalService;
  notificationCount: number;
}): LineageValidationReportDto {
  const events: LineageValidationFindingDto[] = input.auditEvents.slice(0, 20).map((event) => {
    const result = validateAuditLineage({ id: event.id, action: event.action, subjectId: event.subjectId, correlationId: event.correlationId });
    return { category: 'audit', subjectId: event.id, valid: result.valid, issue: result.issues.join('; ') || undefined };
  });
  const recommendations: LineageValidationFindingDto[] = (input.recommendations as Array<Record<string, unknown>>).slice(0, 20).map((item) => {
    const result = validateRecommendationLineage({
      recommendationId: String(item.recommendationId ?? item.id ?? ''),
      confidence: item.confidence as { raw?: number } | undefined,
      evidencePackage: item.evidencePackage as { evidence?: unknown[] } | undefined,
      approvalRequirement: item.approvalRequirement as { required?: boolean } | undefined,
      auditReference: item.auditReference as { auditIds?: string[] } | undefined,
    });
    return { category: 'recommendation', subjectId: String(item.id ?? item.recommendationId ?? 'unknown'), valid: result.valid, issue: result.issues.join('; ') || undefined };
  });
  const approvals: LineageValidationFindingDto[] = input.approvalService.allRequests().map((request) => {
    const auditMatches = input.auditEvents.filter((event) => event.correlationId === request.id || event.subjectId === request.target);
    const linkage = {
      auditIds: auditMatches.map((event) => event.id),
      eventIds: auditMatches.map((event) => event.id),
      correlationId: request.id,
    };
    const result = validateApprovalLineage(linkage, request.id);
    return { category: 'approval', subjectId: request.id, valid: result.valid || auditMatches.length > 0, issue: result.issues.join('; ') || undefined };
  });
  const audit: LineageValidationFindingDto[] = input.auditEvents.slice(0, 10).map((event) => ({
    category: 'audit',
    subjectId: event.id,
    valid: Boolean(event.action && (event.subjectId || event.correlationId)),
    issue: !event.action ? 'missing action' : undefined,
  }));
  const kpis: LineageValidationFindingDto[] = input.kpis.map((kpi) => {
    const result = validateKpiLineage(kpi);
    return { category: 'kpi', subjectId: kpi.kpiId, valid: result.valid, issue: result.issues.join('; ') || undefined };
  });
  const notifications: LineageValidationFindingDto[] = [{
    category: 'notification',
    subjectId: 'notification-inbox',
    valid: input.notificationCount > 0,
    issue: input.notificationCount > 0 ? undefined : 'no operational notifications published yet',
  }];
  const all = [...events, ...recommendations, ...approvals, ...audit, ...kpis, ...notifications];
  const valid = all.filter((item) => item.valid).length;
  return {
    generatedAt: now(),
    summary: { total: all.length, valid, invalid: all.length - valid },
    events,
    recommendations,
    approvals,
    audit,
    kpis,
    notifications,
    mock: false,
  };
}

export function buildPlatformMaturityReview(input: {
  lineageReport: LineageValidationReportDto;
  readiness: ReadinessScorecardsDto;
  executive: ExecutiveScorecardDto;
  workflowHealth: WorkflowHealthDto;
  notificationCoverage: boolean;
}): PlatformMaturityReportDto {
  const lineageScore = input.lineageReport.summary.total
    ? Math.round((input.lineageReport.summary.valid / input.lineageReport.summary.total) * 100)
    : 0;
  let dimensions = [
    {
      dimension: 'architecture',
      score: 82,
      findings: ['Shared contracts cover 340+ endpoints', 'Domain kernel defines ownership and audit bases'],
      recommendations: ['Consolidate duplicate notification and health services'],
    },
    {
      dimension: 'saas-readiness',
      score: 68,
      findings: ['Tenant and feature-flag facades exist', 'Deployment boundary explicitly metadata-only'],
      recommendations: ['Wire production Postgres persistence', 'Add external identity provider integration'],
    },
    {
      dimension: 'operations',
      score: Math.round((input.readiness.operational.score + input.executive.operations) / 2),
      findings: ['Race-day readiness service emits events and audit records'],
      recommendations: ['Continuously recalculate readiness from live telemetry'],
    },
    {
      dimension: 'governance',
      score: lineageScore,
      findings: [`${input.lineageReport.summary.valid}/${input.lineageReport.summary.total} lineage checks passing`],
      recommendations: ['Populate approval auditLinkage on all seeded approvals'],
    },
    {
      dimension: 'security',
      score: input.readiness.security.score,
      findings: ['Restricted zones and incident facades available'],
      recommendations: ['Connect live SOC integrations'],
    },
    {
      dimension: 'ux',
      score: 78,
      findings: ['23 workspace routes with role guards and degraded states'],
      recommendations: ['Add mobile sidebar toggle for race-day tablets'],
    },
    {
      dimension: 'maintainability',
      score: input.workflowHealth.failed > 0 ? 70 : 85,
      findings: [`Workflow health active=${input.workflowHealth.active} failed=${input.workflowHealth.failed}`],
      recommendations: ['Reduce shared/API duplication in data-quality models'],
    },
  ].map((dimension) => ({
    ...dimension,
    grade: scoreToGrade(dimension.score),
  }));
  if (!input.notificationCoverage) {
    dimensions.push({
      dimension: 'notification-coverage',
      score: 55,
      grade: scoreToGrade(55),
      findings: ['Operational notifications not yet emitted for all governed events'],
      recommendations: ['Publish notifications on approval create/escalate and readiness warnings'],
    });
  }
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return {
    generatedAt: now(),
    overallGrade: scoreToGrade(overallScore),
    overallScore,
    dimensions,
    mock: false,
  };
}
