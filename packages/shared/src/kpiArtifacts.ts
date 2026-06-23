import { validateContract, type ContractRule } from './apiContracts.js';
import type { Permission, Role } from './accessControl.js';

export const kpiArtifactType = 'KPI' as const;

export const kpiDomains = [
  'race-day-operations',
  'racing-calendar',
  'trainer-management',
  'jockey-management',
  'veterinary-operations',
  'paddock-operations',
  'steward-operations',
  'starting-gate-operations',
  'surface-intelligence',
  'equine-welfare',
  'equine-intelligence',
  'safety-incidents',
  'stewarding',
  'compliance',
  'security',
  'facilities',
  'ticketing',
  'finance',
  'fan-experience',
  'racing-data-hub',
  'multi-track-federation',
  'ai-governance',
  'audit-integrity',
  'approval-workflows',
  'tenant-operations',
  'system-health',
  'data-quality',
  'veterinary-privacy',
  'deployment-readiness',
  'surveillance-iot',
] as const;

export type KPIDomain = typeof kpiDomains[number];
export type KPIMetricType = 'count' | 'rate' | 'score' | 'duration' | 'currency' | 'percentage' | 'ratio' | 'readiness';
export type KPIStatus = 'nominal' | 'watch' | 'warning' | 'critical' | 'blocked' | 'readiness-only';
export type KPITrend = 'up' | 'down' | 'flat' | 'insufficient-history';
export type KPIVisibility = 'public' | 'tenant-internal' | 'restricted' | 'veterinary-restricted' | 'federation-aggregate';
export type KPIApprovalSensitivity = 'none' | 'approval-visible' | 'approval-required-for-threshold-change' | 'regulated-advisory-only';

export const modelReadableKpiAllowedUses = ['generate advisory recommendations', 'explain KPI drivers', 'identify evidence gaps'] as const;
export const modelReadableKpiRequiredProhibitedUses = ['modify KPI values', 'execute regulated actions', 'bypass human approval', 'expose raw cross-track records'] as const;

export interface KPIThresholdRule {
  warning?: number;
  critical?: number;
  targetDirection: 'above' | 'below' | 'between' | 'exact';
  description: string;
}

export interface KPISourceEntityRef {
  entityType: string;
  entityId: string;
}

export interface KPIAuditReference {
  auditEventIds: string[];
  /** Alias consumed by domain KPI DTOs and lineage validators. */
  auditIds?: string[];
  eventIds: string[];
  correlationId: string;
  calculationRunId: string;
  integrityRef?: string;
}

export interface KPIHistoricalSnapshot {
  snapshotId: string;
  kpiId: string;
  value: number;
  status: KPIStatus;
  trend: KPITrend;
  confidence: number;
  dataQualityScore: number;
  calculatedAt: string;
  sourceEvents: string[];
  auditReference: KPIAuditReference;
}

export interface KPIArtifact {
  kpiId: string;
  tenantId: string;
  organizationId: string;
  racetrackId?: string;
  domain: KPIDomain;
  name: string;
  description: string;
  artifactType: typeof kpiArtifactType;
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
  sourceEntities: KPISourceEntityRef[];
  calculationMethod: string;
  refreshCadence: string;
  lastCalculatedAt: string;
  ownerRole: Role;
  visibility: KPIVisibility;
  approvalSensitivity: KPIApprovalSensitivity;
  requiredPermission?: Permission;
  auditReference: KPIAuditReference;
  modelReadable: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
  historicalSnapshots: KPIHistoricalSnapshot[];
}
export type KPI = KPIArtifact;

export interface ModelReadableKPIContext {
  kpiId: string;
  domain: KPIDomain;
  name: string;
  description: string;
  currentValue: number;
  unit: string;
  trend: KPITrend;
  status: KPIStatus;
  confidence: number;
  dataQualityScore: number;
  sourceSummary: string;
  allowedUse: string[];
  prohibitedUse: string[];
  approvalSensitivity: KPIApprovalSensitivity;
  lastCalculatedAt: string;
}

