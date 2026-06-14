import type { DataClassification } from './domainKernel.js';
import type { NexusComplianceFramework } from './nexusUpgrade.js';

export const universalArtifactStorageSchemaVersion = 'trackmind.universal-artifact-storage.v1' as const;

export const universalArtifactStorageArtifactTypes = [
  'asset',
  'digital-twin',
  'event',
  'telemetry',
  'audit-record',
  'audit',
  'recommendation',
  'approval',
  'feature-record',
  'feature',
  'document',
  'dataset',
  'compliance-control',
  'compliance',
  'workflow',
  'evidence-package',
  'investigation',
  'insight',
  'forecast',
] as const;
export type UniversalArtifactStorageArtifactType = typeof universalArtifactStorageArtifactTypes[number];

export const universalArtifactStoreKinds = [
  'event-store',
  'audit-store',
  'digital-twin-store',
  'knowledge-graph',
  'feature-store',
  'document-store',
  'data-lake',
] as const;
export type UniversalArtifactStoreKind = typeof universalArtifactStoreKinds[number];
export type UniversalArtifactStoreId = `artifact-store:${UniversalArtifactStoreKind}:${string}`;
export type UniversalArtifactRetentionCategory = 'operational-hot' | 'regulated-record' | 'forensic-ledger' | 'analytics-archive' | 'derived-rebuildable';

export interface UniversalArtifactPartitioning {
  tenantScoped: true;
  racetrackScoped: boolean;
  partitionKeys: string[];
  partitionTemplate: string;
  rawCrossTenantAccessAllowed: false;
}

export interface UniversalArtifactRetentionHint {
  policyId: string;
  category: UniversalArtifactRetentionCategory;
  defaultRetentionDays: number;
  legalHoldSupported: boolean;
  disposition: 'retain' | 'archive' | 'rebuildable';
  deletionReview: string;
}

export interface UniversalArtifactPrivacyFlags {
  classification: DataClassification;
  containsPii: boolean;
  containsProtectedHealthInfo: boolean;
  containsFinancialData: boolean;
  containsCredentialData: boolean;
  containsSensitiveTelemetry: boolean;
  restrictedFields: string[];
  redactionRequired: boolean;
}

export interface UniversalArtifactComplianceMapping {
  framework: NexusComplianceFramework;
  controlFamilies: string[];
  evidenceUse: string;
}

export interface UniversalArtifactLineageRequirements {
  eventRefs: boolean;
  auditRefs: boolean;
  twinRefs: boolean;
  approvalRefs: boolean;
  featureRefs: boolean;
  documentRefs: boolean;
  evidenceRefs: boolean;
}

export interface UniversalArtifactStorageAdapterDescriptor {
  schemaVersion: typeof universalArtifactStorageSchemaVersion;
  storeId: UniversalArtifactStoreId;
  storeKind: UniversalArtifactStoreKind;
  displayName: string;
  purpose: string;
  readOnly: true;
  adapterMode: 'metadata-only';
  infrastructure: {
    provisioned: false;
    backingDependency: 'none';
    falseClaimsProhibited: true;
  };
  execution: {
    endpointPaths: string[];
    mutationMethods: string[];
    autonomousExecutionAllowed: false;
  };
  tenantPartitioning: UniversalArtifactPartitioning;
  retention: UniversalArtifactRetentionHint;
  privacy: UniversalArtifactPrivacyFlags;
  complianceMappings: UniversalArtifactComplianceMapping[];
  lineageRequirements: UniversalArtifactLineageRequirements;
  routing: {
    acceptedArtifactTypes: UniversalArtifactStorageArtifactType[];
    serialization: 'descriptor-only-json';
    targetPathTemplate: string;
  };
}

export interface UniversalArtifactReferences {
  assetIds?: string[];
  twinIds?: string[];
  eventIds?: string[];
  auditIds?: string[];
  approvalIds?: string[];
  recommendationIds?: string[];
  featureRecordIds?: string[];
  documentIds?: string[];
  datasetIds?: string[];
  complianceControlIds?: string[];
  workflowIds?: string[];
  evidenceIds?: string[];
  subjectIds?: string[];
}

