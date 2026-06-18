import { canonicalProtectedAutonomyAction, createApprovalRequirement, validateNexusEventEnvelope, type NexusEventEnvelope, type ProtectedAIAutonomyAction } from './foundation.js';
import { createTrackMindSaasModel, validateTrackMindSaasModel, type TrackMindSaasModel } from './saasModel.js';

export const nexusUpgradePackageVersion = 'trackmind-nexus.upgrade-package.v1' as const;

export const nexusWorkspaceIds = [
  'operations',
  'race-office',
  'track-configuration',
  'assets',
  'facilities',
  'workforce',
  'digital-twin',
  'starting-gate',
  'surface',
  'equine',
  'barns',
  'stewards',
  'safety',
  'approvals',
  'audit',
  'security',
  'emergency',
  'compliance',
  'ai-governance',
  'api-hub',
  'executive',
  'platform-health',
] as const;
export type NexusWorkspaceId = typeof nexusWorkspaceIds[number];

export const nexusUpgradeAreaIds = [
  'app-shell-ux',
  'operations-command',
  'digital-twin',
  'racetrack-asset-control-registry',
  'event-backbone',
  'approval-governance',
  'starting-gate-track-configuration',
  'surface-intelligence',
  'race-office',
  'equine-barn-operations',
  'steward-center',
  'security-emergency-operations',
  'compliance-accreditation',
  'responsible-ai-governance',
  'ai-control-plane',
  'audit-ledger',
  'platform-observability',
  'frontend-workspaces',
  'testing',
] as const;
export type NexusUpgradeAreaId = typeof nexusUpgradeAreaIds[number];

export const nexusComplianceFrameworks = ['ISO-42001','NIST-AI-RMF','ISO-27001','ISO-27701','ISO-25010','ISO-31000','ISO-22301','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION'] as const;
export type NexusComplianceFramework = typeof nexusComplianceFrameworks[number];

export const nexusUniversalEvidenceFrameworks = ['ISO-42001','ISO-27001','ISO-27701','ISO-31000','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION'] as const satisfies readonly NexusComplianceFramework[];
export const nexusHisaOperationalOversightCategories = ['racetrack-management','racing-office-operations','maintenance-facilities','safety','accreditation'] as const;
export type NexusHisaOperationalOversightCategory = typeof nexusHisaOperationalOversightCategories[number];

export const nexusDigitalTwinAssetKinds = [
  'racetrack',
  'race-meet',
  'race-day',
  'race-card',
  'race',
  'track-sector',
  'starting-gate',
  'horse',
  'jockey',
  'trainer',
  'owner',
  'veterinarian',
  'steward',
  'official',
  'fan',
  'data-provider',
  'federation-participant',
  'finance-record',
  'barn',
  'stall',
  'facility',
  'camera',
  'sensor',
  'vehicle',
  'emergency-asset',
  'workflow',
  'approval',
  'incident',
  'ai-agent',
] as const;
export type NexusDigitalTwinAssetKind = typeof nexusDigitalTwinAssetKinds[number];

export const nexusUpgradeStatuses = ['implemented','partial','readiness-metadata','placeholder'] as const;
export type NexusUpgradeStatus = typeof nexusUpgradeStatuses[number];

export const trackMindOSComponentIds = [
  'operations-os',
  'safety-os',
  'compliance-os',
  'ai-os',
  'digital-twin-os',
  'command-center-os',
  'accreditation-os',
  'multi-track-federation-os',
  'racing-intelligence-network',
] as const;
export type TrackMindOSComponentId = typeof trackMindOSComponentIds[number];

export const nexusUniversalSchemaCoverageIds = ['entity','event','workflow','approval','twin','ai','audit','compliance'] as const;
export type NexusUniversalSchemaCoverageId = typeof nexusUniversalSchemaCoverageIds[number];

export const nexusSaaSTierIds = ['starter','professional','enterprise','national-federation'] as const;
export type NexusSaaSTierId = typeof nexusSaaSTierIds[number];

export interface NexusWorkspaceUpgrade {
  id: NexusWorkspaceId;
  title: string;
  route: string;
  apiPath: string;
  owner: string;
  status: NexusUpgradeStatus;
  roleAware: boolean;
  loadingStates: boolean;
  errorStates: boolean;
  emptyStates: boolean;
  mockLiveAdapter: boolean;
  approvalRequiredActions: string[];
  eventTypes: string[];
  auditActions: string[];
  twinKinds: NexusDigitalTwinAssetKind[];
  observabilityMetrics: string[];
  testCoverage: string[];
}

export interface NexusEventContract {
  name: string;
  eventType: `${string}.${string}.${string}.v${number}`;
  version: number;
  aggregate: string;
  requiredMetadata: readonly string[];
  payloadFields: readonly string[];
  auditRequired: true;
  digitalTwinReferenceRequired: boolean;
  replayable: true;
}

export interface NexusSafetyControl {
  protectedAction: ProtectedAIAutonomyAction;
  normalizedAction: string;
  aiMayDraft: true;
  autonomousExecutionAllowed: false;
  requiredRoles: string[];
  evidenceRequired: string[];
}

export type NexusAIControlPlaneStage = 'inputs' | 'feature-store' | 'model-registry' | 'expert-models' | 'ai-governor' | 'approved-outputs';
export interface NexusAIControlPlaneModule {
  id: string;
  title: string;
  stage: NexusAIControlPlaneStage;
  workspaceId: NexusWorkspaceId;
  apiContracts: string[];
  eventTypes: string[];
  auditActions: string[];
  safetyControls: string[];
  observabilityMetrics: string[];
  digitalTwinKinds: NexusDigitalTwinAssetKind[];
  tests: string[];
  governanceAnchors: NexusComplianceFramework[];
  status: NexusUpgradeStatus;
}

export interface NexusAIControlPlaneMetadata {
  name: 'TrackMind Unified AI/ML Control Plane';
  flow: NexusAIControlPlaneStage[];
  governanceAnchors: NexusComplianceFramework[];
  digitalTwinTarget: string;
  modules: NexusAIControlPlaneModule[];
  eventTypes: string[];
  auditActions: string[];
  safetyControls: string[];
  observabilityMetrics: string[];
  tests: string[];
}

export interface NexusUniversalEvidencePackageMetadata {
  evidenceId: string;
  tenantId: string;
  racetrackId: string;
  sourceRefs: Array<{ objectType: 'source-object' | 'workflow' | 'control'; objectId: string }>;
  auditRefs: string[];
  eventRefs: string[];
  digitalTwinRefs: string[];
  aiRecommendationRefs: string[];
  frameworkMappings: Array<{ frameworkId: NexusComplianceFramework; controls: string[]; evidenceUse: 'reusable'; relationship: 'primary' | 'supports' | 'overlaps' | 'localizes' }>;
  controlOwner: { ownerId: string; role: string };
  reviewCadence: 'continuous' | 'race-day' | 'quarterly' | 'annual' | 'incident-driven';
  hisaOperationalOversightCategories: NexusHisaOperationalOversightCategory[];
  accreditationReadiness: { status: 'readiness-evidence-only'; score: number; readinessOnly: true; externalCertificationClaimed: false };
}

export interface NexusUniversalSchemaCoverage {
  id: NexusUniversalSchemaCoverageId;
  label: string;
  status: NexusUpgradeStatus;
  models: string[];
  routeIds: NexusWorkspaceId[];
  eventTypes: string[];
  auditActions: string[];
  readinessControls: string[];
}

export interface TrackMindOSComponentMetadata {
  id: TrackMindOSComponentId;
  title: string;
  status: NexusUpgradeStatus;
  routeIds: NexusWorkspaceId[];
  routePaths: string[];
  connectedWorkspaces: NexusWorkspaceId[];
  universalSchemaCoverage: NexusUniversalSchemaCoverageId[];
  saasTiers: NexusSaaSTierId[];
  certifiedTrackReadiness: NexusUpgradeStatus;
  unifiedDataModel: NexusUpgradeStatus;
  intelligenceCore: NexusUpgradeStatus;
  federation: NexusUpgradeStatus;
  observabilityControls: string[];
  safetyControls: string[];
  caveat: string;
}

export interface NexusReadinessControl {
  id: string;
  title: string;
  status: NexusUpgradeStatus;
  controls: string[];
  caveat: string;
}

export interface NexusSaaSTierMetadata {
  id: NexusSaaSTierId;
  title: string;
  status: NexusUpgradeStatus;
  includedOS: TrackMindOSComponentId[];
  controls: string[];
  caveat: string;
}

export interface NexusPlatformReadinessMetadata {
  saasTiers: NexusSaaSTierMetadata[];
  certifiedTrack: NexusReadinessControl;
  unifiedDataModel: NexusReadinessControl;
  intelligenceCore: NexusReadinessControl;
  federation: NexusReadinessControl;
  observabilityControls: NexusReadinessControl[];
  safetyControls: NexusReadinessControl[];
}

