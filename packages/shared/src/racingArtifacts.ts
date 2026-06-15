import {
  universalArtifactSchemaVersion,
  type ArtifactEnvelope,
  type UniversalArtifactType,
  type UniversalArtifactValidationResult,
} from './universalArtifactFramework.js';

export const racingArtifactSchemaVersion = 'trackmind.racing-artifact.v1' as const;

export const racingArtifactKinds = [
  'raw-provider-payload',
  'race-card',
  'race',
  'race-entry',
  'race-result',
  'horse-identity',
  'person-identity',
  'workout',
  'past-performance',
  'surface-condition',
  'steward-ruling',
  'regulatory-record',
  'entity-resolution-decision',
  'data-quality-report',
  'data-usage-policy',
  'feature-record',
  'training-dataset-manifest',
] as const;

export type RacingArtifactKind = typeof racingArtifactKinds[number];
export type RacingArtifactPrivacyClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'regulated';
export type RacingArtifactJsonScalar = string | number | boolean | null;
export type RacingArtifactJsonValue = RacingArtifactJsonScalar | RacingArtifactJsonValue[] | { [key: string]: RacingArtifactJsonValue };
export type RacingArtifactJsonObject = { [key: string]: RacingArtifactJsonValue };
export type RacingSurfaceType = 'dirt' | 'turf' | 'synthetic';
export type RacingPersonRole = 'jockey' | 'trainer' | 'owner' | 'steward' | 'veterinarian' | 'racing-secretary' | 'regulator' | 'other';

export interface RacingArtifactScope {
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
  jurisdiction?: string;
  meetId?: string;
  raceDate?: string;
}

export interface RacingProviderRef {
  provider: string;
  providerRecordId: string;
  providerEntityType?: string;
  observedAt?: string;
  uri?: string;
  checksum?: string;
}

export interface RacingArtifactSource {
  system: string;
  channel: 'api' | 'file' | 'manual' | 'stream' | 'database' | 'model' | 'regulator' | 'provider';
  feedName?: string;
  uri?: string;
  ingestedAt: string;
  receivedAt?: string;
  stewardedBy?: string;
}

export interface RacingArtifactProvenance {
  capturedAt: string;
  normalizedBy: string;
  transformRefs: string[];
  confidence?: number;
}

export interface RacingArtifactLicenseContext {
  licenseId: string;
  provider: string;
  rights: string[];
  restrictions: string[];
  permittedUses: string[];
  attribution?: string;
  expiresAt?: string;
}

export interface RacingArtifactLineage {
  rootArtifactId?: string;
  parentArtifactIds: string[];
  upstreamArtifactIds: string[];
  derivedFromArtifactIds: string[];
  transformationRefs: string[];
  modelLineageRefs: string[];
}

export interface RacingArtifactEvidenceRef {
  evidenceId: string;
  kind: 'document' | 'video' | 'image' | 'provider-record' | 'audit' | 'regulatory' | 'telemetry' | 'observation' | 'model-output' | 'external';
  label?: string;
  sourceRefId?: string;
  uri?: string;
  hash?: string;
  capturedAt?: string;
}

export interface RacingArtifactExternalRefs {
  eventIds: string[];
  auditIds: string[];
  digitalTwinRefs: string[];
}

export interface RacingArtifactBase<TKind extends RacingArtifactKind = RacingArtifactKind> {
  artifactId: string;
  kind: TKind;
  schemaVersion: typeof racingArtifactSchemaVersion;
  scope: RacingArtifactScope;
  providerRefs: RacingProviderRef[];
  source: RacingArtifactSource;
  provenance: RacingArtifactProvenance;
  licenseContext: RacingArtifactLicenseContext;
  lineage: RacingArtifactLineage;
  privacyClassification: RacingArtifactPrivacyClassification;
  evidence: RacingArtifactEvidenceRef[];
  refs: RacingArtifactExternalRefs;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  dataUsagePolicyId?: string;
  tenantId?: string;
  racetrackId?: string;
  tags?: string[];
  extensions?: RacingArtifactJsonObject;
}

export interface RawProviderPayload extends RacingArtifactBase<'raw-provider-payload'> {
  payloadId: string;
  provider: string;
  contentType: string;
  payload: RacingArtifactJsonValue;
  receivedAt: string;
  normalizedArtifactIds: string[];
}

export interface RaceCard extends RacingArtifactBase<'race-card'> {
  raceCardId: string;
  raceDate: string;
  trackCode: string;
  races: Array<{ raceId: string; raceNumber: number; scheduledPostTime?: string; status: string }>;
}

export interface Race extends RacingArtifactBase<'race'> {
  raceId: string;
  raceCardId?: string;
  raceNumber: number;
  scheduledPostTime?: string;
  distanceFurlongs: number;
  surface: RacingSurfaceType;
  status: 'scheduled' | 'entries-open' | 'closed' | 'official' | 'cancelled';
  entryIds: string[];
}