export interface UniversalArtifactLineage {
  upstreamArtifactIds: string[];
  downstreamArtifactIds: string[];
  eventIds: string[];
  auditIds: string[];
  twinIds: string[];
  featureRecordIds: string[];
  approvalIds: string[];
  evidenceIds: string[];
  sourceSystems: string[];
  correlationId?: string;
  causationId?: string;
}

export interface UniversalArtifactPayloadShape {
  schemaRef: string;
  recordType: string;
  fields: string[];
  descriptorOnly: true;
}

export interface UniversalArtifactDescriptor {
  artifactId: string;
  artifactType: UniversalArtifactStorageArtifactType;
  tenantId: string;
  racetrackId?: string;
  displayName?: string;
  sourceSystem: string;
  sourceUri?: string;
  createdAt?: string;
  updatedAt?: string;
  payloadShape: UniversalArtifactPayloadShape;
  references?: UniversalArtifactReferences;
  lineage: UniversalArtifactLineage;
  retention?: Partial<UniversalArtifactRetentionHint>;
  privacy: UniversalArtifactPrivacyFlags;
  complianceFrameworks: NexusComplianceFramework[];
}

export interface UniversalArtifactStorageTarget {
  schemaVersion: typeof universalArtifactStorageSchemaVersion;
  artifactId: string;
  artifactType: UniversalArtifactStorageArtifactType;
  targetStoreId: UniversalArtifactStoreId;
  storeKind: UniversalArtifactStoreKind;
  readOnly: true;
  executionEndpointPaths: string[];
  tenantPartition: {
    tenantId: string;
    racetrackId?: string;
    partitionKey: string;
  };
  retention: UniversalArtifactRetentionHint;
  privacy: UniversalArtifactPrivacyFlags;
  complianceMappings: UniversalArtifactComplianceMapping[];
  serialization: {
    format: 'descriptor-only-json';
    schemaVersion: typeof universalArtifactStorageSchemaVersion;
    recordType: string;
    sourceSystem: string;
    sourceUri?: string;
  };
  lineage: UniversalArtifactLineage;
}

export interface UniversalArtifactGraphNode {
  id: string;
  kind: UniversalArtifactStorageArtifactType | UniversalArtifactStoreKind;
  labels: string[];
  tenantId: string;
  racetrackId?: string;
  properties: Record<string, string | number | boolean | undefined>;
}

export type UniversalArtifactGraphEdgeType =
  | 'ROUTED_TO_STORE'
  | 'ASSET_REPRESENTED_BY_TWIN'
  | 'EVENT_HAS_AUDIT_RECORD'
  | 'RECOMMENDATION_REQUIRES_APPROVAL'
  | 'REFERENCES_ARTIFACT'
  | 'USES_FEATURE_RECORD'
  | 'EVIDENCED_BY_DOCUMENT'
  | 'GOVERNED_BY_CONTROL';

export interface UniversalArtifactGraphEdge {
  id: string;
  from: string;
  to: string;
  type: UniversalArtifactGraphEdgeType;
  tenantId: string;
  racetrackId?: string;
  evidenceIds: string[];
  readOnly: true;
}

export interface UniversalArtifactGraphProjection {
  schemaVersion: typeof universalArtifactStorageSchemaVersion;
  artifactId: string;
  nodes: UniversalArtifactGraphNode[];
  edges: UniversalArtifactGraphEdge[];
  executionEndpointsAvailable: false;
}

export interface UniversalArtifactSerializationDescriptor {
  schemaVersion: typeof universalArtifactStorageSchemaVersion;
  artifact: UniversalArtifactDescriptor;
  storageTargets: UniversalArtifactStorageTarget[];
  graph: UniversalArtifactGraphProjection;
  noExecutionEndpoints: true;
}

const baseExecution: UniversalArtifactStorageAdapterDescriptor['execution'] = {
  endpointPaths: [],
  mutationMethods: [],
  autonomousExecutionAllowed: false,
};

const tenantRacetrackPartitioning: UniversalArtifactPartitioning = {
  tenantScoped: true,
  racetrackScoped: true,
  partitionKeys: ['tenantId', 'racetrackId', 'artifactType'],
  partitionTemplate: 'tenantId/racetrackId/artifactType',
  rawCrossTenantAccessAllowed: false,
};

