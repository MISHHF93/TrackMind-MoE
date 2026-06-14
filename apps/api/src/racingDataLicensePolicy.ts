import type { AuditLogEntry, ImmutableAuditLog } from './auditLog.js';
import type { EventContract, UniversalEventBus } from './eventBus.js';

export type DataUsageOperation =
  | 'operations'
  | 'analytics'
  | 'internal_model_training_only'
  | 'public_display'
  | 'public_redistribution'
  | 'commercial_resale'
  | 'export';

export type DataUsageRestriction =
  | DataUsageOperation
  | 'model_training_prohibited'
  | 'external_model_training'
  | 'unattributed_display'
  | 'raw_data_export'
  | 'derived_data_export'
  | (string & {});

export interface DataUsagePolicyArtifact {
  artifactType: 'DataUsagePolicy';
  schemaVersion: 'trackmind.racing-data-usage-policy.v1';
  id: string;
  providerId: string;
  providerName?: string;
  licenseId?: string;
  licenseName?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  allowedUses: DataUsageOperation[];
  restrictedUses: DataUsageRestriction[];
  requiresAttribution: boolean;
  attributionText?: string;
  retentionDays: number;
  exportAllowed: boolean;
  redistributionAllowed: boolean;
  commercialUseAllowed: boolean;
  modelTrainingAllowed: boolean;
  modelTrainingRestriction?: DataUsageRestriction;
  policyUrl?: string;
  evidence: string[];
}

export type DataUsagePolicyInput =
  & Omit<DataUsagePolicyArtifact, 'artifactType' | 'schemaVersion' | 'evidence' | 'modelTrainingAllowed'>
  & {
    artifactType?: 'DataUsagePolicy';
    schemaVersion?: 'trackmind.racing-data-usage-policy.v1';
    evidence?: string[];
    modelTrainingAllowed?: boolean;
  };

export interface DataUsageCheckInput {
  providerId: string;
  operation: DataUsageOperation;
  actor?: string;
  datasetId?: string;
  tenantId?: string;
  racetrackId?: string;
  correlationId?: string;
  attribution?: string;
  evidence?: string[];
  requestedAt?: string;
  purpose?: string;
}

export interface DataUsageDecision {
  allowed: boolean;
  providerId: string;
  operation: DataUsageOperation;
  policyId?: string;
  datasetId?: string;
  reason?: string;
  reasons: string[];
  requiresAttribution: boolean;
  attributionSatisfied: boolean;
  retentionDays?: number;
  retentionHint?: string;
  exportAllowed?: boolean;
  redistributionAllowed?: boolean;
  commercialUseAllowed?: boolean;
  modelTrainingAllowed?: boolean;
  obligations: string[];
  evidence: string[];
  checkedAt: string;
  auditId?: string;
  eventType?: 'LicenseRestrictionDetected';
}

export interface RacingDataLicensePolicyWorkspace {
  generatedAt: string;
  policies: DataUsagePolicyArtifact[];
  decisions: DataUsageDecision[];
  auditRecords: AuditLogEntry[];
  supportedOperations: DataUsageOperation[];
}

export interface RacingDataLicensePolicyDeps {
  auditLog?: ImmutableAuditLog;
  eventBus?: UniversalEventBus;
  now?: () => string;
}

export const dataUsageOperations: DataUsageOperation[] = [
  'operations',
  'analytics',
  'internal_model_training_only',
  'public_display',
  'public_redistribution',
  'commercial_resale',
  'export',
];

export const licenseRestrictionDetectedEventContract: EventContract = {
  type: 'license.restriction.detected',
  version: 1,
  description: 'A racing data provider license or usage policy blocked a requested data operation.',
  owner: { service: 'racing-data-license-policy', team: 'data-and-ai-governance', accountableRole: 'compliance-officer' },
  payloadFields: ['eventName', 'providerId', 'operation', 'reasons', 'policyId'],
  compliance: 'regulated',
  operationalMetadata: { eventName: 'LicenseRestrictionDetected', retention: 'provider-policy-retention' },
};

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const unique = <T extends string>(values: readonly T[]): T[] => [...new Set(values.filter(Boolean))];

