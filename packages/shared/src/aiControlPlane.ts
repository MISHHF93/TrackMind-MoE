import { validateContract, type ContractRule } from './apiContracts.js';
import type { AnyFeatureRecord, FeatureRecordMetadata } from './featureStore.js';

export const aiControlPlaneSchemaVersion = 'trackmind.ai-control-plane.v1' as const;

export const aiInputSources = ['iot', 'manual', 'api', 'ai', 'workflow'] as const;
export type AIInputSource = typeof aiInputSources[number];

export const aiControlPlaneDomains = ['surface', 'race', 'equine', 'gate', 'security', 'weather', 'audit', 'operations'] as const;
export type AIControlPlaneDomain = typeof aiControlPlaneDomains[number];

export const aiRecommendationTypes = ['risk-assessment', 'readiness-check', 'advisory', 'forecast', 'evidence-summary', 'draft-action'] as const;
export type AIRecommendationType = typeof aiRecommendationTypes[number];

export const aiRiskLevels = ['low', 'medium', 'high', 'critical'] as const;
export type AIRiskLevel = typeof aiRiskLevels[number];

export const aiTrainingInputArtifactClasses = [
  'Asset',
  'Telemetry',
  'Event',
  'Workflow',
  'Approval',
  'Audit',
  'Investigation',
  'Compliance',
  'Recommendation',
  'DigitalTwin',
] as const;
export type AITrainingInputArtifactClass = typeof aiTrainingInputArtifactClasses[number];

export const aiOutputArtifactClasses = ['Insight', 'Recommendation', 'Forecast'] as const;
export type AIOutputArtifactClass = typeof aiOutputArtifactClasses[number];

export type AIArtifactClass = AITrainingInputArtifactClass | AIOutputArtifactClass | 'Feature';
export type AIArtifactDataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'personal-data' | 'regulated';

export interface AIArtifactAdapterMetadata {
  artifactId?: string;
  tenantId?: string;
  racetrackId?: string;
  createdAt?: string;
  sourceSystem?: string;
  sourceRefs?: string[];
  evidence?: string[];
  lineage?: string[];
  curated?: boolean;
  dataClassification?: AIArtifactDataClassification;
  digitalTwinRefs?: string[];
}

export interface AIArtifactBase<TClass extends AIArtifactClass = AIArtifactClass, TPayload = Record<string, unknown>> {
  artifactId: string;
  artifactClass: TClass;
  tenantId: string;
  racetrackId: string;
  createdAt: string;
  sourceSystem: string;
  payload: TPayload;
  evidence: string[];
  lineage: string[];
  curated: boolean;
  confidence?: number;
  riskLevel?: AIRiskLevel;
  dataClassification: AIArtifactDataClassification;
  digitalTwinRefs: string[];
}

export interface AITrainingInputArtifact<TPayload = Record<string, unknown>> extends AIArtifactBase<AITrainingInputArtifactClass, TPayload> {
  trainingUse: 'eligible';
}

export interface AITrainingInputRejection {
  artifactId: string;
  artifactClass: string;
  reason: string;
}

export interface AITrainingInputSelection {
  selected: AITrainingInputArtifact[];
  rejected: AITrainingInputRejection[];
  allowedArtifactClasses: readonly AITrainingInputArtifactClass[];
}

export interface AIOutputArtifact<TClass extends AIOutputArtifactClass = AIOutputArtifactClass, TPayload = Record<string, unknown>> extends AIArtifactBase<TClass, TPayload> {
  outputClass: TClass;
  summary: string;
  affectedAssets: string[];
  approvalRequired: boolean;
  requiredApproverRoles: string[];
  advisoryOnly: true;
  executionAllowed: false;
  blockedAutonomousExecution: true;
}

export interface AIRecommendationArtifact extends AIOutputArtifact<'Recommendation', {
  recommendationId: string;
  type: AIRecommendationType;
  domain: AIControlPlaneDomain;
  summary: string;
  requiresApproval: boolean;
}> {}

export interface AIInsightArtifact extends AIOutputArtifact<'Insight', {
  insightId: string;
  insightType: 'risk-summary' | 'evidence-summary' | 'readiness-summary' | 'operational-insight';
  domain: AIControlPlaneDomain;
  sourceRecommendationId?: string;
}> {}

