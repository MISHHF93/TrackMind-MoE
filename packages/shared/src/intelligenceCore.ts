import {
  aiControlPlaneFlow,
  aiControlPlaneModuleIds,
  aiControlPlaneModules,
  aiGovernanceFrameworkAnchors,
  defaultAIControlPolicyConfig,
  type AIControlPlaneBlockedAction,
  type AIControlPlaneModuleId,
} from './aiControlPlane.js';
import { featureStoreSchemaVersion, type FeatureDomain } from './featureStore.js';

export const trackMindIntelligenceCoreSchemaVersion = 'trackmind.intelligence-core.v1' as const;
export const trackMindIntelligenceCoreId = 'trackmind-intelligence-core-tier-10' as const;

export const trackMindIntelligenceCoreModuleIds = [
  'surface-intelligence',
  'race-readiness',
  'asset-intelligence',
  'workforce-intelligence',
  'security-intelligence',
  'compliance-intelligence',
  'executive-intelligence',
] as const;
export type TrackMindIntelligenceCoreModuleId = typeof trackMindIntelligenceCoreModuleIds[number];

export const trackMindIntelligenceCoreSharedLayerIds = [
  'feature-store',
  'model-registry',
  'governance-layer',
  'approval-engine',
  'digital-twin-layer',
] as const;
export type TrackMindIntelligenceCoreSharedLayerId = typeof trackMindIntelligenceCoreSharedLayerIds[number];

export interface IntelligenceCoreGovernanceControl {
  framework: string;
  controls: string[];
  evidence: string[];
}

export interface IntelligenceCoreReferenceSet {
  featureStoreDomains: FeatureDomain[];
  featureStoreSchemaVersion: typeof featureStoreSchemaVersion;
  aiControlPlaneModuleRefs: AIControlPlaneModuleId[];
  modelRegistryRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
  digitalTwinRefs: string[];
}

export interface IntelligenceCoreRecommendationOutput {
  kind: 'recommendation';
  recommendationOnly: true;
  advisoryOnly: true;
  executionAllowed: false;
  mayMutateOperationalState: false;
  requiredFields: string[];
}

export interface IntelligenceCoreApprovalBoundary {
  approvalRequiredForOperationalUse: true;
  approvalEngineRef: 'centralized-approval-service';
  approvalApi: 'POST /api/v1/approvals/controlled-actions';
  requiredApproverRoles: string[];
  protectedActionsBlocked: string[];
  safetyCriticalControlsBlocked: AIControlPlaneBlockedAction[];
  autonomousExecutionAllowed: false;
}

export interface TrackMindIntelligenceCoreModuleMetadata {
  id: TrackMindIntelligenceCoreModuleId;
  displayName: string;
  rosDomain: string;
  capabilitySummary: string;
  capabilities: string[];
  requiredInputs: string[];
  outputs: IntelligenceCoreRecommendationOutput[];
  approvalBoundary: IntelligenceCoreApprovalBoundary;
  references: IntelligenceCoreReferenceSet;
  governanceControls: IntelligenceCoreGovernanceControl[];
  recommendationOnly: true;
  autonomousExecutionAllowed: false;
}

export interface TrackMindIntelligenceCoreSharedLayerMetadata {
  id: TrackMindIntelligenceCoreSharedLayerId;
  displayName: string;
  purpose: string;
  compositionRefs: string[];
  governanceControls: IntelligenceCoreGovernanceControl[];
  recommendationOnlyInvariant: true;
}

