import { domainSchemas, type DataClassification, type DomainEntityKind } from './domainKernel.js';
import { featureStoreSchemaVersion, type FeatureDomain } from './featureStore.js';
import { nexusDigitalTwinAssetKinds, nexusEventContracts, type NexusDigitalTwinAssetKind } from './nexusUpgrade.js';

export const unifiedDataModelSchemaVersion = 'trackmind.unified-data-model.v1' as const;

export type CanonicalStoreType = 'data-lake' | 'feature-store' | 'knowledge-graph' | 'digital-twin-graph' | 'event-store' | 'audit-store';
export type StoreRetentionCategory = 'operational-hot' | 'regulated-record' | 'forensic-ledger' | 'analytics-archive' | 'derived-feature';
export type CanonicalStoreId = `store:${CanonicalStoreType}:${string}`;
export type TUSCanonicalEntityKind = DomainEntityKind | 'tus-asset-standard' | 'tus-twin-standard' | 'feature-record' | 'nexus-event' | 'audit-log-entry';

export interface StoreScopeDescriptor {
  tenantScoped: true;
  racetrackScoped: boolean;
  tenancyModel: 'tenant-partitioned' | 'tenant-racetrack-partitioned' | 'regulated-shared-reference';
}

export interface StoreRetentionDescriptor {
  policyId: string;
  category: StoreRetentionCategory;
  retainForDays?: number;
  legalHoldSupported: boolean;
  disposition: 'retain' | 'archive' | 'derived-rebuildable';
}

export interface StoreGovernanceControls {
  classification: DataClassification;
  controls: string[];
  accessPermissions: string[];
  approvalRequiredForWrites: boolean;
  appendOnly: boolean;
  immutableHashChain: boolean;
  pii: 'none' | 'possible' | 'regulated';
}

export interface StoreLineageLinks {
  eventTypes: string[];
  auditActions: string[];
  twinKinds: NexusDigitalTwinAssetKind[];
  featureSets: string[];
  aiRecommendationRefs: string[];
}

export interface CanonicalStoreDescriptor {
  schemaVersion: typeof unifiedDataModelSchemaVersion;
  storeId: CanonicalStoreId;
  storeType: CanonicalStoreType;
  displayName: string;
  description: string;
  scope: StoreScopeDescriptor;
  sourceDomains: string[];
  recordTypes: string[];
  retention: StoreRetentionDescriptor;
  governanceControls: StoreGovernanceControls;
  lineage: StoreLineageLinks;
  runtimeFacade: {
    facadeOnly: true;
    backingDependency: 'none';
    apiPaths: string[];
  };
}

export interface TUSEntityStoreMapping {
  entityKind: TUSCanonicalEntityKind;
  storeIds: CanonicalStoreId[];
  recordTypes: string[];
  requiredScope: StoreScopeDescriptor;
  governanceControls: string[];
  lineageRequired: Array<'event' | 'audit' | 'twin' | 'feature' | 'recommendation'>;
}

export interface UnifiedLineageContract {
  schemaVersion: typeof unifiedDataModelSchemaVersion;
  lineageId: string;
  entity: {
    entityKind: TUSCanonicalEntityKind;
    entityId: string;
    tenantId: string;
    racetrackId?: string;
  };
  storeIds: CanonicalStoreId[];
  upstreamStoreIds: CanonicalStoreId[];
  downstreamStoreIds: CanonicalStoreId[];
  eventIds: string[];
  auditIds: string[];
  twinIds: string[];
  featureRecordIds: string[];
  recommendationIds: string[];
  governanceControls: string[];
  evidence: string[];
}

export interface UnifiedDataModelWorkspace {
  schemaVersion: typeof unifiedDataModelSchemaVersion;
  generatedAt: string;
  scope: { tenantId: string; racetrackId: string };
  stores: CanonicalStoreDescriptor[];
  tusEntityMappings: TUSEntityStoreMapping[];
  lineageContracts: UnifiedLineageContract[];
  coverage: {
    storeTypes: CanonicalStoreType[];
    entityKinds: TUSCanonicalEntityKind[];
    eventStoreRepresented: boolean;
    auditStoreRepresented: boolean;
    twinGraphRepresented: boolean;
    featureStoreRepresented: boolean;
    governanceControls: string[];
  };
  mock: false;
}

