import type { KeyboardEvent } from 'react';
import { createRacingDataApiHubServiceMetadata, createTrackMindNexusUpgradePackage, hasPermission, type Role } from '@trackmind/shared';
import { createNexusClient, NexusApiError, type NexusApiClient } from './api/client.js';
import { CollaborationPanel as SharedCollaborationPanel } from './components/collaboration.js';
import { DataState } from './components/states.js';
import { ActionRail, ApprovalChip, AssetHealthIndicator, AuditEventRow, CollaborationPanel, CommandBar, CommandPanel, DataFreshness, DataTable, DataTableShell, DetailDrawer, DigitalTwinRelationshipCard, EventTimeline, FilterBar, KpiTile, MetricStrip, MockDataBanner, NotificationList, PageHeader, RecordSourceLabel, RiskBadge, SafetyCriticalActionButton, StatusCard, StatusIndicator, TrackMapPanel, WorkspaceFrame, WorkspaceLayout, WorkspacePanel } from './components/nexus-ui.js';
import { buildStreamingDataSnapshot, StreamingDataStatus } from './components/streaming-data.js';
import { ApprovalsPanel } from './domains/approvals/ApprovalsPanel.js';
import { AuditReviewPanel } from './domains/audit/AuditReviewPanel.js';
import { ApiHubPanel } from './domains/api-hub/ApiHubPanel.js';
import { CanonicalDataExplorer } from './domains/api-hub/CanonicalDataExplorer.js';
import { AIGovernancePanel, CompliancePanel } from './domains/governance/GovernancePanels.js';
import { RaceOfficePanel } from './domains/race-office/RaceOfficePanel.js';
import { StartingGateControl, calculateRequiredGatePosition } from './domains/starting-gate/StartingGateControl.js';
import { SurfaceIntelligenceWorkspace } from './domains/surface/SurfaceIntelligenceWorkspace.js';
import { TrackMap } from './domains/track-map/TrackMap.js';
import { domainScreens } from './shell/domains.js';
import { breadcrumbForPath, filterCommandPalette, selectTenant, serviceBanner, tenants, type ServiceState, type TenantOption, type UserProfile } from './shell/experience.js';
import { apiHubDeepLinks, canonicalPathForRoute, groupedVisibleNavItems, groupHasActiveItem, legacyRouteAliases, navLinkState, routeAliasForPath, routeBadgesForItem, visibleNavItems, type NavBadge, type NavBadgeMap, type NavGroup } from './shell/navigation.js';
import type { ApprovalDto, CollaborationActorDto, CollaborationContextDto, CollaborationCreateAssignmentDto, CollaborationCreateCommentDto, CollaborationCreateDecisionDto, CollaborationWorkspaceDto, DraftActionDto, EquineIntelligenceDto, FacilitiesMaintenanceDto, PlatformHealthWorkspaceDto, RaceOfficeApprovalActionDto, RacingDataApiHubWorkspaceDto, RacingDataClassDto, RacingDataExportManifestDto, RacingDataLicenseDto, TrackCertificationCandidateDto, TUSStandardizationWorkspaceDto, WorkforceOperationsDto } from './types.js';

export { calculateRequiredGatePosition };

type OperationalRisk = 'low' | 'medium' | 'high' | 'critical';
type OperationalStatus = 'nominal' | 'standby' | 'warning' | 'critical' | 'closed' | 'in-progress' | 'simulated' | string;

function isWorkspacePathActive(currentPath: string, route: string): boolean {
  return currentPath === route || currentPath.startsWith(`${route}/`);
}

function riskForOperationalStatus(status: OperationalStatus): OperationalRisk {
  if (/critical|closed|blocked|out-of-service/i.test(status)) return 'critical';
  if (/warning|watch|in-progress|approval-required|due|expired/i.test(status)) return 'high';
  if (/standby|simulated|placeholder|incomplete/i.test(status)) return 'medium';
  return 'low';
}

function equineEligibilityRisk(eligible: boolean, complianceStatus: string): OperationalRisk {
  if (!eligible) return 'high';
  if (/review|hold|pending|flag/i.test(complianceStatus)) return 'medium';
  return 'low';
}

function equineWelfareRisk(level: string): OperationalRisk {
  if (/critical|intervention|poor/i.test(level)) return 'critical';
  if (/watch|concern|elevated/i.test(level)) return 'high';
  if (/review|monitor/i.test(level)) return 'medium';
  return 'low';
}

function equineApprovalStatus(status: string): ApprovalDto['status'] {
  if (status === 'approved' || status === 'rejected' || status === 'expired' || status === 'escalated') return status;
  return status === 'pending' ? 'pending' : 'pending-approval';
}