export interface KPIWorkspaceDto {
  generatedAt: string;
  tenantId: string;
  organizationId: string;
  racetrackId?: string;
  kpis: KPIArtifact[];
  modelReadableContext: ModelReadableKPIContext[];
  governance: {
    modelReadableOnly: true;
    aiMutationAllowed: false;
    regulatedExecutionAllowed: false;
    federatedKpisAggregateOnly: true;
  };
  mock: boolean;
}

export const kpiArtifactContractSchema = [
  { path: 'kpiId', required: true, type: 'string' },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'organizationId', required: true, type: 'string' },
  { path: 'racetrackId', type: 'string' },
  { path: 'domain', required: true, type: 'string', values: kpiDomains },
  { path: 'name', required: true, type: 'string' },
  { path: 'description', required: true, type: 'string' },
  { path: 'artifactType', required: true, type: 'string', values: [kpiArtifactType] },
  { path: 'metricType', required: true, type: 'string' },
  { path: 'value', required: true, type: 'number' },
  { path: 'unit', required: true, type: 'string' },
  { path: 'target', required: true, type: 'number' },
  { path: 'threshold', required: true, type: 'object' },
  { path: 'threshold.targetDirection', required: true, type: 'string', values: ['above', 'below', 'between', 'exact'] },
  { path: 'threshold.description', required: true, type: 'string' },
  { path: 'status', required: true, type: 'string', values: ['nominal', 'watch', 'warning', 'critical', 'blocked', 'readiness-only'] },
  { path: 'trend', required: true, type: 'string', values: ['up', 'down', 'flat', 'insufficient-history'] },
  { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
  { path: 'dataQualityScore', required: true, type: 'number', min: 0, max: 1 },
  { path: 'sourceEvents', required: true, type: 'array' },
  { path: 'sourceEntities', required: true, type: 'array' },
  { path: 'calculationMethod', required: true, type: 'string' },
  { path: 'refreshCadence', required: true, type: 'string' },
  { path: 'lastCalculatedAt', required: true, type: 'string' },
  { path: 'ownerRole', required: true, type: 'string' },
  { path: 'visibility', required: true, type: 'string', values: ['public', 'tenant-internal', 'restricted', 'veterinary-restricted', 'federation-aggregate'] },
  { path: 'approvalSensitivity', required: true, type: 'string' },
  { path: 'auditReference', required: true, type: 'object' },
  { path: 'auditReference.auditEventIds', required: true, type: 'array' },
  { path: 'auditReference.eventIds', required: true, type: 'array' },
  { path: 'auditReference.correlationId', required: true, type: 'string' },
  { path: 'auditReference.calculationRunId', required: true, type: 'string' },
  { path: 'modelReadable', required: true, type: 'boolean' },
  { path: 'version', required: true, type: 'string' },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'historicalSnapshots', required: true, type: 'array' },
] as const satisfies readonly ContractRule[];

export const modelReadableKpiContextSchema = [
  { path: 'kpiId', required: true, type: 'string' },
  { path: 'domain', required: true, type: 'string', values: kpiDomains },
  { path: 'name', required: true, type: 'string' },
  { path: 'description', required: true, type: 'string' },
  { path: 'currentValue', required: true, type: 'number' },
  { path: 'unit', required: true, type: 'string' },
  { path: 'trend', required: true, type: 'string' },
  { path: 'status', required: true, type: 'string' },
  { path: 'confidence', required: true, type: 'number', min: 0, max: 1 },
  { path: 'dataQualityScore', required: true, type: 'number', min: 0, max: 1 },
  { path: 'sourceSummary', required: true, type: 'string' },
  { path: 'allowedUse', required: true, type: 'array' },
  { path: 'prohibitedUse', required: true, type: 'array' },
  { path: 'approvalSensitivity', required: true, type: 'string' },
  { path: 'lastCalculatedAt', required: true, type: 'string' },
] as const satisfies readonly ContractRule[];

export const kpiWorkspaceSchema = [
  { path: 'generatedAt', required: true, type: 'string' },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'organizationId', required: true, type: 'string' },
  { path: 'kpis', required: true, type: 'array' },
  { path: 'modelReadableContext', required: true, type: 'array' },
  { path: 'governance', required: true, type: 'object' },
  { path: 'governance.modelReadableOnly', required: true, type: 'boolean', values: ['true'] },
  { path: 'governance.aiMutationAllowed', required: true, type: 'boolean', values: ['false'] },
  { path: 'governance.regulatedExecutionAllowed', required: true, type: 'boolean', values: ['false'] },
  { path: 'governance.federatedKpisAggregateOnly', required: true, type: 'boolean', values: ['true'] },
  { path: 'mock', required: true, type: 'boolean' },
] as const satisfies readonly ContractRule[];