const tenantPartitioning: UniversalArtifactPartitioning = {
  tenantScoped: true,
  racetrackScoped: false,
  partitionKeys: ['tenantId', 'artifactType'],
  partitionTemplate: 'tenantId/artifactType',
  rawCrossTenantAccessAllowed: false,
};

const defaultPrivacy: UniversalArtifactPrivacyFlags = {
  classification: 'regulated',
  containsPii: true,
  containsProtectedHealthInfo: false,
  containsFinancialData: false,
  containsCredentialData: false,
  containsSensitiveTelemetry: true,
  restrictedFields: ['personId', 'horseId', 'microchipId', 'credentialId', 'cameraClipUri', 'rawTelemetry'],
  redactionRequired: true,
};

const aiPrivacy: UniversalArtifactPrivacyFlags = {
  ...defaultPrivacy,
  classification: 'restricted',
  restrictedFields: ['prompt', 'modelInput', 'modelOutput', 'rawTelemetry', 'personId'],
};

const compliance = (framework: NexusComplianceFramework, controlFamilies: string[], evidenceUse: string): UniversalArtifactComplianceMapping => ({
  framework,
  controlFamilies,
  evidenceUse,
});

const requirements = (input: Partial<UniversalArtifactLineageRequirements>): UniversalArtifactLineageRequirements => ({
  eventRefs: false,
  auditRefs: false,
  twinRefs: false,
  approvalRefs: false,
  featureRefs: false,
  documentRefs: false,
  evidenceRefs: true,
  ...input,
});

const adapter = (
  storeKind: UniversalArtifactStoreKind,
  input: Omit<UniversalArtifactStorageAdapterDescriptor, 'schemaVersion' | 'storeId' | 'storeKind' | 'readOnly' | 'adapterMode' | 'infrastructure' | 'execution'> & { slug: string },
): UniversalArtifactStorageAdapterDescriptor => ({
  schemaVersion: universalArtifactStorageSchemaVersion,
  storeId: `artifact-store:${storeKind}:${input.slug}`,
  storeKind,
  displayName: input.displayName,
  purpose: input.purpose,
  readOnly: true,
  adapterMode: 'metadata-only',
  infrastructure: { provisioned: false, backingDependency: 'none', falseClaimsProhibited: true },
  execution: { ...baseExecution },
  tenantPartitioning: input.tenantPartitioning,
  retention: input.retention,
  privacy: input.privacy,
  complianceMappings: input.complianceMappings,
  lineageRequirements: input.lineageRequirements,
  routing: input.routing,
});