const allDomainEntityKinds = Object.keys(domainSchemas) as DomainEntityKind[];
const allNexusEventTypes = nexusEventContracts.map((contract) => contract.eventType);
const allTwinKinds = [...nexusDigitalTwinAssetKinds];
const featureDomains: FeatureDomain[] = ['surface', 'gate', 'race', 'horse', 'security', 'weather', 'operations'];

const scope: StoreScopeDescriptor = { tenantScoped: true, racetrackScoped: true, tenancyModel: 'tenant-racetrack-partitioned' };
const tenantReferenceScope: StoreScopeDescriptor = { tenantScoped: true, racetrackScoped: false, tenancyModel: 'tenant-partitioned' };

export const canonicalStoreDescriptors: CanonicalStoreDescriptor[] = [
  {
    schemaVersion: unifiedDataModelSchemaVersion,
    storeId: 'store:data-lake:regulated-archive',
    storeType: 'data-lake',
    displayName: 'Regulated Data Lake Archive',
    description: 'Facade metadata for the eventual immutable lake landing zone across operational, AI, event, audit, and twin records.',
    scope,
    sourceDomains: ['race-operations', 'equine-safety', 'track-assets', 'security', 'compliance', 'ai-governance', 'digital-twin'],
    recordTypes: ['TUSAssetStandardDto', 'TUSTwinStandardDto', 'DomainEntity', 'FeatureRecord', 'RaceDayEvent', 'AuditLogEntry'],
    retention: { policyId: 'regulated-racing-archive-7y', category: 'analytics-archive', retainForDays: 2555, legalHoldSupported: true, disposition: 'archive' },
    governanceControls: { classification: 'regulated', controls: ['tenant-isolation', 'racetrack-partitioning', 'legal-hold', 'evidence-retention', 'read-audit'], accessPermissions: ['read:any', 'compliance:audit'], approvalRequiredForWrites: false, appendOnly: true, immutableHashChain: false, pii: 'possible' },
    lineage: { eventTypes: allNexusEventTypes, auditActions: ['data.lake.ingested', 'data.lineage.recorded'], twinKinds: allTwinKinds, featureSets: [featureStoreSchemaVersion, 'surface-risk-v1'], aiRecommendationRefs: ['ai.recommendation.created.v1', 'ai.recommendation.recorded.v1'] },
    runtimeFacade: { facadeOnly: true, backingDependency: 'none', apiPaths: ['/api/v1/tus/data-model'] },
  },
  {
    schemaVersion: unifiedDataModelSchemaVersion,
    storeId: 'store:feature-store:governed-features',
    storeType: 'feature-store',
    displayName: 'Governed Feature Store',
    description: 'Canonical metadata for deterministic feature records and AI feature-set lineage without provisioning a real feature database.',
    scope,
    sourceDomains: featureDomains,
    recordTypes: [`FeatureRecord:${featureStoreSchemaVersion}`, 'FeatureRecordDto', 'AIFeatureSet', 'AI input quality metadata'],
    retention: { policyId: 'feature-lineage-retention-1y', category: 'derived-feature', retainForDays: 365, legalHoldSupported: true, disposition: 'derived-rebuildable' },
    governanceControls: { classification: 'restricted', controls: ['lineage-required', 'input-quality-score', 'stale-input-review', 'tenant-isolation'], accessPermissions: ['ai:approve', 'read:any'], approvalRequiredForWrites: false, appendOnly: false, immutableHashChain: false, pii: 'possible' },
    lineage: { eventTypes: ['ai.input.ingested.v1', 'ai.feature-set.built.v1', 'ai.features.built.v1', 'ai.confidence.adjusted.v1'], auditActions: ['ai.feature-set.built', 'ai.feature-lineage.recorded'], twinKinds: ['ai-agent', 'track-sector', 'horse', 'facility'], featureSets: [featureStoreSchemaVersion, 'surface-risk-v1', 'race-readiness-v1'], aiRecommendationRefs: ['rec-harrow-7', 'rec-race-start'] },
    runtimeFacade: { facadeOnly: true, backingDependency: 'none', apiPaths: ['/api/v1/ai-control-plane/features', '/api/v1/ai-control-plane/workspace'] },
  },
  {
    schemaVersion: unifiedDataModelSchemaVersion,
    storeId: 'store:knowledge-graph:domain-relations',
    storeType: 'knowledge-graph',
    displayName: 'Knowledge Graph Relation Catalog',
    description: 'Semantic relationship metadata for TUS entities, evidence, policy, model, and regulated domain relationships.',
    scope,
    sourceDomains: ['domain-kernel', 'compliance', 'race-office', 'stewarding', 'equine', 'barns', 'security', 'ai-governance'],
    recordTypes: ['DomainEntity', ...allDomainEntityKinds.map((kind) => `DomainEntity:${kind}`), 'TUS relationship edge', 'EvidenceReference'],
    retention: { policyId: 'semantic-context-retention-3y', category: 'regulated-record', retainForDays: 1095, legalHoldSupported: true, disposition: 'retain' },
    governanceControls: { classification: 'regulated', controls: ['tenant-isolation', 'relationship-evidence-required', 'policy-tagging', 'source-system-reference'], accessPermissions: ['read:any', 'compliance:audit'], approvalRequiredForWrites: true, appendOnly: false, immutableHashChain: false, pii: 'regulated' },
    lineage: { eventTypes: ['asset.registry.changed.v1', 'race.office.changed.v1', 'compliance.evidence.collected.v1', 'ai.recommendation.recorded.v1'], auditActions: ['knowledge.relationship.upserted', 'compliance.evidence.collected'], twinKinds: allTwinKinds, featureSets: [], aiRecommendationRefs: ['AIRecommendationEntity'] },
    runtimeFacade: { facadeOnly: true, backingDependency: 'none', apiPaths: ['/api/v1/tus/standardization', '/api/v1/tus/data-model'] },
  },
  {
    schemaVersion: unifiedDataModelSchemaVersion,
    storeId: 'store:digital-twin-graph:runtime-state',
    storeType: 'digital-twin-graph',
    displayName: 'Digital Twin Graph Runtime Metadata',
    description: 'Canonical descriptor for twin nodes, relationships, state update history, and approval-aware twin synchronization.',
    scope,
    sourceDomains: ['digital-twin', 'track-assets', 'surface', 'facilities', 'equine', 'ai-governance'],
    recordTypes: ['TwinNode', 'TwinRelationship', 'TwinStateUpdate', 'DigitalTwinStateDto', 'TUSTwinStandardDto'],
    retention: { policyId: 'twin-state-history-18m', category: 'operational-hot', retainForDays: 548, legalHoldSupported: true, disposition: 'retain' },
    governanceControls: { classification: 'restricted', controls: ['read-only-source-of-truth', 'approval-gated-sync', 'tenant-isolation', 'state-history'], accessPermissions: ['read:any', 'track:readings'], approvalRequiredForWrites: true, appendOnly: false, immutableHashChain: false, pii: 'possible' },
    lineage: { eventTypes: ['asset.registry.changed.v1', 'surface.measurement.recorded.v1', 'ai.digital-twin.impact.queued.v1'], auditActions: ['digital-twin.state.updated', 'ai.digital-twin.impact.queued'], twinKinds: allTwinKinds, featureSets: ['surface-risk-v1'], aiRecommendationRefs: ['digitalTwinImpacts'] },
    runtimeFacade: { facadeOnly: true, backingDependency: 'none', apiPaths: ['/api/v1/digital-twin/state', '/api/v1/digital-twin/standard'] },
  },
  {
    schemaVersion: unifiedDataModelSchemaVersion,
    storeId: 'store:event-store:nexus-backbone',
    storeType: 'event-store',
    displayName: 'Nexus Event Store Backbone',
    description: 'Replayable event backbone metadata aligned to UniversalEventBus contracts and Nexus event envelopes.',
    scope,
    sourceDomains: ['event-backbone', 'workflow', 'approvals', 'audit', 'ai-governance', 'platform-health'],
    recordTypes: ['RaceDayEvent', 'NexusEventEnvelope', 'EventContract', 'DeadLetterEntry'],
    retention: { policyId: 'event-backbone-retention-2y', category: 'regulated-record', retainForDays: 730, legalHoldSupported: true, disposition: 'retain' },
    governanceControls: { classification: 'regulated', controls: ['correlation-required', 'audit-ref-required', 'tenant-isolation', 'replay-governed'], accessPermissions: ['read:any', 'compliance:audit'], approvalRequiredForWrites: false, appendOnly: true, immutableHashChain: false, pii: 'possible' },
    lineage: { eventTypes: allNexusEventTypes, auditActions: ['system-event', 'audit-log-event-sink'], twinKinds: allTwinKinds, featureSets: [featureStoreSchemaVersion], aiRecommendationRefs: ['ai.recommendation.created.v1', 'ai.action.blocked.v1'] },
    runtimeFacade: { facadeOnly: true, backingDependency: 'none', apiPaths: ['/api/v1/events/catalog', '/api/v1/events/stream'] },
  },
  {
    schemaVersion: unifiedDataModelSchemaVersion,
    storeId: 'store:audit-store:immutable-ledger',
    storeType: 'audit-store',
    displayName: 'Immutable Audit Store Ledger',
    description: 'Hash-chain audit ledger metadata for user, service, workflow, AI, approval, event, and twin actions.',
    scope: tenantReferenceScope,
    sourceDomains: ['audit-ledger', 'compliance', 'approvals', 'ai-governance', 'security', 'digital-twin'],
    recordTypes: ['AuditLogEntry', 'AuditEventEntity', 'AuditRecordEntity', 'AuditComplianceExport', 'EvidenceReference'],
    retention: { policyId: 'regulated-audit-ledger-7y', category: 'forensic-ledger', retainForDays: 2555, legalHoldSupported: true, disposition: 'retain' },
    governanceControls: { classification: 'regulated', controls: ['immutable-hash-chain', 'chain-of-custody', 'legal-hold', 'forensic-export', 'tenant-isolation'], accessPermissions: ['compliance:audit', 'audit:read'], approvalRequiredForWrites: false, appendOnly: true, immutableHashChain: true, pii: 'regulated' },
    lineage: { eventTypes: ['audit.event.recorded.v1', 'audit.record.appended.v1', 'approval.request.transitioned.v1', 'ai.recommendation.recorded.v1'], auditActions: ['audit.read', 'audit.verify', 'approval.requested', 'ai.recommendation.blocked'], twinKinds: ['workflow', 'approval', 'incident', 'ai-agent'], featureSets: [], aiRecommendationRefs: ['AIRecommendationEntity', 'blockedAutonomousExecutionLogs'] },
    runtimeFacade: { facadeOnly: true, backingDependency: 'none', apiPaths: ['/api/v1/audit/events', '/api/v1/audit/verification', '/api/v1/audit/evidence-path'] },
  },
];