export interface TrackMindIntelligenceCoreMetadata {
  schemaVersion: typeof trackMindIntelligenceCoreSchemaVersion;
  id: typeof trackMindIntelligenceCoreId;
  displayName: 'TrackMind Intelligence Core';
  tier: 10;
  architecture: 'composed-ai-control-plane-metadata';
  recommendationsOnly: true;
  executionEndpointsAvailable: false;
  controlPlaneComposition: {
    featureStoreSchemaVersion: typeof featureStoreSchemaVersion;
    controlPlaneFlow: readonly string[];
    sharedAIControlPlaneModuleIds: readonly AIControlPlaneModuleId[];
    governorPolicyId: string;
    blockedActions: string[];
  };
  sharedLayers: TrackMindIntelligenceCoreSharedLayerMetadata[];
  modules: TrackMindIntelligenceCoreModuleMetadata[];
  approvalIntegration: {
    approvalEngineRef: 'centralized-approval-service';
    approvalApi: 'POST /api/v1/approvals/controlled-actions';
    approvalMetadataRefs: string[];
    nonHumanApprovalAllowed: false;
  };
  auditEventTwinReferences: {
    auditRefs: string[];
    eventRefs: string[];
    digitalTwinRefs: string[];
  };
  governanceControls: IntelligenceCoreGovernanceControl[];
}

export interface TrackMindIntelligenceCoreValidationResult {
  valid: boolean;
  errors: string[];
}

const governanceControls = aiGovernanceFrameworkAnchors.map((anchor) => ({
  framework: anchor.frameworkId,
  controls: [...anchor.requiredMetadata],
  evidence: [anchor.scope, ...anchor.requiredMetadata.map((item) => `metadata:${item}`)],
}));

const recommendationOutput: IntelligenceCoreRecommendationOutput = {
  kind: 'recommendation',
  recommendationOnly: true,
  advisoryOnly: true,
  executionAllowed: false,
  mayMutateOperationalState: false,
  requiredFields: ['summary', 'evidence', 'confidence', 'riskLevel', 'affectedAssets', 'approvalBoundary', 'auditRefs', 'eventRefs', 'digitalTwinRefs'],
};

const sharedLayerMetadata: TrackMindIntelligenceCoreSharedLayerMetadata[] = [
  {
    id: 'feature-store',
    displayName: 'Feature Store',
    purpose: 'Shared governed feature metadata and data-quality lineage for every intelligence module.',
    compositionRefs: [featureStoreSchemaVersion, 'Feature Store', 'feature-builder'],
    governanceControls,
    recommendationOnlyInvariant: true,
  },
  {
    id: 'model-registry',
    displayName: 'Model Registry',
    purpose: 'Existing AI control-plane model cards, evaluations, prompt templates, lineage, and intended-use boundaries.',
    compositionRefs: ['Model Registry', ...aiControlPlaneModuleIds.filter((id) => aiControlPlaneModules[id].stage === 'expert-model')],
    governanceControls,
    recommendationOnlyInvariant: true,
  },
  {
    id: 'governance-layer',
    displayName: 'Governance Layer',
    purpose: 'Responsible AI governor policy, blocked autonomous execution controls, explainability, and evidence packages.',
    compositionRefs: ['AI Governor', 'responsible-ai-governor', defaultAIControlPolicyConfig.defaultMode],
    governanceControls,
    recommendationOnlyInvariant: true,
  },
  {
    id: 'approval-engine',
    displayName: 'Approval Engine',
    purpose: 'Centralized human approval metadata for operational use of recommendations.',
    compositionRefs: ['centralized-approval-service', 'POST /api/v1/approvals/controlled-actions', 'approval-required'],
    governanceControls,
    recommendationOnlyInvariant: true,
  },
  {
    id: 'digital-twin-layer',
    displayName: 'Digital Twin Layer',
    purpose: 'Read-only twin references and queued twin-impact metadata for human-approved synchronization workflows.',
    compositionRefs: ['digital-twin-runtime', 'digital-twin-impact-queued', 'read-only-twin-reference'],
    governanceControls,
    recommendationOnlyInvariant: true,
  },
];