export interface RaceEntry extends RacingArtifactBase<'race-entry'> {
  entryId: string;
  raceId: string;
  horseId: string;
  trainerId?: string;
  jockeyId?: string;
  ownerIds: string[];
  programNumber?: string;
  postPosition?: number;
  medicationFlags: string[];
  equipmentFlags: string[];
  status: 'entered' | 'also-eligible' | 'scratched' | 'starter' | 'withdrawn';
}

export interface RaceResult extends RacingArtifactBase<'race-result'> {
  resultId: string;
  raceId: string;
  official: boolean;
  postedAt: string;
  finishOrder: Array<{ entryId: string; horseId: string; position: number; beatenLengths?: number; disqualified?: boolean }>;
  payouts?: Array<{ wagerType: string; amount: number; currency: string }>;
}

export interface HorseIdentity extends RacingArtifactBase<'horse-identity'> {
  horseId: string;
  registeredName: string;
  registrationNumber?: string;
  microchipId?: string;
  foaledOn?: string;
  sex?: 'colt' | 'filly' | 'gelding' | 'mare' | 'horse' | 'ridgling';
  color?: string;
  sireName?: string;
  damName?: string;
  identityStatus: 'active' | 'merged' | 'retired' | 'disputed';
}

export interface PersonIdentity extends RacingArtifactBase<'person-identity'> {
  personId: string;
  displayName: string;
  legalName?: string;
  roles: RacingPersonRole[];
  licenseRefs: Array<{ licenseNumber: string; jurisdiction: string; role: RacingPersonRole; status: 'active' | 'suspended' | 'expired' | 'pending' }>;
  identityStatus: 'active' | 'merged' | 'inactive' | 'disputed';
}

export interface Workout extends RacingArtifactBase<'workout'> {
  workoutId: string;
  horseId: string;
  workedAt: string;
  distanceFurlongs: number;
  surface: RacingSurfaceType;
  timeSeconds?: number;
  rank?: string;
  notes?: string;
}

export interface PastPerformance extends RacingArtifactBase<'past-performance'> {
  performanceId: string;
  horseId: string;
  raceId: string;
  raceDate: string;
  finishPosition?: number;
  speedFigure?: number;
  classRating?: number;
  trackCondition?: string;
  comments: string[];
}

export interface SurfaceCondition extends RacingArtifactBase<'surface-condition'> {
  conditionId: string;
  observedAt: string;
  surface: RacingSurfaceType;
  condition: 'fast' | 'good' | 'muddy' | 'sloppy' | 'firm' | 'yielding' | 'soft' | 'sealed' | 'unknown';
  moisturePct?: number;
  compactionPsi?: number;
  cushionDepthInches?: number;
  weatherRefs: string[];
}

export interface StewardRuling extends RacingArtifactBase<'steward-ruling'> {
  rulingId: string;
  raceId?: string;
  subjectRefs: Array<{ subjectId: string; subjectType: 'horse' | 'person' | 'race' | 'entry' | 'other' }>;
  rulingType: 'inquiry' | 'objection' | 'disqualification' | 'fine' | 'suspension' | 'warning' | 'other';
  status: 'draft' | 'pending-review' | 'official' | 'appealed' | 'rescinded';
  issuedAt?: string;
  ruleRefs: string[];
  summary: string;
}

export interface RegulatoryRecord extends RacingArtifactBase<'regulatory-record'> {
  regulatoryRecordId: string;
  authority: string;
  jurisdiction: string;
  recordType: 'license' | 'medication' | 'ruling' | 'eligibility' | 'compliance' | 'filing' | 'other';
  subjectRef: { subjectId: string; subjectType: 'horse' | 'person' | 'race' | 'racetrack' | 'other' };
  status: 'active' | 'pending' | 'closed' | 'superseded' | 'void';
  effectiveAt?: string;
  expiresAt?: string;
}

export interface EntityResolutionDecision extends RacingArtifactBase<'entity-resolution-decision'> {
  decisionId: string;
  entityType: 'horse' | 'person' | 'race' | 'race-entry' | 'provider-record';
  candidateRefs: string[];
  resolvedEntityId: string;
  decision: 'match' | 'possible-match' | 'no-match' | 'split' | 'merge';
  confidence: number;
  decidedBy: 'human' | 'service' | 'model';
  rationale: string;
}

export interface DataQualityReport extends RacingArtifactBase<'data-quality-report'> {
  reportId: string;
  subjectArtifactIds: string[];
  generatedAt: string;
  qualityScore: number;
  dimensions: Array<{ name: 'completeness' | 'freshness' | 'consistency' | 'validity' | 'uniqueness' | 'license'; score: number; findings: string[] }>;
  blockingIssues: string[];
}

export interface DataUsagePolicy extends RacingArtifactBase<'data-usage-policy'> {
  policyId: string;
  appliesToArtifactKinds: RacingArtifactKind[];
  allowedUses: string[];
  prohibitedUses: string[];
  retention: { retainUntil?: string; retentionPolicy: string; legalHold: boolean };
  privacyRules: Array<{ classification: RacingArtifactPrivacyClassification; controls: string[] }>;
  attributionRequired: boolean;
}