const storeIds = canonicalStoreDescriptors.map((store) => store.storeId);
const storeIdsFor = (...types: CanonicalStoreType[]): CanonicalStoreId[] => canonicalStoreDescriptors.filter((store) => types.includes(store.storeType)).map((store) => store.storeId);
const twinEntityKinds = new Set<TUSCanonicalEntityKind>(['tus-asset-standard', 'tus-twin-standard', 'racetrack', 'race-meet', 'race-day', 'race', 'horse', 'jockey', 'trainer', 'owner', 'veterinarian', 'steward', 'barn', 'stall', 'track-sector', 'facility', 'asset', 'starting-gate', 'sensor', 'vehicle', 'workflow', 'approval', 'incident', 'ai-recommendation']);

function mappingForEntity(entityKind: TUSCanonicalEntityKind): TUSEntityStoreMapping {
  const baseTypes: CanonicalStoreType[] = ['data-lake', 'knowledge-graph'];
  if (twinEntityKinds.has(entityKind)) baseTypes.push('digital-twin-graph');
  if (entityKind === 'feature-record' || entityKind === 'ai-recommendation' || entityKind === 'race' || entityKind === 'horse' || entityKind === 'track-sector') baseTypes.push('feature-store');
  if (entityKind === 'nexus-event' || entityKind === 'audit-event' || entityKind === 'workflow' || entityKind === 'approval' || entityKind === 'ai-recommendation') baseTypes.push('event-store');
  if (entityKind === 'audit-log-entry' || entityKind === 'audit-event' || entityKind === 'audit-record' || entityKind === 'approval' || entityKind === 'workflow' || entityKind === 'ai-recommendation') baseTypes.push('audit-store');

  const requiredLineage: TUSEntityStoreMapping['lineageRequired'] = ['event', 'audit'];
  if (baseTypes.includes('digital-twin-graph')) requiredLineage.push('twin');
  if (baseTypes.includes('feature-store')) requiredLineage.push('feature');
  if (entityKind === 'ai-recommendation') requiredLineage.push('recommendation');

  return {
    entityKind,
    storeIds: [...new Set(storeIdsFor(...baseTypes))],
    recordTypes: [entityKind, entityKind.startsWith('tus-') ? entityKind : `DomainEntity:${entityKind}`],
    requiredScope: scope,
    governanceControls: ['tenant-isolation', 'classification-label', 'evidence-lineage', 'retention-policy'],
    lineageRequired: [...new Set(requiredLineage)],
  };
}