function propertyText(properties: Record<string, unknown> | undefined, key: string, fallback = 'placeholder/incomplete') {
  const value = properties?.[key];
  if (Array.isArray(value)) return value.join(', ');
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function normalizeEquineIntelligence(input: EquineIntelligenceDto): EquineIntelligenceDto {
  const tenantId = input.horse.tenantId ?? 'tenant-1';
  const transportationRecords = input.transportationRecords ?? [{ tripId: 'trip-1', from: 'receiving barn', to: input.barnAssignment.barnId, departedAt: '2026-06-12T10:00:00.000Z', arrivedAt: input.barnAssignment.assignedAt, transporter: 'licensed-equine-van', welfareChecks: ['water offered', 'temperature checked'] }];
  const welfareRecords = input.welfareRecords ?? [{ recordId: 'welfare-current', observedAt: input.barnAssignment.assignedAt, observerId: 'welfare-officer', score: input.welfareStatus.latestScore ?? 0, notes: input.welfareStatus.level, interventions: input.welfareStatus.interventions }];
  const eligibilityRules = input.eligibilityRules ?? [
    { id: 'active-lifecycle', description: 'Horse must be active', passed: input.horse.lifecycleStatus === 'active', failureStatus: 'ineligible' },
    { id: 'no-active-compliance-flags', description: 'No open eligibility flags', passed: input.eligibilityStatus.flags.length === 0, failureStatus: 'under-review' },
    { id: 'no-unreviewed-health-ai', description: 'Health AI remains advisory until veterinarian review', passed: !input.aiRiskRecommendations.some((rec) => rec.veterinarianReviewRequired && rec.status !== 'veterinarian-reviewed'), failureStatus: 'under-review' },
  ];
  const relationships = input.relationships ?? [
    ...input.ownership.map((owner) => ({ id: `${input.horse.horseId}:owner:${owner.ownerId}`, type: 'owned-by', fromId: input.horse.horseId, toId: owner.ownerId, effectiveFrom: owner.effectiveFrom, effectiveTo: owner.effectiveTo, evidence: ['ownership-registry'] })),
    ...input.trainerAssignments.map((trainer) => ({ id: `${input.horse.horseId}:trainer:${trainer.trainerId}`, type: 'trained-by', fromId: input.horse.horseId, toId: trainer.trainerId, effectiveFrom: trainer.effectiveFrom, effectiveTo: trainer.effectiveTo, evidence: ['license-registry'] })),
    ...input.raceHistory.map((race) => ({ id: `${input.horse.horseId}:race:${race.raceId}`, type: 'entered-in-race', fromId: input.horse.horseId, toId: race.raceId, effectiveFrom: race.date, evidence: ['race-office'] })),
    ...input.workoutHistory.map((workout) => ({ id: `${input.horse.horseId}:workout:${workout.workoutId}`, type: 'worked-at-track', fromId: input.horse.horseId, toId: workout.trackId ?? input.raceHistory[0]?.trackId ?? 'track-pending', effectiveFrom: workout.date, evidence: [workout.workoutId] })),
    ...transportationRecords.map((trip) => ({ id: `${input.horse.horseId}:transport:${trip.tripId}`, type: 'transported-by', fromId: input.horse.horseId, toId: trip.transporter, effectiveFrom: trip.departedAt, effectiveTo: trip.arrivedAt, evidence: trip.welfareChecks })),
    ...(input.barnAssignment.barnId ? [{ id: `${input.horse.horseId}:barn:${input.barnAssignment.barnId}:${input.barnAssignment.assignedAt}`, type: 'assigned-to-barn', fromId: input.horse.horseId, toId: input.barnAssignment.barnId, effectiveFrom: input.barnAssignment.assignedAt, evidence: [input.barnAssignment.stallId ?? input.barnAssignment.barnId] }] : []),
    ...input.digitalTwinReferences.map((ref) => ({ id: `${input.horse.horseId}:twin:${ref.twinId}`, type: 'mirrored-by-digital-twin', fromId: input.horse.horseId, toId: ref.twinId, effectiveFrom: input.barnAssignment.assignedAt, evidence: [ref.sourceSystem] })),
  ];
  return {
    ...input,
    horse: { ...input.horse, tenantId },
    transportationRecords,
    welfareRecords,
    eligibilityRules,
    relationships,
    observability: input.observability ?? { pendingVeterinarianReviews: input.aiRiskRecommendations.filter((rec) => rec.veterinarianReviewRequired && rec.status === 'pending-veterinarian-review').length, openApprovals: input.approvals.filter((approval) => approval.status === 'pending').length, auditRecords: input.audit.length, eventCount: input.events.length, twinStates: input.digitalTwinReferences.length, advisoryRecommendations: input.aiRiskRecommendations.filter((rec) => rec.advisoryOnly).length },
    integrations: input.integrations ?? { barn: Boolean(input.barnAssignment.barnId), raceOffice: input.raceHistory.length > 0, audit: input.audit.length > 0, eventBus: input.events.length > 0, approvals: input.approvals.length > 0, digitalTwin: input.digitalTwinReferences.length > 0, observability: true },
    privacy: input.privacy ?? { tenantId, veterinaryRecordsVisible: input.veterinaryStatus.status === 'not-recorded' ? 0 : 1, veterinaryRecordsRedacted: 1 },
  };
}

function fallbackWorkforceOperations(mock: boolean): WorkforceOperationsDto {
  const generatedAt = new Date().toISOString();
  return { generatedAt, tenantId:'fallback-tenant', employees:[], certifications:[], assignments:[], shifts:[], trainingRecords:[], readiness:{ generatedAt, tenantId:'fallback-tenant', status:'watch', score:0, coveragePct:0, complianceStatus:'watch', demand:0, assigned:0, checkedIn:0, staffingGap:0, certificationGaps:[], trainingGaps:[], emergencyGaps:['workforce feed unavailable'], blockers:['workforce feed unavailable'], raceDayCheck:{ domain:'staffing', label:'staffing readiness feed missing', score:0, status:'watch', evidence:['missing:workforce'], blockers:['workforce feed unavailable'], updatedAt:generatedAt, approvalRequired:true, ownerRole:'operations' } }, planning:{ generatedAt, tenantId:'fallback-tenant', demand:0, available:0, assigned:0, checkedIn:0, gap:0, byRole:[], recommendations:['Restore workforce operations feed before operational use.'] }, compliance:{ generatedAt, tenantId:'fallback-tenant', status:'watch', certificationCoveragePct:0, trainingCoveragePct:0, expiringCertifications:[], expiredCertifications:[], overdueTraining:[], auditEvidence:['missing:workforce'] }, emergencyResources:[], approvals:[], auditRecords:[], events:[], digitalTwinSync:[], identityGovernance:{ tenantId:'fallback-tenant', reviewedIdentities:0, privilegedPolicies:[], evidence:['missing:workforce'] }, mock };
}

function fallbackRacingDataApiHub(mock: boolean, generatedAt = new Date().toISOString()): RacingDataApiHubWorkspaceDto {
  const tenant = { tenantId: 'track-1', racetrackId: 'mock-main-track', jurisdiction: 'NY', dataBoundary: 'tenant' as const };
  const lineage = { sourceSystem: 'approved-mock-racing-data-hub', sourceRefs: ['provider-contract:official-racing'], correlationId: 'corr-racing-data-api-hub', causationIds: [] };
  const activeLicense: RacingDataLicenseDto = { licenseStatus: 'active', commercialUseAllowed: false, redistributionAllowed: false, attributionRequired: true, requiresAttribution: true, piiPresent: false, dataClasses: ['entries','results','workouts'], usageScope: ['internal-operations','analytics','compliance-reporting'], retention: { policyId: 'provider-retention-365', retentionDays: 365, legalBasis: 'licensed provider operations and compliance evidence' }, termsRef: 'contract://official-racing/2026', attributionText: 'Official Racing Data Provider - used under TrackMind internal operations license.', evidenceRefs: ['provider-contract:official-racing','license-evidence:active'] };
  const evaluationLicense: RacingDataLicenseDto = { licenseStatus: 'evaluation', commercialUseAllowed: false, redistributionAllowed: false, attributionRequired: true, requiresAttribution: true, piiPresent: false, dataClasses: ['form','analytics'], usageScope: ['analytics','research'], retention: { policyId: 'evaluation-retention-30', retentionDays: 30, legalBasis: 'evaluation-only provider review' }, termsRef: 'contract://speed-figures/evaluation', attributionText: 'Speed Figures Evaluation Feed - evaluation only, no training or redistribution.', evidenceRefs: ['provider-contract:speed-figures-evaluation'] };
  const policyCenter = [
    { policyId: 'policy-official-racing-internal', providerId: 'official-racing-provider', licenseStatus: activeLicense.licenseStatus, dataClasses: [...activeLicense.dataClasses], allowedUses: [...activeLicense.usageScope], restrictedUses: ['public redistribution','raw provider replay','external customer API resale','unapproved commercial products'], attribution: { required: true, text: activeLicense.attributionText }, retentionDays: activeLicense.retention.retentionDays, exportAllowed: true, redistributionAllowed: false, commercialUseAllowed: false, privacyClassification: 'confidential' as const, modelTraining: { allowed: true, restrictions: ['training allowed only for internal advisory models with lineage, attribution, retention, and approval evidence'], unlicensedBlocked: false }, blockedExportReasons: ['Public redistribution blocked: redistributionAllowed=false for provider license.'], evidenceRefs: activeLicense.evidenceRefs, mock },
    { policyId: 'policy-speed-figures-evaluation', providerId: 'speed-figures-evaluation', licenseStatus: evaluationLicense.licenseStatus, dataClasses: [...evaluationLicense.dataClasses], allowedUses: [...evaluationLicense.usageScope], restrictedUses: ['ai-training','commercial-product','public redistribution','data lake bulk export'], attribution: { required: true, text: evaluationLicense.attributionText }, retentionDays: evaluationLicense.retention.retentionDays, exportAllowed: false, redistributionAllowed: false, commercialUseAllowed: false, privacyClassification: 'restricted' as const, modelTraining: { allowed: false, restrictions: ['Unlicensed model training blocked until active license includes ai-training usage scope.'], unlicensedBlocked: true }, blockedExportReasons: ['Blocked unlicensed model training: evaluation license omits ai-training scope.','Data lake export blocked: exportAllowed=false.'], evidenceRefs: evaluationLicense.evidenceRefs, mock },
  ];
  const featureStoreExports: RacingDataExportManifestDto[] = [
    { manifestId: 'manifest-feature-store-official-race-7', surface: 'feature-store', title: 'Race 7 internal advisory feature export', providerId: 'official-racing-provider', dataClasses: ['entries','results','workouts'] satisfies RacingDataClassDto[], destination: 'feature-store://track-1/race-7/internal-advisory', format: 'parquet', requestedAt: generatedAt, generatedAt, retentionDays: 365, privacyClassification: 'confidential', licenseStatus: 'active', exportAllowed: true, backendAllowed: false, redistributionAllowed: false, commercialUseAllowed: false, modelTrainingAllowed: true, attributionRequired: true, draftOnly: true, blockedReasons: ['Draft-only until backend export approval returns backendAllowed=true.'], objectRefs: ['feature://race-7/entries','feature://race-7/workouts'], rowCount: 128, schemaRef: 'schema://racing-data/features/v1', checksum: 'sha256:feature-store-official-race-7', auditRefs: ['audit:racing-data-feature-export-draft'], evidenceRefs: ['provider-contract:official-racing','lineage:race-7'] },
    { manifestId: 'manifest-feature-store-speed-figures-eval', surface: 'feature-store', title: 'Speed figures evaluation training candidate', providerId: 'speed-figures-evaluation', dataClasses: ['form','analytics'] satisfies RacingDataClassDto[], destination: 'feature-store://track-1/evaluation/speed-figures', format: 'parquet', requestedAt: generatedAt, retentionDays: 30, privacyClassification: 'restricted', licenseStatus: 'evaluation', exportAllowed: false, backendAllowed: false, redistributionAllowed: false, commercialUseAllowed: false, modelTrainingAllowed: false, attributionRequired: true, draftOnly: true, blockedReasons: ['Blocked unlicensed model training: evaluation license omits ai-training scope.'], objectRefs: ['feature://speed-figures/evaluation'], rowCount: 42, schemaRef: 'schema://racing-data/features/v1', checksum: 'sha256:feature-store-speed-figures-eval', auditRefs: ['audit:racing-data-feature-export-blocked'], evidenceRefs: ['provider-contract:speed-figures-evaluation'] },
  ];
  const dataLakeExports: RacingDataExportManifestDto[] = [
    { manifestId: 'manifest-data-lake-official-results-public', surface: 'data-lake', title: 'Official results public redistribution package', providerId: 'official-racing-provider', dataClasses: ['results'] satisfies RacingDataClassDto[], destination: 'lakehouse://track-1/public-results-package', format: 'delta', requestedAt: generatedAt, retentionDays: 365, privacyClassification: 'confidential', licenseStatus: 'active', exportAllowed: false, backendAllowed: false, redistributionAllowed: false, commercialUseAllowed: false, modelTrainingAllowed: false, attributionRequired: true, draftOnly: true, blockedReasons: ['Public redistribution blocked: redistributionAllowed=false for provider license.','Commercial use blocked: commercialUseAllowed=false.'], objectRefs: ['lake://race-7/results'], rowCount: 14, schemaRef: 'schema://racing-data/data-lake/results/v1', checksum: 'sha256:data-lake-official-results-public', auditRefs: ['audit:racing-data-data-lake-export-blocked'], evidenceRefs: ['provider-contract:official-racing'] },
  ];
  return {
    generatedAt,
    metadata: createRacingDataApiHubServiceMetadata(generatedAt),
    providers: [{ schemaVersion: 'trackmind.racing-data-api-hub.v1', providerId: 'official-racing-provider', displayName: 'Official Racing Provider', enabled: true, tenant, jurisdiction: 'NY', connectionType: 'rest', syncMode: 'batch', endpointRefs: ['provider://official-racing/rest'], dataClasses: [...activeLicense.dataClasses], usageScope: [...activeLicense.usageScope], license: activeLicense, lineage, evidenceRefs: activeLicense.evidenceRefs, auditRefs: ['audit:racing-data-provider'], eventRefs: ['event:racing-data-provider'] }],
    statuses: [{ schemaVersion: 'trackmind.racing-data-api-hub.v1', providerId: 'official-racing-provider', tenant, status: 'healthy', connectionType: 'rest', syncMode: 'batch', lastCheckedAt: generatedAt, health: { latencyMs: 120, errorRate: 0, messages: ['Provider license active; redistribution remains blocked.'] }, licenseStatus: 'active', commercialUseAllowed: false, redistributionAllowed: false, attributionRequired: true, requiresAttribution: true, piiPresent: false, dataClasses: [...activeLicense.dataClasses], usageScope: [...activeLicense.usageScope], evidenceRefs: activeLicense.evidenceRefs, auditRefs: ['audit:racing-data-status'], eventRefs: ['event:racing-data-status'], displayName: 'Official Racing Provider' }],
    connectors: [],
    normalizationMappings: [],
    ingestionJobs: [],
    rawPayloadReviews: [],
    canonical: { raceCards: [], races: [], horses: [], entries: [], results: [], envelopes: [] },
    entityResolution: { generatedAt, clusters: [{ resolutionId: 'resolution-horse-lifecycle-runner', entityType: 'horse', canonicalId: 'horse:canonical:lifecycle-runner', candidateExternalIds: ['official-racing-provider:horse-1','speed-figures-evaluation:LR-001','workout-feed:985141001'], sourceRefs: ['raw:payload-race-7-entries','canonical-envelope:race-7-entries'], confidence: 0.91, matchConfidence: 0.91, decision: 'merge-draft', reviewRequired: true, status: 'human-review-required', evidence: ['microchip:985141001','name:LIFECYCLE RUNNER','trainer:Trainer A','workout-date:2026-06-01'], evidenceRefs: ['evidence:entity-resolution:horse-1','audit:racing-data-resolution-draft'], draftRequestId: 'draft-resolution-horse-1', approvalRequestId: 'approval-resolution-horse-1' }], approvalRequiredForMerges: true, directMutationAllowed: false, mock },
    entityResolutionQueue: [{ resolutionId: 'resolution-horse-lifecycle-runner', entityType: 'horse', canonicalId: 'horse:canonical:lifecycle-runner', candidateExternalIds: ['official-racing-provider:horse-1','speed-figures-evaluation:LR-001','workout-feed:985141001'], sourceRefs: ['raw:payload-race-7-entries','canonical-envelope:race-7-entries'], confidence: 0.91, matchConfidence: 0.91, decision: 'merge-draft', reviewRequired: true, status: 'human-review-required', evidence: ['microchip:985141001','name:LIFECYCLE RUNNER','trainer:Trainer A','workout-date:2026-06-01'], evidenceRefs: ['evidence:entity-resolution:horse-1','audit:racing-data-resolution-draft'], draftRequestId: 'draft-resolution-horse-1', approvalRequestId: 'approval-resolution-horse-1' }],
    qualityReports: [{ reportId: 'quality-race-7-entries', generatedAt, providerId: 'official-racing-provider', targetRef: 'canonical-envelope:race-7-entries', dataClass: 'entries', score: 68, severity: 'warning', checks: [{ ruleId: 'required-program-number', label: 'Program number completeness', status: 'passed', score: 100, severity: 'info', passed: true, message: 'All active entries have program numbers.', evidenceRefs: ['raw:payload-race-7-entries'], licenseImpact: 'No additional license restriction.', dataQualityImpact: 'Entry identity can proceed to review.' }, { ruleId: 'license-redistribution-block', label: 'Redistribution license guard', status: 'warning', score: 55, severity: 'warning', passed: false, message: 'Provider license blocks public redistribution and commercial products.', evidenceRefs: ['provider-contract:official-racing'], licenseImpact: 'License impact: redistributionAllowed=false and commercialUseAllowed=false block public exports.', dataQualityImpact: 'Data quality impact: downstream exports must remain draft-only until license approval.' }, { ruleId: 'candidate-identity-confidence', label: 'Entity confidence threshold', status: 'warning', score: 68, severity: 'warning', passed: false, message: 'Horse candidate match confidence requires human review.', evidenceRefs: ['evidence:entity-resolution:horse-1'], licenseImpact: 'No new license grant for identity merge.', dataQualityImpact: 'Quality impact: canonical horse merge remains pending review.' }], licenseImpactSummary: 'License impact: public redistribution, commercial product use, and raw payload replay remain blocked.', dataQualityImpactSummary: 'Data quality impact: low quality warning requires entity-resolution review before feature/export promotion.', reviewRequired: true, lineage, mock }],
    lineage: { generatedAt, nodes: [{ id: 'raw:payload-race-7-entries', kind: 'raw-payload', label: 'Raw payload' }, { id: 'artifact:normalized-race-7-entries', kind: 'normalized-artifact', label: 'Normalized artifact' }, { id: 'registry:canonical-race-7-entries', kind: 'registry', label: 'Registry' }, { id: 'twin:race:race-7', kind: 'twin-ref', label: 'Twin ref' }, { id: 'event:racing-data-normalized', kind: 'event-ref', label: 'Event ref' }, { id: 'audit:racing-data-normalized', kind: 'audit-ref', label: 'Audit ref' }, { id: 'feature://race-7/entries', kind: 'feature-export', label: 'Feature export ref' }, { id: 'lake://race-7/results', kind: 'data-lake-export', label: 'Export ref' }], edges: [{ from: 'raw:payload-race-7-entries', to: 'artifact:normalized-race-7-entries', relationship: 'normalized' }, { from: 'artifact:normalized-race-7-entries', to: 'registry:canonical-race-7-entries', relationship: 'registered' }, { from: 'registry:canonical-race-7-entries', to: 'twin:race:race-7', relationship: 'referenced-by' }, { from: 'registry:canonical-race-7-entries', to: 'feature://race-7/entries', relationship: 'exported' }], paths: [{ lineageId: 'lineage-race-7-entries', rawPayloadRef: 'raw:payload-race-7-entries', normalizedArtifactRef: 'artifact:normalized-race-7-entries', registryRef: 'registry:canonical-race-7-entries', twinRefs: ['twin:race:race-7','twin:horse:horse-1'], eventRefs: ['event:racing-data-ingested','event:racing-data-normalized'], auditRefs: ['audit:racing-data-ingested','audit:racing-data-normalized'], featureRefs: ['feature://race-7/entries'], exportRefs: ['lake://race-7/results'], evidenceRefs: ['provider-contract:official-racing','evidence:entity-resolution:horse-1'] }], auditRefs: ['audit:racing-data-status','audit:racing-data-normalized'], eventRefs: ['event:racing-data-status','event:racing-data-normalized'], evidenceRefs: ['provider-contract:official-racing','evidence:entity-resolution:horse-1'], mock },
    licensePolicies: policyCenter.map((policy) => ({ policyId: policy.policyId, providerId: policy.providerId, status: policy.licenseStatus, dataClasses: policy.dataClasses, usageScope: policy.allowedUses, commercialUseAllowed: policy.commercialUseAllowed, redistributionAllowed: policy.redistributionAllowed, attributionRequired: policy.attribution.required, retention: { policyId: `${policy.policyId}-retention`, retentionDays: policy.retentionDays, legalBasis: 'provider license policy' }, evidenceRefs: policy.evidenceRefs, mock })),
    digitalTwinSync: { descriptorId: 'racing-data-digital-twin-sync-descriptor', generatedAt, targetTwinRefs: ['twin:main-track'], sourceEnvelopeIds: [], syncMode: 'descriptor-only', draftApprovalApi: '/api/v1/racing-data/digital-twin/sync-draft-requests', directMutationAllowed: false, safetyCriticalStateMutationAllowed: false, lineage, mock },
    policyCenter,
    featureStoreExports,
    dataLakeExports,
    exportControls: [...featureStoreExports, ...dataLakeExports].map((manifest) => ({ id: `control-${manifest.manifestId}`, label: manifest.backendAllowed ? `Export ${manifest.title}` : `Draft ${manifest.title}`, surface: manifest.surface, manifestId: manifest.manifestId, backendAllowed: manifest.backendAllowed, draftOnly: manifest.draftOnly, disabledReason: manifest.blockedReasons.join(' '), approvalApi: manifest.surface === 'feature-store' ? 'POST /api/v1/racing-data/feature-store/exports/draft-requests' : 'POST /api/v1/racing-data/data-lake/exports/draft-requests' })),
    reviewActions: [{ id: 'review-resolution-horse-1', label: 'Draft entity resolution review', target: 'horse:canonical:lifecycle-runner', decision: 'draft', draftOnly: true, approvalRequired: true, approvalApi: 'POST /api/v1/approvals/draft-requests', disabledReason: 'Creates a resolution draft only; canonical horse registry is not mutated locally.' }, { id: 'review-quality-race-7', label: 'Request quality exception approval', target: 'canonical-envelope:race-7-entries', decision: 'approval', draftOnly: true, approvalRequired: true, approvalApi: 'POST /api/v1/approvals/controlled-actions', disabledReason: 'Quality exception approval is backend-owned and cannot mark official records valid in the frontend.' }, { id: 'review-export-feature-store', label: 'Draft feature export approval', target: 'feature://race-7/entries', decision: 'draft', draftOnly: true, approvalRequired: true, approvalApi: 'POST /api/v1/approvals/draft-requests', disabledReason: 'Feature-store export remains draft-only until license and quality approvals are recorded.' }] as RacingDataApiHubWorkspaceDto['reviewActions'],
    mock,
  };
}

function fallbackCollaborationWorkspace(mock: boolean, generatedAt = new Date().toISOString()): CollaborationWorkspaceDto {
  return {
    generatedAt,
    tenantId: 'track-1',
    racetrackId: 'mock-main-track',
    threads: [],
    activity: [],
    mentions: [],
    assignments: [],
    decisionRecords: [],
    evidencePackets: [],
    approvalDiscussions: [],
    incidentRooms: [],
    activeParticipants: [],
    safety: {
      collaborationOnly: true as const,
      draftOnlyPosts: true as const,
      mutatesOperationalState: false as const,
      disabledControlReason: 'Collaboration is unavailable from the live backend; route-scoped artifact panels remain read-only.',
    },
    mock,
  };
}

function fallbackTUSStandardization(generatedAt = new Date().toISOString()): TUSStandardizationWorkspaceDto {
  return { generatedAt, tenantId: 'approved-mock-fallback', racetrackId: 'mock-main-track', assets: [], twins: [], coverage: { assetTypes: [], twinTypes: [], approvals: 0, auditEvents: 0, telemetryBindings: 0 }, mock: true };
}

function fallbackFacilitiesMaintenance(generatedAt = new Date().toISOString()): FacilitiesMaintenanceDto {
  return {
    generatedAt,
    readiness: { score: 0, status: 'watch', ready: 0, watch: 1, blocked: 0, evidence: ['approved-mock-fallback:facilities-maintenance-workspace-unavailable'] },
    assets: [],
    inspections: [],
    preventiveMaintenance: [],
    workOrders: [],
    predictiveHooks: [],
    approvals: [],
    audit: [],
    events: [],
    twins: [],
    observability: { serviceId: 'approved-mock-facilities-fallback', metrics: [{ name: 'optional_api_available', value: 0, unit: 'boolean' }], commandCenterWidgetIds: ['facility-status'] },
    operationalActionsRequireApproval: true,
    integrations: { assetRegistry: false, digitalTwinRuntime: false, approvals: false, workflows: false, audit: false, eventBus: false, observability: false },
    mock: true,
  };
}

async function optionalClientData<T>(load: () => Promise<T> | undefined, fallback: () => T): Promise<T> {
  const request = load();
  if (!request) return fallback();
  try {
    return await request;
  } catch (error) {
    if (error instanceof NexusApiError && (error.status === 0 || error.status === 404 || error.status === 501)) return fallback();
    throw error;
  }
}

function hydrateRacingDataApiHubWorkspace(workspace: RacingDataApiHubWorkspaceDto, fallback: RacingDataApiHubWorkspaceDto): RacingDataApiHubWorkspaceDto {
  const entityResolutionQueue = workspace.entityResolutionQueue?.length ? workspace.entityResolutionQueue : workspace.entityResolution.clusters;
  const fallbackEntityResolutionQueue = fallback.entityResolutionQueue?.length ? fallback.entityResolutionQueue : fallback.entityResolution.clusters;

  return {
    ...workspace,
    metadata: workspace.metadata ?? fallback.metadata,
    providers: workspace.providers.length ? workspace.providers : fallback.providers,
    statuses: workspace.statuses.length ? workspace.statuses : fallback.statuses,
    connectors: workspace.connectors.length ? workspace.connectors : fallback.connectors,
    normalizationMappings: workspace.normalizationMappings.length ? workspace.normalizationMappings : fallback.normalizationMappings,
    ingestionJobs: workspace.ingestionJobs.length ? workspace.ingestionJobs : fallback.ingestionJobs,
    rawPayloadReviews: workspace.rawPayloadReviews.length ? workspace.rawPayloadReviews : fallback.rawPayloadReviews,
    canonical: {
      raceCards: workspace.canonical.raceCards.length ? workspace.canonical.raceCards : fallback.canonical.raceCards,
      races: workspace.canonical.races.length ? workspace.canonical.races : fallback.canonical.races,
      horses: workspace.canonical.horses.length ? workspace.canonical.horses : fallback.canonical.horses,
      entries: workspace.canonical.entries.length ? workspace.canonical.entries : fallback.canonical.entries,
      results: workspace.canonical.results.length ? workspace.canonical.results : fallback.canonical.results,
      envelopes: workspace.canonical.envelopes.length ? workspace.canonical.envelopes : fallback.canonical.envelopes,
    },
    entityResolution: workspace.entityResolution.clusters.length ? workspace.entityResolution : fallback.entityResolution,
    entityResolutionQueue: entityResolutionQueue.length ? entityResolutionQueue : fallbackEntityResolutionQueue,
    qualityReports: workspace.qualityReports.length ? workspace.qualityReports : fallback.qualityReports,
    lineage: workspace.lineage.paths?.length || workspace.lineage.nodes.length ? workspace.lineage : fallback.lineage,
    licensePolicies: workspace.licensePolicies.length ? workspace.licensePolicies : fallback.licensePolicies,
    digitalTwinSync: workspace.digitalTwinSync.descriptorId ? workspace.digitalTwinSync : fallback.digitalTwinSync,
    policyCenter: workspace.policyCenter?.length ? workspace.policyCenter : fallback.policyCenter,
    featureStoreExports: workspace.featureStoreExports?.length ? workspace.featureStoreExports : fallback.featureStoreExports,
    dataLakeExports: workspace.dataLakeExports?.length ? workspace.dataLakeExports : fallback.dataLakeExports,
    exportControls: workspace.exportControls?.length ? workspace.exportControls : fallback.exportControls,
    reviewActions: workspace.reviewActions?.length ? workspace.reviewActions : fallback.reviewActions,
  };
}

export async function loadCommandCenter(client: NexusApiClient) {
  const [approvals, auditEvents, trackMap, operations, readiness, gatePosition, raceDistanceConfiguration, digitalTwinState, tusStandardization, raceOffice, surfaceIntelligence, equineIntelligence, barnOperations, facilitiesMaintenance, stewardCenter, securityOperations, emergencyOperations, workforceOperations, complianceLibrary, aiGovernance, racingDataApiHub, collaborationWorkspace, platformHealth, nexusUpgrade] = await Promise.all([
    client.listApprovals(),
    client.listAuditEvents(),
    client.getTrackMap(),
    client.getOperationsCommandCenter(),
    client.getRaceDayReadinessDashboard(),
    client.getGatePosition(),
    client.getRaceDistanceConfiguration(),
    client.listDigitalTwinState(),
    optionalClientData(() => client.getTUSStandardization?.(), () => fallbackTUSStandardization()),
    client.getRaceOffice(),
    client.getSurfaceIntelligence(),
    client.getEquineIntelligence(),
    client.getBarnOperations(),
    optionalClientData(() => client.getFacilitiesMaintenance?.(), () => fallbackFacilitiesMaintenance()),
    client.getStewardCenter(),
    client.getSecurityOperations(),
    client.getEmergencyOperations(),
    optionalClientData(() => client.getWorkforceOperations?.(), () => fallbackWorkforceOperations(true)),
    client.getComplianceLibrary(),
    client.getAIGovernanceWorkspace(),
    optionalClientData(() => client.getRacingDataApiHub?.(), () => fallbackRacingDataApiHub(true)),
    optionalClientData(() => client.getCollaborationWorkspace?.(), () => fallbackCollaborationWorkspace(true)),
    client.getPlatformHealth(),
    client.getNexusUpgradePackage?.() ?? Promise.resolve(createTrackMindNexusUpgradePackage()),
  ]);
  const workforceWorkspace = workforceOperations ?? fallbackWorkforceOperations(true);
  const emergencyWithWorkforce = { ...emergencyOperations, workforceReadiness: emergencyOperations.workforceReadiness ?? workforceWorkspace.readiness, resources: [...emergencyOperations.resources, ...workforceWorkspace.emergencyResources] };
  const apiHubReviewFallback = fallbackRacingDataApiHub(true, platformHealth.generatedAt);
  const racingDataApiHubWorkspace = hydrateRacingDataApiHubWorkspace(racingDataApiHub, apiHubReviewFallback);
  const raceOfficeGoverned = {
    ...raceOffice,
    approvalControls: raceOffice.approvalControls.map((control) => ({
      ...control,
      approvalApi: control.action === 'race-distance-configuration'
        ? 'POST /api/v1/track-configuration/draft-requests'
        : 'POST /api/v1/approvals/controlled-actions',
    })),
  };
  return { approvals, auditEvents, trackMap, operations, readiness, gatePosition, raceDistanceConfiguration, digitalTwinState, tusStandardization, raceOffice: raceOfficeGoverned, surfaceIntelligence, equineIntelligence: normalizeEquineIntelligence(equineIntelligence), barnOperations, facilitiesMaintenance, stewardCenter, securityOperations, emergencyOperations: emergencyWithWorkforce, workforceOperations: workforceWorkspace, complianceLibrary, aiGovernance, racingDataApiHub: racingDataApiHubWorkspace, collaborationWorkspace, platformHealth, nexusUpgrade, stream: client.eventStream(), streamUrl: client.eventStreamUrl(), mode: client.mode };
}

export function isSafetyCriticalEnabled(args: { authenticated: boolean; hasApprovalToken: boolean; backendMode: 'live' | 'mock' }) {
  return args.authenticated && args.hasApprovalToken && args.backendMode === 'live';
}

export async function requestRaceStartApproval(client: NexusApiClient, actor: string, raceId: string) {
  return client.requestControlledAction({
    action: 'race-start',
    target: raceId,
    reason: 'Frontend requested protected race start approval; execution remains disabled until backend approval token is issued.',
    actor,
  });
}

export async function requestRaceOfficeApproval(client: NexusApiClient, input: { action: RaceOfficeApprovalActionDto; target: string; reason: string; actor: string }) {
  if (input.action === 'race-distance-configuration') {
    return requestTrackConfigurationDraft(client, {
      action: 'race-distance-configuration',
      target: input.target,
      reason: input.reason,
      actor: input.actor,
      evidence: ['race-office-control', `target:${input.target}`],
      payload: { approvalRequired: true, liveExecutionAllowed: false, source: 'race-office' },
    });
  }
  return client.requestControlledAction(input);
}

export async function requestStartingGateMoveDraft(client: NexusApiClient, actor: string, args: { raceId: string; gateId: string; currentSectorId: string; targetSectorId: string; currentMetersFromStart: number; targetMetersFromStart: number; distanceMeters: number; gpsVerified: boolean }) {
  return client.createDraftRequest({
    action: 'starting-gate-move',
    target: args.gateId,
    reason: `Draft starting-gate move request for ${args.raceId}; live gate execution remains locked until an approval token is issued.`,
    actor,
    evidence: [
      `race:${args.raceId}`,
      `current-sector:${args.currentSectorId}`,
      `target-sector:${args.targetSectorId}`,
      `distance:${args.distanceMeters}`,
      `gps-verified:${args.gpsVerified}`,
    ],
    payload: {
      raceId: args.raceId,
      gateId: args.gateId,
      currentMetersFromStart: args.currentMetersFromStart,
      targetMetersFromStart: args.targetMetersFromStart,
      targetSectorId: args.targetSectorId,
      approvalRequired: true,
      liveExecutionAllowed: false,
    },
  });
}

export async function requestTrackConfigurationDraft(client: NexusApiClient, input: DraftActionDto) {
  if (client.createTrackConfigurationDraft) return client.createTrackConfigurationDraft(input);
  return client.createDraftRequest(input);
}

type CollaborationSafeDraftBase = { context: CollaborationContextDto; actor: CollaborationActorDto };
type CollaborationCommentDraftInput = CollaborationSafeDraftBase & Omit<CollaborationCreateCommentDto, keyof CollaborationSafeDraftBase | 'draftOnly' | 'executionAllowed' | 'collaborationOnly'>;
type CollaborationAssignmentDraftInput = CollaborationSafeDraftBase & Omit<CollaborationCreateAssignmentDto, keyof CollaborationSafeDraftBase | 'draftOnly' | 'executionAllowed' | 'collaborationOnly'>;
type CollaborationDecisionDraftInput = CollaborationSafeDraftBase & Omit<CollaborationCreateDecisionDto, keyof CollaborationSafeDraftBase | 'draftOnly' | 'executionAllowed' | 'collaborationOnly'>;

export function collaborationCommentDraftPayload(input: CollaborationCommentDraftInput): CollaborationCreateCommentDto {
  return { ...input, draftOnly: true, executionAllowed: false, collaborationOnly: true };
}

export function collaborationAssignmentDraftPayload(input: CollaborationAssignmentDraftInput): CollaborationCreateAssignmentDto {
  return { ...input, draftOnly: true, executionAllowed: false, collaborationOnly: true };
}

export function collaborationDecisionDraftPayload(input: CollaborationDecisionDraftInput): CollaborationCreateDecisionDto {
  return { ...input, draftOnly: true, executionAllowed: false, collaborationOnly: true };
}

export async function requestCollaborationCommentDraft(client: NexusApiClient, input: CollaborationCommentDraftInput) {
  if (!client.createCollaborationComment) throw new Error('Collaboration comment draft API is unavailable.');
  return client.createCollaborationComment(collaborationCommentDraftPayload(input));
}

export async function requestCollaborationAssignmentDraft(client: NexusApiClient, input: CollaborationAssignmentDraftInput) {
  if (!client.createCollaborationAssignment) throw new Error('Collaboration assignment draft API is unavailable.');
  return client.createCollaborationAssignment(collaborationAssignmentDraftPayload(input));
}

export async function requestCollaborationDecisionDraft(client: NexusApiClient, input: CollaborationDecisionDraftInput) {
  if (!client.createCollaborationDecision) throw new Error('Collaboration decision draft API is unavailable.');
  return client.createCollaborationDecision(collaborationDecisionDraftPayload(input));
}

export function commandCenterApprovalActions() {
  return [
    { id: 'race-start', label: 'Request race-start approval', detail: 'Creates an approval.requested event; it does not start the race or mutate race state.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'gate-move', label: 'Draft starting-gate move', detail: 'Queues a track-configuration draft request for race control, GPS verification, audit evidence, and human authorization.', approvalApi: 'POST /api/v1/track-configuration/draft-requests', locked: true },
    { id: 'surface-maintenance', label: 'Draft surface maintenance request', detail: 'Routes irrigation, harrow, rolling, and closure recommendations through approval and audit workflows.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
    { id: 'facility-work-order', label: 'Request facility work order approval', detail: 'Creates a facilities-maintenance approval request with work-order, audit, workflow, and Digital Twin evidence only.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
    { id: 'return-to-service', label: 'Request return-to-service approval', detail: 'Return-to-service remains backend-owned until the approval service issues a human authorization token.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'emergency-staffing', label: 'Request emergency staffing override approval', detail: 'Queues emergency staffing overrides through approvals, audit, events, and workforce workflows without local roster mutation.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'twin-command', label: 'Request Digital Twin command approval', detail: 'Digital Twin patches stay read-only until an approved backend execution emits event and audit records.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
  ];
}

type KpiDashboardItem = { label: string; value: string; detail: string };
type TrendCardItem = { label: string; value: string; trend: string; source: string; coverage: string };

const healthRiskLevel = (status: PlatformHealthWorkspaceDto['overallStatus']): 'low' | 'high' | 'critical' => status === 'healthy' ? 'low' : status === 'degraded' ? 'high' : 'critical';
type RosStandardization = NonNullable<PlatformHealthWorkspaceDto['rosStandardization']>;

function scoreRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'low';
  if (score >= 75) return 'medium';
  if (score >= 50) return 'high';
  return 'critical';
}

function fallbackRosStandardization(generatedAt: string, mock: boolean): RosStandardization {
  return {
    generatedAt,
    readOnly: true,
    externalCertification: false,
    readinessLabel: 'readiness/certification candidate',
    osTree: [
      { id: 'operations-os', name: 'Operations OS', scope: 'Operations, race office, gate, surface, facilities, and workforce command surfaces.', route: '/operations' },
      { id: 'safety-os', name: 'Safety OS', scope: 'Stewarding, security, emergency, equine welfare, and protected action guardrails.', route: '/safety' },
      { id: 'compliance-os', name: 'Compliance OS', scope: 'Controls, obligations, evidence packages, findings, and review cycles.', route: '/compliance' },
      { id: 'ai-os', name: 'AI OS', scope: 'Governed inputs, feature store, model registry, expert models, AI governor, and approvals.', route: '/ai-governance' },
      { id: 'digital-twin-os', name: 'Digital Twin OS', scope: 'Read-only twin state, relationships, dependencies, and approved sync plans.', route: '/digital-twin' },
      { id: 'command-center-os', name: 'Command Center OS', scope: 'Unified routed shell, role-aware navigation, events, KPIs, and action rails.', route: '/operations' },
      { id: 'accreditation-os', name: 'Accreditation OS', scope: 'Candidate readiness scoring and auditor-facing evidence packages.', route: '/compliance' },
      { id: 'multi-track-federation-os', name: 'Multi-Track Federation OS', scope: 'Tenant and racetrack federation read models for multi-track rollups.', route: '/executive' },
      { id: 'racing-intelligence-network', name: 'Racing Intelligence Network', scope: 'Shared intelligence core across operations, safety, AI, compliance, twin, and executive feeds.', route: '/platform-health' },
    ],
    universalSchemaCoverage: [
      { area: 'entities', status: 'covered', score: 92, source: 'Identity, asset, horse, staff, race, track, and tenant DTOs' },
      { area: 'events', status: 'covered', score: 90, source: 'Operations, readiness, AI, emergency, security, workforce, and audit event streams' },
      { area: 'workflows', status: 'covered', score: 86, source: 'Approval-required race, surface, compliance, emergency, workforce, and steward workflows' },
      { area: 'approvals', status: 'covered', score: 93, source: 'ApprovalDto and controlled-action/draft-request contracts' },
      { area: 'twins', status: 'covered', score: 88, source: 'DigitalTwinStateDto, geospatial twins, workforce sync, surface sync, and AI impact refs' },
      { area: 'AI', status: 'covered', score: 89, source: 'AI governance workspace, AI control plane, evidence packages, blocked actions, and confidence telemetry' },
      { area: 'audit', status: 'covered', score: 91, source: 'Hash-chained audit events, evidence packages, review cycles, and platform audit health' },
      { area: 'compliance', status: 'covered', score: 84, source: 'Framework library, controls, obligations, findings, readiness events, and candidate programs' },
    ],
    saasTiers: [
      { tier: 'Starter Track', audience: 'Single-track operators', capabilities: ['Operations OS', 'Safety OS', 'Command Center OS', 'Platform Health'] },
      { tier: 'Professional Track', audience: 'Regulated tracks with governed evidence needs', capabilities: ['Compliance OS', 'AI OS', 'Digital Twin OS', 'Certified Track candidate views'] },
      { tier: 'Enterprise Federation', audience: 'Multi-track ownership groups and regulators', capabilities: ['Multi-Track Federation OS', 'Racing Intelligence Network', 'Executive rollups'] },
    ],
    deploymentModes: [
      { mode: 'Mock demonstration', boundary: 'Approved mock adapter', notes: 'Read-only candidate data with state-changing controls locked.' },
      { mode: 'Single-track SaaS', boundary: 'Hosted tenant with live backend APIs', notes: 'Per-track tenant isolation, approval services, audit ledger, and event stream contracts.' },
      { mode: 'Private cloud / regulated region', boundary: 'Customer-controlled network and observability boundary', notes: 'Designed for WAF, managed TLS, centralized logs, and customer compliance retention.' },
      { mode: 'Federated multi-track', boundary: 'Tenant federation with executive read models', notes: 'Rolls up readiness and compliance without mixing unsafe execution authority across tracks.' },
    ],
    certifiedTrackCriteria: [
      { criterion: 'Operations readiness evidence', score: 87, status: 'candidate', evidence: ['race-day-readiness', 'approval-queue', 'workflow-health'] },
      { criterion: 'Safety and emergency guardrails', score: 91, status: 'ready', evidence: ['blocked-autonomous-actions', 'emergency-human-authority', 'steward-human-only-rulings'] },
      { criterion: 'Compliance control mapping', score: 83, status: 'candidate', evidence: ['compliance-control-library', 'evidence-packages', 'review-cycles'] },
      { criterion: 'AI governance controls', score: 89, status: 'candidate', evidence: ['model-registry', 'approval-required-workflows', 'confidence-calibration'] },
      { criterion: 'Digital Twin and audit traceability', score: 86, status: 'candidate', evidence: ['digital-twin-sync', 'audit-ledger', 'event-contracts'] },
    ],
    unifiedDataModelStores: [
      { store: 'Operational event store', purpose: 'Append-only operational, readiness, safety, workforce, and AI event history.', examples: ['race.readiness.assessed', 'surface.recommendation.generated'] },
      { store: 'Audit ledger', purpose: 'Hash-chained records for approvals, compliance evidence, steward actions, and protected workflow decisions.', examples: ['audit-ai-1', 'mock-audit-1'] },
      { store: 'Approval workflow store', purpose: 'Human approval requests, histories, roles, policies, and controlled-action outcomes.', examples: ['approval-rec-harrow-7', 'mock-approval-race-start'] },
      { store: 'Digital Twin runtime store', purpose: 'Read-only twin snapshots, queued sync status, asset relationships, and simulation placeholders.', examples: ['twin:main-track', 'twin:workforce:staff-vet-tech'] },
      { store: 'AI feature and evidence store', purpose: 'Governed inputs, feature metadata, model lineage, prompts, confidence drivers, and evidence packages.', examples: ['dataset:surface-readings-v5', 'evidence-rec-harrow-7'] },
      { store: 'Compliance evidence store', purpose: 'Framework controls, obligations, assessments, findings, corrective actions, review cycles, and packages.', examples: ['ctrl-ai-evidence', 'pkg-accreditation-2026-q2'] },
    ],
    intelligenceCoreLayers: [
      { layer: 'Identity, tenant, and role policy', sharedBy: ['Operations OS', 'Compliance OS', 'Multi-Track Federation OS'], guardrail: 'Role-aware routing and tenant labels only; no cross-tenant execution.' },
      { layer: 'Event and audit backbone', sharedBy: ['Safety OS', 'Compliance OS', 'AI OS', 'Digital Twin OS'], guardrail: 'Read-only event and audit views do not mutate backend state.' },
      { layer: 'Approval and workflow engine', sharedBy: ['Operations OS', 'Safety OS', 'AI OS', 'Accreditation OS'], guardrail: 'Protected actions require human approval tokens and audit evidence.' },
      { layer: 'Universal schema and API facade', sharedBy: ['Command Center OS', 'Racing Intelligence Network'], guardrail: 'DTO-backed labels distinguish live, mock, degraded, and unavailable coverage.' },
      { layer: 'AI governance and evidence core', sharedBy: ['AI OS', 'Executive Center', 'Compliance OS'], guardrail: 'AI may recommend, summarize, classify, forecast, simulate, or draft only.' },
    ],
    guardrails: [
      'Read-only standardization view: no operational commands are exposed here.',
      'Certified Track scores are readiness/certification candidate labels, not external certification.',
      'No race, gate, veterinary, steward, payout, emergency, surface, facility, security, or Digital Twin state is mutated by this panel.',
    ],
    mock,
  };
}

function serviceHealthSummary(health: PlatformHealthWorkspaceDto) {
  const counts = health.services.reduce<Record<PlatformHealthWorkspaceDto['overallStatus'], number>>((summary, service) => ({ ...summary, [service.status]: summary[service.status] + 1 }), { healthy: 0, degraded: 0, critical: 0 });
  return `${counts.healthy} healthy / ${counts.degraded} degraded / ${counts.critical} critical`;
}

function platformKpiDashboardItems(health: PlatformHealthWorkspaceDto, operationalReadiness: number): KpiDashboardItem[] {
  return [
    { label: 'Overall status', value: health.overallStatus, detail: `Services ${serviceHealthSummary(health)}` },
    { label: 'Event throughput', value: `${health.eventBus.eventsPerMinute}/min`, detail: `${health.eventBus.publishedEvents} published; dead letters ${health.eventBus.deadLetters}` },
    { label: 'Approval queue', value: String(health.approvalEngine.pending), detail: `${health.approvalEngine.escalated} escalated / ${health.approvalEngine.expired} expired` },
    { label: 'Audit volume', value: String(health.audit.records), detail: `Ledger valid ${String(health.audit.validLedger)}; critical ${health.audit.criticalRecords}` },
    { label: 'Digital Twin sync', value: String(health.digitalTwin.queuedSync), detail: `${health.digitalTwin.degraded} degraded / ${health.digitalTwin.critical} critical` },
    { label: 'AI health', value: health.aiGovernance.status ?? health.overallStatus, detail: `${health.aiGovernance.inputThroughput} inputs; ${health.aiGovernance.recommendationCount} recommendations; ${health.aiGovernance.blockedActionCount} blocked` },
    { label: 'Workflow health', value: String(health.workflows.active), detail: `${health.workflows.completed} completed / ${health.workflows.failed} failed` },
    { label: 'Operational readiness', value: String(operationalReadiness), detail: 'Race-day readiness feed, not a platform uptime metric' },
  ];
}

function platformTrendCards(health: PlatformHealthWorkspaceDto, operationalReadiness: number): TrendCardItem[] {
  const latencyTone = health.apiLatency.p95Ms > health.apiLatency.budgetMs ? 'over budget' : 'within budget';
  return [
    { label: 'Service health', value: health.overallStatus, trend: serviceHealthSummary(health), source: 'PlatformHealthWorkspaceDto.services', coverage: 'Loaded from platform health DTO' },
    { label: 'Event throughput', value: `${health.eventBus.eventsPerMinute}/min`, trend: `${health.eventBus.throughputCapacity} capacity; backpressure ${String(health.eventBus.backpressure)}`, source: 'PlatformHealthWorkspaceDto.eventBus', coverage: 'Loaded from platform health DTO' },
    { label: 'Workflow health', value: String(health.workflows.active), trend: `${health.workflows.failed} failed workflows`, source: 'PlatformHealthWorkspaceDto.workflows', coverage: 'Loaded from platform health DTO' },
    { label: 'Approval queue', value: String(health.approvalEngine.pending), trend: `${health.approvalEngine.approved} approved; ${health.approvalEngine.rejected} rejected`, source: 'PlatformHealthWorkspaceDto.approvalEngine', coverage: 'Loaded from platform health DTO' },
    { label: 'Audit volume', value: String(health.audit.records), trend: `${health.audit.criticalRecords} critical records`, source: 'PlatformHealthWorkspaceDto.audit', coverage: 'Loaded from platform health DTO' },
    { label: 'Digital Twin sync', value: `${health.digitalTwin.queuedSync} queued`, trend: `Last sync ${health.digitalTwin.lastSyncAt ?? 'not reported'}`, source: 'PlatformHealthWorkspaceDto.digitalTwin', coverage: 'Loaded from platform health DTO' },
    { label: 'AI health', value: health.aiGovernance.status ?? health.overallStatus, trend: `${health.aiGovernance.pendingReviews} pending reviews; ${health.aiGovernance.approvalRequiredCount} approval-required; ${health.aiGovernance.driftBreaches} drift breaches`, source: 'PlatformHealthWorkspaceDto.aiGovernance', coverage: 'Loaded from platform health DTO' },
    { label: 'API latency', value: `${health.apiLatency.p95Ms}ms p95`, trend: `${latencyTone}; budget ${health.apiLatency.budgetMs}ms`, source: 'PlatformHealthWorkspaceDto.apiLatency', coverage: 'Loaded from platform health DTO' },
    { label: 'Operational readiness', value: String(operationalReadiness), trend: 'Race-day readiness feed shown for context', source: 'RaceDayReadinessDashboardDto', coverage: 'Separate operational feed, not inferred platform health' },
  ];
}

function KpiDashboard({ title, items, 'aria-label': ariaLabel }: { title: string; items: KpiDashboardItem[]; 'aria-label'?: string }) {
  return <section aria-label={ariaLabel ?? `${title} KPI dashboard`}><h3>{title} KPI dashboard</h3><MetricStrip items={items} /></section>;
}

function TrendCardGrid({ ariaLabel, title, cards, 'aria-label': ariaLabelProp }: { ariaLabel?: string; title: string; cards: TrendCardItem[]; 'aria-label'?: string }) {
  return <section aria-label={ariaLabelProp ?? ariaLabel ?? title}><h3>{title}</h3>{cards.map((card) => <div key={card.label} data-source={card.source}><KpiTile label={card.label} value={card.value} trend={card.trend} /><p>Source: {card.source}. Coverage: {card.coverage}.</p></div>)}</section>;
}

function ServiceHealthCards({ health, ariaLabel, title, 'aria-label': ariaLabelProp }: { health: PlatformHealthWorkspaceDto; ariaLabel?: string; title: string; 'aria-label'?: string }) {
  return <section aria-label={ariaLabelProp ?? ariaLabel ?? title}><h3>{title}</h3>{health.services.map((service) => <StatusCard key={service.serviceId} title={service.serviceId} status={service.status} detail={`Latency ${service.latencyMs}ms; dependencies ${service.dependencies.map((dep) => `${dep.id}:${dep.status}${dep.required ? ':required' : ''}`).join(', ') || 'none'}; checked ${service.lastCheckedAt}`} />)}</section>;
}

const artifactPipelineStages = ['INPUTS', 'EVENTS', 'ARTIFACTS', 'DIGITAL TWINS', 'FEATURE STORE', 'AI MODELS', 'RECOMMENDATIONS', 'APPROVALS', 'OUTPUTS', 'AUDITS'];

const canonicalArtifactTypes = [
  { type: 'Input contract', registryId: 'artifact.input.contract', boundary: 'Typed DTO, schema version, tenant scope, quality signals' },
  { type: 'Domain event', registryId: 'artifact.event.envelope', boundary: 'Append-only event envelope with correlation and evidence refs' },
  { type: 'Evidence package', registryId: 'artifact.evidence.package', boundary: 'Readiness, compliance, AI, and workflow evidence metadata' },
  { type: 'Digital Twin snapshot', registryId: 'artifact.digital-twin.snapshot', boundary: 'Read-only twin state, queued sync metadata, and patch provenance' },
  { type: 'Feature vector', registryId: 'artifact.feature.vector', boundary: 'Governed feature definitions, lineage, quality, and retention tags' },
  { type: 'Model card', registryId: 'artifact.ai.model-card', boundary: 'Model version, intended use, prohibited use, validation, and risk level' },
  { type: 'Recommendation card', registryId: 'artifact.ai.recommendation', boundary: 'Advisory output with confidence, evidence, approval need, and audit refs' },
  { type: 'Approval record', registryId: 'artifact.approval.record', boundary: 'Human workflow state, policy, roles, and authorization token metadata' },
  { type: 'Output package', registryId: 'artifact.output.package', boundary: 'Insight, Recommendation, or Forecast class with source coverage labels' },
  { type: 'Audit ledger entry', registryId: 'artifact.audit.ledger-entry', boundary: 'Immutable hash-chain reference, actor, subject, and correlation ids' },
];

const artifactStorageMap = [
  { storage: 'Artifact registry', artifacts: 'Canonical type records, registry IDs, schemas, retention labels', executionBoundary: 'Metadata catalog only' },
  { storage: 'Operational event store', artifacts: 'Input and event envelopes with source DTO references', executionBoundary: 'Append-only event visibility' },
  { storage: 'Evidence object store', artifacts: 'Evidence packages, exported layouts, validation reports, and attachments', executionBoundary: 'No official filing submission from frontend' },
  { storage: 'Digital Twin runtime store', artifacts: 'Twin snapshots, queued sync records, and impact references', executionBoundary: 'No local twin patch execution' },
  { storage: 'Feature store', artifacts: 'Feature definitions, feature vectors, quality windows, and lineage', executionBoundary: 'No model training job launcher' },
  { storage: 'Model registry', artifacts: 'Model cards, prompt templates, evaluations, and risk classifications', executionBoundary: 'No model deployment or execution endpoint' },
  { storage: 'Approval workflow store', artifacts: 'Approval requirements, request histories, human roles, and tokens', executionBoundary: 'Backend approval service owns authorization' },
  { storage: 'Audit ledger', artifacts: 'Hash-chained audit records, correlation ids, and actor context', executionBoundary: 'Read-only ledger visibility' },
];

const aiTrainingInputAllowlist = [
  { source: 'Telemetry aggregates', allowed: 'Yes', constraints: 'Tenant-scoped, quality-scored, evidence-linked aggregates only' },
  { source: 'Race-day readiness summaries', allowed: 'Yes', constraints: 'Readiness labels and blockers; no direct command state' },
  { source: 'Surface and weather measurements', allowed: 'Yes', constraints: 'Observed measurements, forecast placeholders labelled, approvals required for action' },
  { source: 'Digital Twin snapshots', allowed: 'Yes', constraints: 'Read-only snapshots and queued sync metadata, no executable patches' },
  { source: 'Approval and audit metadata', allowed: 'Yes', constraints: 'Policy, evidence, and status metadata for governance learning only' },
  { source: 'Raw veterinary notes', allowed: 'No', constraints: 'Excluded unless a future governed de-identification contract is approved' },
  { source: 'Payout, wagering, and finance data', allowed: 'No', constraints: 'No loaded DTO contract; excluded from this framework' },
  { source: 'Operational command tokens', allowed: 'No', constraints: 'Never training input; backend-only protected authorization material' },
];

const artifactOutputClasses = [
  { className: 'Insight', status: 'metadata-only', boundary: 'Descriptive context, anomaly explanation, or evidence summary; not an instruction to act' },
  { className: 'Recommendation', status: 'approval-required', boundary: 'Advisory decision support that routes protected changes through human approvals' },
  { className: 'Forecast', status: 'read-only', boundary: 'Predicted condition, risk, or workload window; execution remains outside the panel' },
];

function ArtifactFrameworkPanel({ data }: { data: Awaited<ReturnType<typeof loadCommandCenter>> }) {
  const mock = data.mode === 'mock' || data.aiGovernance.mock || Boolean(data.platformHealth.rosStandardization?.mock);
  const pipeline = artifactPipelineStages.join(' -> ');
  const registryStats = [
    { label: 'Canonical types', value: String(canonicalArtifactTypes.length), detail: 'Artifact classes in metadata registry' },
    { label: 'Storage domains', value: String(artifactStorageMap.length), detail: 'Catalog, event, evidence, twin, feature, model, approval, audit' },
    { label: 'Training allowlist', value: `${aiTrainingInputAllowlist.filter((item) => item.allowed === 'Yes').length}/${aiTrainingInputAllowlist.length}`, detail: 'Allowed sources are metadata and evidence constrained' },
    { label: 'Output classes', value: '3', detail: 'Insight, Recommendation, Forecast' },
    { label: 'Model records', value: String(data.aiGovernance.modelVersions.length), detail: `${data.aiGovernance.promptTemplates.length} prompt templates; no deployment controls` },
    { label: 'Audit sync', value: data.platformHealth.aiGovernance.auditSyncStatus, detail: `${data.platformHealth.audit.records} platform audit records reported` },
  ];

  return (
    <section aria-label="Artifact Framework visibility panel" data-route-scope="platform-health" data-framework-kind="metadata" data-execution-surface="false">
      <h2>Artifact Framework Visibility</h2>
      <RecordSourceLabel mock={mock} label="artifact framework metadata" />
      <MockDataBanner active={mock} source="Artifact Framework metadata mock/live facade" />
      <p role="note"><strong>Framework/metadata only:</strong> this panel catalogs artifact lineage, storage, allowlists, and output classes. It does not execute operations, launch training jobs, deploy models, approve recommendations, mutate Digital Twins, or issue protected commands.</p>
      <p aria-label="Artifact pipeline sequence"><code>{pipeline}</code></p>
      <MetricStrip items={registryStats} />

      <section aria-label="Artifact pipeline metadata sequence">
        <h3>Pipeline sequence</h3>
        <ol>{artifactPipelineStages.map((stage) => <li key={stage}><strong>{stage}</strong><p>Metadata checkpoint for {stage.toLowerCase()} artifacts; operational execution remains outside this route.</p></li>)}</ol>
      </section>

      <section aria-label="Artifact registry stats">
        <h3>Registry stats</h3>
        <WorkspacePanel title="Artifact Registry" eyebrow="Framework metadata">
          <RiskBadge level="low" />
          <p>Registry stats summarize type coverage and source labels only. Backend services remain the source of truth for live state, approvals, training, deployment, and immutable audit writes.</p>
        </WorkspacePanel>
        <WorkspacePanel title="Execution Boundary" eyebrow="Safety copy">
          <RiskBadge level="critical" />
          <p>Operational execution blocked: true. This route is safe visibility for governance and platform health; no browser control here can execute a race, gate, veterinary, steward, payout, emergency, surface, facility, security, model-training, or Digital Twin action.</p>
        </WorkspacePanel>
      </section>

      <section aria-label="Canonical artifact type registry">
        <h3>Canonical artifact types</h3>
        <DataTable label="Canonical artifact types table" rows={canonicalArtifactTypes} getRowKey={(row) => row.registryId} columns={[
          { key: 'type', header: 'Type', render: (row) => row.type },
          { key: 'registry', header: 'Registry ID', render: (row) => <code>{row.registryId}</code> },
          { key: 'boundary', header: 'Boundary', render: (row) => row.boundary },
        ]} />
      </section>

      <section aria-label="Artifact storage map">
        <h3>Storage map</h3>
        <DataTable label="Artifact storage map table" rows={artifactStorageMap} getRowKey={(row) => row.storage} columns={[
          { key: 'storage', header: 'Storage', render: (row) => row.storage },
          { key: 'artifacts', header: 'Artifacts', render: (row) => row.artifacts },
          { key: 'executionBoundary', header: 'Execution boundary', render: (row) => row.executionBoundary },
        ]} />
      </section>

      <section aria-label="AI training input allowlist">
        <h3>AI training input allowlist</h3>
        <p>Allowlist entries describe eligible metadata classes only. They are not permission to train a model, copy raw records, or bypass privacy, veterinary, approval, audit, or tenant controls.</p>
        <DataTable label="AI training input allowlist table" rows={aiTrainingInputAllowlist} getRowKey={(row) => row.source} columns={[
          { key: 'source', header: 'Source', render: (row) => row.source },
          { key: 'allowed', header: 'Allowed', render: (row) => <StatusCard title={row.source} status={row.allowed} detail={row.constraints} tone={row.allowed === 'Yes' ? 'ok' : 'critical'} /> },
          { key: 'constraints', header: 'Constraints', render: (row) => row.constraints },
        ]} />
      </section>

      <section aria-label="Artifact output classes">
        <h3>Output classes</h3>
        <DataTable label="Artifact output classes table" rows={artifactOutputClasses} getRowKey={(row) => row.className} columns={[
          { key: 'className', header: 'Class', render: (row) => row.className },
          { key: 'status', header: 'Status', render: (row) => <StatusCard title={row.className} status={row.status} detail={row.boundary} tone={row.className === 'Recommendation' ? 'warning' : 'info'} /> },
          { key: 'boundary', header: 'Boundary', render: (row) => row.boundary },
        ]} />
        <p>Output classes are limited to <strong>Insight</strong>, <strong>Recommendation</strong>, and <strong>Forecast</strong>. Recommendations stay advisory until a backend human approval workflow and audit trail authorize any downstream action.</p>
      </section>
    </section>
  );
}

const apiHubPipelineStages = [
  { id: 'external-sources', stage: 'External Sources', status: 'license-gated', detail: 'Contracted provider feeds, track-owned systems, and approved regulatory sources only.' },
  { id: 'provider-connectors', stage: 'Provider Connectors', status: 'watch', detail: 'Connector health, credentials, schemas, and license scope are checked before ingestion.' },
  { id: 'raw-landing', stage: 'Raw Landing', status: 'quarantined', detail: 'Immutable raw payload area with tenant, provider, contract, checksum, and retention labels.' },
  { id: 'validation', stage: 'Validation', status: 'active', detail: 'Schema, completeness, freshness, duplicate, and license constraints are validated.' },
  { id: 'normalization', stage: 'Normalization', status: 'active', detail: 'Provider fields map into canonical racing entities, events, and evidence references.' },
  { id: 'canonical-model', stage: 'Canonical Racing Data Model', status: 'active', detail: 'Horse, race, track, entry, result, workout, license, source, and lineage entities.' },
  { id: 'artifact-registry', stage: 'Universal Artifact Registry', status: 'cataloged', detail: 'Every payload, transform, model input, export, and report is cataloged with provenance.' },
  { id: 'digital-twin-runtime', stage: 'Digital Twin Runtime', status: 'read-only', detail: 'Canonical updates can inform read-only twins; no twin patch is executed from this workspace.' },
  { id: 'event-backbone', stage: 'Event Backbone', status: 'healthy', detail: 'Provider status, validation, lineage, and export-readiness events flow through the governed bus.' },
  { id: 'feature-store', stage: 'Feature Store / ML Training Store', status: 'governed', detail: 'Training candidates require license, lineage, quality, privacy, and approval evidence.' },
  { id: 'apps', stage: 'Apps/Dashboards/AI/Reports', status: 'read-only', detail: 'Downstream uses remain source-labelled and export-gated by license and policy.' },
];

const apiHubProviderRows = [
  { provider: 'Official racing data providers', scope: 'Entries, scratches, charts, results, workouts', status: 'contract-required', license: 'Ingest only after signed provider license and redistribution terms are recorded.', evidence: 'provider-contract:official-racing' },
  { provider: 'Track-owned systems', scope: 'Timing, surface, RFID, asset telemetry, race-day readiness', status: 'ready', license: 'Track-owned operational feeds stay tenant-scoped and source-labelled.', evidence: 'tenant-source:saratoga' },
  { provider: 'Regulatory and compliance feeds', scope: 'License status, safety notices, filings, evidence references', status: 'watch', license: 'Use only approved APIs or submitted records; preserve regulator source labels.', evidence: 'compliance-feed:approved' },
  { provider: 'Public websites', scope: 'Unlicensed pages and documents', status: 'blocked', license: 'No scraping. No crawling. No public redistribution without an explicit license.', evidence: 'policy:no-scraping' },
];

const apiHubDataQualityRows = [
  { dimension: 'Schema validation', score: '98%', status: 'healthy', detail: 'Provider payloads map to canonical racing contracts before downstream use.' },
  { dimension: 'Freshness SLA', score: '4m p95', status: 'watch', detail: 'Late provider batches remain visible as delayed and cannot feed export-ready packages.' },
  { dimension: 'Completeness', score: '93%', status: 'watch', detail: 'Missing workout split and license fields are queued for provider review.' },
  { dimension: 'Duplicate control', score: '99.6%', status: 'healthy', detail: 'Race, horse, person, and provider payload hashes prevent duplicate landing records.' },
];

const apiHubEntityResolutionRows = [
  { queue: 'Horse identity match', count: 14, risk: 'medium' as const, status: 'human-review', detail: 'Microchip, registry id, name, and birth-year conflicts require stewarded resolution.' },
  { queue: 'Trainer and owner license links', count: 9, risk: 'high' as const, status: 'license-review', detail: 'License jurisdiction mismatches block export-ready status.' },
  { queue: 'Track and race code crosswalk', count: 3, risk: 'medium' as const, status: 'provider-review', detail: 'Provider track codes need canonical racetrack mapping confirmation.' },
  { queue: 'Result and chart reconciliation', count: 6, risk: 'high' as const, status: 'quality-hold', detail: 'Result rows are held until official source and correction lineage agree.' },
];

const apiHubExportReadinessRows = [
  { export: 'Internal apps and dashboards', readiness: 'ready', boundary: 'Source-labelled internal read models only; no raw provider redistribution.' },
  { export: 'AI recommendations and reports', readiness: 'approval-required', boundary: 'Only governed features with license evidence, quality scores, and audit lineage can be used.' },
  { export: 'Customer API packages', readiness: 'license-blocked', boundary: 'No public redistribution without license, provider attribution, and export contract approval.' },
  { export: 'Regulatory evidence packages', readiness: 'review-ready', boundary: 'Evidence packages can be assembled for human review; filing submission is outside this workspace.' },
];

function TenantSaasBoundaryPanel({ tenant, roles, routeScope, routeLabel, candidate, apiHubDataClasses }: { tenant: TenantOption; roles: Role[]; routeScope: 'platform-health' | 'executive' | 'api-hub'; routeLabel: string; candidate?: TrackCertificationCandidateDto; apiHubDataClasses?: string[] }) {
  const boundary = tenant.saasBoundary;
  const scorecard = candidate?.scorecard ?? boundary.scorecard;
  const certificationStatement = candidate?.candidateStatement ?? boundary.certifiedTrackCandidateStatement;
  const certificationClaimBoundary = candidate?.claimBoundary ?? boundary.certifiedTrackCandidateStatement;
  const externalCertificationClaimed = candidate?.externalCertificationClaimed ?? boundary.externalCertificationClaimed;
  const federationCopy = boundary.federation.allowsCrossTenantAggregation
    ? boundary.federation.aggregationLabel
    : `${boundary.federation.aggregationLabel} Explicit federation aggregate labels are required before any cross-tenant aggregation.`;

  return (
    <section aria-label="Tenant SaaS boundary panel" data-route-scope={routeScope} data-tenant-id={boundary.tenantId} data-racetrack-id={boundary.racetrackId} data-federation-scope={boundary.federation.aggregationScope} data-cross-tenant-aggregation={boundary.federation.allowsCrossTenantAggregation}>
      <h3>Multi-Racetrack SaaS Boundary</h3>
      <p><strong>{routeLabel}</strong> is scoped to {boundary.racetrackName} (<code>{boundary.tenantId}</code> / <code>{boundary.racetrackId}</code>). {boundary.tenantIsolationLabel}</p>
      <p aria-label="Tenant-specific configuration">Tenant-specific configuration: {boundary.configuration.cloudTier} tier, {boundary.configuration.deployableMode} mode, {boundary.configuration.dataResidency}, feature flags {boundary.configuration.featureFlags.join(', ')}.</p>
      <p aria-label="Role tenant boundary metadata">{boundary.roleBoundaryLabel} Current roles: {roles.join(', ')}.</p>
      <MetricStrip items={[
        { label: 'Safety Score', value: String(scorecard.safetyScore), detail: 'Tenant/racetrack readiness score' },
        { label: 'Compliance Score', value: String(scorecard.complianceScore), detail: 'Tenant-scoped compliance posture' },
        { label: 'Operational Score', value: String(scorecard.operationalScore), detail: 'Race-day operating readiness' },
        { label: 'Accreditation Score', value: String(scorecard.accreditationScore), detail: 'Internal readiness only' },
      ]} />
      <p aria-label="Certified Track candidate wording"><strong>TrackMind Certified Track candidate:</strong> {boundary.certifiedTrackCandidateStatus}. {certificationStatement} {certificationClaimBoundary} External certification claimed: {String(externalCertificationClaimed)}.</p>
      <p aria-label="Cross-tenant aggregation boundary">Federation boundary: {federationCopy}</p>
      {apiHubDataClasses && <p aria-label="API Hub tenant data classes">API Hub tenant data classes stay source-labelled for {boundary.racetrackName}: {apiHubDataClasses.join(', ')}.</p>}
      <ul aria-label="Tenant leakage guardrails">{boundary.leakageGuardrails.map((guardrail) => <li key={guardrail}>{guardrail}</li>)}</ul>
    </section>
  );
}

function ApiHubWorkspace({ data, activePath, tenant, roles }: { data: Awaited<ReturnType<typeof loadCommandCenter>>; activePath: string; tenant: TenantOption; roles: Role[] }) {
  const pipeline = apiHubPipelineStages.map((stage) => stage.stage).join(' -> ');
  const apiHub = data.racingDataApiHub;
  const apiHubMetadata = apiHub.metadata ?? createRacingDataApiHubServiceMetadata(data.platformHealth.generatedAt);
  const apiHubSubworkspaceRows = apiHubDeepLinks.map((link) => ({
    id: link.id,
    label: link.label,
    path: link.path,
    active: activePath === link.path || activePath.startsWith(`${link.path}/`),
    source: data.mode === 'mock' ? 'shared contract metadata mock' : 'live provider management contract',
  }));
  const policyCenter: NonNullable<RacingDataApiHubWorkspaceDto['policyCenter']> = apiHub.policyCenter ?? apiHub.licensePolicies.map((policy): NonNullable<RacingDataApiHubWorkspaceDto['policyCenter']>[number] => ({
    policyId: policy.policyId,
    providerId: policy.providerId,
    licenseStatus: policy.status,
    dataClasses: policy.dataClasses,
    allowedUses: policy.usageScope,
    restrictedUses: policy.redistributionAllowed ? [] : ['public redistribution'],
    attribution: { required: policy.attributionRequired },
    retentionDays: policy.retention.retentionDays,
    exportAllowed: policy.status === 'active',
    redistributionAllowed: policy.redistributionAllowed,
    commercialUseAllowed: policy.commercialUseAllowed,
    privacyClassification: policy.status === 'active' ? 'confidential' as const : 'restricted' as const,
    modelTraining: { allowed: policy.usageScope.includes('ai-training'), restrictions: policy.usageScope.includes('ai-training') ? ['Training must preserve lineage, evidence, attribution, and retention controls.'] : ['Unlicensed model training blocked until ai-training scope is present.'], unlicensedBlocked: !policy.usageScope.includes('ai-training') },
    blockedExportReasons: [
      ...(!policy.redistributionAllowed ? ['Public redistribution blocked: redistributionAllowed=false for provider license.'] : []),
      ...(!policy.usageScope.includes('ai-training') ? ['Blocked unlicensed model training: license omits ai-training scope.'] : []),
    ],
    evidenceRefs: policy.evidenceRefs,
    mock: policy.mock,
  }));
  const featureStoreExports = apiHub.featureStoreExports ?? [];
  const dataLakeExports = apiHub.dataLakeExports ?? [];
  const licenseRiskKpis = [
    { label: 'Provider contracts', value: `${apiHub.providers.length || policyCenter.length} tracked`, trend: `${policyCenter.filter((policy) => policy.licenseStatus === 'active').length} active / ${policyCenter.filter((policy) => policy.licenseStatus !== 'active').length} review or contract-required`, tone: 'warning' },
    { label: 'License risk', value: policyCenter.some((policy) => policy.blockedExportReasons.length) ? 'HIGH' : 'LOW', trend: 'Blocked public redistribution without explicit license', tone: policyCenter.some((policy) => policy.blockedExportReasons.length) ? 'critical' : 'info' },
    { label: 'Scraping allowance', value: '0', trend: 'No scraping, crawling, or unlicensed extraction permitted', tone: 'critical' },
    { label: 'Export readiness', value: `${[...featureStoreExports, ...dataLakeExports].filter((manifest) => manifest.backendAllowed).length}/${featureStoreExports.length + dataLakeExports.length}`, trend: 'Internal and review packages ready; customer exports gated', tone: 'warning' },
  ];
  const lineageMetrics = [
    { label: 'Event backbone', value: data.platformHealth.eventBus.status, detail: `${data.platformHealth.eventBus.eventsPerMinute}/min; dead letters ${data.platformHealth.eventBus.deadLetters}` },
    { label: 'Audit lineage', value: data.platformHealth.audit.validLedger ? 'valid' : 'invalid', detail: `${data.platformHealth.audit.records} records; ${data.platformHealth.audit.criticalRecords} critical` },
    { label: 'Twin lineage', value: data.platformHealth.digitalTwin.status, detail: `${data.platformHealth.digitalTwin.queuedSync} queued sync records` },
    { label: 'Feature lineage', value: data.platformHealth.aiGovernance.auditSyncStatus, detail: `${data.platformHealth.aiGovernance.featureBuildCount} feature builds; stale/low-quality ${data.platformHealth.aiGovernance.staleLowQualityInputCount}` },
  ];
  const collaborationIngestionJob = apiHub.ingestionJobs[0];
  const collaborationLineagePath = apiHub.lineage.paths?.[0];
  const governanceFallback = data.mode === 'mock' ? fallbackRacingDataApiHub(true, data.platformHealth.generatedAt) : undefined;
  const entityResolutionClusters = [...apiHub.entityResolution.clusters, ...(governanceFallback?.entityResolution.clusters ?? [])];
  const qualityReports = [...apiHub.qualityReports, ...(governanceFallback?.qualityReports ?? [])];
  const lineagePaths = [...(apiHub.lineage.paths ?? []), ...(governanceFallback?.lineage.paths ?? [])];

  return (
    <section aria-label="API Hub Dashboard workspace" data-route-scope="api-hub" data-execution-surface="false">
      <h2>Racing Data API Hub Dashboard</h2>
      <DataFreshness label="API Hub metadata" timestamp={data.platformHealth.generatedAt} mode={data.mode} />
      <MockDataBanner active={data.mode === 'mock'} source="Racing Data API Hub governed mock/live facade" />
      <RecordSourceLabel mock={data.mode === 'mock'} label="Racing Data API Hub contract metadata" />
      <p role="note"><strong>No scraping:</strong> provider data enters only through licensed APIs, approved files, or track-owned systems. Unlicensed websites and public pages are blocked sources.</p>
      <p role="note"><strong>No public redistribution without license:</strong> exports remain internal or review-only until provider contracts, attribution, retention, and redistribution rights are approved.</p>
      <p role="note"><strong>No autonomous operational execution:</strong> this workspace monitors data readiness and lineage only; it cannot execute race, wagering, facility, Digital Twin, model-training, or provider-side operations.</p>
      <ApiHubPanel workspace={apiHub} mode={data.mode} />
      <TenantSaasBoundaryPanel tenant={tenant} roles={roles} routeScope="api-hub" routeLabel="API Hub" candidate={data.complianceLibrary.trackCertificationCandidate} apiHubDataClasses={apiHubMetadata.supportedDataClasses} />
      <MetricStrip items={[
        { label: 'Service', value: apiHubMetadata.displayName, detail: apiHubMetadata.serviceId },
        { label: 'Connection types', value: String(apiHubMetadata.supportedConnectionTypes.length), detail: apiHubMetadata.supportedConnectionTypes.join(', ') },
        { label: 'Providers', value: String(apiHubProviderRows.length), detail: 'Licensed, track-owned, regulator, and blocked-source posture' },
        { label: 'Pipeline stages', value: String(apiHubPipelineStages.length), detail: 'External source through apps, AI, dashboards, and reports' },
        { label: 'Entity queue', value: String(apiHubEntityResolutionRows.reduce((sum, row) => sum + row.count, 0)), detail: 'Human-reviewed identity and source conflicts' },
        { label: 'Lineage health', value: data.platformHealth.eventBus.status, detail: `Audit ${data.platformHealth.audit.status}; AI audit sync ${data.platformHealth.aiGovernance.auditSyncStatus}` },
      ]} />

      <section aria-label="API Hub source labels">
        <h3>Source labels</h3>
        <p>{data.mode === 'mock' ? 'MOCK DATA: approved shared contract metadata is active until a live provider management endpoint is configured.' : 'LIVE READ-ONLY: live backend source labels apply when the provider management endpoint is configured.'}</p>
        <StatusCard title="Provider behavior" status={apiHubMetadata.providerAgnostic ? 'provider-agnostic' : 'provider-specific'} detail={`Hard-coded provider behavior allowed: ${String(apiHubMetadata.hardCodedProviderBehaviorAllowed)}.`} tone={apiHubMetadata.providerAgnostic ? 'ok' : 'warning'} />
        <StatusCard title="Governance" status="required" detail={`License ${String(apiHubMetadata.governance.licenseStatusRequired)}; lineage ${String(apiHubMetadata.governance.lineageRequired)}; evidence/audit/event refs ${String(apiHubMetadata.governance.evidenceAuditEventRefsRequired)}.`} tone="info" />
      </section>

      <section aria-label="API Hub subworkspace links">
        <h3>Subworkspace links</h3>
        <DataTable label="API Hub subworkspace links table" rows={apiHubSubworkspaceRows} getRowKey={(row) => row.id} columns={[
          { key: 'area', header: 'Area', render: (row) => <a href={row.path} aria-current={row.active ? 'page' : undefined}>{row.label}</a> },
          { key: 'path', header: 'Path', render: (row) => <code>{row.path}</code> },
          { key: 'active', header: 'Active', render: (row) => String(row.active) },
          { key: 'source', header: 'Source label', render: (row) => row.source },
        ]} />
      </section>

      <section aria-label="API Hub provider status">
        <h3>Provider status</h3>
        <DataTable label="API Hub provider status table" rows={apiHubProviderRows} getRowKey={(row) => row.provider} columns={[
          { key: 'provider', header: 'Provider', render: (row) => row.provider },
          { key: 'scope', header: 'Scope', render: (row) => row.scope },
          { key: 'status', header: 'Status', render: (row) => <StatusCard title={row.provider} status={row.status} detail={row.license} tone={row.status === 'blocked' ? 'critical' : row.status === 'ready' ? 'ok' : 'warning'} /> },
          { key: 'evidence', header: 'Evidence', render: (row) => <code>{row.evidence}</code> },
        ]} />
      </section>

      <section aria-label="API Hub ingestion pipeline">
        <h3>Ingestion pipeline</h3>
        <p aria-label="API Hub pipeline sequence"><code>{pipeline}</code></p>
        <ol>{apiHubPipelineStages.map((stage) => <li key={stage.id}><strong>{stage.stage}</strong><p>{stage.status}: {stage.detail}</p></li>)}</ol>
        {collaborationIngestionJob && <CollaborationPanel
          routeScope="api-hub"
          title="API Hub Ingestion Job Room"
          targetArtifactId={collaborationIngestionJob.jobId}
          targetArtifactType="api-hub-ingestion-job"
          tenantId={collaborationIngestionJob.tenant.tenantId}
          racetrackId={collaborationIngestionJob.tenant.racetrackId}
          workflowRef={collaborationIngestionJob.lineage.correlationId}
          approvalRef={apiHub.reviewActions?.find((action) => action.target.includes(collaborationIngestionJob.providerId))?.id}
          auditRefs={collaborationIngestionJob.auditRefs}
          twinRefs={collaborationLineagePath?.twinRefs ?? apiHub.digitalTwinSync.targetTwinRefs}
          evidenceRefs={[...collaborationIngestionJob.evidenceRefs, ...collaborationIngestionJob.rawPayloadRefs, ...collaborationIngestionJob.canonicalEnvelopeRefs]}
          variant="evidence-review"
          activityItems={[
            { id: `${collaborationIngestionJob.jobId}-status`, actor: 'racing-data-api-hub', message: `Ingestion ${collaborationIngestionJob.status}; received ${collaborationIngestionJob.counts.received}, normalized ${collaborationIngestionJob.counts.normalized}, rejected ${collaborationIngestionJob.counts.rejected}.`, at: collaborationIngestionJob.completedAt ?? collaborationIngestionJob.startedAt ?? collaborationIngestionJob.requestedAt, tone: collaborationIngestionJob.status === 'completed' ? 'ok' : 'warning' },
            ...collaborationIngestionJob.errors.map((error) => ({ id: `${collaborationIngestionJob.jobId}-${error.code}`, actor: 'quality-gate', message: `${error.code}: ${error.message}`, at: collaborationIngestionJob.requestedAt, tone: 'warning' as const })),
          ]}
        />}
      </section>

      <section aria-label="API Hub license risk KPIs">
        <h3>License-risk KPIs</h3>
        <div aria-label="License risk KPI cards">{licenseRiskKpis.map((kpi) => <KpiTile key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.trend} tone={kpi.tone} />)}</div>
        <WorkspacePanel title="Redistribution guardrail" eyebrow="License policy">
          <RiskBadge level="critical" />
          <p>No public redistribution without license. No raw provider replay, bulk download, or derived external API package is marked ready until the provider contract permits it.</p>
        </WorkspacePanel>
      </section>

      <section aria-label="API Hub data quality">
        <h3>Data quality</h3>
        <DataTable label="API Hub data quality table" rows={apiHubDataQualityRows} getRowKey={(row) => row.dimension} columns={[
          { key: 'dimension', header: 'Dimension', render: (row) => row.dimension },
          { key: 'score', header: 'Score', render: (row) => row.score },
          { key: 'status', header: 'Status', render: (row) => <StatusIndicator label={row.status} tone={row.status} /> },
          { key: 'detail', header: 'Detail', render: (row) => row.detail },
        ]} />
      </section>

      <section aria-label="API Hub entity resolution queue">
        <h3>Entity resolution queue</h3>
        <DataTable label="API Hub entity resolution queue table" rows={apiHubEntityResolutionRows} getRowKey={(row) => row.queue} columns={[
          { key: 'queue', header: 'Queue', render: (row) => row.queue },
          { key: 'count', header: 'Count', align: 'right', render: (row) => String(row.count) },
          { key: 'risk', header: 'Risk', render: (row) => <RiskBadge level={row.risk} /> },
          { key: 'status', header: 'Status', render: (row) => row.status },
          { key: 'detail', header: 'Detail', render: (row) => row.detail },
        ]} />
      </section>

      <section aria-label="API Hub lineage health">
        <h3>Lineage health</h3>
        <MetricStrip items={lineageMetrics} />
        <p>Lineage must link provider contract, raw landing checksum, validation result, normalization transform, canonical entity, artifact registry record, downstream event, feature record, export package, and audit entry before export readiness can advance.</p>
      </section>

      <section aria-label="API Hub export readiness">
        <h3>Export readiness</h3>
        <DataTable label="API Hub export readiness table" rows={apiHubExportReadinessRows} getRowKey={(row) => row.export} columns={[
          { key: 'export', header: 'Export', render: (row) => row.export },
          { key: 'readiness', header: 'Readiness', render: (row) => <StatusCard title={row.export} status={row.readiness} detail={row.boundary} tone={row.readiness.includes('blocked') ? 'critical' : row.readiness.includes('required') ? 'warning' : 'ok'} /> },
          { key: 'boundary', header: 'Boundary', render: (row) => row.boundary },
        ]} />
      </section>

      <section aria-label="Entity Resolution Queue">
        <h3>Entity Resolution Queue</h3>
        {entityResolutionClusters.map((cluster) => <article key={cluster.resolutionId}>
          <p>{cluster.canonicalId}</p>
          <p>{cluster.candidateExternalIds.join(' ')}</p>
          <p>matchConfidence {Math.round(((cluster.matchConfidence ?? cluster.confidence) || 0) * 100)}%</p>
          <p>reviewRequired {String(cluster.reviewRequired)}</p>
        </article>)}
      </section>

      <section aria-label="Data Quality Center">
        <h3>Data Quality Center</h3>
        {qualityReports.map((report) => <article key={report.reportId}>
          <p>Low quality warning: {report.targetRef} score {report.score} severity {report.severity}</p>
          <p>{report.licenseImpactSummary}</p>
          <p>{report.dataQualityImpactSummary}</p>
        </article>)}
      </section>

      <section aria-label="Lineage Explorer">
        <h3>Lineage Explorer</h3>
        <p>RAW PAYLOAD -&gt; NORMALIZED ARTIFACT -&gt; REGISTRY -&gt; TWIN/EVENT/AUDIT/FEATURE/EXPORT REFS</p>
        {lineagePaths.map((path) => <article key={path.lineageId}>
          <p>{`${path.rawPayloadRef} -> ${path.normalizedArtifactRef} -> ${path.registryRef}`}</p>
          <p>Twin refs: {path.twinRefs.join(', ')}</p>
          <p>Feature refs: {path.featureRefs.join(', ')}</p>
          <p>Export refs: {path.exportRefs.join(', ')}</p>
        </article>)}
      </section>

      <section aria-label="API Hub disabled review controls">
        <h3>API Hub disabled review controls</h3>
        <button type="button" disabled aria-disabled={true} aria-label="Entity resolution review">Creates a resolution draft only; canonical horse registry is not mutated locally.</button>
        <button type="button" disabled aria-disabled={true} aria-label="Quality exception approval">Quality exception approval is backend-owned and cannot mark official records valid in the frontend.</button>
        <button type="button" disabled aria-disabled={true} aria-label="Feature export approval">Feature export approval is backend-owned; export controls stay draft-only until the backend allows export.</button>
      </section>

      <section aria-label="API Hub contract coverage">
        <h3>Contract coverage</h3>
        <DataTable label="API Hub contract DTO table" rows={apiHubMetadata.dtoNames.map((name) => ({ name }))} getRowKey={(row) => row.name} columns={[
          { key: 'dto', header: 'DTO', render: (row) => row.name },
          { key: 'source', header: 'Source', render: () => data.mode === 'mock' ? 'shared contract metadata mock' : 'live provider management contract' },
        ]} />
      </section>
    </section>
  );
}

function SensitiveField({ value, authorized }: { value?: string; authorized: boolean }) {
  return <>{authorized && value ? value : 'Masked until security permission'}</>;
}

function approvalChipStatus(status?: string): ApprovalDto['status'] {
  if (status === 'approved' || status === 'rejected' || status === 'expired' || status === 'escalated' || status === 'pending') return status;
  return 'pending-approval';
}

function zoneRiskLevel(classification: string): OperationalRisk {
  if (classification === 'critical') return 'critical';
  if (classification === 'restricted') return 'high';
  if (classification === 'staff-only') return 'medium';
  return 'low';
}

function healthSummary(health: Record<'online' | 'degraded' | 'offline', number>) {
  return `Online ${health.online} / degraded ${health.degraded} / offline ${health.offline}`;
}

function EmergencyResponseCard({ title, lead, checklist, aiMayBlock, workflowDefinitionId, slaMinutes, authorityStatement }: { title: string; lead: string; checklist: string[]; aiMayBlock: boolean; workflowDefinitionId?: string; slaMinutes?: number; authorityStatement?: string }) {
  return (
    <WorkspacePanel title={title} eyebrow={workflowDefinitionId ?? 'emergency workflow'}>
      <p>Response workspace: {title}</p>
      <MetricStrip items={[
        { label: 'Lead', value: lead, detail: slaMinutes ? `${slaMinutes} minute SLA` : 'Human command-owned' },
        { label: 'AI block', value: String(aiMayBlock), detail: 'AI is advisory only for emergency response' },
        { label: 'Steps', value: String(checklist.length), detail: checklist.join(' -> ') },
      ]} />
      <p>Human emergency authority prioritized; AI may block personnel: {String(aiMayBlock)}.</p>
      <p>{authorityStatement ?? 'Emergency personnel may proceed based on field command authority; AI is advisory only.'}</p>
    </WorkspacePanel>
  );
}

function securityApprovalActions() {
  return [
    { id: 'security-escalate', label: 'Escalate security incident', detail: 'Creates or references an approval/audit-aware security escalation; no incident state changes in the browser.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'security-investigation', label: 'Open security investigation', detail: 'Investigation opening is routed through the Security Operations backend with evidence custody and audit records.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'security-sensitive-read', label: 'Reveal sensitive security fields', detail: 'Reveal sensitive fields requires permission, approval, and an audit/event-aware backend path.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
  ];
}

function emergencyApprovalActions() {
  return [
    { id: 'emergency-activate', label: 'Request emergency workflow evidence capture', detail: 'Human commanders act immediately; this requests audit/evidence capture and follow-up controlled decisions without blocking response.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'emergency-reentry', label: 'Request controlled re-entry approval', detail: 'Re-entry, demobilization, and continuity changes remain backend-owned and audit/event aware.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'emergency-after-action', label: 'Request after-action corrective action approval', detail: 'Corrective actions are approval-gated; after-action reports document decisions without mutating live operations locally.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
  ];
}

function safetyOverviewActions() {
  return [
    { id: 'safety-security-handoff', label: 'Request safety security handoff', detail: 'Routes security-sensitive escalation evidence through approvals, audit, and event records; no local incident mutation occurs.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'safety-emergency-evidence', label: 'Request emergency evidence capture', detail: 'Emergency personnel authority wins immediately; this only records post-action evidence and controlled follow-up decisions.', approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true },
    { id: 'safety-steward-review', label: 'Request steward safety review', detail: 'Opens a governed review request for stewards without changing official results or bypassing human authority.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
  ];
}

function SafetyCenterOverview({ data }: { data: Awaited<ReturnType<typeof loadCommandCenter>> }) {
  const emergency = data.emergencyOperations;
  const security = data.securityOperations;
  const openSecurityIncidents = security.incidents.filter((incident) => incident.status !== 'resolved').length;
  const securityEventCount = security.accessEvents.length + security.events.length;
  const cameraSummary = healthSummary(security.dashboard.cameraHealth);
  const pendingCommunications = emergency.communicationLog.filter((item) => !item.completed).length;
  const activeEvacuations = emergency.evacuationZones.filter((zone) => zone.status !== 'open' && zone.status !== 'cleared').length;
  const stewardCases = data.stewardCenter.inquiries.length;
  const pendingSafetyApprovals = data.approvals.filter((approval) => approval.queue === 'security' || approval.queue === 'operations' || approval.queue === 'race-day').length;

  return (
    <section aria-label="Safety Center overview workspace">
      <h2>Safety Center</h2>
      <p>Read-only safety overview for raceday leadership. It links into Security Operations, Emergency Ops, Steward Center, and Approvals without duplicating those workspaces or exposing sensitive security fields.</p>
      <p>Emergency personnel authority always wins. AI can summarize and recommend, but cannot block emergency response; sensitive follow-up actions stay approval, audit, and event aware.</p>
      <p role="status">Lazy-loading placeholder: specialized safety modules can load behind this shell while <code>/safety</code>, <code>/security</code>, and <code>/emergency</code> remain stable sibling routes.</p>
      {MockDataBanner({ active: data.mode === 'mock' || security.mock || emergency.mock, source: 'safety overview composed from approved safety adapters' })}
      <section aria-label="Safety overview status">
        <h3>Safety status</h3>
        <MetricStrip items={[
          { label: 'Active emergency', value: emergency.activeEmergencyStatus, detail: `${emergency.events.length} emergency events; AI may block ${String(emergency.emergencyActions.aiMayBlock)}` },
          { label: 'Security posture', value: String(security.dashboard.activeAlerts), detail: `${openSecurityIncidents} open incidents; ${security.dashboard.restrictedZoneEvents} restricted-zone events` },
          { label: 'Camera health', value: cameraSummary, detail: `${security.cameras.length} cameras across restricted zones` },
          { label: 'Approvals', value: String(pendingSafetyApprovals), detail: 'Safety-sensitive controls remain locked in the frontend' },
        ]} />
      </section>
      <section aria-label="Safety workspace links">
        <h3>Safety workspaces</h3>
        <article><a href="/security">Open Security Operations</a><p>Restricted zones, access events, camera health, active incidents, investigations, visitor records, audit records, event stream, and security approval gates.</p></article>
        <article><a href="/emergency">Open Emergency Ops</a><p>Active incidents, emergency plans, resources, evacuation zones, severe-weather workflows, communication logs, drills, after-action reports, and human command authority.</p></article>
        <article><a href="/stewards">Open Steward Center</a><p>Human-only inquiry, evidence, ruling, and appeal workflows with AI limited to advisory organization.</p></article>
        <article><a href="/approvals">Open Approvals</a><p>Approval queues for sensitive safety, security, stewarding, and controlled operational actions.</p></article>
      </section>
      <section aria-label="Safety signal summary">
        <h3>Signal summary</h3>
        <MetricStrip items={[
          { label: 'Restricted zones', value: String(security.restrictedZones.length), detail: 'Credential names are intentionally not displayed on this overview' },
          { label: 'Security events', value: String(securityEventCount), detail: `${security.investigations.length} investigations; ${security.escalations.length} handoffs` },
          { label: 'Emergency resources', value: String(emergency.resources.length), detail: `${emergency.plans.length} plans; ${activeEvacuations} active evacuation zones` },
          { label: 'Comms and drills', value: `${pendingCommunications} pending`, detail: `${emergency.drills.length} drills; ${emergency.afterActionReports.length} after-action reports` },
        ]} />
      </section>
      <section aria-label="Safety authority guardrails" role="note">
        <h3>Authority and guardrails</h3>
        <p>Human emergency authority prioritized; AI may block personnel: {String(emergency.emergencyActions.aiMayBlock)}.</p>
        <p>Sensitive security details are masked on this overview. Use Security Operations with proper permission or an approved sensitive-read gate for protected fields.</p>
        <p>Steward cases loaded: {stewardCases}. Official rulings and result changes remain human steward-only and backend verified.</p>
      </section>
      <section aria-label="Safety overview locked controls">
        <h3>Locked controls</h3>
        <p>These controls are disabled in the frontend and only create backend approval or evidence-capture requests when enabled by live services.</p>
        <ActionRail actions={safetyOverviewActions()} />
      </section>
    </section>
  );
}

function SecurityEmergencyCoordination({ data, canViewSensitiveSecurity }: { data: Awaited<ReturnType<typeof loadCommandCenter>>; canViewSensitiveSecurity: boolean }) {
  const emergencyEventTone = (severity: string): OperationalRisk => severity === 'critical' ? 'critical' : severity === 'major' ? 'high' : severity === 'minor' ? 'medium' : 'low';
  return (
    <section aria-label="Security emergency coordination view">
      <h3>Security and emergency coordination</h3>
      <p>Human emergency authority is always prioritized. AI recommendations cannot override, delay, or block emergency personnel, and sensitive security actions are routed through approval, audit, and event-aware backend paths.</p>
      {MockDataBanner({ active: data.mode === 'mock' || data.securityOperations.mock || data.emergencyOperations.mock, source: 'approved security/emergency mock adapters' })}
      <section aria-label="Active security and emergency alerts">
        <h4>Active alerts</h4>
        <MetricStrip items={[
          { label: 'Security alerts', value: String(data.securityOperations.dashboard.activeAlerts), detail: `${data.securityOperations.dashboard.restrictedZoneEvents} restricted-zone events` },
          { label: 'Emergency events', value: String(data.emergencyOperations.events.length), detail: data.emergencyOperations.activeEmergencyStatus },
          { label: 'Investigation queue', value: String(data.securityOperations.dashboard.investigationQueue), detail: 'Security handoff ready' },
          { label: 'Evacuation workflows', value: String(data.emergencyOperations.evacuationZones.filter((zone) => zone.status !== 'open').length), detail: 'Incident command owns execution' },
        ]} />
        {data.securityOperations.incidents.map((incident) => <WorkspacePanel key={incident.id} title={incident.title} eyebrow="Active security incident"><RiskBadge level={incident.severity} /><p>{incident.status}; zone {incident.zoneId}; audit {incident.auditId}; approval {incident.approvalRequestId ?? 'pending if critical'}.</p></WorkspacePanel>)}
        <EventTimeline events={data.emergencyOperations.events.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.subjectId}; audit ${event.auditId}`, tone: emergencyEventTone(event.severity) }))} />
      </section>
      <section aria-label="Restricted zone emergency posture">
        <h4>Restricted zones</h4>
        {data.securityOperations.restrictedZones.map((zone) => {
          const cameras = zone.cameraIds.map((id) => data.securityOperations.cameras.find((camera) => camera.id === id)).filter((camera) => Boolean(camera));
          return <WorkspacePanel key={zone.id} title={zone.name} eyebrow={`Zone ${zone.classification}`}><RiskBadge level={zoneRiskLevel(zone.classification)} /><p>Credential <SensitiveField value={zone.requiredCredential} authorized={canViewSensitiveSecurity} />; retention {zone.retentionPolicy ?? 'configured by backend'}; twin {zone.twinId ?? 'pending'}.</p><p>Cameras {cameras.map((camera) => `${camera?.label}:${camera?.health}`).join(', ') || 'none'}.</p></WorkspacePanel>;
        })}
      </section>
      <section aria-label="Camera health emergency coverage">
        <h4>Camera health</h4>
        {data.securityOperations.cameras.map((camera) => <WorkspacePanel key={camera.id} title={camera.label} eyebrow={camera.zoneId}><AssetHealthIndicator label={camera.label} status={camera.health === 'online' ? 'healthy' : camera.health === 'degraded' ? 'degraded' : 'offline'} /><p>Privacy masking {String(camera.privacyMasking)}; heartbeat {camera.lastHeartbeatAt}; coverage {(camera.coverage ?? []).join(', ') || 'not reported'}; twin {camera.twinId ?? 'pending'}.</p></WorkspacePanel>)}
      </section>
      <section aria-label="Investigations and incident command handoffs">
        <h4>Investigations</h4>
        {data.securityOperations.investigations.map((item) => <WorkspacePanel key={item.id} title={`${item.incidentId}: ${item.status}`} eyebrow="Investigation"><p>Lead {item.lead}; evidence <SensitiveField value={item.evidence.join(', ')} authorized={canViewSensitiveSecurity} />; audit {item.auditId}; approval {item.approvalRequestId ?? 'not required'}.</p></WorkspacePanel>)}
        {data.securityOperations.escalations.map((flow) => <StatusCard key={flow.id} title={`Handoff ${flow.incidentId}`} status={flow.status} detail={`Route ${flow.routeTo.join(' -> ')}; audit ${flow.auditId}; approval ${flow.approvalRequestId ?? 'pending if critical'}.`} />)}
      </section>
      <section aria-label="Emergency plans and resources coordination">
        <h4>Emergency plans and resources</h4>
        {data.emergencyOperations.plans.map((plan) => <WorkspacePanel key={plan.id} title={plan.name} eyebrow="Emergency plan"><p>Scenarios {plan.scenarios.join(', ')}; criteria {plan.activationCriteria.join(', ')}; drill cadence {plan.drillCadenceDays} days.</p></WorkspacePanel>)}
        {data.emergencyOperations.resources.map((resource) => <StatusCard key={resource.id} title={resource.label} status={resource.status} detail={`${resource.kind}; zone ${resource.zoneId}; capacity ${resource.capacity ?? 'n/a'}; ${resource.coordinates.latitude}, ${resource.coordinates.longitude}.`} />)}
      </section>
      <section aria-label="Evacuation workflow coordination">
        <h4>Evacuation workflow</h4>
        {data.emergencyOperations.evacuationZones.map((zone) => <StatusCard key={zone.id} title={zone.name} status={zone.status} detail={`Route ${zone.route.join(' -> ')}; assembly ${zone.assemblyArea}; capacity ${zone.capacity}.`} />)}
        <p>{data.emergencyOperations.checklist.filter((item) => item.completed).length} of {data.emergencyOperations.checklist.length} command checklist steps complete; AI blocking is {String(data.emergencyOperations.checklist.some((item) => item.aiBlockingAllowed))}.</p>
      </section>
      <section aria-label="Communications drills and after actions">
        <h4>Communications, drills, and after actions</h4>
        {data.emergencyOperations.communicationLog.map((item) => <StatusCard key={item.id} title={`${item.channel} to ${item.audience}`} status={item.completed ? 'completed' : 'pending'} detail={`${item.message}; ${item.completedBy ? `completed by ${item.completedBy}` : 'awaiting human communicator'}.`} />)}
        {data.emergencyOperations.drills.map((drill) => <WorkspacePanel key={drill.id} title={`${drill.scenario} drill`} eyebrow={drill.completedAt ? 'completed' : 'scheduled'}><p>Participants {drill.participants.join(', ')}; criteria {drill.successCriteria.join(', ')}; event {drill.eventId ?? 'pending'}; audit {drill.auditId ?? 'pending'}.</p></WorkspacePanel>)}
        {data.emergencyOperations.afterActionReports.map((report) => <WorkspacePanel key={report.incidentId} title={`After-action ${report.incidentId}`} eyebrow={report.approvalPosture?.mode ?? 'post-action-evidence'}><p>Findings {report.findings.map((finding) => `${finding.finding} (${finding.owner})`).join('; ')}</p><p>Corrective actions {report.correctiveActions.map((action) => `${action.action} due ${action.dueDays}d`).join('; ')}</p><p>Evidence {(report.evidencePackage ?? []).join(', ') || 'pending evidence package'}.</p></WorkspacePanel>)}
      </section>
    </section>
  );
}
const statusRiskBadgeLevel = (status: string): 'low' | 'medium' | 'high' | 'critical' => status === 'critical' || status === 'offline' || status === 'closed' ? 'critical' : status === 'warning' || status === 'degraded' || status === 'in-progress' ? 'high' : status === 'standby' || status === 'simulated' ? 'medium' : 'low';
const statusHealthLabel = (status: string) => status === 'healthy' || status === 'online' || status === 'nominal' ? 'healthy' : status === 'critical' || status === 'offline' ? 'critical' : status === 'warning' ? 'degraded' : status;

function StewardCenterWorkspace({ data, roles, authenticated }: { data: Awaited<ReturnType<typeof loadCommandCenter>>; roles: Role[]; authenticated: boolean }) {
  const inquiries = data.stewardCenter.inquiries;
  const objections = inquiries.flatMap((inquiry) => inquiry.objections.map((objection) => ({ inquiry, objection })));
  const investigations = inquiries.flatMap((inquiry) => (inquiry.investigations ?? []).map((investigation) => ({ inquiry, investigation })));
  const evidence = inquiries.flatMap((inquiry) => inquiry.evidenceReferences.map((item) => ({ inquiry, item })));
  const rules = inquiries.flatMap((inquiry) => inquiry.ruleReferences.map((rule) => ({ inquiry, rule })));
  const drafts = inquiries.flatMap((inquiry) => inquiry.decisionDrafts.map((draft) => ({ inquiry, draft })));
  const organizations = inquiries.flatMap((inquiry) => (inquiry.evidenceOrganizations ?? []).map((organization) => ({ inquiry, organization })));
  const appealPackages = inquiries.flatMap((inquiry) => inquiry.appealPackages.map((pkg) => ({ inquiry, pkg })));
  const generatedTimeline = inquiries.flatMap((inquiry) => inquiry.timeline ?? []);
  const evidenceTimeline = [
    ...objections.map(({ inquiry, objection }) => ({ time: objection.filedAt ?? inquiry.openedAt, label: `${inquiry.raceId} objection ${objection.id}: ${objection.allegation}`, tone: 'warning' })),
    ...inquiries.flatMap((inquiry) => inquiry.incidentsUnderReview.map((incident) => ({ time: incident.openedAt ?? inquiry.openedAt, label: `${inquiry.raceId} incident ${incident.id}: ${incident.description}`, tone: incident.severity === 'critical' ? 'critical' : incident.severity === 'major' ? 'warning' : 'info' }))),
    ...evidence.map(({ inquiry, item }) => ({ time: item.capturedAt, label: `${inquiry.raceId} ${item.kind}: ${item.description}; hash ${item.hash}${item.aiGenerated ? '; AI evidence organization only' : ''}`, tone: item.aiGenerated ? 'advisory' : 'info' })),
    ...generatedTimeline.map((entry) => ({ time: entry.at, label: `${entry.source}: ${entry.label}; audit ${entry.auditRecordId ?? 'pending'}`, tone: entry.source === 'final-ruling' ? 'warning' : entry.source === 'ai-organization' ? 'advisory' : 'info' })),
  ];
  const allGuardrailsHold = inquiries.every((inquiry) => inquiry.aiGuardrails.advisoryOnly && !inquiry.aiGuardrails.mayIssueOfficialRuling && !inquiry.aiGuardrails.mayModifyOfficialResults);
  const humanFinalizationRole = roles.some((role) => role === 'steward' || role === 'admin');
  const finalizationPrerequisites = inquiries.length > 0 && inquiries.every((inquiry) => {
    const integrations = inquiry.integrations;
    return inquiry.auditRecords.length > 0
      && inquiry.evidenceReferences.every((item) => Boolean(item.hash) && Boolean(item.auditRecordId) && Boolean(item.custody?.legalHold) && Boolean(item.custody?.chainOfCustody.length))
      && inquiry.ruleReferences.every((rule) => Boolean(rule.auditRecordId))
      && Boolean(integrations?.approvalRequestIds.length)
      && Boolean(integrations?.eventTypes.length)
      && Boolean(integrations?.auditRecordIds.length)
      && Boolean(integrations?.evidenceVaultRecordIds.length);
  });
  const finalizationAllowed = data.stewardCenter.permissions.canFinalize && humanFinalizationRole && finalizationPrerequisites;
  const finalizationReason = 'Final ruling is locked until a live backend verifies human steward role, approval request, audit trail, event emission, and officialResultsModified=false.';
  const collaborationInquiry = inquiries[0];
  const collaborationInvestigation = collaborationInquiry ? investigations.find(({ inquiry }) => inquiry.id === collaborationInquiry.id)?.investigation : undefined;
  const collaborationAppealPackage = collaborationInquiry?.appealPackages[0];
  const collaborationInquiryIntegrations = collaborationInquiry?.integrations;

  return (
    <section aria-label="Steward Center workspace">
      <h2>Steward Center</h2>
      <p>Unified stewarding workspace for inquiries, objection cases, involved horses and jockeys, evidence review, rule references, decision drafts, appeal packages, audit records, events, approvals, and workflow handoffs.</p>
      <MockDataBanner active={data.stewardCenter.mock || data.mode === 'mock'} source="stewarding mock/live boundary" />
      <section aria-label="Steward AI assistance boundaries" role="note">
        <h3>AI Assistance Boundaries</h3>
        <p>AI may summarize and organize evidence only. AI cannot issue official rulings, cannot modify official results, cannot approve final rulings, and cannot bypass human steward authority checks.</p>
        <MetricStrip items={[
          { label: 'AI advisory only', value: String(inquiries.every((inquiry) => inquiry.aiGuardrails.advisoryOnly)), detail: 'Summaries and organization only' },
          { label: 'AI official rulings', value: String(inquiries.some((inquiry) => inquiry.aiGuardrails.mayIssueOfficialRuling)), detail: 'Must remain false' },
          { label: 'AI result mutation', value: String(inquiries.some((inquiry) => inquiry.aiGuardrails.mayModifyOfficialResults)), detail: 'Must remain false' },
          { label: 'Guardrails valid', value: String(allGuardrailsHold), detail: 'Visible stewarding boundary' },
        ]} />
      </section>
      <section aria-label="Steward command summary">
        <h3>Queue Summary</h3>
        <MetricStrip items={[
          { label: 'Inquiries', value: String(inquiries.length), detail: 'Human steward case queue' },
          { label: 'Objections', value: String(objections.length), detail: `${objections.filter(({ objection }) => !['dismissed', 'upheld'].includes(objection.status)).length} open` },
          { label: 'Investigations', value: String(investigations.length), detail: `${investigations.filter(({ investigation }) => investigation.workflowInstanceId).length} workflow linked` },
          { label: 'Evidence items', value: String(evidence.length), detail: `${evidence.filter(({ item }) => item.aiGenerated).length} AI-labeled artifacts` },
          { label: 'Final ruling gate', value: finalizationAllowed ? 'approval-ready' : 'locked', detail: data.mode === 'live' ? 'Live backend required' : 'Mock boundary active' },
        ]} />
      </section>
      <section aria-label="Steward inquiry queue">
        <h3>Inquiry Queue</h3>
        {inquiries.map((inquiry) => <StatusCard key={inquiry.id} title={`${inquiry.raceId}: ${inquiry.id}`} status={inquiry.status} detail={`Opened ${inquiry.openedAt}; objections ${inquiry.objections.length}; evidence ${inquiry.evidenceReferences.length}; rules ${inquiry.ruleReferences.length}.`}><p>Official result lock: {inquiry.involvedHorses.every((horse) => horse.officialResultLocked) ? 'all involved horses locked' : 'review required'}; no direct local mutation of official decisions.</p></StatusCard>)}
        {collaborationInquiry && <CollaborationPanel
          routeScope="stewards"
          title="Steward Case Room"
          targetArtifactId={collaborationInquiry.id}
          targetArtifactType="steward-case"
          tenantId={data.readiness.races.find((race) => race.raceId === collaborationInquiry.raceId)?.trackId ?? 'track-1'}
          racetrackId={data.readiness.races.find((race) => race.raceId === collaborationInquiry.raceId)?.trackId ?? 'track-1'}
          workflowRef={collaborationInvestigation?.workflowInstanceId ?? collaborationAppealPackage?.contents.workflowInstanceIds?.[0]}
          approvalRef={collaborationInvestigation?.approvalRequestId ?? collaborationInquiry.finalRuling?.approvalRequestId ?? collaborationAppealPackage?.contents.approvalRequestIds?.[0]}
          auditRefs={collaborationInquiryIntegrations?.auditRecordIds ?? collaborationInquiry.auditRecords.map((audit) => audit.id)}
          twinRefs={collaborationInquiryIntegrations?.digitalTwinRefs ?? collaborationInvestigation?.digitalTwinRefs ?? []}
          evidenceRefs={[...collaborationInquiry.evidenceReferences.map((item) => item.id), ...(collaborationAppealPackage?.contents.evidenceIds ?? []), ...(collaborationInquiryIntegrations?.evidenceVaultRecordIds ?? [])]}
          variant="evidence-review"
          activityItems={[
            { id: `${collaborationInquiry.id}-opened`, actor: 'steward-center', message: `Inquiry ${collaborationInquiry.status} for ${collaborationInquiry.raceId}; official result mutation remains locked.`, at: collaborationInquiry.openedAt, tone: 'warning' },
            ...collaborationInquiry.evidenceReferences.slice(0, 2).map((item) => ({ id: `${collaborationInquiry.id}-${item.id}`, actor: item.addedBy ?? item.sourceSystem ?? 'evidence-vault', message: `${item.kind}: ${item.description}; hash ${item.hash}.`, at: item.capturedAt, tone: item.aiGenerated ? 'advisory' as const : 'info' as const })),
          ]}
        />}
      </section>
      <section aria-label="Steward objection cases">
        <h3>Objection Cases</h3>
        {objections.length ? objections.map(({ inquiry, objection }) => <article key={objection.id}><ApprovalChip status="pending-approval" /><strong>{objection.id}: {objection.status}</strong><p>{objection.allegation}</p><p>Inquiry {inquiry.id}; filed by {objection.filedBy}; horse {objection.horseId ?? 'pending'}; jockey {objection.jockeyId ?? 'pending'}.</p></article>) : <p>No objections are filed for the current steward view.</p>}
      </section>
      <section aria-label="Steward investigation workflow">
        <h3>Investigation Workflow</h3>
        {investigations.length ? investigations.map(({ inquiry, investigation }) => <article key={investigation.id}><ApprovalChip status={investigation.approvalRequestId ? 'pending-approval' : 'pending'} /><strong>{investigation.focus}</strong><p>Inquiry {inquiry.id}; status {investigation.status}; lead {investigation.leadStewardId}; opened {investigation.openedAt}.</p><p>Tasks {investigation.taskIds.join(', ') || 'pending'}; evidence {investigation.evidenceIds.join(', ') || 'pending'}; rules {investigation.ruleIds.join(', ') || 'pending'}.</p><p>Workflow {investigation.workflowInstanceId ?? 'pending workflow service'}; approval {investigation.approvalRequestId ?? 'pending final approval request'}; twins {investigation.digitalTwinRefs.join(', ') || 'none'}.</p></article>) : <p>No steward investigation workflow has been opened for the current view.</p>}
      </section>
      <section aria-label="Steward involved horses and jockeys">
        <h3>Involved Horses and Jockeys</h3>
        {inquiries.map((inquiry) => <article key={`${inquiry.id}-connections`}><strong>{inquiry.id}</strong><p>Horses: {inquiry.involvedHorses.map((horse) => `${horse.programNumber} ${horse.name} resultLocked=${horse.officialResultLocked}`).join('; ')}</p><p>Jockeys: {inquiry.involvedJockeys.map((jockey) => `${jockey.name} (${jockey.licenseId}) on ${jockey.horseId}`).join('; ')}</p></article>)}
      </section>
      <section aria-label="Steward evidence timeline">
        <h3>Evidence Timeline</h3>
        {evidenceTimeline.length ? <EventTimeline label="Steward evidence timeline events" events={evidenceTimeline} /> : <p>No evidence has been linked to the current inquiry.</p>}
      </section>
      <section aria-label="Steward evidence custody timeline">
        <h3>Evidence Custody</h3>
        {evidence.map(({ item }) => <article key={item.id}><strong>{item.kind}: {item.description}</strong><p>Source <code>{item.uri}</code>; added by {item.addedBy ?? 'source adapter'}; AI generated {String(Boolean(item.aiGenerated))}; system {item.sourceSystem ?? 'steward-center'}; hash {item.hash}.</p><p>Legal hold {String(Boolean(item.custody?.legalHold))}; sealed {String(Boolean(item.custody?.sealed))}; retention {item.custody?.retentionPolicy ?? 'placeholder pending evidence vault'}.</p><p>Chain {(item.custody?.chainOfCustody ?? []).map((step) => `${step.action} by ${step.actorId}`).join('; ') || 'placeholder pending custody service'}</p>{item.kind === 'video' ? <button type="button" disabled aria-label={`Open steward video placeholder ${item.id}`}>Video review placeholder requires secured evidence service</button> : <button type="button" disabled aria-label={`Open steward evidence placeholder ${item.id}`}>Evidence viewer placeholder requires custody verification</button>}</article>)}
        <p>Final-ruling prerequisite check requires evidence hash, custody chain, legal hold, audit record, event record, and evidence-vault record before any live backend can authorize a human steward control.</p>
      </section>
      <section aria-label="Steward rule reference panel">
        <h3>Rule Reference Panel</h3>
        {rules.map(({ inquiry, rule }) => <article key={`${inquiry.id}-${rule.id}`}><strong>{rule.jurisdiction} {rule.rulebook} §{rule.section}</strong><p>{rule.citation}: {rule.summary}</p><p>Inquiry {inquiry.id}; effective {rule.effectiveDate ?? 'placeholder'}; source {rule.sourceUri ?? 'placeholder rule library link'}.</p><small>Rule references inform human steward review only; the UI does not apply rules to official rulings.</small></article>)}
        <p>Rule references require audit-backed citations and remain read-only context; the panel never calculates or issues official findings.</p>
      </section>
      <section aria-label="Steward decision draft panel">
        <h3>Decision Draft Panel</h3>
        {drafts.map(({ draft }) => <article key={draft.id}><ApprovalChip status="pending-approval" /><strong>{draft.recommendation}</strong><p>Author {draft.authorRole} {draft.authorId}; AI {String(draft.aiGenerated)}; official ruling {String(draft.officialRuling)}.</p><p>Evidence {draft.evidenceIds.join(', ') || 'pending'}; rules {draft.ruleIds.join(', ') || 'pending'}.</p><p>{draft.rationale}</p></article>)}
        {organizations.length ? organizations.map(({ organization }) => <article key={organization.id}><strong>{organization.id}: AI evidence organization</strong><p>Generated by {organization.generatedBy}; official ruling {String(organization.officialRuling)}; may modify official results {String(organization.mayModifyOfficialResults)}.</p><p>{organization.clusters.map((cluster) => `${cluster.title}: ${cluster.summary}`).join(' ')}</p><p>Missing evidence: {organization.missingEvidence.join(', ') || 'none reported'}.</p><p>Limitations: {organization.limitations.join(' ')}</p></article>) : <p>No AI organization artifact is attached. AI organization is allowed only for evidence grouping, not rulings.</p>}
      </section>
      <section aria-label="Steward appeal package placeholder">
        <h3>Appeal Package Placeholder</h3>
        {appealPackages.length ? appealPackages.map(({ inquiry, pkg }) => <article key={pkg.id}><strong>{pkg.id}</strong><p>Inquiry {inquiry.id}; evidence {(pkg.contents.evidenceIds ?? []).join(', ') || 'pending'}; rules {(pkg.contents.ruleIds ?? []).join(', ') || 'pending'}; audit records {pkg.contents.auditRecordIds.join(', ') || 'pending export'}.</p><p>Workflows {(pkg.contents.workflowInstanceIds ?? []).join(', ') || 'pending'}; approvals {(pkg.contents.approvalRequestIds ?? []).join(', ') || 'pending'}; events {(pkg.contents.eventTypes ?? []).join(', ') || 'pending'}.</p><p>{pkg.contents.guardrailStatement ?? 'AI may not issue official rulings.'}</p></article>) : <p>No appeal package exported yet; this placeholder labels the future package action and preserves evidence, rules, drafts, rulings, custody records, approvals, events, workflow IDs, and audit hashes for human review.</p>}
      </section>
      <section aria-label="Steward human-only final ruling controls">
        <h3>Human-Only Final Ruling Controls</h3>
        <p>Final ruling controls are visible for steward workflow planning only. They do not mutate local official decisions and stay disabled unless the live backend verifies human steward authority, approval state, audit completeness, event emission, and officialResultsModified=false.</p>
        <button type="button" disabled aria-label="Save steward decision draft placeholder">Save draft placeholder</button>
        <SafetyCriticalActionButton approvalsSatisfied={finalizationAllowed} backendLive={data.mode === 'live'} authenticated={authenticated && humanFinalizationRole} reason={finalizationReason} describedById="steward-final-ruling-lock" ariaLabel="Issue final ruling requires live human steward verification">Issue final ruling (live verified human steward only)</SafetyCriticalActionButton>
        <button type="button" disabled aria-label="Export steward appeal package placeholder">Export appeal package placeholder</button>
        <p>Human steward role present: {String(humanFinalizationRole)}; approval/audit/event prerequisites complete: {String(finalizationPrerequisites)}; backend mode {data.mode}; canFinalize permission {String(data.stewardCenter.permissions.canFinalize)}.</p>
      </section>
      <section aria-label="Steward approval audit event telemetry">
        <h3>Approval, Audit, Event, Workflow, and Observability Telemetry</h3>
        {inquiries.map((inquiry) => <article key={`${inquiry.id}-integrations`}><strong>{inquiry.id}</strong><p>Audit {(inquiry.integrations?.auditRecordIds ?? inquiry.auditRecords.map((audit) => audit.id)).join(', ') || 'pending'}; events {(inquiry.integrations?.eventTypes ?? []).join(', ') || 'pending'}; approvals {(inquiry.integrations?.approvalRequestIds ?? []).join(', ') || 'pending'}.</p><p>Workflow {(inquiry.integrations?.workflowInstanceIds ?? []).join(', ') || 'pending'}; evidence vault {(inquiry.integrations?.evidenceVaultRecordIds ?? []).join(', ') || 'pending'}; twins {(inquiry.integrations?.digitalTwinRefs ?? []).join(', ') || 'none'}.</p><p>Signals {(inquiry.integrations?.observabilitySignals ?? []).map((signal) => `${signal.name}:${signal.severity}`).join(', ') || 'pending'}</p></article>)}
      </section>
      <section aria-label="Steward audit records">
        <h3>Audit Records</h3>
        {inquiries.flatMap((inquiry) => inquiry.auditRecords).map((audit) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.actorId}; {audit.action}; subject {audit.subjectId}; previous {audit.previousHash}</p></article>)}
      </section>
    </section>
  );
}

function navBadgeText(badge: NavBadge): string {
  return badge.value === undefined ? badge.label : `${badge.label} ${badge.value}`;
}

function NavRouteBadge({ badge }: { badge: NavBadge }) {
  return <span className="nav-route-badge" data-badge-id={badge.id} data-tone={badge.tone} aria-label={badge.ariaLabel ?? navBadgeText(badge)}>{navBadgeText(badge)}</span>;
}

function handleNavigationKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const group = event.currentTarget.closest('[data-nav-group]');
  const links = Array.from(group?.querySelectorAll<HTMLAnchorElement>('a[data-route-id]') ?? []);
  if (!links.length) return;
  event.preventDefault();
  const currentIndex = Math.max(0, links.indexOf(event.currentTarget));
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : event.key === 'ArrowDown' ? Math.min(currentIndex + 1, links.length - 1) : Math.max(currentIndex - 1, 0);
  links[nextIndex]?.focus();
}

function NavigationGroupLinks({ group, path, collapsed = false, badgesByRouteId = {} }: { group: NavGroup; path: string; collapsed?: boolean; badgesByRouteId?: NavBadgeMap }) {
  const active = groupHasActiveItem(path, group);
  return (
    <section key={group.section.id} aria-label={`${group.section.label} navigation group`} data-nav-group={group.section.id} data-active={active} role="group" aria-roledescription="navigation group">
      <h2 id={`nav-group-${group.section.id}`}>{group.section.label}</h2>
      <ul role="list" aria-labelledby={`nav-group-${group.section.id}`}>
        {group.items.map((item) => {
          const state = navLinkState(path, item);
          const badges = routeBadgesForItem(item, badgesByRouteId);
          return (
            <li key={item.id}>
              <a href={item.path} aria-current={state.ariaCurrent} aria-label={`${item.label} navigation link`} aria-describedby={`nav-badges-${item.id}`} aria-keyshortcuts="ArrowDown ArrowUp Home End" data-active={state.active} data-route-id={item.id} data-section={group.section.id} data-workspace-group={item.workspaceGroup} data-icon-key={item.iconKey} data-readiness-status={item.readinessStatus} data-badge-count={badges.length} data-badge-source={item.badgeSource.dynamic.join(' ')} data-data-state={item.dataState.mode} data-safety-posture={item.safetyPosture.posture} data-safety-critical={item.safetyPosture.safetyCritical} data-required-permissions={item.requiredPermissions.join(' ')} tabIndex={state.tabIndex} onKeyDown={handleNavigationKeyDown}>
                {collapsed ? <><span aria-hidden="true">{item.label.slice(0, 2)}</span><span className="sr-only">{item.label}</span></> : <span>{item.label}</span>}
                <span id={`nav-badges-${item.id}`} className="nav-route-badges" aria-label={`${item.label} route badges`}>
                  {badges.map((badge) => <NavRouteBadge key={badge.id} badge={badge} />)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MobileNavigationDrawer({ groups, path, open, badgesByRouteId = {} }: { groups: NavGroup[]; path: string; open: boolean; badgesByRouteId?: NavBadgeMap }) {
  return (
    <details className="mobile-nav-drawer" aria-label="Mobile navigation drawer" open={open} data-open={open}>
      <summary aria-label="Toggle mobile navigation" aria-expanded={open} aria-controls="mobile-navigation-panel">Menu</summary>
      <nav id="mobile-navigation-panel" aria-label="Mobile navigation" aria-orientation="vertical">
        {groups.map((group) => <details key={group.section.id} open={groupHasActiveItem(path, group)} data-active={groupHasActiveItem(path, group)}><summary>{group.section.label}</summary>{NavigationGroupLinks({ group, path, badgesByRouteId })}</details>)}
      </nav>
    </details>
  );
}

export function CommandCenter({ data, roles, authenticated = true, tenantId = 'saratoga', path = '/operations', serviceState = 'online', paletteQuery = '', navCollapsed = false, mobileNavOpen = false, user = { name: 'Avery Chen', title: 'Race Day Commander', roles } }: { data: Awaited<ReturnType<typeof loadCommandCenter>>; roles: Role[]; authenticated?: boolean; tenantId?: string; path?: string; serviceState?: ServiceState; paletteQuery?: string; navCollapsed?: boolean; mobileNavOpen?: boolean; user?: UserProfile }) {
  const nav = visibleNavItems(roles);
  const navGroups = groupedVisibleNavItems(roles);
  const visibleIds = new Set(nav.map((item) => item.id));
  const canShowApprovalShortcut = visibleIds.has('approvals') && !roles.includes('read-only-auditor');
  const tenant = selectTenant(tenantId);
  const banner = serviceBanner(serviceState, data.mode === 'mock');
  const breadcrumbs = breadcrumbForPath(path);
  const legacyRouteAlias = routeAliasForPath(path);
  const canonicalPath = canonicalPathForRoute(path);
  const matchedScreen = domainScreens.find((screen) => isWorkspacePathActive(canonicalPath, screen.route));
  const routeNotFound = matchedScreen === undefined;
  const activeScreen = matchedScreen ?? domainScreens.find((screen) => screen.id === 'operations')!;
  const activeWorkspaceId = routeNotFound ? 'not-found' : activeScreen.id;
  const canViewActiveWorkspace = !routeNotFound && visibleIds.has(activeScreen.id);
  const activeNavLabel = routeNotFound ? 'Route not found' : nav.find((item) => item.id === activeWorkspaceId)?.label ?? activeScreen.title;
  const showWorkspace = (...ids: string[]) => canViewActiveWorkspace && ids.includes(activeWorkspaceId);
  const paletteItems = filterCommandPalette(paletteQuery, roles);
  const canExecute = isSafetyCriticalEnabled({ authenticated, hasApprovalToken: false, backendMode: data.mode });
  const canViewSensitiveSecurity = authenticated && roles.some((role) => hasPermission(role, 'security:manage'));
  const workforceOperations = data.workforceOperations ?? fallbackWorkforceOperations(data.mode === 'mock');
  const collaborationIncident = data.securityOperations.incidents[0];
  const collaborationIncidentInvestigation = collaborationIncident ? data.securityOperations.investigations.find((item) => item.incidentId === collaborationIncident.id) : undefined;
  const collaborationIncidentEscalation = collaborationIncident ? data.securityOperations.escalations.find((item) => item.incidentId === collaborationIncident.id) : undefined;
  const collaborationIncidentTwinRefs = [
    ...data.securityOperations.restrictedZones.filter((zone) => zone.id === collaborationIncident?.zoneId).flatMap((zone) => zone.twinId ? [zone.twinId] : []),
    ...data.securityOperations.twinUpdates.filter((update) => update.sourceId === collaborationIncident?.id || collaborationIncident?.eventIds.includes(update.eventId ?? '')).map((update) => update.twinId),
    ...data.securityOperations.assetRegistryLinks.filter((link) => link.sourceId === collaborationIncident?.zoneId).flatMap((link) => link.twinId ? [link.twinId] : []),
  ];
  const pendingApprovalCount = data.approvals.filter((approval) => approval.status === 'pending-approval' || approval.status === 'pending').length;
  const assetHealth = data.trackMap.assets.reduce<Record<string, number>>((summary, asset) => ({ ...summary, [asset.status]: (summary[asset.status] ?? 0) + 1 }), {});
  const twinHealth = data.digitalTwinState.reduce<Record<string, number>>((summary, twin) => ({ ...summary, [twin.health]: (summary[twin.health] ?? 0) + 1 }), {});
  const sourceLabel = (source: string) => {
    if (source === 'service') return 'backend service feed';
    if (source === 'event-stream') return 'event stream feed';
    if (source === 'digital-twin') return 'Digital Twin runtime';
    if (source === 'approved-mock-adapter') return 'approved mock placeholder';
    return source;
  };
  const notificationItems = [
    { id: 'service-state', title: 'Service posture', detail: banner.message, tone: banner.tone === 'ok' ? 'ok' as const : banner.tone },
    ...data.operations.alerts.map((alert) => ({ id: alert.id, title: alert.title, detail: `${alert.severity}; evidence ${alert.evidence.join(', ')}; action ${alert.actionPath}`, tone: alert.severity === 'critical' ? 'critical' as const : alert.severity === 'warning' ? 'warning' as const : 'info' as const })),
    ...data.readiness.warnings.slice(0, 2).map((warning) => ({ id: warning.id, title: `${warning.domain} readiness`, detail: `${warning.message} Recommended action: ${warning.recommendedAction}`, tone: warning.severity === 'critical' ? 'critical' as const : warning.severity === 'warning' ? 'warning' as const : 'info' as const })),
  ];
  const activeEmergencyCritical = data.emergencyOperations.activeEmergencyStatus.toLowerCase().includes('critical');
  const navBadges: NavBadgeMap = {
    operations: [{ id: 'operations:alerts', label: 'Alerts', value: data.operations.alerts.length, tone: data.operations.alerts.length ? 'warning' : 'info', ariaLabel: `${data.operations.alerts.length} operations alerts` }],
    approvals: [{ id: 'approvals:pending', label: 'Pending', value: pendingApprovalCount, tone: pendingApprovalCount ? 'warning' : 'info', ariaLabel: `${pendingApprovalCount} pending approvals` }],
    stewards: [{ id: 'stewards:open', label: 'Open', value: data.stewardCenter.inquiries.length, tone: data.stewardCenter.inquiries.length ? 'warning' : 'info', ariaLabel: `${data.stewardCenter.inquiries.length} steward inquiries open` }],
    security: [{ id: 'security:alerts', label: 'Alerts', value: data.securityOperations.dashboard.activeAlerts, tone: data.securityOperations.dashboard.activeAlerts ? 'critical' : 'info', ariaLabel: `${data.securityOperations.dashboard.activeAlerts} security alerts` }],
    emergency: [{ id: 'emergency:events', label: 'Events', value: data.emergencyOperations.events.length, tone: activeEmergencyCritical ? 'critical' : data.emergencyOperations.events.length ? 'warning' : 'info', ariaLabel: `${data.emergencyOperations.events.length} emergency events` }],
    equine: [{ id: 'equine:reviews', label: 'Vet', value: data.equineIntelligence.observability?.pendingVeterinarianReviews ?? 0, tone: (data.equineIntelligence.observability?.pendingVeterinarianReviews ?? 0) ? 'warning' : 'info', ariaLabel: `${data.equineIntelligence.observability?.pendingVeterinarianReviews ?? 0} veterinarian reviews pending` }],
    'api-hub': [{ id: 'api-hub:deep-links', label: 'Areas', value: apiHubDeepLinks.length, tone: 'info', ariaLabel: `${apiHubDeepLinks.length} API Hub subworkspace links` }],
    'platform-health': [{ id: 'platform-health:frontend', label: 'FE', value: data.platformHealth.frontend.reportedErrors, tone: data.platformHealth.frontend.degradedMode ? 'warning' : 'info', ariaLabel: `${data.platformHealth.frontend.reportedErrors} frontend reported errors` }],
  };
  const raceDayIndicators = [
    { label: 'Readiness', value: `${data.readiness.averageScore}`, detail: `${data.readiness.ready} ready / ${data.readiness.watch} watch / ${data.readiness.blocked} blocked` },
    { label: 'Pending approvals', value: String(pendingApprovalCount), detail: 'Human approval required before protected execution' },
    { label: 'Surface score', value: String(data.surfaceIntelligence.overallScore), detail: data.surfaceIntelligence.approvalState },
    { label: 'Twin sync', value: String(data.platformHealth.digitalTwin.queuedSync), detail: `${data.platformHealth.digitalTwin.degraded} degraded twins` },
  ];
  const executiveKpis = [
    { label: 'Safety KPI', value: String(Math.max(0, 100 - data.emergencyOperations.events.length * 5)), detail: data.emergencyOperations.activeEmergencyStatus },
    { label: 'Operations KPI', value: String(data.readiness.averageScore), detail: `Race-day status ${data.readiness.races[0]?.status ?? 'unknown'}` },
    { label: 'Compliance KPI', value: String(data.complianceLibrary.readiness.score), detail: `${data.complianceLibrary.readiness.openFindings} open findings` },
    { label: 'AI KPI', value: String(data.platformHealth.aiGovernance.activeAgents), detail: `${data.platformHealth.aiGovernance.blockedActions} blocked actions` },
    { label: 'Asset KPI', value: String(data.trackMap.assets.length), detail: Object.entries(assetHealth).map(([status, count]) => `${status}:${count}`).join(', ') || 'no assets' },
    { label: 'Platform KPI', value: data.platformHealth.overallStatus, detail: `p95 ${data.platformHealth.apiLatency.p95Ms}ms` },
    { label: 'Revenue KPI', value: 'Not connected', detail: 'No revenue backend DTO is loaded in this read-only center' },
  ];
  const rosStandardization = data.platformHealth.rosStandardization ?? fallbackRosStandardization(data.platformHealth.generatedAt, data.mode === 'mock');
  const platformKpis = platformKpiDashboardItems(data.platformHealth, data.readiness.averageScore);
  const platformTrends = platformTrendCards(data.platformHealth, data.readiness.averageScore);
  const apiHubMetadata = createRacingDataApiHubServiceMetadata(data.platformHealth.generatedAt);
  const platformDrillDownRows = [
    { id: 'service-health', area: 'Service health', status: data.platformHealth.overallStatus, value: serviceHealthSummary(data.platformHealth), route: '/platform-health/services', source: 'PlatformHealthWorkspaceDto.services' },
    { id: 'event-throughput', area: 'Event throughput', status: data.platformHealth.eventBus.status, value: `${data.platformHealth.eventBus.eventsPerMinute}/min`, route: '/platform-health/events', source: 'PlatformHealthWorkspaceDto.eventBus' },
    { id: 'workflow-metrics', area: 'Workflow metrics', status: data.platformHealth.workflows.status, value: `${data.platformHealth.workflows.active} active / ${data.platformHealth.workflows.failed} failed`, route: '/platform-health/workflows', source: 'PlatformHealthWorkspaceDto.workflows' },
    { id: 'approval-queue', area: 'Approval queue metrics', status: data.platformHealth.approvalEngine.status, value: `${data.platformHealth.approvalEngine.pending} pending / ${data.platformHealth.approvalEngine.escalated} escalated`, route: '/approvals', source: 'PlatformHealthWorkspaceDto.approvalEngine' },
    { id: 'audit-volume', area: 'Audit volume', status: data.platformHealth.audit.status, value: `${data.platformHealth.audit.records} records / ${data.platformHealth.audit.criticalRecords} critical`, route: '/audit', source: 'PlatformHealthWorkspaceDto.audit' },
    { id: 'twin-sync', area: 'Digital Twin sync status', status: data.platformHealth.digitalTwin.status, value: `${data.platformHealth.digitalTwin.queuedSync} queued / ${data.platformHealth.digitalTwin.critical} critical`, route: '/digital-twin', source: 'PlatformHealthWorkspaceDto.digitalTwin' },
    { id: 'ai-health', area: 'AI control plane health', status: data.platformHealth.aiGovernance.status, value: `${data.platformHealth.aiGovernance.inputThroughput} inputs / ${data.platformHealth.aiGovernance.recommendationCount} recommendations / ${data.platformHealth.aiGovernance.blockedActionCount} blocked`, route: '/ai-governance', source: 'PlatformHealthWorkspaceDto.aiGovernance' },
    { id: 'frontend-errors', area: 'Frontend error reporting', status: data.platformHealth.frontend.status, value: `${data.platformHealth.frontend.reportedErrors} reported / degraded ${String(data.platformHealth.frontend.degradedMode)}`, route: '/platform-health/frontend', source: 'PlatformHealthWorkspaceDto.frontend' },
  ];
  const serviceDependencyRows = data.platformHealth.services.flatMap((service) => service.dependencies.length ? service.dependencies.map((dependency) => ({ id: `${service.serviceId}-${dependency.id}`, serviceId: service.serviceId, dependencyId: dependency.id, serviceStatus: service.status, dependencyStatus: dependency.status, required: dependency.required, latencyMs: service.latencyMs, lastCheckedAt: service.lastCheckedAt })) : [{ id: `${service.serviceId}-none`, serviceId: service.serviceId, dependencyId: 'none', serviceStatus: service.status, dependencyStatus: service.status, required: false, latencyMs: service.latencyMs, lastCheckedAt: service.lastCheckedAt }]);
  const executiveTrends = [
    { label: 'Safety posture', value: executiveKpis[0].value, trend: `${data.emergencyOperations.events.length} emergency events; ${data.securityOperations.dashboard.activeAlerts} security alerts`, source: 'Emergency and Security Operations DTOs', coverage: 'Loaded governed operational feeds' },
    { label: 'Operational readiness', value: String(data.readiness.averageScore), trend: `${data.readiness.watch} watch / ${data.readiness.blocked} blocked`, source: 'RaceDayReadinessDashboardDto', coverage: 'Loaded race-day readiness feed' },
    { label: 'Platform health', value: data.platformHealth.overallStatus, trend: serviceHealthSummary(data.platformHealth), source: 'PlatformHealthWorkspaceDto', coverage: 'Loaded platform health DTO' },
    { label: 'Event throughput', value: `${data.platformHealth.eventBus.eventsPerMinute}/min`, trend: `${data.operations.liveEvents.length} visible command events`, source: 'PlatformHealthWorkspaceDto.eventBus and OperationsCommandCenterDto.liveEvents', coverage: 'DTO totals plus visible operations stream' },
    { label: 'Approval queue', value: String(data.platformHealth.approvalEngine.pending), trend: `${pendingApprovalCount} visible approvals in loaded queue`, source: 'PlatformHealthWorkspaceDto.approvalEngine and ApprovalDto[]', coverage: 'Platform totals plus loaded approval list' },
    { label: 'Audit volume', value: String(data.platformHealth.audit.records), trend: `${data.auditEvents.length} visible audit rows`, source: 'PlatformHealthWorkspaceDto.audit and AuditEventDto[]', coverage: 'Platform total plus loaded audit sample' },
    { label: 'Digital Twin sync', value: `${data.platformHealth.digitalTwin.queuedSync} queued`, trend: `${data.digitalTwinState.length} loaded read-only twins`, source: 'PlatformHealthWorkspaceDto.digitalTwin and DigitalTwinStateDto[]', coverage: 'DTO totals plus loaded twin list' },
    { label: 'AI control plane', value: data.platformHealth.aiGovernance.status ?? data.platformHealth.overallStatus, trend: `${data.platformHealth.aiGovernance.inputThroughput} inputs; ${data.platformHealth.aiGovernance.approvalRequiredCount} approval-required`, source: 'PlatformHealthWorkspaceDto.aiGovernance', coverage: 'Loaded platform health DTO' },
    { label: 'Revenue KPI', value: 'Not connected', trend: 'Revenue service is not part of the loaded backend contract', source: 'Unavailable in current DTO set', coverage: 'Excluded from executive rollups' },
  ] satisfies TrendCardItem[];
  const executiveDrillDownRows = [
    { id: 'safety', area: 'Safety KPIs', status: activeEmergencyCritical ? 'critical' : data.securityOperations.dashboard.activeAlerts ? 'degraded' : 'healthy', value: `${data.emergencyOperations.events.length} emergency events / ${data.securityOperations.dashboard.activeAlerts} security alerts`, route: '/safety', source: 'EmergencyOperationsDto + SecurityOperationsDto' },
    { id: 'operations', area: 'Operational readiness', status: data.readiness.blocked ? 'critical' : data.readiness.watch ? 'degraded' : 'healthy', value: `${data.readiness.averageScore} readiness / ${pendingApprovalCount} visible approvals`, route: '/operations', source: 'RaceDayReadinessDashboardDto + ApprovalDto[]' },
    { id: 'compliance', area: 'Compliance KPIs', status: data.complianceLibrary.readiness.openFindings ? 'degraded' : 'healthy', value: `${data.complianceLibrary.readiness.score} readiness / ${data.complianceLibrary.readiness.openFindings} findings`, route: '/compliance', source: 'ComplianceControlLibraryDto' },
    { id: 'assets', area: 'Asset health', status: data.platformHealth.digitalTwin.status, value: `${data.trackMap.assets.length} map assets / ${data.platformHealth.digitalTwin.degraded} degraded twins`, route: '/assets', source: 'TrackMapDto + PlatformHealthWorkspaceDto.digitalTwin' },
    { id: 'workflow', area: 'Workflow and approvals', status: data.platformHealth.approvalEngine.status, value: `${data.platformHealth.workflows.active} active workflows / ${data.platformHealth.approvalEngine.pending} queued approvals`, route: '/approvals', source: 'PlatformHealthWorkspaceDto.workflows + approvalEngine' },
    { id: 'ai', area: 'AI control plane safety', status: data.platformHealth.aiGovernance.status, value: `${data.platformHealth.aiGovernance.modelSelectionCount} model selections / ${data.platformHealth.aiGovernance.blockedActionCount} blocked actions`, route: '/ai-governance', source: 'PlatformHealthWorkspaceDto.aiGovernance' },
    { id: 'revenue', area: 'Revenue KPI', status: 'not connected', value: 'No wagering, attendance, finance, or revenue DTO loaded', route: '/executive', source: 'Explicit placeholder - unavailable in current contract' },
  ];
  const stewardInquiries = data.stewardCenter.inquiries;
  const stewardOpenObjections = stewardInquiries.flatMap((inq) => inq.objections).filter((objection) => !['dismissed', 'upheld'].includes(objection.status)).length;
  const activeRace = data.readiness.races[0];
  const operationsTimelineEvents = [
    ...data.operations.liveEvents.map((event) => ({ time: event.timestamp, label: `${event.domain}: ${event.summary}`, tone: event.severity })),
    ...data.readiness.events.map((event) => ({ time: event.timestamp, label: `readiness: ${event.message}`, tone: event.severity })),
    ...data.emergencyOperations.events.map((event) => ({ time: event.timestamp, label: `emergency: ${event.type} ${event.subjectId}`, tone: event.severity })),
    ...data.aiGovernance.events.map((event) => ({ time: event.timestamp, label: `ai: ${event.type} ${event.subjectId}`, tone: 'advisory' })),
  ];
  const streamingSnapshot = buildStreamingDataSnapshot({ source: data.stream, events: data.operations.liveEvents, health: data.platformHealth, fallbackUpdatedAt: data.operations.generatedAt });
  const registryHorse = data.equineIntelligence.horse;
  const equineTransportationRecords = data.equineIntelligence.transportationRecords ?? [];
  const equineWelfareRecords = data.equineIntelligence.welfareRecords ?? [];
  const equineEligibilityRules = data.equineIntelligence.eligibilityRules ?? [];
  const equineRelationships = data.equineIntelligence.relationships ?? [];
  const equineObservability = data.equineIntelligence.observability ?? { pendingVeterinarianReviews: 0, openApprovals: 0, auditRecords: 0, eventCount: 0, twinStates: 0, advisoryRecommendations: 0 };
  const equineIntegrations = data.equineIntelligence.integrations ?? { barn: false, raceOffice: false, audit: false, eventBus: false, approvals: false, digitalTwin: false, observability: false };
  const equinePrivacy = data.equineIntelligence.privacy ?? { tenantId: registryHorse.tenantId ?? tenant.id, veterinaryRecordsVisible: 0, veterinaryRecordsRedacted: 0 };
  const registryOccupancy = data.barnOperations.occupancy.find((occupancy) => occupancy.horseId === registryHorse.horseId);
  const registryStall = registryOccupancy ? data.barnOperations.stalls.find((stall) => stall.id === registryOccupancy.stallId) : undefined;
  const barnDashboard = data.barnOperations.dashboard ?? {
    totalBarns: data.barnOperations.barns.length,
    totalStalls: data.barnOperations.stalls.length,
    occupiedStalls: data.barnOperations.stalls.filter((stall) => stall.status === 'occupied').length,
    availableStalls: data.barnOperations.stalls.filter((stall) => stall.status === 'available').length,
    restrictedStalls: data.barnOperations.stalls.filter((stall) => stall.status === 'restricted').length,
    maintenanceStalls: data.barnOperations.stalls.filter((stall) => stall.status === 'maintenance').length,
    occupancyRate: data.barnOperations.stalls.length ? Math.round((data.barnOperations.stalls.filter((stall) => stall.status === 'occupied').length / data.barnOperations.stalls.length) * 100) : 0,
    readinessStatus: data.barnOperations.readiness.some((ready) => ready.status === 'restricted') ? 'restricted' : data.barnOperations.readiness.some((ready) => ready.status === 'watch') ? 'watch' : 'ready',
    openRestrictions: data.barnOperations.restrictions.filter((restriction) => restriction.active).length,
    pendingApprovals: 0,
    eventCount: data.barnOperations.movements.length + data.barnOperations.access.length + data.barnOperations.inspections.length + data.barnOperations.restrictions.length,
    auditRecordCount: data.barnOperations.movements.length + data.barnOperations.access.length + data.barnOperations.inspections.length + data.barnOperations.restrictions.length + data.barnOperations.trainers.length + data.barnOperations.vetVisits.length,
    twinSyncCount: data.barnOperations.occupancy.length,
    assetCount: data.barnOperations.barns.length + data.barnOperations.stalls.length,
    latestMovementAt: data.barnOperations.movements.map((movement) => movement.movedAt).sort().at(-1),
  };
  const barnFacilityReadiness = data.barnOperations.facilityReadiness ?? data.barnOperations.readiness.map((ready) => ({ ...ready, inspectionStatus: data.barnOperations.inspections.some((inspection) => inspection.barnId === ready.barnId) ? 'current' : 'missing', approvalRequired: ready.openRestrictions > 0 || ready.status !== 'ready', workflowStatus: 'not-started', twinIds: data.barnOperations.occupancy.filter((occupancy) => occupancy.barnId === ready.barnId).map((occupancy) => occupancy.twinId), assetIds: [`barn:${ready.barnId}`] }));
  const barnAssetLinks: Array<{ assetId: string; barnId: string; stallId?: string; twinId: string; registryStatus: string; riskLevel: string; eventId?: string; auditId?: string }> = data.barnOperations.assetLinks ?? data.barnOperations.barns.map((barn) => ({ assetId: `barn:${barn.id}`, barnId: barn.id, twinId: `barn:${barn.id}`, registryStatus: 'mock-derived', riskLevel: barn.status === 'ready' ? 'medium' : 'high' }));
  const barnTwinSync = data.barnOperations.twinSync ?? data.barnOperations.occupancy.map((occupancy) => ({ twinId: occupancy.twinId, horseId: occupancy.horseId, barnId: occupancy.barnId, stallId: occupancy.stallId, status: 'queued', patch: { barnId: occupancy.barnId, stallId: occupancy.stallId }, eventId: occupancy.eventId, auditId: occupancy.auditId }));
  const barnApprovalRequests = data.barnOperations.approvalRequests ?? [];
  const barnEvents = data.barnOperations.events ?? [];
  const activeTrainer = data.equineIntelligence.trainerAssignments.find((trainer) => trainer.licenseStatus === 'active') ?? data.equineIntelligence.trainerAssignments[0];
  const activeBarnTrainer = activeTrainer ? data.barnOperations.trainers.find((trainer) => trainer.trainerId === activeTrainer.trainerId && trainer.active) : undefined;
  const horseMovements = data.barnOperations.movements.filter((movement) => movement.horseId === registryHorse.horseId);
  const horseVetVisits = data.barnOperations.vetVisits.filter((visit) => visit.horseId === registryHorse.horseId);
  const pendingVeterinarianRecommendations = data.equineIntelligence.aiRiskRecommendations.filter((rec) => rec.veterinarianReviewRequired && rec.status !== 'veterinarian-reviewed' && rec.status !== 'operationalized');
  const veterinarianReviewRequired = data.equineIntelligence.veterinaryStatus.requiresVeterinarian || pendingVeterinarianRecommendations.length > 0 || data.equineIntelligence.eligibilityStatus.failedRules.includes('veterinarian-review-required');
  const equineBarnAligned = Boolean(registryOccupancy && registryOccupancy.barnId === data.equineIntelligence.barnAssignment.barnId && (registryOccupancy.stallId === data.equineIntelligence.barnAssignment.stallId || registryStall?.label === data.equineIntelligence.barnAssignment.stallId));
  const equineBarnWarnings = [
    ...(veterinarianReviewRequired ? [{ id: 'vet-review-required', title: 'Veterinarian review required', detail: `Health AI remains advisory; ${pendingVeterinarianRecommendations.length || 1} item requires licensed veterinarian review before operations change.`, tone: 'warning' as const }] : []),
    ...(!data.equineIntelligence.eligibilityStatus.eligible ? [{ id: 'eligibility-under-review', title: 'Eligibility under review', detail: `Compliance ${data.equineIntelligence.eligibilityStatus.complianceStatus}; failed rules ${data.equineIntelligence.eligibilityStatus.failedRules.join(', ') || 'none'}.`, tone: 'warning' as const }] : []),
    ...(data.equineIntelligence.welfareStatus.level !== 'acceptable' ? [{ id: 'welfare-watch', title: 'Welfare watch', detail: `Welfare level ${data.equineIntelligence.welfareStatus.level}; interventions ${data.equineIntelligence.welfareStatus.interventions.join(', ') || 'none'}.`, tone: 'critical' as const }] : []),
    ...(!equineBarnAligned ? [{ id: 'barn-registry-mismatch', title: 'Barn registry mismatch', detail: `Equine assignment ${data.equineIntelligence.barnAssignment.barnId}/${data.equineIntelligence.barnAssignment.stallId ?? 'unknown'} does not match Barn Operations occupancy ${registryOccupancy?.barnId ?? 'missing'}/${registryOccupancy?.stallId ?? 'missing'}.`, tone: 'warning' as const }] : []),
    ...(!activeBarnTrainer ? [{ id: 'trainer-cross-check', title: 'Trainer assignment needs cross-check', detail: `${activeTrainer?.trainerName ?? 'No active trainer'} is not mirrored as an active Barn Operations trainer assignment.`, tone: 'warning' as const }] : []),
  ];
  const harmonizedEquineBarnWarnings = equineBarnWarnings.length ? equineBarnWarnings : [{ id: 'equine-barn-clear', title: 'Registry and barn view aligned', detail: 'Horse Registry, stall occupancy, trainer assignment, welfare, and eligibility are aligned for the current read-only view.', tone: 'ok' as const }];
  const geospatialFeatures = data.trackMap.geospatial?.features ?? [];
  const featuresByLayer = (layer: string) => geospatialFeatures.filter((feature) => feature.layer === layer);
  const geospatialTwinStates = data.trackMap.geospatial?.digitalTwinState ?? [];
  const simulationOverlays = data.trackMap.geospatial?.simulationOverlays ?? [];
  const twinFeatures = geospatialFeatures.filter((feature) => feature.layer === 'twin' || feature.layer === 'digital-twin');
  const twinRuntimeByAsset = new Map(data.digitalTwinState.map((twin) => [twin.assetId, twin]));
  const twinMapStateByAsset = new Map(geospatialTwinStates.map((twin) => [twin.assetId, twin]));
  const twinTenantScope = `${tenant.id}:${data.trackMap.trackId}`;
  const tusStandard = data.tusStandardization;
  const tusAssetSchemaFields = ['assetId','assetType','assetCategory','location','state','health','risk','telemetry','approvals','audit'];
  const tusTwinTypes = [...new Set(tusStandard.twins.map((twin) => twin.twinType))];
  const twinAssetRows = data.trackMap.assets.map((asset) => {
    const runtimeTwin = twinRuntimeByAsset.get(asset.id) ?? twinRuntimeByAsset.get(asset.sectorId) ?? data.digitalTwinState.find((twin) => twin.twinId.includes(asset.id) || twin.assetId === data.trackMap.trackId);
    const mapTwin = twinMapStateByAsset.get(asset.id) ?? twinMapStateByAsset.get(asset.sectorId) ?? geospatialTwinStates.find((twin) => twin.twinId.includes(asset.id) || twin.assetId === data.trackMap.trackId);
    const feature = geospatialFeatures.find((candidate) => candidate.id.includes(asset.id) || candidate.label === asset.label || candidate.properties.assetId === asset.id);
    const telemetry = data.trackMap.measurements.filter((measurement) => measurement.sectorId === asset.sectorId);
    return { asset, runtimeTwin, mapTwin, feature, telemetry };
  });
  const twinEventHistory = [
    ...data.operations.liveEvents.filter((event) => event.domain === 'assets' || event.domain === 'surface').map((event) => ({ time: event.timestamp, label: `${event.domain}: ${event.summary}`, tone: event.severity })),
    ...(data.trackMap.geospatial?.playback ?? []).map((frame) => ({ time: frame.at, label: `playback: ${frame.summary}; features ${frame.featureIds.join(', ')}`, tone: 'info' })),
    ...data.surfaceIntelligence.digitalTwinSync.map((sync) => ({ time: data.surfaceIntelligence.generatedAt, label: `${sync.twinId}: ${sync.status}; event ${sync.eventId}; audit ${sync.auditId}`, tone: sync.status === 'synced' ? 'info' : 'warning' })),
    ...data.securityOperations.twinUpdates.map((update) => ({ time: data.platformHealth.generatedAt, label: `${update.twinId}: security patch ${update.status}; source ${update.sourceId}; audit ${update.auditId}`, tone: update.status === 'published' ? 'info' : 'warning' })),
    ...(data.emergencyOperations.digitalTwinPatches ?? []).map((patch) => ({ time: patch.observedAt, label: `${patch.twinId}: emergency patch ${patch.status}; event ${patch.eventId ?? 'post-action evidence pending'}`, tone: 'critical' })),
    ...workforceOperations.digitalTwinSync.map((sync) => ({ time: workforceOperations.generatedAt, label: `${sync.twinId}: workforce sync ${sync.status}; event ${sync.eventId ?? 'pending'}; audit ${sync.auditId ?? 'pending'}`, tone: 'warning' })),
    ...(data.aiGovernance.digitalTwinImpacts ?? []).map((impact) => ({ time: data.aiGovernance.generatedAt, label: `${impact.twinId}: AI impact ${impact.kind}; approval required ${String(impact.approvalRequired)}; event ${impact.eventType}`, tone: impact.approvalRequired ? 'warning' : 'info' })),
  ];
  const twinRelationshipCards = [
    ...data.digitalTwinState.map((twin) => ({ source: twin.assetId, relationship: `has twin ${twin.twinId} health ${twin.health}`, target: `version ${twin.version}` })),
    ...data.trackMap.assets.map((asset) => ({ source: asset.label, relationship: `located in ${asset.sectorId}`, target: asset.status })),
    ...data.equineIntelligence.digitalTwinReferences.map((ref) => ({ source: data.equineIntelligence.horse.name, relationship: ref.relationship, target: ref.twinId })),
    ...tusStandard.assets.flatMap((asset) => asset.twin ? [{ source: asset.assetId, relationship: `TUS asset maps to ${asset.twin.relationship}`, target: asset.twin.twinId }] : []),
  ];
  const twinDependencyCards = [
    ...data.digitalTwinState.map((twin) => ({ source: twin.twinId, relationship: 'depends on runtime services', target: data.platformHealth.services.find((service) => service.serviceId === 'digital-twin-runtime')?.dependencies.map((dep) => `${dep.id}:${dep.status}${dep.required ? ':required' : ''}`).join(', ') || 'event-bus:required' })),
    ...data.trackMap.assets.map((asset) => ({ source: asset.id, relationship: 'depends on sector telemetry and asset registry', target: `${asset.sectorId}; ${asset.type}; ${asset.status}` })),
    ...data.surfaceIntelligence.digitalTwinSync.map((sync) => ({ source: sync.twinId, relationship: `sync gated by ${sync.status}`, target: `${sync.eventId} / ${sync.auditId}` })),
    ...workforceOperations.digitalTwinSync.map((sync) => ({ source: sync.twinId, relationship: 'assignment dependency', target: `${sync.assignmentId}; ${sync.status}` })),
  ];
  const twinAuditReferences = [
    ...data.surfaceIntelligence.digitalTwinSync.map((sync) => ({ id: `${sync.twinId}-surface-audit`, label: `${sync.twinId} surface sync`, detail: `Audit ${sync.auditId}; event ${sync.eventId}; patch keys ${Object.keys(sync.patch).join(', ')}` })),
    ...data.securityOperations.twinUpdates.map((update) => ({ id: `${update.twinId}-${update.auditId}`, label: `${update.twinId} security update`, detail: `Audit ${update.auditId}; source ${update.sourceId}; status ${update.status}` })),
    ...workforceOperations.digitalTwinSync.map((sync) => ({ id: `${sync.twinId}-${sync.assignmentId}`, label: `${sync.twinId} workforce sync`, detail: `Audit ${sync.auditId ?? 'pending'}; event ${sync.eventId ?? 'pending'}; patch keys ${Object.keys(sync.patch).join(', ')}` })),
    ...(data.aiGovernance.digitalTwinImpacts ?? []).map((impact) => ({ id: `${impact.twinId}-${impact.recommendationId}`, label: `${impact.twinId} AI impact`, detail: `Audit ${impact.auditId ?? 'pending'}; event ${impact.eventType}; approval required ${String(impact.approvalRequired)}` })),
    ...tusStandard.assets.flatMap((asset) => asset.audit.map((audit) => ({ id: `${asset.assetId}-${audit.id}`, label: `${asset.assetId} TUS audit`, detail: `${audit.action} by ${audit.actor}; evidence ${audit.evidence.join(', ') || 'none'}` }))),
  ];
  const facilityFeatures = featuresByLayer('facility');
  const workforceFeatures = featuresByLayer('workforce');
  const facilityWarnings = data.readiness.warnings.filter((warning) => warning.domain === 'facility');
  const employeeNameById = new Map(workforceOperations.employees.map((employee) => [employee.identity.id, employee.identity.displayName]));
  const facilityApprovalActions = commandCenterApprovalActions().filter((action) => ['facility-work-order', 'return-to-service'].includes(action.id));
  const workforceApprovalActions = commandCenterApprovalActions().filter((action) => action.id === 'emergency-staffing');
  const expiringCertifications = workforceOperations.compliance.expiringCertifications as WorkforceOperationsDto['certifications'];
  const expiredCertifications = workforceOperations.compliance.expiredCertifications as WorkforceOperationsDto['certifications'];
  const overdueTraining = workforceOperations.compliance.overdueTraining as WorkforceOperationsDto['trainingRecords'];
  const trainingAlertRows = [
    ...expiringCertifications.map((cert) => ({ id: `expiring-${cert.id}`, title: `${employeeNameById.get(cert.identityId) ?? cert.identityId} ${cert.kind}`, status: 'expiring', detail: `Certification expires ${cert.expiresAt}; roles ${cert.requiredForRoles.join(', ')}`, evidence: cert.evidence })),
    ...expiredCertifications.map((cert) => ({ id: `expired-${cert.id}`, title: `${employeeNameById.get(cert.identityId) ?? cert.identityId} ${cert.kind}`, status: 'expired', detail: `Certification expired ${cert.expiresAt}; roles ${cert.requiredForRoles.join(', ')}`, evidence: cert.evidence })),
    ...overdueTraining.map((record) => ({ id: `overdue-${record.id}`, title: `${employeeNameById.get(record.identityId) ?? record.identityId} ${record.title}`, status: 'overdue', detail: `Training due ${record.dueAt}; roles ${record.requiredForRoles.join(', ')}`, evidence: record.evidence })),
  ];
  const facilityInspectionRows = [
    ...data.facilitiesMaintenance.inspections.map((inspection) => ({ id: inspection.id, title: `${inspection.assetId} inspection`, status: inspection.status, source: 'facilities-maintenance', detail: `Score ${inspection.score}; next due ${inspection.nextInspectionDueAt}; findings ${inspection.findings.join(', ') || 'none'}; twin ${inspection.twinId ?? 'pending'}`, evidence: [inspection.eventId, inspection.auditId], incomplete: false })),
    ...facilityFeatures.map((feature) => ({ id: `${feature.id}-inspection`, title: feature.label, status: feature.status, source: feature.source, detail: `Map overlay inspection ${propertyText(feature.properties, 'inspection')}; readiness ${propertyText(feature.properties, 'readinessStatus')}; maintenance ${propertyText(feature.properties, 'maintenanceStatus')}`, evidence: [`feature:${feature.id}`, ...facilityWarnings.flatMap((warning) => warning.evidence)], incomplete: !data.facilitiesMaintenance.inspections.some((inspection) => `facility:${inspection.assetId}` === feature.id) })),
    ...data.barnOperations.inspections.map((inspection) => ({ id: inspection.id, title: `${inspection.barnId} inspection`, status: inspection.status, source: 'barn-operations', detail: `Score ${inspection.score}; findings ${inspection.findings.join(', ')}`, evidence: [inspection.eventId, inspection.auditId], incomplete: false })),
  ];
  const certificationTrainingRows = [
    ...workforceOperations.certifications.map((cert) => ({ id: cert.id, title: `${employeeNameById.get(cert.identityId) ?? cert.identityId} ${cert.kind}`, status: cert.status, source: 'workforce-operations', detail: `Expires ${cert.expiresAt}; roles ${cert.requiredForRoles.join(', ')}; event ${cert.eventId ?? 'pending'}; audit ${cert.auditId ?? 'pending'}`, evidence: cert.evidence, incomplete: false })),
    ...workforceOperations.trainingRecords.map((record) => ({ id: record.id, title: `${employeeNameById.get(record.identityId) ?? record.identityId} ${record.title}`, status: record.status, source: 'workforce-operations', detail: `Due ${record.dueAt}; roles ${record.requiredForRoles.join(', ')}; event ${record.eventId ?? 'pending'}; audit ${record.auditId ?? 'pending'}`, evidence: record.evidence, incomplete: false })),
    ...data.securityOperations.credentialChecks.map((check) => ({ id: check.id, title: `${check.holderDisplayName} credential`, status: check.status === 'expired' ? 'warning' : 'nominal', source: 'security-operations', detail: `Decision ${check.decision}; checked ${check.checkedAt}`, evidence: [check.auditId], incomplete: false })),
    ...data.emergencyOperations.drills.map((drill) => ({ id: drill.id, title: `${drill.scenario} drill`, status: 'nominal', source: 'emergency-operations', detail: `Participants ${drill.participants.join(', ')}; success criteria ${drill.successCriteria.join(', ')}`, evidence: [`drill:${drill.id}`], incomplete: false })),
    ...data.equineIntelligence.trainerAssignments.map((trainer) => ({ id: trainer.trainerId, title: `${trainer.trainerName} license`, status: trainer.licenseStatus === 'active' ? 'nominal' : 'warning', source: 'equine-intelligence', detail: `License ${trainer.licenseStatus}; effective ${trainer.effectiveFrom}`, evidence: [`trainer:${trainer.trainerId}`], incomplete: false })),
  ];
  const incompleteOperationalAreas = [
    data.facilitiesMaintenance.assets.length === 0 ? 'facility assets' : undefined,
    facilityInspectionRows.some((row) => row.incomplete) ? 'facility map-overlay details' : undefined,
    data.facilitiesMaintenance.workOrders.length === 0 ? 'maintenance work orders' : undefined,
    workforceOperations.assignments.length === 0 ? 'shifts and assignments' : undefined,
    certificationTrainingRows.length === 0 ? 'certifications and training records' : undefined,
    trainingAlertRows.length > 0 ? undefined : 'training alert feed has no current alerts',
    data.mode === 'live' && (facilityFeatures.length === 0 || workforceFeatures.length === 0) ? 'live facility/workforce geospatial feeds' : undefined,
  ].filter((area): area is string => Boolean(area));

  if (!authenticated) return WorkspaceLayout({
    id: 'top',
    label: 'TrackMind Nexus command center shell',
    skipLink: { href: '#command-center-content', label: 'Skip to active workspace' },
    mock: data.mode === 'mock',
    degraded: serviceState !== 'online',
    sidebar: (
      <aside className="nexus-sidebar" aria-label="Persistent sidebar" aria-expanded={!navCollapsed} data-collapsed={navCollapsed} data-state={navCollapsed ? 'collapsed' : 'expanded'}>
        <a href="#top" aria-label="TrackMind Nexus home">TrackMind Nexus</a>
        <p aria-label="Shell tenant context">{tenant.name}<br /><small>{tenant.timezone}; race day {tenant.status}; tenant {tenant.saasBoundary.tenantId}; racetrack {tenant.saasBoundary.racetrackId}</small></p>
        {canShowApprovalShortcut && <a className="approval-shortcut" href="/approvals" aria-label="Approvals shortcut">Approvals <strong>{pendingApprovalCount}</strong></a>}
        <nav aria-label="Primary navigation" data-collapsed={navCollapsed} aria-orientation="vertical">{navGroups.map((group) => NavigationGroupLinks({ group, path, collapsed: navCollapsed, badgesByRouteId: navBadges }))}</nav>
      </aside>
    ),
    children: <>
      {PageHeader({ title: 'TrackMind Nexus', label: 'Top command bar', description: 'Sign in to enter the enterprise command-center shell. Navigation and status remain visible, but workspace data stays locked until authentication succeeds.', children: CommandBar({ label: 'Global command bar', mock: data.mode === 'mock', degraded: serviceState !== 'online', children: <>
        <form role="search" aria-label="Global search"><label>Global search <input aria-label="Search races, assets, horses, people, and incidents" placeholder="Search Nexus" disabled /></label></form>
        <nav aria-label="Shell command actions">
          <a href="#command-palette" aria-label="Command palette entry point" aria-keyshortcuts="Control+K">Command palette <kbd>Ctrl</kbd>+<kbd>K</kbd></a>
          <button type="button" aria-label="Notification button" aria-controls="command-center-notifications">Notifications {notificationItems.length}</button>
          {canShowApprovalShortcut && <a href="/approvals" aria-label="Approvals shortcut">Approvals queue: {pendingApprovalCount}</a>}
        </nav>
        <nav aria-label="Breadcrumb"><ol className="breadcrumb">{breadcrumbs.map((crumb, index) => <li key={crumb} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{crumb}</li>)}</ol></nav>
        {MobileNavigationDrawer({ groups: navGroups, path, open: mobileNavOpen, badgesByRouteId: navBadges })}
        <label>Racetrack <select aria-label="Tenant racetrack selector" defaultValue={tenant.id} disabled>{tenants.map((option) => <option key={option.id} value={option.id}>{option.name} - {option.saasBoundary.configuration.cloudTier}</option>)}</select></label>
        <p aria-label="Race-day status indicator"><StatusIndicator label={tenant.status} tone={riskForOperationalStatus(tenant.status)} /> {tenant.name}: status {tenant.status}; tenant isolation {tenant.saasBoundary.tenantId}; {activeRace ? `${activeRace.raceId} ${activeRace.status} at ${activeRace.postTime}` : 'no active race card'}</p>
        <details aria-label="Notification center" id="command-center-notifications" className="notification-drawer">
          <summary>Notifications {notificationItems.length}</summary>
          <NotificationList items={notificationItems} />
        </details>
        <details aria-label="User menu"><summary>{user.name}</summary><p>{user.title}</p><p>Roles: {user.roles.join(', ')}</p></details>
      </> }) })}
      <aside role="status" aria-label="Service status banner" data-tone={banner.tone}>{banner.message}</aside>
      <p id="safety-lock-reason" className="sr-only">Safety-critical controls are locked until the live backend verifies authentication, approval evidence, and a valid human authorization token.</p>
      <section id="emergency-banner-zone" aria-label="Emergency banner zone" role={activeEmergencyCritical ? 'alert' : 'status'}><h2>Emergency Ops</h2><p>Active emergency status: <strong>{data.emergencyOperations.activeEmergencyStatus}</strong></p><p>Guardrail: {data.emergencyOperations.emergencyActions.reason} AI may block actions: {String(data.emergencyOperations.emergencyActions.aiMayBlock)}.</p></section>
      <CommandPanel id="command-palette" title="Command Palette" label="Quick-access command palette"><FilterBar label="Command palette filters" summary="Filter role-aware commands across the Nexus shell."><input aria-label="Command palette query" aria-controls="command-palette-results" defaultValue={paletteQuery} disabled /><ul id="command-palette-results" aria-label="Command palette results">{paletteItems.map((item) => <li key={item.id} data-workspace-group={item.workspaceGroup}><a href={item.path} data-icon-key={item.iconKey} data-breadcrumb-label={item.breadcrumbLabel} data-data-state={item.dataState.mode} data-safety-posture={item.safetyPosture.posture}>{item.label}</a></li>)}</ul></FilterBar></CommandPanel>
      <section aria-label="Race-day status indicators">
        <h2>Race-day Status Indicators</h2>
        <MetricStrip items={raceDayIndicators} />
      </section>
      <section id="command-center-content" className="route-content-frame" tabIndex={-1} aria-label="Active command-center workspace" data-active-workspace="login" data-route={canonicalPath}>
        <h2>Sign In Required</h2>
        <p role="alert">Please sign in to continue to the racetrack command center.</p>
        <p>The login-ready route stays inside the shared Nexus shell; no legacy standalone one-page UI is restored.</p>
      </section>
      <MockDataBanner active={data.mode === 'mock'} source="approved mock/live adapter boundary" />
      <p className="sr-only">Legacy aliases are quarantined as redirects to active command-center workspaces.</p>
    </>,
  });

  return WorkspaceLayout({
    id: 'top',
    label: 'TrackMind Nexus command center shell',
    skipLink: { href: '#command-center-content', label: 'Skip to active workspace' },
    mock: data.mode === 'mock',
    degraded: serviceState !== 'online',
    sidebar: (
      <aside className="nexus-sidebar" aria-label="Persistent sidebar" aria-expanded={!navCollapsed} data-collapsed={navCollapsed} data-state={navCollapsed ? 'collapsed' : 'expanded'}>
        <a href="#top" aria-label="TrackMind Nexus home">TrackMind Nexus</a>
        <p aria-label="Shell tenant context">{tenant.name}<br /><small>{tenant.timezone}; race day {tenant.status}; tenant {tenant.saasBoundary.tenantId}; racetrack {tenant.saasBoundary.racetrackId}</small></p>
        {canShowApprovalShortcut && <a className="approval-shortcut" href="/approvals" aria-label="Approvals shortcut">Approvals <strong>{pendingApprovalCount}</strong></a>}
        <nav aria-label="Primary navigation" data-collapsed={navCollapsed} aria-orientation="vertical">{navGroups.map((group) => NavigationGroupLinks({ group, path, collapsed: navCollapsed, badgesByRouteId: navBadges }))}</nav>
      </aside>
    ),
    children: <>
      {PageHeader({ title: 'TrackMind Nexus', label: 'Top command bar', description: 'Enterprise command-center shell with authentication-aware, role-filtered navigation.', children: CommandBar({ label: 'Global command bar', mock: data.mode === 'mock', degraded: serviceState !== 'online', children: <>
        <form role="search" aria-label="Global search"><label>Global search <input aria-label="Search races, assets, horses, people, and incidents" placeholder="Search Nexus" /></label></form>
        <nav aria-label="Shell command actions">
          <a href="#command-palette" aria-label="Command palette entry point" aria-keyshortcuts="Control+K">Command palette <kbd>Ctrl</kbd>+<kbd>K</kbd></a>
          <button type="button" aria-label="Notification button" aria-controls="command-center-notifications">Notifications {notificationItems.length}</button>
          {canShowApprovalShortcut && <a href="/approvals" aria-label="Approvals shortcut">Approvals queue: {pendingApprovalCount}</a>}
        </nav>
        <nav aria-label="Breadcrumb"><ol className="breadcrumb">{breadcrumbs.map((crumb, index) => <li key={crumb} aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}>{crumb}</li>)}</ol></nav>
        {MobileNavigationDrawer({ groups: navGroups, path, open: mobileNavOpen, badgesByRouteId: navBadges })}
        <label>Racetrack <select aria-label="Tenant racetrack selector" defaultValue={tenant.id}>{tenants.map((option) => <option key={option.id} value={option.id}>{option.name} - {option.saasBoundary.configuration.cloudTier}</option>)}</select></label>
        <p aria-label="Race-day status indicator"><StatusIndicator label={tenant.status} tone={riskForOperationalStatus(tenant.status)} /> {tenant.name}: status {tenant.status}; tenant isolation {tenant.saasBoundary.tenantId}; {activeRace ? `${activeRace.raceId} ${activeRace.status} at ${activeRace.postTime}` : 'no active race card'}</p>
        <details aria-label="Notification center" id="command-center-notifications" className="notification-drawer">
          <summary>Notifications {notificationItems.length}</summary>
          <NotificationList items={notificationItems} />
        </details>
        <details aria-label="User menu"><summary>{user.name}</summary><p>{user.title}</p><p>Roles: {user.roles.join(', ')}</p></details>
        <details aria-label="Command diagnostics" className="notification-drawer">
          <summary>Command diagnostics</summary>
          <p>Event stream descriptor: <code>{data.streamUrl}</code>; connection {streamingSnapshot.connection}; last updated {streamingSnapshot.lastUpdatedAt ?? 'not reported'}.</p>
          <DataFreshness label="Command center" timestamp={data.operations.generatedAt} mode={data.mode} />
          <p>Deployment assumption: internet-facing frontend should sit behind Azure Front Door with HTTPS, managed TLS certificates, WAF, CDN/global routing, and centralized access/security logs.</p>
          <p>Legacy aliases are quarantined as redirects to active command-center workspaces.</p>
        </details>
      </> }) })}
      <aside role="status" aria-label="Service status banner" data-tone={banner.tone}>{banner.message}</aside>
      <p id="safety-lock-reason" className="sr-only">Safety-critical controls are locked until the live backend verifies authentication, approval evidence, and a valid human authorization token.</p>
      <nav className="jump-links" aria-label="Command center jump links">
        <a href="#command-center-content">Active workspace</a>
        {showWorkspace('track-configuration', 'starting-gate', 'digital-twin') && <a href="#track-map-region">Track map</a>}
        {showWorkspace('approvals') && <a href="#approvals-region">Approvals</a>}
        {showWorkspace('audit') && <a href="#audit-ledger-region">Audit ledger</a>}
        <a href="#safety-controls">Safety controls</a>
      </nav>
      <section id="emergency-banner-zone" aria-label="Emergency banner zone" role={activeEmergencyCritical ? 'alert' : 'status'}><h2>Emergency Ops</h2><p>Active emergency status: <strong>{data.emergencyOperations.activeEmergencyStatus}</strong></p><p>Guardrail: {data.emergencyOperations.emergencyActions.reason} AI may block actions: {String(data.emergencyOperations.emergencyActions.aiMayBlock)}.</p></section>
      <CommandPanel id="command-palette" title="Command Palette" label="Quick-access command palette"><FilterBar label="Command palette filters" summary="Filter role-aware commands across the Nexus shell."><input aria-label="Command palette query" aria-controls="command-palette-results" defaultValue={paletteQuery} /><ul id="command-palette-results" aria-label="Command palette results">{paletteItems.map((item) => <li key={item.id} data-workspace-group={item.workspaceGroup}><a href={item.path} data-icon-key={item.iconKey} data-breadcrumb-label={item.breadcrumbLabel} data-data-state={item.dataState.mode} data-safety-posture={item.safetyPosture.posture}>{item.label}</a></li>)}</ul></FilterBar></CommandPanel>
      <section aria-label="Race-day status indicators">
        <h2>Race-day Status Indicators</h2>
        <MetricStrip items={raceDayIndicators} />
      </section>
      {showWorkspace('operations', 'executive') && <section aria-label="Executive KPI strip">
        <h2>Executive KPI Strip</h2>
        <MetricStrip items={executiveKpis} />
      </section>}
      {showWorkspace('operations') && <section aria-label="Command center notifications" id="operations-command-center-notifications">
        <h2>Notifications</h2>
        <NotificationList items={notificationItems} />
      </section>}
      {showWorkspace('operations', 'approvals') && <section aria-label="Approval-safe action library">
        <h2>Approval-safe Actions</h2>
        <p>Frontend controls create approval requests and evidence packages only; critical operational state remains owned by live backend services.</p>
        <ActionRail actions={commandCenterApprovalActions()} />
      </section>}
      {showWorkspace('operations', 'approvals') && <section aria-label="Shared collaboration workspace">
        <h2>Shared Collaboration Workspace</h2>
        <SharedCollaborationPanel workspace={data.collaborationWorkspace} />
      </section>}
      <section id="command-center-content" className="route-content-frame" tabIndex={-1} aria-label="Active command-center workspace" data-active-workspace={activeWorkspaceId} data-route={canonicalPath}>
        <h2>{routeNotFound ? 'Route not found' : activeScreen.title}</h2>
        {routeNotFound ? <>
          <p role="alert">Route not found in TrackMind Nexus: <code>{canonicalPath}</code>. Use the role-aware navigation to select a registered workspace.</p>
          <p>No legacy one-page route was restored for this path; unknown routes stay inside the app shell and do not render Operations by default.</p>
        </> : <>
          <p>Active route <code>{canonicalPath}</code> is the <strong>{activeNavLabel}</strong> workspace inside the shared command-center shell.</p>
          <p>Other workspaces stay available through navigation instead of being stacked into this page.</p>
          <MetricStrip items={[
            { label: 'Workspace owner', value: activeScreen.owner, detail: 'Operational ownership and escalation context' },
            { label: 'API surface', value: activeScreen.liveApi ?? 'read-only', detail: activeScreen.liveApi ?? 'Local registry and governed mock/live adapters' },
            { label: 'Event streams', value: String(activeScreen.eventStreams.length), detail: activeScreen.eventStreams.join(', ') || 'No event stream configured' },
            { label: 'Mutation boundary', value: activeScreen.stateChangingActions.length ? 'approval gated' : 'read only', detail: activeScreen.stateChangingActions.length ? activeScreen.stateChangingActions.join(', ') : 'No direct state-changing controls' },
          ]} />
          <p role="status">Workspace status: connected through the typed Nexus client with explicit loading, empty, error, degraded, mock, and permission states.</p>
          {activeScreen.mockReason && <p>Mock/live boundary: {activeScreen.mockReason}</p>}
          {!canViewActiveWorkspace && <p role="alert">Permission denied for this workspace with the current role set. Use the role-aware navigation to select an available workspace.</p>}
        </>}
      </section>
      {showWorkspace('operations') && <section id="operations-overview-grid" tabIndex={-1} aria-label="Responsive command center dashboard grid">
        <h2>Operations Workspace Switchboard</h2>
        <div className="workspace-grid" aria-label="Responsive content area">
          <WorkspacePanel title="Operations Command" eyebrow="Race-day command"><KpiTile label="Live widgets" value={String(data.operations.widgets.length)} trend={`${data.operations.alerts.length} alerts / ${data.operations.liveEvents.length} events`} tone="info" /><a href="/operations">Stay in command view</a></WorkspacePanel>
          <WorkspacePanel title="Surface Intelligence" eyebrow="Track surface"><KpiTile label="Surface score" value={String(data.surfaceIntelligence.overallScore)} trend={`${data.surfaceIntelligence.recommendations.length} approvals required`} tone="warning" /><a href="/surface">Open surface desk</a></WorkspacePanel>
          <WorkspacePanel title="Starting Gate Control" eyebrow="Protected action"><KpiTile label="Gate GPS" value={data.gatePosition.gpsVerified ? 'verified' : 'check'} trend={`${data.gatePosition.gateId}; execution locked`} tone={data.gatePosition.gpsVerified ? 'ok' : 'warning'} /><a href="/starting-gate">Open guided gate workflow</a></WorkspacePanel>
          <WorkspacePanel title="Equine Intelligence" eyebrow="Horse welfare"><KpiTile label="Advisories" value={String(data.equineIntelligence.aiRiskRecommendations.length)} trend={`${data.equineIntelligence.horse.name}; vet review boundaries`} tone="warning" /><a href="/equine">Open equine desk</a></WorkspacePanel>
          <WorkspacePanel title="Barn Operations" eyebrow="Backstretch"><KpiTile label="Occupancy" value={`${data.barnOperations.stalls.filter((stall) => stall.status === 'occupied').length}/${data.barnOperations.stalls.length}`} trend={`${data.barnOperations.movements.length} audited movements`} tone="info" /><a href="/barns">Open barn board</a></WorkspacePanel>
          <WorkspacePanel title="Steward Center" eyebrow="Official review"><KpiTile label="Inquiries" value={String(data.stewardCenter.inquiries.length)} trend="Final rulings human-only" tone="critical" /><a href="/stewards">Open steward center</a></WorkspacePanel>
          <WorkspacePanel title="Safety Center" eyebrow="Safety OS"><KpiTile label="Posture" value={data.emergencyOperations.activeEmergencyStatus} trend="Security, emergency, stewards, approvals" tone="warning" /><a href="/safety">Open safety overview</a></WorkspacePanel>
          <WorkspacePanel title="Security" eyebrow="SOC"><KpiTile label="Alerts" value={String(data.securityOperations.dashboard.activeAlerts)} trend={`${data.securityOperations.dashboard.investigationQueue} investigations`} tone="warning" /><a href="/security">Open security operations</a></WorkspacePanel>
          <WorkspacePanel title="Emergency Ops" eyebrow="Incident command"><KpiTile label="Authority" value="human" trend={`AI may block ${String(data.emergencyOperations.emergencyActions.aiMayBlock)}`} tone="critical" /><a href="/emergency">Open emergency ops</a></WorkspacePanel>
          <WorkspacePanel title="Asset Registry" eyebrow="Asset control"><KpiTile label="Assets" value={String(data.trackMap.assets.length)} trend={Object.entries(assetHealth).map(([status, count]) => `${status}:${count}`).join(', ')} tone="info" /><a href="/assets">Open registry</a></WorkspacePanel>
          <WorkspacePanel title="Digital Twin View" eyebrow="Twin runtime"><KpiTile label="Twins" value={String(data.digitalTwinState.length)} trend={Object.entries(twinHealth).map(([health, count]) => `${health}:${count}`).join(', ')} tone="info" /><a href="/digital-twin">Open twin view</a></WorkspacePanel>
          <WorkspacePanel title="Facilities" eyebrow="Maintenance"><KpiTile label="Readiness" value={String(data.facilitiesMaintenance.readiness.score)} trend={`${data.facilitiesMaintenance.workOrders.length} work orders`} tone="warning" /><a href="/facilities">Open facilities</a></WorkspacePanel>
          <WorkspacePanel title="Workforce" eyebrow="Staffing"><KpiTile label="Readiness" value={String(workforceOperations.readiness.score)} trend={`${workforceOperations.assignments.length} assignments`} tone="warning" /><a href="/workforce">Open workforce</a></WorkspacePanel>
          <WorkspacePanel title="Governance Centers" eyebrow="Approval, audit, compliance, AI"><KpiTile label="Approvals" value={String(pendingApprovalCount)} trend={`${data.auditEvents.length} audit rows / compliance ${data.complianceLibrary.readiness.score}`} tone="critical" /><a href="/approvals">Open governance queue</a></WorkspacePanel>
          <WorkspacePanel title="Executive Intelligence Center" eyebrow="Read-only leadership"><KpiTile label="Briefing" value="read-only" trend="Safety, operations, compliance, AI, assets" tone="info" /><a href="/executive">Open executive center</a></WorkspacePanel>
          <WorkspacePanel title="Racing Data API Hub" eyebrow="Provider data governance"><KpiTile label="Subworkspaces" value={String(apiHubDeepLinks.length)} trend={`${apiHubMetadata.supportedDataClasses.length} data classes / ${apiHubMetadata.supportedUsageScopes.length} usage scopes`} tone="info" /><a href="/api-hub">Open API Hub</a></WorkspacePanel>
          <WorkspacePanel title="Platform Health Center" eyebrow="Observability"><KpiTile label="Health" value={data.platformHealth.overallStatus} trend={`${data.platformHealth.eventBus.eventsPerMinute} events/min`} tone={healthRiskLevel(data.platformHealth.overallStatus)} /><a href="/platform-health">Open platform health</a></WorkspacePanel>
        </div>
      </section>}
      <MockDataBanner active={data.mode === 'mock'} source="approved mock/live adapter boundary" />
      <p className="sr-only">Legacy aliases are quarantined as redirects to active command-center workspaces.</p>
      {legacyRouteAlias && <section aria-label="Legacy route compatibility notice" data-legacy-route={legacyRouteAlias.from} data-canonical-route={canonicalPath}>
        <h2>{legacyRouteAlias.status === 'redirect' ? 'Legacy Route Redirect' : 'Legacy Route Quarantine'}</h2>
        {legacyRouteAlias.status === 'redirect'
          ? <p><code>{legacyRouteAlias.from}</code> is obsolete; use <a href={canonicalPath}><code>{canonicalPath}</code></a>. {legacyRouteAlias.reason}</p>
          : <p><code>{legacyRouteAlias.from}</code> is quarantined and is not restored as a routable workspace. {legacyRouteAlias.reason}</p>}
        <p>No functional screen was deleted; registered destinations remain contained in the unified command-center shell with role-aware navigation, breadcrumbs, and approval-safe controls.</p>
      </section>}
      {showWorkspace('platform-health') && <section aria-label="Legacy route compatibility registry">
        <h2>Legacy Route Compatibility Registry</h2>
        <p>Old dashboard routes are quarantined as redirects to active command-center workspaces instead of disconnected UI islands.</p>
        {legacyRouteAliases.map((alias) => {
          if (alias.status === 'redirect') {
            return <article key={alias.from} data-legacy-route={alias.from} data-canonical-route={alias.to} data-status={alias.status}><strong>{alias.from}</strong><p>Redirects to <a href={alias.to}>{alias.to}</a>. {alias.reason}</p></article>;
          }
          return <article key={alias.from} data-legacy-route={alias.from} data-status={alias.status}><strong>{alias.from}</strong><p>Quarantined; no redirect is served. {alias.reason}</p></article>;
        })}
      </section>}
      {showWorkspace('platform-health') && <section aria-label="Frontend route and safety audit">
        <h2>Frontend route and safety audit</h2>
        <p>Every command-center domain is registered in role-aware navigation, uses the shared Nexus app shell, declares a typed live API or approved mock adapter boundary, exposes loading/error/empty states, and routes unsafe actions through approval and audit workflows.</p>
        {domainScreens.map((screen) => {
          const visible = visibleIds.has(screen.id);
          return <article key={screen.id} aria-label={`${screen.title} route audit`} data-route={screen.route} data-visible={visible}>
            <h3>{screen.title}</h3>
            <p>Owner {screen.owner}; route {screen.route}; API {screen.liveApi ?? 'read-only local registry'}; events {screen.eventStreams.join(', ')}.</p>
            <p>{visible ? 'Navigation visible for current role.' : 'Permission denied state available for current role.'} {screen.mockReason ? `Mock boundary: ${screen.mockReason}.` : 'Live typed API required.'}</p>
            <p>State coverage: loading, empty, error, degraded/offline, and permission denied. Unsafe actions: {screen.stateChangingActions.length ? screen.stateChangingActions.join(', ') : 'none'}.</p>
          </article>;
        })}
      </section>}
      {showWorkspace('platform-health') && <section aria-label="Operational state examples"><DataState state={{ status: 'loading' }}>{() => null}</DataState><DataState state={{ status: 'empty', mock: data.mode === 'mock' }}>{() => null}</DataState><DataState state={{ status: 'error', message: 'Example degraded feed', mock: data.mode === 'mock' }}>{() => null}</DataState><p role="alert">Permission denied state: request a role grant to unlock restricted workflows.</p><p role="status">Offline/degraded-service state: cached read-only view is available.</p></section>}
      {showWorkspace('platform-health') && <section aria-label="TrackMind Nexus upgrade package">
        <h2>TrackMind Nexus Upgrade Package</h2>
        <p>{data.nexusUpgrade.schemaVersion} coordinates {data.nexusUpgrade.workspaces.length} first-class workspaces, including Workforce and Platform Health hardening, {data.nexusUpgrade.areas.length} upgrade areas, {data.nexusUpgrade.eventContracts.length} governed event contracts, {data.nexusUpgrade.safetyControls.length} protected-action controls, and {data.nexusUpgrade.digitalTwinAssetKinds.length} Digital Twin asset kinds.</p>
        <p>Compliance mappings: {data.nexusUpgrade.complianceFrameworks.join(', ')}.</p>
        <section aria-label="AI control plane upgrade metadata">
          <h3>AI Control Plane</h3>
          <p>{data.nexusUpgrade.aiControlPlane.name}: {data.nexusUpgrade.aiControlPlane.flow.join(' -> ')}.</p>
          <p>Governance anchors {data.nexusUpgrade.aiControlPlane.governanceAnchors.join(', ')}; observability {data.nexusUpgrade.aiControlPlane.observabilityMetrics.join(', ')}.</p>
          <p>{data.nexusUpgrade.aiControlPlane.digitalTwinTarget}</p>
        </section>
        <section aria-label="Tier 7 SaaS model">
          <h3>Tier 7 SaaS Model</h3>
          <p>{data.nexusUpgrade.tier7SaasModel.title}; billing implemented {String(data.nexusUpgrade.tier7SaasModel.billingImplemented)}; provisioning implemented {String(data.nexusUpgrade.tier7SaasModel.provisioningImplemented)}.</p>
          <p>Deployable modes: {data.nexusUpgrade.tier7SaasModel.deployableModes.map((mode) => mode.title).join(', ')}.</p>
          {data.nexusUpgrade.tier7SaasModel.tiers.map((tier) => <article key={tier.id} aria-label={`${tier.name} tier entitlements`}>
            <h4>{tier.name}</h4>
            <p>{tier.summary}</p>
            <p>Entitlements: {tier.featureEntitlements.map((feature) => feature.title).join(', ')}.</p>
            <p>Required controls: {tier.requiredControls.join(', ')}. Upgrade next: {tier.upgradePath.next ?? 'none'}.</p>
          </article>)}
        </section>
        <section aria-label="Nexus workspace coverage">
          <h3>Workspace coverage</h3>
          {data.nexusUpgrade.workspaces.map((workspace) => <article key={workspace.id} aria-label={`${workspace.title} upgrade coverage`} data-status={workspace.status}>
            <h4>{workspace.title}</h4>
            <p>Route {workspace.route}; API {workspace.apiPath}; owner {workspace.owner}; status {workspace.status}.</p>
            <p>Events {workspace.eventTypes.join(', ')}; audits {workspace.auditActions.join(', ')}; twins {workspace.twinKinds.join(', ')}.</p>
            <p>Approval controls: {workspace.approvalRequiredActions.join(', ') || 'none'}; observability: {workspace.observabilityMetrics.join(', ')}.</p>
          </article>)}
        </section>
        <section aria-label="Nexus safety controls">
          <h3>Safety controls</h3>
          {data.nexusUpgrade.safetyControls.map((control) => <article key={control.protectedAction} role="status"><strong>{control.protectedAction}</strong><p>AI may draft: {String(control.aiMayDraft)}; autonomous execution allowed: {String(control.autonomousExecutionAllowed)}; roles {control.requiredRoles.join(', ')}; evidence {control.evidenceRequired.join(', ')}.</p></article>)}
        </section>
      </section>}
      {showWorkspace('operations') && <WorkspaceFrame
        id="operations-workspace-frame"
        title="Unified Operations Command Center"
        label="Unified Operations Command Center"
        eyebrow="Operations workspace"
        description="Landing dashboard for race readiness, safety, approvals, audit posture, resources, and live event context. Backend-connected widgets stay wired to loaded DTOs; placeholders and degraded feeds are labelled before operators can mistake them for complete capability."
        mock={data.mode === 'mock' || data.operations.mock}
        degraded={data.platformHealth.frontend.degradedMode || data.platformHealth.overallStatus !== 'healthy'}
        operationalSummary={<><DataFreshness label="Operations command center" timestamp={data.operations.generatedAt} mode={data.mode} /><MockDataBanner active={data.mode === 'mock' || data.operations.mock} source="Operations Command mock/live facade" /><MetricStrip items={raceDayIndicators} /></>}
        evidenceDetailPanel={<><p>Lineage sources: {data.operations.dataLineage.map((lineage) => `${lineage.domain}:${lineage.reference}`).join('; ') || 'none loaded'}.</p><p>Operational alerts carry evidence: {data.operations.alerts.flatMap((alert) => alert.evidence).join(', ') || 'none loaded'}.</p><p>Stream descriptor: <code>{data.streamUrl}</code>; connection {streamingSnapshot.connection}.</p></>}
        eventTimeline={<EventTimeline events={operationsTimelineEvents} label="Operations workspace event timeline" />}
        approvalContext={<p>Pending approvals {pendingApprovalCount}; approval-safe actions route through backend APIs only. Locked controls remain in the shared approval-safe action library.</p>}
        auditContext={<p>Visible audit rows {data.auditEvents.length}; platform audit volume {data.platformHealth.audit.records}; ledger valid {String(data.platformHealth.audit.validLedger)}.</p>}
        digitalTwinContext={<p>Digital Twin health: {Object.entries(twinHealth).map(([health, count]) => `${health}:${count}`).join(', ') || 'no twin state'}; queued sync {data.platformHealth.digitalTwin.queuedSync}.</p>}
        primary={<>
        <section aria-label="Executive command KPI strip"><h3>Executive command KPIs</h3><MetricStrip items={executiveKpis} /></section>
        <section aria-label="Operations command source status">
          <h3>Source status</h3>
          <p>Facade mode: <strong>{data.mode}</strong>. Event stream integration: <code>{data.streamUrl}</code>. Platform stream health: {data.platformHealth.eventBus.status}; frontend degraded mode {String(data.platformHealth.frontend.degradedMode)}.</p>
          <p role="status">{data.platformHealth.frontend.degradedMode ? 'Degraded streaming status: cached read-only view is available and controls stay locked.' : 'Streaming status available from the unified API client.'}</p>
          <p>State-changing widgets route to approval-aware backend paths only: <code>/approvals/controlled-actions</code>, <code>/approvals/draft-requests</code>, <code>/track-configuration/draft-requests</code>, governed event streams, and immutable audit records.</p>
        </section>
        <div className="workspace-grid" aria-label="Operations command landing grid">
          <WorkspacePanel title="Race readiness cockpit" eyebrow="Race readiness">
            <section aria-label="Race readiness widget">
              <h4>Race readiness</h4>
              <KpiTile label="Readiness score" value={String(data.readiness.averageScore)} trend={`${data.readiness.ready} ready / ${data.readiness.watch} watch / ${data.readiness.blocked} blocked`} tone={data.readiness.blocked ? 'critical' : data.readiness.watch ? 'warning' : 'ok'} />
              <p>Current race status: {data.readiness.races.map((race) => `${race.raceId} ${race.status} score ${race.score}`).join('; ') || 'No active race readiness records loaded.'}</p>
              <section aria-label="Readiness domain score widgets"><h4>Domain scores</h4>{data.readiness.domainScores.map((domain) => <article key={domain.domain}><strong>{domain.domain}</strong><meter min={0} max={100} value={domain.averageScore}>{domain.averageScore}</meter><p>{domain.averageScore}; watch {domain.watch}; blocked {domain.blocked}</p></article>)}</section>
              <NotificationList items={data.readiness.warnings.map((warning) => ({ id: warning.id, title: `${warning.domain} ${warning.severity}`, detail: `${warning.message} Recommended action: ${warning.recommendedAction}. Evidence: ${warning.evidence.join(', ')}`, tone: warning.severity === 'critical' ? 'critical' : warning.severity === 'warning' ? 'warning' : 'info' }))} />
            </section>
          </WorkspacePanel>
          <WorkspacePanel title="Surface and weather watch" eyebrow="Surface status">
            <section aria-label="Surface status widget">
              <h4>Surface status</h4>
              {data.surfaceIntelligence.statusCards.map((card) => <StatusCard key={card.label} title={card.label} status={card.value} detail={`${card.detail} Tone: ${card.tone}`} tone={card.tone} />)}
            </section>
            <section aria-label="Weather placeholder widget">
              <h4>Weather placeholder</h4>
              <StatusCard title="Weather" status={`${data.surfaceIntelligence.weatherObservation.forecastRainMm}mm forecast rain`} detail={`Observed ${data.surfaceIntelligence.weatherObservation.rainfallMm}mm rain, ${data.surfaceIntelligence.weatherObservation.temperature}F, wind ${data.surfaceIntelligence.weatherObservation.windMph}mph. ${data.surfaceIntelligence.mock ? 'Mock weather placeholder; live weather service not complete.' : 'Live weather feed.'}`} tone={data.surfaceIntelligence.mock ? 'warning' : 'info'} />
            </section>
            <section aria-label="Surface approval recommendations widget"><h4>Surface approvals</h4>{data.surfaceIntelligence.recommendations.map((item) => <article key={item.id}><RiskBadge level={item.priority === 'moderate' ? 'medium' : item.priority} /><ApprovalChip status={item.executionState === 'approval-required' ? 'pending-approval' : 'approved'} /><strong>{item.recommendation}</strong><p>{item.executionState}; human approval required {String(item.requiresHumanApproval)}; event {item.eventId}; audit {item.auditId}</p><code>POST /api/v1/approvals/draft-requests</code></article>)}</section>
          </WorkspacePanel>
          <WorkspacePanel title="Safety, approvals, stewards" eyebrow="Safety desk">
            <section aria-label="Active incidents widget"><h4>Active incidents</h4>{data.securityOperations.incidents.length ? data.securityOperations.incidents.map((incident) => <article key={incident.id}><RiskBadge level={incident.severity} /><strong>{incident.title}</strong><p>{incident.status}; assigned {incident.assignedTo ?? 'unassigned'}; event {incident.eventIds.join(', ')}; audit {incident.auditId}</p><a href="/security">Route incident workflow through Security Operations</a></article>) : <p role="status">No active incidents loaded.</p>}</section>
            <section aria-label="Pending approvals widget"><h4>Pending approvals</h4>{data.approvals.length ? data.approvals.map((approval) => <article key={approval.id}><ApprovalChip status={approval.status} /><strong>{approval.action}</strong><p>{approval.target}; requested by {approval.requestedBy}; policy {approval.approvalPolicy ?? 'approval service policy'}; evidence {approval.evidence.join(', ')}</p><a href="/approvals">Review in Approvals Center</a></article>) : <p role="status">No approval requests loaded.</p>}{data.readiness.approvals.map((approval) => <article key={approval.id}><ApprovalChip status={approval.status === 'satisfied' ? 'approved' : 'pending-approval'} /><strong>{approval.action}</strong><p>{approval.reason}; roles {approval.requiredRoles.join(', ')}; evidence {approval.evidence.join(', ')}</p></article>)}</section>
            <section aria-label="Steward inquiries widget"><h4>Steward inquiries</h4><p>{stewardOpenObjections} open steward objections; final rulings stay human-only.</p>{stewardInquiries.map((inquiry) => <article key={inquiry.id}><strong>{inquiry.raceId}: {inquiry.status}</strong><p>{inquiry.objections.length} objections; {inquiry.incidentsUnderReview.length} incidents under review; official result mutation locked.</p><a href="/stewards">Open Steward Center</a></article>)}</section>
          </WorkspacePanel>
          <WorkspacePanel title="Asset, workforce, facility health" eyebrow="Readiness">
            <section aria-label="Asset health widget"><h4>Asset health</h4>{data.trackMap.assets.map((asset) => <article key={asset.id}><AssetHealthIndicator label={asset.label} status={asset.status} /><p>{asset.type}; sector {asset.sectorId}; source track map / asset registry</p></article>)}<p>Digital Twin health: {Object.entries(twinHealth).map(([status, count]) => `${status}:${count}`).join(', ') || 'no twin state'}.</p></section>
            <section aria-label="Workforce readiness widget"><h4>Workforce readiness</h4><KpiTile label="Checked in" value={`${workforceOperations.readiness.checkedIn}/${workforceOperations.readiness.assigned}`} trend={`Score ${workforceOperations.readiness.score}; ${workforceOperations.readiness.status}`} tone={workforceOperations.mock ? 'warning' : 'info'} /><p>{workforceOperations.readiness.blockers.join('; ') || 'No workforce blockers loaded.'}</p><small>{workforceOperations.mock ? 'Approved mock workforce placeholder.' : 'Live workforce operations feed.'}</small></section>
            <section aria-label="Facility health widget"><h4>Facility health</h4><KpiTile label="Facility readiness" value={String(data.facilitiesMaintenance.readiness.score)} trend={`${data.facilitiesMaintenance.readiness.ready} ready / ${data.facilitiesMaintenance.readiness.watch} watch / ${data.facilitiesMaintenance.readiness.blocked} blocked`} tone={data.facilitiesMaintenance.mock ? 'warning' : 'info'} />{data.facilitiesMaintenance.workOrders.slice(0, 2).map((workOrder) => <article key={workOrder.id}><ApprovalChip status={workOrder.status === 'approval-required' ? 'pending-approval' : 'approved'} /><strong>{workOrder.title}</strong><p>{workOrder.operationalImpact}; event {workOrder.eventId}; audit {workOrder.auditId}</p><code>POST /api/v1/approvals/draft-requests</code></article>)}<small>{data.facilitiesMaintenance.mock ? 'Approved mock facilities placeholder.' : 'Live facilities maintenance feed.'}</small></section>
          </WorkspacePanel>
          <WorkspacePanel title="Emergency resources" eyebrow="Incident command">
            <section aria-label="Emergency resources widget">
              <h4>Emergency resources</h4>
              <p>AI blocking allowed: {String(data.emergencyOperations.emergencyActions.aiMayBlock)}. Human override supported: {String(data.emergencyOperations.emergencyActions.humanOverrideSupported)}.</p>
              {data.emergencyOperations.resourceMap.map((resource) => <article key={resource.id} data-status={resource.status}><RiskBadge level={riskForOperationalStatus(resource.status)} /><strong>{resource.label}</strong><p>{resource.kind}; {resource.status}; zone {resource.zoneId}</p></article>)}
              <p>Checklist readiness: {data.emergencyOperations.checklist.filter((item) => item.completed).length} of {data.emergencyOperations.checklist.length} complete.</p>
            </section>
          </WorkspacePanel>
          <WorkspacePanel title="AI, audit, live timeline" eyebrow="AI and events">
            <section aria-label="AI recommendations widget"><h4>AI recommendations</h4>{data.operations.aiRecommendations.map((item) => <article key={item.id}><strong>{item.recommendation}</strong><p>Confidence {Math.round(item.confidence * 100)}%; approval required: {String(item.requiresApproval)}; action route: <a href={item.actionPath}>{item.actionPath}</a></p><p>Evidence: {item.evidence.join(', ')}</p>{item.requiresApproval && <code>POST /api/v1/approvals/controlled-actions</code>}</article>)}</section>
            <section aria-label="Audit activity widget"><h4>Audit activity</h4>{data.auditEvents.slice(0, 3).map((event) => <AuditEventRow key={event.id} event={event} />)}<p>Platform audit volume {data.platformHealth.audit.records}; visible loaded audit rows {data.auditEvents.length}; ledger valid {String(data.platformHealth.audit.validLedger)}.</p></section>
            <section aria-label="Live event timeline widget"><h4>Live event timeline</h4><p>Connection {streamingSnapshot.connection}; subscribed to <code>{data.streamUrl}</code>; {operationsTimelineEvents.length} visible events across operations, readiness, emergency, and AI feeds. Streaming updates are telemetry/status only.</p><EventTimeline events={operationsTimelineEvents} label="Operations live event timeline" /></section>
            <StreamingDataStatus snapshot={streamingSnapshot} label="Live event streaming" />
          </WorkspacePanel>
        </div>
        <section aria-label="Configurable widget registry"><h3>Configurable widget registry</h3><div aria-label="Configurable widget grid">{data.operations.widgets.map((widget) => <article key={widget.id} aria-label={`${widget.title} widget`} data-source={widget.source} data-configurable={widget.configurable}><h4><a href={widget.drillDownPath}>{widget.title}</a></h4><RiskBadge level={widget.status === 'nominal' ? 'low' : widget.status === 'advisory' ? 'medium' : widget.status === 'warning' ? 'high' : 'critical'} /><strong>{widget.value}</strong><p>{widget.detail}</p><small>Source: {sourceLabel(widget.source)}; domain: {widget.domain}; drill-down: {widget.drillDownPath}</small></article>)}</div></section>
        <section aria-label="Saved layouts and role-specific views"><h3>Saved layouts</h3>{data.operations.savedLayouts.map((layout) => <article key={layout.id}><strong>{layout.name}</strong><p>Role view: {layout.role}; widgets: {layout.widgetIds.join(', ')}</p></article>)}</section>
        <section aria-label="Operational alerts"><h3>Operational alerts</h3>{data.operations.alerts.map((alert) => <article key={alert.id} role={alert.severity === 'critical' ? 'alert' : 'status'}><strong>{alert.title}</strong><p>{alert.severity}; acknowledged: {String(alert.acknowledged)}; action route: <a href={alert.actionPath}>{alert.actionPath}</a></p><p>Evidence: {alert.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Data lineage"><h3>Data lineage</h3>{data.operations.dataLineage.map((lineage) => <p key={`${lineage.domain}-${lineage.reference}`}>{lineage.domain}: {sourceLabel(lineage.source)} via <code>{lineage.reference}</code></p>)}</section>
        </>}
      />}


      {showWorkspace('api-hub') && <ApiHubWorkspace data={data} activePath={canonicalPath} tenant={tenant} roles={roles} />}

      {showWorkspace('platform-health') && <WorkspaceFrame
        id="platform-health-workspace-frame"
        title="Platform Health Center"
        label="Platform Health workspace"
        eyebrow="Observability workspace"
        description={<>Overall platform status: <strong>{data.platformHealth.overallStatus}</strong>. OpenTelemetry-aligned logs, metrics, traces, and frontend error reports share schema {data.platformHealth.telemetrySchema.version}.</>}
        mock={data.mode === 'mock'}
        degraded={data.platformHealth.overallStatus !== 'healthy'}
        operationalSummary={<><DataFreshness label="Platform health" timestamp={data.platformHealth.generatedAt} mode={data.mode} /><MockDataBanner active={data.mode === 'mock'} source="Platform Health mock/live facade" /><p><RiskBadge level={healthRiskLevel(data.platformHealth.overallStatus)} /> Health signals are rendered from the existing PlatformHealthWorkspaceDto and reused as executive source context; unavailable telemetry stays labelled instead of inferred.</p><KpiDashboard title="Platform Health" items={platformKpis} aria-label="Platform Health KPI dashboard" /></>}
        evidenceDetailPanel={<><p>Telemetry schema {data.platformHealth.telemetrySchema.version}; required signals {data.platformHealth.telemetrySchema.requiredSignals.join(', ')}.</p><p>Deployment boundary: {data.platformHealth.deploymentBoundary.claim}</p></>}
        eventTimeline={<p>{data.platformHealth.signals.length} platform telemetry signals loaded; detailed signal timeline remains in the frontend error reporting section.</p>}
        approvalContext={<p>Approval engine: pending {data.platformHealth.approvalEngine.pending}, approved {data.platformHealth.approvalEngine.approved}, escalated {data.platformHealth.approvalEngine.escalated}, rejected {data.platformHealth.approvalEngine.rejected}, expired {data.platformHealth.approvalEngine.expired}.</p>}
        auditContext={<p>Ledger valid {String(data.platformHealth.audit.validLedger)}; records {data.platformHealth.audit.records}; critical records {data.platformHealth.audit.criticalRecords}; AI audit sync {data.platformHealth.aiGovernance.auditSyncStatus}.</p>}
        digitalTwinContext={<p>Total twins {data.platformHealth.digitalTwin.totalTwins}; healthy {data.platformHealth.digitalTwin.healthy}; degraded {data.platformHealth.digitalTwin.degraded}; critical {data.platformHealth.digitalTwin.critical}; queued sync {data.platformHealth.digitalTwin.queuedSync}.</p>}
        primary={<>
        <TenantSaasBoundaryPanel tenant={tenant} roles={roles} routeScope="platform-health" routeLabel="Platform Health" candidate={data.complianceLibrary.trackCertificationCandidate} />
        <ArtifactFrameworkPanel data={data} />
        <section aria-label="Racing Operating System standardization view">
          <h3>TRACKMIND OS Tree</h3>
          <MockDataBanner active={rosStandardization.mock} source="ROS standardization mock/live facade" />
          <p role="note"><strong>Read-only ROS readiness/certification candidate:</strong> this is a standardization and product-readiness view, not external certification. Certified Track labels are readiness/certification candidate labels only.</p>
          <p role="status">No unsafe actions: this panel exposes no race, gate, veterinary, steward, payout, emergency, surface, facility, security, or Digital Twin execution controls.</p>
          <MetricStrip items={[
            { label: 'OS domains', value: String(rosStandardization.osTree.length), detail: rosStandardization.readinessLabel },
            { label: 'Schema coverage', value: `${Math.round(rosStandardization.universalSchemaCoverage.reduce((sum, item) => sum + item.score, 0) / rosStandardization.universalSchemaCoverage.length)}%`, detail: 'entities/events/workflows/approvals/twins/AI/audit/compliance' },
            { label: 'Certified Track criteria', value: String(rosStandardization.certifiedTrackCriteria.length), detail: 'candidate scores, not external certification' },
            { label: 'Deployment modes', value: String(rosStandardization.deploymentModes.length), detail: rosStandardization.deploymentModes.map((mode) => mode.mode).join(', ') },
          ]} />
          <section aria-label="TRACKMIND OS tree">
            {rosStandardization.osTree.map((node) => <WorkspacePanel key={node.id} title={node.name} eyebrow="TRACKMIND OS tree node">
              <p>{node.scope}</p>
              <p>Route-appropriate source: <a href={node.route}>{node.route}</a>.</p>
            </WorkspacePanel>)}
          </section>
          <section aria-label="Universal Schema coverage">
            <h4>Universal Schema coverage</h4>
            <DataTable label="Universal Schema coverage matrix" rows={rosStandardization.universalSchemaCoverage} getRowKey={(row) => row.area} columns={[
              { key: 'area', header: 'Area', render: (row) => row.area },
              { key: 'status', header: 'Status', render: (row) => <StatusCard title={row.area} status={row.status} detail={`${row.score}% from ${row.source}`} /> },
              { key: 'source', header: 'Source', render: (row) => row.source },
            ]} />
          </section>
          <section aria-label="SaaS tiers and deployment modes">
            <h4>SaaS tiers and deployment modes</h4>
            {rosStandardization.saasTiers.map((tier) => <article key={tier.tier}><strong>{tier.tier}</strong><p>{tier.audience}; capabilities {tier.capabilities.join(', ')}.</p></article>)}
            {rosStandardization.deploymentModes.map((mode) => <article key={mode.mode}><strong>{mode.mode}</strong><p>Boundary {mode.boundary}. {mode.notes}</p></article>)}
          </section>
          <section aria-label="Certified Track criteria and scores">
            <h4>Certified Track criteria and scores</h4>
            <p>Candidate scoring only: TrackMind does not claim external certification from an accreditor, regulator, standards body, or racing commission.</p>
            {rosStandardization.certifiedTrackCriteria.map((criterion) => <article key={criterion.criterion} data-status={criterion.status}>
              <RiskBadge level={scoreRisk(criterion.score)} />
              <strong>{criterion.criterion}: {criterion.score}</strong>
              <p>Status {criterion.status}; readiness/certification candidate only; evidence {criterion.evidence.join(', ')}.</p>
            </article>)}
          </section>
          <section aria-label="Unified data model stores">
            <h4>Unified data model stores</h4>
            {rosStandardization.unifiedDataModelStores.map((store) => <article key={store.store}><strong>{store.store}</strong><p>{store.purpose} Examples {store.examples.join(', ')}.</p></article>)}
          </section>
          <section aria-label="Intelligence Core shared layers">
            <h4>Intelligence Core shared layers</h4>
            {rosStandardization.intelligenceCoreLayers.map((layer) => <article key={layer.layer}><strong>{layer.layer}</strong><p>Shared by {layer.sharedBy.join(', ')}. Guardrail: {layer.guardrail}</p></article>)}
          </section>
          <section aria-label="ROS standardization safety disclaimers">
            <h4>Safety disclaimers</h4>
            {rosStandardization.guardrails.map((guardrail) => <p key={guardrail} role="status">{guardrail}</p>)}
          </section>
        </section>
        <TrendCardGrid ariaLabel="Platform health trend cards" title="Platform health trend cards" cards={platformTrends} aria-label="Platform health trend cards" />
        <section aria-label="Platform operational readiness dashboard">
          <h3>Operational readiness and health drill-down</h3>
          <p>Executives get status first, operators get the owning DTO, route, and degraded-service state needed for investigation.</p>
          <DataTable label="Platform health drill-down metrics" rows={platformDrillDownRows} getRowKey={(row) => row.id} columns={[
            { key: 'area', header: 'Area', render: (row) => row.area },
            { key: 'status', header: 'Status', render: (row) => <StatusCard title={row.area} status={row.status} detail={row.value} /> },
            { key: 'route', header: 'Drill-down', render: (row) => <a href={row.route}>{row.route}</a> },
            { key: 'source', header: 'Source', render: (row) => row.source },
          ]} />
        </section>
        <ServiceHealthCards health={data.platformHealth} ariaLabel="Service health and dependencies" title="Service health" aria-label="Service health and dependencies" />
        <section aria-label="System dependency view">
          <h3>System dependency health matrix</h3>
          <p>Required dependencies are read from PlatformHealthWorkspaceDto services. This view is diagnostic context only; it does not rewire services or mark dependencies healthy by assumption.</p>
          <DataTable label="System dependency health matrix" rows={serviceDependencyRows} getRowKey={(row) => row.id} columns={[
            { key: 'service', header: 'Service', render: (row) => row.serviceId },
            { key: 'serviceStatus', header: 'Service status', render: (row) => <StatusIndicator label={row.serviceStatus} tone={row.serviceStatus} /> },
            { key: 'dependency', header: 'Dependency', render: (row) => row.dependencyId },
            { key: 'dependencyStatus', header: 'Dependency status', render: (row) => <StatusIndicator label={row.dependencyStatus} tone={row.dependencyStatus} /> },
            { key: 'required', header: 'Required', render: (row) => String(row.required) },
            { key: 'latency', header: 'Latency', render: (row) => `${row.latencyMs}ms` },
          ]} />
        </section>
        <section aria-label="Event bus health"><h3>Event bus health</h3><KpiTile label="Events per minute" value={String(data.platformHealth.eventBus.eventsPerMinute)} trend={`${data.platformHealth.eventBus.publishedEvents} published; ${data.platformHealth.eventBus.deadLetters} dead letters`} /><p>Schemas {data.platformHealth.eventBus.schemas}; capacity {data.platformHealth.eventBus.throughputCapacity}; backpressure {String(data.platformHealth.eventBus.backpressure)}.</p></section>
        <section aria-label="Audit health"><h3>Audit health</h3><p>Ledger valid {String(data.platformHealth.audit.validLedger)}; records {data.platformHealth.audit.records}; critical records {data.platformHealth.audit.criticalRecords}. Audit volume is a reported platform metric, not a complete regulator filing count.</p></section>
        <section aria-label="Approval engine health"><h3>Approval engine health</h3><p>Pending {data.platformHealth.approvalEngine.pending}; approved {data.platformHealth.approvalEngine.approved}; escalated {data.platformHealth.approvalEngine.escalated}; rejected {data.platformHealth.approvalEngine.rejected}; expired {data.platformHealth.approvalEngine.expired}.</p></section>
        <section aria-label="AI governance health"><h3>AI governance health</h3><p>Active agents {data.platformHealth.aiGovernance.activeAgents}; pending reviews {data.platformHealth.aiGovernance.pendingReviews}; blocked actions {data.platformHealth.aiGovernance.blockedActions}; drift breaches {data.platformHealth.aiGovernance.driftBreaches}. AI health is platform-observability posture, not permission to execute protected actions.</p></section>
        <section aria-label="Digital Twin health"><h3>Digital Twin health</h3><p>Total twins {data.platformHealth.digitalTwin.totalTwins}; healthy {data.platformHealth.digitalTwin.healthy}; degraded {data.platformHealth.digitalTwin.degraded}; critical {data.platformHealth.digitalTwin.critical}; queued sync {data.platformHealth.digitalTwin.queuedSync}; last sync {data.platformHealth.digitalTwin.lastSyncAt ?? 'not reported'}.</p></section>
        <section aria-label="Workflow status"><h3>Workflow status</h3><p>Active {data.platformHealth.workflows.active}; completed {data.platformHealth.workflows.completed}; failed {data.platformHealth.workflows.failed}. Workflow metrics are read-only readiness indicators; state-changing actions remain approval-gated.</p></section>
        <section aria-label="Operational readiness health"><h3>Operational readiness</h3><p>Race-day readiness {data.readiness.averageScore}; ready {data.readiness.ready}; watch {data.readiness.watch}; blocked {data.readiness.blocked}. This is a separate operational feed displayed beside platform health.</p></section>
        <section aria-label="API latency metrics"><h3>API latency metrics</h3><p>p50 {data.platformHealth.apiLatency.p50Ms}ms; p95 {data.platformHealth.apiLatency.p95Ms}ms; budget {data.platformHealth.apiLatency.budgetMs}ms.</p></section>
        <section aria-label="AI control plane observability"><h3>AI control plane observability</h3><p>Inputs {data.platformHealth.aiGovernance.inputThroughput}; feature builds {data.platformHealth.aiGovernance.featureBuildCount}; model selections {data.platformHealth.aiGovernance.modelSelectionCount}; recommendations {data.platformHealth.aiGovernance.recommendationCount}; blocked actions {data.platformHealth.aiGovernance.blockedActionCount}; approval-required {data.platformHealth.aiGovernance.approvalRequiredCount}; stale or low-quality inputs {data.platformHealth.aiGovernance.staleLowQualityInputCount}.</p><p>Adjusted confidence distribution low {data.platformHealth.aiGovernance.adjustedConfidenceDistribution.low}, medium {data.platformHealth.aiGovernance.adjustedConfidenceDistribution.medium}, high {data.platformHealth.aiGovernance.adjustedConfidenceDistribution.high}. Event sync {data.platformHealth.aiGovernance.eventSyncStatus}; audit sync {data.platformHealth.aiGovernance.auditSyncStatus}; twin sync {data.platformHealth.aiGovernance.twinSyncStatus}.</p></section>
        <section aria-label="Frontend error reporting"><h3>Frontend error reporting</h3><p>Reported errors {data.platformHealth.frontend.reportedErrors}; degraded mode {String(data.platformHealth.frontend.degradedMode)}; last error {data.platformHealth.frontend.lastErrorAt ?? 'none'}.</p>{data.platformHealth.frontend.degradedMode && <p role="status">Frontend degraded state active: cached read-only workspace remains available while controls stay locked.</p>}<EventTimeline label="Frontend and platform telemetry signals" events={data.platformHealth.signals.map((signal) => ({ time: signal.timestamp, label: `${signal.kind} ${signal.name} on ${signal.serviceId}; trace ${signal.traceId}; attributes ${Object.keys(signal.attributes).join(', ') || 'none'}`, tone: signal.severity }))} /></section>
        <section aria-label="Internet-facing deployment assumptions">
          <h3>Deployment assumptions</h3>
          <p>{data.platformHealth.deploymentBoundary.claim}</p>
          <p>Provider style: {data.platformHealth.deploymentBoundary.providerStyle}. Routing boundary: {data.platformHealth.deploymentBoundary.routingBoundary}</p>
          <p>Assumptions: {data.platformHealth.deploymentBoundary.assumptions.join(', ')}. Logging signals: {data.platformHealth.deploymentBoundary.loggingSignals.join(', ')}.</p>
          <p>Infrastructure implemented: {String(data.platformHealth.deploymentBoundary.implemented)}; copy-only label: {String(data.platformHealth.deploymentBoundary.copyOnly)}.</p>
        </section>
        </>}
      />}

      {showWorkspace('ai-governance') && <AIGovernancePanel ai={data.aiGovernance} />}

      {showWorkspace('api-hub') && <CanonicalDataExplorer data={data} />}

      {showWorkspace('executive') && <section aria-label="Executive Intelligence Center workspace">
        <h2>Executive Intelligence Center</h2>
        <MockDataBanner active={data.mode === 'mock'} source="Executive Center governed DTO facade" />
        <p>Read-only leadership surface derived from Operations Command, race-day readiness, compliance, AI governance, asset health, and platform observability. It provides decision context without direct operational mutation and does not assert unavailable revenue, wagering, attendance, or finance feeds are complete.</p>
        <p role="note">Executive Center is read-only: KPI cards link governed sources and coverage notes, while operational execution remains locked behind approval workflows.</p>
        <TenantSaasBoundaryPanel tenant={tenant} roles={roles} routeScope="executive" routeLabel="Executive Center" candidate={data.complianceLibrary.trackCertificationCandidate} />
        <KpiDashboard title="Executive Center" items={executiveKpis} aria-label="Executive Center KPI dashboard" />
        <TrendCardGrid ariaLabel="Executive trend cards" title="Executive trend cards" cards={executiveTrends} aria-label="Executive trend cards" />
        <ServiceHealthCards health={data.platformHealth} ariaLabel="Executive service health" title="Service health for leadership" aria-label="Executive service health" />
        <section aria-label="Executive safety KPI dashboard"><h3>Safety KPIs</h3><MetricStrip items={[
          { label: 'Safety score', value: executiveKpis[0].value, detail: data.emergencyOperations.activeEmergencyStatus },
          { label: 'Security alerts', value: String(data.securityOperations.dashboard.activeAlerts), detail: `${data.securityOperations.dashboard.investigationQueue} investigations queued` },
          { label: 'Emergency workflows', value: String(data.emergencyOperations.workflowIntegrations?.length ?? 0), detail: `${data.emergencyOperations.resources.length} response resources` },
          { label: 'AI blocked actions', value: String(data.platformHealth.aiGovernance.blockedActions), detail: 'Protected actions remain approval gated' },
        ]} /></section>
        <section aria-label="Executive compliance KPI dashboard"><h3>Compliance KPIs</h3><MetricStrip items={[
          { label: 'Readiness', value: String(data.complianceLibrary.readiness.score), detail: `${data.complianceLibrary.readiness.evidenceCoverage}% evidence coverage` },
          { label: 'Open findings', value: String(data.complianceLibrary.readiness.openFindings), detail: `${data.complianceLibrary.readiness.overdueActions} overdue actions` },
          { label: 'Frameworks', value: String(data.complianceLibrary.frameworks.length), detail: data.complianceLibrary.frameworks.slice(0, 4).map((framework) => framework.id).join(', ') },
          { label: 'Audit records', value: String(data.platformHealth.audit.records), detail: `Ledger valid ${String(data.platformHealth.audit.validLedger)}` },
        ]} /></section>
        <section aria-label="Executive asset health dashboard"><h3>Asset health</h3><MetricStrip items={[
          { label: 'Track assets', value: String(data.trackMap.assets.length), detail: Object.entries(assetHealth).map(([status, count]) => `${status}:${count}`).join(', ') || 'no assets' },
          { label: 'Facility readiness', value: String(data.facilitiesMaintenance.readiness.score), detail: `${data.facilitiesMaintenance.readiness.watch} watch / ${data.facilitiesMaintenance.readiness.blocked} blocked` },
          { label: 'Digital Twins', value: String(data.platformHealth.digitalTwin.totalTwins), detail: `${data.platformHealth.digitalTwin.queuedSync} queued sync` },
          { label: 'Work orders', value: String(data.facilitiesMaintenance.workOrders.length), detail: 'Execution requires approvals' },
        ]} /></section>
        <section aria-label="Executive operational readiness"><h3>Operational readiness</h3><RiskBadge level={healthRiskLevel(data.platformHealth.overallStatus)} /><p>Readiness {data.readiness.averageScore}; approvals pending {pendingApprovalCount}; workflows active {data.platformHealth.workflows.active}; event throughput {data.platformHealth.eventBus.eventsPerMinute}/min.</p></section>
        <section aria-label="Executive operational drill-down">
          <h3>Operational drill-down</h3>
          <DataTable label="Executive operational drill-down metrics" rows={executiveDrillDownRows} getRowKey={(row) => row.id} columns={[
            { key: 'area', header: 'Area', render: (row) => row.area },
            { key: 'status', header: 'Status', render: (row) => <StatusCard title={row.area} status={row.status} detail={row.value} /> },
            { key: 'route', header: 'Drill-down', render: (row) => <a href={row.route}>{row.route}</a> },
            { key: 'source', header: 'Source / coverage', render: (row) => row.source },
          ]} />
        </section>
        <section aria-label="Executive briefing cards">
          {data.operations.aiRecommendations.map((recommendation) => <WorkspacePanel key={recommendation.id} title={recommendation.recommendation} eyebrow="Executive decision cue"><p>Confidence {Math.round(recommendation.confidence * 100)}%; approval required {String(recommendation.requiresApproval)}; evidence {recommendation.evidence.join(', ')}.</p></WorkspacePanel>)}
          <WorkspacePanel title="Compliance audit posture" eyebrow="Governance"><p>Readiness {data.complianceLibrary.readiness.score}; evidence coverage {data.complianceLibrary.readiness.evidenceCoverage}%; open findings {data.complianceLibrary.readiness.openFindings}.</p></WorkspacePanel>
          <WorkspacePanel title="Platform resilience posture" eyebrow="Operations"><p>{data.platformHealth.overallStatus}; event bus {data.platformHealth.eventBus.status}; audit ledger valid {String(data.platformHealth.audit.validLedger)}.</p></WorkspacePanel>
          <WorkspacePanel title="Unavailable revenue coverage" eyebrow="Source coverage"><p>Revenue KPI is marked not connected because no revenue backend DTO is loaded by this center.</p></WorkspacePanel>
        </section>
        <section aria-label="Executive mock and placeholder coverage">
          <h3>Mock and placeholder coverage</h3>
          <p>{data.mode === 'mock' ? 'Mock adapter active for executive context; cards remain read-only and source-labelled.' : 'Live adapter active; unavailable domains still stay labelled as placeholders.'}</p>
          <p>Revenue, wagering, attendance, and finance telemetry are not connected. Weather, declaration, simulation, and selected surface views may be approved placeholders depending on the backend payload.</p>
        </section>
      </section>}

      {showWorkspace('compliance') && <CompliancePanel compliance={data.complianceLibrary} ai={data.aiGovernance} />}

      {showWorkspace('race-office') && RaceOfficePanel({ workspace: data.raceOffice, mode: data.mode, authenticated })}


      {showWorkspace('surface') && <SurfaceIntelligenceWorkspace workspace={data.surfaceIntelligence} mode={data.mode} />}

      {showWorkspace('equine') && <section aria-label="Equine Intelligence workspace">
        <h2>Equine Intelligence</h2>
        <p>Vertical slice for horse profiles, ownership, trainer assignment, race history, workout history, veterinary status placeholders, eligibility, welfare, barn assignment, and read-only Digital Twin references.</p>
        <p>AI or system-generated equine risk recommendations are advisory only and require licensed veterinarian review before affecting operations.</p>
        <MockDataBanner active={data.equineIntelligence.mock || data.barnOperations.mock} source="Equine Intelligence/Barn Operations mock-live boundary" />
        <p>{data.equineIntelligence.mock || data.barnOperations.mock ? 'MOCK DATA boundary: Equine Intelligence and Barn Operations are displayed through the unified mock/live API client; controls create approval requests only.' : 'LIVE READ-ONLY boundary: Equine Intelligence and Barn Operations are displayed through the unified API client; controls still require approvals.'}</p>
        <section aria-label="Equine command dashboard">
          <h3>Horse profile command dashboard</h3>
          <MetricStrip items={[
            { label: 'Eligibility', value: data.equineIntelligence.eligibilityStatus.eligible ? 'eligible' : 'locked', detail: `${data.equineIntelligence.eligibilityStatus.complianceStatus}; failed ${data.equineIntelligence.eligibilityStatus.failedRules.join(', ') || 'none'}` },
            { label: 'Welfare', value: data.equineIntelligence.welfareStatus.level, detail: `Score ${data.equineIntelligence.welfareStatus.latestScore ?? 'unknown'}; interventions ${data.equineIntelligence.welfareStatus.interventions.join(', ') || 'none'}` },
            { label: 'Vet review', value: veterinarianReviewRequired ? 'required' : 'not required', detail: 'Health AI advisory outputs cannot change operations until a human veterinarian records review' },
            { label: 'Boundary', value: data.equineIntelligence.mock ? 'MOCK DATA' : 'LIVE READ-ONLY', detail: 'Frontend shows profile state and creates approval requests only; no direct local mutation of safety-critical state' },
          ]} />
        </section>
        <section aria-label="Horse Registry and barn operations alignment">
          <h3>Horse Registry alignment</h3>
          <MetricStrip items={[
            { label: 'Registry horse', value: registryHorse.name, detail: `${registryHorse.horseId}; ${registryHorse.lifecycleStatus}` },
            { label: 'Barn occupancy', value: registryOccupancy ? `${registryOccupancy.barnId} / ${registryStall?.label ?? registryOccupancy.stallId}` : 'Missing', detail: registryOccupancy ? `Twin ${registryOccupancy.twinId}; audit ${registryOccupancy.auditId}` : 'No Barn Operations occupancy record' },
            { label: 'Trainer mirror', value: activeTrainer?.trainerName ?? 'Unassigned', detail: activeBarnTrainer ? `Active in Barn Operations as ${activeBarnTrainer.trainerId}` : 'Needs barn assignment review' },
            { label: 'Veterinary visits', value: String(horseVetVisits.length), detail: horseVetVisits.map((visit) => `${visit.veterinarianId} ${visit.visitAt}`).join('; ') || 'No visit records in Barn Operations' },
          ]} />
          <div>
            <WorkspacePanel title="Horse Registry" eyebrow="Equine Intelligence">
              <p>{registryHorse.horseId}; microchip {registryHorse.microchipId ?? 'not recorded'}; eligibility {data.equineIntelligence.eligibilityStatus.complianceStatus}; welfare {data.equineIntelligence.welfareStatus.level}.</p>
            </WorkspacePanel>
            <WorkspacePanel title="Barn Operations mirror" eyebrow="Barn Operations">
              <p>{registryOccupancy ? `${registryOccupancy.horseId} occupies ${registryOccupancy.barnId} / ${registryStall?.label ?? registryOccupancy.stallId}; assigned by ${registryOccupancy.assignedBy}.` : 'No matching occupancy record.'}</p>
            </WorkspacePanel>
          </div>
        </section>
        <section aria-label="Veterinarian-review-required warnings">
          <h3>Veterinarian-review-required warnings</h3>
          <NotificationList items={harmonizedEquineBarnWarnings} />
          {veterinarianReviewRequired && <article role="alert"><RiskBadge level="high" /><strong>Health AI advisory lock</strong><p>Veterinarian review is required before eligibility, welfare, veterinary restrictions, or barn operations are changed from AI recommendations.</p></article>}
        </section>
        <section aria-label="Horse profile detail"><h3>{data.equineIntelligence.horse.name}</h3><p>{data.equineIntelligence.horse.horseId} · {data.equineIntelligence.horse.lifecycleStatus} · microchip {data.equineIntelligence.horse.microchipId ?? 'not recorded'} · tenant {data.equineIntelligence.horse.tenantId ?? equinePrivacy.tenantId}</p></section>
        <section aria-label="Horse ownership"><h3>Ownership</h3><DataTable label="Horse ownership records" rows={data.equineIntelligence.ownership} getRowKey={(owner) => owner.ownerId} columns={[{ key: 'owner', header: 'Owner', render: (owner) => owner.ownerName }, { key: 'share', header: 'Share', align: 'right', render: (owner) => `${owner.percentage}%` }, { key: 'effective', header: 'Effective', render: (owner) => `${owner.effectiveFrom}${owner.effectiveTo ? ` to ${owner.effectiveTo}` : ''}` }]} /></section>
        <section aria-label="Trainer assignment"><h3>Trainer assignment</h3><DataTable label="Trainer assignment records" rows={data.equineIntelligence.trainerAssignments} getRowKey={(trainer) => trainer.trainerId} columns={[{ key: 'trainer', header: 'Trainer', render: (trainer) => trainer.trainerName }, { key: 'license', header: 'License', render: (trainer) => <StatusCard title={trainer.trainerId} status={trainer.licenseStatus} detail={activeBarnTrainer?.trainerId === trainer.trainerId ? 'Mirrored in Barn Operations' : 'Needs Barn Operations mirror check'} /> }, { key: 'effective', header: 'Effective', render: (trainer) => `${trainer.effectiveFrom}${trainer.effectiveTo ? ` to ${trainer.effectiveTo}` : ''}` }]} /></section>
        <section aria-label="Race history"><h3>Race history</h3><DataTable label="Horse race history records" rows={data.equineIntelligence.raceHistory} getRowKey={(race) => race.raceId} columns={[{ key: 'race', header: 'Race', render: (race) => race.raceId }, { key: 'date', header: 'Date', render: (race) => race.date }, { key: 'track', header: 'Track', render: (race) => race.trackId }, { key: 'status', header: 'Status', render: (race) => race.status }, { key: 'finish', header: 'Finish', align: 'right', render: (race) => race.finishPosition ?? 'n/a' }]} /></section>
        <section aria-label="Workout history"><h3>Workout history</h3><DataTable label="Horse workout history records" rows={data.equineIntelligence.workoutHistory} getRowKey={(workout) => workout.workoutId} columns={[{ key: 'workout', header: 'Workout', render: (workout) => workout.workoutId }, { key: 'date', header: 'Date', render: (workout) => workout.date }, { key: 'distance', header: 'Distance', align: 'right', render: (workout) => `${workout.distanceFurlongs}f` }, { key: 'time', header: 'Time', align: 'right', render: (workout) => `${workout.timeSeconds}s` }, { key: 'surface', header: 'Surface', render: (workout) => workout.surface }]} /></section>
        <section aria-label="Transportation records"><h3>Transportation records</h3>{equineTransportationRecords.map((trip) => <article key={trip.tripId}><strong>{trip.from} to {trip.to}</strong><p>{trip.departedAt} to {trip.arrivedAt ?? 'in transit'}; transporter {trip.transporter}; welfare checks {trip.welfareChecks.join(', ') || 'none'}</p></article>)}</section>
        <section aria-label="Veterinary status placeholder"><h3>Veterinary status</h3><p>{data.equineIntelligence.veterinaryStatus.status}: {data.equineIntelligence.veterinaryStatus.summary}; veterinarian required {String(data.equineIntelligence.veterinaryStatus.requiresVeterinarian)}</p></section>
        <section aria-label="Eligibility status"><h3>Eligibility</h3><RiskBadge level={equineEligibilityRisk(data.equineIntelligence.eligibilityStatus.eligible, data.equineIntelligence.eligibilityStatus.complianceStatus)} /><p>Eligible {String(data.equineIntelligence.eligibilityStatus.eligible)}; compliance {data.equineIntelligence.eligibilityStatus.complianceStatus}; flags {data.equineIntelligence.eligibilityStatus.flags.join(', ')}</p><p>Failed rules {data.equineIntelligence.eligibilityStatus.failedRules.join(', ') || 'none'}.</p></section>
        <section aria-label="Eligibility rule tracking"><h3>Eligibility rules</h3>{equineEligibilityRules.map((rule) => <article key={rule.id} role={rule.passed ? 'status' : 'alert'}><strong>{rule.id}: {rule.passed ? 'passed' : 'failed'}</strong><p>{rule.description}; failure status {rule.failureStatus}</p></article>)}</section>
        <section aria-label="Welfare status"><h3>Welfare</h3><RiskBadge level={equineWelfareRisk(data.equineIntelligence.welfareStatus.level)} /><p>{data.equineIntelligence.welfareStatus.level}; score {data.equineIntelligence.welfareStatus.latestScore ?? 'unknown'}; interventions {data.equineIntelligence.welfareStatus.interventions.join(', ') || 'none'}</p></section>
        <section aria-label="Welfare tracking records"><h3>Welfare tracking</h3>{equineWelfareRecords.map((record) => <article key={record.recordId}><strong>Score {record.score}</strong><p>{record.observedAt}; observer {record.observerId}; {record.notes}; interventions {record.interventions.join(', ') || 'none'}</p></article>)}</section>
        <section aria-label="Barn assignment"><h3>Barn assignment</h3><p>{data.equineIntelligence.barnAssignment.barnId} stall {data.equineIntelligence.barnAssignment.stallId}; assigned {data.equineIntelligence.barnAssignment.assignedAt}</p><p>Cross-check {equineBarnAligned ? 'matches Barn Operations occupancy' : 'requires reconciliation with Barn Operations'}.</p></section>
        <section aria-label="Equine Digital Twin references"><h3>Digital Twin references</h3>{data.equineIntelligence.digitalTwinReferences.map((ref) => <article key={ref.twinId}><strong>{ref.twinId}</strong><p>{ref.twinType}; {ref.relationship}; source {ref.sourceSystem}; read-only {String(ref.readOnly)}</p></article>)}</section>
        <section aria-label="Equine relationship map"><h3>Relationship map</h3>{equineRelationships.map((relationship) => <article key={relationship.id}><strong>{relationship.type}: {relationship.fromId} to {relationship.toId}</strong><p>Effective {relationship.effectiveFrom}{relationship.effectiveTo ? ` to ${relationship.effectiveTo}` : ''}; evidence {relationship.evidence.join(', ') || 'none'}</p></article>)}</section>
        <section aria-label="Equine integration status"><h3>Integrations</h3><MetricStrip items={Object.entries(equineIntegrations).map(([label, enabled]) => ({ label, value: enabled ? 'connected' : 'pending', detail: 'Equine Intelligence contract' }))} /><p>Tenant privacy boundary {equinePrivacy.tenantId}; veterinary records visible {equinePrivacy.veterinaryRecordsVisible}; redacted {equinePrivacy.veterinaryRecordsRedacted}.</p></section>
        <section aria-label="Equine observability"><h3>Observability</h3><MetricStrip items={[{ label: 'Vet reviews', value: String(equineObservability.pendingVeterinarianReviews), detail: 'Pending veterinarian review' }, { label: 'Open approvals', value: String(equineObservability.openApprovals), detail: 'Approval queue' }, { label: 'Audit records', value: String(equineObservability.auditRecords), detail: 'Immutable ledger' }, { label: 'Events', value: String(equineObservability.eventCount), detail: 'Event bus records' }, { label: 'Twin states', value: String(equineObservability.twinStates), detail: 'Digital Twin references' }, { label: 'Advisories', value: String(equineObservability.advisoryRecommendations), detail: 'Advisory AI outputs' }]} /></section>
        <section aria-label="Equine advisory AI recommendations"><h3>Advisory AI risk recommendations</h3>{data.equineIntelligence.aiRiskRecommendations.map((rec) => <article key={rec.id} role={rec.veterinarianReviewRequired ? 'alert' : 'status'}><strong>{rec.summary}</strong><p>Advisory only {String(rec.advisoryOnly)}; veterinarian review required {String(rec.veterinarianReviewRequired)}; status {rec.status}</p><p>Proposed action {rec.proposedOperationalAction ?? 'none'} remains locked until approval.</p></article>)}</section>
        <section aria-label="Equine approvals"><h3>Approvals</h3>{data.equineIntelligence.approvals.map((approval) => <article key={approval.id}><ApprovalChip status={equineApprovalStatus(approval.status)} /><strong>{approval.action}</strong><p>{approval.status}; required role {approval.requiredRole}</p></article>)}</section>
        <section aria-label="Equine audit records"><h3>Audit records</h3>{data.equineIntelligence.audit.map((audit) => <article key={audit.id}><code>{audit.id}</code><p>{audit.actor}; {audit.action}; {audit.timestamp}</p></article>)}</section>
        <section aria-label="Equine event stream"><h3>Events</h3>{data.equineIntelligence.events.map((event) => <article key={event.eventId}><strong>{event.type}</strong><p>audit {event.auditId}</p></article>)}</section>
        <section aria-label="Equine approval gates"><h3>Approval locked controls</h3><p>Restricted eligibility, veterinary, and barn-transfer actions are approval-gated and audit/event aware. This panel never mutates local safety-critical state directly.</p><ActionRail actions={[
          { id: 'vet-review', label: 'Request veterinarian AI risk review', detail: 'Creates a review request only; Health AI remains advisory until a human veterinarian records a decision.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
          { id: 'eligibility-change', label: 'Request eligibility change approval', detail: 'Queues eligibility changes for authorized review; no local eligibility state is mutated.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
          { id: 'barn-transfer', label: 'Request barn transfer approval', detail: 'Routes transfer intent through Barn Operations approval and audit workflows.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
        ]} /></section>
      </section>}

      {showWorkspace('safety') && <SafetyCenterOverview data={data} />}

      {showWorkspace('stewards') && StewardCenterWorkspace({ data, roles, authenticated })}

      {showWorkspace('security') && <section aria-label="Security Operations workspace">
        <h2>Security Operations</h2>
        <DataFreshness label="Security operations" timestamp={data.securityOperations.events[0]?.timestamp ?? data.securityOperations.auditRecords[0]?.timestamp} mode={data.mode} />
        <p>End-to-end security command surface for restricted zones, access events, camera health, active incidents, investigations, visitor and credential records, audit, event streams, Digital Twin updates, and asset registry links.</p>
        <p>Sensitive security details are masked unless the current role has security management permission or an approved sensitive-read gate. Critical security actions are approval/audit/event aware backend requests only; this console never mutates critical state locally.</p>
        {MockDataBanner({ active: data.securityOperations.mock || data.mode === 'mock', source: 'security operations approved mock adapter' })}
        <section aria-label="Security dashboard widgets"><h3>Dashboard widgets</h3><MetricStrip items={[
          { label: 'Active alerts', value: String(data.securityOperations.dashboard.activeAlerts), detail: `${data.securityOperations.dashboard.criticalIncidents ?? 0} critical incidents` },
          { label: 'Restricted-zone events', value: String(data.securityOperations.dashboard.restrictedZoneEvents), detail: `${data.securityOperations.accessEvents.length} loaded access events` },
          { label: 'Camera health', value: healthSummary(data.securityOperations.dashboard.cameraHealth), detail: `${data.securityOperations.cameras.length} cameras` },
          { label: 'Investigation queue', value: String(data.securityOperations.dashboard.investigationQueue), detail: `${data.securityOperations.dashboard.openEscalations ?? data.securityOperations.escalations.length} open escalations` },
        ]} /></section>
        <SecurityEmergencyCoordination data={data} canViewSensitiveSecurity={canViewSensitiveSecurity} />
        <section aria-label="Restricted zones"><h3>Restricted zones</h3><p>Restricted zone roster is rendered from the SecurityOperationsDto; credential fields stay masked until permission or approval allows reveal.</p><DataTable label="Restricted zone roster" rows={data.securityOperations.restrictedZones} getRowKey={(zone) => zone.id} columns={[
          { key: 'zone', header: 'Zone', render: (zone) => <><RiskBadge level={zoneRiskLevel(zone.classification)} /> {zone.name}</> },
          { key: 'classification', header: 'Classification', render: (zone) => zone.classification },
          { key: 'credential', header: 'Credential', render: (zone) => <SensitiveField value={zone.requiredCredential} authorized={canViewSensitiveSecurity} /> },
          { key: 'cameras', header: 'Cameras', render: (zone) => zone.cameraIds.join(', ') || 'none' },
          { key: 'backend', header: 'Backend links', render: (zone) => `${zone.assetId ?? 'asset pending'} / ${zone.twinId ?? 'twin pending'}` },
        ]} /></section>
        <section aria-label="Access-control events"><h3>Access-control events</h3><DataTable label="Access-control events" rows={data.securityOperations.accessEvents} getRowKey={(event) => event.id} columns={[
          { key: 'person', header: 'Person', render: (event) => event.personDisplayName },
          { key: 'decision', header: 'Decision', render: (event) => <ApprovalChip status={event.decision === 'granted' ? 'approved' : 'rejected'} /> },
          { key: 'zone', header: 'Zone', render: (event) => event.zoneId },
          { key: 'credential', header: 'Credential', render: (event) => event.credentialId },
          { key: 'reason', header: 'Reason', render: (event) => event.reason },
          { key: 'audit', header: 'Event / audit', render: (event) => `${event.eventId} / ${event.auditId}` },
        ]} /></section>
        <section aria-label="Camera assets"><h3>Camera assets</h3>{data.securityOperations.cameras.map((camera) => <WorkspacePanel key={camera.id} title={camera.label} eyebrow={camera.zoneId}><AssetHealthIndicator label={camera.label} status={camera.health === 'online' ? 'healthy' : camera.health === 'degraded' ? 'degraded' : 'offline'} /><p>Privacy masking {String(camera.privacyMasking)}; last heartbeat {camera.lastHeartbeatAt}; coverage {(camera.coverage ?? []).join(', ') || 'not reported'}.</p><p>Asset {camera.assetId ?? 'pending'}; twin {camera.twinId ?? 'pending'}; camera state is backend-owned.</p></WorkspacePanel>)}</section>
        <section aria-label="Security incidents"><h3>Security incidents</h3>{data.securityOperations.incidents.map((incident) => <WorkspacePanel key={incident.id} title={incident.title} eyebrow="Active security incident"><RiskBadge level={incident.severity} /><ApprovalChip status={approvalChipStatus(incident.approvalRequestId ? 'pending' : incident.status)} /><p>{incident.status}; zone {incident.zoneId}; events {incident.eventIds.join(', ')}; audit {incident.auditId}; approval {incident.approvalRequestId ?? 'not requested'}.</p></WorkspacePanel>)}
          {collaborationIncident && <CollaborationPanel
            routeScope="security"
            title="Security Incident Room"
            targetArtifactId={collaborationIncident.id}
            targetArtifactType="security-incident"
            tenantId={tenant.id}
            racetrackId={tenant.id}
            workflowRef={collaborationIncidentEscalation?.id}
            approvalRef={collaborationIncident.approvalRequestId ?? collaborationIncidentInvestigation?.approvalRequestId ?? collaborationIncidentEscalation?.approvalRequestId}
            auditRefs={[collaborationIncident.auditId, collaborationIncidentInvestigation?.auditId, collaborationIncidentEscalation?.auditId, ...data.securityOperations.events.filter((event) => event.subjectId === collaborationIncident.id || collaborationIncident.eventIds.includes(event.id)).map((event) => event.auditId)].filter(Boolean) as string[]}
            twinRefs={Array.from(new Set(collaborationIncidentTwinRefs))}
            evidenceRefs={[...collaborationIncident.eventIds, ...(collaborationIncidentInvestigation?.evidence ?? []), collaborationIncident.auditId]}
            variant="incident-room"
            activityItems={[
              { id: `${collaborationIncident.id}-created`, actor: collaborationIncident.assignedTo ?? 'security-operations', message: `${collaborationIncident.title}; status ${collaborationIncident.status}; zone ${collaborationIncident.zoneId}.`, at: collaborationIncident.createdAt, tone: collaborationIncident.severity },
              ...(collaborationIncidentInvestigation ? [{ id: collaborationIncidentInvestigation.id, actor: collaborationIncidentInvestigation.lead, message: `Investigation ${collaborationIncidentInvestigation.status}; evidence ${canViewSensitiveSecurity ? collaborationIncidentInvestigation.evidence.join(', ') : 'masked pending permission'}.`, at: collaborationIncidentInvestigation.openedAt, tone: 'warning' as const }] : []),
            ]}
          />}
        </section>
        <section aria-label="Incident timeline widget"><h3>Incident timeline</h3><EventTimeline events={data.securityOperations.dashboard.incidentTimeline.map((entry) => ({ time: entry.at, label: entry.label, tone: entry.severity }))} /></section>
        <section aria-label="Investigation queue widget"><h3>Investigation queue</h3>{data.securityOperations.investigations.map((item) => <WorkspacePanel key={item.id} title={`${item.incidentId}: ${item.status}`} eyebrow="Investigation queue"><p>Lead {item.lead}; evidence <SensitiveField value={item.evidence.join(', ')} authorized={canViewSensitiveSecurity} />; audit {item.auditId}; approval {item.approvalRequestId ?? 'not required'}.</p></WorkspacePanel>)}</section>
        <section aria-label="Watchlist placeholders"><h3>Watchlist placeholders</h3>{data.securityOperations.watchlistPlaceholders.map((item) => <WorkspacePanel key={item.id} title={item.displayLabel} eyebrow="Placeholder/mock-sensitive"><p>{item.category}; notes <SensitiveField value={item.sensitiveNotes} authorized={canViewSensitiveSecurity} />; human review required {String(item.requiresHumanReview)}.</p><p role="status">Placeholder/mock label: watchlist data is intentionally redacted until a live governed source is configured.</p></WorkspacePanel>)}</section>
        <section aria-label="Visitor logs"><h3>Visitor logs</h3>{data.securityOperations.visitorLogs.map((visitor) => <StatusCard key={visitor.id} title={visitor.visitorDisplayName} status="logged" detail={`Host ${visitor.host}; zone ${visitor.zoneId}; credential check ${visitor.credentialCheckId}; audit ${visitor.auditId}.`} />)}</section>
        <section aria-label="Credential checks"><h3>Credential checks</h3>{data.securityOperations.credentialChecks.map((check) => <StatusCard key={check.id} title={`${check.holderDisplayName}: ${check.status}`} status={check.decision} detail={`Credential ${check.credentialId}; required ${check.requiredCredential ?? 'not reported'}; audit ${check.auditId}.`} />)}</section>
        <section aria-label="Escalation workflows"><h3>Escalation workflows</h3>{data.securityOperations.escalations.map((flow) => <WorkspacePanel key={flow.id} title={`${flow.status}: ${flow.reason}`} eyebrow="Approval-aware escalation"><ApprovalChip status={approvalChipStatus(flow.approvalRequestId ? 'pending' : flow.status)} /><p>Route {flow.routeTo.join(' -> ')}; audit {flow.auditId}; approval {flow.approvalRequestId ?? 'pending if critical'}.</p></WorkspacePanel>)}</section>
        <section aria-label="Security audit records"><h3>Audit records</h3>{data.securityOperations.auditRecords.map((audit) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.action}; actor {audit.actorId}; subject {audit.subjectId}; previous {audit.previousHash}; sensitive fields {audit.sensitiveFields.join(', ') || 'none'}</p></article>)}</section>
        <section aria-label="Security shared audit records"><h3>Shared audit integration</h3>{data.securityOperations.sharedAuditRecords.map((audit) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.type}; actor {audit.actor}; subject {audit.subjectId}; severity {audit.severity}; previous {audit.previousHash}</p></article>)}</section>
        <section aria-label="Security event stream"><h3>Event stream</h3><EventTimeline events={data.securityOperations.events.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.subjectId}; audit ${event.auditId}`, tone: event.severity }))} /></section>
        <section aria-label="Security Digital Twin updates"><h3>Digital Twin updates</h3>{data.securityOperations.twinUpdates.map((update) => <article key={`${update.twinId}-${update.auditId}`}><strong>{update.twinId}: {update.status}</strong><p>Source {update.sourceId}; audit {update.auditId}; patch keys {Object.keys(update.patch).join(', ')}</p></article>)}</section>
        <section aria-label="Security asset registry links"><h3>Asset registry links</h3>{data.securityOperations.assetRegistryLinks.map((link) => <article key={`${link.assetId}-${link.auditId}`}><strong>{link.assetId}: {link.registryStatus}</strong><p>Source {link.sourceType} {link.sourceId}; twin {link.twinId}; audit {link.auditId}</p></article>)}</section>
        <section aria-label="Security observability signals"><h3>Observability</h3>{data.securityOperations.observabilitySignals.map((signal) => <article key={`${signal.traceId}-${signal.timestamp}`}><strong>{signal.serviceId}: {signal.name}</strong><p>{signal.kind}; severity {signal.severity}; trace {signal.traceId}; attributes {Object.keys(signal.attributes).join(', ')}</p></article>)}</section>
        <section aria-label="Security approval gates"><h3>Approval gates</h3>{data.securityOperations.approvalGates.map((gate) => <WorkspacePanel key={gate.id} title={`${gate.action}: ${gate.status}`} eyebrow="Security approval gate"><ApprovalChip status={approvalChipStatus(gate.status)} /><p>Target {gate.target}; reason {gate.reason}; evidence {gate.evidence.join(', ')}</p></WorkspacePanel>)}{ActionRail({ actions: securityApprovalActions() })}</section>
      </section>}

      {showWorkspace('emergency') && <section aria-label="Emergency Operations command view">
        <h2>Emergency Operations</h2>
        <DataFreshness label="Emergency operations" timestamp={data.emergencyOperations.observability?.lastSignalAt ?? data.emergencyOperations.events[0]?.timestamp} mode={data.mode} />
        {MockDataBanner({ active: data.emergencyOperations.mock || data.mode === 'mock', source: 'emergency operations approved mock adapter' })}
        <p>Active emergency status: <strong>{data.emergencyOperations.activeEmergencyStatus}</strong></p>
        {data.emergencyOperations.workforceReadiness && <p>Workforce emergency readiness: {data.emergencyOperations.workforceReadiness.status} at {data.emergencyOperations.workforceReadiness.score}; gaps {data.emergencyOperations.workforceReadiness.emergencyGaps.join(', ') || 'none'}.</p>}
        <p>Emergency guardrail: {data.emergencyOperations.emergencyActions.reason} AI may block actions: {String(data.emergencyOperations.emergencyActions.aiMayBlock)}.</p>
        <SecurityEmergencyCoordination data={data} canViewSensitiveSecurity={canViewSensitiveSecurity} />
        <section aria-label="Emergency plans"><h3>Emergency plans</h3><DataTable label="Emergency plans" rows={data.emergencyOperations.plans} getRowKey={(plan) => plan.id} columns={[
          { key: 'plan', header: 'Plan', render: (plan) => plan.name },
          { key: 'scenarios', header: 'Scenarios', render: (plan) => plan.scenarios.join(', ') },
          { key: 'criteria', header: 'Activation criteria', render: (plan) => plan.activationCriteria.join(', ') },
          { key: 'drill', header: 'Drill cadence', render: (plan) => `${plan.drillCadenceDays} days` },
        ]} /></section>
        <section aria-label="Incident command roles"><h3>Incident command roles</h3>{data.emergencyOperations.commandRoles.map((role) => <WorkspacePanel key={role.id} title={`${role.role}: ${role.assignee}`} eyebrow="Human authority"><p>Permissions {role.permissions.join(', ')}. Human command roles own operational continuity and emergency execution.</p></WorkspacePanel>)}</section>
        <section aria-label="Emergency resources roster"><h3>Emergency resources</h3>{data.emergencyOperations.resources.map((resource) => <StatusCard key={resource.id} title={resource.label} status={resource.status} detail={`${resource.kind}; zone ${resource.zoneId}; capacity ${resource.capacity ?? 'n/a'}; coordinates ${resource.coordinates.latitude}, ${resource.coordinates.longitude}.`} />)}</section>
        <section aria-label="Emergency resource map"><h3>Resource map</h3>{data.emergencyOperations.resourceMap.map((resource) => <StatusCard key={resource.id} title={resource.label} status={resource.status} detail={`${resource.kind}; ${resource.zoneId}; ${resource.coordinates.latitude}, ${resource.coordinates.longitude}.`} />)}</section>
        <section aria-label="Medical fire and severe weather response"><h3>Response plans</h3><EmergencyResponseCard title="Medical" lead={data.emergencyOperations.medicalResponse.lead} checklist={data.emergencyOperations.medicalResponse.checklist} aiMayBlock={data.emergencyOperations.medicalResponse.aiMayBlock} workflowDefinitionId={data.emergencyOperations.medicalResponse.workflowDefinitionId} slaMinutes={data.emergencyOperations.medicalResponse.slaMinutes} authorityStatement={data.emergencyOperations.medicalResponse.authorityStatement} /><EmergencyResponseCard title="Fire" lead={data.emergencyOperations.fireResponse.lead} checklist={data.emergencyOperations.fireResponse.checklist} aiMayBlock={data.emergencyOperations.fireResponse.aiMayBlock} workflowDefinitionId={data.emergencyOperations.fireResponse.workflowDefinitionId} slaMinutes={data.emergencyOperations.fireResponse.slaMinutes} authorityStatement={data.emergencyOperations.fireResponse.authorityStatement} /><EmergencyResponseCard title="Severe weather" lead={data.emergencyOperations.severeWeatherResponse.lead} checklist={data.emergencyOperations.severeWeatherResponse.checklist} aiMayBlock={data.emergencyOperations.severeWeatherResponse.aiMayBlock} workflowDefinitionId={data.emergencyOperations.severeWeatherResponse.workflowDefinitionId} slaMinutes={data.emergencyOperations.severeWeatherResponse.slaMinutes} authorityStatement={data.emergencyOperations.severeWeatherResponse.authorityStatement} /></section>
        {data.emergencyOperations.evacuationProcedure && <section aria-label="Evacuation procedure workflow"><h3>Evacuation procedure workflow</h3><EmergencyResponseCard title="Evacuation" lead={data.emergencyOperations.evacuationProcedure.lead} checklist={data.emergencyOperations.evacuationProcedure.checklist} aiMayBlock={data.emergencyOperations.evacuationProcedure.aiMayBlock} workflowDefinitionId={data.emergencyOperations.evacuationProcedure.workflowDefinitionId} slaMinutes={data.emergencyOperations.evacuationProcedure.slaMinutes} authorityStatement={data.emergencyOperations.evacuationProcedure.authorityStatement} /></section>}
        <section aria-label="Emergency workflow integrations"><h3>Workflow integrations</h3>{(data.emergencyOperations.workflowIntegrations ?? []).map((integration) => <WorkspacePanel key={`${integration.engine}-${integration.status}`} title={`${integration.engine}: ${integration.status}`} eyebrow="Workflow orchestration"><p>Engine {integration.engine}; definitions {integration.definitionIds.join(', ')}; instance {integration.instanceId ?? 'not started'}; human task roles {integration.humanTaskRoles.join(', ')}</p></WorkspacePanel>)}</section>
        <section aria-label="Emergency approval posture"><h3>Approval posture</h3><MetricStrip items={[{ label: 'Mode', value: data.emergencyOperations.approvalPosture?.mode ?? 'post-action-evidence', detail: data.emergencyOperations.approvalPosture?.action ?? 'emergency-action' }, { label: 'Human authority', value: String(data.emergencyOperations.approvalPosture?.emergencyPersonnelAuthority ?? true), detail: 'Emergency personnel authority is preserved' }, { label: 'AI may block', value: String(data.emergencyOperations.approvalPosture?.aiMayBlock ?? false), detail: 'AI cannot block emergency actions' }, { label: 'Approval', value: data.emergencyOperations.approvalPosture?.approvalRequestId ?? 'post-action evidence', detail: data.emergencyOperations.approvalPosture?.target ?? 'active emergency' }]} /><p>{data.emergencyOperations.approvalPosture?.reason ?? data.emergencyOperations.emergencyActions.reason}</p>{ActionRail({ actions: emergencyApprovalActions() })}</section>
        <section aria-label="Emergency Digital Twin patches"><h3>Digital Twin patches</h3>{(data.emergencyOperations.digitalTwinPatches ?? []).map((patch) => <article key={`${patch.twinId}-${patch.eventId ?? patch.observedAt}`}><strong>{patch.twinId}: {patch.status}</strong><p>Actor {patch.actor}; observed {patch.observedAt}; event {patch.eventId ?? 'queued'}; patch keys {Object.keys(patch.patch).join(', ')}</p></article>)}</section>
        {data.emergencyOperations.observability && <section aria-label="Emergency observability"><h3>Observability</h3><p>{data.emergencyOperations.observability.serviceId}: {data.emergencyOperations.observability.healthSignal}; active workflows {data.emergencyOperations.observability.activeWorkflows}; open incidents {data.emergencyOperations.observability.openIncidents}; critical incidents {data.emergencyOperations.observability.criticalIncidents}; pending communications {data.emergencyOperations.observability.communicationsPending}.</p><p>Traces {data.emergencyOperations.observability.traceIds.join(', ')}</p></section>}
        <section aria-label="Evacuation zones"><h3>Evacuation zones</h3>{data.emergencyOperations.evacuationZones.map((zone) => <StatusCard key={zone.id} title={zone.name} status={zone.status} detail={`Route ${zone.route.join(' -> ')}; assembly ${zone.assemblyArea}; capacity ${zone.capacity}.`} />)}</section>
        <section aria-label="Checklist progress"><h3>Checklist progress</h3><p>{data.emergencyOperations.checklist.filter((item) => item.completed).length} of {data.emergencyOperations.checklist.length} complete.</p>{data.emergencyOperations.checklist.map((item) => <label key={item.id}><input type="checkbox" checked={item.completed} readOnly aria-label={`${item.label} checklist item`} /> {item.label} — human override {String(item.humanOverrideAvailable)}; AI blocking {String(item.aiBlockingAllowed)}</label>)}</section>
        <section aria-label="Communication log"><h3>Communication log</h3>{data.emergencyOperations.communicationLog.map((item) => <StatusCard key={item.id} title={`${item.channel} to ${item.audience}`} status={item.completed ? 'completed' : 'pending'} detail={`${item.message}; ${item.completedBy ? `completed by ${item.completedBy}` : 'awaiting human communicator'}.`} />)}</section>
        <section aria-label="Drills and after-action reports"><h3>Drills and after-action reports</h3>{data.emergencyOperations.drills.map((drill) => <WorkspacePanel key={drill.id} title={drill.scenario} eyebrow={drill.completedAt ? 'completed drill' : 'scheduled drill'}><p>Participants {drill.participants.join(', ')}; criteria {drill.successCriteria.join(', ')}; event {drill.eventId ?? 'pending'}; audit {drill.auditId ?? 'pending'}.</p></WorkspacePanel>)}{data.emergencyOperations.afterActionReports.map((report) => <WorkspacePanel key={report.incidentId} title={`After-action ${report.incidentId}`} eyebrow={report.approvalPosture?.mode ?? 'post-action-evidence'}><p>Findings {report.findings.map((finding) => `${finding.finding} (${finding.owner})`).join('; ')}</p><p>Corrective actions {report.correctiveActions.map((action) => `${action.action} due ${action.dueDays}d`).join('; ')}</p><p>Evidence {(report.evidencePackage ?? []).join(', ') || 'pending evidence package'}.</p></WorkspacePanel>)}</section>
        <section aria-label="Emergency event stream"><h3>Events</h3><EventTimeline events={data.emergencyOperations.events.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.subjectId}; audit ${event.auditId}`, tone: event.severity }))} /></section>
        <section aria-label="Emergency audit timeline"><h3>Audit timeline</h3>{data.emergencyOperations.auditTimeline.map((audit) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.action}; actor {audit.actor}; subject {audit.subjectId}; human override {String(audit.humanOverride)}; AI blocked {String(audit.aiBlocked)}; previous {audit.previousHash}</p></article>)}</section>
      </section>}

      {showWorkspace('workforce') && <section aria-label="Workforce workspace">
        <h2>Workforce</h2>
        <p aria-label="Workforce Operations dashboard">Workforce Operations dashboard remains available as the active /workforce workspace.</p>
        <DataFreshness label="Workforce operations" timestamp={workforceOperations.generatedAt} mode={data.mode} />
        <p>Staffing readiness <strong>{workforceOperations.readiness.status}</strong> at {workforceOperations.readiness.score}; coverage {workforceOperations.readiness.coveragePct}% with compliance {workforceOperations.compliance.status}. Staffing changes and emergency overrides are approval/audit/event/workflow aware and never mutate local safety-critical state.</p>
        <MetricStrip items={[
          { label: 'Employees', value: String(workforceOperations.employees.length), detail: `${workforceOperations.identityGovernance.reviewedIdentities} identities reviewed` },
          { label: 'Assignments', value: `${workforceOperations.readiness.checkedIn}/${workforceOperations.readiness.assigned}`, detail: `${workforceOperations.readiness.demand} demanded; gap ${workforceOperations.readiness.staffingGap}` },
          { label: 'Compliance', value: workforceOperations.compliance.status, detail: `Cert ${workforceOperations.compliance.certificationCoveragePct}% / training ${workforceOperations.compliance.trainingCoveragePct}%` },
          { label: 'Alerts', value: String(trainingAlertRows.length), detail: trainingAlertRows.map((alert) => alert.status).join(', ') || 'none' },
        ]} />
        <section aria-label="Workforce employee profiles"><h3>Employee profiles</h3>{workforceOperations.employees.map((employee) => <article key={`${employee.identity.id}-profile`}><strong>{employee.identity.displayName}</strong><p>{employee.employeeNumber}; department {employee.department}; identity {employee.identity.id}; roles {employee.identity.roles.join(', ')}; home zone {employee.homeZoneId ?? 'unassigned'}; emergency qualified {String(employee.emergencyQualified)}.</p><RecordSourceLabel mock={workforceOperations.mock} label="employee profile" /></article>)}</section>
        <section aria-label="Workforce employee records"><h3>Employee records</h3>{workforceOperations.employees.map((employee) => <article key={employee.identity.id}><strong>{employee.identity.displayName}</strong><p>{employee.employeeNumber}; department {employee.department}; identity {employee.identity.id}; roles {employee.identity.roles.join(', ')}; tenant {employee.identity.tenantId}</p></article>)}</section>
        <section aria-label="Workforce scheduling dashboard"><h3>Shifts and assignments</h3>{workforceOperations.shifts.map((shift) => <article key={shift.id}><strong>{shift.label}</strong><p>{shift.startsAt} to {shift.endsAt}; requirements {shift.requirements.map((req) => `${req.role}:${req.demand}${req.emergencyCritical ? ':emergency-critical' : ''}`).join(', ')}</p></article>)}{workforceOperations.assignments.map((assignment) => <article key={assignment.id} data-status={assignment.status}><RiskBadge level={assignment.emergencyCritical && assignment.status !== 'checked-in' ? 'high' : assignment.status === 'checked-in' ? 'low' : 'medium'} /><strong>{employeeNameById.get(assignment.identityId) ?? assignment.identityId}: {assignment.role} {assignment.status}</strong><p>Shift {assignment.shiftId}; zone {assignment.zoneId}; certs {assignment.certificationKinds.join(', ')}; emergency critical {String(assignment.emergencyCritical)}; twin {assignment.digitalTwinRef}; audit {assignment.auditId ?? 'pending'}.</p></article>)}</section>
        <section aria-label="Workforce certifications and training"><h3>Certifications and training</h3>{workforceOperations.certifications.map((cert) => <article key={cert.id}><strong>{employeeNameById.get(cert.identityId) ?? cert.identityId} {cert.kind}: {cert.status}</strong><p>Expires {cert.expiresAt}; event {cert.eventId}; audit {cert.auditId}; evidence {cert.evidence.join(', ')}</p></article>)}{workforceOperations.trainingRecords.map((record) => <article key={record.id}><strong>{employeeNameById.get(record.identityId) ?? record.identityId} {record.title}: {record.status}</strong><p>Due {record.dueAt}; roles {record.requiredForRoles.join(', ')}; evidence {record.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Workforce training expiration alerts"><h3>Training expiration alerts</h3>{trainingAlertRows.length ? trainingAlertRows.map((alert) => <article key={alert.id} role={alert.status === 'expired' || alert.status === 'overdue' ? 'alert' : 'status'}><RiskBadge level={alert.status === 'expired' || alert.status === 'overdue' ? 'high' : 'medium'} /><strong>{alert.title}: {alert.status}</strong><p>{alert.detail}; evidence {alert.evidence.join(', ')}</p></article>) : <p role="status">No expiring certifications or overdue training alerts in the current feed.</p>}</section>
        <section aria-label="Workforce readiness and planning"><h3>Readiness and planning</h3><KpiTile label="Demand" value={String(workforceOperations.planning.demand)} trend={`${workforceOperations.planning.checkedIn} checked in`} /><p>Blockers {workforceOperations.readiness.blockers.join(', ') || 'none'}.</p>{workforceOperations.planning.byRole.map((role) => <p key={role.role}>{role.role}: demand {role.demand}, assigned {role.assigned}, checked in {role.checkedIn}, gap {role.gap}</p>)}</section>
        <section aria-label="Workforce compliance tracking"><h3>Compliance tracking</h3><p>Certification coverage {workforceOperations.compliance.certificationCoveragePct}%; training coverage {workforceOperations.compliance.trainingCoveragePct}%; audit evidence {workforceOperations.compliance.auditEvidence.join(', ')}.</p><p>Identity governance reviewed {workforceOperations.identityGovernance.reviewedIdentities} identities with evidence {workforceOperations.identityGovernance.evidence.join(', ')}.</p></section>
        <section aria-label="Workforce event audit and twin integration"><h3>Events, audit, and Digital Twin</h3>{workforceOperations.events.map((event) => <article key={event.id}><strong>{event.type}</strong><p>{event.subjectId}; severity {event.severity}; audit {event.auditId}</p></article>)}{workforceOperations.auditRecords.map((audit) => <article key={audit.id}><code>{audit.hash}</code><p>{audit.type}; actor {audit.actor}; subject {audit.subjectId ?? 'n/a'}; severity {audit.severity ?? 'info'}; previous {audit.previousHash}</p></article>)}{workforceOperations.digitalTwinSync.map((sync) => <article key={`${sync.twinId}-${sync.assignmentId}`}><strong>{sync.twinId}</strong><p>{sync.status}; assignment {sync.assignmentId}; event {sync.eventId}; audit {sync.auditId}</p></article>)}</section>
        <section aria-label="Emergency staffing approval gates"><h3>Emergency staffing approval gates</h3><p>Emergency staffing override requests are created through the approval service and audit/event streams; check-in, role assignment, and emergency readiness state remain backend-owned.</p><ActionRail actions={workforceApprovalActions} />{workforceOperations.approvals.map((approval) => <article key={approval.id}><ApprovalChip status={approval.status === 'approved' ? 'approved' : 'pending-approval'} /><strong>{approval.action}: {approval.target}</strong><p>Requested by {approval.requestedBy}; expires {approval.expiresAt}; evidence {approval.evidence.join(', ')}</p></article>)}</section>
      </section>}

      {showWorkspace('operations') && <section aria-label="Race-day readiness dashboard">
        <h2>Race-day Readiness</h2>
        <DataFreshness label="Race-day readiness" timestamp={data.readiness.generatedAt} mode={data.mode} />
        <p>Continuous readiness score: <strong>{data.readiness.averageScore}</strong>; ready {data.readiness.ready}, watch {data.readiness.watch}, blocked {data.readiness.blocked}.</p>
        <div aria-label="Race readiness scorecards">{data.readiness.races.map((race) => <article key={race.raceId} data-status={race.status}><h3>{race.raceId}</h3><RiskBadge level={race.status === 'ready' ? 'low' : race.status === 'watch' ? 'high' : 'critical'} /><p>{race.trackId} post time {race.postTime}; score {race.score}; warnings {race.warnings}; approvals {race.approvals}.</p></article>)}</div>
        <section aria-label="Readiness domain scores"><h3>Domain scores</h3>{data.readiness.domainScores.map((domain) => <article key={domain.domain}><strong>{domain.domain}</strong><meter min={0} max={100} value={domain.averageScore}>{domain.averageScore}</meter><p>Average {domain.averageScore}; watch {domain.watch}; blocked {domain.blocked}.</p></article>)}</section>
        <section aria-label="Operational readiness warnings"><h3>Operational warnings</h3>{data.readiness.warnings.map((warning) => <article key={warning.id} role={warning.severity === 'critical' ? 'alert' : 'status'}><strong>{warning.domain}: {warning.message}</strong><p>Action: {warning.recommendedAction}</p><p>Evidence: {warning.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Readiness approval requirements"><h3>Approval requirements</h3>{data.readiness.approvals.map((approval) => <article key={approval.id}><ApprovalChip status={approval.status === 'satisfied' ? 'approved' : 'pending-approval'} /><strong>{approval.action}</strong><p>{approval.reason}; roles: {approval.requiredRoles.join(', ')}</p><p>Evidence: {approval.evidence.join(', ')}</p></article>)}</section>
        <section aria-label="Readiness events"><h3>Readiness events</h3><EventTimeline events={data.readiness.events.map((event) => ({ time: event.timestamp, label: `${event.type}: ${event.message}`, tone: event.severity }))} /></section>
        <section aria-label="Readiness audit records"><h3>Audit records</h3>{data.readiness.auditRecords.map((record) => <article key={record.id}><code>{record.summaryHash}</code><p>{record.actor} scored {record.score} for {record.raceId}; previous hash {record.previousHash}; evidence {record.evidence.join(', ')}.</p></article>)}</section>
      </section>}

      {/* Legacy combined facilities/workforce hub removed; /assets, /facilities, and /workforce render distinct workspaces below. */}


      {showWorkspace('barns') && <section aria-label="Barn Operations workspace">
        <h2>Barn Operations</h2>
        <p>Coordinated frontend-backend module for barns, stalls, occupancy, trainer assignments, veterinary visits, access control, inspections, restrictions, incidents, audited movement events, and Digital Twin updates.</p>
        <MockDataBanner active={data.barnOperations.mock} source="Barn Operations mock-live boundary" />
        <p>{data.barnOperations.mock ? 'MOCK DATA boundary: Barn Operations mock data is labeled and no stall, access, restriction, trainer, or veterinary state is mutated locally.' : 'LIVE READ-ONLY boundary: Barn Operations live data is rendered read-only until backend approvals authorize execution.'}</p>
        <section aria-label="Barn operations command dashboard">
          <h3>Barn command dashboard</h3>
          <MetricStrip items={[
            { label: 'Occupancy', value: `${barnDashboard.occupiedStalls}/${barnDashboard.totalStalls}`, detail: `${barnDashboard.occupancyRate}% occupied; ${barnDashboard.availableStalls} available` },
            { label: 'Readiness', value: barnDashboard.readinessStatus, detail: `${barnDashboard.openRestrictions} open restrictions; ${barnDashboard.pendingApprovals} pending approvals` },
            { label: 'Timeline', value: String(barnDashboard.eventCount), detail: `Latest movement ${barnDashboard.latestMovementAt ?? 'not reported'}; audit records ${barnDashboard.auditRecordCount}` },
            { label: 'Digital Twin', value: String(barnDashboard.twinSyncCount), detail: `${barnDashboard.assetCount} assets linked; sync is read-only until approved backend execution` },
          ]} />
          <p>Restricted moves, access, trainer assignments, and stall restrictions require approval tokens from the backend and append audit/event evidence before execution.</p>
        </section>
        <section aria-label="Barn map and list">
          <h3>Barn map/list</h3>
          {data.barnOperations.barns.map((barn) => <article key={barn.id} data-status={barn.status}><h4>{barn.name}</h4><p>{barn.location}; capacity {barn.capacity}; trainers {barn.trainerIds.join(', ')}; linked incidents {barn.incidentIds.join(', ')}.</p></article>)}
        </section>
        <section aria-label="Stall occupancy grid">
          <h3>Stall occupancy</h3>
          {data.barnOperations.stalls.map((stall) => <article key={stall.id} data-status={stall.status}><strong>{stall.label}</strong><p>{stall.status}{stall.occupancyHorseId ? ` — ${stall.occupancyHorseId}${stall.occupancyHorseId === registryHorse.horseId ? ` (${registryHorse.name})` : ''}` : ''}; restrictions {stall.restrictionIds.join(', ') || 'none'}.</p>{stall.occupancyHorseId === registryHorse.horseId && veterinarianReviewRequired && <p role="alert">Veterinarian review required warning follows this occupied stall; no barn restriction is created locally.</p>}</article>)}
        </section>
        <section aria-label="Horse movement timeline">
          <h3>Horse movement timeline</h3>
          <EventTimeline events={data.barnOperations.movements.map((movement) => ({ time: movement.movedAt, label: `${movement.horseId}: ${movement.fromBarnId ?? 'arrival'}/${movement.fromStallId ?? 'arrival'} → ${movement.toBarnId}/${movement.toStallId}; reason ${movement.reason}; event ${movement.eventId}; audit ${movement.auditId}`, tone: movement.approvalRequestId ? 'warning' : 'info' }))} />
          <section aria-label="Current horse movement timeline"><h4>{registryHorse.name} movement timeline</h4><EventTimeline events={horseMovements.map((movement) => ({ time: movement.movedAt, label: `${movement.fromStallId ?? 'arrival'} to ${movement.toStallId}; moved by ${movement.movedBy}; audit ${movement.auditId}`, tone: movement.approvalRequestId ? 'warning' : 'info' }))} /></section>
          {data.barnOperations.movements.map((movement) => <p key={`${movement.id}-evidence`}>Movement evidence: {movement.eventId} / {movement.auditId}</p>)}
        </section>
        <section aria-label="Barn access history">
          <h3>Access history</h3>
          {data.barnOperations.access.map((record) => <article key={record.id}><strong>{record.actorId}</strong><p>{record.decision} for {record.purpose} at {record.accessAt}; event {record.eventId}; audit {record.auditId}.</p></article>)}
        </section>
        <section aria-label="Barn readiness dashboard">
          <h3>Barn readiness</h3>
          {data.barnOperations.readiness.map((ready) => <article key={ready.barnId} data-status={ready.status}><RiskBadge level={ready.status === 'ready' ? 'low' : ready.status === 'watch' ? 'high' : 'critical'} /><strong>{ready.barnId}: {ready.score}</strong><p>{ready.occupiedStalls}/{ready.capacity} stalls occupied; restrictions {ready.openRestrictions}; blockers {ready.blockers.join(', ') || 'none'}.</p></article>)}
        </section>
        <section aria-label="Barn facility readiness dashboard">
          <h3>Facility readiness and inspection status</h3>
          {barnFacilityReadiness.map((ready) => <article key={`${ready.barnId}-facility`} data-status={ready.status}><StatusCard title={ready.barnId} status={ready.inspectionStatus} detail={`Workflow ${ready.workflowStatus}; approval required ${String(ready.approvalRequired)}`} /><p>Score {ready.score}; twins {ready.twinIds.join(', ') || 'none'}; assets {ready.assetIds.join(', ') || 'none'}; blockers {ready.blockers.join(', ') || 'none'}.</p></article>)}
        </section>
        <section aria-label="Barn inspections restrictions trainer assignments veterinary visits">
          <h3>Inspections, restrictions, trainers, veterinary visits</h3>
          <p>Inspections: {data.barnOperations.inspections.map((i) => `${i.barnId} score ${i.score}`).join('; ')}.</p>
          <p>Restrictions: {data.barnOperations.restrictions.map((r) => `${r.type} ${r.reason} (${r.eventId}/${r.auditId})`).join('; ')}.</p>
          <p>Trainer assignments: {data.barnOperations.trainers.map((t) => `${t.trainerId} active=${t.active}`).join('; ')}.</p>
          <p>Veterinary visits: {data.barnOperations.vetVisits.map((v) => `${v.horseId} by ${v.veterinarianId}`).join('; ')}.</p>
        </section>
        <section aria-label="Barn asset registry links"><h3>Asset registry links</h3>{barnAssetLinks.map((link) => <article key={link.assetId} data-status={link.registryStatus}><strong>{link.assetId}</strong><p>Barn {link.barnId}; stall {link.stallId ?? 'n/a'}; twin {link.twinId}; risk {link.riskLevel}; event {link.eventId ?? 'mock-derived'}; audit {link.auditId ?? 'mock-derived'}.</p></article>)}</section>
        <section aria-label="Barn Digital Twin sync"><h3>Digital Twin sync</h3>{barnTwinSync.map((sync) => <article key={`${sync.twinId}-${sync.eventId}`} data-status={sync.status}><strong>{sync.twinId}</strong><p>{sync.status}; barn {sync.barnId}; stall {sync.stallId ?? 'n/a'}; event {sync.eventId}; audit {sync.auditId}; patch keys {Object.keys(sync.patch).join(', ') || 'none'}.</p></article>)}</section>
        <section aria-label="Barn approval queue"><h3>Approval queue</h3>{barnApprovalRequests.length ? barnApprovalRequests.map((approval) => <article key={approval.id}><ApprovalChip status={equineApprovalStatus(approval.status)} /><strong>{approval.action}</strong><p>Target {approval.target}; requested by {approval.requestedBy}; evidence {approval.evidence.join(', ') || 'none'}.</p></article>) : <p>No live barn approval requests are loaded. Restricted moves and assignments remain locked until the backend returns an approval token.</p>}</section>
        <section aria-label="Barn event backbone"><h3>Event backbone</h3>{barnEvents.length ? barnEvents.map((event) => <article key={event.id}><strong>{event.type}</strong><p>Aggregate {event.aggregateId ?? 'unknown'}; audit {event.auditId ?? 'pending'}; at {event.occurredAt ?? event.timestamp ?? 'not reported'}.</p></article>) : <p>Mock barn event labels are shown from movement, access, inspection, and restriction records until the live event stream is connected.</p>}</section>
        <section aria-label="Barn approval gates"><h3>Approval locked controls</h3><p>Restricted moves and assignments remain locked; requests must go through approvals and audit/event workflows before any backend state changes.</p><ActionRail actions={[
          { id: 'stall-move', label: 'Request stall move approval', detail: 'Creates an approval request for reviewed movement only; stall occupancy is unchanged in the frontend.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
          { id: 'barn-restriction', label: 'Request barn restriction approval', detail: 'Veterinary, quarantine, and security restrictions require backend approval and audit records.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
          { id: 'vet-visit-review', label: 'Request veterinary visit review', detail: 'Routes visit evidence to a licensed veterinarian; Health AI cannot create local barn restrictions.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true },
        ]} /></section>
      </section>}
      {showWorkspace('assets') && <section aria-label="Asset Registry workspace">
        <h2>Asset Registry</h2>
        <p>Tenant-scoped asset registry view for gates, sensors, cameras, vehicles, crews, facilities, emergency resources, ownership, lifecycle, health, risk, maintenance, audit, event, and Digital Twin links.</p>
        <MetricStrip items={[
          { label: 'Registered assets', value: String(data.trackMap.assets.length + data.facilitiesMaintenance.assets.length), detail: `${data.trackMap.assets.length} track-map assets; ${data.facilitiesMaintenance.assets.length} facilities assets` },
          { label: 'Facility health score', value: String(data.facilitiesMaintenance.readiness.score), detail: `${data.facilitiesMaintenance.readiness.watch} watch; ${data.facilitiesMaintenance.workOrders.length} work orders` },
          { label: 'Map features', value: String(data.trackMap.geospatial?.features.length ?? 0), detail: 'Geospatial asset and telemetry overlays' },
          { label: 'Twin links', value: String(data.trackMap.geospatial?.digitalTwinState.length ?? data.digitalTwinState.length), detail: 'Read-only Digital Twin references' },
          { label: 'Critical changes', value: 'Locked', detail: 'Lifecycle and safety changes require approvals' },
        ]} />
        {DataTableShell({ label: 'Asset registry table', title: 'Registry', rows: data.trackMap.assets, getRowKey: (asset) => asset.id, columns: [{ key: 'asset', header: 'Asset', render: (asset) => asset.label }, { key: 'type', header: 'Type', render: (asset) => asset.type }, { key: 'sector', header: 'Sector', render: (asset) => asset.sectorId }, { key: 'status', header: 'Status', render: (asset) => asset.status }, { key: 'approval', header: 'Approval posture', render: () => 'Read-only in frontend; use approval request for lifecycle changes.' }] })}
        <section aria-label="Facility assets in registry"><h3>Facility assets</h3>{data.facilitiesMaintenance.assets.map((asset) => <article key={`${asset.assetId}-registry`}><RiskBadge level={asset.riskLevel} /><strong>{asset.name}</strong><p>{asset.assetId}; {asset.assetType}; lifecycle {asset.lifecycleStatus}; maintenance {asset.maintenanceStatus}; health {asset.healthScore}; source {asset.sourceOfTruth}; twin {asset.twinId ?? 'pending'}.</p><p>Approval controls {asset.controlsRequiringApproval.join(', ') || 'none'}; work orders {asset.openWorkOrderIds.join(', ') || 'none'}.</p></article>)}</section>
        <section aria-label="Asset health summary">{Object.entries(assetHealth).map(([status, count]) => <StatusCard key={status} title={`${status} assets`} status={String(count)} detail="Aggregated from shared TrackMapDto asset markers." />)}<StatusCard title="Facility asset health" status={data.facilitiesMaintenance.readiness.status} detail={`Score ${data.facilitiesMaintenance.readiness.score}; health scoring from FacilitiesMaintenanceDto.`} /></section>
        <section aria-label="Asset predictive health placeholders"><h3>Predictive health placeholders</h3>{data.facilitiesMaintenance.predictiveHooks.map((hook) => <article key={`${hook.assetId}-asset-predictive`}><strong>{hook.assetId}: {hook.priority}</strong><p>{hook.type}; failure probability {Math.round(hook.failureProbability * 100)}%; evidence {hook.evidence.join(', ')}. Predictive-maintenance placeholder only; approval required before work execution.</p></article>)}</section>
        <section aria-label="Asset Digital Twin links">{data.digitalTwinState.map((twin) => <DigitalTwinRelationshipCard key={twin.twinId} source={twin.assetId} relationship={`has twin ${twin.twinId} health ${twin.health}`} target={`version ${twin.version}`} />)}</section>
        <section aria-label="Asset registry approval gates"><ActionRail actions={commandCenterApprovalActions().filter((action) => ['twin-command','gate-move','facility-work-order','return-to-service'].includes(action.id))} /></section>
      </section>}
      {showWorkspace('facilities') && <section aria-label="Facilities Maintenance workspace">
        <h2>Facilities Maintenance</h2>
        <p>RACR-backed facility assets, inspections, preventive maintenance, work orders, asset health scoring, predictive maintenance hooks, operational readiness, approvals, audit, events, observability, and Digital Twin synchronization.</p>
        <DataFreshness label="Facilities maintenance" timestamp={data.facilitiesMaintenance.generatedAt} mode={data.mode} />
        <MockDataBanner active={data.facilitiesMaintenance.mock} source="facilities-maintenance mock adapter" />
        <section aria-label="Facilities operations layout summary">
          <h3>Facilities Operations Layout</h3>
          <p>Facilities-only layout for RACR-backed facility assets, predictive-maintenance placeholders, maintenance readiness, inspections, work orders, and approval gates.</p>
          <section aria-label="Operational layout summary"><p>Facility readiness {data.facilitiesMaintenance.readiness.score}. {data.facilitiesMaintenance.mock ? 'MOCK DATA LABEL: approved facilities mock adapter is source-labelled.' : 'LIVE DATA LABEL: facilities-maintenance service feed is source-labelled.'}</p></section>
          <section aria-label="Facility assets registry"><p>{data.facilitiesMaintenance.assets.length} facility assets are linked to the racetrack asset registry and Digital Twin refs.</p></section>
          <section aria-label="Asset health operations"><p>Grandstand HVAC, patron elevator, and backup generator health drive approval-aware maintenance planning.</p></section>
          <section aria-label="Asset health scoring"><p>Facility readiness uses health scores, predicted failure risk, and operational impact labels.</p></section>
          <section aria-label="Facility inspections and maintenance work orders"><p>Work orders include approval, workflow, event, audit, and twin evidence including wo-7 compatibility references.</p></section>
          <section aria-label="Predictive maintenance placeholders"><p>Predictive-maintenance placeholder signals are advisory only and do not schedule execution.</p></section>
          <section aria-label="Maintenance approval gates"><ActionRail actions={facilityApprovalActions} /></section>
          <section aria-label="Operational data completeness"><p>{incompleteOperationalAreas.length ? `Placeholder/incomplete: ${incompleteOperationalAreas.join(', ')}` : 'Placeholder/incomplete checks passed for loaded mock data.'}</p></section>
        </section>
        <section aria-label="Facilities readiness summary"><h3>Operational readiness</h3><RiskBadge level={data.facilitiesMaintenance.readiness.status === 'ready' ? 'low' : data.facilitiesMaintenance.readiness.status === 'watch' ? 'high' : 'critical'} /><p>Score {data.facilitiesMaintenance.readiness.score}; ready {data.facilitiesMaintenance.readiness.ready}; watch {data.facilitiesMaintenance.readiness.watch}; blocked {data.facilitiesMaintenance.readiness.blocked}.</p><p>Evidence {data.facilitiesMaintenance.readiness.evidence.join(', ')}</p></section>
        <section aria-label="Facility asset health table"><h3>Asset health</h3>{data.facilitiesMaintenance.assets.map((asset) => <article key={asset.assetId} data-status={asset.readinessStatus}><AssetHealthIndicator label={asset.name} status={asset.readinessStatus === 'ready' ? 'healthy' : asset.readinessStatus === 'watch' ? 'degraded' : 'offline'} /><strong>{asset.name}</strong><p>{asset.assetId}; {asset.assetType}; health {asset.healthScore}; maintenance {asset.maintenanceStatus}; predicted failure risk {asset.predictedFailureRisk}%.</p><p>Source {asset.sourceOfTruth}; twin {asset.twinId}; approval controls {asset.controlsRequiringApproval.join(', ')}</p></article>)}</section>
        <section aria-label="Facilities inspection records"><h3>Inspections</h3>{data.facilitiesMaintenance.inspections.map((inspection) => <article key={inspection.id}><strong>{inspection.assetId}: {inspection.status}</strong><p>Score {inspection.score}; next due {inspection.nextInspectionDueAt}; event {inspection.eventId}; audit {inspection.auditId}; twin {inspection.twinId}</p><p>Findings {inspection.findings.join(', ') || 'none'}</p></article>)}</section>
        <section aria-label="Preventive maintenance schedule"><h3>Preventive maintenance</h3>{data.facilitiesMaintenance.preventiveMaintenance.map((plan) => <article key={plan.id}><strong>{plan.assetId}</strong><p>Cadence {plan.cadenceDays} days; next due {plan.nextDueAt}; execution approval required {String(plan.approvalRequiredForExecution)}.</p><p>Hooks {plan.predictiveHooks.join(', ')}</p></article>)}</section>
        <section aria-label="Facilities work orders"><h3>Work orders</h3>{data.facilitiesMaintenance.workOrders.map((order) => <article key={order.id}><RiskBadge level={order.priority === 'critical' ? 'critical' : order.priority === 'high' ? 'high' : 'medium'} /><strong>{order.title}</strong><p>{order.status}; impact {order.operationalImpact}; approval {order.approvalRequestId ?? 'not required'}; workflow {order.workflowInstanceId}; event {order.eventId}; audit {order.auditId}; twin {order.twinId}</p><p>Tasks {order.tasks.join(' -> ')}</p></article>)}</section>
        <section aria-label="Predictive maintenance hooks"><h3>Predictive maintenance hooks</h3>{data.facilitiesMaintenance.predictiveHooks.map((hook) => <article key={hook.assetId}><strong>{hook.assetId}: {hook.priority}</strong><p>{hook.type}; failure probability {Math.round(hook.failureProbability * 100)}%; evidence {hook.evidence.join(', ')}. Predictive-maintenance placeholder; no autonomous maintenance execution.</p></article>)}</section>
        <section aria-label="Facilities approval and audit integrations"><h3>Approvals, audit, events, twins, and observability</h3><p>Operational actions require approval: {String(data.facilitiesMaintenance.operationalActionsRequireApproval)}. Integrations {Object.entries(data.facilitiesMaintenance.integrations).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}.</p><p>Approvals {data.facilitiesMaintenance.approvals.map((approval) => `${approval.action}:${approval.status}:${approval.id}`).join('; ') || 'none'}.</p><p>Observability {data.facilitiesMaintenance.observability.metrics.map((metric) => `${metric.name}=${metric.value}${metric.unit}`).join(', ')}.</p><ActionRail actions={facilityApprovalActions} />{data.facilitiesMaintenance.approvals.map((approval) => <article key={`${approval.id}-facility-approval`}><ApprovalChip status={approval.status === 'approved' ? 'approved' : 'pending-approval'} /><strong>{approval.action}: {approval.target}</strong><p>Workflow {approval.workflowInstanceId ?? 'pending'}; evidence {approval.evidence.join(', ')}</p></article>)}</section>
      </section>}
      {showWorkspace('digital-twin') && <section aria-label="Digital Twin workspace shell">
        <h2>Digital Twin Workspace</h2>
        <DataFreshness label="Digital Twin state" timestamp={data.digitalTwinState[0]?.lastUpdatedAt} mode={data.mode} />
        <p>Tenant scope <code>{twinTenantScope}</code>. Shared typed client source: <code>{data.mode}</code>; Digital Twin updates are read-only until an approved backend execution path emits the patch event and immutable audit record.</p>
        <MetricStrip items={[
          { label: 'Runtime twins', value: String(data.digitalTwinState.length), detail: Object.entries(twinHealth).map(([health, count]) => `${health}:${count}`).join(', ') || 'none' },
          { label: 'Track assets', value: String(twinAssetRows.length), detail: Object.entries(assetHealth).map(([status, count]) => `${status}:${count}`).join(', ') || 'none' },
          { label: 'Queued sync', value: String(data.platformHealth.digitalTwin.queuedSync), detail: `Last sync ${data.platformHealth.digitalTwin.lastSyncAt ?? 'unknown'}` },
          { label: 'Dependencies', value: String(twinDependencyCards.length), detail: 'Runtime, sector, telemetry, event, audit, and workforce links' },
          { label: 'TUS standard assets', value: String(tusStandard.assets.length), detail: `${tusStandard.coverage.telemetryBindings} telemetry bindings; ${tusStandard.coverage.approvals} approvals` },
          { label: 'Simulation placeholders', value: String(simulationOverlays.length), detail: 'Mock/read-only what-if overlays, approval required' },
          { label: 'Event history', value: String(twinEventHistory.length), detail: 'Replay, sync, security, emergency, workforce, and AI events' },
        ]} />
        <section aria-label="TUS asset and twin standardization panel"><h3>TUS asset and twin standardization</h3><p>Every standardized asset uses one schema: {tusAssetSchemaFields.join(', ')}. Tenant context <code>{tusStandard.tenantId}</code>; racetrack context <code>{tusStandard.racetrackId}</code>; generated {tusStandard.generatedAt}.</p><p>Standard twin coverage: {tusTwinTypes.join(', ') || 'not loaded'}. Required major twins include Horse Twin, Track Twin, Gate Twin, Facility Twin, Race Twin, Employee Twin, and AI Twin.</p>{tusStandard.assets.map((asset) => <article key={`${asset.assetId}-tus-standard`}><RiskBadge level={asset.risk.level} /><strong>{asset.displayName}</strong><p>{asset.assetId}; {asset.assetType}; category {asset.assetCategory}; health {asset.health.status}; telemetry {asset.telemetry.length}; approvals {asset.approvals.length}; audit {asset.audit.length}; twin {asset.twin?.twinId ?? 'not linked'}.</p></article>)}</section>
        <section id="track-map-region" aria-label="Digital Twin track map panel"><h3>Track map panel</h3><TrackMapPanel map={data.trackMap} routeContext="digital-twin" /><p>The TrackMap below is the single shared map implementation; this panel reuses the same sectors, overlays, playback frames, twin health layer, and simulation placeholders. Starting-gate move overlays are isolated to <code>/starting-gate</code>.</p><TrackMap map={data.trackMap} routeContext="digital-twin" /></section>
        <section aria-label="Digital Twin asset graph and relationship view"><h3>Asset graph and relationship view</h3><p>Read-only graph edges combine runtime twins, track assets, sectors, equine references, and backend sync records. Graph editing is intentionally absent from the frontend.</p>{twinRelationshipCards.map((card) => <DigitalTwinRelationshipCard key={`${card.source}-${card.relationship}-${card.target}`} source={card.source} relationship={card.relationship} target={card.target} />)}</section>
        <section aria-label="Digital Twin dependency view"><h3>Dependency view</h3><p>Dependencies are rendered from platform health, TrackMap asset markers, surface sync, and workforce sync records; no dependency can be rewired locally.</p>{twinDependencyCards.map((card) => <DigitalTwinRelationshipCard key={`${card.source}-${card.relationship}-${card.target}`} source={card.source} relationship={card.relationship} target={card.target} />)}</section>
        <section aria-label="Digital Twin health indicators"><h3>Health indicators</h3>{data.digitalTwinState.map((state) => <article key={state.twinId}><AssetHealthIndicator label={state.twinId} status={statusHealthLabel(state.health)} /><p>{state.assetId}; health {state.health}; version {state.version}; updated {state.lastUpdatedAt}; {state.mock ? 'MOCK DATA' : 'LIVE DATA'}</p></article>)}{geospatialTwinStates.map((state) => <article key={`${state.twinId}-map-state`}><AssetHealthIndicator label={state.twinId} status={statusHealthLabel(state.health)} /><p>Map state for {state.assetId}; relations {state.relationshipCount ?? 0}; dependencies {state.dependencyCount ?? 0}; history {state.historyEvents ?? 0}; approval required {String(state.approvalRequired ?? false)}.</p></article>)}</section>
        <section aria-label="Digital Twin risk indicators"><h3>Risk indicators</h3>{twinAssetRows.map(({ asset, feature, mapTwin }) => <article key={`${asset.id}-risk`}><RiskBadge level={statusRiskBadgeLevel(feature?.status ?? asset.status)} /><strong>{asset.label}</strong><p>{asset.id}; type {asset.type}; status driver {feature?.status ?? asset.status}; twin health {mapTwin?.health ?? 'not linked'}; source {feature?.source ?? 'TrackMapDto.assets'}.</p></article>)}{twinFeatures.map((feature) => <article key={`${feature.id}-risk`}><RiskBadge level={statusRiskBadgeLevel(feature.status)} /><strong>{feature.label}</strong><p>{feature.source}; health {String(feature.properties.health ?? feature.status)}; coordinates {feature.coordinates.latitude}, {feature.coordinates.longitude}</p></article>)}</section>
        <section aria-label="Digital Twin asset detail drawer"><h3>Asset detail drawer</h3>{twinAssetRows.map(({ asset, runtimeTwin, mapTwin, feature, telemetry }) => DetailDrawer({ elementKey: `${asset.id}-drawer`, label: `Asset detail drawer ${asset.id}`, summary: asset.label, children: <><p>Read-only asset {asset.id}; tenant scope {twinTenantScope}; type {asset.type}; sector {asset.sectorId}; status {asset.status}.</p><p>Runtime twin {runtimeTwin?.twinId ?? mapTwin?.twinId ?? 'not linked'}; health {runtimeTwin?.health ?? mapTwin?.health ?? 'not reported'}; version {runtimeTwin?.version ?? mapTwin?.version ?? 'not reported'}; updated {runtimeTwin?.lastUpdatedAt ?? mapTwin?.lastUpdatedAt ?? 'not reported'}.</p><p>Map feature {feature?.id ?? 'not linked'}; source {feature?.source ?? 'TrackMapDto.assets'}; coordinates {feature ? `${feature.coordinates.latitude}, ${feature.coordinates.longitude}` : 'not reported'}.</p><p>Telemetry {telemetry.map((measurement) => `${measurement.sectorId}: moisture ${measurement.moisture}%, compaction ${measurement.compaction}, measured ${measurement.measuredAt}`).join('; ') || 'no sector telemetry in current DTO'}.</p><p>Controls: read-only; lifecycle, dependency, and twin patch changes must go through <code>POST /api/v1/approvals/draft-requests</code> or the live controlled-action backend.</p></> }))}</section>
        <section aria-label="Digital Twin telemetry summary"><h3>Telemetry summary</h3>{data.trackMap.measurements.map((measurement) => <article key={`${measurement.sectorId}-${measurement.measuredAt}`}><strong>{measurement.sectorId}</strong><p>Moisture {measurement.moisture}%; compaction {measurement.compaction}; measured {measurement.measuredAt}; source TrackMapDto.measurements.</p></article>)}{data.surfaceIntelligence.metricPanels.map((panel) => <article key={panel.id}><strong>{panel.label}</strong><p>{panel.factor}; value {panel.value}; target {panel.target}; status {panel.status}; trend {panel.trend}; sector {panel.sectorId ?? 'track'}.</p></article>)}{data.surfaceIntelligence.digitalTwinSync.map((sync) => <article key={`${sync.twinId}-telemetry`}><strong>{sync.twinId}</strong><p>{sync.status}; patch preview {Object.entries(sync.patch).map(([key, value]) => `${key}:${String(value)}`).join(', ')}; event {sync.eventId}; audit {sync.auditId}</p></article>)}{tusStandard.assets.flatMap((asset) => asset.telemetry.map((binding) => <article key={`${asset.assetId}-${binding.bindingId}`}><strong>{asset.assetId} TUS telemetry</strong><p>{binding.stream}; source {binding.sourceId}; metric {binding.metric ?? 'not specified'}; required {String(binding.required)}; last observed {binding.lastObservedAt ?? 'not observed'}.</p></article>))}{tusStandard.twins.flatMap((twin) => twin.telemetry.map((binding) => <article key={`${twin.twinId}-${binding.sourceId}-${binding.metric}`}><strong>{twin.twinType} twin telemetry</strong><p>{twin.twinId}; {binding.stream ?? 'standard stream'}; source {binding.sourceId}; metric {binding.metric}; required {String(binding.required)}.</p></article>))}</section>
        <section aria-label="Digital Twin event history"><h3>Event history</h3><EventTimeline events={twinEventHistory} /></section>
        <section aria-label="Digital Twin audit history"><h3>Audit history</h3>{data.auditEvents.map((event) => <AuditEventRow key={event.id} event={event} />)}{twinAuditReferences.map((ref) => <p key={ref.id}>Twin audit link: <strong>{ref.label}</strong>. {ref.detail}. State patch remains backend-owned.</p>)}</section>
        <section aria-label="Digital Twin simulation placeholders"><h3>Simulation placeholders</h3><p>SIMULATION PLACEHOLDER - MOCK/WHAT-IF ONLY. Overlays are read-only planning views and cannot patch runtime state unless a live backend approval path executes them.</p>{simulationOverlays.map((simulation) => <article key={simulation.id}><RiskBadge level={simulation.riskDelta >= 80 ? 'critical' : simulation.riskDelta >= 50 ? 'high' : 'medium'} /><strong>{simulation.scenario}</strong><p>Simulation placeholder {simulation.id}; risk delta {simulation.riskDelta}; approval required {String(simulation.approvalRequired)}; features {simulation.featureIds.join(', ')}</p></article>)}</section>
        <section aria-label="Digital Twin approval-gated controls"><h3>Approval-gated controls</h3><ActionRail actions={commandCenterApprovalActions().filter((action) => action.id === 'twin-command')} /><button type="button" disabled aria-disabled="true" aria-label="Draft Digital Twin patch approval request">Draft Digital Twin patch approval request</button><button type="button" disabled aria-disabled="true" aria-label="Run Digital Twin simulation placeholder">Run simulation placeholder requires backend approval</button><SafetyCriticalActionButton approvalsSatisfied={false} backendLive={data.mode === 'live'} authenticated={authenticated} ariaLabel="Execute approved Digital Twin command">Execute approved Digital Twin command</SafetyCriticalActionButton><p>No Digital Twin patch, relationship edit, dependency rewire, or simulation run mutates local state. The frontend can only draft approval-aware backend requests.</p></section>
      </section>}
      {showWorkspace('starting-gate') && StartingGateControl({
        trackMap: data.trackMap,
        gatePosition: data.gatePosition,
        raceDistanceConfiguration: data.raceDistanceConfiguration,
        readiness: data.readiness,
        approvals: data.approvals,
        auditEvents: data.auditEvents,
        digitalTwinState: data.digitalTwinState,
        mode: data.mode,
        authenticated,
        canExecute,
      })}
      {showWorkspace('track-configuration') && <section id="track-map-region" aria-label="Track map work area">
        <>
          <h2>Track Configuration</h2>
          <p>Read-only configuration map for sectors, rail position, turf configuration, GPS verification, Digital Twin sync, and approval-ready work-order context. Starting-gate move planning renders only inside <code>/starting-gate</code>; configuration changes remain draft-only until approved by the backend.</p>
          <MetricStrip items={[
            { label: 'Race distance', value: `${data.raceDistanceConfiguration.distanceMeters}m`, detail: `Race ${data.raceDistanceConfiguration.raceId}` },
            { label: 'Current gate', value: data.gatePosition.gateId, detail: `${data.gatePosition.metersFromStart}m from start; GPS ${String(data.gatePosition.gpsVerified)}; read-only here` },
            { label: 'Work orders', value: String(data.trackMap.trackConfiguration?.workOrders.length ?? 0), detail: 'Configuration work orders only; gate movement flow is isolated' },
            { label: 'Verification', value: data.trackMap.trackConfiguration?.verificationWorkflow.status ?? 'approval-required', detail: `Actuator control available ${String(data.trackMap.trackConfiguration?.verificationWorkflow.actuatorControlAvailable ?? false)}` },
          ]} />
        </>
        <TrackMapPanel map={data.trackMap} routeContext="track-configuration" />
        <TrackMap map={data.trackMap} routeContext="track-configuration" />
      </section>}
      {showWorkspace('approvals') && <section id="approvals-region" aria-label="Approvals work area">
        <h2>Approvals and Audit Handoff</h2>
        <p>Approval queues and audit ledger rows share evidence, affected assets, actors, timestamps, and correlation IDs. Approval actions stay backend-routed; the audit ledger stays immutable and read-only.</p>
        <MetricStrip items={[
          { label: 'Approval requests', value: String(data.approvals.length), detail: 'Backend approval service source' },
          { label: 'Audit ledger rows', value: String(data.auditEvents.length), detail: 'Hash-chained read-only records' },
          { label: 'Correlation coverage', value: String(new Set([...data.approvals.map((approval) => approval.correlationId), ...data.auditEvents.map((event) => event.correlationId)].filter(Boolean)).size), detail: 'Shared IDs across approvals and audit' },
        ]} />
        <ApprovalsPanel approvals={data.approvals} />
        <ActionRail actions={commandCenterApprovalActions()} />
      </section>}
      {showWorkspace('audit') && <section aria-label="Audit event rows">{data.auditEvents.map((event) => <AuditEventRow key={event.id} event={event} />)}</section>}
      {showWorkspace('assets') && <section aria-label="Asset and twin foundations">{data.trackMap.assets.map((asset) => <AssetHealthIndicator key={asset.id} label={asset.label} status={asset.status} />)}<DigitalTwinRelationshipCard source="Gate Twin" relationship="controls" target="Starting Gate" /></section>}
      {showWorkspace('audit') && <section id="audit-ledger-region" aria-label="Audit ledger work area">
        <AuditReviewPanel events={data.auditEvents} />
      </section>}
      {showWorkspace('platform-health') && <section aria-label="Domain screens">
        {domainScreens.filter((screen) => visibleIds.has(screen.id)).map((screen) => (
          <article key={screen.id}>
            <h2>{screen.title}</h2>
            <p>Route <code>{screen.route}</code> is owned by {screen.owner}; shell owns authentication, layout, and top-level routing.</p>
            <p>{screen.liveApi ? <>Live API target: <code>{screen.liveApi}</code>.</> : 'No state-changing API target is configured for this read-only module.'}</p>
            {data.mode === 'mock' && screen.mockReason && <p><strong>Mock/read-only:</strong> {screen.mockReason}.</p>}
            <p>Event-stream ready topics: {screen.eventStreams.join(', ')}.</p>
            <p>State changes: {screen.stateChangingActions.length ? screen.stateChangingActions.join(', ') : 'none; review-only screen'}; never direct local mutation.</p>
          </article>
        ))}
      </section>}
      {showWorkspace('platform-health') && <section aria-label="Accessibility and responsive layout support">
        <h2>Accessibility and Responsive Layout Support</h2>
        <p>The command center uses persistent landmarks, named regions, keyboard-focusable workspace cards, labeled controls, disabled safety buttons with explicit lock reasons, and a CSS grid that collapses from desktop command wall to single-column mobile command surface.</p>
        <ul>
          <li>Screen reader landmarks cover navigation, command bar, status banners, command palette, notifications, map, approval, audit, and domain workspaces.</li>
          <li>Mobile command surface prioritizes alerts, approvals, incidents, track status, and emergency actions while preserving read-only safety posture.</li>
          <li>Mock, offline, degraded, permission-denied, loading, empty, and error states are visible in the same shell.</li>
        </ul>
      </section>}
    </>,
  });
}

export function App() {
  const client = createNexusClient(false);
  void client;
  return (
    <main aria-label="Quarantined legacy app entry">
      <h1>TrackMind Nexus</h1>
      <p>Legacy standalone app entry quarantined. The active unified command-center shell is <code>CommandCenter</code>, server-rendered by <code>server.tsx</code> with live/mock adapters, role-aware navigation, approvals, audit, and event posture.</p>
      <a href="/operations">Open unified command center</a>
    </main>
  );
}
