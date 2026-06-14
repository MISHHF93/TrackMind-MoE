import { adaptFeatureRecordToFeatureArtifact, type AIFeatureArtifact } from './aiControlPlane.js';
import type { DataClassification } from './domainKernel.js';
import {
  buildFeatureStoreRecords,
  featureStoreSchemaVersion,
  type AnyFeatureRecord,
  type FeatureDomain,
} from './featureStore.js';
import { createUnifiedLineageContract, findStoresForTUSEntity, type UnifiedLineageContract } from './unifiedDataModel.js';
import {
  listUniversalArtifactStorageAdapters,
  routeUniversalArtifactToStores,
  type UniversalArtifactDescriptor,
  type UniversalArtifactPrivacyFlags,
  type UniversalArtifactStorageTarget,
} from './universalArtifactStorage.js';

export const racingDataApiHubSchemaVersion = 'trackmind.racing-data-api-hub.v1' as const;
type UniversalStorageArtifactDescriptor = UniversalArtifactDescriptor;

export const racingDataConnectionTypes = ['rest', 'graphql', 'sftp', 'file-drop', 'stream', 'webhook', 'manual-upload', 'sdk', 'database-replica'] as const;
export type RacingDataConnectionType = typeof racingDataConnectionTypes[number];

export const racingDataSyncModes = ['pull', 'push', 'batch', 'streaming', 'manual', 'bidirectional'] as const;
export type RacingDataSyncMode = typeof racingDataSyncModes[number];

export const racingDataLicenseStatuses = ['unknown', 'evaluation', 'active', 'restricted', 'expired', 'suspended', 'revoked'] as const;
export type RacingDataLicenseStatus = typeof racingDataLicenseStatuses[number];

export const racingDataClasses = [
  'race-card',
  'entries',
  'results',
  'scratches',
  'workouts',
  'form',
  'odds',
  'pools',
  'horse-profile',
  'participant-profile',
  'track-condition',
  'weather',
  'steward-decisions',
  'veterinary',
  'compliance',
  'media',
  'analytics',
  'other',
] as const;
export type RacingDataClass = typeof racingDataClasses[number];

export const racingDataUsageScopes = ['internal-operations', 'race-day-operations', 'analytics', 'ai-training', 'fan-experience', 'wagering-support', 'compliance-reporting', 'federation-exchange', 'commercial-product', 'research'] as const;
export type RacingDataUsageScope = typeof racingDataUsageScopes[number];

export const providerOperationalStatuses = ['unconfigured', 'configured', 'healthy', 'degraded', 'rate-limited', 'auth-required', 'suspended', 'offline'] as const;
export type ProviderOperationalStatus = typeof providerOperationalStatuses[number];

export const ingestionJobStatuses = ['queued', 'running', 'completed', 'completed-with-errors', 'failed', 'cancelled'] as const;
export type IngestionJobStatus = typeof ingestionJobStatuses[number];

export const normalizationMappingStatuses = ['draft', 'active', 'deprecated', 'retired'] as const;
export type NormalizationMappingStatus = typeof normalizationMappingStatuses[number];

export interface RacingDataTenantMetadata {
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
  jurisdiction: string;
  dataBoundary?: 'tenant' | 'racetrack' | 'federated' | 'external';
}

export interface RacingDataRetentionPolicy {
  policyId: string;
  retentionDays: number;
  legalBasis: string;
  purgeAfter?: string;
}

export interface RacingDataLineageMetadata {
  sourceSystem: string;
  sourceRefs: string[];
  ingestionJobId?: string;
  rawPayloadRefs?: string[];
  normalizedFromRefs?: string[];
  correlationId: string;
  causationIds: string[];
}

export interface RacingDataLicenseMetadata {
  licenseStatus: RacingDataLicenseStatus;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  requiresAttribution: boolean;
  piiPresent: boolean;
  dataClasses: RacingDataClass[];
  usageScope: RacingDataUsageScope[];
  retention: RacingDataRetentionPolicy;
  termsRef?: string;
  attributionText?: string;
  effectiveFrom?: string;
  expiresAt?: string;
  evidenceRefs: string[];
}

export interface ProviderConfig {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  providerId: string;
  displayName: string;
  enabled: boolean;
  tenant: RacingDataTenantMetadata;
  jurisdiction: string;
  connectionType: RacingDataConnectionType;
  syncMode: RacingDataSyncMode;
  refreshInterval?: string;
  endpointRefs: string[];
  credentialsRef?: string;
  dataClasses: RacingDataClass[];
  usageScope: RacingDataUsageScope[];
  license: RacingDataLicenseMetadata;
  lineage: RacingDataLineageMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
  tags?: string[];
  extensions?: Record<string, unknown>;
}