function requireKnownOperation(operation: string): DataUsageOperation {
  if (!dataUsageOperations.includes(operation as DataUsageOperation)) throw new Error(`Unknown data usage operation ${operation}`);
  return operation as DataUsageOperation;
}

function normalizedRestriction(restriction: DataUsageRestriction): DataUsageRestriction {
  return restriction.trim().toLowerCase().replace(/\s+/g, '_') as DataUsageRestriction;
}

function isRestricted(restrictedUses: DataUsageRestriction[], operation: DataUsageOperation): boolean {
  const restrictions = new Set(restrictedUses.map(normalizedRestriction));
  return restrictions.has(operation) || (operation === 'internal_model_training_only' && (restrictions.has('model_training_prohibited') || restrictions.has('external_model_training')));
}

function retentionHint(days: number): string {
  return `Retain provider data and derived artifacts for no more than ${days} days unless a stricter legal hold applies.`;
}

export class RacingDataLicensePolicyService {
  private readonly policies = new Map<string, DataUsagePolicyArtifact>();
  private readonly decisions: DataUsageDecision[] = [];
  private sequence = 0;

  constructor(policies: DataUsagePolicyInput[] = [], private readonly deps: RacingDataLicensePolicyDeps = {}) {
    if (deps.eventBus) deps.eventBus.registerEvent(licenseRestrictionDetectedEventContract);
    policies.forEach((policy) => this.upsertPolicy(policy));
  }

  upsertPolicy(policy: DataUsagePolicyInput): DataUsagePolicyArtifact {
    const normalized = this.normalizePolicy(policy);
    this.policies.set(normalized.providerId, normalized);
    return clone(normalized);
  }

  getPolicy(providerId: string): DataUsagePolicyArtifact | undefined {
    const policy = this.policies.get(providerId);
    return policy ? clone(policy) : undefined;
  }

  listPolicies(): DataUsagePolicyArtifact[] {
    return [...this.policies.values()].map(clone);
  }

  serializePolicy(providerIdOrPolicy: string | DataUsagePolicyInput): DataUsagePolicyArtifact {
    if (typeof providerIdOrPolicy === 'string') {
      const policy = this.getPolicy(providerIdOrPolicy);
      if (!policy) throw new Error(`Unknown racing data provider policy ${providerIdOrPolicy}`);
      return policy;
    }
    return this.normalizePolicy(providerIdOrPolicy);
  }

  checkUsage(input: DataUsageCheckInput): DataUsageDecision {
    const operation = requireKnownOperation(input.operation);
    const checkedAt = input.requestedAt ?? this.now();
    const evidence = unique([...(input.evidence ?? []), `provider:${input.providerId}`, `operation:${operation}`]);
    const policy = this.policies.get(input.providerId);
    const reasons: string[] = [];
    const obligations: string[] = [];

    if (!policy) {
      reasons.push(`No DataUsagePolicy is registered for provider ${input.providerId}.`);
    } else {
      const allowedUses = new Set(policy.allowedUses);
      if (!allowedUses.has(operation)) reasons.push(`Operation ${operation} is not listed in allowedUses for provider ${policy.providerId}.`);
      if (isRestricted(policy.restrictedUses, operation)) reasons.push(`Operation ${operation} is restricted by provider ${policy.providerId}.`);
      if (operation === 'internal_model_training_only' && !policy.modelTrainingAllowed) reasons.push(policy.modelTrainingRestriction ? `Model training is restricted by ${policy.modelTrainingRestriction}.` : 'Model training is not allowed by this provider policy.');
      if (operation === 'public_redistribution' && !policy.redistributionAllowed) reasons.push('Public redistribution is not allowed by this provider policy.');
      if (operation === 'commercial_resale' && !policy.commercialUseAllowed) reasons.push('Commercial resale is not allowed by this provider policy.');
      if (operation === 'export' && !policy.exportAllowed) reasons.push('Export is not allowed by this provider policy.');
      if (operation === 'public_display' && policy.requiresAttribution && !input.attribution?.trim()) reasons.push('Provider attribution is required before public display.');
      if (policy.requiresAttribution) obligations.push(`Attribute provider ${policy.providerId}${policy.attributionText ? ` as "${policy.attributionText}"` : ''}.`);
      obligations.push(retentionHint(policy.retentionDays));
    }

    const decision: DataUsageDecision = {
      allowed: reasons.length === 0,
      providerId: input.providerId,
      operation,
      policyId: policy?.id,
      datasetId: input.datasetId,
      reason: reasons[0],
      reasons,
      requiresAttribution: policy?.requiresAttribution ?? false,
      attributionSatisfied: Boolean(!policy?.requiresAttribution || input.attribution?.trim()),
      retentionDays: policy?.retentionDays,
      retentionHint: policy ? retentionHint(policy.retentionDays) : undefined,
      exportAllowed: policy?.exportAllowed,
      redistributionAllowed: policy?.redistributionAllowed,
      commercialUseAllowed: policy?.commercialUseAllowed,
      modelTrainingAllowed: policy?.modelTrainingAllowed,
      obligations,
      evidence,
      checkedAt,
    };

    if (!decision.allowed) {
      const audit = this.recordLicenseRestriction(input, policy, decision);
      decision.auditId = audit?.id;
      decision.eventType = 'LicenseRestrictionDetected';
    }

    this.decisions.push(clone(decision));
    return clone(decision);
  }