export interface FeatureRecord extends RacingArtifactBase<'feature-record'> {
  featureRecordId: string;
  featureId: string;
  domain: 'race' | 'horse' | 'surface' | 'workout' | 'stewarding' | 'provider-quality';
  entityRef: { entityId: string; entityType: 'race' | 'horse' | 'person' | 'surface' | 'provider-record' };
  asOf: string;
  features: Record<string, RacingArtifactJsonScalar>;
  scores: Record<string, number>;
  quality: { score: number; missingFields: string[]; stale: boolean };
}

export interface TrainingDatasetManifest extends RacingArtifactBase<'training-dataset-manifest'> {
  manifestId: string;
  datasetId: string;
  datasetVersion: string;
  generatedAt: string;
  artifactIds: string[];
  featureRecordIds: string[];
  labelDefinition?: string;
  splitStrategy: string;
  permittedTrainingUses: string[];
  excludedArtifactIds: string[];
}

export type RacingArtifact =
  | RawProviderPayload
  | RaceCard
  | Race
  | RaceEntry
  | RaceResult
  | HorseIdentity
  | PersonIdentity
  | Workout
  | PastPerformance
  | SurfaceCondition
  | StewardRuling
  | RegulatoryRecord
  | EntityResolutionDecision
  | DataQualityReport
  | DataUsagePolicy
  | FeatureRecord
  | TrainingDatasetManifest;

export type RacingFeatureRecord = FeatureRecord;
export type RacingFeatureRecordDto = FeatureRecord;

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';
type ValidationRule = { path: string; required?: true; type?: FieldType; values?: readonly (string | number | boolean)[]; min?: number; max?: number };

export interface RacingArtifactSchemaEntry<TKind extends RacingArtifactKind = RacingArtifactKind> {
  kind: TKind;
  schemaVersion: typeof racingArtifactSchemaVersion;
  dtoName: string;
  universalArtifactType: UniversalArtifactType;
  requiredFields: readonly string[];
  backwardCompatibleWith: readonly string[];
  rules: readonly ValidationRule[];
}

const baseRequiredFields = [
  'artifactId',
  'kind',
  'schemaVersion',
  'scope',
  'providerRefs',
  'source',
  'provenance',
  'licenseContext',
  'lineage',
  'privacyClassification',
  'evidence',
  'refs',
  'createdAt',
  'updatedAt',
  'correlationId',
] as const;

const privacyClassifications = ['public', 'internal', 'confidential', 'restricted', 'regulated'] as const;
const confidenceRule = (path: string): ValidationRule => ({ path, type: 'number', min: 0, max: 1 });

const baseRules: ValidationRule[] = [
  { path: 'artifactId', required: true, type: 'string' },
  { path: 'kind', required: true, type: 'string' },
  { path: 'schemaVersion', required: true, type: 'string', values: [racingArtifactSchemaVersion] },
  { path: 'scope', required: true, type: 'object' },
  { path: 'scope.tenantId', required: true, type: 'string' },
  { path: 'scope.racetrackId', required: true, type: 'string' },
  { path: 'providerRefs', required: true, type: 'array' },
  { path: 'source', required: true, type: 'object' },
  { path: 'source.system', required: true, type: 'string' },
  { path: 'source.channel', required: true, type: 'string', values: ['api', 'file', 'manual', 'stream', 'database', 'model', 'regulator', 'provider'] },
  { path: 'source.ingestedAt', required: true, type: 'string' },
  { path: 'provenance', required: true, type: 'object' },
  { path: 'provenance.capturedAt', required: true, type: 'string' },
  { path: 'provenance.normalizedBy', required: true, type: 'string' },
  { path: 'provenance.transformRefs', required: true, type: 'array' },
  confidenceRule('provenance.confidence'),
  { path: 'licenseContext', required: true, type: 'object' },
  { path: 'licenseContext.licenseId', required: true, type: 'string' },
  { path: 'licenseContext.provider', required: true, type: 'string' },
  { path: 'licenseContext.rights', required: true, type: 'array' },
  { path: 'licenseContext.restrictions', required: true, type: 'array' },
  { path: 'licenseContext.permittedUses', required: true, type: 'array' },
  { path: 'lineage', required: true, type: 'object' },
  { path: 'lineage.parentArtifactIds', required: true, type: 'array' },
  { path: 'lineage.upstreamArtifactIds', required: true, type: 'array' },
  { path: 'lineage.derivedFromArtifactIds', required: true, type: 'array' },
  { path: 'lineage.transformationRefs', required: true, type: 'array' },
  { path: 'lineage.modelLineageRefs', required: true, type: 'array' },
  { path: 'privacyClassification', required: true, type: 'string', values: privacyClassifications },
  { path: 'evidence', required: true, type: 'array' },
  { path: 'refs', required: true, type: 'object' },
  { path: 'refs.eventIds', required: true, type: 'array' },
  { path: 'refs.auditIds', required: true, type: 'array' },
  { path: 'refs.digitalTwinRefs', required: true, type: 'array' },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'correlationId', required: true, type: 'string' },
  { path: 'tenantId', type: 'string' },
  { path: 'racetrackId', type: 'string' },
  { path: 'tags', type: 'array' },
  { path: 'extensions', type: 'object' },
];