export const universalArtifactStorageAdapters: UniversalArtifactStorageAdapterDescriptor[] = [
  adapter('event-store', {
    slug: 'nexus-backbone',
    displayName: 'Universal Artifact Event Store Adapter',
    purpose: 'Read-only descriptor for replayable Nexus event artifacts, correlation metadata, and event-to-audit lineage.',
    tenantPartitioning: tenantRacetrackPartitioning,
    retention: { policyId: 'event-backbone-retention-2y', category: 'regulated-record', defaultRetentionDays: 730, legalHoldSupported: true, disposition: 'retain', deletionReview: 'compliance-and-event-owner-review' },
    privacy: defaultPrivacy,
    complianceMappings: [
      compliance('SOC-2', ['audit-logging', 'change-management'], 'Event evidence for controlled operational changes.'),
      compliance('ISO-27001', ['logging-monitoring', 'access-control'], 'Tenant-scoped event trails for security review.'),
      compliance('HISA', ['operational-oversight'], 'Race-day operational evidence where jurisdictionally applicable.'),
      compliance('ARCI', ['racing-integrity'], 'Stewarding and racing integrity event context.'),
    ],
    lineageRequirements: requirements({ auditRefs: true }),
    routing: { acceptedArtifactTypes: ['event', 'telemetry', 'workflow', 'approval', 'recommendation', 'insight', 'forecast'], serialization: 'descriptor-only-json', targetPathTemplate: 'events/{tenantId}/{racetrackId}/{artifactType}/{artifactId}.json' },
  }),
  adapter('audit-store', {
    slug: 'immutable-ledger',
    displayName: 'Universal Artifact Audit Store Adapter',
    purpose: 'Read-only descriptor for hash-chain audit artifacts, custody metadata, legal holds, and forensic exports.',
    tenantPartitioning,
    retention: { policyId: 'regulated-audit-ledger-7y', category: 'forensic-ledger', defaultRetentionDays: 2555, legalHoldSupported: true, disposition: 'retain', deletionReview: 'legal-hold-and-regulator-review' },
    privacy: defaultPrivacy,
    complianceMappings: [
      compliance('SOC-2', ['audit-evidence', 'logical-access'], 'Immutable audit evidence and access accountability.'),
      compliance('ISO-27001', ['logging-monitoring', 'cryptographic-integrity'], 'Hash-chain audit metadata for security controls.'),
      compliance('ISO-42001', ['human-oversight', 'ai-governance'], 'AI recommendation and approval auditability.'),
      compliance('HISA', ['racing-compliance-evidence'], 'Regulated racing oversight evidence where applicable.'),
      compliance('ARCI', ['steward-review'], 'Racing integrity review packages.'),
      compliance('LOCAL-RACING-COMMISSION', ['local-rules'], 'Configurable local racing rule evidence mappings.'),
    ],
    lineageRequirements: requirements({ eventRefs: true, evidenceRefs: true }),
    routing: { acceptedArtifactTypes: ['audit-record', 'audit', 'event', 'approval', 'recommendation', 'workflow', 'document', 'evidence-package', 'compliance-control', 'compliance', 'investigation', 'insight', 'forecast'], serialization: 'descriptor-only-json', targetPathTemplate: 'audit/{tenantId}/{artifactType}/{artifactId}.json' },
  }),
  adapter('digital-twin-store', {
    slug: 'runtime-state',
    displayName: 'Universal Artifact Digital Twin Store Adapter',
    purpose: 'Read-only descriptor for Digital Twin nodes, state snapshots, asset relationships, and approval-aware sync metadata.',
    tenantPartitioning: tenantRacetrackPartitioning,
    retention: { policyId: 'twin-state-history-18m', category: 'operational-hot', defaultRetentionDays: 548, legalHoldSupported: true, disposition: 'retain', deletionReview: 'operations-and-compliance-review' },
    privacy: defaultPrivacy,
    complianceMappings: [
      compliance('ISO-27001', ['asset-management', 'access-control'], 'Controlled asset and twin relationship metadata.'),
      compliance('ISO-31000', ['risk-context'], 'Operational risk relationships and dependency context.'),
      compliance('HISA', ['safety-oversight'], 'Twin evidence supporting safety and maintenance review.'),
      compliance('ARCI', ['operational-integrity'], 'Track asset and stewarding context where applicable.'),
    ],
    lineageRequirements: requirements({ eventRefs: true, auditRefs: true, twinRefs: true }),
    routing: { acceptedArtifactTypes: ['asset', 'digital-twin', 'telemetry', 'workflow'], serialization: 'descriptor-only-json', targetPathTemplate: 'twins/{tenantId}/{racetrackId}/{artifactType}/{artifactId}.json' },
  }),
  adapter('knowledge-graph', {
    slug: 'domain-relations',
    displayName: 'Universal Artifact Knowledge Graph Adapter',
    purpose: 'Read-only descriptor for semantic nodes and edges connecting assets, twins, events, audit records, approvals, features, documents, and controls.',
    tenantPartitioning: tenantRacetrackPartitioning,
    retention: { policyId: 'semantic-context-retention-3y', category: 'regulated-record', defaultRetentionDays: 1095, legalHoldSupported: true, disposition: 'retain', deletionReview: 'data-governance-review' },
    privacy: defaultPrivacy,
    complianceMappings: [
      compliance('ISO-27701', ['privacy-mapping', 'data-minimization'], 'Relationship metadata with explicit sensitivity and redaction posture.'),
      compliance('ISO-42001', ['traceability', 'human-oversight'], 'AI recommendation traceability to evidence and approvals.'),
      compliance('SOC-2', ['processing-integrity'], 'Evidence relationship catalog for control review.'),
      compliance('HISA', ['evidence-linkage'], 'Operational evidence relationship map where applicable.'),
    ],
    lineageRequirements: requirements({ eventRefs: true, auditRefs: true, twinRefs: true, approvalRefs: true, featureRefs: true, documentRefs: true }),
    routing: { acceptedArtifactTypes: [...universalArtifactStorageArtifactTypes], serialization: 'descriptor-only-json', targetPathTemplate: 'graph/{tenantId}/{racetrackId}/{artifactType}/{artifactId}.json' },
  }),
  adapter('feature-store', {
    slug: 'governed-features',
    displayName: 'Universal Artifact Feature Store Adapter',
    purpose: 'Read-only descriptor for governed feature records, AI input quality, and rebuildable derived feature lineage.',
    tenantPartitioning: tenantRacetrackPartitioning,
    retention: { policyId: 'feature-lineage-retention-1y', category: 'derived-rebuildable', defaultRetentionDays: 365, legalHoldSupported: true, disposition: 'rebuildable', deletionReview: 'ai-governance-review' },
    privacy: aiPrivacy,
    complianceMappings: [
      compliance('ISO-42001', ['data-quality', 'model-lineage'], 'AI feature lineage and input quality evidence.'),
      compliance('NIST-AI-RMF', ['map', 'measure', 'manage'], 'Feature traceability for AI risk management.'),
      compliance('ISO-25010', ['quality-in-use', 'reliability'], 'Feature quality and stale-input monitoring.'),
      compliance('ISO-27701', ['privacy-by-design'], 'Feature minimization and sensitive-input controls.'),
    ],
    lineageRequirements: requirements({ eventRefs: true, auditRefs: true, featureRefs: true, evidenceRefs: true }),
    routing: { acceptedArtifactTypes: ['feature-record', 'feature', 'recommendation', 'dataset', 'insight', 'forecast'], serialization: 'descriptor-only-json', targetPathTemplate: 'features/{tenantId}/{racetrackId}/{artifactType}/{artifactId}.json' },
  }),
  adapter('document-store', {
    slug: 'evidence-vault',
    displayName: 'Universal Artifact Document Store Adapter',
    purpose: 'Read-only descriptor for evidence documents, policies, review packages, citations, and compliance-ready document metadata.',
    tenantPartitioning,
    retention: { policyId: 'evidence-document-retention-7y', category: 'regulated-record', defaultRetentionDays: 2555, legalHoldSupported: true, disposition: 'retain', deletionReview: 'records-management-review' },
    privacy: { ...defaultPrivacy, containsSensitiveTelemetry: false, restrictedFields: ['personId', 'licenseNumber', 'microchipId', 'credentialId', 'evidenceUri'] },
    complianceMappings: [
      compliance('ISO-27001', ['document-control', 'access-control'], 'Controlled policy and evidence document metadata.'),
      compliance('ISO-27701', ['privacy-notices', 'personal-data-inventory'], 'Privacy-sensitive document labeling and redaction posture.'),
      compliance('SOC-2', ['evidence-management'], 'Control evidence packages and document custody.'),
      compliance('HISA', ['regulatory-documentation'], 'Racing evidence packages where applicable.'),
      compliance('ARCI', ['rulebook-citations'], 'Rulebook citations and stewarding evidence references.'),
      compliance('LOCAL-RACING-COMMISSION', ['local-filings'], 'Local commission evidence and citation metadata.'),
    ],
    lineageRequirements: requirements({ auditRefs: true, documentRefs: true, evidenceRefs: true }),
    routing: { acceptedArtifactTypes: ['document', 'evidence-package', 'approval', 'audit-record', 'audit', 'recommendation', 'workflow', 'compliance-control', 'compliance', 'investigation', 'insight', 'forecast'], serialization: 'descriptor-only-json', targetPathTemplate: 'documents/{tenantId}/{artifactType}/{artifactId}.json' },
  }),
  adapter('data-lake', {
    slug: 'regulated-archive',
    displayName: 'Universal Artifact Data Lake Adapter',
    purpose: 'Read-only descriptor for regulated archive landing metadata across operational, AI, event, audit, twin, graph, feature, and document artifacts.',
    tenantPartitioning: tenantRacetrackPartitioning,
    retention: { policyId: 'regulated-racing-archive-7y', category: 'analytics-archive', defaultRetentionDays: 2555, legalHoldSupported: true, disposition: 'archive', deletionReview: 'legal-hold-and-data-governance-review' },
    privacy: defaultPrivacy,
    complianceMappings: [
      compliance('ISO-27001', ['data-at-rest', 'access-control'], 'Archive metadata for security governance.'),
      compliance('ISO-27701', ['data-inventory', 'retention'], 'Privacy classification and retention hints.'),
      compliance('SOC-2', ['availability', 'confidentiality'], 'Archive control evidence and retention metadata.'),
      compliance('PCI-DSS', ['restricted-payment-data'], 'Payment-related artifacts must remain tagged and minimized when present.'),
      compliance('HISA', ['regulated-record-retention'], 'Regulated racing record archive hints where applicable.'),
    ],
    lineageRequirements: requirements({ eventRefs: true, auditRefs: true, twinRefs: true, featureRefs: true, documentRefs: true }),
    routing: { acceptedArtifactTypes: [...universalArtifactStorageArtifactTypes], serialization: 'descriptor-only-json', targetPathTemplate: 'lake/{tenantId}/{racetrackId}/{artifactType}/{artifactId}.json' },
  }),
];

