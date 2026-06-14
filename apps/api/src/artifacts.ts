import type {
  UniversalArtifactDraftRegistrationResultDto,
  UniversalArtifactKindDto,
  UniversalArtifactRecordDto,
  UniversalArtifactRegistryDto,
  UniversalArtifactSchemaCatalogDto,
  UniversalArtifactStorageMapDto,
  UniversalArtifactTrainingInputsDto,
} from '@trackmind/shared';

export interface UniversalArtifactFrameworkState {
  registry: UniversalArtifactRegistryDto;
  schemas: UniversalArtifactSchemaCatalogDto;
  trainingInputs: UniversalArtifactTrainingInputsDto;
  storageMap: UniversalArtifactStorageMapDto;
}

const artifactKinds: UniversalArtifactKindDto[] = [
  'Asset',
  'Event',
  'DigitalTwin',
  'Telemetry',
  'Workflow',
  'Approval',
  'Audit',
  'Compliance',
  'Recommendation',
  'Investigation',
  'Feature',
  'Insight',
  'Forecast',
];

function artifact(kind: UniversalArtifactKindDto, ownerDomain: string, timestamp: string, index: number): UniversalArtifactRecordDto {
  const id = `artifact-${kind.toLowerCase().replace(/[A-Z]/g, (match, offset) => `${offset ? '-' : ''}${match.toLowerCase()}`)}-${index}`;
  const schemaRef = `trackmind.artifact.${kind.toLowerCase()}.v1`;
  const advisoryKinds: UniversalArtifactKindDto[] = ['Recommendation', 'Insight', 'Forecast'];
  return {
    id,
    kind,
    name: `${kind} artifact contract`,
    description: `${kind} artifact example for the Universal Artifact Framework facade.`,
    schemaRef,
    ownerDomain,
    lifecycleStatus: 'published',
    readOnly: true,
    advisoryOnly: advisoryKinds.includes(kind) || undefined,
    operationalMutationAllowed: false,
    autonomousExecutionAllowed: false,
    approvalRequiredForMutation: true,
    auditIds: [`audit-${id}`],
    eventTypes: [`artifact.${kind.toLowerCase()}.registered.v1`, `artifact.${kind.toLowerCase()}.read.v1`],
    digitalTwinRefs: ['DigitalTwin', 'Asset', 'Telemetry'].includes(kind) ? ['twin:track:main-track'] : [],
    evidence: [`schema:${schemaRef}`, `seeded-at:${timestamp}`],
    mock: false,
  };
}