export const unifiedTusEntityStoreMappings: TUSEntityStoreMapping[] = [
  'tus-asset-standard',
  'tus-twin-standard',
  'feature-record',
  'nexus-event',
  'audit-log-entry',
  ...allDomainEntityKinds,
].map((entityKind) => mappingForEntity(entityKind as TUSCanonicalEntityKind));

export function listCanonicalStoreDescriptors(): CanonicalStoreDescriptor[] {
  return canonicalStoreDescriptors.map(clone);
}

export function findStoresForTUSEntity(entityKind: TUSCanonicalEntityKind): CanonicalStoreDescriptor[] {
  const mapping = unifiedTusEntityStoreMappings.find((item) => item.entityKind === entityKind);
  if (!mapping) return [];
  const ids = new Set(mapping.storeIds);
  return canonicalStoreDescriptors.filter((store) => ids.has(store.storeId)).map(clone);
}

export function createUnifiedLineageContract(input: {
  entityKind: TUSCanonicalEntityKind;
  entityId: string;
  tenantId: string;
  racetrackId?: string;
  storeIds?: CanonicalStoreId[];
  eventIds?: string[];
  auditIds?: string[];
  twinIds?: string[];
  featureRecordIds?: string[];
  recommendationIds?: string[];
  evidence?: string[];
}): UnifiedLineageContract {
  const mapping = unifiedTusEntityStoreMappings.find((item) => item.entityKind === input.entityKind);
  const mappedStoreIds = input.storeIds ?? mapping?.storeIds ?? storeIds;
  return {
    schemaVersion: unifiedDataModelSchemaVersion,
    lineageId: `lineage:${input.tenantId}:${input.entityKind}:${input.entityId}`,
    entity: { entityKind: input.entityKind, entityId: input.entityId, tenantId: input.tenantId, racetrackId: input.racetrackId },
    storeIds: [...mappedStoreIds],
    upstreamStoreIds: canonicalStoreDescriptors.filter((store) => store.storeType === 'event-store' || store.storeType === 'audit-store').map((store) => store.storeId),
    downstreamStoreIds: canonicalStoreDescriptors.filter((store) => store.storeType === 'data-lake' || store.storeType === 'knowledge-graph').map((store) => store.storeId),
    eventIds: [...(input.eventIds ?? [])],
    auditIds: [...(input.auditIds ?? [])],
    twinIds: [...(input.twinIds ?? [])],
    featureRecordIds: [...(input.featureRecordIds ?? [])],
    recommendationIds: [...(input.recommendationIds ?? [])],
    governanceControls: [...(mapping?.governanceControls ?? ['tenant-isolation', 'retention-policy'])],
    evidence: [...(input.evidence ?? [])],
  };
}