export function listUniversalArtifactStorageAdapters(): UniversalArtifactStorageAdapterDescriptor[] {
  return universalArtifactStorageAdapters.map(clone);
}

export function findUniversalArtifactStorageAdapters(artifactType: UniversalArtifactStorageArtifactType): UniversalArtifactStorageAdapterDescriptor[] {
  return universalArtifactStorageAdapters.filter((descriptor) => descriptor.routing.acceptedArtifactTypes.includes(artifactType)).map(clone);
}

export function routeUniversalArtifactToStores(artifact: UniversalArtifactDescriptor): UniversalArtifactStorageTarget[] {
  return findUniversalArtifactStorageAdapters(artifact.artifactType).map((descriptor) => ({
    schemaVersion: universalArtifactStorageSchemaVersion,
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    targetStoreId: descriptor.storeId,
    storeKind: descriptor.storeKind,
    readOnly: true,
    executionEndpointPaths: [],
    tenantPartition: partitionFor(artifact, descriptor),
    retention: { ...descriptor.retention, ...(artifact.retention ?? {}) },
    privacy: mergePrivacy(descriptor.privacy, artifact.privacy),
    complianceMappings: descriptor.complianceMappings,
    serialization: {
      format: descriptor.routing.serialization,
      schemaVersion: universalArtifactStorageSchemaVersion,
      recordType: artifact.payloadShape.recordType,
      sourceSystem: artifact.sourceSystem,
      sourceUri: artifact.sourceUri,
    },
    lineage: clone(artifact.lineage),
  }));
}

