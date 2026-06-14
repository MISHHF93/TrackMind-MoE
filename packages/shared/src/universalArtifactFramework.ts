export const universalArtifactSchemaVersion = 'trackmind.uaf.v1' as const;

export const universalArtifactTypes = [
  'asset',
  'event',
  'digital-twin',
  'telemetry',
  'workflow',
  'approval',
  'audit',
  'compliance',
  'recommendation',
  'investigation',
  'feature',
  'insight',
  'forecast',
] as const;

export type UniversalArtifactType = typeof universalArtifactTypes[number];
export type UniversalArtifactFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface UniversalArtifactTenantMetadata {
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
  dataBoundary?: 'tenant' | 'racetrack' | 'federated' | 'external';
}

export interface UniversalArtifactLineageMetadata {
  sourceSystem: string;
  correlationId: string;
  causationIds: string[];
  inputArtifactIds: string[];
  outputArtifactIds?: string[];
  producedBy?: string;
}

export interface ArtifactEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: string;
  artifactId: string;
  artifactType: UniversalArtifactType | string;
  tenant: UniversalArtifactTenantMetadata;
  lineage: UniversalArtifactLineageMetadata;
  createdAt: string;
  updatedAt: string;
  payload: TPayload;
  tags?: string[];
  extensions?: Record<string, unknown>;
  tenantId?: string;
  racetrackId?: string;
  correlationId?: string;
}

export interface UniversalArtifactValidationRule {
  path: string;
  required?: boolean;
  type?: UniversalArtifactFieldType;
  values?: readonly (string | number | boolean)[];
  min?: number;
  max?: number;
}

export interface UniversalArtifactValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SchemaVersionComparison {
  left: string;
  right: string;
  compatibleFamily: boolean;
  leftMajor: number | null;
  rightMajor: number | null;
  order: -1 | 0 | 1;
}

export interface ArtifactSchemaCompatibilityResult {
  compatible: boolean;
  errors: string[];
  supportedSchemaVersions: readonly string[];
}

export type ArtifactEnvelopeMigrationResult<TArtifact extends ArtifactEnvelope = ArtifactEnvelope> =
  | { supported: true; fromVersion: string; toVersion: string; artifact: TArtifact; warnings: string[] }
  | { supported: false; fromVersion: string; toVersion: string; reason: string; warnings: string[] };

export interface UniversalArtifactRegistryEntry {
  artifactType: UniversalArtifactType | string;
  schemaVersion: string;
  title: string;
  description?: string;
  requiredEnvelopeFields: string[];
  requiredPayloadFields: string[];
  validator: string;
  backwardCompatibleWith: string[];
}

const supportedArtifactSchemaVersions = [universalArtifactSchemaVersion] as const;
const artifactTypeSet = new Set<string>(universalArtifactTypes);
const versionPattern = /^(?<family>.+)\.v(?<major>\d+)$/;

const envelopeRequiredFields = [
  'schemaVersion',
  'artifactId',
  'artifactType',
  'tenant',
  'lineage',
  'createdAt',
  'updatedAt',
  'payload',
] as const;

const envelopeRules: readonly UniversalArtifactValidationRule[] = [
  { path: 'schemaVersion', required: true, type: 'string' },
  { path: 'artifactId', required: true, type: 'string' },
  { path: 'artifactType', required: true, type: 'string' },
  { path: 'tenant', required: true, type: 'object' },
  { path: 'tenant.tenantId', required: true, type: 'string' },
  { path: 'tenant.racetrackId', required: true, type: 'string' },
  { path: 'tenant.organizationId', type: 'string' },
  { path: 'tenant.dataBoundary', type: 'string', values: ['tenant', 'racetrack', 'federated', 'external'] },
  { path: 'lineage', required: true, type: 'object' },
  { path: 'lineage.sourceSystem', required: true, type: 'string' },
  { path: 'lineage.correlationId', required: true, type: 'string' },
  { path: 'lineage.causationIds', required: true, type: 'array' },
  { path: 'lineage.inputArtifactIds', required: true, type: 'array' },
  { path: 'lineage.outputArtifactIds', type: 'array' },
  { path: 'lineage.producedBy', type: 'string' },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'payload', required: true, type: 'object' },
  { path: 'tags', type: 'array' },
  { path: 'extensions', type: 'object' },
  { path: 'tenantId', type: 'string' },
  { path: 'racetrackId', type: 'string' },
  { path: 'correlationId', type: 'string' },
];