export interface NexusFederationMetadata {
  schemaVersion: 'trackmind.federation.v1';
  organizationId: string;
  tenantId: string;
  racetrackId: string;
  standardizedSchemaVersion: 'trackmind.federation.standard.v1';
  trackCertificationStatus: 'candidate' | 'ready-for-trackmind-review' | 'action-required' | 'blocked';
  tenantIsolation: { rawCrossTenantAccessAllowed: false; crossTenantJoinsAllowed: false; isolationKeys: string[]; enforcement: string[] };
  dataSharingPolicy: { policyId: string; permissionGoverned: true; approvalRequired: true; consentRequired: true; allowedExports: string[]; prohibitedFields: string[] };
  federationGovernance: { councilId: string; policyVersion: string; decisionRights: string[]; auditActions: string[] };
  consentRetentionBoundaries: Array<{ boundaryId: string; subject: string; retentionDays: number; consentBasis: string }>;
  crossTrackBenchmarkingMetrics: Array<{ metricId: string; aggregation: 'median' | 'p75' | 'p95' | 'rate' | 'count'; anonymized: true; minCohortSize: number; rawTrackDataExposed: false; permissionRequired: string }>;
  anonymizedIndustryAnalytics: Array<{ analyticId: string; aggregationLevel: string; anonymized: true; minCohortSize: number; rawRecordRefs: [] }>;
  rawCrossTrackDataExposed: false;
  executionEndpointsAvailable: false;
}

export interface NexusUpgradeArea {
  id: NexusUpgradeAreaId;
  title: string;
  connectedWorkspaces: NexusWorkspaceId[];
  sharedModels: string[];
  apiContracts: string[];
  eventContracts: string[];
  auditActions: string[];
  approvalControls: string[];
  digitalTwinKinds: NexusDigitalTwinAssetKind[];
  observabilitySignals: string[];
  tests: string[];
  status: NexusUpgradeStatus;
}

export interface TrackMindNexusUpgradePackage {
  schemaVersion: typeof nexusUpgradePackageVersion;
  platform: 'TrackMind Nexus';
  azureFirst: true;
  safetyCritical: true;
  humanGoverned: true;
  generatedAt: string;
  workspaces: NexusWorkspaceUpgrade[];
  areas: NexusUpgradeArea[];
  trackMindOS: TrackMindOSComponentMetadata[];
  universalSchemaCoverage: NexusUniversalSchemaCoverage[];
  platformReadiness: NexusPlatformReadinessMetadata;
  eventContracts: NexusEventContract[];
  safetyControls: NexusSafetyControl[];
  complianceFrameworks: NexusComplianceFramework[];
  digitalTwinAssetKinds: NexusDigitalTwinAssetKind[];
  aiControlPlane: NexusAIControlPlaneMetadata;
  universalEvidencePackage: NexusUniversalEvidencePackageMetadata;
  federation: NexusFederationMetadata;
  tier7SaasModel: TrackMindSaasModel;
}

const requiredEventMetadata = ['eventId','eventType','version','timestamp','actorId','actor','source','correlationId','causationId','aggregateId','tenantId','racetrackId','payload','auditRef','digitalTwinRef'] as const;

const aiControlPlaneMetricNames = [
  'ai_input_throughput',
  'ai_feature_build_count',
  'ai_model_selection_count',
  'ai_recommendation_count',
  'ai_blocked_action_count',
  'ai_approval_required_count',
  'ai_adjusted_confidence_distribution',
  'ai_stale_low_quality_input_count',
  'ai_event_sync_status',
  'ai_audit_sync_status',
  'ai_twin_sync_status',
] as const;

