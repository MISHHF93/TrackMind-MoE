import type {
  TrackCertificationCandidateDto,
  TrackCertificationCriterionDto,
  TrackCertificationEvidenceKindDto,
  TrackCertificationEvidenceRefDto,
  TrackCertificationReadinessStatusDto,
  TrackCertificationRequirementIdDto,
  TrackOperatingStandardDto,
} from '@trackmind/shared';

type ComplianceLike = {
  controls?: Array<{ id: string; status: string; evidenceIds?: string[]; auditRecordIds?: string[]; workflowInstanceIds?: string[]; approvalRequestIds?: string[]; digitalTwinRefs?: string[] }>;
  evidencePackages?: Array<{ id: string; evidenceIds: string[]; auditRecordIds: string[]; workflowInstanceIds: string[]; approvalRequestIds: string[]; digitalTwinRefs: string[]; readiness: string; sealed: boolean }>;
  accreditationPrograms?: Array<{ id: string; status: string; requiredControlIds: string[]; evidencePackageIds: string[]; readinessScore: number; nextReviewAt?: string }>;
  readiness?: { score: number; evidenceCoverage: number };
  integrations?: { audit?: boolean; workflow?: boolean; approvals?: boolean; events?: boolean; apiFacade?: boolean; commandCenter?: boolean; digitalTwin?: boolean };
};

type ReadinessLike = {
  averageScore?: number;
  domainScores?: Array<{ domain: string; averageScore: number; blocked: number; watch: number }>;
  auditRecords?: Array<{ id: string; evidence: string[] }>;
  events?: Array<{ id: string; evidence: string[] }>;
};

type PlatformHealthLike = {
  overallStatus?: string;
  services?: Array<{ serviceId: string; status: string }>;
  audit?: { validLedger: boolean; records: number };
  digitalTwin?: { totalTwins: number; healthy: number; degraded: number; critical: number };
  aiGovernance?: { activeAgents: number; blockedActions: number; approvalRequiredCount?: number };
};

type AIGovernanceLike = {
  activeAgents?: unknown[];
  safetyPolicies?: Array<{ id: string; requiredEvidence: string[]; protectedActions: string[]; prohibitedAutonomousActions: string[] }>;
  auditTrails?: Array<{ id: string; evidence: string[] }>;
  evidencePackages?: Array<{ id: string; evidence: string[] }>;
  evaluationStatus?: Array<{ readiness: { deployable: boolean; gaps: string[] } }>;
};

type CertificationInputs = {
  trackId: string;
  generatedAt: string;
  compliance: ComplianceLike;
  readiness: ReadinessLike;
  platformHealth: PlatformHealthLike;
  aiGovernance: AIGovernanceLike;
  digitalTwinState: Array<{ twinId: string; health: string }>;
  auditLedger: { verification?: { valid?: boolean }; complianceExport?: { records?: unknown[] } };
  mock: boolean;
};

export const certifiedTrackRequirementIds = [
  'platform-installed',
  'operational-controls-active',
  'safety-controls-active',
  'inspection-controls-active',
  'digital-twin-active',
  'audit-ledger-active',
  'ai-governance-active',
] as const satisfies TrackCertificationCriterionDto['id'][];

const claimBoundary = 'TrackMind readiness/certification candidate only; no external certification, accreditation, regulator approval, or third-party endorsement is asserted.';

const unique = <T>(values: T[]): T[] => [...new Set(values.filter(Boolean))];
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const avg = (values: number[]) => values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
const readinessStatus = (score: number, blockers: string[]): TrackCertificationReadinessStatusDto => blockers.length ? (score < 70 ? 'blocked' : 'action-required') : score >= 90 ? 'ready-for-trackmind-review' : 'candidate';
const evidence = (id: string, kind: TrackCertificationEvidenceKindDto, source: string, controlId?: string, status?: string): TrackCertificationEvidenceRefDto => ({ id, kind, source, controlId, status });