export function validateKPIArtifact(value: unknown): { valid: boolean; errors: string[] } {
  const result = validateContract('KPIArtifact', value, kpiArtifactContractSchema);
  const errors = [...result.errors];
  const artifact = value as Partial<KPIArtifact>;
  if (Array.isArray(artifact.sourceEvents) && artifact.sourceEvents.length === 0) errors.push('KPIArtifact.sourceEvents must include at least one event reference');
  if (Array.isArray(artifact.sourceEntities) && artifact.sourceEntities.length === 0) errors.push('KPIArtifact.sourceEntities must include at least one entity reference');
  if (artifact.modelReadable && artifact.approvalSensitivity === 'regulated-advisory-only' && artifact.visibility === 'public') {
    errors.push('KPIArtifact regulated advisory KPIs cannot be public model-readable artifacts');
  }
  if (artifact.domain === 'multi-track-federation' && artifact.visibility !== 'federation-aggregate') {
    errors.push('KPIArtifact multi-track federation KPIs must use federation-aggregate visibility');
  }
  return { valid: errors.length === 0, errors };
}

export function createModelReadableKPIContext(kpi: KPIArtifact): ModelReadableKPIContext {
  return {
    kpiId: kpi.kpiId,
    domain: kpi.domain,
    name: kpi.name,
    description: kpi.description,
    currentValue: kpi.value,
    unit: kpi.unit,
    trend: kpi.trend,
    status: kpi.status,
    confidence: kpi.confidence,
    dataQualityScore: kpi.dataQualityScore,
    sourceSummary: `${kpi.sourceEvents.length} event refs; ${kpi.sourceEntities.length} entity refs; ${kpi.calculationMethod}`,
    allowedUse: [...modelReadableKpiAllowedUses],
    prohibitedUse: [...modelReadableKpiRequiredProhibitedUses],
    approvalSensitivity: kpi.approvalSensitivity,
    lastCalculatedAt: kpi.lastCalculatedAt,
  };
}