  decisionsLog(): DataUsageDecision[] {
    return this.decisions.map(clone);
  }

  workspace(generatedAt = this.now()): RacingDataLicensePolicyWorkspace {
    return {
      generatedAt,
      policies: this.listPolicies(),
      decisions: this.decisionsLog(),
      auditRecords: this.deps.auditLog?.all() ?? [],
      supportedOperations: [...dataUsageOperations],
    };
  }

  private normalizePolicy(policy: DataUsagePolicyInput): DataUsagePolicyArtifact {
    if (!policy.providerId) throw new Error('DataUsagePolicy providerId is required');
    if (!policy.id) throw new Error(`DataUsagePolicy id is required for provider ${policy.providerId}`);
    if (!Number.isInteger(policy.retentionDays) || policy.retentionDays < 0) throw new Error(`DataUsagePolicy retentionDays must be a non-negative integer for provider ${policy.providerId}`);
    if (policy.modelTrainingAllowed === undefined && !policy.modelTrainingRestriction) throw new Error(`DataUsagePolicy must include modelTrainingAllowed or an explicit modelTrainingRestriction for provider ${policy.providerId}`);
    const allowedUses = unique(policy.allowedUses.map(requireKnownOperation));
    const restrictedUses = unique((policy.restrictedUses ?? []).map(normalizedRestriction));
    return {
      artifactType: 'DataUsagePolicy',
      schemaVersion: 'trackmind.racing-data-usage-policy.v1',
      ...clone(policy),
      allowedUses,
      restrictedUses,
      requiresAttribution: Boolean(policy.requiresAttribution),
      retentionDays: policy.retentionDays,
      exportAllowed: Boolean(policy.exportAllowed),
      redistributionAllowed: Boolean(policy.redistributionAllowed),
      commercialUseAllowed: Boolean(policy.commercialUseAllowed),
      modelTrainingAllowed: policy.modelTrainingAllowed ?? false,
      evidence: [...(policy.evidence ?? [])],
    };
  }