export interface ProviderStatus {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  providerId: string;
  tenant: RacingDataTenantMetadata;
  status: ProviderOperationalStatus;
  connectionType: RacingDataConnectionType;
  syncMode: RacingDataSyncMode;
  refreshInterval?: string;
  lastCheckedAt: string;
  lastSuccessfulSyncAt?: string;
  nextSyncAt?: string;
  health: { latencyMs?: number; errorRate?: number; rateLimitRemaining?: number; messages: string[] };
  licenseStatus: RacingDataLicenseStatus;
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  requiresAttribution: boolean;
  piiPresent: boolean;
  dataClasses: RacingDataClass[];
  usageScope: RacingDataUsageScope[];
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface RawProviderPayload<TPayload = unknown> {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  payloadId: string;
  providerId: string;
  ingestionJobId: string;
  tenant: RacingDataTenantMetadata;
  receivedAt: string;
  connectionType: RacingDataConnectionType;
  syncMode: RacingDataSyncMode;
  contentType: string;
  raw: TPayload;
  license: RacingDataLicenseMetadata;
  piiPresent: boolean;
  dataClasses: RacingDataClass[];
  lineage: RacingDataLineageMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface IngestionJob {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  jobId: string;
  providerId: string;
  tenant: RacingDataTenantMetadata;
  status: IngestionJobStatus;
  connectionType: RacingDataConnectionType;
  syncMode: RacingDataSyncMode;
  refreshInterval?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  dataClasses: RacingDataClass[];
  usageScope: RacingDataUsageScope[];
  licenseSnapshot: RacingDataLicenseMetadata;
  cursor?: string;
  counts: { received: number; normalized: number; rejected: number };
  rawPayloadRefs: string[];
  canonicalEnvelopeRefs: string[];
  errors: Array<{ code: string; message: string; evidenceRefs: string[] }>;
  lineage: RacingDataLineageMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface ProviderConnectorDescriptor {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  connectorId: string;
  title: string;
  description: string;
  providerAgnostic: true;
  hardCodedProviderBehaviorAllowed: false;
  supportedConnectionTypes: RacingDataConnectionType[];
  supportedSyncModes: RacingDataSyncMode[];
  supportedDataClasses: RacingDataClass[];
  credentialRequirements: Array<{ name: string; required: boolean; secret: boolean }>;
  healthCheck: { supported: boolean; interval?: string; auditAction: string };
  emits: string[];
  audits: string[];
  evidenceRefs: string[];
}

export interface NormalizationMapping {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  mappingId: string;
  providerId: string;
  tenant: RacingDataTenantMetadata;
  status: NormalizationMappingStatus;
  sourceSchemaRef: string;
  targetSchemaVersion: typeof racingDataApiHubSchemaVersion;
  dataClass: RacingDataClass;
  fieldMappings: Array<{ sourcePath: string; targetPath: string; required: boolean; transformRef?: string; dataClass?: RacingDataClass }>;
  qualityRules: Array<{ ruleId: string; path: string; severity: 'info' | 'warning' | 'error'; description: string }>;
  piiPaths: string[];
  license: RacingDataLicenseMetadata;
  lineage: RacingDataLineageMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface CanonicalRacingDataEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  envelopeId: string;
  providerId: string;
  tenant: RacingDataTenantMetadata;
  jurisdiction: string;
  canonicalDataClass: RacingDataClass;
  dataClasses: RacingDataClass[];
  receivedAt: string;
  normalizedAt: string;
  payload: TPayload;
  sourcePayloadRefs: string[];
  license: RacingDataLicenseMetadata;
  usageScope: RacingDataUsageScope[];
  retention: RacingDataRetentionPolicy;
  piiPresent: boolean;
  lineage: RacingDataLineageMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface RacingDataApiHubServiceMetadata {
  schemaVersion: typeof racingDataApiHubSchemaVersion;
  serviceId: 'racing-data-api-hub';
  displayName: 'Racing Data API Hub';
  generatedAt: string;
  providerAgnostic: true;
  hardCodedProviderBehaviorAllowed: false;
  dtoNames: Array<'ProviderConfig' | 'ProviderStatus' | 'RawProviderPayload' | 'IngestionJob' | 'ProviderConnectorDescriptor' | 'NormalizationMapping' | 'CanonicalRacingDataEnvelope' | 'RacingDataApiHubServiceMetadata'>;
  supportedConnectionTypes: RacingDataConnectionType[];
  supportedSyncModes: RacingDataSyncMode[];
  supportedDataClasses: RacingDataClass[];
  supportedUsageScopes: RacingDataUsageScope[];
  governance: {
    licenseStatusRequired: true;
    commercialUseGoverned: true;
    redistributionGoverned: true;
    attributionCompatibilityFields: ['attributionRequired', 'requiresAttribution'];
    piiFlagRequired: true;
    tenantAndRacetrackScoped: true;
    lineageRequired: true;
    evidenceAuditEventRefsRequired: true;
  };
}

type HubFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';
interface HubValidationRule { path: string; required?: boolean; type?: HubFieldType; values?: readonly string[]; min?: number }
export interface RacingDataApiHubValidationResult { valid: boolean; errors: string[] }

const baseRules: readonly HubValidationRule[] = [
  { path: 'schemaVersion', required: true, type: 'string', values: [racingDataApiHubSchemaVersion] },
  { path: 'providerId', required: true, type: 'string' },
  { path: 'tenant', required: true, type: 'object' },
  { path: 'tenant.tenantId', required: true, type: 'string' },
  { path: 'tenant.racetrackId', required: true, type: 'string' },
  { path: 'tenant.jurisdiction', required: true, type: 'string' },
  { path: 'connectionType', required: true, type: 'string', values: racingDataConnectionTypes },
  { path: 'syncMode', required: true, type: 'string', values: racingDataSyncModes },
  { path: 'dataClasses', required: true, type: 'array' },
  { path: 'evidenceRefs', required: true, type: 'array' },
  { path: 'auditRefs', required: true, type: 'array' },
  { path: 'eventRefs', required: true, type: 'array' },
];

export const racingDataApiHubContractSchemas = {
  ProviderConfig: [...baseRules, { path: 'displayName', required: true, type: 'string' }, { path: 'enabled', required: true, type: 'boolean' }, { path: 'jurisdiction', required: true, type: 'string' }, { path: 'endpointRefs', required: true, type: 'array' }, { path: 'usageScope', required: true, type: 'array' }, { path: 'license', required: true, type: 'object' }, { path: 'lineage', required: true, type: 'object' }],
  ProviderStatus: [...baseRules, { path: 'status', required: true, type: 'string', values: providerOperationalStatuses }, { path: 'lastCheckedAt', required: true, type: 'string' }, { path: 'health', required: true, type: 'object' }, { path: 'health.messages', required: true, type: 'array' }, { path: 'licenseStatus', required: true, type: 'string', values: racingDataLicenseStatuses }, { path: 'commercialUseAllowed', required: true, type: 'boolean' }, { path: 'redistributionAllowed', required: true, type: 'boolean' }, { path: 'attributionRequired', required: true, type: 'boolean' }, { path: 'requiresAttribution', required: true, type: 'boolean' }, { path: 'piiPresent', required: true, type: 'boolean' }, { path: 'usageScope', required: true, type: 'array' }],
  RawProviderPayload: [...baseRules, { path: 'payloadId', required: true, type: 'string' }, { path: 'ingestionJobId', required: true, type: 'string' }, { path: 'receivedAt', required: true, type: 'string' }, { path: 'contentType', required: true, type: 'string' }, { path: 'raw', required: true }, { path: 'license', required: true, type: 'object' }, { path: 'piiPresent', required: true, type: 'boolean' }, { path: 'lineage', required: true, type: 'object' }],
  IngestionJob: [...baseRules, { path: 'jobId', required: true, type: 'string' }, { path: 'status', required: true, type: 'string', values: ingestionJobStatuses }, { path: 'requestedAt', required: true, type: 'string' }, { path: 'usageScope', required: true, type: 'array' }, { path: 'licenseSnapshot', required: true, type: 'object' }, { path: 'counts', required: true, type: 'object' }, { path: 'counts.received', required: true, type: 'number', min: 0 }, { path: 'counts.normalized', required: true, type: 'number', min: 0 }, { path: 'counts.rejected', required: true, type: 'number', min: 0 }, { path: 'rawPayloadRefs', required: true, type: 'array' }, { path: 'canonicalEnvelopeRefs', required: true, type: 'array' }, { path: 'errors', required: true, type: 'array' }, { path: 'lineage', required: true, type: 'object' }],
  ProviderConnectorDescriptor: [{ path: 'schemaVersion', required: true, type: 'string', values: [racingDataApiHubSchemaVersion] }, { path: 'connectorId', required: true, type: 'string' }, { path: 'title', required: true, type: 'string' }, { path: 'description', required: true, type: 'string' }, { path: 'providerAgnostic', required: true, type: 'boolean' }, { path: 'hardCodedProviderBehaviorAllowed', required: true, type: 'boolean' }, { path: 'supportedConnectionTypes', required: true, type: 'array' }, { path: 'supportedSyncModes', required: true, type: 'array' }, { path: 'supportedDataClasses', required: true, type: 'array' }, { path: 'credentialRequirements', required: true, type: 'array' }, { path: 'healthCheck', required: true, type: 'object' }, { path: 'emits', required: true, type: 'array' }, { path: 'audits', required: true, type: 'array' }, { path: 'evidenceRefs', required: true, type: 'array' }],
  NormalizationMapping: [{ path: 'schemaVersion', required: true, type: 'string', values: [racingDataApiHubSchemaVersion] }, { path: 'mappingId', required: true, type: 'string' }, { path: 'providerId', required: true, type: 'string' }, { path: 'tenant', required: true, type: 'object' }, { path: 'status', required: true, type: 'string', values: normalizationMappingStatuses }, { path: 'sourceSchemaRef', required: true, type: 'string' }, { path: 'targetSchemaVersion', required: true, type: 'string', values: [racingDataApiHubSchemaVersion] }, { path: 'dataClass', required: true, type: 'string', values: racingDataClasses }, { path: 'fieldMappings', required: true, type: 'array' }, { path: 'qualityRules', required: true, type: 'array' }, { path: 'piiPaths', required: true, type: 'array' }, { path: 'license', required: true, type: 'object' }, { path: 'lineage', required: true, type: 'object' }, { path: 'evidenceRefs', required: true, type: 'array' }, { path: 'auditRefs', required: true, type: 'array' }, { path: 'eventRefs', required: true, type: 'array' }],
  CanonicalRacingDataEnvelope: [{ path: 'schemaVersion', required: true, type: 'string', values: [racingDataApiHubSchemaVersion] }, { path: 'envelopeId', required: true, type: 'string' }, { path: 'providerId', required: true, type: 'string' }, { path: 'tenant', required: true, type: 'object' }, { path: 'jurisdiction', required: true, type: 'string' }, { path: 'canonicalDataClass', required: true, type: 'string', values: racingDataClasses }, { path: 'dataClasses', required: true, type: 'array' }, { path: 'receivedAt', required: true, type: 'string' }, { path: 'normalizedAt', required: true, type: 'string' }, { path: 'payload', required: true, type: 'object' }, { path: 'sourcePayloadRefs', required: true, type: 'array' }, { path: 'license', required: true, type: 'object' }, { path: 'usageScope', required: true, type: 'array' }, { path: 'retention', required: true, type: 'object' }, { path: 'piiPresent', required: true, type: 'boolean' }, { path: 'lineage', required: true, type: 'object' }, { path: 'evidenceRefs', required: true, type: 'array' }, { path: 'auditRefs', required: true, type: 'array' }, { path: 'eventRefs', required: true, type: 'array' }],
} as const satisfies Record<string, readonly HubValidationRule[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function get(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, value);
}

function matchesType(value: unknown, type: HubFieldType): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function validateRules(name: string, value: unknown, rules: readonly HubValidationRule[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const field = get(value, rule.path);
    if (rule.required && (field === undefined || field === null || field === '')) errors.push(`${name}.${rule.path} is required`);
    if (field !== undefined && rule.type && !matchesType(field, rule.type)) errors.push(`${name}.${rule.path} must be ${rule.type}`);
    if (rule.values && field !== undefined && !rule.values.includes(String(field))) errors.push(`${name}.${rule.path} must be one of ${rule.values.join(',')}`);
    if (typeof field === 'number' && rule.min !== undefined && field < rule.min) errors.push(`${name}.${rule.path} must be >= ${rule.min}`);
  }
  return errors;
}

function validateStringArray(name: string, value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [`${name} must be array`];
  return value.flatMap((item, index) => {
    if (typeof item !== 'string') return [`${name}[${index}] must be string`];
    if (allowed && !allowed.includes(item)) return [`${name}[${index}] must be one of ${allowed.join(',')}`];
    return [];
  });
}

function validateTenant(name: string, tenant: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(tenant)) return [`${name}.tenant must be object`];
  if (tenant.dataBoundary !== undefined && !['tenant', 'racetrack', 'federated', 'external'].includes(String(tenant.dataBoundary))) errors.push(`${name}.tenant.dataBoundary must be tenant, racetrack, federated, or external`);
  return errors;
}

export function validateRacingDataLicenseMetadata(license: unknown): RacingDataApiHubValidationResult {
  const errors = validateRules('RacingDataLicenseMetadata', license, [
    { path: 'licenseStatus', required: true, type: 'string', values: racingDataLicenseStatuses },
    { path: 'commercialUseAllowed', required: true, type: 'boolean' },
    { path: 'redistributionAllowed', required: true, type: 'boolean' },
    { path: 'attributionRequired', required: true, type: 'boolean' },
    { path: 'requiresAttribution', required: true, type: 'boolean' },
    { path: 'piiPresent', required: true, type: 'boolean' },
    { path: 'dataClasses', required: true, type: 'array' },
    { path: 'usageScope', required: true, type: 'array' },
    { path: 'retention', required: true, type: 'object' },
    { path: 'retention.policyId', required: true, type: 'string' },
    { path: 'retention.retentionDays', required: true, type: 'number', min: 0 },
    { path: 'retention.legalBasis', required: true, type: 'string' },
    { path: 'evidenceRefs', required: true, type: 'array' },
  ]);
  if (isRecord(license)) {
    if (license.attributionRequired !== license.requiresAttribution) errors.push('RacingDataLicenseMetadata attributionRequired and requiresAttribution must match');
    if (Array.isArray(license.dataClasses)) errors.push(...validateStringArray('RacingDataLicenseMetadata.dataClasses', license.dataClasses, racingDataClasses));
    if (Array.isArray(license.usageScope)) errors.push(...validateStringArray('RacingDataLicenseMetadata.usageScope', license.usageScope, racingDataUsageScopes));
    if (license.commercialUseAllowed && Array.isArray(license.usageScope) && !license.usageScope.includes('commercial-product')) errors.push('RacingDataLicenseMetadata commercialUseAllowed requires commercial-product usage scope');
  }
  return { valid: errors.length === 0, errors };
}

export function validateRacingDataApiHubContract(name: keyof typeof racingDataApiHubContractSchemas, value: unknown): RacingDataApiHubValidationResult {
  const errors = validateRules(name, value, racingDataApiHubContractSchemas[name]);
  if (isRecord(value)) {
    if ('tenant' in value) errors.push(...validateTenant(name, value.tenant));
    if (Array.isArray(value.dataClasses)) errors.push(...validateStringArray(`${name}.dataClasses`, value.dataClasses, racingDataClasses));
    if (Array.isArray(value.usageScope)) errors.push(...validateStringArray(`${name}.usageScope`, value.usageScope, racingDataUsageScopes));
    if ('license' in value) errors.push(...validateRacingDataLicenseMetadata(value.license).errors);
    if ('licenseSnapshot' in value) errors.push(...validateRacingDataLicenseMetadata(value.licenseSnapshot).errors.map((error) => error.replace('RacingDataLicenseMetadata', `${name}.licenseSnapshot`)));
    if (value.attributionRequired !== undefined && value.requiresAttribution !== undefined && value.attributionRequired !== value.requiresAttribution) errors.push(`${name} attributionRequired and requiresAttribution must match`);
    if (name === 'ProviderConnectorDescriptor') {
      if (value.providerAgnostic !== true) errors.push('ProviderConnectorDescriptor.providerAgnostic must be true');
      if (value.hardCodedProviderBehaviorAllowed !== false) errors.push('ProviderConnectorDescriptor.hardCodedProviderBehaviorAllowed must be false');
      if (Array.isArray(value.supportedConnectionTypes)) errors.push(...validateStringArray('ProviderConnectorDescriptor.supportedConnectionTypes', value.supportedConnectionTypes, racingDataConnectionTypes));
      if (Array.isArray(value.supportedSyncModes)) errors.push(...validateStringArray('ProviderConnectorDescriptor.supportedSyncModes', value.supportedSyncModes, racingDataSyncModes));
      if (Array.isArray(value.supportedDataClasses)) errors.push(...validateStringArray('ProviderConnectorDescriptor.supportedDataClasses', value.supportedDataClasses, racingDataClasses));
    }
  }
  return { valid: errors.length === 0, errors };
}

export function createRacingDataApiHubServiceMetadata(generatedAt = new Date().toISOString()): RacingDataApiHubServiceMetadata {
  return {
    schemaVersion: racingDataApiHubSchemaVersion,
    serviceId: 'racing-data-api-hub',
    displayName: 'Racing Data API Hub',
    generatedAt,
    providerAgnostic: true,
    hardCodedProviderBehaviorAllowed: false,
    dtoNames: ['ProviderConfig', 'ProviderStatus', 'RawProviderPayload', 'IngestionJob', 'ProviderConnectorDescriptor', 'NormalizationMapping', 'CanonicalRacingDataEnvelope', 'RacingDataApiHubServiceMetadata'],
    supportedConnectionTypes: [...racingDataConnectionTypes],
    supportedSyncModes: [...racingDataSyncModes],
    supportedDataClasses: [...racingDataClasses],
    supportedUsageScopes: [...racingDataUsageScopes],
    governance: {
      licenseStatusRequired: true,
      commercialUseGoverned: true,
      redistributionGoverned: true,
      attributionCompatibilityFields: ['attributionRequired', 'requiresAttribution'],
      piiFlagRequired: true,
      tenantAndRacetrackScoped: true,
      lineageRequired: true,
      evidenceAuditEventRefsRequired: true,
    },
  };
}

export const racingDataApiHubExportSchemaVersion = 'trackmind.racing-data-api-hub.exports.v1' as const;
export const trainingDatasetManifestSchemaVersion = 'trackmind.training-dataset-manifest.v1' as const;

export const apiHubExportAllowedUses = ['feature-export', 'data-lake-export', 'model-training'] as const;
export type ApiHubExportAllowedUse = typeof apiHubExportAllowedUses[number];
export type ApiHubExportStatus = 'ready' | 'blocked';

export interface ApiHubExportScope {
  tenantId?: string;
  racetrackId?: string;
  jurisdiction?: string;
  generatedAt?: string;
  correlationId?: string;
  causationIds?: string[];
}

export interface ApiHubAllowedUseDecision {
  allowed: boolean;
  requestedUse: ApiHubExportAllowedUse;
  sourceArtifactIds: string[];
  blockedReasons: string[];
  licenseRestrictions: string[];
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface ApiHubStorageTargetDescriptor {
  targetStoreId: string;
  storeKind: string;
  readOnly: true;
  adapterMode: 'metadata-only';
  cloudUploadImplemented: false;
  partitionKey: string;
  partitionKeys: string[];
  partitionTemplate: string;
  targetPathTemplate: string;
  privacyClassification: DataClassification;
  retentionPolicyId: string;
  lineageEventRefs: string[];
  lineageAuditRefs: string[];
}

export interface FeatureStoreExportManifest {
  schemaVersion: typeof racingDataApiHubExportSchemaVersion;
  manifestId: string;
  exportType: 'feature-store';
  status: ApiHubExportStatus;
  requestedUse: 'feature-export';
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  featureSetId: string;
  featureRecords: AnyFeatureRecord[];
  featureArtifacts: AIFeatureArtifact[];
  storageTargets: UniversalArtifactStorageTarget[];
  storageTargetDescriptors: ApiHubStorageTargetDescriptor[];
  partitionKeys: string[];
  privacy: UniversalArtifactPrivacyFlags;
  licenseRestrictions: string[];
  allowedUseDecision: ApiHubAllowedUseDecision;
  lineage: UnifiedLineageContract;
  auditRefs: string[];
  eventRefs: string[];
  noCloudUpload: true;
}

export interface TrainingDatasetSourceArtifact {
  artifactId: string;
  providerId: string;
  canonicalDataClass: RacingDataClass;
  sourcePayloadRefs: string[];
  licenseStatus: RacingDataLicenseStatus;
  usageScope: RacingDataUsageScope[];
  restrictions: string[];
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}

export interface TrainingDatasetManifestArtifact {
  schemaVersion: typeof trainingDatasetManifestSchemaVersion;
  manifestId: string;
  artifactType: 'TrainingDatasetManifest';
  status: ApiHubExportStatus;
  datasetId: string;
  featureSetId: string;
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  intendedUse: 'model-training';
  trainingAllowed: boolean;
  sourceArtifacts: TrainingDatasetSourceArtifact[];
  featureRecordIds: string[];
  timeRange: { start: string; end: string };
  privacy: UniversalArtifactPrivacyFlags;
  licenseRestrictions: string[];
  blockedReasons: string[];
  storageTargets: UniversalArtifactStorageTarget[];
  storageTargetDescriptors: ApiHubStorageTargetDescriptor[];
  partitionKeys: string[];
  lineage: UnifiedLineageContract;
  auditRefs: string[];
  eventRefs: string[];
  noCloudUpload: true;
}

export interface DataLakeExportManifest {
  schemaVersion: typeof racingDataApiHubExportSchemaVersion;
  manifestId: string;
  exportType: 'data-lake';
  status: ApiHubExportStatus;
  requestedUse: 'data-lake-export';
  generatedAt: string;
  tenantId: string;
  racetrackId: string;
  artifactIds: string[];
  storageTargets: UniversalArtifactStorageTarget[];
  storageTargetDescriptors: ApiHubStorageTargetDescriptor[];
  partitionKeys: string[];
  privacy: UniversalArtifactPrivacyFlags;
  licenseRestrictions: string[];
  allowedUseDecision: ApiHubAllowedUseDecision;
  lineage: UnifiedLineageContract;
  auditRefs: string[];
  eventRefs: string[];
  noCloudUpload: true;
}

export interface ApiHubExportInput {
  scope?: Partial<ApiHubExportScope>;
  sourceArtifacts?: CanonicalRacingDataEnvelope[];
  featureRecords?: AnyFeatureRecord[];
  featureSetId?: string;
}

const defaultExportScope: Required<ApiHubExportScope> = {
  tenantId: 'tenant-001',
  racetrackId: 'track-main',
  jurisdiction: 'NY',
  generatedAt: '2026-06-14T12:00:00.000Z',
  correlationId: 'corr-api-hub-export',
  causationIds: ['api-hub-worker-10'],
};

const usageScopesByAllowedUse: Record<ApiHubExportAllowedUse, RacingDataUsageScope[]> = {
  'feature-export': ['internal-operations', 'race-day-operations', 'analytics', 'ai-training'],
  'data-lake-export': ['internal-operations', 'analytics', 'compliance-reporting', 'ai-training'],
  'model-training': ['ai-training'],
};

const classificationRank: Record<DataClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
  regulated: 4,
};

export function createCanonicalApiHubSourceArtifacts(scope: Partial<ApiHubExportScope> = {}): CanonicalRacingDataEnvelope[] {
  const normalizedScope = normalizeExportScope(scope);
  const tenant = tenantMetadata(normalizedScope);
  const activeLicense = licenseMetadata({
    status: 'active',
    dataClasses: ['track-condition', 'weather', 'analytics'],
    usageScope: ['internal-operations', 'race-day-operations', 'analytics', 'ai-training'],
    piiPresent: false,
    evidenceRefs: ['license:trackmind-canonical-racing-data'],
  });
  const restrictedLicense = licenseMetadata({
    status: 'restricted',
    dataClasses: ['entries', 'track-condition', 'analytics'],
    usageScope: ['internal-operations', 'race-day-operations', 'analytics', 'ai-training'],
    piiPresent: false,
    termsRef: 'terms://racing-data-api-hub/attribution-only',
    attributionRequired: true,
    evidenceRefs: ['license:restricted-gate-readiness-feed'],
  });

  return [
    canonicalEnvelope({
      envelopeId: 'artifact:canonical:surface:far-turn',
      providerId: 'provider:trackmind-canonical',
      tenant,
      generatedAt: normalizedScope.generatedAt,
      correlationId: normalizedScope.correlationId,
      causationIds: normalizedScope.causationIds,
      canonicalDataClass: 'track-condition',
      dataClasses: ['track-condition', 'analytics'],
      payload: {
        trackId: normalizedScope.racetrackId,
        sectionId: 'far-turn',
        observedAt: '2026-06-14T11:30:00.000Z',
        surfaceType: 'dirt',
        moisturePct: 27,
        compactionPsi: 276,
        cushionDepthInches: 2.8,
        drainageRateMmPerHour: 6,
        temperatureF: 83,
        rainfallMm: 5,
        maintenanceCompletedAt: '2026-06-14T08:00:00.000Z',
      },
      sourcePayloadRefs: ['raw:surface:far-turn:2026-06-14T1130Z'],
      license: activeLicense,
      evidenceRefs: ['surface-telemetry:far-turn', 'surface-inspection:far-turn'],
      auditRefs: ['audit:api-hub:surface:far-turn'],
      eventRefs: ['event:surface.measurement.recorded.v1'],
    }),
    canonicalEnvelope({
      envelopeId: 'artifact:canonical:weather:race-7',
      providerId: 'provider:trackmind-weather',
      tenant,
      generatedAt: normalizedScope.generatedAt,
      correlationId: normalizedScope.correlationId,
      causationIds: normalizedScope.causationIds,
      canonicalDataClass: 'weather',
      dataClasses: ['weather', 'analytics'],
      payload: {
        trackId: normalizedScope.racetrackId,
        observedAt: '2026-06-14T11:45:00.000Z',
        rainfallMm: 5,
        windMph: 14,
        lightningMiles: 18,
        humidityPct: 74,
        forecastRainMm: 12,
        forecastConfidence: 0.8,
      },
      sourcePayloadRefs: ['raw:weather:race-7:2026-06-14T1145Z'],
      license: activeLicense,
      evidenceRefs: ['weather-observation:main-track', 'weather-forecast:race-7'],
      auditRefs: ['audit:api-hub:weather:race-7'],
      eventRefs: ['event:weather.observation.ingested.v1'],
    }),
    canonicalEnvelope({
      envelopeId: 'artifact:canonical:gate-readiness:race-7',
      providerId: 'provider:restricted-gate-readiness',
      tenant,
      generatedAt: normalizedScope.generatedAt,
      correlationId: normalizedScope.correlationId,
      causationIds: normalizedScope.causationIds,
      canonicalDataClass: 'analytics',
      dataClasses: ['track-condition', 'analytics'],
      payload: {
        gateId: 'gate-main',
        raceId: 'race-7',
        observedAt: '2026-06-14T11:50:00.000Z',
        currentMetersFromStart: 1200,
        targetMetersFromStart: 1300,
        gpsAccuracyMeters: 8,
        gpsVerified: true,
        inspectionAt: '2026-06-14T10:00:00.000Z',
        crewAvailablePct: 75,
        weatherRisk: 0.4,
      },
      sourcePayloadRefs: ['raw:gate-readiness:race-7:2026-06-14T1150Z'],
      license: restrictedLicense,
      evidenceRefs: ['gate-position:race-7', 'gps-verification:gate-main', 'license:restricted-gate-readiness-feed'],
      auditRefs: ['audit:api-hub:gate-readiness:race-7'],
      eventRefs: ['event:gate.readiness.recorded.v1'],
    }),
  ];
}

export function createLicenseRestrictedSourceArtifact(scope: Partial<ApiHubExportScope> = {}): CanonicalRacingDataEnvelope {
  const normalizedScope = normalizeExportScope(scope);
  return canonicalEnvelope({
    envelopeId: 'artifact:canonical:vendor-sectional-times:race-7',
    providerId: 'provider:unlicensed-sectional-times',
    tenant: tenantMetadata(normalizedScope),
    generatedAt: normalizedScope.generatedAt,
    correlationId: normalizedScope.correlationId,
    causationIds: normalizedScope.causationIds,
    canonicalDataClass: 'analytics',
    dataClasses: ['analytics', 'form'],
    payload: {
      raceId: 'race-7',
      source: 'restricted-vendor-sectional-times',
      note: 'License intentionally excludes model training.',
    },
    sourcePayloadRefs: ['raw:vendor-sectional-times:race-7'],
    license: licenseMetadata({
      status: 'restricted',
      dataClasses: ['analytics', 'form'],
      usageScope: ['internal-operations', 'analytics'],
      piiPresent: false,
      termsRef: 'terms://vendor-sectional-times/no-ai-training',
      evidenceRefs: ['license:vendor-sectional-times:no-ai-training'],
    }),
    evidenceRefs: ['vendor-sectional-times:race-7', 'license:vendor-sectional-times:no-ai-training'],
    auditRefs: ['audit:api-hub:vendor-sectional-times:race-7'],
    eventRefs: ['event:vendor.sectional-times.ingested.v1'],
  });
}

export function buildCanonicalApiHubFeatureRecords(input: ApiHubExportInput = {}): AnyFeatureRecord[] {
  const scope = normalizeExportScope(input.scope);
  const sourceArtifacts = input.sourceArtifacts ?? createCanonicalApiHubSourceArtifacts(scope);
  const byClass = new Map(sourceArtifacts.map((artifact) => [artifact.canonicalDataClass, artifact]));
  const surface = byClass.get('track-condition');
  const weather = byClass.get('weather');
  const gate = sourceArtifacts.find((artifact) => artifact.envelopeId.includes('gate-readiness'));
  const surfacePayload = (surface?.payload ?? {}) as Record<string, unknown>;
  const weatherPayload = (weather?.payload ?? {}) as Record<string, unknown>;
  const gatePayload = (gate?.payload ?? {}) as Record<string, unknown>;

  const records = buildFeatureStoreRecords({
    surfaces: [{
      metadata: featureMetadata(scope, 'surface', 'far-turn', 'surface-section:far-turn', 'api-hub-canonical-surface'),
      observedAt: stringValue(surfacePayload.observedAt, '2026-06-14T11:30:00.000Z'),
      surfaceType: surfacePayload.surfaceType === 'turf' || surfacePayload.surfaceType === 'synthetic' ? surfacePayload.surfaceType : 'dirt',
      moisturePct: numberValue(surfacePayload.moisturePct, 27),
      compactionPsi: numberValue(surfacePayload.compactionPsi, 276),
      cushionDepthInches: numberValue(surfacePayload.cushionDepthInches, 2.8),
      drainageRateMmPerHour: numberValue(surfacePayload.drainageRateMmPerHour, 6),
      temperatureF: numberValue(surfacePayload.temperatureF, 83),
      rainfallMm: numberValue(surfacePayload.rainfallMm, 5),
      forecastRainMm: numberValue(weatherPayload.forecastRainMm, 12),
      maintenanceCompletedAt: stringValue(surfacePayload.maintenanceCompletedAt, '2026-06-14T08:00:00.000Z'),
      evidence: unique([...(surface?.evidenceRefs ?? []), ...(surface?.sourcePayloadRefs ?? [])]),
    }],
    weather: [{
      metadata: featureMetadata(scope, 'weather', 'weather-feed-main', 'weather:race-7', 'api-hub-canonical-weather'),
      observedAt: stringValue(weatherPayload.observedAt, '2026-06-14T11:45:00.000Z'),
      rainfallMm: numberValue(weatherPayload.rainfallMm, 5),
      windMph: numberValue(weatherPayload.windMph, 14),
      lightningMiles: numberValue(weatherPayload.lightningMiles, 18),
      humidityPct: numberValue(weatherPayload.humidityPct, 74),
      forecastRainMm: numberValue(weatherPayload.forecastRainMm, 12),
      forecastConfidence: numberValue(weatherPayload.forecastConfidence, 0.8),
      evidence: unique([...(weather?.evidenceRefs ?? []), ...(weather?.sourcePayloadRefs ?? [])]),
    }],
    gates: [{
      metadata: featureMetadata(scope, 'gate', 'gate-main', 'race-7', 'api-hub-canonical-gate-readiness'),
      observedAt: stringValue(gatePayload.observedAt, '2026-06-14T11:50:00.000Z'),
      currentMetersFromStart: numberValue(gatePayload.currentMetersFromStart, 1200),
      targetMetersFromStart: numberValue(gatePayload.targetMetersFromStart, 1300),
      gpsAccuracyMeters: numberValue(gatePayload.gpsAccuracyMeters, 8),
      gpsVerified: Boolean(gatePayload.gpsVerified ?? true),
      inspectionAt: stringValue(gatePayload.inspectionAt, '2026-06-14T10:00:00.000Z'),
      crewAvailablePct: numberValue(gatePayload.crewAvailablePct, 75),
      weatherRisk: numberValue(gatePayload.weatherRisk, 0.4),
      evidence: unique([...(gate?.evidenceRefs ?? []), ...(gate?.sourcePayloadRefs ?? [])]),
    }],
  });

  const surfaceReadiness = readinessScore(records, 'surface', 'surfaceReadiness');
  const gateReadiness = readinessScore(records, 'gate', 'gateReadiness');
  const weatherReadiness = readinessScore(records, 'weather', 'weatherReadiness');
  return [
    ...records,
    ...buildFeatureStoreRecords({
      races: [{
        metadata: featureMetadata(scope, 'race', 'race-7', 'race-7', 'api-hub-canonical-race-readiness'),
        observedAt: '2026-06-14T11:55:00.000Z',
        distanceMeters: 1300,
        entries: 8,
        scratches: 1,
        postTime: '2026-06-14T12:20:00.000Z',
        surfaceReadiness,
        gateReadiness,
        vetReadiness: 0.95,
        stewardReadiness: 0.9,
        emergencyReadiness: 0.85,
        securityReadiness: 0.8,
        weatherReadiness,
        evidence: ['race-office:race-7', 'readiness-checks:race-7', ...records.map((record) => record.id)],
      }],
    }),
  ];
}

export function createFeatureStoreExportManifest(input: ApiHubExportInput = {}): FeatureStoreExportManifest {
  const scope = normalizeExportScope(input.scope);
  const sourceArtifacts = input.sourceArtifacts ?? createCanonicalApiHubSourceArtifacts(scope);
  const featureRecords = input.featureRecords ?? buildCanonicalApiHubFeatureRecords({ scope, sourceArtifacts });
  const featureSetId = input.featureSetId ?? 'feature-set:api-hub-race-readiness-v1';
  const decision = evaluateAllowedUse(sourceArtifacts, 'feature-export', scope.generatedAt);
  const privacy = privacyFor(sourceArtifacts);
  const descriptor = storageArtifactDescriptor(scope, {
    artifactId: `manifest:feature-store:${scope.tenantId}:${scope.racetrackId}:${scope.correlationId}`,
    artifactType: 'feature-record',
    displayName: 'API Hub Feature Store Export Manifest',
    recordType: 'FeatureRecord',
    fields: ['id', 'schemaVersion', 'metadata', 'features', 'scores', 'dataQuality', 'evidence'],
    sourceArtifacts,
    featureRecordIds: featureRecords.map((record) => record.id),
    privacy,
  });
  const storageTargets = routeUniversalArtifactToStores(descriptor).filter((target) => target.storeKind === 'feature-store');
  const auditRefs = unique(sourceArtifacts.flatMap((artifact) => artifact.auditRefs).concat(`audit:api-hub:feature-export:${scope.correlationId}`));
  const eventRefs = unique(sourceArtifacts.flatMap((artifact) => artifact.eventRefs).concat(`event:api-hub.feature-export.planned.v1`));
  return {
    schemaVersion: racingDataApiHubExportSchemaVersion,
    manifestId: descriptor.artifactId,
    exportType: 'feature-store',
    status: decision.allowed ? 'ready' : 'blocked',
    requestedUse: 'feature-export',
    generatedAt: scope.generatedAt,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    featureSetId,
    featureRecords: featureRecords.map(clone),
    featureArtifacts: featureRecords.map((record) => adaptFeatureRecordToFeatureArtifact(record, {
      featureSetId,
      sourceRefs: sourceArtifacts.map((artifact) => artifact.envelopeId),
      sourceArtifactClasses: ['Telemetry', 'Event'],
      dataClassification: privacy.classification === 'regulated' ? 'regulated' : privacy.classification,
      evidence: decision.evidenceRefs,
      lineage: sourceArtifacts.map((artifact) => `api-hub-source:${artifact.envelopeId}`),
    })),
    storageTargets,
    storageTargetDescriptors: describeTargets(storageTargets),
    partitionKeys: partitionKeys(storageTargets),
    privacy,
    licenseRestrictions: decision.licenseRestrictions,
    allowedUseDecision: decision,
    lineage: createUnifiedLineageContract({ entityKind: 'feature-record', entityId: descriptor.artifactId, tenantId: scope.tenantId, racetrackId: scope.racetrackId, storeIds: findStoresForTUSEntity('feature-record').map((store) => store.storeId), eventIds: eventRefs, auditIds: auditRefs, featureRecordIds: featureRecords.map((record) => record.id), evidence: decision.evidenceRefs }),
    auditRefs,
    eventRefs,
    noCloudUpload: true,
  };
}

export function createTrainingDatasetManifest(input: ApiHubExportInput = {}): TrainingDatasetManifestArtifact {
  const scope = normalizeExportScope(input.scope);
  const sourceArtifacts = input.sourceArtifacts ?? createCanonicalApiHubSourceArtifacts(scope);
  const featureRecords = input.featureRecords ?? buildCanonicalApiHubFeatureRecords({ scope, sourceArtifacts });
  const featureSetId = input.featureSetId ?? 'feature-set:api-hub-race-readiness-v1';
  const datasetId = `dataset:api-hub:${scope.tenantId}:${scope.racetrackId}:${scope.correlationId}`;
  const decision = evaluateAllowedUse(sourceArtifacts, 'model-training', scope.generatedAt);
  const privacy = privacyFor(sourceArtifacts);
  const descriptor = storageArtifactDescriptor(scope, {
    artifactId: `manifest:training-dataset:${scope.tenantId}:${scope.racetrackId}:${scope.correlationId}`,
    artifactType: 'dataset',
    displayName: 'API Hub Training Dataset Manifest',
    recordType: 'TrainingDatasetManifest',
    fields: ['datasetId', 'featureSetId', 'sourceArtifacts', 'featureRecordIds', 'timeRange', 'privacy', 'licenseRestrictions'],
    sourceArtifacts,
    featureRecordIds: featureRecords.map((record) => record.id),
    privacy,
    datasetId,
  });
  const storageTargets = routeUniversalArtifactToStores(descriptor).filter((target) => target.storeKind === 'feature-store' || target.storeKind === 'data-lake');
  const auditRefs = unique(sourceArtifacts.flatMap((artifact) => artifact.auditRefs).concat(`audit:api-hub:training-manifest:${scope.correlationId}`));
  const eventRefs = unique(sourceArtifacts.flatMap((artifact) => artifact.eventRefs).concat(`event:api-hub.training-dataset-manifest.planned.v1`));
  return {
    schemaVersion: trainingDatasetManifestSchemaVersion,
    manifestId: descriptor.artifactId,
    artifactType: 'TrainingDatasetManifest',
    status: decision.allowed ? 'ready' : 'blocked',
    datasetId,
    featureSetId,
    generatedAt: scope.generatedAt,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    intendedUse: 'model-training',
    trainingAllowed: decision.allowed,
    sourceArtifacts: sourceArtifacts.map(trainingSourceArtifact),
    featureRecordIds: featureRecords.map((record) => record.id),
    timeRange: timeRangeFor(sourceArtifacts, featureRecords),
    privacy,
    licenseRestrictions: decision.licenseRestrictions,
    blockedReasons: decision.blockedReasons,
    storageTargets,
    storageTargetDescriptors: describeTargets(storageTargets),
    partitionKeys: partitionKeys(storageTargets),
    lineage: createUnifiedLineageContract({ entityKind: 'feature-record', entityId: descriptor.artifactId, tenantId: scope.tenantId, racetrackId: scope.racetrackId, eventIds: eventRefs, auditIds: auditRefs, featureRecordIds: featureRecords.map((record) => record.id), evidence: decision.evidenceRefs }),
    auditRefs,
    eventRefs,
    noCloudUpload: true,
  };
}

export function createDataLakeExportManifest(input: ApiHubExportInput = {}): DataLakeExportManifest {
  const scope = normalizeExportScope(input.scope);
  const sourceArtifacts = input.sourceArtifacts ?? createCanonicalApiHubSourceArtifacts(scope);
  const featureRecords = input.featureRecords ?? buildCanonicalApiHubFeatureRecords({ scope, sourceArtifacts });
  const decision = evaluateAllowedUse(sourceArtifacts, 'data-lake-export', scope.generatedAt);
  const privacy = privacyFor(sourceArtifacts);
  const artifactIds = unique([...sourceArtifacts.map((artifact) => artifact.envelopeId), ...featureRecords.map((record) => record.id)]);
  const descriptor = storageArtifactDescriptor(scope, {
    artifactId: `manifest:data-lake:${scope.tenantId}:${scope.racetrackId}:${scope.correlationId}`,
    artifactType: 'dataset',
    displayName: 'API Hub Data Lake Export Descriptor',
    recordType: 'DataLakeExportManifest',
    fields: ['artifactIds', 'storageTargetDescriptors', 'partitionKeys', 'privacy', 'licenseRestrictions', 'lineage'],
    sourceArtifacts,
    featureRecordIds: featureRecords.map((record) => record.id),
    privacy,
    datasetId: `dataset:data-lake:${scope.tenantId}:${scope.racetrackId}:${scope.correlationId}`,
  });
  const storageTargets = routeUniversalArtifactToStores(descriptor).filter((target) => target.storeKind === 'data-lake');
  const auditRefs = unique(sourceArtifacts.flatMap((artifact) => artifact.auditRefs).concat(`audit:api-hub:data-lake-export:${scope.correlationId}`));
  const eventRefs = unique(sourceArtifacts.flatMap((artifact) => artifact.eventRefs).concat(`event:api-hub.data-lake-export.planned.v1`));
  return {
    schemaVersion: racingDataApiHubExportSchemaVersion,
    manifestId: descriptor.artifactId,
    exportType: 'data-lake',
    status: decision.allowed ? 'ready' : 'blocked',
    requestedUse: 'data-lake-export',
    generatedAt: scope.generatedAt,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    artifactIds,
    storageTargets,
    storageTargetDescriptors: describeTargets(storageTargets),
    partitionKeys: partitionKeys(storageTargets),
    privacy,
    licenseRestrictions: decision.licenseRestrictions,
    allowedUseDecision: decision,
    lineage: createUnifiedLineageContract({ entityKind: 'feature-record', entityId: descriptor.artifactId, tenantId: scope.tenantId, racetrackId: scope.racetrackId, eventIds: eventRefs, auditIds: auditRefs, featureRecordIds: featureRecords.map((record) => record.id), evidence: decision.evidenceRefs }),
    auditRefs,
    eventRefs,
    noCloudUpload: true,
  };
}

export function evaluateAllowedUse(sourceArtifacts: readonly CanonicalRacingDataEnvelope[], requestedUse: ApiHubExportAllowedUse, evaluatedAt = defaultExportScope.generatedAt): ApiHubAllowedUseDecision {
  const blockedReasons: string[] = [];
  const requiredScopes = usageScopesByAllowedUse[requestedUse];
  for (const artifact of sourceArtifacts) {
    const license = artifact.license;
    if (!['active', 'restricted', 'evaluation'].includes(license.licenseStatus)) blockedReasons.push(`${artifact.envelopeId} license status ${license.licenseStatus} does not allow ${requestedUse}`);
    if (license.expiresAt && license.expiresAt < evaluatedAt) blockedReasons.push(`${artifact.envelopeId} license expired at ${license.expiresAt}`);
    if (!requiredScopes.some((scope) => license.usageScope.includes(scope))) blockedReasons.push(`${artifact.envelopeId} license usage scope excludes ${requestedUse}`);
    if (requestedUse === 'data-lake-export' && !license.redistributionAllowed && artifact.tenant.dataBoundary === 'external') blockedReasons.push(`${artifact.envelopeId} external redistribution is not allowed`);
    if (requestedUse === 'model-training' && license.piiPresent) blockedReasons.push(`${artifact.envelopeId} contains PII and cannot be used for model training without a privacy review manifest`);
  }
  return {
    allowed: blockedReasons.length === 0,
    requestedUse,
    sourceArtifactIds: sourceArtifacts.map((artifact) => artifact.envelopeId),
    blockedReasons: unique(blockedReasons),
    licenseRestrictions: unique(sourceArtifacts.flatMap(licenseRestrictionsFor)),
    evidenceRefs: unique(sourceArtifacts.flatMap((artifact) => [...artifact.evidenceRefs, ...artifact.license.evidenceRefs])),
    auditRefs: unique(sourceArtifacts.flatMap((artifact) => artifact.auditRefs)),
    eventRefs: unique(sourceArtifacts.flatMap((artifact) => artifact.eventRefs)),
  };
}

function normalizeExportScope(scope: Partial<ApiHubExportScope> = {}): Required<ApiHubExportScope> {
  return {
    tenantId: scope.tenantId ?? defaultExportScope.tenantId,
    racetrackId: scope.racetrackId ?? defaultExportScope.racetrackId,
    jurisdiction: scope.jurisdiction ?? defaultExportScope.jurisdiction,
    generatedAt: scope.generatedAt ?? defaultExportScope.generatedAt,
    correlationId: scope.correlationId ?? defaultExportScope.correlationId,
    causationIds: scope.causationIds ?? [...defaultExportScope.causationIds],
  };
}

function tenantMetadata(scope: Required<ApiHubExportScope>): RacingDataTenantMetadata {
  return { tenantId: scope.tenantId, racetrackId: scope.racetrackId, jurisdiction: scope.jurisdiction, dataBoundary: 'racetrack' };
}

function licenseMetadata(input: { status: RacingDataLicenseStatus; dataClasses: RacingDataClass[]; usageScope: RacingDataUsageScope[]; piiPresent: boolean; evidenceRefs: string[]; termsRef?: string; attributionRequired?: boolean }): RacingDataLicenseMetadata {
  return {
    licenseStatus: input.status,
    commercialUseAllowed: input.usageScope.includes('commercial-product'),
    redistributionAllowed: false,
    attributionRequired: input.attributionRequired ?? false,
    requiresAttribution: input.attributionRequired ?? false,
    piiPresent: input.piiPresent,
    dataClasses: [...input.dataClasses],
    usageScope: [...input.usageScope],
    retention: { policyId: 'api-hub-source-retention-1y', retentionDays: 365, legalBasis: 'licensed racing operations and governed analytics' },
    termsRef: input.termsRef,
    attributionText: input.attributionRequired ? 'Attribution required by source license.' : undefined,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    evidenceRefs: [...input.evidenceRefs],
  };
}

function canonicalEnvelope(input: {
  envelopeId: string;
  providerId: string;
  tenant: RacingDataTenantMetadata;
  generatedAt: string;
  correlationId: string;
  causationIds: string[];
  canonicalDataClass: RacingDataClass;
  dataClasses: RacingDataClass[];
  payload: Record<string, unknown>;
  sourcePayloadRefs: string[];
  license: RacingDataLicenseMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
}): CanonicalRacingDataEnvelope {
  return {
    schemaVersion: racingDataApiHubSchemaVersion,
    envelopeId: input.envelopeId,
    providerId: input.providerId,
    tenant: { ...input.tenant },
    jurisdiction: input.tenant.jurisdiction,
    canonicalDataClass: input.canonicalDataClass,
    dataClasses: [...input.dataClasses],
    receivedAt: input.generatedAt,
    normalizedAt: input.generatedAt,
    payload: clone(input.payload),
    sourcePayloadRefs: [...input.sourcePayloadRefs],
    license: clone(input.license),
    usageScope: [...input.license.usageScope],
    retention: clone(input.license.retention),
    piiPresent: input.license.piiPresent,
    lineage: {
      sourceSystem: input.providerId,
      sourceRefs: [...input.sourcePayloadRefs],
      rawPayloadRefs: [...input.sourcePayloadRefs],
      normalizedFromRefs: [...input.sourcePayloadRefs],
      correlationId: input.correlationId,
      causationIds: [...input.causationIds],
    },
    evidenceRefs: [...input.evidenceRefs],
    auditRefs: [...input.auditRefs],
    eventRefs: [...input.eventRefs],
  };
}

function featureMetadata(scope: Required<ApiHubExportScope>, domain: FeatureDomain, assetId: string, subjectId: string, source: string) {
  return {
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    domain,
    correlationId: scope.correlationId,
    asOf: scope.generatedAt,
    source,
    assetId,
    subjectId,
  };
}

function storageArtifactDescriptor(scope: Required<ApiHubExportScope>, input: {
  artifactId: string;
  artifactType: 'feature-record' | 'dataset';
  displayName: string;
  recordType: string;
  fields: string[];
  sourceArtifacts: readonly CanonicalRacingDataEnvelope[];
  featureRecordIds: string[];
  privacy: UniversalArtifactPrivacyFlags;
  datasetId?: string;
}): UniversalStorageArtifactDescriptor {
  return {
    artifactId: input.artifactId,
    artifactType: input.artifactType,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    displayName: input.displayName,
    sourceSystem: 'racing-data-api-hub',
    createdAt: scope.generatedAt,
    updatedAt: scope.generatedAt,
    payloadShape: {
      schemaRef: input.recordType === 'FeatureRecord' ? featureStoreSchemaVersion : trainingDatasetManifestSchemaVersion,
      recordType: input.recordType,
      fields: [...input.fields],
      descriptorOnly: true,
    },
    references: {
      datasetIds: input.datasetId ? [input.datasetId] : undefined,
      featureRecordIds: [...input.featureRecordIds],
      eventIds: unique(input.sourceArtifacts.flatMap((artifact) => artifact.eventRefs)),
      auditIds: unique(input.sourceArtifacts.flatMap((artifact) => artifact.auditRefs)),
      evidenceIds: unique(input.sourceArtifacts.flatMap((artifact) => artifact.evidenceRefs)),
      subjectIds: unique(input.sourceArtifacts.map((artifact) => artifact.envelopeId)),
    },
    lineage: {
      upstreamArtifactIds: input.sourceArtifacts.map((artifact) => artifact.envelopeId),
      downstreamArtifactIds: [input.artifactId],
      eventIds: unique(input.sourceArtifacts.flatMap((artifact) => artifact.eventRefs)),
      auditIds: unique(input.sourceArtifacts.flatMap((artifact) => artifact.auditRefs)),
      twinIds: twinIdsFor(input.featureRecordIds),
      featureRecordIds: [...input.featureRecordIds],
      approvalIds: [],
      evidenceIds: unique(input.sourceArtifacts.flatMap((artifact) => [...artifact.evidenceRefs, ...artifact.license.evidenceRefs])),
      sourceSystems: unique(input.sourceArtifacts.map((artifact) => artifact.providerId)),
      correlationId: scope.correlationId,
      causationId: scope.causationIds[0],
    },
    privacy: clone(input.privacy),
    complianceFrameworks: ['ISO-42001', 'NIST-AI-RMF', 'ISO-27701', 'SOC-2'],
  };
}

function describeTargets(targets: readonly UniversalArtifactStorageTarget[]): ApiHubStorageTargetDescriptor[] {
  const adapters = listUniversalArtifactStorageAdapters();
  return targets.map((target) => {
    const adapter = adapters.find((candidate) => candidate.storeId === target.targetStoreId);
    return {
      targetStoreId: target.targetStoreId,
      storeKind: target.storeKind,
      readOnly: true,
      adapterMode: 'metadata-only',
      cloudUploadImplemented: false,
      partitionKey: target.tenantPartition.partitionKey,
      partitionKeys: adapter?.tenantPartitioning.partitionKeys ?? ['tenantId', 'racetrackId', 'artifactType'],
      partitionTemplate: adapter?.tenantPartitioning.partitionTemplate ?? 'tenantId/racetrackId/artifactType',
      targetPathTemplate: adapter?.routing.targetPathTemplate ?? `${target.storeKind}/{tenantId}/{racetrackId}/{artifactId}.json`,
      privacyClassification: target.privacy.classification,
      retentionPolicyId: target.retention.policyId,
      lineageEventRefs: target.lineage.eventIds,
      lineageAuditRefs: target.lineage.auditIds,
    };
  });
}

function partitionKeys(targets: readonly UniversalArtifactStorageTarget[]): string[] {
  return unique(describeTargets(targets).flatMap((target) => target.partitionKeys));
}

function privacyFor(sourceArtifacts: readonly CanonicalRacingDataEnvelope[]): UniversalArtifactPrivacyFlags {
  const classification = sourceArtifacts.map(classificationFor).sort((left, right) => classificationRank[right] - classificationRank[left])[0] ?? 'internal';
  const pii = sourceArtifacts.some((artifact) => artifact.license.piiPresent || artifact.piiPresent);
  const restrictedFields = unique([
    ...(pii ? ['personId', 'licenseNumber', 'credentialId'] : []),
    ...sourceArtifacts.flatMap((artifact) => artifact.dataClasses).filter((dataClass) => ['participant-profile', 'veterinary', 'media'].includes(dataClass)).map((dataClass) => `${dataClass}:rawPayload`),
    'rawProviderPayload',
    'licenseTermsRef',
  ]);
  return {
    classification,
    containsPii: pii,
    containsProtectedHealthInfo: sourceArtifacts.some((artifact) => artifact.dataClasses.includes('veterinary')),
    containsFinancialData: sourceArtifacts.some((artifact) => artifact.dataClasses.includes('odds') || artifact.dataClasses.includes('pools')),
    containsCredentialData: sourceArtifacts.some((artifact) => artifact.dataClasses.includes('participant-profile')),
    containsSensitiveTelemetry: sourceArtifacts.some((artifact) => artifact.dataClasses.includes('track-condition') || artifact.dataClasses.includes('weather')),
    restrictedFields,
    redactionRequired: pii || classification === 'restricted' || classification === 'regulated',
  };
}

function classificationFor(artifact: CanonicalRacingDataEnvelope): DataClassification {
  if (artifact.license.piiPresent || artifact.dataClasses.some((dataClass) => ['veterinary', 'participant-profile', 'horse-profile', 'steward-decisions'].includes(dataClass))) return 'regulated';
  if (artifact.license.licenseStatus === 'restricted' || artifact.dataClasses.includes('analytics')) return 'restricted';
  if (artifact.dataClasses.includes('media')) return 'confidential';
  if (artifact.dataClasses.includes('weather') || artifact.dataClasses.includes('track-condition')) return 'internal';
  return 'public';
}

function licenseRestrictionsFor(artifact: CanonicalRacingDataEnvelope): string[] {
  return unique([
    `license-status:${artifact.license.licenseStatus}`,
    ...artifact.license.usageScope.map((scope) => `allowed-scope:${scope}`),
    ...(artifact.license.termsRef ? [`terms:${artifact.license.termsRef}`] : []),
    ...(artifact.license.attributionRequired ? ['attribution-required'] : []),
    ...(artifact.license.redistributionAllowed ? [] : ['redistribution-not-allowed']),
    ...(artifact.license.piiPresent ? ['pii-present'] : []),
  ]);
}

function trainingSourceArtifact(artifact: CanonicalRacingDataEnvelope): TrainingDatasetSourceArtifact {
  return {
    artifactId: artifact.envelopeId,
    providerId: artifact.providerId,
    canonicalDataClass: artifact.canonicalDataClass,
    sourcePayloadRefs: [...artifact.sourcePayloadRefs],
    licenseStatus: artifact.license.licenseStatus,
    usageScope: [...artifact.license.usageScope],
    restrictions: licenseRestrictionsFor(artifact),
    evidenceRefs: [...artifact.evidenceRefs],
    auditRefs: [...artifact.auditRefs],
    eventRefs: [...artifact.eventRefs],
  };
}

function timeRangeFor(sourceArtifacts: readonly CanonicalRacingDataEnvelope[], featureRecords: readonly AnyFeatureRecord[]): { start: string; end: string } {
  const dates = [
    ...sourceArtifacts.flatMap((artifact) => [artifact.receivedAt, artifact.normalizedAt, timestampFromPayload(artifact.payload, 'observedAt'), timestampFromPayload(artifact.payload, 'maintenanceCompletedAt'), timestampFromPayload(artifact.payload, 'inspectionAt')]),
    ...featureRecords.map((record) => String(record.metadata.asOf)),
  ].filter(isParsableTimestamp).sort();
  return { start: dates[0] ?? defaultExportScope.generatedAt, end: dates[dates.length - 1] ?? defaultExportScope.generatedAt };
}

function isParsableTimestamp(value: string | undefined): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function readinessScore(records: readonly AnyFeatureRecord[], domain: FeatureDomain, scoreName: string): number {
  const record = records.find((item) => item.metadata.domain === domain);
  const scores = record?.scores as Record<string, unknown> | undefined;
  const value = scores?.[scoreName];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function twinIdsFor(featureRecordIds: readonly string[]): string[] {
  return featureRecordIds.map((id) => `twin:${id.replace(/[^a-zA-Z0-9:-]/g, '-')}`);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function timestampFromPayload(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function unique(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