export function generateUniversalArtifactGraph(artifact: UniversalArtifactDescriptor): UniversalArtifactGraphProjection {
  const nodes = new Map<string, UniversalArtifactGraphNode>();
  const edges = new Map<string, UniversalArtifactGraphEdge>();
  const root = graphNode(artifact.artifactType, artifact.artifactId, artifact, { root: true, sourceSystem: artifact.sourceSystem, classification: artifact.privacy.classification });
  nodes.set(root.id, root);

  for (const target of routeUniversalArtifactToStores(artifact)) {
    const store = graphNode(target.storeKind, target.targetStoreId, artifact, { storeKind: target.storeKind, readOnly: true });
    nodes.set(store.id, store);
    addEdge(edges, root.id, store.id, 'ROUTED_TO_STORE', artifact);
  }

  const refs = artifact.references ?? {};
  for (const twinId of unique([...(refs.twinIds ?? []), ...artifact.lineage.twinIds])) {
    const twin = graphNode('digital-twin', twinId, artifact, { referenced: true });
    nodes.set(twin.id, twin);
    addEdge(edges, root.id, twin.id, artifact.artifactType === 'asset' ? 'ASSET_REPRESENTED_BY_TWIN' : 'REFERENCES_ARTIFACT', artifact);
  }
  for (const auditId of unique([...(refs.auditIds ?? []), ...artifact.lineage.auditIds])) {
    const audit = graphNode('audit-record', auditId, artifact, { referenced: true });
    nodes.set(audit.id, audit);
    addEdge(edges, root.id, audit.id, artifact.artifactType === 'event' ? 'EVENT_HAS_AUDIT_RECORD' : 'REFERENCES_ARTIFACT', artifact);
  }
  for (const approvalId of unique([...(refs.approvalIds ?? []), ...artifact.lineage.approvalIds])) {
    const approval = graphNode('approval', approvalId, artifact, { referenced: true });
    nodes.set(approval.id, approval);
    addEdge(edges, root.id, approval.id, artifact.artifactType === 'recommendation' ? 'RECOMMENDATION_REQUIRES_APPROVAL' : 'REFERENCES_ARTIFACT', artifact);
  }
  for (const featureId of unique([...(refs.featureRecordIds ?? []), ...artifact.lineage.featureRecordIds])) {
    const feature = graphNode('feature-record', featureId, artifact, { referenced: true });
    nodes.set(feature.id, feature);
    addEdge(edges, root.id, feature.id, 'USES_FEATURE_RECORD', artifact);
  }
  for (const documentId of refs.documentIds ?? []) {
    const document = graphNode('document', documentId, artifact, { referenced: true });
    nodes.set(document.id, document);
    addEdge(edges, root.id, document.id, 'EVIDENCED_BY_DOCUMENT', artifact);
  }
  for (const controlId of refs.complianceControlIds ?? []) {
    const control = graphNode('compliance-control', controlId, artifact, { referenced: true });
    nodes.set(control.id, control);
    addEdge(edges, root.id, control.id, 'GOVERNED_BY_CONTROL', artifact);
  }

  return {
    schemaVersion: universalArtifactStorageSchemaVersion,
    artifactId: artifact.artifactId,
    nodes: [...nodes.values()].map(clone),
    edges: [...edges.values()].map(clone),
    executionEndpointsAvailable: false,
  };
}