const schema = <TKind extends RacingArtifactKind>(
  kind: TKind,
  dtoName: string,
  universalArtifactType: UniversalArtifactType,
  requiredFields: readonly string[],
  rules: readonly ValidationRule[],
): RacingArtifactSchemaEntry<TKind> => ({
  kind,
  schemaVersion: racingArtifactSchemaVersion,
  dtoName,
  universalArtifactType,
  requiredFields: [...baseRequiredFields, ...requiredFields],
  backwardCompatibleWith: ['trackmind.racing-artifact.v1'],
  rules: [...baseRules, { path: 'kind', required: true, type: 'string', values: [kind] }, ...rules],
});

export const racingArtifactSchemas = {
  'raw-provider-payload': schema('raw-provider-payload', 'RawProviderPayload', 'event', ['payloadId', 'provider', 'contentType', 'payload', 'receivedAt', 'normalizedArtifactIds'], [
    { path: 'payloadId', required: true, type: 'string' }, { path: 'provider', required: true, type: 'string' }, { path: 'contentType', required: true, type: 'string' }, { path: 'receivedAt', required: true, type: 'string' }, { path: 'normalizedArtifactIds', required: true, type: 'array' },
  ]),
  'race-card': schema('race-card', 'RaceCard', 'asset', ['raceCardId', 'raceDate', 'trackCode', 'races'], [
    { path: 'raceCardId', required: true, type: 'string' }, { path: 'raceDate', required: true, type: 'string' }, { path: 'trackCode', required: true, type: 'string' }, { path: 'races', required: true, type: 'array' },
  ]),
  race: schema('race', 'Race', 'event', ['raceId', 'raceNumber', 'distanceFurlongs', 'surface', 'status', 'entryIds'], [
    { path: 'raceId', required: true, type: 'string' }, { path: 'raceNumber', required: true, type: 'number', min: 1 }, { path: 'distanceFurlongs', required: true, type: 'number', min: 0 }, { path: 'surface', required: true, type: 'string', values: ['dirt', 'turf', 'synthetic'] }, { path: 'status', required: true, type: 'string' }, { path: 'entryIds', required: true, type: 'array' },
  ]),
  'race-entry': schema('race-entry', 'RaceEntry', 'event', ['entryId', 'raceId', 'horseId', 'ownerIds', 'medicationFlags', 'equipmentFlags', 'status'], [
    { path: 'entryId', required: true, type: 'string' }, { path: 'raceId', required: true, type: 'string' }, { path: 'horseId', required: true, type: 'string' }, { path: 'ownerIds', required: true, type: 'array' }, { path: 'medicationFlags', required: true, type: 'array' }, { path: 'equipmentFlags', required: true, type: 'array' }, { path: 'status', required: true, type: 'string' },
  ]),
  'race-result': schema('race-result', 'RaceResult', 'event', ['resultId', 'raceId', 'official', 'postedAt', 'finishOrder'], [
    { path: 'resultId', required: true, type: 'string' }, { path: 'raceId', required: true, type: 'string' }, { path: 'official', required: true, type: 'boolean' }, { path: 'postedAt', required: true, type: 'string' }, { path: 'finishOrder', required: true, type: 'array' },
  ]),
  'horse-identity': schema('horse-identity', 'HorseIdentity', 'asset', ['horseId', 'registeredName', 'identityStatus'], [
    { path: 'horseId', required: true, type: 'string' }, { path: 'registeredName', required: true, type: 'string' }, { path: 'identityStatus', required: true, type: 'string' },
  ]),
  'person-identity': schema('person-identity', 'PersonIdentity', 'asset', ['personId', 'displayName', 'roles', 'licenseRefs', 'identityStatus'], [
    { path: 'personId', required: true, type: 'string' }, { path: 'displayName', required: true, type: 'string' }, { path: 'roles', required: true, type: 'array' }, { path: 'licenseRefs', required: true, type: 'array' }, { path: 'identityStatus', required: true, type: 'string' },
  ]),
  workout: schema('workout', 'Workout', 'telemetry', ['workoutId', 'horseId', 'workedAt', 'distanceFurlongs', 'surface'], [
    { path: 'workoutId', required: true, type: 'string' }, { path: 'horseId', required: true, type: 'string' }, { path: 'workedAt', required: true, type: 'string' }, { path: 'distanceFurlongs', required: true, type: 'number', min: 0 }, { path: 'surface', required: true, type: 'string', values: ['dirt', 'turf', 'synthetic'] },
  ]),
  'past-performance': schema('past-performance', 'PastPerformance', 'telemetry', ['performanceId', 'horseId', 'raceId', 'raceDate', 'comments'], [
    { path: 'performanceId', required: true, type: 'string' }, { path: 'horseId', required: true, type: 'string' }, { path: 'raceId', required: true, type: 'string' }, { path: 'raceDate', required: true, type: 'string' }, { path: 'comments', required: true, type: 'array' },
  ]),
  'surface-condition': schema('surface-condition', 'SurfaceCondition', 'telemetry', ['conditionId', 'observedAt', 'surface', 'condition', 'weatherRefs'], [
    { path: 'conditionId', required: true, type: 'string' }, { path: 'observedAt', required: true, type: 'string' }, { path: 'surface', required: true, type: 'string', values: ['dirt', 'turf', 'synthetic'] }, { path: 'condition', required: true, type: 'string' }, { path: 'weatherRefs', required: true, type: 'array' },
  ]),
  'steward-ruling': schema('steward-ruling', 'StewardRuling', 'compliance', ['rulingId', 'subjectRefs', 'rulingType', 'status', 'ruleRefs', 'summary'], [
    { path: 'rulingId', required: true, type: 'string' }, { path: 'subjectRefs', required: true, type: 'array' }, { path: 'rulingType', required: true, type: 'string' }, { path: 'status', required: true, type: 'string' }, { path: 'ruleRefs', required: true, type: 'array' }, { path: 'summary', required: true, type: 'string' },
  ]),
  'regulatory-record': schema('regulatory-record', 'RegulatoryRecord', 'compliance', ['regulatoryRecordId', 'authority', 'jurisdiction', 'recordType', 'subjectRef', 'status'], [
    { path: 'regulatoryRecordId', required: true, type: 'string' }, { path: 'authority', required: true, type: 'string' }, { path: 'jurisdiction', required: true, type: 'string' }, { path: 'recordType', required: true, type: 'string' }, { path: 'subjectRef', required: true, type: 'object' }, { path: 'status', required: true, type: 'string' },
  ]),
  'entity-resolution-decision': schema('entity-resolution-decision', 'EntityResolutionDecision', 'audit', ['decisionId', 'entityType', 'candidateRefs', 'resolvedEntityId', 'decision', 'confidence', 'decidedBy', 'rationale'], [
    { path: 'decisionId', required: true, type: 'string' }, { path: 'entityType', required: true, type: 'string' }, { path: 'candidateRefs', required: true, type: 'array' }, { path: 'resolvedEntityId', required: true, type: 'string' }, { path: 'decision', required: true, type: 'string' }, confidenceRule('confidence'), { path: 'decidedBy', required: true, type: 'string' }, { path: 'rationale', required: true, type: 'string' },
  ]),
  'data-quality-report': schema('data-quality-report', 'DataQualityReport', 'insight', ['reportId', 'subjectArtifactIds', 'generatedAt', 'qualityScore', 'dimensions', 'blockingIssues'], [
    { path: 'reportId', required: true, type: 'string' }, { path: 'subjectArtifactIds', required: true, type: 'array' }, { path: 'generatedAt', required: true, type: 'string' }, { path: 'qualityScore', required: true, type: 'number', min: 0, max: 1 }, { path: 'dimensions', required: true, type: 'array' }, { path: 'blockingIssues', required: true, type: 'array' },
  ]),
  'data-usage-policy': schema('data-usage-policy', 'DataUsagePolicy', 'compliance', ['policyId', 'appliesToArtifactKinds', 'allowedUses', 'prohibitedUses', 'retention', 'privacyRules', 'attributionRequired'], [
    { path: 'policyId', required: true, type: 'string' }, { path: 'appliesToArtifactKinds', required: true, type: 'array' }, { path: 'allowedUses', required: true, type: 'array' }, { path: 'prohibitedUses', required: true, type: 'array' }, { path: 'retention', required: true, type: 'object' }, { path: 'retention.retentionPolicy', required: true, type: 'string' }, { path: 'retention.legalHold', required: true, type: 'boolean' }, { path: 'privacyRules', required: true, type: 'array' }, { path: 'attributionRequired', required: true, type: 'boolean' },
  ]),
  'feature-record': schema('feature-record', 'FeatureRecord', 'feature', ['featureRecordId', 'featureId', 'domain', 'entityRef', 'asOf', 'features', 'scores', 'quality'], [
    { path: 'featureRecordId', required: true, type: 'string' }, { path: 'featureId', required: true, type: 'string' }, { path: 'domain', required: true, type: 'string' }, { path: 'entityRef', required: true, type: 'object' }, { path: 'asOf', required: true, type: 'string' }, { path: 'features', required: true, type: 'object' }, { path: 'scores', required: true, type: 'object' }, { path: 'quality', required: true, type: 'object' }, { path: 'quality.score', required: true, type: 'number', min: 0, max: 1 }, { path: 'quality.missingFields', required: true, type: 'array' }, { path: 'quality.stale', required: true, type: 'boolean' },
  ]),
  'training-dataset-manifest': schema('training-dataset-manifest', 'TrainingDatasetManifest', 'feature', ['manifestId', 'datasetId', 'datasetVersion', 'generatedAt', 'artifactIds', 'featureRecordIds', 'splitStrategy', 'permittedTrainingUses', 'excludedArtifactIds'], [
    { path: 'manifestId', required: true, type: 'string' }, { path: 'datasetId', required: true, type: 'string' }, { path: 'datasetVersion', required: true, type: 'string' }, { path: 'generatedAt', required: true, type: 'string' }, { path: 'artifactIds', required: true, type: 'array' }, { path: 'featureRecordIds', required: true, type: 'array' }, { path: 'splitStrategy', required: true, type: 'string' }, { path: 'permittedTrainingUses', required: true, type: 'array' }, { path: 'excludedArtifactIds', required: true, type: 'array' },
  ]),
} satisfies Record<RacingArtifactKind, RacingArtifactSchemaEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function get(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, value);
}