export function createUnifiedDataModelWorkspace(generatedAt = new Date().toISOString(), input: { tenantId?: string; racetrackId?: string } = {}): UnifiedDataModelWorkspace {
  const tenantId = input.tenantId ?? 'trackmind';
  const racetrackId = input.racetrackId ?? 'main-track';
  const lineageContracts = [
    createUnifiedLineageContract({ entityKind: 'tus-asset-standard', entityId: 'asset:gate-1', tenantId, racetrackId, eventIds: ['asset.registry.changed.v1'], auditIds: ['audit-asset-1'], twinIds: ['twin:asset:gate-1'], evidence: ['asset-registry'] }),
    createUnifiedLineageContract({ entityKind: 'tus-twin-standard', entityId: 'twin:sector:far-turn', tenantId, racetrackId, eventIds: ['surface.measurement.recorded.v1'], auditIds: ['audit-twin-1'], twinIds: ['twin:sector:far-turn'], featureRecordIds: ['feature:surface:trackmind:far-turn:corr-ai-facade'], evidence: ['digital-twin-runtime'] }),
    createUnifiedLineageContract({ entityKind: 'ai-recommendation', entityId: 'rec-harrow-7', tenantId, racetrackId, eventIds: ['ai.recommendation.recorded.v1'], auditIds: ['audit-ai-rec-1'], twinIds: ['twin:sector:far-turn'], featureRecordIds: ['feature:surface:trackmind:far-turn:corr-ai-facade'], recommendationIds: ['rec-harrow-7'], evidence: ['feature-store:surface-risk-v1', 'human-approval-record'] }),
  ];
  const governanceControls = unique(canonicalStoreDescriptors.flatMap((store) => store.governanceControls.controls));
  return {
    schemaVersion: unifiedDataModelSchemaVersion,
    generatedAt,
    scope: { tenantId, racetrackId },
    stores: listCanonicalStoreDescriptors(),
    tusEntityMappings: unifiedTusEntityStoreMappings.map(clone),
    lineageContracts,
    coverage: {
      storeTypes: canonicalStoreDescriptors.map((store) => store.storeType),
      entityKinds: unifiedTusEntityStoreMappings.map((mapping) => mapping.entityKind),
      eventStoreRepresented: canonicalStoreDescriptors.some((store) => store.storeType === 'event-store'),
      auditStoreRepresented: canonicalStoreDescriptors.some((store) => store.storeType === 'audit-store'),
      twinGraphRepresented: canonicalStoreDescriptors.some((store) => store.storeType === 'digital-twin-graph'),
      featureStoreRepresented: canonicalStoreDescriptors.some((store) => store.storeType === 'feature-store'),
      governanceControls,
    },
    mock: false,
  };
}