export function createTrackCertificationCandidate(input: CertificationInputs): TrackCertificationCandidateDto {
  const controls = input.compliance.controls ?? [];
  const controlIds = controls.map((control) => control.id);
  const effectiveControlIds = controls.filter((control) => control.status === 'effective').map((control) => control.id);
  const packages = input.compliance.evidencePackages ?? [];
  const program = input.compliance.accreditationPrograms?.[0];
  const domainScores = input.readiness.domainScores ?? [];
  const operationalScore = clamp(input.readiness.averageScore ?? avg(domainScores.map((domain) => domain.averageScore)));
  const safetyScore = avg(domainScores.filter((domain) => ['track','gate','veterinary','stewards','emergency','security'].includes(domain.domain)).map((domain) => domain.averageScore));
  const complianceScore = clamp(input.compliance.readiness?.score ?? 0);
  const accreditationScore = clamp(program?.readinessScore ?? complianceScore);
  const auditValid = input.auditLedger.verification?.valid ?? input.platformHealth.audit?.validLedger ?? false;
  const twinCount = input.digitalTwinState.length || input.platformHealth.digitalTwin?.totalTwins || 0;
  const activeAiPolicies = input.aiGovernance.safetyPolicies ?? [];
  const aiDeployable = (input.aiGovernance.evaluationStatus ?? []).some((status) => status.readiness.deployable);
  const scorecard = {
    safetyScore,
    complianceScore,
    operationalScore,
    accreditationScore,
    overallScore: avg([safetyScore, complianceScore, operationalScore, accreditationScore]),
    generatedAt: input.generatedAt,
    scoringModel: 'trackmind-certified-track.v1' as const,
    scoreBands: { ready: 90, watch: 75, blocked: 70 },
  };

  const operatingStandards: TrackOperatingStandardDto[] = [
    { id: 'standard-safety-controls', title: 'Safety-critical controls remain human-approved and audit-backed', category: 'safety', required: true, controlRefs: unique(['ctrl-racing-safety-integrity', 'ctrl-risk-treatment'].filter((id) => controlIds.includes(id))), evidenceRefs: ['readiness:domain-scores', 'approval:controlled-actions'], ownerRole: 'steward', cadence: 'race-day' },
    { id: 'standard-operations-readiness', title: 'Operational readiness is evaluated before governed race-day actions', category: 'operations', required: true, controlRefs: unique(['ctrl-risk-treatment', ...effectiveControlIds]), evidenceRefs: ['readiness:dashboard', 'readiness:audit-records'], ownerRole: 'admin', cadence: 'race-day' },
    { id: 'standard-inspection-evidence', title: 'Inspection and facility evidence is linked before readiness review', category: 'inspection', required: true, controlRefs: unique(['ctrl-racing-safety-integrity', 'ctrl-software-quality'].filter((id) => controlIds.includes(id))), evidenceRefs: ['inspection:surface', 'inspection:facilities'], ownerRole: 'track-superintendent', cadence: 'daily' },
    { id: 'standard-digital-twin', title: 'Digital Twin references are active and read-only until approved sync', category: 'digital-twin', required: true, controlRefs: unique(controls.filter((control) => (control.digitalTwinRefs ?? []).length > 0).map((control) => control.id)), evidenceRefs: ['digital-twin:state', 'digital-twin:queued-sync'], ownerRole: 'track-superintendent', cadence: 'continuous' },
    { id: 'standard-audit-ledger', title: 'Audit ledger remains immutable, valid, and exportable', category: 'audit', required: true, controlRefs: unique(controls.filter((control) => (control.auditRecordIds ?? []).length > 0).map((control) => control.id)), evidenceRefs: ['audit:verification', 'audit:compliance-export'], ownerRole: 'compliance-officer', cadence: 'continuous' },
    { id: 'standard-ai-governance', title: 'AI recommendations are advisory-only with required evidence and approvals', category: 'ai-governance', required: true, controlRefs: unique(['ctrl-ai-evidence'].filter((id) => controlIds.includes(id))), evidenceRefs: ['ai:safety-policy', 'ai:evidence-packages', 'ai:audit-trails'], ownerRole: 'compliance-officer', cadence: 'continuous' },
    { id: 'standard-accreditation-readiness', title: 'Accreditation readiness is internal TrackMind readiness, not external certification', category: 'compliance', required: true, controlRefs: unique(program?.requiredControlIds ?? controlIds), evidenceRefs: unique(packages.map((pkg) => `evidence-package:${pkg.id}`)), ownerRole: 'compliance-officer', cadence: 'quarterly' },
  ];

  const criteria = ([
    {
      id: 'platform-installed' as const,
      label: 'Platform Installed',
      description: 'API facade, dashboard, platform health, approvals, event, audit, and compliance workspaces are present.',
      required: true,
      score: input.platformHealth.overallStatus === 'critical' ? 60 : input.platformHealth.overallStatus === 'degraded' ? 82 : 95,
      requiredControlRefs: unique(['ctrl-software-quality', ...controlIds.filter((id) => /trust|quality|risk/i.test(id))]),
      requiredEvidenceRefs: [evidence('platform-health', 'platform-health', '/api/v1/platform/health', undefined, input.platformHealth.overallStatus), ...unique(input.platformHealth.services?.map((service) => evidence(`service:${service.serviceId}`, 'platform-health', 'platform-health', undefined, service.status)) ?? [])],
      blockers: input.platformHealth.overallStatus === 'critical' ? ['platform health critical'] : [],
      status: 'candidate',
    },
    {
      id: 'operational-controls-active' as const,
      label: 'Operational Controls Active',
      description: 'Race-day readiness, workforce/facility readiness, approvals, and command-center operating controls are active.',
      required: true,
      score: operationalScore,
      requiredControlRefs: unique(['ctrl-risk-treatment', ...effectiveControlIds]),
      requiredEvidenceRefs: [evidence('readiness:dashboard', 'readiness', '/api/v1/race-day-readiness/dashboard', undefined, String(operationalScore)), ...unique((input.readiness.auditRecords ?? []).map((record) => evidence(record.id, 'audit', 'race-day-readiness')))],
      blockers: domainScores.filter((domain) => domain.blocked > 0).map((domain) => `${domain.domain} blocked`),
      status: 'candidate',
    },
    {
      id: 'safety-controls-active' as const,
      label: 'Safety Controls Active',
      description: 'Track, gate, veterinary, steward, emergency, and security controls are ready or under documented watch.',
      required: true,
      score: safetyScore,
      requiredControlRefs: unique(['ctrl-racing-safety-integrity', 'ctrl-risk-treatment'].filter((id) => controlIds.includes(id))),
      requiredEvidenceRefs: unique(domainScores.filter((domain) => ['track','gate','veterinary','stewards','emergency','security'].includes(domain.domain)).map((domain) => evidence(`readiness:${domain.domain}`, 'readiness', 'race-day-readiness', undefined, String(domain.averageScore)))),
      blockers: domainScores.filter((domain) => ['track','gate','veterinary','stewards','emergency','security'].includes(domain.domain) && domain.blocked > 0).map((domain) => `${domain.domain} blocked`),
      status: 'candidate',
    },
    {
      id: 'inspection-controls-active' as const,
      label: 'Inspection Controls Active',
      description: 'Surface, facility, barn, safety, and racing integrity inspection evidence is linked to controls.',
      required: true,
      score: controls.some((control) => /racing|quality|risk/i.test(control.id)) ? avg([safetyScore, complianceScore]) : 0,
      requiredControlRefs: unique(['ctrl-racing-safety-integrity', 'ctrl-software-quality'].filter((id) => controlIds.includes(id))),
      requiredEvidenceRefs: unique(controls.flatMap((control) => (control.evidenceIds ?? []).map((id) => evidence(id, 'evidence', 'compliance-control-library', control.id, control.status)))),
      blockers: controls.length ? [] : ['inspection control library missing'],
      status: 'candidate',
    },
    {
      id: 'digital-twin-active' as const,
      label: 'Digital Twin Active',
      description: 'Digital Twin state and control references are present for governed track operations.',
      required: true,
      score: twinCount > 0 ? (input.platformHealth.digitalTwin?.critical ? 76 : 92) : 0,
      requiredControlRefs: unique(controls.filter((control) => (control.digitalTwinRefs ?? []).length > 0).map((control) => control.id)),
      requiredEvidenceRefs: unique(input.digitalTwinState.map((twin) => evidence(twin.twinId, 'digital-twin', '/api/v1/digital-twin/state', undefined, twin.health))),
      blockers: twinCount ? [] : ['digital twin state missing'],
      status: 'candidate',
    },
    {
      id: 'audit-ledger-active' as const,
      label: 'Audit Ledger Active',
      description: 'Immutable audit ledger verification and compliance export evidence are available.',
      required: true,
      score: auditValid ? 95 : 0,
      requiredControlRefs: unique(controls.filter((control) => (control.auditRecordIds ?? []).length > 0).map((control) => control.id)),
      requiredEvidenceRefs: [evidence('audit:verification', 'audit', '/api/v1/audit/verification', undefined, auditValid ? 'valid' : 'invalid'), ...unique(controls.flatMap((control) => (control.auditRecordIds ?? []).map((id) => evidence(id, 'audit', 'compliance-control-library', control.id, control.status))))],
      blockers: auditValid ? [] : ['audit ledger verification failed'],
      status: 'candidate',
    },
    {
      id: 'ai-governance-active' as const,
      label: 'AI Governance Active',
      description: 'Responsible AI governance, advisory-only safety policy, evidence packages, and audit trails are active.',
      required: true,
      score: activeAiPolicies.length && (input.aiGovernance.activeAgents ?? []).length ? (aiDeployable ? 96 : 88) : 0,
      requiredControlRefs: unique(['ctrl-ai-evidence'].filter((id) => controlIds.includes(id))),
      requiredEvidenceRefs: [evidence('ai:safety-policy', 'ai-governance', '/api/v1/ai-governance/workspace', undefined, activeAiPolicies[0]?.id), ...unique((input.aiGovernance.evidencePackages ?? []).map((pkg) => evidence(pkg.id, 'ai-governance', 'ai-governance:evidence-package'))), ...unique((input.aiGovernance.auditTrails ?? []).map((audit) => evidence(audit.id, 'audit', 'ai-governance:audit-trail')))],
      blockers: activeAiPolicies.length ? [] : ['AI safety policy missing'],
      status: 'candidate',
    },
  ] as const).map((criterion): TrackCertificationCriterionDto => ({ ...criterion, id: criterion.id as TrackCertificationRequirementIdDto, requiredControlRefs: [...criterion.requiredControlRefs], requiredEvidenceRefs: [...criterion.requiredEvidenceRefs], blockers: [...criterion.blockers], status: readinessStatus(criterion.score, criterion.blockers) }));

  const requiredEvidenceRefs = unique(criteria.flatMap((criterion) => criterion.requiredEvidenceRefs));
  const requiredControlRefs = unique(criteria.flatMap((criterion) => criterion.requiredControlRefs));
  const readiness = readinessStatus(scorecard.overallScore, criteria.flatMap((criterion) => criterion.blockers));

  return {
    tier: 8,
    model: 'franchise',
    certificationLabel: 'TrackMind Certified Track',
    trackId: input.trackId,
    generatedAt: input.generatedAt,
    readinessStatus: readiness,
    candidateStatement: 'TrackMind Certified Track candidate metadata indicates internal TrackMind readiness for franchise-style operating standards review.',
    externalCertificationClaimed: false,
    claimBoundary,
    certificationCriteria: criteria,
    scorecard,
    requiredEvidenceRefs,
    requiredControlRefs,
    accreditationReadiness: {
      status: readinessStatus(accreditationScore, program?.status === 'accredited' ? ['external accreditation claims are not represented by this model'] : []),
      score: accreditationScore,
      programIds: unique(input.compliance.accreditationPrograms?.map((item) => item.id) ?? []),
      evidencePackageIds: unique(packages.map((pkg) => pkg.id)),
      controlIds: unique(program?.requiredControlIds ?? controlIds),
      nextReviewAt: program?.nextReviewAt,
    },
    operatingStandards,
    integrations: {
      platform: Boolean(input.platformHealth.services?.length),
      operationalControls: operationalScore > 0,
      safetyControls: safetyScore > 0,
      inspectionControls: controls.some((control) => (control.evidenceIds ?? []).length > 0),
      digitalTwin: twinCount > 0 && input.compliance.integrations?.digitalTwin !== false,
      auditLedger: auditValid && input.compliance.integrations?.audit !== false,
      aiGovernance: activeAiPolicies.length > 0,
      complianceReadiness: complianceScore > 0,
    },
    mock: input.mock,
  };
}