export const nexusEventContracts: NexusEventContract[] = [
  { name: 'AI input ingested', eventType: 'ai.input.ingested.v1', version: 1, aggregate: 'AIInput', requiredMetadata: requiredEventMetadata, payloadFields: ['inputId','source','qualityScore','stale','featureSetId'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI feature set built', eventType: 'ai.feature-set.built.v1', version: 1, aggregate: 'AIFeatureSet', requiredMetadata: requiredEventMetadata, payloadFields: ['featureSetId','inputCount','qualityScore','lineage'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI features built', eventType: 'ai.features.built.v1', version: 1, aggregate: 'AIFeatureSet', requiredMetadata: requiredEventMetadata, payloadFields: ['featureBuildId','inputId','featureSetId','features'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI model selected', eventType: 'ai.model.selected.v1', version: 1, aggregate: 'AIModelSelection', requiredMetadata: requiredEventMetadata, payloadFields: ['modelVersionId','expertDomain','selectionReason','fallbackUsed'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI recommendation created', eventType: 'ai.recommendation.created.v1', version: 1, aggregate: 'AIRecommendation', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','confidence','affectedAssets','approvalRequired','advisoryOnly'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI governor reviewed', eventType: 'ai.governor.reviewed.v1', version: 1, aggregate: 'AIGovernorDecision', requiredMetadata: requiredEventMetadata, payloadFields: ['reviewId','action','allowed','riskLevel','approvalRequired','digitalTwinRefs'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI action blocked', eventType: 'ai.action.blocked.v1', version: 1, aggregate: 'AIBlockedAction', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','action','target','reason','riskLevel','digitalTwinRefs'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI recommendation blocked', eventType: 'ai.recommendation.blocked.v1', version: 1, aggregate: 'AIRecommendation', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','protectedAction','reason','requiredRoles'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI safety policy enforced', eventType: 'ai.safety.policy.enforced.v1', version: 1, aggregate: 'AISafetyPolicy', requiredMetadata: requiredEventMetadata, payloadFields: ['policyId','recommendationId','allowedActivities','protectedActions','prohibitedAutonomousActions'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI approval required', eventType: 'ai.approval.required.v1', version: 1, aggregate: 'AIRecommendation', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','approvalPolicy','requiredRoles','evidence'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI confidence adjusted', eventType: 'ai.confidence.adjusted.v1', version: 1, aggregate: 'AIRecommendation', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','rawConfidence','adjustedConfidence','band','drivers'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI Digital Twin impact queued', eventType: 'ai.digital-twin.impact.queued.v1', version: 1, aggregate: 'AIDigitalTwinImpact', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','twinId','assetId','approvalRequired','patch'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI metric observed', eventType: 'ai.metric.observed.v1', version: 1, aggregate: 'AIMonitoringMetric', requiredMetadata: requiredEventMetadata, payloadFields: ['modelId','metric','value','threshold','breached'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI dashboard updated', eventType: 'ai.dashboard.updated.v1', version: 1, aggregate: 'AIDashboard', requiredMetadata: requiredEventMetadata, payloadFields: ['dashboardId','summary','metrics'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Protected action approved', eventType: 'approval.protectedAction.approved.v1', version: 1, aggregate: 'Approval', requiredMetadata: requiredEventMetadata, payloadFields: ['approvalId','recommendationId','protectedAction','target','approverRole'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Audit event recorded', eventType: 'audit.event.recorded.v1', version: 1, aggregate: 'AuditEvent', requiredMetadata: requiredEventMetadata, payloadFields: ['auditId','action','decision','hash','previousHash'], auditRequired: true, digitalTwinReferenceRequired: false, replayable: true },
  { name: 'Asset registry change', eventType: 'asset.registry.changed.v1', version: 1, aggregate: 'Asset', requiredMetadata: requiredEventMetadata, payloadFields: ['assetId','assetType','lifecycleStatus','riskClassification'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Race office change', eventType: 'race.office.changed.v1', version: 1, aggregate: 'Race', requiredMetadata: requiredEventMetadata, payloadFields: ['raceId','changeType','approvalStatus'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Starting gate movement requested', eventType: 'gate.movement.requested.v1', version: 1, aggregate: 'StartingGate', requiredMetadata: requiredEventMetadata, payloadFields: ['gateId','targetPosition','workOrderId'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Approval transition', eventType: 'approval.request.transitioned.v1', version: 1, aggregate: 'Approval', requiredMetadata: requiredEventMetadata, payloadFields: ['approvalId','action','status','requiredRoles'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Audit record appended', eventType: 'audit.record.appended.v1', version: 1, aggregate: 'AuditRecord', requiredMetadata: requiredEventMetadata, payloadFields: ['auditId','action','hash','previousHash'], auditRequired: true, digitalTwinReferenceRequired: false, replayable: true },
  { name: 'Surface measurement recorded', eventType: 'surface.measurement.recorded.v1', version: 1, aggregate: 'TrackSector', requiredMetadata: requiredEventMetadata, payloadFields: ['sectorId','moisture','compaction','cushionDepth','drainage'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Incident state changed', eventType: 'incident.case.changed.v1', version: 1, aggregate: 'Incident', requiredMetadata: requiredEventMetadata, payloadFields: ['incidentId','severity','status','responseOwner'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'AI recommendation recorded', eventType: 'ai.recommendation.recorded.v1', version: 1, aggregate: 'AIRecommendation', requiredMetadata: requiredEventMetadata, payloadFields: ['recommendationId','confidence','affectedAssets','approvalRequired'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Workflow transition', eventType: 'workflow.instance.transitioned.v1', version: 1, aggregate: 'Workflow', requiredMetadata: requiredEventMetadata, payloadFields: ['workflowId','fromState','toState','assignedTo'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Facilities maintenance work order', eventType: 'facilities.work-order.requested.v1', version: 1, aggregate: 'FacilityAsset', requiredMetadata: requiredEventMetadata, payloadFields: ['assetId','workOrderId','approvalRequestId','healthScore'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Compliance evidence collected', eventType: 'compliance.evidence.collected.v1', version: 1, aggregate: 'ComplianceControl', requiredMetadata: requiredEventMetadata, payloadFields: ['controlId','evidenceIds','auditRecordId','workflowInstanceId'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Compliance readiness changed', eventType: 'compliance.accreditation.readiness.updated.v1', version: 1, aggregate: 'ComplianceProgram', requiredMetadata: requiredEventMetadata, payloadFields: ['programId','frameworkIds','readinessScore','evidencePackageIds'], auditRequired: true, digitalTwinReferenceRequired: true, replayable: true },
  { name: 'Federation benchmark published', eventType: 'federation.benchmark.published.v1', version: 1, aggregate: 'FederationBenchmark', requiredMetadata: requiredEventMetadata, payloadFields: ['metricId','aggregation','minCohortSize','anonymized','permissionRequired'], auditRequired: true, digitalTwinReferenceRequired: false, replayable: true },
  { name: 'Federation data policy updated', eventType: 'federation.policy.updated.v1', version: 1, aggregate: 'FederationPolicy', requiredMetadata: requiredEventMetadata, payloadFields: ['policyId','allowedExports','prohibitedFields','consentRequired','retentionBoundary'], auditRequired: true, digitalTwinReferenceRequired: false, replayable: true },
];

function workspace(input: Omit<NexusWorkspaceUpgrade, 'roleAware'|'loadingStates'|'errorStates'|'emptyStates'|'mockLiveAdapter'>): NexusWorkspaceUpgrade {
  return { ...input, roleAware: true, loadingStates: true, errorStates: true, emptyStates: true, mockLiveAdapter: true };
}

export function createTrackMindNexusUpgradePackage(generatedAt = new Date().toISOString()): TrackMindNexusUpgradePackage {
  const workspaces: NexusWorkspaceUpgrade[] = [
    workspace({ id: 'operations', title: 'Operations Command', route: '/operations', apiPath: '/api/v1/operations/command-center', owner: 'Operations Command', status: 'partial', approvalRequiredActions: ['incident workflow escalation'], eventTypes: ['race.office.changed.v1','incident.case.changed.v1','ai.recommendation.created.v1','ai.recommendation.recorded.v1'], auditActions: ['operations.dashboard.read','operations.alert.acknowledge'], twinKinds: ['racetrack','race-meet','race-day','race','track-sector','workflow','incident','ai-agent'], observabilityMetrics: ['race_readiness_score','active_incidents','approval_queue_depth'], testCoverage: ['routing','role visibility','mock/live adapter'] }),
    workspace({ id: 'race-office', title: 'Race Office', route: '/race-office', apiPath: '/api/v1/race-operations/race-office', owner: 'Race Office', status: 'partial', approvalRequiredActions: ['scratch horse','race status transition','official configuration change'], eventTypes: ['race.office.changed.v1','approval.protectedAction.approved.v1','approval.request.transitioned.v1'], auditActions: ['race.office.changed','race.status.transitioned'], twinKinds: ['racetrack','race-meet','race-day','race','horse','jockey','steward','workflow','approval'], observabilityMetrics: ['race_office_changes','race_readiness_blockers'], testCoverage: ['approval-required flows','audit creation','event emission'] }),
    workspace({ id: 'track-configuration', title: 'Track Configuration', route: '/race-day', apiPath: '/api/v1/track-configuration/map', owner: 'Track Configuration', status: 'partial', approvalRequiredActions: ['rail position change','turf configuration change'], eventTypes: ['gate.movement.requested.v1','workflow.instance.transitioned.v1'], auditActions: ['track.configuration.changed'], twinKinds: ['racetrack','track-sector','starting-gate'], observabilityMetrics: ['configuration_change_count','gps_verification_status'], testCoverage: ['validation schemas','Digital Twin synchronization'] }),
    workspace({ id: 'assets', title: 'Asset Registry', route: '/facilities', apiPath: '/api/v1/assets', owner: 'Asset Registry', status: 'implemented', approvalRequiredActions: ['critical asset lifecycle change'], eventTypes: ['asset.registry.changed.v1'], auditActions: ['asset.created','asset.updated','asset.approved'], twinKinds: ['racetrack','starting-gate','horse','barn','facility','camera','sensor','vehicle','emergency-asset','ai-agent'], observabilityMetrics: ['asset_count','critical_asset_count'], testCoverage: ['tenant isolation','event/audit/twin sync'] }),
    workspace({ id: 'facilities', title: 'Facilities', route: '/facilities', apiPath: '/api/v1/facilities-maintenance/workspace', owner: 'Facilities Maintenance', status: 'implemented', approvalRequiredActions: ['facility maintenance execution','return to service','remove patron asset from service'], eventTypes: ['facilities.work-order.requested.v1','workflow.instance.transitioned.v1','approval.request.transitioned.v1'], auditActions: ['facilities.inspection.recorded','facilities.work-order.requested','facilities.work-order.completed'], twinKinds: ['facility','sensor','vehicle','emergency-asset','workflow','approval'], observabilityMetrics: ['facility_readiness_score','facility_open_work_orders','facility_predictive_urgent'], testCoverage: ['RACR-backed assets','Digital Twin sync','approval-gated work orders','frontend workspace'] }),
    workspace({ id: 'workforce', title: 'Workforce', route: '/facilities', apiPath: '/api/v1/workforce-operations/workspace', owner: 'Workforce Operations', status: 'partial', approvalRequiredActions: ['schedule change','emergency staffing assignment'], eventTypes: ['workflow.instance.transitioned.v1','audit.record.appended.v1'], auditActions: ['workforce.assignment.changed','workforce.certification.reviewed'], twinKinds: ['workflow','facility','emergency-asset'], observabilityMetrics: ['staffing_readiness_score','open_shift_count','certification_expiry_count'], testCoverage: ['role visibility','workforce endpoint contract','frontend workspace'] }),
    workspace({ id: 'digital-twin', title: 'Digital Twin View', route: '/facilities', apiPath: '/api/v1/digital-twin/state', owner: 'Digital Twin Runtime', status: 'implemented', approvalRequiredActions: ['twin command patch'], eventTypes: ['asset.registry.changed.v1','surface.measurement.recorded.v1'], auditActions: ['digital-twin.state.updated'], twinKinds: [...nexusDigitalTwinAssetKinds], observabilityMetrics: ['twin_health','queued_sync'], testCoverage: ['twin synchronization','tenant filtering'] }),
    workspace({ id: 'starting-gate', title: 'Starting Gate Control', route: '/starting-gate', apiPath: '/api/v1/starting-gate/position', owner: 'Race Control', status: 'partial', approvalRequiredActions: ['starting gate move','race distance configuration'], eventTypes: ['gate.movement.requested.v1','approval.request.transitioned.v1'], auditActions: ['starting-gate.move.requested','starting-gate.verified'], twinKinds: ['starting-gate','track-sector','workflow','approval'], observabilityMetrics: ['gate_verification_latency','gate_approval_sla'], testCoverage: ['safety-critical action blocking','approval-required flows'] }),
    workspace({ id: 'surface', title: 'Surface Intelligence', route: '/surface', apiPath: '/api/v1/surface-intelligence/workspace', owner: 'Track Surface', status: 'partial', approvalRequiredActions: ['irrigation','harrowing','rolling','closure recommendation'], eventTypes: ['surface.measurement.recorded.v1','approval.request.transitioned.v1'], auditActions: ['surface.measurement.recorded','surface.recommendation.created'], twinKinds: ['track-sector','sensor','workflow','approval'], observabilityMetrics: ['surface_condition_score','surface_recommendation_queue'], testCoverage: ['heatmap data','approval-required operational actions'] }),
    workspace({ id: 'equine', title: 'Equine Intelligence', route: '/equine', apiPath: '/api/v1/equine-intelligence/horses/{horseId}', owner: 'Equine Safety', status: 'partial', approvalRequiredActions: ['veterinary status change','eligibility change'], eventTypes: ['ai.recommendation.created.v1','ai.recommendation.recorded.v1','workflow.instance.transitioned.v1'], auditActions: ['equine.profile.read','equine.ai.recommendation.recorded'], twinKinds: ['horse','trainer','owner','veterinarian','barn','stall','ai-agent'], observabilityMetrics: ['vet_review_queue','equine_advisory_count'], testCoverage: ['AI advisory only','veterinarian review required'] }),
    workspace({ id: 'barns', title: 'Barn Operations', route: '/equine', apiPath: '/api/v1/barn-operations/workspace', owner: 'Barn Operations', status: 'partial', approvalRequiredActions: ['restricted stall assignment','barn transfer'], eventTypes: ['workflow.instance.transitioned.v1','asset.registry.changed.v1'], auditActions: ['barn.movement.recorded','barn.access.recorded'], twinKinds: ['barn','stall','horse','trainer','veterinarian','sensor'], observabilityMetrics: ['stall_occupancy','barn_readiness_score'], testCoverage: ['movement event/audit/twin references'] }),
    workspace({ id: 'stewards', title: 'Steward Center', route: '/compliance', apiPath: '/api/v1/stewarding/inquiries', owner: 'Stewarding', status: 'partial', approvalRequiredActions: ['official steward ruling','official result change'], eventTypes: ['incident.case.changed.v1','audit.event.recorded.v1','audit.record.appended.v1'], auditActions: ['steward.inquiry.opened','steward.ai.summary.created'], twinKinds: ['steward','jockey','horse','race','incident','workflow','approval','ai-agent'], observabilityMetrics: ['open_inquiries','appeal_package_count'], testCoverage: ['AI cannot issue final rulings'] }),
    workspace({ id: 'safety', title: 'Safety Center', route: '/incidents', apiPath: '/api/v1/operations/command-center', owner: 'Safety Operations', status: 'partial', approvalRequiredActions: ['security escalation','emergency authority handoff','surface closure recommendation','veterinary review','steward ruling'], eventTypes: ['incident.case.changed.v1','workflow.instance.transitioned.v1','approval.request.transitioned.v1','surface.measurement.recorded.v1','ai.recommendation.created.v1'], auditActions: ['safety.center.read','security.incident.escalated','emergency.workflow.activated','steward.inquiry.opened'], twinKinds: ['racetrack','track-sector','horse','barn','facility','camera','emergency-asset','workflow','approval','incident'], observabilityMetrics: ['safety_denial_count','active_incidents','emergency_resource_status','surface_recommendation_queue'], testCoverage: ['route guard','permission denied','not found fallback','safety center rendering'] }),
    workspace({ id: 'approvals', title: 'Approvals', route: '/approvals', apiPath: '/api/v1/approvals/requests', owner: 'Approval Governance', status: 'implemented', approvalRequiredActions: ['all protected actions'], eventTypes: ['approval.request.transitioned.v1'], auditActions: ['approval.requested','approval.execution-authorized'], twinKinds: ['approval','workflow'], observabilityMetrics: ['approval_queue_depth','approval_sla_breaches'], testCoverage: ['AI restriction enforcement','approval token matching'] }),
    workspace({ id: 'audit', title: 'Audit Ledger', route: '/audit', apiPath: '/api/v1/audit/events', owner: 'Audit Ledger', status: 'implemented', approvalRequiredActions: [], eventTypes: ['audit.record.appended.v1'], auditActions: ['audit.read','audit.verify'], twinKinds: ['workflow','approval','incident'], observabilityMetrics: ['audit_record_volume','ledger_valid'], testCoverage: ['immutable hash chain','forensic timeline'] }),
    workspace({ id: 'security', title: 'Security', route: '/security', apiPath: '/api/v1/security-operations/workspace', owner: 'Security Operations', status: 'partial', approvalRequiredActions: ['restricted data reveal','security escalation'], eventTypes: ['incident.case.changed.v1','asset.registry.changed.v1'], auditActions: ['security.access.checked','security.incident.escalated'], twinKinds: ['camera','sensor','incident','facility'], observabilityMetrics: ['restricted_zone_events','camera_health'], testCoverage: ['role visibility','audit masking'] }),
    workspace({ id: 'emergency', title: 'Emergency Ops', route: '/emergency', apiPath: '/api/v1/emergency-operations/workspace', owner: 'Emergency Operations', status: 'partial', approvalRequiredActions: ['emergency control override'], eventTypes: ['incident.case.changed.v1','workflow.instance.transitioned.v1'], auditActions: ['emergency.workflow.activated','emergency.communication.completed'], twinKinds: ['emergency-asset','vehicle','workflow','incident'], observabilityMetrics: ['emergency_resource_status','communication_completion'], testCoverage: ['human authority prioritized','AI cannot block emergency personnel'] }),
    workspace({ id: 'compliance', title: 'Compliance', route: '/compliance', apiPath: '/api/v1/compliance/control-library', owner: 'Compliance', status: 'partial', approvalRequiredActions: ['compliance filing approval'], eventTypes: ['audit.record.appended.v1','workflow.instance.transitioned.v1','compliance.evidence.collected.v1','compliance.accreditation.readiness.updated.v1'], auditActions: ['compliance.evidence.collected','compliance.finding.created','compliance.corrective-action.created','compliance.accreditation.readiness.updated'], twinKinds: ['workflow','approval','incident'], observabilityMetrics: ['audit_readiness_score','open_findings','evidence_package_coverage','accreditation_readiness_score'], testCoverage: ['framework mappings','evidence links','accreditation readiness','HISA/ARCI/local commission mappings'] }),
    workspace({ id: 'ai-governance', title: 'AI Governance', route: '/settings', apiPath: '/api/v1/ai-governance/workspace', owner: 'Responsible AI Governor', status: 'partial', approvalRequiredActions: ['AI recommendation approval','AI override approval','AI rollback approval','protected action approval'], eventTypes: ['ai.input.ingested.v1','ai.feature-set.built.v1','ai.model.selected.v1','ai.recommendation.created.v1','ai.recommendation.recorded.v1','ai.recommendation.blocked.v1','ai.safety.policy.enforced.v1','ai.approval.required.v1','ai.confidence.adjusted.v1','ai.digital-twin.impact.queued.v1','approval.request.transitioned.v1'], auditActions: ['ai.input.ingested','ai.feature-set.built','ai.model.selected','ai.recommendation.recorded','ai.recommendation.blocked','ai.safety.policy.enforced','ai.approval.required','ai.confidence.adjusted','ai.digital-twin.impact.queued','ai.override.recorded','ai.rollback.recorded'], twinKinds: ['ai-agent','workflow','approval','incident','racetrack','race','track-sector','horse','barn','facility'], observabilityMetrics: [...aiControlPlaneMetricNames,'blocked_ai_actions','model_drift_breaches','ai_confidence_score','ai_evidence_count','ai_approval_required'], testCoverage: ['protected action blocking','recommendation evidence','confidence explainability','Digital Twin impact queue','AI control plane metadata'] }),
    workspace({ id: 'api-hub', title: 'Racing Data API Hub', route: '/data-hub', apiPath: '/api/v1/racing-data', owner: 'Racing Data API Hub', status: 'implemented', approvalRequiredActions: [], eventTypes: ['audit.record.appended.v1','workflow.instance.transitioned.v1','ai.input.ingested.v1'], auditActions: ['racing-data.provider.read','racing-data.ingestion.reviewed','racing-data.license.reviewed','racing-data.lineage.read'], twinKinds: ['racetrack','race-meet','race-day','race','horse','jockey','trainer','owner','veterinarian','steward','workflow','approval','ai-agent'], observabilityMetrics: ['provider_health','ingestion_job_status','lineage_exception_count','license_policy_review_count'], testCoverage: ['provider registry','ingestion and lineage metadata','license policy review','frontend API Hub workspace'] }),
    workspace({ id: 'executive', title: 'Executive Center', route: '/dashboard', apiPath: '/api/v1/operations/command-center', owner: 'Executive Intelligence', status: 'partial', approvalRequiredActions: [], eventTypes: ['audit.record.appended.v1','ai.recommendation.recorded.v1'], auditActions: ['executive.dashboard.read'], twinKinds: ['racetrack','workflow','incident'], observabilityMetrics: ['safety_kpi','compliance_kpi','asset_health_kpi'], testCoverage: ['role visibility','read-only posture'] }),
    workspace({ id: 'platform-health', title: 'Platform Health', route: '/platform-health', apiPath: '/api/v1/platform/health', owner: 'Platform Observability', status: 'implemented', approvalRequiredActions: [], eventTypes: ['workflow.instance.transitioned.v1','audit.record.appended.v1','ai.input.ingested.v1','ai.recommendation.created.v1'], auditActions: ['platform.health.read','ai.control-plane.health.read'], twinKinds: ['workflow','ai-agent'], observabilityMetrics: ['event_throughput','api_latency','frontend_errors','twin_sync_status',...aiControlPlaneMetricNames], testCoverage: ['health endpoint','frontend degraded state','AI control plane observability metadata'] }),
  ];

  const safetyControls = ['start-race','stop-race','declare-official-results','modify-official-results','scratch-horse','clear-veterinary-flag','issue-steward-ruling','trigger-payout','override-emergency-personnel','execute-safety-critical-control'].map((action) => {
    const protectedAction = canonicalProtectedAutonomyAction(action) as ProtectedAIAutonomyAction;
    const requirement = createApprovalRequirement(protectedAction);
    return { protectedAction, normalizedAction: action, aiMayDraft: true as const, autonomousExecutionAllowed: false as const, requiredRoles: requirement.requiredRoles, evidenceRequired: requirement.evidenceRequired };
  });

  const areas: NexusUpgradeArea[] = nexusUpgradeAreaIds.map((id) => {
    const connectedWorkspaces = workspaces.filter((workspace) => areaConnectsWorkspace(id, workspace.id)).map((workspace) => workspace.id);
    const events = [...new Set(connectedWorkspaces.flatMap((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.eventTypes ?? []))];
    return {
      id,
      title: id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '),
      connectedWorkspaces,
      sharedModels: ['DomainEntityBase','RacetrackEntity','RaceMeetEntity','RaceDayEntity','RaceEntity','HorseEntity','JockeyEntity','TrainerEntity','OwnerEntity','VeterinarianEntity','StewardEntity','BarnEntity','StallEntity','TrackSectorEntity','FacilityEntity','AssetEntity','WorkflowEntity','AIRecommendationEntity','ApprovalEntity','AuditEventEntity','NexusEventEnvelope','ApprovalDecision','AuditEvent','DigitalTwinReference'],
      apiContracts: connectedWorkspaces.map((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)!.apiPath),
      eventContracts: events,
      auditActions: [...new Set(connectedWorkspaces.flatMap((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.auditActions ?? []))],
      approvalControls: [...new Set(connectedWorkspaces.flatMap((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.approvalRequiredActions ?? []))],
      digitalTwinKinds: [...new Set(connectedWorkspaces.flatMap((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.twinKinds ?? []))],
      observabilitySignals: [...new Set(connectedWorkspaces.flatMap((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.observabilityMetrics ?? []))],
      tests: [...new Set(connectedWorkspaces.flatMap((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.testCoverage ?? []))],
      status: connectedWorkspaces.every((workspaceId) => workspaces.find((workspace) => workspace.id === workspaceId)?.status === 'implemented') ? 'implemented' : 'partial',
    };
  });

  const aiControlPlane = createAIControlPlaneMetadata(workspaces, safetyControls);
  const tier7SaasModel = createTrackMindSaasModel();
  const universalSchemaCoverage = createUniversalSchemaCoverage(workspaces);
  const trackMindOS = createTrackMindOSMetadata(workspaces, universalSchemaCoverage);
  const platformReadiness = createPlatformReadinessMetadata(trackMindOS);
  const federation = createNexusFederationMetadata();
  const universalEvidencePackage = createUniversalEvidencePackageMetadata();

  return { schemaVersion: nexusUpgradePackageVersion, platform: 'TrackMind Nexus', azureFirst: true, safetyCritical: true, humanGoverned: true, generatedAt, workspaces, areas, trackMindOS, universalSchemaCoverage, platformReadiness, eventContracts: nexusEventContracts, safetyControls, complianceFrameworks: [...nexusComplianceFrameworks], digitalTwinAssetKinds: [...nexusDigitalTwinAssetKinds], aiControlPlane, universalEvidencePackage, federation, tier7SaasModel };
}

export function validateTrackMindNexusUpgradePackage(pkg: TrackMindNexusUpgradePackage): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pkg.schemaVersion !== nexusUpgradePackageVersion) errors.push('schemaVersion must match TrackMind Nexus upgrade package v1');
  for (const workspaceId of nexusWorkspaceIds) if (!pkg.workspaces.some((workspace) => workspace.id === workspaceId)) errors.push(`workspace missing: ${workspaceId}`);
  for (const areaId of nexusUpgradeAreaIds) if (!pkg.areas.some((area) => area.id === areaId)) errors.push(`upgrade area missing: ${areaId}`);
  for (const framework of nexusComplianceFrameworks) if (!pkg.complianceFrameworks.includes(framework)) errors.push(`compliance framework missing: ${framework}`);
  for (const assetKind of nexusDigitalTwinAssetKinds) if (!pkg.digitalTwinAssetKinds.includes(assetKind)) errors.push(`digital twin asset kind missing: ${assetKind}`);
  for (const framework of ['ISO-42001','NIST-AI-RMF'] as const) if (!pkg.aiControlPlane.governanceAnchors.includes(framework)) errors.push(`AI control plane governance anchor missing: ${framework}`);
  for (const framework of nexusUniversalEvidenceFrameworks) if (!pkg.universalEvidencePackage.frameworkMappings.some((mapping) => mapping.frameworkId === framework)) errors.push(`universal evidence package missing framework mapping: ${framework}`);
  for (const category of nexusHisaOperationalOversightCategories) if (!pkg.universalEvidencePackage.hisaOperationalOversightCategories.includes(category)) errors.push(`universal evidence package missing HISA category: ${category}`);
  for (const sourceType of ['source-object','workflow','control'] as const) if (!pkg.universalEvidencePackage.sourceRefs.some((source) => source.objectType === sourceType)) errors.push(`universal evidence package missing source ref: ${sourceType}`);
  if (!pkg.universalEvidencePackage.accreditationReadiness.readinessOnly) errors.push('universal evidence package must model readiness only');
  if (pkg.universalEvidencePackage.accreditationReadiness.externalCertificationClaimed) errors.push('universal evidence package must not claim external certification');
  for (const metric of aiControlPlaneMetricNames) if (!pkg.aiControlPlane.observabilityMetrics.includes(metric)) errors.push(`AI control plane observability metric missing: ${metric}`);
  for (const stage of ['inputs','feature-store','model-registry','expert-models','ai-governor','approved-outputs'] as const) if (!pkg.aiControlPlane.flow.includes(stage)) errors.push(`AI control plane flow stage missing: ${stage}`);
  if (pkg.aiControlPlane.modules.length === 0) errors.push('AI control plane must declare modules');
  const saasValidation = validateTrackMindSaasModel(pkg.tier7SaasModel);
  if (!saasValidation.valid) errors.push(...saasValidation.errors.map((error) => `Tier 7 SaaS model: ${error}`));
  for (const osId of trackMindOSComponentIds) if (!pkg.trackMindOS.some((component) => component.id === osId)) errors.push(`TrackMind OS component missing: ${osId}`);
  for (const coverageId of nexusUniversalSchemaCoverageIds) if (!pkg.universalSchemaCoverage.some((coverage) => coverage.id === coverageId)) errors.push(`Universal Schema coverage missing: ${coverageId}`);
  for (const tierId of nexusSaaSTierIds) if (!pkg.platformReadiness.saasTiers.some((tier) => tier.id === tierId)) errors.push(`platform readiness SaaS tier missing: ${tierId}`);
  const knownWorkspaceIds = new Set<NexusWorkspaceId>(pkg.workspaces.map((workspace) => workspace.id));
  const knownCoverageIds = new Set<NexusUniversalSchemaCoverageId>(pkg.universalSchemaCoverage.map((coverage) => coverage.id));
  const validateStatus = (label: string, status: string) => {
    if (!(nexusUpgradeStatuses as readonly string[]).includes(status)) errors.push(`${label} status must be implemented, partial, readiness-metadata, or placeholder`);
  };
  const platformControls = [pkg.platformReadiness.certifiedTrack, pkg.platformReadiness.unifiedDataModel, pkg.platformReadiness.intelligenceCore, pkg.platformReadiness.federation, ...pkg.platformReadiness.observabilityControls, ...pkg.platformReadiness.safetyControls];
  if (pkg.platformReadiness.certifiedTrack.status === 'implemented') errors.push('certified track readiness must not claim implemented certification');
  if (pkg.platformReadiness.federation.status === 'implemented') errors.push('federation readiness must not claim implemented provisioning');
  for (const control of platformControls) {
    validateStatus(`platform readiness ${control.id}`, control.status);
    if (control.controls.length === 0) errors.push(`platform readiness ${control.id} must declare controls`);
    if (!/does not|not |metadata|readiness/i.test(control.caveat)) errors.push(`platform readiness ${control.id} must include a no-overclaim caveat`);
  }
  const osCoverage = new Set(pkg.trackMindOS.flatMap((component) => component.universalSchemaCoverage));
  for (const coverageId of nexusUniversalSchemaCoverageIds) if (!osCoverage.has(coverageId)) errors.push(`TrackMind OS coverage missing Universal Schema ${coverageId}`);
  for (const component of pkg.trackMindOS) {
    validateStatus(`TrackMind OS ${component.id}`, component.status);
    if (component.routeIds.length === 0) errors.push(`${component.id} must declare route IDs`);
    for (const routeId of component.routeIds) if (!knownWorkspaceIds.has(routeId)) errors.push(`${component.id} references unknown route/workspace ${routeId}`);
    if (component.routePaths.some((routePath) => !routePath.startsWith('/'))) errors.push(`${component.id} route paths must be absolute`);
    if (component.universalSchemaCoverage.length === 0) errors.push(`${component.id} must declare Universal Schema coverage`);
    for (const coverageId of component.universalSchemaCoverage) if (!knownCoverageIds.has(coverageId)) errors.push(`${component.id} references unknown Universal Schema coverage ${coverageId}`);
    if (component.certifiedTrackReadiness === 'implemented') errors.push(`${component.id} must not claim implemented certified-track readiness`);
    if (component.federation === 'implemented') errors.push(`${component.id} must not claim implemented federation provisioning`);
    if (component.observabilityControls.length === 0) errors.push(`${component.id} must declare observability controls`);
    if (component.safetyControls.length === 0) errors.push(`${component.id} must declare safety controls`);
    if (!/does not|not |metadata|readiness/i.test(component.caveat)) errors.push(`${component.id} must include a no-overclaim caveat`);
  }
  for (const coverage of pkg.universalSchemaCoverage) {
    validateStatus(`Universal Schema ${coverage.id}`, coverage.status);
    if (coverage.models.length === 0) errors.push(`${coverage.id} coverage must declare models`);
    if (coverage.routeIds.length === 0) errors.push(`${coverage.id} coverage must declare route IDs`);
    if (coverage.readinessControls.length === 0) errors.push(`${coverage.id} coverage must declare readiness controls`);
  }
  for (const tier of pkg.platformReadiness.saasTiers) {
    validateStatus(`platform readiness SaaS tier ${tier.id}`, tier.status);
    if (tier.includedOS.length === 0) errors.push(`${tier.id} SaaS tier must include TrackMind OS components`);
    if (tier.controls.length === 0) errors.push(`${tier.id} SaaS tier must declare controls`);
    if (!/not |metadata|readiness/i.test(tier.caveat)) errors.push(`${tier.id} SaaS tier must include a no-provisioning caveat`);
  }
  for (const event of pkg.eventContracts) {
    if (!event.auditRequired) errors.push(`${event.eventType} must require audit`);
    if (!event.replayable) errors.push(`${event.eventType} must support replay`);
    for (const metadata of requiredEventMetadata) if (!event.requiredMetadata.includes(metadata)) errors.push(`${event.eventType} missing metadata ${metadata}`);
  }
  for (const workspace of pkg.workspaces) {
    validateStatus(`workspace ${workspace.id}`, workspace.status);
    if (!workspace.route.startsWith('/')) errors.push(`${workspace.id} route must be absolute`);
    if (!workspace.apiPath.startsWith('/api/v1/')) errors.push(`${workspace.id} apiPath must be versioned`);
    if (!workspace.roleAware || !workspace.loadingStates || !workspace.errorStates || !workspace.emptyStates || !workspace.mockLiveAdapter) errors.push(`${workspace.id} missing frontend safety state coverage`);
    if (workspace.eventTypes.length === 0) errors.push(`${workspace.id} must declare event types`);
    if (workspace.auditActions.length === 0) errors.push(`${workspace.id} must declare audit actions`);
    if (workspace.twinKinds.length === 0) errors.push(`${workspace.id} must declare Digital Twin kinds`);
    if (workspace.observabilityMetrics.length === 0) errors.push(`${workspace.id} must declare observability metrics`);
    if (workspace.testCoverage.length === 0) errors.push(`${workspace.id} must declare test coverage`);
  }
  for (const module of pkg.aiControlPlane.modules) {
    validateStatus(`AI control plane module ${module.id}`, module.status);
    if (!pkg.workspaces.some((workspace) => workspace.id === module.workspaceId)) errors.push(`${module.id} references unknown workspace ${module.workspaceId}`);
    if (!module.governanceAnchors.includes('ISO-42001') || !module.governanceAnchors.includes('NIST-AI-RMF')) errors.push(`${module.id} must anchor ISO-42001 and NIST-AI-RMF`);
    if (module.observabilityMetrics.length === 0) errors.push(`${module.id} must declare observability metrics`);
  }
  for (const control of pkg.safetyControls) {
    if (control.autonomousExecutionAllowed) errors.push(`${control.protectedAction} must not allow autonomous execution`);
    if (!control.aiMayDraft) errors.push(`${control.protectedAction} should permit advisory drafting only`);
    if (control.requiredRoles.length === 0) errors.push(`${control.protectedAction} must declare required human roles`);
    if (!control.evidenceRequired.includes('human-approval-record')) errors.push(`${control.protectedAction} must require human approval evidence`);
  }
  return { valid: errors.length === 0, errors };
}

function createUniversalEvidencePackageMetadata(): NexusUniversalEvidencePackageMetadata {
  const controlIds = ['ctrl-ai-evidence','ctrl-security-audit','ctrl-privacy-minimization','ctrl-risk-treatment','ctrl-payment-security','ctrl-racing-safety-integrity','ctrl-rulebook-custody','ctrl-commission-filing'];
  return {
    evidenceId: 'evpkg-nexus-universal-compliance-readiness',
    tenantId: 'track-1',
    racetrackId: 'mock-main-track',
    sourceRefs: [{ objectType: 'source-object', objectId: 'race-day-readiness-q2' }, { objectType: 'workflow', objectId: 'accreditation-readiness-review' }, { objectType: 'control', objectId: 'ctrl-ai-evidence' }],
    auditRefs: ['audit-compliance-1','audit-compliance-2','audit-accreditation-1'],
    eventRefs: ['compliance.evidence.collected.v1','compliance.accreditation.readiness.updated.v1','ai.recommendation.recorded.v1'],
    digitalTwinRefs: ['race:race-7','surface:far-turn','equine:horse-1','workflow:ai-review'],
    aiRecommendationRefs: ['rec-race-start-readiness','rec-surface-maintenance-watch'],
    frameworkMappings: [
      ...nexusUniversalEvidenceFrameworks.map((frameworkId) => ({ frameworkId, controls: [...controlIds], evidenceUse: 'reusable' as const, relationship: frameworkId === 'LOCAL-RACING-COMMISSION' ? 'localizes' as const : frameworkId === 'HISA' || frameworkId === 'ARCI' ? 'overlaps' as const : 'supports' as const })),
      { frameworkId: 'NIST-AI-RMF' as const, controls: ['ctrl-ai-evidence','ctrl-racing-safety-integrity'], evidenceUse: 'reusable' as const, relationship: 'supports' as const },
    ],
    controlOwner: { ownerId: 'owner-compliance', role: 'compliance-officer' },
    reviewCadence: 'continuous',
    hisaOperationalOversightCategories: [...nexusHisaOperationalOversightCategories],
    accreditationReadiness: { status: 'readiness-evidence-only', score: 83, readinessOnly: true, externalCertificationClaimed: false },
  };
}

function createNexusFederationMetadata(): NexusFederationMetadata {
  return {
    schemaVersion: 'trackmind.federation.v1',
    organizationId: 'trackmind-demo-organization',
    tenantId: 'track-1',
    racetrackId: 'mock-main-track',
    standardizedSchemaVersion: 'trackmind.federation.standard.v1',
    trackCertificationStatus: 'candidate',
    tenantIsolation: { rawCrossTenantAccessAllowed: false, crossTenantJoinsAllowed: false, isolationKeys: ['organizationId','tenantId','racetrackId'], enforcement: ['role-aware routing','tenant-scoped DTOs','approval-governed exports','audit ledger evidence'] },
    dataSharingPolicy: { policyId: 'federation-readiness-policy-v1', permissionGoverned: true, approvalRequired: true, consentRequired: true, allowedExports: ['readiness-summary','compliance-candidate-score','anonymized-benchmark'], prohibitedFields: ['personally-identifiable-veterinary-notes','raw-security-watchlist','live-operational-control-token'] },
    federationGovernance: { councilId: 'federation-readiness-council', policyVersion: '2026.06', decisionRights: ['schema approval','benchmark publication approval','retention review'], auditActions: ['federation.workspace.read','federation.policy.reviewed'] },
    consentRetentionBoundaries: [
      { boundaryId: 'regulated-racing-records', subject: 'race operations and compliance evidence', retentionDays: 2555, consentBasis: 'regulatory obligation' },
      { boundaryId: 'anonymized-benchmarking', subject: 'aggregated industry analytics', retentionDays: 365, consentBasis: 'tenant data-sharing policy approval' },
    ],
    crossTrackBenchmarkingMetrics: [
      { metricId: 'surface-readiness-score', aggregation: 'median', anonymized: true, minCohortSize: 5, rawTrackDataExposed: false, permissionRequired: 'federation:benchmark:read' },
      { metricId: 'approval-sla-minutes-p95', aggregation: 'p95', anonymized: true, minCohortSize: 5, rawTrackDataExposed: false, permissionRequired: 'federation:benchmark:read' },
    ],
    anonymizedIndustryAnalytics: [
      { analyticId: 'ai-control-plane-readiness', aggregationLevel: 'track-cohort', anonymized: true, minCohortSize: 10, rawRecordRefs: [] },
    ],
    rawCrossTrackDataExposed: false,
    executionEndpointsAvailable: false,
  };
}

function createAIControlPlaneMetadata(workspaces: NexusWorkspaceUpgrade[], controls: NexusSafetyControl[]): NexusAIControlPlaneMetadata {
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const governanceAnchors: NexusComplianceFramework[] = ['ISO-42001','NIST-AI-RMF'];
  const modules: NexusAIControlPlaneModule[] = [
    aiControlPlaneModule('ai-inputs', 'Governed AI Inputs', 'inputs', 'operations', ['ai.input.ingested.v1','audit.record.appended.v1'], ['ai.input.ingested','ai.input.quality.reviewed'], ['evidence required','tenant isolation','stale input review'], ['ai_input_throughput','ai_stale_low_quality_input_count','ai_event_sync_status'], ['racetrack','race','track-sector','horse','facility','ai-agent'], ['input quality metadata','event/audit/twin sync'], workspaceById, governanceAnchors),
    aiControlPlaneModule('feature-store', 'Feature Store Metadata', 'feature-store', 'ai-governance', ['ai.feature-set.built.v1','ai.confidence.adjusted.v1'], ['ai.feature-set.built','ai.feature-lineage.recorded'], ['lineage required','low-quality input quarantine'], ['ai_feature_build_count','ai_stale_low_quality_input_count','ai_audit_sync_status'], ['ai-agent','track-sector','horse','facility'], ['feature lineage metadata'], workspaceById, governanceAnchors),
    aiControlPlaneModule('model-registry', 'Model Registry', 'model-registry', 'ai-governance', ['ai.model.selected.v1','ai.metric.observed.v1'], ['model-registered','model-evaluated','model-approved','model-suspended'], ['model approval gate','rollback runbook','human oversight'], ['ai_model_selection_count','model_drift_breaches','ai_adjusted_confidence_distribution'], ['ai-agent','workflow','approval'], ['model lifecycle governance'], workspaceById, governanceAnchors),
    aiControlPlaneModule('expert-models', 'Expert Model Selection', 'expert-models', 'ai-governance', ['ai.model.selected.v1','ai.recommendation.created.v1'], ['ai.model.selected','ai.expert-domain.selected'], ['advisory-only domain experts','prohibited-use checks'], ['ai_model_selection_count','ai_recommendation_count','ai_adjusted_confidence_distribution'], ['ai-agent','track-sector','horse','incident'], ['expert selection metadata'], workspaceById, governanceAnchors),
    aiControlPlaneModule('ai-governor', 'AI Governor', 'ai-governor', 'ai-governance', ['ai.recommendation.blocked.v1','ai.approval.required.v1','ai.safety.policy.enforced.v1'], ['ai.safety.policy.enforced','ai.recommendation.blocked','ai.approval.required'], controls.map((control) => control.normalizedAction), ['ai_blocked_action_count','ai_approval_required_count','ai_audit_sync_status'], ['ai-agent','workflow','approval','incident'], ['protected action blocking','approval evidence'], workspaceById, governanceAnchors),
    aiControlPlaneModule('approved-outputs', 'Approved Outputs', 'approved-outputs', 'approvals', ['approval.request.transitioned.v1','approval.protectedAction.approved.v1','ai.digital-twin.impact.queued.v1'], ['approval.requested','approval.execution-authorized','ai.digital-twin.impact.queued'], ['human approval token required','audit-before-execution','twin sync queued after approval'], ['ai_recommendation_count','ai_approval_required_count','ai_twin_sync_status'], ['approval','workflow','ai-agent'], ['approved output audit trail','Digital Twin impact queue'], workspaceById, governanceAnchors),
  ];
  return {
    name: 'TrackMind Unified AI/ML Control Plane',
    flow: ['inputs','feature-store','model-registry','expert-models','ai-governor','approved-outputs'],
    governanceAnchors,
    digitalTwinTarget: 'Azure Digital Twins is the suitable modeling and synchronization target for AI-agent, workflow, approval, asset, and incident state; this package references the existing DigitalTwinReference and Digital Twin runtime abstractions without claiming a production deployment.',
    modules,
    eventTypes: [...new Set(modules.flatMap((module) => module.eventTypes))],
    auditActions: [...new Set(modules.flatMap((module) => module.auditActions))],
    safetyControls: [...new Set(modules.flatMap((module) => module.safetyControls))],
    observabilityMetrics: [...aiControlPlaneMetricNames],
    tests: [...new Set(modules.flatMap((module) => module.tests))],
  };
}

function aiControlPlaneModule(id: string, title: string, stage: NexusAIControlPlaneStage, workspaceId: NexusWorkspaceId, eventTypes: string[], auditActions: string[], safetyControls: string[], observabilityMetrics: string[], digitalTwinKinds: NexusDigitalTwinAssetKind[], tests: string[], workspaces: Map<NexusWorkspaceId, NexusWorkspaceUpgrade>, governanceAnchors: NexusComplianceFramework[]): NexusAIControlPlaneModule {
  const workspace = workspaces.get(workspaceId);
  return {
    id,
    title,
    stage,
    workspaceId,
    apiContracts: workspace ? [workspace.apiPath] : [],
    eventTypes,
    auditActions,
    safetyControls,
    observabilityMetrics,
    digitalTwinKinds,
    tests,
    governanceAnchors,
    status: workspace?.status ?? 'placeholder',
  };
}

function createUniversalSchemaCoverage(workspaces: NexusWorkspaceUpgrade[]): NexusUniversalSchemaCoverage[] {
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const fromRoutes = (routeIds: NexusWorkspaceId[]) => ({
    routeIds,
    eventTypes: [...new Set(routeIds.flatMap((id) => workspaceById.get(id)?.eventTypes ?? []))],
    auditActions: [...new Set(routeIds.flatMap((id) => workspaceById.get(id)?.auditActions ?? []))],
  });
  const coverage = (id: NexusUniversalSchemaCoverageId, label: string, status: NexusUpgradeStatus, routeIds: NexusWorkspaceId[], models: string[], readinessControls: string[]): NexusUniversalSchemaCoverage => ({
    id,
    label,
    status,
    models,
    readinessControls,
    ...fromRoutes(routeIds),
  });
  return [
    coverage('entity', 'Universal Schema entity coverage', 'partial', ['assets','digital-twin','race-office','equine','barns','safety','facilities','workforce','api-hub'], ['DomainEntityBase','RacetrackEntity','RaceEntity','HorseEntity','BarnEntity','FacilityEntity','AssetEntity','CanonicalRacingDataEnvelope'], ['stable IDs','tenant and racetrack context','source-system references']),
    coverage('event', 'Universal Schema event coverage', 'partial', [...nexusWorkspaceIds], ['NexusEventEnvelope','NexusEventContract'], ['typed event names','required event metadata','replayable audit-linked envelopes']),
    coverage('workflow', 'Universal Schema workflow coverage', 'partial', ['approvals','race-office','starting-gate','surface','safety','facilities','workforce','emergency','compliance','api-hub'], ['WorkflowEntity','WorkflowContractDto'], ['draft to pending approval lifecycle','role-owned transitions','approval references']),
    coverage('approval', 'Universal Schema approval coverage', 'implemented', ['approvals','ai-governance','race-office','starting-gate','surface','stewards','safety','compliance','api-hub'], ['ApprovalEntity','ApprovalDecision','ApprovalDto'], ['human approver roles','evidence arrays','non-autonomous protected action gates']),
    coverage('twin', 'Universal Schema twin coverage', 'partial', ['digital-twin','assets','track-configuration','starting-gate','surface','equine','barns','safety','facilities','api-hub'], ['DigitalTwinReference','DigitalTwinStateDto','TUSTwinStandardDto'], ['queued sync posture','asset relationship references','no live actuator claim']),
    coverage('ai', 'Universal Schema AI coverage', 'partial', ['ai-governance','operations','surface','equine','stewards','safety','platform-health','api-hub'], ['AIRecommendationEntity','AIRecommendationDto','AIControlPlaneWorkspaceDto'], ['advisory-only recommendations','confidence and evidence','protected-action blocking']),
    coverage('audit', 'Universal Schema audit coverage', 'implemented', ['audit','approvals','compliance','ai-governance','safety','platform-health','api-hub'], ['AuditEventEntity','AuditEvent','AuditEventDto'], ['append-only hash chain','correlation IDs','forensic export fields']),
    coverage('compliance', 'Universal Schema compliance coverage', 'partial', ['compliance','audit','ai-governance','approvals','api-hub'], ['ComplianceControlLibraryDto','ComplianceFrameworkIdDto','RacingDataLicenseMetadata'], ['framework mappings','evidence packages','accreditation readiness metadata only']),
  ];
}

function createTrackMindOSMetadata(workspaces: NexusWorkspaceUpgrade[], coverage: NexusUniversalSchemaCoverage[]): TrackMindOSComponentMetadata[] {
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const allCoverage = coverage.map((item) => item.id);
  const caveat = 'Readiness metadata only where marked; does not claim production certification, tenant provisioning, live actuator control, or autonomous safety-critical execution.';
  const component = (input: Omit<TrackMindOSComponentMetadata, 'routePaths'|'connectedWorkspaces'|'caveat'> & { caveat?: string }): TrackMindOSComponentMetadata => ({
    ...input,
    connectedWorkspaces: input.routeIds,
    routePaths: input.routeIds.map((id) => workspaceById.get(id)?.route ?? `/${id}`),
    caveat: input.caveat ?? caveat,
  });
  return [
    component({ id: 'operations-os', title: 'Operations OS', status: 'partial', routeIds: ['operations','race-office','track-configuration','assets','facilities','workforce','executive'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], saasTiers: ['starter','professional','enterprise'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'partial', intelligenceCore: 'partial', federation: 'placeholder', observabilityControls: ['race_readiness_score','approval_queue_depth','frontend degraded state'], safetyControls: ['protected race transitions require approvals','mock/live adapters cannot mutate safety-critical state'] }),
    component({ id: 'safety-os', title: 'Safety OS', status: 'partial', routeIds: ['race-office','starting-gate','surface','equine','barns','stewards','safety','security','emergency','facilities','workforce'], universalSchemaCoverage: allCoverage, saasTiers: ['professional','enterprise'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'partial', intelligenceCore: 'partial', federation: 'placeholder', observabilityControls: ['safety denial counts','emergency resource status','surface recommendation queue'], safetyControls: ['AI cannot block emergency personnel','official rulings remain human-only','veterinary and gate controls remain approval-gated'] }),
    component({ id: 'compliance-os', title: 'Compliance OS', status: 'partial', routeIds: ['compliance','audit','approvals','ai-governance','api-hub'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit','compliance'], saasTiers: ['professional','enterprise','national-federation'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'partial', intelligenceCore: 'partial', federation: 'readiness-metadata', observabilityControls: ['audit_readiness_score','evidence_package_coverage','accreditation_readiness_score','license_policy_review_count'], safetyControls: ['evidence packages are readiness artifacts','framework mappings do not assert formal certification','API Hub license and lineage views are read-only'] }),
    component({ id: 'ai-os', title: 'AI OS', status: 'partial', routeIds: ['ai-governance','approvals','audit','platform-health','operations','digital-twin','api-hub'], universalSchemaCoverage: allCoverage, saasTiers: ['enterprise','national-federation'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'partial', intelligenceCore: 'partial', federation: 'readiness-metadata', observabilityControls: [...aiControlPlaneMetricNames,'model_drift_breaches','blocked_ai_actions','provider_health'], safetyControls: ['AI recommendations are advisory only','AI outputs require human approval before execution','protected actions are blocked without evidence','API Hub exports preserve training and license boundaries'] }),
    component({ id: 'digital-twin-os', title: 'Digital Twin OS', status: 'partial', routeIds: ['digital-twin','assets','track-configuration','starting-gate','surface','equine','barns','facilities','api-hub'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], saasTiers: ['professional','enterprise'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'partial', intelligenceCore: 'partial', federation: 'placeholder', observabilityControls: ['twin_health','queued_sync','ai_twin_sync_status','lineage_exception_count'], safetyControls: ['twin patches are approval-gated','simulations are mock/what-if only','Azure Digital Twins remains a target, not a claimed deployment','API Hub lineage can reference twins but cannot mutate them'] }),
    component({ id: 'command-center-os', title: 'Command Center OS', status: 'partial', routeIds: ['operations','platform-health','executive','safety','security','emergency','approvals'], universalSchemaCoverage: allCoverage, saasTiers: ['enterprise','national-federation'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'partial', intelligenceCore: 'partial', federation: 'readiness-metadata', observabilityControls: ['event_throughput','api_latency','frontend_errors','approval_sla_breaches'], safetyControls: ['read-only executive context','command actions route through approval APIs','offline/degraded state keeps controls locked'] }),
    component({ id: 'accreditation-os', title: 'Accreditation OS', status: 'readiness-metadata', routeIds: ['compliance','audit','ai-governance','platform-health'], universalSchemaCoverage: ['event','workflow','approval','twin','ai','audit','compliance'], saasTiers: ['professional','enterprise','national-federation'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'readiness-metadata', intelligenceCore: 'readiness-metadata', federation: 'placeholder', observabilityControls: ['accreditation_readiness_score','evidence_package_coverage','audit_readiness_score'], safetyControls: ['readiness score is not certification','evidence packages require human compliance review'] }),
    component({ id: 'multi-track-federation-os', title: 'Multi-Track Federation OS', status: 'placeholder', routeIds: ['executive','platform-health','compliance'], universalSchemaCoverage: ['entity','event','approval','twin','audit','compliance'], saasTiers: ['national-federation'], certifiedTrackReadiness: 'placeholder', unifiedDataModel: 'readiness-metadata', intelligenceCore: 'readiness-metadata', federation: 'placeholder', observabilityControls: ['tenant isolation posture','cross-tenant analytics guardrails','platform health rollups'], safetyControls: ['no tenant provisioning is implemented','cross-track analytics require explicit governance agreements'] }),
    component({ id: 'racing-intelligence-network', title: 'Racing Intelligence Network', status: 'readiness-metadata', routeIds: ['ai-governance','api-hub','executive','surface','equine','stewards','platform-health'], universalSchemaCoverage: ['entity','event','twin','ai','audit','compliance'], saasTiers: ['enterprise','national-federation'], certifiedTrackReadiness: 'readiness-metadata', unifiedDataModel: 'readiness-metadata', intelligenceCore: 'readiness-metadata', federation: 'placeholder', observabilityControls: ['ai_recommendation_count','safety_kpi','compliance_kpi','model_drift_breaches','provider_health'], safetyControls: ['network insights remain advisory','benchmarking requires anonymization and approval','no production model training is claimed','provider data stays governed by license and lineage'] }),
  ];
}

function createPlatformReadinessMetadata(trackMindOS: TrackMindOSComponentMetadata[]): NexusPlatformReadinessMetadata {
  const included = (ids: TrackMindOSComponentId[]) => ids.filter((id) => trackMindOS.some((component) => component.id === id));
  return {
    saasTiers: [
      { id: 'starter', title: 'Starter', status: 'partial', includedOS: included(['operations-os','command-center-os']), controls: ['tenant-rbac','approval-governance','immutable-audit-ledger'], caveat: 'Starter tier metadata aligns route entitlements only; billing and provisioning are not implemented.' },
      { id: 'professional', title: 'Professional', status: 'partial', includedOS: included(['operations-os','safety-os','digital-twin-os','compliance-os']), controls: ['data-residency','regulated-data-retention','observability'], caveat: 'Professional tier metadata covers operational readiness without live actuator provisioning.' },
      { id: 'enterprise', title: 'Enterprise', status: 'readiness-metadata', includedOS: included(['ai-os','command-center-os','racing-intelligence-network','compliance-os']), controls: ['human-in-loop-ai','cross-tenant-analytics-guardrails','executive read-only posture'], caveat: 'Enterprise metadata describes entitlement and governance readiness, not production customer enablement.' },
      { id: 'national-federation', title: 'National Federation', status: 'placeholder', includedOS: included(['multi-track-federation-os','accreditation-os','racing-intelligence-network']), controls: ['federation governance agreement','anonymized benchmarking review','certified-track evidence review'], caveat: 'Federation tier is placeholder metadata only; no cross-tenant provisioning or certification workflow is implemented.' },
    ],
    certifiedTrack: { id: 'certified-track-readiness', title: 'Certified Track Readiness', status: 'readiness-metadata', controls: ['evidence packages','audit readiness events','framework mappings','human compliance review'], caveat: 'Readiness metadata only; does not claim HISA, ARCI, ISO, or local commission certification.' },
    unifiedDataModel: { id: 'unified-data-model', title: 'Unified Data Model', status: 'partial', controls: ['Universal Schema coverage dimensions','TUS asset and twin DTOs','tenant and racetrack context'], caveat: 'Shared contracts exist, but not every live service persists the complete model.' },
    intelligenceCore: { id: 'intelligence-core', title: 'Intelligence Core', status: 'partial', controls: ['AI control plane metadata','feature-store placeholders','advisory recommendation evidence','observability metrics'], caveat: 'Intelligence metadata does not claim production model training or autonomous execution.' },
    federation: { id: 'federation', title: 'Federation', status: 'placeholder', controls: ['tenant isolation posture','cross-tenant analytics guardrails','national tier entitlements'], caveat: 'Federation is metadata only; no tenant provisioning, data-sharing workflow, or national operations runtime is implemented.' },
    observabilityControls: [
      { id: 'standardization-observability', title: 'Standardization Observability', status: 'partial', controls: ['event throughput','audit sync status','twin sync status','frontend error reporting'], caveat: 'Signals are declared for readiness and tests; production telemetry pipelines are not claimed.' },
      { id: 'certification-observability', title: 'Certification Readiness Observability', status: 'readiness-metadata', controls: ['evidence package coverage','accreditation readiness score','control assessment events'], caveat: 'Readiness signals support preparation only and do not represent certification outcomes.' },
    ],
    safetyControls: [
      { id: 'standardized-protected-actions', title: 'Standardized Protected Actions', status: 'implemented', controls: ['shared protected action catalog','human approval evidence','autonomous execution blocked'], caveat: 'Implemented as shared policy and metadata, not as live actuator execution.' },
      { id: 'certification-safety-boundaries', title: 'Certification Safety Boundaries', status: 'readiness-metadata', controls: ['AI advisory-only boundary','degraded service locks','approval-gated Digital Twin patches'], caveat: 'Safety boundaries are readiness metadata and UI/API guardrails; no certification is asserted.' },
    ],
  };
}

export function buildNexusUpgradeEventEnvelope(input: { eventId: string; eventType: NexusEventContract['eventType']; tenantId: string; racetrackId: string; actorId: string; subjectId: string; subjectType: string; correlationId: string; auditRef: string; digitalTwinRef?: string; payload?: Record<string, unknown>; evidence?: string[]; occurredAt?: string; source?: string }): NexusEventEnvelope {
  const version = Number(input.eventType.match(/\.v(\d+)$/)?.[1] ?? 1);
  const timestamp = input.occurredAt ?? new Date().toISOString();
  const event: NexusEventEnvelope = { eventId: input.eventId, eventType: input.eventType, tenantId: input.tenantId, racetrackId: input.racetrackId, actorId: input.actorId, source: input.source ?? 'trackmind-nexus-upgrade', timestamp, version, occurredAt: timestamp, actor: { id: input.actorId, type: 'service' }, correlationId: input.correlationId, subject: { id: input.subjectId, type: input.subjectType, tenantId: input.tenantId }, auditRef: input.auditRef, digitalTwinRef: input.digitalTwinRef, aggregateId: input.subjectId, payload: { racetrackId: input.racetrackId, auditRef: input.auditRef, digitalTwinRef: input.digitalTwinRef, ...(input.payload ?? {}) }, evidence: input.evidence ?? [input.auditRef] };
  const validation = validateNexusEventEnvelope(event);
  if (!validation.allowed) throw new Error(validation.reason);
  return event;
}

function areaConnectsWorkspace(areaId: NexusUpgradeAreaId, workspaceId: NexusWorkspaceId): boolean {
  const map: Record<NexusUpgradeAreaId, NexusWorkspaceId[]> = {
    'app-shell-ux': [...nexusWorkspaceIds],
    'operations-command': ['operations','executive'],
    'digital-twin': ['digital-twin','assets','track-configuration','starting-gate','surface','facilities','workforce'],
    'racetrack-asset-control-registry': ['assets','digital-twin','facilities','workforce'],
    'event-backbone': [...nexusWorkspaceIds],
    'approval-governance': ['approvals','race-office','starting-gate','surface','equine','stewards','safety','security','emergency','facilities','ai-governance'],
    'starting-gate-track-configuration': ['track-configuration','starting-gate','race-office'],
    'surface-intelligence': ['surface','operations'],
    'race-office': ['race-office','operations'],
    'equine-barn-operations': ['equine','barns'],
    'steward-center': ['stewards'],
    'security-emergency-operations': ['safety','security','emergency','facilities','workforce'],
    'compliance-accreditation': ['compliance','audit'],
    'responsible-ai-governance': ['ai-governance','approvals','audit'],
    'ai-control-plane': ['ai-governance','api-hub','platform-health','operations','approvals','audit','digital-twin','compliance'],
    'audit-ledger': ['audit','approvals','assets','digital-twin','api-hub'],
    'platform-observability': ['platform-health','api-hub','operations','facilities','workforce'],
    'frontend-workspaces': [...nexusWorkspaceIds],
    testing: [...nexusWorkspaceIds],
  };
  return map[areaId].includes(workspaceId);
}