function matchesType(value: unknown, type: FieldType): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function validateStringArray(name: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${name} must be array`];
  return value.flatMap((item, index) => typeof item === 'string' ? [] : [`${name}[${index}] must be string`]);
}

function validateRules(name: string, value: unknown, rules: readonly ValidationRule[]): string[] {
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

export function createEmptyRacingArtifactLineage(): RacingArtifactLineage {
  return { parentArtifactIds: [], upstreamArtifactIds: [], derivedFromArtifactIds: [], transformationRefs: [], modelLineageRefs: [] };
}

export function validateRacingArtifact(artifact: unknown): UniversalArtifactValidationResult {
  if (!isRecord(artifact)) return { valid: false, errors: ['RacingArtifact must be object'] };
  const kind = artifact.kind as RacingArtifactKind;
  const entry = racingArtifactSchemas[kind];
  if (!entry) return { valid: false, errors: [`RacingArtifact schema not registered for kind ${String(kind)}`] };
  const errors = validateRules(entry.dtoName, artifact, entry.rules);

  const tenantId = get(artifact, 'scope.tenantId');
  const racetrackId = get(artifact, 'scope.racetrackId');
  if (artifact.tenantId !== undefined && artifact.tenantId !== tenantId) errors.push(`${entry.dtoName}.tenantId must match scope.tenantId`);
  if (artifact.racetrackId !== undefined && artifact.racetrackId !== racetrackId) errors.push(`${entry.dtoName}.racetrackId must match scope.racetrackId`);
  for (const ref of (isRecord(artifact.refs) && Array.isArray(artifact.refs.digitalTwinRefs) ? artifact.refs.digitalTwinRefs : [])) {
    if (typeof ref !== 'string') errors.push(`${entry.dtoName}.refs.digitalTwinRefs entries must be string`);
    else if (!ref.startsWith('twin:')) errors.push(`${entry.dtoName}.refs.digitalTwinRefs entries must use twin:<context>:<entity-id>`);
  }
  errors.push(...validateStringArray(`${entry.dtoName}.refs.eventIds`, get(artifact, 'refs.eventIds')));
  errors.push(...validateStringArray(`${entry.dtoName}.refs.auditIds`, get(artifact, 'refs.auditIds')));
  errors.push(...validateStringArray(`${entry.dtoName}.lineage.parentArtifactIds`, get(artifact, 'lineage.parentArtifactIds')));
  errors.push(...validateStringArray(`${entry.dtoName}.lineage.upstreamArtifactIds`, get(artifact, 'lineage.upstreamArtifactIds')));
  if (!isRacingArtifactJsonSerializable(artifact)) errors.push(`${entry.dtoName} must be JSON-serializable`);
  return { valid: errors.length === 0, errors };
}

export function isRacingArtifact(value: unknown): value is RacingArtifact {
  return validateRacingArtifact(value).valid;
}

export function isRacingArtifactOfKind<TKind extends RacingArtifactKind>(value: unknown, kind: TKind): value is Extract<RacingArtifact, { kind: TKind }> {
  return isRacingArtifact(value) && value.kind === kind;
}

export const isRawProviderPayload = (value: unknown): value is RawProviderPayload => isRacingArtifactOfKind(value, 'raw-provider-payload');
export const isRaceCard = (value: unknown): value is RaceCard => isRacingArtifactOfKind(value, 'race-card');
export const isRace = (value: unknown): value is Race => isRacingArtifactOfKind(value, 'race');
export const isRaceEntry = (value: unknown): value is RaceEntry => isRacingArtifactOfKind(value, 'race-entry');
export const isRaceResult = (value: unknown): value is RaceResult => isRacingArtifactOfKind(value, 'race-result');
export const isHorseIdentity = (value: unknown): value is HorseIdentity => isRacingArtifactOfKind(value, 'horse-identity');
export const isPersonIdentity = (value: unknown): value is PersonIdentity => isRacingArtifactOfKind(value, 'person-identity');
export const isWorkout = (value: unknown): value is Workout => isRacingArtifactOfKind(value, 'workout');
export const isPastPerformance = (value: unknown): value is PastPerformance => isRacingArtifactOfKind(value, 'past-performance');
export const isSurfaceCondition = (value: unknown): value is SurfaceCondition => isRacingArtifactOfKind(value, 'surface-condition');
export const isStewardRuling = (value: unknown): value is StewardRuling => isRacingArtifactOfKind(value, 'steward-ruling');
export const isRegulatoryRecord = (value: unknown): value is RegulatoryRecord => isRacingArtifactOfKind(value, 'regulatory-record');
export const isEntityResolutionDecision = (value: unknown): value is EntityResolutionDecision => isRacingArtifactOfKind(value, 'entity-resolution-decision');
export const isDataQualityReport = (value: unknown): value is DataQualityReport => isRacingArtifactOfKind(value, 'data-quality-report');
export const isDataUsagePolicy = (value: unknown): value is DataUsagePolicy => isRacingArtifactOfKind(value, 'data-usage-policy');
export const isFeatureRecord = (value: unknown): value is FeatureRecord => isRacingArtifactOfKind(value, 'feature-record');
export const isTrainingDatasetManifest = (value: unknown): value is TrainingDatasetManifest => isRacingArtifactOfKind(value, 'training-dataset-manifest');

export function serializeRacingArtifact<T extends RacingArtifact>(artifact: T): string {
  const result = validateRacingArtifact(artifact);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return JSON.stringify(artifact);
}

export function deserializeRacingArtifact<T extends RacingArtifact = RacingArtifact>(payload: string): T {
  const artifact = JSON.parse(payload) as T;
  const result = validateRacingArtifact(artifact);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return artifact;
}

export function isRacingArtifactJsonSerializable(value: unknown): value is RacingArtifactJsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isRacingArtifactJsonSerializable);
  if (!isRecord(value) || !isPlainJsonObject(value)) return false;
  return Object.values(value).every(isRacingArtifactJsonSerializable);
}

export function toUniversalArtifactEnvelope<T extends RacingArtifact>(artifact: T): ArtifactEnvelope<Record<string, unknown>> {
  const result = validateRacingArtifact(artifact);
  if (!result.valid) throw new Error(result.errors.join('; '));
  const entry = racingArtifactSchemas[artifact.kind];
  return {
    schemaVersion: universalArtifactSchemaVersion,
    artifactId: artifact.artifactId,
    artifactType: entry.universalArtifactType,
    tenant: {
      tenantId: artifact.scope.tenantId,
      racetrackId: artifact.scope.racetrackId,
      organizationId: artifact.scope.organizationId,
      dataBoundary: artifact.privacyClassification === 'public' ? 'federated' : 'racetrack',
    },
    lineage: {
      sourceSystem: artifact.source.system,
      correlationId: artifact.correlationId,
      causationIds: artifact.refs.eventIds,
      inputArtifactIds: [...artifact.lineage.parentArtifactIds, ...artifact.lineage.upstreamArtifactIds],
      outputArtifactIds: [artifact.artifactId, ...artifact.lineage.derivedFromArtifactIds],
      producedBy: artifact.provenance.normalizedBy,
    },
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    payload: createUniversalPayload(artifact),
    tags: artifact.tags,
    extensions: {
      racingArtifactKind: artifact.kind,
      racingSchemaVersion: artifact.schemaVersion,
      providerRefs: artifact.providerRefs as unknown as RacingArtifactJsonValue,
      licenseContext: artifact.licenseContext as unknown as RacingArtifactJsonValue,
      privacyClassification: artifact.privacyClassification,
      evidence: artifact.evidence as unknown as RacingArtifactJsonValue,
      refs: artifact.refs as unknown as RacingArtifactJsonValue,
      ...(artifact.extensions ?? {}),
    },
    tenantId: artifact.scope.tenantId,
    racetrackId: artifact.scope.racetrackId,
    correlationId: artifact.correlationId,
  };
}

function createUniversalPayload(artifact: RacingArtifact): Record<string, unknown> {
  const evidenceRefs = artifact.evidence.map((item) => item.evidenceId);
  const subjectRef = { id: subjectIdFor(artifact), type: subjectTypeFor(artifact) };
  const base = { racingArtifactKind: artifact.kind, source: artifact.source, providerRefs: artifact.providerRefs, evidenceRefs, payload: artifact };
  switch (racingArtifactSchemas[artifact.kind].universalArtifactType) {
    case 'asset':
      return { ...base, assetId: subjectIdFor(artifact), assetType: subjectTypeFor(artifact), status: statusFor(artifact), riskClassification: riskClassificationFor(artifact) };
    case 'event':
      return { ...base, eventType: `racing.${artifact.kind}.observed.v1`, occurredAt: occurredAtFor(artifact), subjectRef, payload: artifact };
    case 'telemetry':
      return { ...base, sourceId: artifact.source.system, metric: artifact.kind, observedAt: occurredAtFor(artifact), value: measurementValueFor(artifact) };
    case 'audit':
      return { ...base, auditId: artifact.refs.auditIds[0] ?? artifact.artifactId, action: `racing.${artifact.kind}`, actorId: artifact.provenance.normalizedBy, occurredAt: occurredAtFor(artifact), evidenceRefs };
    case 'compliance':
      return { ...base, controlId: subjectIdFor(artifact), frameworkIds: frameworkIdsFor(artifact), status: statusFor(artifact), evidenceRefs };
    case 'feature':
      return { ...base, featureId: featureIdFor(artifact), domain: featureDomainFor(artifact), asOf: occurredAtFor(artifact), features: featuresFor(artifact) };
    case 'insight':
      return { ...base, insightId: subjectIdFor(artifact), summary: summaryFor(artifact), confidence: confidenceFor(artifact), evidenceRefs };
    default:
      return base;
  }
}

function stringProperty(artifact: RacingArtifact, key: string): string | undefined {
  const value = (artifact as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function subjectIdFor(artifact: RacingArtifact): string {
  const raceId = stringProperty(artifact, 'raceId');
  if (raceId) return raceId;
  const horseId = stringProperty(artifact, 'horseId');
  if (horseId) return horseId;
  const personId = stringProperty(artifact, 'personId');
  if (personId) return personId;
  const featureId = stringProperty(artifact, 'featureId');
  if (featureId) return featureId;
  const policyId = stringProperty(artifact, 'policyId');
  if (policyId) return policyId;
  const datasetId = stringProperty(artifact, 'datasetId');
  if (datasetId) return datasetId;
  return artifact.artifactId;
}

function subjectTypeFor(artifact: RacingArtifact): string {
  if (artifact.kind.includes('horse') || ('horseId' in artifact && artifact.kind !== 'race-entry')) return 'horse';
  if (artifact.kind.includes('person')) return 'person';
  if (artifact.kind.includes('race')) return 'race';
  if (artifact.kind.includes('surface')) return 'surface';
  if (artifact.kind.includes('policy')) return 'data-policy';
  return artifact.kind;
}

function occurredAtFor(artifact: RacingArtifact): string {
  if ('observedAt' in artifact) return artifact.observedAt;
  if ('workedAt' in artifact) return artifact.workedAt;
  if ('postedAt' in artifact) return artifact.postedAt;
  if ('generatedAt' in artifact) return artifact.generatedAt;
  if ('receivedAt' in artifact) return artifact.receivedAt;
  return artifact.provenance.capturedAt;
}

function statusFor(artifact: RacingArtifact): string {
  if ('status' in artifact && typeof artifact.status === 'string') return artifact.status;
  if ('identityStatus' in artifact) return artifact.identityStatus;
  if ('official' in artifact) return artifact.official ? 'official' : 'unofficial';
  return 'active';
}

function riskClassificationFor(artifact: RacingArtifact): 'informational' | 'operational' | 'safety-critical' {
  return artifact.privacyClassification === 'regulated' || artifact.kind === 'steward-ruling' ? 'safety-critical' : 'operational';
}

function measurementValueFor(artifact: RacingArtifact): RacingArtifactJsonValue {
  if ('timeSeconds' in artifact && typeof artifact.timeSeconds === 'number') return artifact.timeSeconds;
  if ('speedFigure' in artifact && typeof artifact.speedFigure === 'number') return artifact.speedFigure;
  if ('moisturePct' in artifact && typeof artifact.moisturePct === 'number') return artifact.moisturePct;
  return subjectIdFor(artifact);
}

function frameworkIdsFor(artifact: RacingArtifact): string[] {
  if ('ruleRefs' in artifact) return artifact.ruleRefs;
  if ('authority' in artifact) return [artifact.authority];
  if ('privacyRules' in artifact) return artifact.privacyRules.map((rule) => rule.classification);
  return artifact.refs.auditIds;
}

function featureIdFor(artifact: RacingArtifact): string {
  if ('featureId' in artifact) return artifact.featureId;
  if ('datasetId' in artifact) return artifact.datasetId;
  return artifact.artifactId;
}

function featureDomainFor(artifact: RacingArtifact): string {
  if ('domain' in artifact) return artifact.domain;
  return artifact.kind === 'training-dataset-manifest' ? 'training-dataset' : artifact.kind;
}

function featuresFor(artifact: RacingArtifact): Record<string, RacingArtifactJsonScalar> {
  if ('features' in artifact) return artifact.features;
  if ('artifactIds' in artifact) return { artifactCount: artifact.artifactIds.length, featureRecordCount: artifact.featureRecordIds.length, datasetVersion: artifact.datasetVersion };
  return { artifactKind: artifact.kind };
}

function summaryFor(artifact: RacingArtifact): string {
  if ('summary' in artifact) return artifact.summary;
  if ('blockingIssues' in artifact) return `${artifact.blockingIssues.length} blocking data quality issues`;
  return `${artifact.kind} insight`;
}

function confidenceFor(artifact: RacingArtifact): number {
  if ('confidence' in artifact) return artifact.confidence;
  if ('qualityScore' in artifact) return artifact.qualityScore;
  return artifact.provenance.confidence ?? 1;
}

function isPlainJsonObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