export function serializeUniversalArtifactDescriptor(artifact: UniversalArtifactDescriptor): UniversalArtifactSerializationDescriptor {
  return {
    schemaVersion: universalArtifactStorageSchemaVersion,
    artifact: clone(artifact),
    storageTargets: routeUniversalArtifactToStores(artifact),
    graph: generateUniversalArtifactGraph(artifact),
    noExecutionEndpoints: true,
  };
}

export function validateUniversalArtifactStorageAdapters(adapters: readonly UniversalArtifactStorageAdapterDescriptor[] = universalArtifactStorageAdapters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const kinds = new Set(adapters.map((descriptor) => descriptor.storeKind));
  for (const kind of universalArtifactStoreKinds) if (!kinds.has(kind)) errors.push(`store kind missing: ${kind}`);
  for (const descriptor of adapters) {
    if (descriptor.schemaVersion !== universalArtifactStorageSchemaVersion) errors.push(`${descriptor.storeId} schemaVersion mismatch`);
    if (!descriptor.readOnly) errors.push(`${descriptor.storeId} must be read-only`);
    if (descriptor.adapterMode !== 'metadata-only') errors.push(`${descriptor.storeId} must be metadata-only`);
    if (descriptor.infrastructure.provisioned) errors.push(`${descriptor.storeId} must not claim provisioned infrastructure`);
    if (descriptor.infrastructure.backingDependency !== 'none') errors.push(`${descriptor.storeId} must not claim a backing dependency`);
    if (descriptor.execution.endpointPaths.length > 0) errors.push(`${descriptor.storeId} must not expose execution endpoints`);
    if (descriptor.execution.mutationMethods.length > 0) errors.push(`${descriptor.storeId} must not expose mutation methods`);
    if (descriptor.execution.autonomousExecutionAllowed) errors.push(`${descriptor.storeId} must not allow autonomous execution`);
    if (!descriptor.tenantPartitioning.tenantScoped) errors.push(`${descriptor.storeId} must be tenant scoped`);
    if (descriptor.tenantPartitioning.rawCrossTenantAccessAllowed) errors.push(`${descriptor.storeId} must forbid raw cross-tenant access`);
    if (descriptor.routing.acceptedArtifactTypes.length === 0) errors.push(`${descriptor.storeId} must route at least one artifact type`);
    if (!descriptor.retention.policyId) errors.push(`${descriptor.storeId} must declare retention policy`);
    if (descriptor.complianceMappings.length === 0) errors.push(`${descriptor.storeId} must declare compliance mappings`);
  }
  return { valid: errors.length === 0, errors };
}