  private recordLicenseRestriction(input: DataUsageCheckInput, policy: DataUsagePolicyArtifact | undefined, decision: DataUsageDecision): AuditLogEntry | undefined {
    const timestamp = input.requestedAt ?? decision.checkedAt;
    const auditId = `audit-license-restriction-${++this.sequence}`;
    const payload = {
      eventName: 'LicenseRestrictionDetected',
      providerId: input.providerId,
      policyId: policy?.id,
      datasetId: input.datasetId,
      operation: decision.operation,
      purpose: input.purpose,
      reasons: [...decision.reasons],
      retentionDays: policy?.retentionDays,
      requiresAttribution: policy?.requiresAttribution ?? false,
      exportAllowed: policy?.exportAllowed,
      redistributionAllowed: policy?.redistributionAllowed,
      commercialUseAllowed: policy?.commercialUseAllowed,
      modelTrainingAllowed: policy?.modelTrainingAllowed,
      modelTrainingRestriction: policy?.modelTrainingRestriction,
    };
    const audit = this.deps.auditLog?.append({
      id: auditId,
      type: 'regulatory-activity',
      actor: input.actor ?? 'racing-data-license-policy',
      actorType: input.actor ? 'api' : 'service',
      timestamp,
      action: 'LicenseRestrictionDetected',
      actionClass: 'compliance',
      target: input.providerId,
      decision: 'blocked',
      sourceService: 'racing-data-license-policy',
      subjectId: input.datasetId ?? input.providerId,
      tenantId: input.tenantId,
      correlationId: input.correlationId ?? auditId,
      severity: decision.operation === 'commercial_resale' || decision.operation === 'public_redistribution' || decision.operation === 'internal_model_training_only' ? 'critical' : 'warning',
      regulations: ['provider-license', 'data-governance', 'responsible-ai'],
      evidenceIds: unique([...(input.evidence ?? []), ...(policy?.evidence ?? []), policy ? `policy:${policy.id}` : `provider:${input.providerId}:policy-missing`]),
      payload,
    });
    void this.deps.eventBus?.publish({
      type: 'license.restriction.detected',
      payload,
      producer: 'racing-data-license-policy',
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
      aggregateId: input.datasetId ?? input.providerId,
      correlationId: input.correlationId ?? auditId,
      auditRef: audit?.id ?? auditId,
      actor: { id: input.actor ?? 'racing-data-license-policy', type: 'service' },
      subject: { id: input.datasetId ?? input.providerId, type: 'data-usage-policy', tenantId: input.tenantId ?? 'unknown-tenant' },
      evidence: unique([...(input.evidence ?? []), audit?.id ?? auditId]),
      metadata: { eventName: 'LicenseRestrictionDetected', compliance: 'regulated', team: 'data-and-ai-governance', accountableRole: 'compliance-officer', providerId: input.providerId, policyId: policy?.id },
    }).catch(() => undefined);
    return audit;
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }
}

export function seededRacingDataLicensePolicyService(now = new Date().toISOString(), deps: Omit<RacingDataLicensePolicyDeps, 'now'> = {}): RacingDataLicensePolicyService {
  const service = new RacingDataLicensePolicyService([
    {
      id: 'policy-provider-trackfeed-basic-v1',
      providerId: 'provider-trackfeed-basic',
      providerName: 'TrackFeed Basic',
      licenseId: 'license-trackfeed-basic-2026',
      licenseName: 'TrackFeed Internal Operations License',
      effectiveFrom: '2026-01-01',
      allowedUses: ['operations', 'analytics', 'public_display'],
      restrictedUses: ['public_redistribution', 'commercial_resale', 'external_model_training'],
      requiresAttribution: true,
      attributionText: 'TrackFeed Basic',
      retentionDays: 30,
      exportAllowed: false,
      redistributionAllowed: false,
      commercialUseAllowed: false,
      modelTrainingAllowed: false,
      modelTrainingRestriction: 'model_training_prohibited',
      policyUrl: 'provider-license://trackfeed-basic/2026',
      evidence: ['license-trackfeed-basic-2026', 'provider-policy-review'],
    },
    {
      id: 'policy-provider-racing-analytics-pro-v1',
      providerId: 'provider-racing-analytics-pro',
      providerName: 'Racing Analytics Pro',
      licenseId: 'license-rap-enterprise-2026',
      licenseName: 'Enterprise Analytics and Internal Training License',
      effectiveFrom: '2026-01-01',
      allowedUses: ['operations', 'analytics', 'internal_model_training_only', 'public_display', 'export'],
      restrictedUses: ['public_redistribution', 'commercial_resale'],
      requiresAttribution: false,
      retentionDays: 365,
      exportAllowed: true,
      redistributionAllowed: false,
      commercialUseAllowed: false,
      modelTrainingAllowed: true,
      policyUrl: 'provider-license://racing-analytics-pro/enterprise-2026',
      evidence: ['license-rap-enterprise-2026', 'model-training-addendum'],
    },
  ], { ...deps, now: () => now });
  return service;
}