export function createUniversalArtifactFrameworkState(timestamp: string): UniversalArtifactFrameworkState {
  const ownerByKind: Record<UniversalArtifactKindDto, string> = {
    Asset: 'asset-registry',
    Event: 'event-catalog',
    DigitalTwin: 'digital-twin-runtime',
    Telemetry: 'telemetry-ingestion',
    Workflow: 'workflow-engine',
    Approval: 'approval-engine',
    Audit: 'audit-ledger',
    Compliance: 'compliance-control-library',
    Recommendation: 'ai-governance',
    Investigation: 'steward-security-investigations',
    Feature: 'feature-store',
    Insight: 'intelligence-core',
    Forecast: 'surface-forecasting',
  };
  const artifacts = artifactKinds.map((kind, index) => artifact(kind, ownerByKind[kind], timestamp, index + 1));
  const schemas = artifacts.map((item) => ({
    artifactKind: item.kind,
    schemaRef: item.schemaRef,
    version: '1.0.0',
    requiredFields: ['id', 'kind', 'tenantId', 'racetrackId', 'correlationId', 'auditIds', 'eventTypes', 'evidence'],
    optionalFields: ['digitalTwinRefs', 'approvalRefs', 'lineageRefs', 'dataClassification'],
    eventTypes: item.eventTypes,
    auditActions: [`${item.kind.toLowerCase()}.artifact.read`, `${item.kind.toLowerCase()}.artifact.draft-registration`],
    approvalRequiredFor: ['publish', 'operational-mutation', 'schema-change'],
    autonomousExecutionAllowed: false as const,
  }));
  return {
    registry: {
      generatedAt: timestamp,
      schemaVersion: 'trackmind.artifacts.registry.v1',
      readOnly: true,
      executionEndpointsAvailable: false,
      artifactKinds,
      artifacts,
      governance: {
        draftRegistrationOnly: true,
        approvalRequired: true,
        audited: true,
        autonomousExecutionAllowed: false,
        operationalMutationAllowed: false,
      },
      mock: false,
    },
    schemas: {
      generatedAt: timestamp,
      schemaVersion: 'trackmind.artifacts.schemas.v1',
      readOnly: true,
      executionEndpointsAvailable: false,
      schemas,
      mock: false,
    },
    trainingInputs: {
      generatedAt: timestamp,
      schemaVersion: 'trackmind.artifacts.training-inputs.v1',
      readOnly: true,
      executionEndpointsAvailable: false,
      inputs: [
        {
          id: 'artifact-training-surface-forecast',
          artifactKind: 'Forecast',
          sourceArtifactIds: ['artifact-telemetry-4', 'artifact-feature-11', 'artifact-recommendation-9'],
          featureSetId: 'surface-risk-v1',
          lineage: ['telemetry.surface.measurement', 'feature-store:surface-risk-v1', 'model:surface-advisor-v2'],
          evidence: ['surface:moisture=27', 'audit-artifact-telemetry-4'],
          dataClassification: 'restricted',
          allowedUse: ['forecast', 'simulate', 'recommend'],
          prohibitedUse: ['autonomous-track-closure', 'autonomous-irrigation', 'race-start'],
          humanReviewRequired: true,
          retainedInFeatureStore: true,
          mock: false,
        },
        {
          id: 'artifact-training-compliance-insight',
          artifactKind: 'Insight',
          sourceArtifactIds: ['artifact-compliance-8', 'artifact-audit-7', 'artifact-approval-6'],
          featureSetId: 'compliance-readiness-v1',
          lineage: ['compliance-control-library', 'audit-ledger', 'approval-engine'],
          evidence: ['control:ctrl-ai-evidence', 'approval:human-review-required'],
          dataClassification: 'internal',
          allowedUse: ['summarize', 'classify', 'prioritize'],
          prohibitedUse: ['external-certification-claim', 'autonomous-filing-approval'],
          humanReviewRequired: true,
          retainedInFeatureStore: true,
          mock: false,
        },
      ],
      policy: {
        noAutonomousExecution: true,
        humanApprovalRequiredFor: ['publish-artifact', 'change-schema', 'use-for-operational-control'],
        draftOnlyRegistration: true,
      },
      mock: false,
    },
    storageMap: {
      generatedAt: timestamp,
      schemaVersion: 'trackmind.artifacts.storage-map.v1',
      readOnly: true,
      executionEndpointsAvailable: false,
      storage: [
        {
          storeId: 'artifact-registry-store',
          artifactKinds: ['Asset', 'DigitalTwin', 'Workflow', 'Approval'],
          purpose: 'Canonical artifact metadata and approval posture.',
          tenantScoped: true,
          auditRequired: true,
          encryptionRequired: true,
          retentionPolicy: 'regulated-racing-records-7y',
          writeBoundary: 'backend-governed',
          operationalMutationAllowed: false,
        },
        {
          storeId: 'artifact-feature-evidence-store',
          artifactKinds: ['Telemetry', 'Feature', 'Recommendation', 'Insight', 'Forecast'],
          purpose: 'Training input metadata, evidence, and lineage references.',
          tenantScoped: true,
          auditRequired: true,
          encryptionRequired: true,
          retentionPolicy: 'ai-governance-evidence-7y',
          writeBoundary: 'draft-only',
          operationalMutationAllowed: false,
        },
        {
          storeId: 'artifact-governance-store',
          artifactKinds: ['Event', 'Audit', 'Compliance', 'Investigation'],
          purpose: 'Event, audit, compliance, and investigation evidence map.',
          tenantScoped: true,
          auditRequired: true,
          encryptionRequired: true,
          retentionPolicy: 'legal-hold-aware',
          writeBoundary: 'backend-governed',
          operationalMutationAllowed: false,
        },
      ],
      eventAuditMap: artifacts.map((item) => ({
        artifactKind: item.kind,
        eventTypes: item.eventTypes,
        auditActions: [`${item.kind.toLowerCase()}.artifact.read`, `${item.kind.toLowerCase()}.artifact.reviewed`],
        digitalTwinRefs: item.digitalTwinRefs,
        approvalRefs: ['approval-artifact-registration'],
      })),
      mock: false,
    },
  };
}

export function createUniversalArtifactDraftRegistrationResult(body: unknown): UniversalArtifactDraftRegistrationResultDto {
  const input = (body ?? {}) as { artifactId?: string; kind?: string; requestedBy?: string };
  const artifactId = input.artifactId ?? `artifact-draft-${Date.now()}`;
  return {
    accepted: true,
    status: 'draft',
    draftId: `artifact-registration-draft-${Date.now()}`,
    artifactId,
    approvalRequired: true,
    audited: true,
    eventType: 'artifact.registration.draft.created',
    executionAllowed: false,
    operationalMutationAllowed: false,
    message: `Universal Artifact registration draft accepted for ${input.kind ?? artifactId}. Approval and audit review are required before publishing; no artifact registry, operational state, or autonomous AI execution was mutated.`,
    mock: false,
  };
}