const moduleMetadata: TrackMindIntelligenceCoreModuleMetadata[] = [
  moduleRecord({
    id: 'surface-intelligence',
    displayName: 'Surface Intelligence',
    rosDomain: 'track-surface',
    capabilitySummary: 'Surface condition, maintenance, drainage, irrigation, weather, and closure-review recommendations.',
    capabilities: ['surface risk scoring', 'maintenance prioritization', 'weather impact context', 'closure review package drafting'],
    requiredInputs: ['Surface telemetry', 'surface inspections', 'maintenance records', 'weather observations', 'race-day readiness context'],
    featureStoreDomains: ['surface', 'weather', 'race'],
    aiControlPlaneModuleRefs: ['feature-builder', 'surface-risk-model', 'weather-impact-model', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-surface-risk-v1', 'model-weather-impact-v1'],
    requiredApproverRoles: ['track-superintendent', 'steward'],
    blocked: ['safety-critical-control', 'surface-irrigation', 'surface-harrowing', 'surface-rolling', 'track-closure', 'track-reopen'],
    auditRefs: ['audit:surface-intelligence:recommendation', 'audit:surface-intelligence:approval-boundary'],
    eventRefs: ['surface.intelligence.recommendation.created.v1', 'ai.recommendation.recorded'],
    digitalTwinRefs: ['twin:surface:*', 'twin:track-sector:*'],
  }),
  moduleRecord({
    id: 'race-readiness',
    displayName: 'Race Readiness',
    rosDomain: 'race-operations',
    capabilitySummary: 'Race-day readiness, blocker classification, readiness package, and human approval cue recommendations.',
    capabilities: ['readiness scoring', 'blocker prioritization', 'approval package drafting', 'cross-domain race status summary'],
    requiredInputs: ['Race office card', 'surface readiness', 'gate readiness', 'veterinary readiness', 'steward readiness', 'security and weather readiness'],
    featureStoreDomains: ['race', 'surface', 'gate', 'horse', 'security', 'weather', 'operations'],
    aiControlPlaneModuleRefs: ['feature-builder', 'race-readiness-model', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-race-readiness-v1'],
    requiredApproverRoles: ['racing-secretary', 'steward', 'veterinarian'],
    blocked: ['race-start', 'race-stop', 'official-results', 'scratch-horse', 'safety-critical-control'],
    auditRefs: ['audit:race-readiness:recommendation', 'audit:race-readiness:approval-boundary'],
    eventRefs: ['race.readiness.recommendation.created.v1', 'ai.approval.required'],
    digitalTwinRefs: ['twin:race:*', 'twin:race-day:*'],
  }),
  moduleRecord({
    id: 'asset-intelligence',
    displayName: 'Asset Intelligence',
    rosDomain: 'assets-maintenance',
    capabilitySummary: 'Asset health, predictive maintenance, lifecycle, and work-order draft recommendations.',
    capabilities: ['asset health summarization', 'predictive maintenance prioritization', 'work-order drafting', 'return-to-service evidence linking'],
    requiredInputs: ['Racetrack asset registry', 'maintenance signals', 'inspection results', 'work orders', 'Digital Twin health'],
    featureStoreDomains: ['operations', 'gate', 'security'],
    aiControlPlaneModuleRefs: ['feature-builder', 'maintenance-forecast-model', 'gate-position-model', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-maintenance-forecast-v1', 'model-gate-position-v1'],
    requiredApproverRoles: ['facilities-supervisor', 'operations-command', 'track-superintendent'],
    blocked: ['safety-critical-control', 'starting-gate-move', 'maintenance-return-to-service'],
    auditRefs: ['audit:asset-intelligence:recommendation', 'audit:asset-intelligence:approval-boundary'],
    eventRefs: ['asset.intelligence.recommendation.created.v1', 'ai.digital-twin.impact.queued'],
    digitalTwinRefs: ['twin:asset:*', 'twin:starting-gate:*'],
  }),
  moduleRecord({
    id: 'workforce-intelligence',
    displayName: 'Workforce Intelligence',
    rosDomain: 'workforce-operations',
    capabilitySummary: 'Staffing, certifications, training, emergency qualification, and assignment readiness recommendations.',
    capabilities: ['coverage gap prioritization', 'certification gap summarization', 'emergency readiness recommendations', 'assignment review package drafting'],
    requiredInputs: ['Workforce assignments', 'shifts', 'certifications', 'training records', 'emergency resource readiness'],
    featureStoreDomains: ['operations', 'race'],
    aiControlPlaneModuleRefs: ['feature-builder', 'race-readiness-model', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-race-readiness-v1'],
    requiredApproverRoles: ['admin', 'security', 'compliance-officer'],
    blocked: ['emergency-action', 'emergency-personnel-override', 'safety-critical-control'],
    auditRefs: ['audit:workforce-intelligence:recommendation', 'audit:workforce-intelligence:approval-boundary'],
    eventRefs: ['workforce.intelligence.recommendation.created.v1', 'ai.approval.required'],
    digitalTwinRefs: ['twin:identity:*', 'twin:assignment:*', 'twin:emergency-resource:*'],
  }),
  moduleRecord({
    id: 'security-intelligence',
    displayName: 'Security Intelligence',
    rosDomain: 'security-operations',
    capabilitySummary: 'Restricted-zone, camera, credential, cyber, incident, and escalation triage recommendations.',
    capabilities: ['restricted-zone anomaly triage', 'incident evidence preservation', 'security escalation recommendations', 'privacy-aware investigation summaries'],
    requiredInputs: ['Access events', 'camera health', 'restricted-zone alerts', 'security incidents', 'investigation evidence'],
    featureStoreDomains: ['security', 'operations'],
    aiControlPlaneModuleRefs: ['feature-builder', 'security-anomaly-model', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-security-anomaly-v1'],
    requiredApproverRoles: ['security', 'incident-commander', 'compliance-officer'],
    blocked: ['security-restricted-zone-action', 'emergency-action', 'safety-critical-control'],
    auditRefs: ['audit:security-intelligence:recommendation', 'audit:security-intelligence:approval-boundary'],
    eventRefs: ['security.intelligence.recommendation.created.v1', 'ai.autonomous-execution.blocked'],
    digitalTwinRefs: ['twin:security-zone:*', 'twin:camera:*'],
  }),
  moduleRecord({
    id: 'compliance-intelligence',
    displayName: 'Compliance Intelligence',
    rosDomain: 'compliance-governance',
    capabilitySummary: 'Compliance control, obligation, evidence package, audit readiness, and filing approval recommendations.',
    capabilities: ['control gap summarization', 'evidence package readiness', 'audit trail crosswalk', 'filing approval cue recommendations'],
    requiredInputs: ['Compliance controls', 'obligations', 'findings', 'evidence packages', 'audit records', 'approval records'],
    featureStoreDomains: ['operations', 'race', 'security'],
    aiControlPlaneModuleRefs: ['feature-builder', 'steward-evidence-assistant', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-steward-evidence-v1'],
    requiredApproverRoles: ['compliance-officer', 'read-only-auditor', 'steward'],
    blocked: ['compliance-filing-approval', 'official-results', 'modify-official-results', 'steward-ruling'],
    auditRefs: ['audit:compliance-intelligence:recommendation', 'audit:compliance-intelligence:approval-boundary'],
    eventRefs: ['compliance.intelligence.recommendation.created.v1', 'ai.recommendation.recorded'],
    digitalTwinRefs: ['twin:compliance:*', 'twin:audit:*'],
  }),
  moduleRecord({
    id: 'executive-intelligence',
    displayName: 'Executive Intelligence',
    rosDomain: 'executive-command',
    capabilitySummary: 'Cross-domain executive briefing, risk, compliance, operations, and AI governance recommendations.',
    capabilities: ['cross-domain synthesis', 'risk elevation briefing', 'governance posture summary', 'approval boundary rollup'],
    requiredInputs: ['AI governance workspace', 'command-center KPIs', 'compliance readiness', 'platform health', 'module recommendation summaries'],
    featureStoreDomains: ['operations', 'race', 'security', 'weather'],
    aiControlPlaneModuleRefs: ['feature-builder', 'race-readiness-model', 'security-anomaly-model', 'responsible-ai-governor'],
    modelRegistryRefs: ['model-executive-intelligence-v1'],
    requiredApproverRoles: ['executive-sponsor', 'compliance-officer'],
    blocked: ['race-start', 'race-stop', 'emergency-action', 'payout', 'safety-critical-control'],
    auditRefs: ['audit:executive-intelligence:recommendation', 'audit:executive-intelligence:approval-boundary'],
    eventRefs: ['executive.intelligence.recommendation.created.v1', 'ai.dashboard.updated'],
    digitalTwinRefs: ['twin:enterprise:*', 'twin:domain:*'],
  }),
];

export const trackMindIntelligenceCoreMetadata: TrackMindIntelligenceCoreMetadata = {
  schemaVersion: trackMindIntelligenceCoreSchemaVersion,
  id: trackMindIntelligenceCoreId,
  displayName: 'TrackMind Intelligence Core',
  tier: 10,
  architecture: 'composed-ai-control-plane-metadata',
  recommendationsOnly: true,
  executionEndpointsAvailable: false,
  controlPlaneComposition: {
    featureStoreSchemaVersion,
    controlPlaneFlow: [...aiControlPlaneFlow],
    sharedAIControlPlaneModuleIds: [...aiControlPlaneModuleIds],
    governorPolicyId: 'trackmind-ai-governor-autonomy-v1',
    blockedActions: [...defaultAIControlPolicyConfig.blockedActions],
  },
  sharedLayers: sharedLayerMetadata,
  modules: moduleMetadata,
  approvalIntegration: {
    approvalEngineRef: 'centralized-approval-service',
    approvalApi: 'POST /api/v1/approvals/controlled-actions',
    approvalMetadataRefs: ['approvalRequirements', 'humanInLoopWorkflows', 'draftWorkOrders', 'blockedAutonomousExecutionLogs'],
    nonHumanApprovalAllowed: false,
  },
  auditEventTwinReferences: {
    auditRefs: [...new Set(moduleMetadata.flatMap((module) => module.references.auditRefs))],
    eventRefs: [...new Set(moduleMetadata.flatMap((module) => module.references.eventRefs))],
    digitalTwinRefs: [...new Set(moduleMetadata.flatMap((module) => module.references.digitalTwinRefs))],
  },
  governanceControls,
};

export function createTrackMindIntelligenceCoreMetadata(): TrackMindIntelligenceCoreMetadata {
  return structuredClone(trackMindIntelligenceCoreMetadata);
}

export function validateTrackMindIntelligenceCoreMetadata(metadata: unknown): TrackMindIntelligenceCoreValidationResult {
  const core = metadata as Partial<TrackMindIntelligenceCoreMetadata>;
  const errors: string[] = [];
  if (core.schemaVersion !== trackMindIntelligenceCoreSchemaVersion) errors.push('TrackMindIntelligenceCore.schemaVersion is invalid');
  if (core.id !== trackMindIntelligenceCoreId) errors.push('TrackMindIntelligenceCore.id is invalid');
  if (core.recommendationsOnly !== true) errors.push('TrackMindIntelligenceCore.recommendationsOnly must be true');
  if (core.executionEndpointsAvailable !== false) errors.push('TrackMindIntelligenceCore.executionEndpointsAvailable must be false');

  const moduleIds = (core.modules ?? []).map((module) => module.id);
  for (const moduleId of trackMindIntelligenceCoreModuleIds) {
    if (!moduleIds.includes(moduleId)) errors.push(`TrackMindIntelligenceCore.modules missing ${moduleId}`);
  }
  if (new Set(moduleIds).size !== moduleIds.length) errors.push('TrackMindIntelligenceCore.modules must not contain duplicates');

  const layerIds = (core.sharedLayers ?? []).map((layer) => layer.id);
  for (const layerId of trackMindIntelligenceCoreSharedLayerIds) {
    if (!layerIds.includes(layerId)) errors.push(`TrackMindIntelligenceCore.sharedLayers missing ${layerId}`);
  }

  const blockedActions = new Set(core.controlPlaneComposition?.blockedActions ?? defaultAIControlPolicyConfig.blockedActions);
  for (const module of core.modules ?? []) {
    if (module.recommendationOnly !== true) errors.push(`${module.id}.recommendationOnly must be true`);
    if (module.autonomousExecutionAllowed !== false) errors.push(`${module.id}.autonomousExecutionAllowed must be false`);
    if (!module.outputs?.length) errors.push(`${module.id}.outputs requires at least one recommendation output`);
    for (const output of module.outputs ?? []) {
      if (output.kind !== 'recommendation' || output.recommendationOnly !== true || output.advisoryOnly !== true) errors.push(`${module.id}.outputs must be advisory recommendations only`);
      if (output.executionAllowed !== false || output.mayMutateOperationalState !== false) errors.push(`${module.id}.outputs cannot execute or mutate operational state`);
    }
    const boundary = module.approvalBoundary;
    if (boundary?.approvalRequiredForOperationalUse !== true) errors.push(`${module.id}.approvalBoundary requires operational-use approval`);
    if (boundary?.autonomousExecutionAllowed !== false) errors.push(`${module.id}.approvalBoundary autonomous execution must be false`);
    if (!boundary?.requiredApproverRoles?.length) errors.push(`${module.id}.approvalBoundary requires approver roles`);
    for (const action of boundary?.safetyCriticalControlsBlocked ?? []) {
      if (!blockedActions.has(action)) errors.push(`${module.id}.approvalBoundary blocked action ${action} is not in control-plane policy`);
    }
    if (!module.references?.featureStoreDomains?.length) errors.push(`${module.id}.references.featureStoreDomains is required`);
    if (!module.references?.aiControlPlaneModuleRefs?.includes('responsible-ai-governor')) errors.push(`${module.id}.references must include responsible-ai-governor`);
    if (!module.references?.auditRefs?.length || !module.references?.eventRefs?.length || !module.references?.digitalTwinRefs?.length) errors.push(`${module.id}.references requires audit, event, and Digital Twin refs`);
  }

  const approvalApi = core.approvalIntegration?.approvalApi;
  if (approvalApi !== 'POST /api/v1/approvals/controlled-actions') errors.push('TrackMindIntelligenceCore.approvalIntegration.approvalApi must point to controlled actions');
  if (core.approvalIntegration?.nonHumanApprovalAllowed !== false) errors.push('TrackMindIntelligenceCore.approvalIntegration.nonHumanApprovalAllowed must be false');

  return { valid: errors.length === 0, errors };
}

function moduleRecord(input: {
  id: TrackMindIntelligenceCoreModuleId;
  displayName: string;
  rosDomain: string;
  capabilitySummary: string;
  capabilities: string[];
  requiredInputs: string[];
  featureStoreDomains: FeatureDomain[];
  aiControlPlaneModuleRefs: AIControlPlaneModuleId[];
  modelRegistryRefs: string[];
  requiredApproverRoles: string[];
  blocked: string[];
  auditRefs: string[];
  eventRefs: string[];
  digitalTwinRefs: string[];
}): TrackMindIntelligenceCoreModuleMetadata {
  return {
    id: input.id,
    displayName: input.displayName,
    rosDomain: input.rosDomain,
    capabilitySummary: input.capabilitySummary,
    capabilities: [...input.capabilities],
    requiredInputs: [...input.requiredInputs],
    outputs: [structuredClone(recommendationOutput)],
    approvalBoundary: {
      approvalRequiredForOperationalUse: true,
      approvalEngineRef: 'centralized-approval-service',
      approvalApi: 'POST /api/v1/approvals/controlled-actions',
      requiredApproverRoles: [...input.requiredApproverRoles],
      protectedActionsBlocked: [...input.blocked],
      safetyCriticalControlsBlocked: [...input.blocked] as AIControlPlaneBlockedAction[],
      autonomousExecutionAllowed: false,
    },
    references: {
      featureStoreDomains: [...input.featureStoreDomains],
      featureStoreSchemaVersion,
      aiControlPlaneModuleRefs: [...input.aiControlPlaneModuleRefs],
      modelRegistryRefs: [...input.modelRegistryRefs],
      auditRefs: [...input.auditRefs],
      eventRefs: [...input.eventRefs],
      digitalTwinRefs: [...input.digitalTwinRefs],
    },
    governanceControls,
    recommendationOnly: true,
    autonomousExecutionAllowed: false,
  };
}