function partitionFor(artifact: UniversalArtifactDescriptor, descriptor: UniversalArtifactStorageAdapterDescriptor): UniversalArtifactStorageTarget['tenantPartition'] {
  const racetrackId = descriptor.tenantPartitioning.racetrackScoped ? artifact.racetrackId ?? 'racetrack-unscoped' : undefined;
  return {
    tenantId: artifact.tenantId,
    racetrackId,
    partitionKey: [artifact.tenantId, racetrackId, artifact.artifactType].filter(Boolean).join('/'),
  };
}

function mergePrivacy(storePrivacy: UniversalArtifactPrivacyFlags, artifactPrivacy: UniversalArtifactPrivacyFlags): UniversalArtifactPrivacyFlags {
  return {
    classification: sensitivityRank(artifactPrivacy.classification) > sensitivityRank(storePrivacy.classification) ? artifactPrivacy.classification : storePrivacy.classification,
    containsPii: storePrivacy.containsPii || artifactPrivacy.containsPii,
    containsProtectedHealthInfo: storePrivacy.containsProtectedHealthInfo || artifactPrivacy.containsProtectedHealthInfo,
    containsFinancialData: storePrivacy.containsFinancialData || artifactPrivacy.containsFinancialData,
    containsCredentialData: storePrivacy.containsCredentialData || artifactPrivacy.containsCredentialData,
    containsSensitiveTelemetry: storePrivacy.containsSensitiveTelemetry || artifactPrivacy.containsSensitiveTelemetry,
    restrictedFields: unique([...storePrivacy.restrictedFields, ...artifactPrivacy.restrictedFields]),
    redactionRequired: storePrivacy.redactionRequired || artifactPrivacy.redactionRequired,
  };
}

function sensitivityRank(classification: DataClassification): number {
  return { public: 0, internal: 1, confidential: 2, restricted: 3, regulated: 4 }[classification];
}

function graphNode(kind: UniversalArtifactStorageArtifactType | UniversalArtifactStoreKind, id: string, artifact: UniversalArtifactDescriptor, properties: Record<string, string | number | boolean | undefined>): UniversalArtifactGraphNode {
  return {
    id: nodeId(kind, id),
    kind,
    labels: ['UniversalArtifact', labelFor(kind)],
    tenantId: artifact.tenantId,
    racetrackId: artifact.racetrackId,
    properties: {
      artifactId: id,
      artifactType: kind,
      displayName: kind === artifact.artifactType && id === artifact.artifactId ? artifact.displayName : undefined,
      ...properties,
    },
  };
}

function addEdge(edges: Map<string, UniversalArtifactGraphEdge>, from: string, to: string, type: UniversalArtifactGraphEdgeType, artifact: UniversalArtifactDescriptor): void {
  const id = edgeId(from, type, to);
  edges.set(id, {
    id,
    from,
    to,
    type,
    tenantId: artifact.tenantId,
    racetrackId: artifact.racetrackId,
    evidenceIds: [...artifact.lineage.evidenceIds],
    readOnly: true,
  });
}

function nodeId(kind: UniversalArtifactStorageArtifactType | UniversalArtifactStoreKind, id: string): string {
  return `universal-artifact:${kind}:${id}`;
}

function edgeId(from: string, type: UniversalArtifactGraphEdgeType, to: string): string {
  return `edge:${stablePart(from)}:${type.toLowerCase()}:${stablePart(to)}`;
}

function labelFor(value: string): string {
  return value.split('-').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join('');
}

function stablePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