export interface AIForecastArtifact extends AIOutputArtifact<'Forecast', {
  forecastId: string;
  forecastType: 'risk-forecast' | 'readiness-forecast' | 'maintenance-forecast' | 'weather-forecast';
  domain: AIControlPlaneDomain;
  horizon?: string;
  sourceRecommendationId?: string;
}> {}

export interface AIFeatureArtifact extends AIArtifactBase<'Feature', {
  featureRecordId: string;
  schemaVersion: string;
  metadata: FeatureRecordMetadata;
  features: unknown;
  scores: unknown;
  dataQuality: unknown;
}> {
  artifactRole: 'derived-feature';
  trainingUse: 'not-eligible';
  derivation: {
    featureRecordId: string;
    featureSetId: string;
    sourceArtifactClasses: AITrainingInputArtifactClass[];
    sourceRefs: string[];
    asOf: string;
    correlationId: string;
    derivedFromCuratedArtifactsOnly: true;
  };
}

export interface AIArtifactCandidate<TPayload = Record<string, unknown>> {
  artifactId: string;
  artifactClass: string;
  tenantId: string;
  racetrackId: string;
  createdAt: string;
  sourceSystem: string;
  payload: TPayload;
  evidence: string[];
  lineage: string[];
  curated: boolean;
  confidence?: number;
  riskLevel?: AIRiskLevel;
  dataClassification: AIArtifactDataClassification;
  digitalTwinRefs?: string[];
}

export interface AIInputQuality {
  isComplete: boolean;
  isFresh: boolean;
  outlierScore: number;
}

export interface UnifiedAIInput {
  inputId: string;
  tenantId: string;
  racetrackId: string;
  timestamp: string;
  source: AIInputSource;
  domain: AIControlPlaneDomain;
  assetId: string;
  data: Record<string, unknown>;
  confidence: number;
  quality: AIInputQuality;
}

export interface AIRecommendationOutput {
  recommendationId: string;
  tenantId: string;
  racetrackId: string;
  type: AIRecommendationType;
  recommendationType: AIRecommendationType;
  domain: AIControlPlaneDomain;
  affectedAssets: string[];
  summary: string;
  evidence: string[];
  confidence: number;
  modelVersion: string;
  policyReferences: string[];
  riskLevel: AIRiskLevel;
  generatedAt: string;
  expiresAt?: string;
  requiresApproval: boolean;
  requiredApproverRoles: string[];
  approvalRequirement: {
    required: boolean;
    policy: string;
    requiredApproverRoles: string[];
  };
  auditReference: {
    auditEventIds: string[];
    eventIds: string[];
    correlationId: string;
    integrityRef?: string;
  };
  blockedAutonomousExecution: boolean;
}

export const aiControlModes = ['human_in_the_loop', 'approval_required', 'autonomous_low_risk'] as const;
export type AIControlMode = typeof aiControlModes[number];

export interface AIControlPolicyConfig {
  defaultMode: AIControlMode;
  allowAutonomousLowRiskActions: boolean;
  blockedActions: string[];
  confidenceThresholds: Record<AIRiskLevel, number>;
  approvalRoles: Record<AIControlPlaneDomain | 'default', string[]>;
}

export const aiControlPlaneModuleIds = [
  'ai-router',
  'feature-builder',
  'surface-risk-model',
  'race-readiness-model',
  'gate-position-model',
  'equine-advisory-model',
  'security-anomaly-model',
  'weather-impact-model',
  'maintenance-forecast-model',
  'steward-evidence-assistant',
  'responsible-ai-governor',
] as const;
export type AIControlPlaneModuleId = typeof aiControlPlaneModuleIds[number];