const payloadRules = {
  asset: [
    { path: 'assetId', required: true, type: 'string' },
    { path: 'assetType', required: true, type: 'string' },
    { path: 'status', required: true, type: 'string' },
    { path: 'riskClassification', type: 'string', values: ['informational', 'operational', 'safety-critical'] },
  ],
  event: [
    { path: 'eventType', required: true, type: 'string' },
    { path: 'occurredAt', required: true, type: 'string' },
    { path: 'subjectRef', required: true, type: 'object' },
    { path: 'payload', required: true, type: 'object' },
  ],
  'digital-twin': [
    { path: 'twinId', required: true, type: 'string' },
    { path: 'modelId', required: true, type: 'string' },
    { path: 'sourceArtifactId', required: true, type: 'string' },
    { path: 'state', required: true, type: 'object' },
  ],
  telemetry: [
    { path: 'sourceId', required: true, type: 'string' },
    { path: 'metric', required: true, type: 'string' },
    { path: 'observedAt', required: true, type: 'string' },
    { path: 'value', required: true },
  ],
  workflow: [
    { path: 'workflowId', required: true, type: 'string' },
    { path: 'state', required: true, type: 'string' },
    { path: 'subjectRef', required: true, type: 'object' },
    { path: 'approvalRefs', required: true, type: 'array' },
  ],
  approval: [
    { path: 'approvalId', required: true, type: 'string' },
    { path: 'status', required: true, type: 'string' },
    { path: 'requestedBy', required: true, type: 'object' },
    { path: 'evidenceRefs', required: true, type: 'array' },
  ],
  audit: [
    { path: 'auditId', required: true, type: 'string' },
    { path: 'action', required: true, type: 'string' },
    { path: 'actorId', required: true, type: 'string' },
    { path: 'occurredAt', required: true, type: 'string' },
    { path: 'evidenceRefs', required: true, type: 'array' },
  ],
  compliance: [
    { path: 'controlId', required: true, type: 'string' },
    { path: 'frameworkIds', required: true, type: 'array' },
    { path: 'status', required: true, type: 'string' },
    { path: 'evidenceRefs', required: true, type: 'array' },
  ],
  recommendation: [
    { path: 'recommendationId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'string' },
    { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
    { path: 'evidenceRefs', required: true, type: 'array' },
    { path: 'advisoryOnly', required: true, type: 'boolean', values: [true] },
  ],
  investigation: [
    { path: 'investigationId', required: true, type: 'string' },
    { path: 'status', required: true, type: 'string' },
    { path: 'subjectRef', required: true, type: 'object' },
    { path: 'evidenceRefs', required: true, type: 'array' },
  ],
  feature: [
    { path: 'featureId', required: true, type: 'string' },
    { path: 'domain', required: true, type: 'string' },
    { path: 'asOf', required: true, type: 'string' },
    { path: 'features', required: true, type: 'object' },
  ],
  insight: [
    { path: 'insightId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'string' },
    { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
    { path: 'evidenceRefs', required: true, type: 'array' },
  ],
  forecast: [
    { path: 'forecastId', required: true, type: 'string' },
    { path: 'forecastAt', required: true, type: 'string' },
    { path: 'horizon', required: true, type: 'string' },
    { path: 'predictions', required: true, type: 'array' },
    { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
  ],
} as const satisfies Record<UniversalArtifactType, readonly UniversalArtifactValidationRule[]>;

const expectedRegistryValidators: Record<UniversalArtifactType, string> = {
  asset: 'validateAssetArtifact',
  event: 'validateEventArtifact',
  'digital-twin': 'validateDigitalTwinArtifact',
  telemetry: 'validateTelemetryArtifact',
  workflow: 'validateWorkflowArtifact',
  approval: 'validateApprovalArtifact',
  audit: 'validateAuditArtifact',
  compliance: 'validateComplianceArtifact',
  recommendation: 'validateRecommendationArtifact',
  investigation: 'validateInvestigationArtifact',
  feature: 'validateFeatureArtifact',
  insight: 'validateInsightArtifact',
  forecast: 'validateForecastArtifact',
};

const registryEntryRules: readonly UniversalArtifactValidationRule[] = [
  { path: 'artifactType', required: true, type: 'string' },
  { path: 'schemaVersion', required: true, type: 'string' },
  { path: 'title', required: true, type: 'string' },
  { path: 'description', type: 'string' },
  { path: 'requiredEnvelopeFields', required: true, type: 'array' },
  { path: 'requiredPayloadFields', required: true, type: 'array' },
  { path: 'validator', required: true, type: 'string' },
  { path: 'backwardCompatibleWith', required: true, type: 'array' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function get(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, value);
}

function matchesType(value: unknown, type: UniversalArtifactFieldType): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function validateRules(name: string, value: unknown, rules: readonly UniversalArtifactValidationRule[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const field = get(value, rule.path);
    if (rule.required && (field === undefined || field === null || field === '')) errors.push(`${name}.${rule.path} is required`);
    if (field !== undefined && rule.type && !matchesType(field, rule.type)) errors.push(`${name}.${rule.path} must be ${rule.type}`);
    if (rule.values && field !== undefined && !rule.values.includes(field as string | number | boolean)) errors.push(`${name}.${rule.path} must be one of ${rule.values.join(',')}`);
    if (typeof field === 'number' && rule.min !== undefined && field < rule.min) errors.push(`${name}.${rule.path} must be >= ${rule.min}`);
    if (typeof field === 'number' && rule.max !== undefined && field > rule.max) errors.push(`${name}.${rule.path} must be <= ${rule.max}`);
  }
  return errors;
}

function validateStringArray(name: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${name} must be array`];
  return value.flatMap((item, index) => typeof item === 'string' ? [] : [`${name}[${index}] must be string`]);
}

function parseSchemaVersion(schemaVersion: string): { family: string; major: number } | null {
  const match = schemaVersion.match(versionPattern);
  if (!match?.groups) return null;
  return { family: match.groups.family, major: Number(match.groups.major) };
}

function artifactTypeFrom(value: unknown): UniversalArtifactType | null {
  return typeof value === 'string' && artifactTypeSet.has(value) ? value as UniversalArtifactType : null;
}

function validateTypeSpecificArtifact(name: string, artifactType: UniversalArtifactType, artifact: unknown): UniversalArtifactValidationResult {
  const envelopeValidation = validateArtifactEnvelope(artifact);
  const errors = [...envelopeValidation.errors];
  if (!isRecord(artifact)) return { valid: false, errors };
  if (artifact.artifactType !== artifactType) errors.push(`${name}.artifactType must be ${artifactType}`);
  errors.push(...validateRules(`${name}.payload`, artifact.payload, payloadRules[artifactType]));
  return { valid: errors.length === 0, errors };
}

export function compareSchemaVersions(left: string, right: string): SchemaVersionComparison {
  const parsedLeft = parseSchemaVersion(left);
  const parsedRight = parseSchemaVersion(right);
  const compatibleFamily = parsedLeft !== null && parsedRight !== null && parsedLeft.family === parsedRight.family;
  const leftMajor = parsedLeft?.major ?? null;
  const rightMajor = parsedRight?.major ?? null;
  let order: -1 | 0 | 1 = 0;
  if (compatibleFamily && leftMajor !== null && rightMajor !== null) {
    order = leftMajor < rightMajor ? -1 : leftMajor > rightMajor ? 1 : 0;
  } else if (left !== right) {
    order = left < right ? -1 : 1;
  }
  return { left, right, compatibleFamily, leftMajor, rightMajor, order };
}

export function checkArtifactEnvelopeCompatibility(schemaVersion: string, targetVersion = universalArtifactSchemaVersion): ArtifactSchemaCompatibilityResult {
  const errors: string[] = [];
  const comparison = compareSchemaVersions(schemaVersion, targetVersion);
  if (!comparison.compatibleFamily) errors.push(`schemaVersion ${schemaVersion} is not in the ${targetVersion.replace(/\.v\d+$/, '')} family`);
  if (!supportedArtifactSchemaVersions.includes(schemaVersion as typeof universalArtifactSchemaVersion)) errors.push(`schemaVersion ${schemaVersion} is not supported`);
  if (comparison.compatibleFamily && comparison.order > 0) errors.push(`schemaVersion ${schemaVersion} is newer than supported ${targetVersion}`);
  return { compatible: errors.length === 0, errors, supportedSchemaVersions: supportedArtifactSchemaVersions };
}

export function validateArtifactEnvelope(envelope: unknown): UniversalArtifactValidationResult {
  if (!isRecord(envelope)) return { valid: false, errors: ['ArtifactEnvelope must be object'] };
  const errors = validateRules('ArtifactEnvelope', envelope, envelopeRules);
  const artifactType = get(envelope, 'artifactType');
  if (typeof artifactType === 'string' && !artifactTypeSet.has(artifactType)) errors.push(`ArtifactEnvelope.artifactType must be one of ${universalArtifactTypes.join(',')}`);

  const schemaVersion = get(envelope, 'schemaVersion');
  if (typeof schemaVersion === 'string') errors.push(...checkArtifactEnvelopeCompatibility(schemaVersion).errors.map((error) => `ArtifactEnvelope.${error}`));

  const tenantId = get(envelope, 'tenant.tenantId');
  const racetrackId = get(envelope, 'tenant.racetrackId');
  const correlationId = get(envelope, 'lineage.correlationId');
  if (envelope.tenantId !== undefined && envelope.tenantId !== tenantId) errors.push('ArtifactEnvelope.tenantId must match tenant.tenantId');
  if (envelope.racetrackId !== undefined && envelope.racetrackId !== racetrackId) errors.push('ArtifactEnvelope.racetrackId must match tenant.racetrackId');
  if (envelope.correlationId !== undefined && envelope.correlationId !== correlationId) errors.push('ArtifactEnvelope.correlationId must match lineage.correlationId');

  errors.push(...validateStringArray('ArtifactEnvelope.lineage.causationIds', get(envelope, 'lineage.causationIds')));
  errors.push(...validateStringArray('ArtifactEnvelope.lineage.inputArtifactIds', get(envelope, 'lineage.inputArtifactIds')));
  errors.push(...validateStringArray('ArtifactEnvelope.lineage.outputArtifactIds', get(envelope, 'lineage.outputArtifactIds')));
  errors.push(...validateStringArray('ArtifactEnvelope.tags', envelope.tags));

  return { valid: errors.length === 0, errors };
}

export function validateAssetArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('AssetArtifact', 'asset', artifact);
}

export function validateEventArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('EventArtifact', 'event', artifact);
}

export function validateDigitalTwinArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('DigitalTwinArtifact', 'digital-twin', artifact);
}

export function validateTelemetryArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('TelemetryArtifact', 'telemetry', artifact);
}

export function validateWorkflowArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('WorkflowArtifact', 'workflow', artifact);
}

export function validateApprovalArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('ApprovalArtifact', 'approval', artifact);
}

export function validateAuditArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('AuditArtifact', 'audit', artifact);
}

export function validateComplianceArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('ComplianceArtifact', 'compliance', artifact);
}

export function validateRecommendationArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('RecommendationArtifact', 'recommendation', artifact);
}

export function validateInvestigationArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('InvestigationArtifact', 'investigation', artifact);
}

export function validateFeatureArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('FeatureArtifact', 'feature', artifact);
}

export function validateInsightArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('InsightArtifact', 'insight', artifact);
}

export function validateForecastArtifact(artifact: unknown): UniversalArtifactValidationResult {
  return validateTypeSpecificArtifact('ForecastArtifact', 'forecast', artifact);
}

export function validateRegistryEntry(entry: unknown): UniversalArtifactValidationResult {
  if (!isRecord(entry)) return { valid: false, errors: ['UniversalArtifactRegistryEntry must be object'] };
  const errors = validateRules('UniversalArtifactRegistryEntry', entry, registryEntryRules);
  const artifactType = artifactTypeFrom(entry.artifactType);
  if (!artifactType && typeof entry.artifactType === 'string') errors.push(`UniversalArtifactRegistryEntry.artifactType must be one of ${universalArtifactTypes.join(',')}`);
  if (typeof entry.schemaVersion === 'string') errors.push(...checkArtifactEnvelopeCompatibility(entry.schemaVersion).errors.map((error) => `UniversalArtifactRegistryEntry.${error}`));
  if (artifactType && entry.validator !== expectedRegistryValidators[artifactType]) errors.push(`UniversalArtifactRegistryEntry.validator must be ${expectedRegistryValidators[artifactType]}`);
  if (Array.isArray(entry.requiredEnvelopeFields)) {
    for (const field of envelopeRequiredFields) if (!entry.requiredEnvelopeFields.includes(field)) errors.push(`UniversalArtifactRegistryEntry.requiredEnvelopeFields must include ${field}`);
  }
  if (artifactType && Array.isArray(entry.requiredPayloadFields)) {
    const requiredPayloadFields = (payloadRules[artifactType] as readonly UniversalArtifactValidationRule[])
      .filter((rule) => rule.required)
      .map((rule) => rule.path);
    for (const field of requiredPayloadFields) if (!entry.requiredPayloadFields.includes(field)) errors.push(`UniversalArtifactRegistryEntry.requiredPayloadFields must include ${field}`);
  }
  errors.push(...validateStringArray('UniversalArtifactRegistryEntry.requiredEnvelopeFields', entry.requiredEnvelopeFields));
  errors.push(...validateStringArray('UniversalArtifactRegistryEntry.requiredPayloadFields', entry.requiredPayloadFields));
  errors.push(...validateStringArray('UniversalArtifactRegistryEntry.backwardCompatibleWith', entry.backwardCompatibleWith));
  return { valid: errors.length === 0, errors };
}

export function migrateArtifactEnvelope<TArtifact extends ArtifactEnvelope = ArtifactEnvelope>(artifact: TArtifact, toVersion = universalArtifactSchemaVersion): ArtifactEnvelopeMigrationResult<TArtifact> {
  const fromVersion = isRecord(artifact) && typeof artifact.schemaVersion === 'string' ? artifact.schemaVersion : 'unknown';
  if (fromVersion === toVersion) return { supported: true, fromVersion, toVersion, artifact, warnings: [] };
  return {
    supported: false,
    fromVersion,
    toVersion,
    reason: `Migration from ${fromVersion} to ${toVersion} is not implemented by the Universal Artifact Framework compatibility utilities.`,
    warnings: ['No schema mutation was performed. Callers must provide an explicit migration before persisting the artifact.'],
  };
}

export const trackMindUniversalArtifactFrameworkSchemaVersion = universalArtifactSchemaVersion;
export const artifactTypes = universalArtifactTypes;
export type ArtifactType = UniversalArtifactType;
export type ArtifactValidationResult = UniversalArtifactValidationResult;
export type ArtifactValidationRule = UniversalArtifactValidationRule;
export type ArtifactJsonScalar = string | number | boolean | null;
export type ArtifactJsonValue = ArtifactJsonScalar | ArtifactJsonValue[] | { [key: string]: ArtifactJsonValue };
export type ArtifactJsonObject = { [key: string]: ArtifactJsonValue };
export type ArtifactOwnerType = 'person' | 'role' | 'department' | 'service' | 'ai-agent' | 'regulator' | 'system';
export type ArtifactLifecycleStatus = 'draft' | 'active' | 'pending-approval' | 'approved' | 'rejected' | 'sealed' | 'superseded' | 'archived';
export type ArtifactRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ArtifactOwner {
  ownerId: string;
  ownerType: ArtifactOwnerType;
  displayName?: string;
  tenantId?: string;
  racetrackId?: string;
}

export interface ArtifactSubjectRef {
  id: string;
  kind: string;
  tenantId?: string;
  racetrackId?: string;
  displayName?: string;
  artifactId?: string;
  metadata?: ArtifactJsonObject;
}

export interface ArtifactSourceRef {
  sourceId: string;
  sourceType: 'system' | 'service' | 'stream' | 'database' | 'file' | 'api' | 'manual' | 'model' | 'sensor' | 'external';
  system: string;
  uri?: string;
  observedAt?: string;
  version?: string;
  checksum?: string;
  metadata?: ArtifactJsonObject;
}

export interface ArtifactEvidenceRef {
  evidenceId: string;
  kind: 'document' | 'image' | 'video' | 'telemetry' | 'audit' | 'approval' | 'workflow' | 'model-output' | 'observation' | 'external';
  sourceRefId?: string;
  uri?: string;
  hash?: string;
  capturedAt?: string;
  custody?: { sealed: boolean; retentionPolicy?: string; legalHold?: boolean };
  metadata?: ArtifactJsonObject;
}

export interface ArtifactDigitalTwinRef {
  twinId: `twin:${string}:${string}` | string;
  modelId?: string;
  relationship: 'primary' | 'shadow' | 'sensor-feed' | 'workflow-state' | 'analytics-view' | 'simulation';
  synchronizedAt?: string;
  entityRef?: ArtifactSubjectRef;
}

export interface ArtifactAuditRef {
  auditId: string;
  eventId?: string;
  action?: string;
  occurredAt?: string;
  hash?: string;
}

export interface ArtifactLineage {
  rootArtifactId?: string;
  parentArtifactIds: string[];
  upstreamArtifactIds: string[];
  derivedFromArtifactIds: string[];
  transformationRefs: string[];
  modelLineageRefs: string[];
}

export interface ArtifactBaseMetadata<T extends ArtifactType = ArtifactType> {
  id: string;
  artifactType: T;
  schemaVersion: typeof universalArtifactSchemaVersion;
  tenantId: string;
  racetrackId?: string;
  owner: ArtifactOwner;
  createdAt: string;
  updatedAt: string;
  status: ArtifactLifecycleStatus | string;
  lineage: ArtifactLineage;
  sourceRefs: ArtifactSourceRef[];
  evidenceRefs: ArtifactEvidenceRef[];
  correlationId: string;
  causationId?: string;
  digitalTwinRefs: ArtifactDigitalTwinRef[];
  auditRefs: ArtifactAuditRef[];
  tags?: string[];
  extensions?: ArtifactJsonObject;
}

export interface ArtifactBase<T extends ArtifactType = ArtifactType> extends ArtifactBaseMetadata<T> {}

export interface AssetArtifact extends ArtifactBase<'asset'> {
  assetId: string;
  assetType: string;
  assetCategory: 'physical' | 'digital' | 'biological' | 'operational' | 'regulatory' | 'ai-agent';
  displayName: string;
  location?: ArtifactJsonObject;
  state: ArtifactJsonObject;
  risk: { level: ArtifactRiskLevel; score?: number; safetyCritical: boolean; drivers: string[] };
  telemetryRefs: string[];
}

export interface EventArtifact extends ArtifactBase<'event'> {
  eventId: string;
  eventType: `${string}.${string}.${string}.v${number}` | string;
  occurredAt: string;
  producer: string;
  severity: 'info' | 'advisory' | 'warning' | 'critical';
  subjectRefs: ArtifactSubjectRef[];
  payload: ArtifactJsonObject;
}

export interface DigitalTwinArtifact extends ArtifactBase<'digital-twin'> {
  twinId: `twin:${string}:${string}` | string;
  twinType: string;
  modelId: string;
  sourceEntityRefs: ArtifactSubjectRef[];
  state: ArtifactJsonObject;
  relationships: Array<{ targetTwinId: string; relationship: string; evidenceRefs: string[]; updatedAt?: string }>;
}

export interface TelemetryArtifact extends ArtifactBase<'telemetry'> {
  telemetryId: string;
  streamId: string;
  observedAt: string;
  metric: string;
  value: ArtifactJsonValue;
  unit?: string;
  quality: { score: number; flags: string[] };
  subjectRefs: ArtifactSubjectRef[];
}

export interface WorkflowArtifact extends ArtifactBase<'workflow'> {
  workflowId: string;
  workflowType: string;
  workflowState: 'draft' | 'pending-approval' | 'approved' | 'rejected' | 'executed' | 'cancelled' | 'failed';
  subjectRefs: ArtifactSubjectRef[];
  stepRefs: Array<{ stepId: string; state: string; owner?: string; updatedAt?: string }>;
  approvalRefs: string[];
}

export interface ApprovalArtifact extends ArtifactBase<'approval'> {
  approvalId: string;
  protectedAction: string;
  approvalStatus: 'pending-approval' | 'approved' | 'rejected' | 'expired' | 'overridden';
  targetRefs: ArtifactSubjectRef[];
  requestedBy: ArtifactOwner;
  approverRefs: ArtifactOwner[];
  decidedAt?: string;
  expiresAt?: string;
}

export interface AuditArtifact extends ArtifactBase<'audit'> {
  auditId: string;
  action: string;
  actor: ArtifactOwner;
  targetRefs: ArtifactSubjectRef[];
  occurredAt: string;
  severity: 'info' | 'warning' | 'critical';
  hash?: string;
  previousHash?: string;
  retainedUntil?: string;
}

export interface ComplianceArtifact extends ArtifactBase<'compliance'> {
  complianceId: string;
  frameworkIds: string[];
  controlIds: string[];
  obligationRefs: ArtifactSubjectRef[];
  complianceStatus: 'draft' | 'implemented' | 'assessing' | 'effective' | 'deficient' | 'retired';
  complianceOwner: ArtifactOwner;
  assessment?: { assessedAt: string; assessedBy: ArtifactOwner; score?: number; findings: string[] };
}

export interface RecommendationArtifact extends ArtifactBase<'recommendation'> {
  recommendationId: string;
  activity: string;
  targetRefs: ArtifactSubjectRef[];
  recommendation: string;
  confidence: number;
  riskLevel: ArtifactRiskLevel;
  advisoryOnly: true;
  requestedAction?: string;
  modelLineageRefs: string[];
}

export interface InvestigationArtifact extends ArtifactBase<'investigation'> {
  investigationId: string;
  investigationType: string;
  investigationStatus: 'open' | 'triage' | 'in-progress' | 'blocked' | 'resolved' | 'closed';
  openedAt: string;
  leadOwner: ArtifactOwner;
  subjectRefs: ArtifactSubjectRef[];
  findingRefs: string[];
}

export interface FeatureArtifact extends ArtifactBase<'feature'> {
  featureId: string;
  featureDomain: string;
  asOf: string;
  features: Record<string, ArtifactJsonValue>;
  scores: Record<string, number>;
  quality: { score: number; missingFields: string[]; stale: boolean };
}

export interface InsightArtifact extends ArtifactBase<'insight'> {
  insightId: string;
  generatedAt: string;
  subjectRefs: ArtifactSubjectRef[];
  summary: string;
  confidence: number;
  severity: 'info' | 'advisory' | 'warning' | 'critical';
  drivers: string[];
  recommendationRefs: string[];
}

export interface ForecastArtifact extends ArtifactBase<'forecast'> {
  forecastId: string;
  forecastAt: string;
  horizon: { value: number; unit: 'minutes' | 'hours' | 'days' | 'races' };
  subjectRefs: ArtifactSubjectRef[];
  predictions: Record<string, ArtifactJsonValue>;
  confidence: number;
  modelLineageRefs: string[];
}

export type Artifact =
  | AssetArtifact
  | EventArtifact
  | DigitalTwinArtifact
  | TelemetryArtifact
  | WorkflowArtifact
  | ApprovalArtifact
  | AuditArtifact
  | ComplianceArtifact
  | RecommendationArtifact
  | InvestigationArtifact
  | FeatureArtifact
  | InsightArtifact
  | ForecastArtifact;

export type ArtifactDto = Artifact;
export type AssetArtifactDto = AssetArtifact;
export type EventArtifactDto = EventArtifact;
export type DigitalTwinArtifactDto = DigitalTwinArtifact;
export type TelemetryArtifactDto = TelemetryArtifact;
export type WorkflowArtifactDto = WorkflowArtifact;
export type ApprovalArtifactDto = ApprovalArtifact;
export type AuditArtifactDto = AuditArtifact;
export type ComplianceArtifactDto = ComplianceArtifact;
export type RecommendationArtifactDto = RecommendationArtifact;
export type InvestigationArtifactDto = InvestigationArtifact;
export type FeatureArtifactDto = FeatureArtifact;
export type InsightArtifactDto = InsightArtifact;
export type ForecastArtifactDto = ForecastArtifact;

export interface ArtifactRegistryEntry<T extends ArtifactType = ArtifactType> {
  artifactType: T;
  schemaVersion: typeof universalArtifactSchemaVersion;
  dtoName: string;
  title: string;
  description: string;
  tenantScoped: true;
  racetrackScoped: boolean;
  requiredFields: readonly string[];
  rules: readonly ArtifactValidationRule[];
}

const artifactBaseRequiredFields = ['id','artifactType','schemaVersion','tenantId','owner','createdAt','updatedAt','status','lineage','sourceRefs','evidenceRefs','correlationId','digitalTwinRefs','auditRefs'] as const;
const artifactBaseRules: readonly ArtifactValidationRule[] = [
  { path: 'id', required: true, type: 'string' },
  { path: 'artifactType', required: true, type: 'string' },
  { path: 'schemaVersion', required: true, type: 'string', values: [universalArtifactSchemaVersion] },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'racetrackId', type: 'string' },
  { path: 'owner', required: true, type: 'object' },
  { path: 'owner.ownerId', required: true, type: 'string' },
  { path: 'owner.ownerType', required: true, type: 'string', values: ['person','role','department','service','ai-agent','regulator','system'] },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'status', required: true, type: 'string' },
  { path: 'lineage', required: true, type: 'object' },
  { path: 'lineage.parentArtifactIds', required: true, type: 'array' },
  { path: 'lineage.upstreamArtifactIds', required: true, type: 'array' },
  { path: 'lineage.derivedFromArtifactIds', required: true, type: 'array' },
  { path: 'lineage.transformationRefs', required: true, type: 'array' },
  { path: 'lineage.modelLineageRefs', required: true, type: 'array' },
  { path: 'sourceRefs', required: true, type: 'array' },
  { path: 'evidenceRefs', required: true, type: 'array' },
  { path: 'correlationId', required: true, type: 'string' },
  { path: 'causationId', type: 'string' },
  { path: 'digitalTwinRefs', required: true, type: 'array' },
  { path: 'auditRefs', required: true, type: 'array' },
];

const canonicalRegistryEntry = <T extends ArtifactType>(
  artifactType: T,
  input: Omit<ArtifactRegistryEntry<T>, 'artifactType' | 'schemaVersion' | 'tenantScoped' | 'requiredFields' | 'rules'> & { requiredFields: readonly string[]; rules: readonly ArtifactValidationRule[] },
): ArtifactRegistryEntry<T> => ({
  artifactType,
  schemaVersion: universalArtifactSchemaVersion,
  tenantScoped: true,
  racetrackScoped: input.racetrackScoped,
  dtoName: input.dtoName,
  title: input.title,
  description: input.description,
  requiredFields: [...artifactBaseRequiredFields, ...input.requiredFields],
  rules: [{ path: 'artifactType', required: true, type: 'string', values: [artifactType] }, ...artifactBaseRules, ...input.rules],
});

export const artifactRegistry = {
  asset: canonicalRegistryEntry('asset', { dtoName: 'AssetArtifactDto', title: 'Asset Artifact', description: 'Canonical asset artifact.', racetrackScoped: true, requiredFields: ['assetId','assetType','assetCategory','displayName','state','risk','telemetryRefs'], rules: [{ path: 'assetId', required: true, type: 'string' }, { path: 'assetType', required: true, type: 'string' }, { path: 'assetCategory', required: true, type: 'string' }, { path: 'displayName', required: true, type: 'string' }, { path: 'state', required: true, type: 'object' }, { path: 'risk', required: true, type: 'object' }, { path: 'risk.safetyCritical', required: true, type: 'boolean' }, { path: 'risk.drivers', required: true, type: 'array' }, { path: 'telemetryRefs', required: true, type: 'array' }] }),
  event: canonicalRegistryEntry('event', { dtoName: 'EventArtifactDto', title: 'Event Artifact', description: 'Replayable event artifact.', racetrackScoped: true, requiredFields: ['eventId','eventType','occurredAt','producer','severity','subjectRefs','payload'], rules: [{ path: 'eventId', required: true, type: 'string' }, { path: 'eventType', required: true, type: 'string' }, { path: 'occurredAt', required: true, type: 'string' }, { path: 'producer', required: true, type: 'string' }, { path: 'severity', required: true, type: 'string', values: ['info','advisory','warning','critical'] }, { path: 'subjectRefs', required: true, type: 'array' }, { path: 'payload', required: true, type: 'object' }] }),
  'digital-twin': canonicalRegistryEntry('digital-twin', { dtoName: 'DigitalTwinArtifactDto', title: 'Digital Twin Artifact', description: 'Digital Twin snapshot artifact.', racetrackScoped: true, requiredFields: ['twinId','twinType','modelId','sourceEntityRefs','state','relationships'], rules: [{ path: 'twinId', required: true, type: 'string' }, { path: 'twinType', required: true, type: 'string' }, { path: 'modelId', required: true, type: 'string' }, { path: 'sourceEntityRefs', required: true, type: 'array' }, { path: 'state', required: true, type: 'object' }, { path: 'relationships', required: true, type: 'array' }] }),
  telemetry: canonicalRegistryEntry('telemetry', { dtoName: 'TelemetryArtifactDto', title: 'Telemetry Artifact', description: 'Telemetry observation artifact.', racetrackScoped: true, requiredFields: ['telemetryId','streamId','observedAt','metric','value','quality','subjectRefs'], rules: [{ path: 'telemetryId', required: true, type: 'string' }, { path: 'streamId', required: true, type: 'string' }, { path: 'observedAt', required: true, type: 'string' }, { path: 'metric', required: true, type: 'string' }, { path: 'quality', required: true, type: 'object' }, { path: 'quality.score', required: true, type: 'number', min: 0, max: 1 }, { path: 'quality.flags', required: true, type: 'array' }, { path: 'subjectRefs', required: true, type: 'array' }] }),
  workflow: canonicalRegistryEntry('workflow', { dtoName: 'WorkflowArtifactDto', title: 'Workflow Artifact', description: 'Approval-aware workflow artifact.', racetrackScoped: true, requiredFields: ['workflowId','workflowType','workflowState','subjectRefs','stepRefs','approvalRefs'], rules: [{ path: 'workflowId', required: true, type: 'string' }, { path: 'workflowType', required: true, type: 'string' }, { path: 'workflowState', required: true, type: 'string', values: ['draft','pending-approval','approved','rejected','executed','cancelled','failed'] }, { path: 'subjectRefs', required: true, type: 'array' }, { path: 'stepRefs', required: true, type: 'array' }, { path: 'approvalRefs', required: true, type: 'array' }] }),
  approval: canonicalRegistryEntry('approval', { dtoName: 'ApprovalArtifactDto', title: 'Approval Artifact', description: 'Protected action approval artifact.', racetrackScoped: true, requiredFields: ['approvalId','protectedAction','approvalStatus','targetRefs','requestedBy','approverRefs'], rules: [{ path: 'approvalId', required: true, type: 'string' }, { path: 'protectedAction', required: true, type: 'string' }, { path: 'approvalStatus', required: true, type: 'string', values: ['pending-approval','approved','rejected','expired','overridden'] }, { path: 'targetRefs', required: true, type: 'array' }, { path: 'requestedBy', required: true, type: 'object' }, { path: 'requestedBy.ownerId', required: true, type: 'string' }, { path: 'approverRefs', required: true, type: 'array' }] }),
  audit: canonicalRegistryEntry('audit', { dtoName: 'AuditArtifactDto', title: 'Audit Artifact', description: 'Hash-chain capable audit artifact.', racetrackScoped: true, requiredFields: ['auditId','action','actor','targetRefs','occurredAt','severity'], rules: [{ path: 'auditId', required: true, type: 'string' }, { path: 'action', required: true, type: 'string' }, { path: 'actor', required: true, type: 'object' }, { path: 'actor.ownerId', required: true, type: 'string' }, { path: 'targetRefs', required: true, type: 'array' }, { path: 'occurredAt', required: true, type: 'string' }, { path: 'severity', required: true, type: 'string', values: ['info','warning','critical'] }] }),
  compliance: canonicalRegistryEntry('compliance', { dtoName: 'ComplianceArtifactDto', title: 'Compliance Artifact', description: 'Compliance control artifact.', racetrackScoped: false, requiredFields: ['complianceId','frameworkIds','controlIds','obligationRefs','complianceStatus','complianceOwner'], rules: [{ path: 'complianceId', required: true, type: 'string' }, { path: 'frameworkIds', required: true, type: 'array' }, { path: 'controlIds', required: true, type: 'array' }, { path: 'obligationRefs', required: true, type: 'array' }, { path: 'complianceStatus', required: true, type: 'string', values: ['draft','implemented','assessing','effective','deficient','retired'] }, { path: 'complianceOwner', required: true, type: 'object' }, { path: 'complianceOwner.ownerId', required: true, type: 'string' }] }),
  recommendation: canonicalRegistryEntry('recommendation', { dtoName: 'RecommendationArtifactDto', title: 'Recommendation Artifact', description: 'Advisory recommendation artifact.', racetrackScoped: true, requiredFields: ['recommendationId','activity','targetRefs','recommendation','confidence','riskLevel','advisoryOnly','modelLineageRefs'], rules: [{ path: 'recommendationId', required: true, type: 'string' }, { path: 'activity', required: true, type: 'string' }, { path: 'targetRefs', required: true, type: 'array' }, { path: 'recommendation', required: true, type: 'string' }, { path: 'confidence', required: true, type: 'number', min: 0, max: 1 }, { path: 'riskLevel', required: true, type: 'string', values: ['low','medium','high','critical'] }, { path: 'advisoryOnly', required: true, type: 'boolean', values: [true] }, { path: 'modelLineageRefs', required: true, type: 'array' }] }),
  investigation: canonicalRegistryEntry('investigation', { dtoName: 'InvestigationArtifactDto', title: 'Investigation Artifact', description: 'Investigation case artifact.', racetrackScoped: true, requiredFields: ['investigationId','investigationType','investigationStatus','openedAt','leadOwner','subjectRefs','findingRefs'], rules: [{ path: 'investigationId', required: true, type: 'string' }, { path: 'investigationType', required: true, type: 'string' }, { path: 'investigationStatus', required: true, type: 'string', values: ['open','triage','in-progress','blocked','resolved','closed'] }, { path: 'openedAt', required: true, type: 'string' }, { path: 'leadOwner', required: true, type: 'object' }, { path: 'leadOwner.ownerId', required: true, type: 'string' }, { path: 'subjectRefs', required: true, type: 'array' }, { path: 'findingRefs', required: true, type: 'array' }] }),
  feature: canonicalRegistryEntry('feature', { dtoName: 'FeatureArtifactDto', title: 'Feature Artifact', description: 'Feature vector artifact.', racetrackScoped: true, requiredFields: ['featureId','featureDomain','asOf','features','scores','quality'], rules: [{ path: 'featureId', required: true, type: 'string' }, { path: 'featureDomain', required: true, type: 'string' }, { path: 'asOf', required: true, type: 'string' }, { path: 'features', required: true, type: 'object' }, { path: 'scores', required: true, type: 'object' }, { path: 'quality', required: true, type: 'object' }, { path: 'quality.score', required: true, type: 'number', min: 0, max: 1 }, { path: 'quality.missingFields', required: true, type: 'array' }, { path: 'quality.stale', required: true, type: 'boolean' }] }),
  insight: canonicalRegistryEntry('insight', { dtoName: 'InsightArtifactDto', title: 'Insight Artifact', description: 'Analytical insight artifact.', racetrackScoped: false, requiredFields: ['insightId','generatedAt','subjectRefs','summary','confidence','severity','drivers','recommendationRefs'], rules: [{ path: 'insightId', required: true, type: 'string' }, { path: 'generatedAt', required: true, type: 'string' }, { path: 'subjectRefs', required: true, type: 'array' }, { path: 'summary', required: true, type: 'string' }, { path: 'confidence', required: true, type: 'number', min: 0, max: 1 }, { path: 'severity', required: true, type: 'string', values: ['info','advisory','warning','critical'] }, { path: 'drivers', required: true, type: 'array' }, { path: 'recommendationRefs', required: true, type: 'array' }] }),
  forecast: canonicalRegistryEntry('forecast', { dtoName: 'ForecastArtifactDto', title: 'Forecast Artifact', description: 'Forecast and prediction artifact.', racetrackScoped: true, requiredFields: ['forecastId','forecastAt','horizon','subjectRefs','predictions','confidence','modelLineageRefs'], rules: [{ path: 'forecastId', required: true, type: 'string' }, { path: 'forecastAt', required: true, type: 'string' }, { path: 'horizon', required: true, type: 'object' }, { path: 'horizon.value', required: true, type: 'number', min: 0 }, { path: 'horizon.unit', required: true, type: 'string', values: ['minutes','hours','days','races'] }, { path: 'subjectRefs', required: true, type: 'array' }, { path: 'predictions', required: true, type: 'object' }, { path: 'confidence', required: true, type: 'number', min: 0, max: 1 }, { path: 'modelLineageRefs', required: true, type: 'array' }] }),
} satisfies Record<ArtifactType, ArtifactRegistryEntry>;

export const artifactSchemas = artifactRegistry;

export function createEmptyArtifactLineage(): ArtifactLineage {
  return { parentArtifactIds: [], upstreamArtifactIds: [], derivedFromArtifactIds: [], transformationRefs: [], modelLineageRefs: [] };
}

export function createArtifactBaseMetadata<T extends ArtifactType>(artifactType: T, input: {
  id: string;
  tenantId: string;
  racetrackId?: string;
  owner: ArtifactOwner;
  status?: ArtifactLifecycleStatus | string;
  now?: string;
  lineage?: Partial<ArtifactLineage>;
  sourceRefs?: ArtifactSourceRef[];
  evidenceRefs?: ArtifactEvidenceRef[];
  correlationId: string;
  causationId?: string;
  digitalTwinRefs?: ArtifactDigitalTwinRef[];
  auditRefs?: ArtifactAuditRef[];
  tags?: string[];
  extensions?: ArtifactJsonObject;
}): ArtifactBaseMetadata<T> {
  const now = input.now ?? new Date().toISOString();
  const lineage = input.lineage ?? {};
  const base: ArtifactBaseMetadata<T> = {
    id: input.id,
    artifactType,
    schemaVersion: universalArtifactSchemaVersion,
    tenantId: input.tenantId,
    owner: input.owner,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'draft',
    lineage: {
      parentArtifactIds: [...(lineage.parentArtifactIds ?? [])],
      upstreamArtifactIds: [...(lineage.upstreamArtifactIds ?? [])],
      derivedFromArtifactIds: [...(lineage.derivedFromArtifactIds ?? [])],
      transformationRefs: [...(lineage.transformationRefs ?? [])],
      modelLineageRefs: [...(lineage.modelLineageRefs ?? [])],
    },
    sourceRefs: [...(input.sourceRefs ?? [])],
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    correlationId: input.correlationId,
    digitalTwinRefs: [...(input.digitalTwinRefs ?? [])],
    auditRefs: [...(input.auditRefs ?? [])],
  };
  if (input.racetrackId !== undefined) base.racetrackId = input.racetrackId;
  if (lineage.rootArtifactId !== undefined) base.lineage.rootArtifactId = lineage.rootArtifactId;
  if (input.causationId !== undefined) base.causationId = input.causationId;
  if (input.tags !== undefined) base.tags = [...input.tags];
  if (input.extensions !== undefined) base.extensions = input.extensions;
  return base;
}

export function validateArtifact(value: unknown): ArtifactValidationResult {
  if (!isRecord(value)) return { valid: false, errors: ['Artifact must be object'] };
  const artifactType = artifactTypeFrom(value.artifactType);
  if (!artifactType) return { valid: false, errors: [`Artifact.artifactType must be one of ${artifactTypes.join(',')}`] };
  const entry = artifactRegistry[artifactType];
  const errors = validateRules('Artifact', value, entry.rules);
  if (entry.racetrackScoped && !value.racetrackId) errors.push('Artifact.racetrackId is required for racetrack-scoped artifacts');

  const artifact = value as unknown as Artifact;
  if (artifact.owner?.tenantId && artifact.owner.tenantId !== artifact.tenantId) errors.push('Artifact.owner.tenantId must match artifact tenantId');
  if (artifact.owner?.racetrackId && artifact.racetrackId && artifact.owner.racetrackId !== artifact.racetrackId) errors.push('Artifact.owner.racetrackId must match artifact racetrackId');
  for (const ref of artifact.digitalTwinRefs ?? []) if (!String(ref.twinId).startsWith('twin:')) errors.push('Artifact.digitalTwinRefs.twinId must use twin:<context>:<entity-id>');
  if (artifactType === 'event' && !/^([a-z][A-Za-z0-9-]*\.){2,}[a-z][A-Za-z0-9-]*\.v\d+$/.test((artifact as EventArtifact).eventType)) errors.push('Artifact.eventType must follow context.entity.verb.vN naming');
  if (artifactType === 'recommendation' && (artifact as RecommendationArtifact).requestedAction && (artifact as RecommendationArtifact).advisoryOnly !== true) errors.push('Artifact.recommendation requesting an action must be advisoryOnly');
  if (artifactType === 'approval' && (artifact as ApprovalArtifact).approvalStatus === 'approved' && (!(artifact as ApprovalArtifact).approverRefs?.length || !artifact.evidenceRefs?.length)) errors.push('Artifact.approved approval requires approverRefs and evidenceRefs');
  if (!isArtifactJsonSerializable(value)) errors.push('Artifact must be JSON-serializable');
  return { valid: errors.length === 0, errors };
}

export function validateArtifactSet(artifacts: readonly Artifact[]): ArtifactValidationResult {
  const errors = artifacts.flatMap((artifact) => validateArtifact(artifact).errors.map((error) => `${artifact.artifactType}:${artifact.id} ${error}`));
  const keys = new Set<string>();
  for (const artifact of artifacts) {
    const key = `${artifact.tenantId}:${artifact.racetrackId ?? 'global'}:${artifact.artifactType}:${artifact.id}`;
    if (keys.has(key)) errors.push(`${artifact.artifactType}:${artifact.id} duplicate artifact id in tenant/racetrack scope`);
    keys.add(key);
  }
  return { valid: errors.length === 0, errors };
}

export function isArtifact(value: unknown): value is Artifact {
  return validateArtifact(value).valid;
}

export function isArtifactOfType<T extends ArtifactType>(value: unknown, artifactType: T): value is Extract<Artifact, { artifactType: T }> {
  return isArtifact(value) && value.artifactType === artifactType;
}

export function serializeArtifact<T extends Artifact>(artifact: T): string {
  const result = validateArtifact(artifact);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return JSON.stringify(artifact);
}

export function deserializeArtifact<T extends Artifact = Artifact>(payload: string): T {
  const artifact = JSON.parse(payload) as T;
  const result = validateArtifact(artifact);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return artifact;
}

export function isArtifactJsonSerializable(value: unknown): value is ArtifactJsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isArtifactJsonSerializable);
  if (typeof value !== 'object' || !isPlainArtifactJsonObject(value)) return false;
  return Object.values(value).every(isArtifactJsonSerializable);
}

function isPlainArtifactJsonObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