export function validateModelReadableKPIContext(value: unknown): { valid: boolean; errors: string[] } {
  const result = validateContract('ModelReadableKPIContext', value, modelReadableKpiContextSchema);
  const errors = [...result.errors];
  const context = value as Partial<ModelReadableKPIContext>;
  for (const prohibitedUse of modelReadableKpiRequiredProhibitedUses) {
    if (!Array.isArray(context.prohibitedUse) || !context.prohibitedUse.includes(prohibitedUse)) {
      errors.push(`ModelReadableKPIContext.prohibitedUse must include ${prohibitedUse}`);
    }
  }
  if (Array.isArray(context.allowedUse) && context.allowedUse.some((use) => modelReadableKpiRequiredProhibitedUses.includes(use as typeof modelReadableKpiRequiredProhibitedUses[number]))) {
    errors.push('ModelReadableKPIContext.allowedUse cannot include prohibited KPI or regulated action uses');
  }
  if (Array.isArray(context.allowedUse)) {
    const allowedUseSet = new Set<string>(modelReadableKpiAllowedUses);
    for (const use of context.allowedUse) {
      if (!allowedUseSet.has(use)) errors.push(`ModelReadableKPIContext.allowedUse contains unknown model use: ${use}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export interface KpiDefinitionDto {
  kpiId: string;
  tenantId: string;
  organizationId: string;
  racetrackId?: string;
  domain: KPIDomain;
  name: string;
  description: string;
  metricType: KPIMetricType;
  unit: string;
  target: number;
  ownerRole: Role;
  visibility: KPIVisibility;
  approvalSensitivity: KPIApprovalSensitivity;
  requiredPermission?: Permission;
  calculationMethod: string;
  refreshCadence: string;
  sourceEvents: string[];
  sourceEntities: KPISourceEntityRef[];
  modelReadable: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface KpiDefinitionRegistryDto {
  generatedAt: string;
  definitions: KpiDefinitionDto[];
  mock: boolean;
}

export interface KpiThresholdRecordDto {
  thresholdId: string;
  kpiId: string;
  tenantId: string;
  racetrackId?: string;
  warning?: number;
  critical?: number;
  targetDirection: KPIThresholdRule['targetDirection'];
  description: string;
  effectiveFrom: string;
  status: 'active' | 'pending-approval' | 'superseded';
  approvalId?: string;
  auditEventIds: string[];
  createdAt: string;
}

export interface KpiThresholdListDto {
  generatedAt: string;
  thresholds: KpiThresholdRecordDto[];
  mock: boolean;
}

export interface KpiRegistryEntryDto {
  kpiId: string;
  domain: KPIDomain;
  name: string;
  ownerRole: Role;
  visibility: KPIVisibility;
  approvalSensitivity: KPIApprovalSensitivity;
  sourceEventCount: number;
  sourceEntityCount: number;
  thresholdStatus: 'active' | 'pending-approval' | 'none';
  lastCalculatedAt?: string;
}

export interface KpiRegistryDto {
  generatedAt: string;
  tenantId: string;
  organizationId: string;
  racetrackId?: string;
  entries: KpiRegistryEntryDto[];
  mock: boolean;
}

export interface KpiSourceMappingDto {
  kpiId: string;
  domain: KPIDomain;
  sourceEvents: string[];
  sourceEntities: KPISourceEntityRef[];
  calculationMethod: string;
  auditEventIds: string[];
  eventIds: string[];
  correlationId: string;
}

export interface KpiSourcesDto {
  generatedAt: string;
  mappings: KpiSourceMappingDto[];
  consolidatedEventRefs: string[];
  mock: boolean;
}

export interface KpiMutationDraftResultDto {
  accepted: boolean;
  draftId: string;
  kpiId: string;
  eventType: string;
  approvalId?: string;
  approvalRequired: boolean;
  message: string;
  auditEventIds: string[];
  mock: boolean;
}

export function definitionFromArtifact(artifact: KPIArtifact): KpiDefinitionDto {
  return {
    kpiId: artifact.kpiId,
    tenantId: artifact.tenantId,
    organizationId: artifact.organizationId,
    racetrackId: artifact.racetrackId,
    domain: artifact.domain,
    name: artifact.name,
    description: artifact.description,
    metricType: artifact.metricType,
    unit: artifact.unit,
    target: artifact.target,
    ownerRole: artifact.ownerRole,
    visibility: artifact.visibility,
    approvalSensitivity: artifact.approvalSensitivity,
    requiredPermission: artifact.requiredPermission,
    calculationMethod: artifact.calculationMethod,
    refreshCadence: artifact.refreshCadence,
    sourceEvents: [...artifact.sourceEvents],
    sourceEntities: [...artifact.sourceEntities],
    modelReadable: artifact.modelReadable,
    version: artifact.version,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

export function evaluateKpiStatus(
  value: number,
  threshold: KPIThresholdRule,
  metricType: KPIMetricType,
  priorStatus?: KPIStatus,
): KPIStatus {
  if (metricType === 'readiness' || priorStatus === 'readiness-only') return 'readiness-only';
  const { warning, critical, targetDirection } = threshold;
  if (targetDirection === 'below') {
    if (critical != null && value >= critical) return 'critical';
    if (warning != null && value >= warning) return 'warning';
    if (warning != null && value >= warning * 0.85) return 'watch';
    return 'nominal';
  }
  if (targetDirection === 'above') {
    if (critical != null && value <= critical) return 'critical';
    if (warning != null && value <= warning) return 'warning';
    if (warning != null && value <= warning * 1.05) return 'watch';
    return 'nominal';
  }
  return priorStatus ?? 'watch';
}

export function computeKpiTrend(historicalSnapshots: KPIHistoricalSnapshot[], newValue: number): KPITrend {
  const prior = historicalSnapshots.at(-1);
  if (!prior) return 'insufficient-history';
  const delta = newValue - prior.value;
  const tolerance = Math.max(Math.abs(prior.value) * 0.01, 0.5);
  if (Math.abs(delta) <= tolerance) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