export const aiControlPlaneModules: Record<AIControlPlaneModuleId, { displayName: string; stage: 'input' | 'feature-store' | 'model-registry' | 'expert-model' | 'governor' }> = {
  'ai-router': { displayName: 'AI Router', stage: 'input' },
  'feature-builder': { displayName: 'Feature Builder', stage: 'feature-store' },
  'surface-risk-model': { displayName: 'Surface Risk Model', stage: 'expert-model' },
  'race-readiness-model': { displayName: 'Race Readiness Model', stage: 'expert-model' },
  'gate-position-model': { displayName: 'Gate Position Model', stage: 'expert-model' },
  'equine-advisory-model': { displayName: 'Equine Advisory Model', stage: 'expert-model' },
  'security-anomaly-model': { displayName: 'Security Anomaly Model', stage: 'expert-model' },
  'weather-impact-model': { displayName: 'Weather Impact Model', stage: 'expert-model' },
  'maintenance-forecast-model': { displayName: 'Maintenance Forecast Model', stage: 'expert-model' },
  'steward-evidence-assistant': { displayName: 'Steward Evidence Assistant', stage: 'expert-model' },
  'responsible-ai-governor': { displayName: 'Responsible AI Governor', stage: 'governor' },
};

export const aiControlPlaneFlow = ['Inputs', 'Feature Store', 'Model Registry', 'Expert Models', 'AI Governor', 'Approved Outputs'] as const;

export const aiControlPlaneBlockedActions = [
  'race-start',
  'race-stop',
  'official-results',
  'scratch-horse',
  'medication-decision',
  'clear-vet-flag',
  'emergency-action',
  'payout',
  'disciplinary-decision',
  'modify-official-results',
  'steward-ruling',
  'emergency-personnel-override',
  'safety-critical-control',
  'surface-irrigation',
  'surface-harrowing',
  'surface-rolling',
  'track-closure',
  'track-reopen',
  'starting-gate-move',
  'gate-position-change',
  'gate-release',
  'security-restricted-zone-action',
  'maintenance-return-to-service',
  'compliance-filing-approval',
] as const;
export type AIControlPlaneBlockedAction = typeof aiControlPlaneBlockedActions[number];

export const aiGovernanceFrameworkAnchors = [
  {
    frameworkId: 'ISO-42001',
    standard: 'ISO/IEC 42001',
    scope: 'AI management system controls for accountable model lifecycle, human oversight, and audit evidence.',
    requiredMetadata: ['owner', 'intendedUse', 'riskAssessment', 'humanOversight', 'evidencePackage'],
  },
  {
    frameworkId: 'NIST-AI-RMF',
    standard: 'NIST AI Risk Management Framework',
    scope: 'Govern, map, measure, and manage metadata for AI risk decisions and monitoring.',
    requiredMetadata: ['govern', 'map', 'measure', 'manage', 'riskMonitoring', 'incidentResponse'],
  },
] as const;

export type AIGovernanceFrameworkAnchor = typeof aiGovernanceFrameworkAnchors[number];

export const defaultAIControlPolicyConfig: AIControlPolicyConfig = {
  defaultMode: 'human_in_the_loop',
  allowAutonomousLowRiskActions: false,
  blockedActions: [...aiControlPlaneBlockedActions],
  confidenceThresholds: {
    low: 0.8,
    medium: 0.85,
    high: 0.9,
    critical: 0.95,
  },
  approvalRoles: {
    default: ['compliance-officer'],
    surface: ['track-superintendent', 'steward'],
    race: ['racing-secretary', 'steward'],
    equine: ['veterinarian', 'steward'],
    gate: ['racing-secretary', 'track-superintendent', 'steward'],
    security: ['security', 'compliance-officer'],
    weather: ['steward', 'operations'],
    audit: ['compliance-officer', 'read-only-auditor'],
    operations: ['admin', 'steward'],
  },
};