export function validateUnifiedDataModelWorkspace(workspace: UnifiedDataModelWorkspace): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set(workspace.stores.map((store) => store.storeId));
  for (const type of ['data-lake', 'feature-store', 'knowledge-graph', 'digital-twin-graph', 'event-store', 'audit-store'] as const) {
    if (!workspace.stores.some((store) => store.storeType === type)) errors.push(`store type missing: ${type}`);
  }
  for (const store of workspace.stores) {
    if (store.schemaVersion !== unifiedDataModelSchemaVersion) errors.push(`${store.storeId} schemaVersion mismatch`);
    if (!store.scope.tenantScoped) errors.push(`${store.storeId} must be tenant scoped`);
    if (store.sourceDomains.length === 0) errors.push(`${store.storeId} must declare source domains`);
    if (store.recordTypes.length === 0) errors.push(`${store.storeId} must declare record types`);
    if (!store.retention.policyId) errors.push(`${store.storeId} must declare retention policy`);
    if (store.governanceControls.controls.length === 0) errors.push(`${store.storeId} must declare governance controls`);
    if (store.runtimeFacade.backingDependency !== 'none') errors.push(`${store.storeId} must not declare real database dependencies`);
  }
  for (const mapping of workspace.tusEntityMappings) {
    if (mapping.storeIds.length === 0) errors.push(`${mapping.entityKind} must map to at least one store`);
    for (const storeId of mapping.storeIds) if (!ids.has(storeId)) errors.push(`${mapping.entityKind} references unknown store ${storeId}`);
    if (!mapping.requiredScope.tenantScoped) errors.push(`${mapping.entityKind} must require tenant isolation`);
    if (mapping.governanceControls.length === 0) errors.push(`${mapping.entityKind} must declare governance metadata`);
  }
  for (const lineage of workspace.lineageContracts) {
    for (const storeId of lineage.storeIds) if (!ids.has(storeId)) errors.push(`${lineage.lineageId} references unknown store ${storeId}`);
    if (!lineage.entity.tenantId) errors.push(`${lineage.lineageId} must include tenantId`);
    if (lineage.evidence.length === 0) errors.push(`${lineage.lineageId} must include evidence`);
  }
  if (!workspace.coverage.eventStoreRepresented) errors.push('event store must be represented');
  if (!workspace.coverage.auditStoreRepresented) errors.push('audit store must be represented');
  if (!workspace.coverage.twinGraphRepresented) errors.push('digital twin graph must be represented');
  if (!workspace.coverage.featureStoreRepresented) errors.push('feature store must be represented');
  return { valid: errors.length === 0, errors };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