export const aiControlPlaneContractSchemas = {
  UnifiedAIInput: [
    { path: 'inputId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'timestamp', required: true, type: 'string' },
    { path: 'source', required: true, type: 'string', values: aiInputSources },
    { path: 'domain', required: true, type: 'string', values: aiControlPlaneDomains },
    { path: 'assetId', required: true, type: 'string' },
    { path: 'data', required: true, type: 'object' },
    { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
    { path: 'quality.isComplete', required: true, type: 'boolean' },
    { path: 'quality.isFresh', required: true, type: 'boolean' },
    { path: 'quality.outlierScore', required: true, type: 'number', min: 0, max: 1 },
  ],
  AIRecommendationOutput: [
    { path: 'recommendationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'type', required: true, type: 'string', values: aiRecommendationTypes },
    { path: 'recommendationType', required: true, type: 'string', values: aiRecommendationTypes },
    { path: 'domain', required: true, type: 'string', values: aiControlPlaneDomains },
    { path: 'affectedAssets', required: true, type: 'array' },
    { path: 'summary', required: true, type: 'string' },
    { path: 'evidence', required: true, type: 'array' },
    { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
    { path: 'modelVersion', required: true, type: 'string' },
    { path: 'policyReferences', required: true, type: 'array' },
    { path: 'riskLevel', required: true, type: 'string', values: aiRiskLevels },
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'requiresApproval', required: true, type: 'boolean' },
    { path: 'requiredApproverRoles', required: true, type: 'array' },
    { path: 'approvalRequirement', required: true, type: 'object' },
    { path: 'approvalRequirement.required', required: true, type: 'boolean' },
    { path: 'approvalRequirement.policy', required: true, type: 'string' },
    { path: 'approvalRequirement.requiredApproverRoles', required: true, type: 'array' },
    { path: 'auditReference', required: true, type: 'object' },
    { path: 'auditReference.auditEventIds', required: true, type: 'array' },
    { path: 'auditReference.eventIds', required: true, type: 'array' },
    { path: 'auditReference.correlationId', required: true, type: 'string' },
    { path: 'blockedAutonomousExecution', required: true, type: 'boolean' },
  ],
  AIControlPolicyConfig: [
    { path: 'defaultMode', required: true, type: 'string', values: aiControlModes },
    { path: 'allowAutonomousLowRiskActions', required: true, type: 'boolean' },
    { path: 'blockedActions', required: true, type: 'array' },
    { path: 'confidenceThresholds.low', required: true, type: 'number', min: 0, max: 1 },
    { path: 'confidenceThresholds.medium', required: true, type: 'number', min: 0, max: 1 },
    { path: 'confidenceThresholds.high', required: true, type: 'number', min: 0, max: 1 },
    { path: 'confidenceThresholds.critical', required: true, type: 'number', min: 0, max: 1 },
    { path: 'approvalRoles', required: true, type: 'object' },
    { path: 'approvalRoles.default', required: true, type: 'array' },
  ],
} as const satisfies Record<string, readonly ContractRule[]>;

export interface AIControlPlaneValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateUnifiedAIInput(input: unknown): AIControlPlaneValidationResult {
  return validateContract('UnifiedAIInput', input, aiControlPlaneContractSchemas.UnifiedAIInput);
}

export function validateAIRecommendationOutput(output: unknown): AIControlPlaneValidationResult {
  const result = validateContract('AIRecommendationOutput', output, aiControlPlaneContractSchemas.AIRecommendationOutput);
  const errors = [...result.errors];
  const recommendation = output as Partial<AIRecommendationOutput>;
  if (recommendation.type !== recommendation.recommendationType) errors.push('AIRecommendationOutput.recommendationType must match type');
  if (Array.isArray(recommendation.affectedAssets) && recommendation.affectedAssets.length === 0) errors.push('AIRecommendationOutput.affectedAssets requires at least one asset');
  if (Array.isArray(recommendation.evidence) && recommendation.evidence.length === 0) errors.push('AIRecommendationOutput.evidence requires at least one evidence reference');
  if (Array.isArray(recommendation.policyReferences) && recommendation.policyReferences.length === 0) errors.push('AIRecommendationOutput.policyReferences requires at least one policy reference');
  if (recommendation.requiresApproval && Array.isArray(recommendation.requiredApproverRoles) && recommendation.requiredApproverRoles.length === 0) errors.push('AIRecommendationOutput.requiredApproverRoles is required when approval is required');
  if (recommendation.requiresApproval && recommendation.blockedAutonomousExecution !== true) errors.push('AIRecommendationOutput.blockedAutonomousExecution must be true when approval is required');
  if (recommendation.approvalRequirement && recommendation.approvalRequirement.required !== recommendation.requiresApproval) errors.push('AIRecommendationOutput.approvalRequirement.required must match requiresApproval');
  if (recommendation.approvalRequirement && recommendation.requiresApproval && recommendation.approvalRequirement.requiredApproverRoles.length === 0) errors.push('AIRecommendationOutput.approvalRequirement.requiredApproverRoles is required when approval is required');
  if ((recommendation.riskLevel === 'high' || recommendation.riskLevel === 'critical') && recommendation.requiresApproval !== true) errors.push('AIRecommendationOutput high and critical risk recommendations require approval');
  return { valid: errors.length === 0, errors };
}

export function selectCanonicalAITrainingInputs(artifacts: readonly AIArtifactCandidate[]): AITrainingInputSelection {
  const allowed = new Set<string>(aiTrainingInputArtifactClasses);
  const selected: AITrainingInputArtifact[] = [];
  const rejected: AITrainingInputRejection[] = [];

  for (const artifact of artifacts) {
    if (!allowed.has(artifact.artifactClass)) {
      rejected.push({ artifactId: artifact.artifactId, artifactClass: artifact.artifactClass, reason: 'Artifact class is not an approved AI training input class' });
      continue;
    }
    if (artifact.curated !== true) {
      rejected.push({ artifactId: artifact.artifactId, artifactClass: artifact.artifactClass, reason: 'Artifact must be curated before AI training input selection' });
      continue;
    }
    selected.push({
      ...cloneArtifactBase(artifact as AIArtifactBase<AITrainingInputArtifactClass, Record<string, unknown>>),
      trainingUse: 'eligible',
    });
  }

  return { selected, rejected, allowedArtifactClasses: aiTrainingInputArtifactClasses };
}

export function validateAIOutputArtifact(artifact: unknown): AIControlPlaneValidationResult {
  const output = artifact as Partial<AIOutputArtifact>;
  const errors: string[] = [];
  if (!output || typeof output !== 'object') return { valid: false, errors: ['AIOutputArtifact must be an object'] };
  if (!output.outputClass || !aiOutputArtifactClasses.includes(output.outputClass as AIOutputArtifactClass)) errors.push('AIOutputArtifact.outputClass must be Insight, Recommendation, or Forecast');
  if (output.artifactClass !== output.outputClass) errors.push('AIOutputArtifact.artifactClass must match outputClass');
  if (output.advisoryOnly !== true) errors.push('AIOutputArtifact.advisoryOnly must be true');
  if (output.executionAllowed !== false) errors.push('AIOutputArtifact.executionAllowed must be false');
  if (output.blockedAutonomousExecution !== true) errors.push('AIOutputArtifact.blockedAutonomousExecution must be true');
  if (!Array.isArray(output.evidence) || output.evidence.length === 0) errors.push('AIOutputArtifact.evidence requires at least one evidence reference');
  if (!Array.isArray(output.affectedAssets) || output.affectedAssets.length === 0) errors.push('AIOutputArtifact.affectedAssets requires at least one asset');
  return { valid: errors.length === 0, errors };
}

export function adaptAIRecommendationOutputToRecommendationArtifact(output: AIRecommendationOutput, metadata: AIArtifactAdapterMetadata = {}): AIRecommendationArtifact {
  const validation = validateAIRecommendationOutput(output);
  if (!validation.valid) throw new Error(`Invalid AI recommendation output: ${validation.errors.join(', ')}`);
  return {
    ...baseOutputArtifact('Recommendation', output, metadata, `artifact:recommendation:${output.recommendationId}`),
    payload: {
      recommendationId: output.recommendationId,
      type: output.type,
      domain: output.domain,
      summary: output.summary,
      requiresApproval: output.requiresApproval,
    },
  };
}

export function adaptAIRecommendationOutputToInsightArtifact(output: AIRecommendationOutput, metadata: AIArtifactAdapterMetadata = {}): AIInsightArtifact {
  const validation = validateAIRecommendationOutput(output);
  if (!validation.valid) throw new Error(`Invalid AI recommendation output: ${validation.errors.join(', ')}`);
  return {
    ...baseOutputArtifact('Insight', output, metadata, `artifact:insight:${output.recommendationId}`),
    payload: {
      insightId: metadata.artifactId ?? `insight:${output.recommendationId}`,
      insightType: insightTypeFor(output.type),
      domain: output.domain,
      sourceRecommendationId: output.recommendationId,
    },
  };
}

export function adaptAIRecommendationOutputToForecastArtifact(output: AIRecommendationOutput, metadata: AIArtifactAdapterMetadata & { horizon?: string } = {}): AIForecastArtifact {
  const validation = validateAIRecommendationOutput(output);
  if (!validation.valid) throw new Error(`Invalid AI recommendation output: ${validation.errors.join(', ')}`);
  return {
    ...baseOutputArtifact('Forecast', output, metadata, `artifact:forecast:${output.recommendationId}`),
    payload: {
      forecastId: metadata.artifactId ?? `forecast:${output.recommendationId}`,
      forecastType: forecastTypeFor(output.type, output.domain),
      domain: output.domain,
      horizon: metadata.horizon,
      sourceRecommendationId: output.recommendationId,
    },
  };
}

export function adaptFeatureRecordToFeatureArtifact(record: AnyFeatureRecord, metadata: AIArtifactAdapterMetadata & {
  featureSetId?: string;
  sourceArtifactClasses?: AITrainingInputArtifactClass[];
  sourceRefs?: string[];
} = {}): AIFeatureArtifact {
  const recordMetadata = record.metadata as FeatureRecordMetadata;
  const sourceRefs = uniqueStrings([record.id, ...record.evidence, ...(metadata.sourceRefs ?? [])]);
  const sourceArtifactClasses = uniqueTrainingInputClasses(metadata.sourceArtifactClasses ?? ['Telemetry']);
  return {
    artifactId: metadata.artifactId ?? `artifact:feature:${record.id}`,
    artifactClass: 'Feature',
    artifactRole: 'derived-feature',
    tenantId: metadata.tenantId ?? recordMetadata.tenantId,
    racetrackId: metadata.racetrackId ?? recordMetadata.racetrackId,
    createdAt: metadata.createdAt ?? recordMetadata.asOf,
    sourceSystem: metadata.sourceSystem ?? recordMetadata.source,
    payload: {
      featureRecordId: record.id,
      schemaVersion: String(record.schemaVersion),
      metadata: { ...recordMetadata },
      features: record.features,
      scores: record.scores,
      dataQuality: record.dataQuality,
    },
    evidence: uniqueStrings([...(metadata.evidence ?? []), ...record.evidence]),
    lineage: uniqueStrings([
      ...(metadata.lineage ?? []),
      `feature-record:${record.id}`,
      `feature-store:${record.schemaVersion}`,
      `feature-domain:${recordMetadata.domain}`,
      ...sourceRefs.map((ref) => `source:${ref}`),
    ]),
    curated: false,
    trainingUse: 'not-eligible',
    dataClassification: metadata.dataClassification ?? 'restricted',
    digitalTwinRefs: uniqueStrings([...(metadata.digitalTwinRefs ?? []), ...(recordMetadata.assetId ? [`twin:${recordMetadata.assetId}`] : [])]),
    derivation: {
      featureRecordId: record.id,
      featureSetId: metadata.featureSetId ?? `${recordMetadata.domain}:${recordMetadata.source}`,
      sourceArtifactClasses,
      sourceRefs,
      asOf: recordMetadata.asOf,
      correlationId: recordMetadata.correlationId,
      derivedFromCuratedArtifactsOnly: true,
    },
  };
}

export function createDefaultAIControlPolicyConfig(overrides: Partial<AIControlPolicyConfig> = {}): AIControlPolicyConfig {
  return {
    ...defaultAIControlPolicyConfig,
    ...overrides,
    blockedActions: [...(overrides.blockedActions ?? defaultAIControlPolicyConfig.blockedActions)],
    confidenceThresholds: { ...defaultAIControlPolicyConfig.confidenceThresholds, ...(overrides.confidenceThresholds ?? {}) },
    approvalRoles: { ...defaultAIControlPolicyConfig.approvalRoles, ...(overrides.approvalRoles ?? {}) },
  };
}

export function validateAIControlPolicyConfig(config: unknown): AIControlPlaneValidationResult {
  const result = validateContract('AIControlPolicyConfig', config, aiControlPlaneContractSchemas.AIControlPolicyConfig);
  const errors = [...result.errors];
  const policy = config as Partial<AIControlPolicyConfig>;
  const blocked = Array.isArray(policy.blockedActions) ? policy.blockedActions : [];
  for (const action of aiControlPlaneBlockedActions) {
    if (!blocked.includes(action)) errors.push(`AIControlPolicyConfig.blockedActions must include ${action}`);
  }
  if (policy.allowAutonomousLowRiskActions && policy.defaultMode === 'human_in_the_loop') errors.push('AIControlPolicyConfig cannot allow autonomous low-risk actions while defaultMode is human_in_the_loop');
  for (const domain of aiControlPlaneDomains) {
    const roles = policy.approvalRoles?.[domain];
    if (!Array.isArray(roles) || roles.length === 0) errors.push(`AIControlPolicyConfig.approvalRoles.${domain} requires at least one approver role`);
  }
  return { valid: errors.length === 0, errors };
}

function baseOutputArtifact<TClass extends AIOutputArtifactClass>(
  outputClass: TClass,
  output: AIRecommendationOutput,
  metadata: AIArtifactAdapterMetadata,
  fallbackArtifactId: string,
): Omit<AIOutputArtifact<TClass, Record<string, unknown>>, 'payload'> {
  return {
    artifactId: metadata.artifactId ?? fallbackArtifactId,
    artifactClass: outputClass,
    outputClass,
    tenantId: metadata.tenantId ?? output.tenantId,
    racetrackId: metadata.racetrackId ?? output.racetrackId,
    createdAt: metadata.createdAt ?? output.generatedAt,
    sourceSystem: metadata.sourceSystem ?? 'ai-control-plane',
    summary: output.summary,
    affectedAssets: [...output.affectedAssets],
    approvalRequired: output.requiresApproval,
    requiredApproverRoles: [...output.requiredApproverRoles],
    advisoryOnly: true,
    executionAllowed: false,
    blockedAutonomousExecution: true,
    evidence: uniqueStrings([...(metadata.evidence ?? []), ...output.evidence]),
    lineage: uniqueStrings([...(metadata.lineage ?? []), `ai-output:${output.recommendationId}`, `ai-domain:${output.domain}`, `ai-type:${output.type}`, `model:${output.modelVersion}`, ...output.policyReferences.map((ref) => `policy:${ref}`), ...output.auditReference.auditEventIds.map((ref) => `audit:${ref}`), ...output.auditReference.eventIds.map((ref) => `event:${ref}`)]),
    curated: metadata.curated ?? true,
    confidence: output.confidence,
    riskLevel: output.riskLevel,
    dataClassification: metadata.dataClassification ?? 'restricted',
    digitalTwinRefs: uniqueStrings(metadata.digitalTwinRefs ?? []),
  };
}

function cloneArtifactBase<TClass extends AITrainingInputArtifactClass>(artifact: AIArtifactBase<TClass, Record<string, unknown>>): AIArtifactBase<TClass, Record<string, unknown>> {
  return {
    ...artifact,
    evidence: [...artifact.evidence],
    lineage: [...artifact.lineage],
    digitalTwinRefs: [...(artifact.digitalTwinRefs ?? [])],
  };
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function uniqueTrainingInputClasses(values: readonly AITrainingInputArtifactClass[]): AITrainingInputArtifactClass[] {
  const allowed = new Set<string>(aiTrainingInputArtifactClasses);
  return [...new Set(values.filter((value) => allowed.has(value)))];
}

function insightTypeFor(type: AIRecommendationType): AIInsightArtifact['payload']['insightType'] {
  if (type === 'evidence-summary') return 'evidence-summary';
  if (type === 'readiness-check') return 'readiness-summary';
  if (type === 'risk-assessment') return 'risk-summary';
  return 'operational-insight';
}

function forecastTypeFor(type: AIRecommendationType, domain: AIControlPlaneDomain): AIForecastArtifact['payload']['forecastType'] {
  if (type === 'forecast') return domain === 'weather' ? 'weather-forecast' : domain === 'operations' ? 'maintenance-forecast' : 'risk-forecast';
  if (domain === 'race') return 'readiness-forecast';
  if (domain === 'weather') return 'weather-forecast';
  if (domain === 'operations') return 'maintenance-forecast';
  return 'risk-forecast';
}
