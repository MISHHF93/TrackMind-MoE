import type { DataEntryEntityKind, DataEntryFormMode, DataEntryScope } from './dataEntryFramework.js';
import { getDataEntryFormDefinition } from './dataEntryFramework.js';
import { parseComplianceEvidenceLinkTargets, parseComplianceEvidenceUriRefs } from './complianceEvidenceEntry.js';
import { approvalRequirementToBoolean } from './operationalFormComponents.js';

export const dataEntryArtifactPipelineSchemaVersion = 'trackmind.data-entry-artifact-pipeline.v1' as const;

export type DataEntryPipelineEmissionKind =
  | 'audit'
  | 'domain-event'
  | 'operational-artifact'
  | 'lineage'
  | 'approval-request'
  | 'kpi-source-event'
  | 'digital-twin-update'
  | 'ai-readable-artifact'
  | 'compliance-evidence-link';

export type DataEntryApprovalPolicy =
  | 'never'
  | 'when-flagged'
  | 'composer'
  | 'always';

export interface DataEntryPipelineProfile {
  entityKind: DataEntryEntityKind;
  domainEventType: string;
  artifactType: string;
  requiredEmissions: readonly DataEntryPipelineEmissionKind[];
  optionalEmissions: readonly DataEntryPipelineEmissionKind[];
  approvalPolicy: DataEntryApprovalPolicy;
  kpiSourceKeys: readonly string[];
  digitalTwinRefFields: readonly string[];
  aiReadable: boolean;
  complianceLinkable: boolean;
}

export interface DataEntryPipelinePlan {
  schemaVersion: typeof dataEntryArtifactPipelineSchemaVersion;
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  auditAction: string;
  domainEventType: string;
  artifactType: string;
  subjectId: string;
  correlationId: string;
  requiredEmissions: DataEntryPipelineEmissionKind[];
  emissions: DataEntryPipelineEmissionKind[];
  approvalRequired: boolean;
  kpiSourceKeys: string[];
  digitalTwinRefs: string[];
  complianceLinks: Array<{ targetKind: string; targetId: string; label?: string }>;
  evidenceRefs: string[];
  aiReadableAllowed: boolean;
  lineageSeed: string[];
}

export interface DataEntryPipelineEmissionRecord {
  kind: DataEntryPipelineEmissionKind;
  id: string;
  auditId?: string;
  eventId?: string;
  artifactId?: string;
  approvalRequestId?: string;
  digitalTwinRef?: string;
  kpiSourceKey?: string;
  complianceLinkId?: string;
}

export interface DataEntryPipelineResult {
  schemaVersion: typeof dataEntryArtifactPipelineSchemaVersion;
  complete: boolean;
  bypassBlocked: boolean;
  emissions: DataEntryPipelineEmissionRecord[];
  lineageRefs: string[];
  artifactId?: string;
  approvalRequestId?: string;
  kpiSourceEventIds: string[];
  digitalTwinUpdateIds: string[];
  complianceEvidenceLinkIds: string[];
  aiArtifactId?: string;
}

const BASE_REQUIRED: readonly DataEntryPipelineEmissionKind[] = [
  'audit',
  'domain-event',
  'operational-artifact',
  'lineage',
];

const KPI_ENTITY_KINDS = new Set<DataEntryEntityKind>([
  'unified-incident',
  'incident',
  'security-incident',
  'security-event-entry',
  'facilities-inspection',
  'facilities-incident',
  'facilities-maintenance',
  'welfare-observation',
  'veterinary-observation',
  'compliance-evidence',
  'kpi-definition',
  'paddock-record',
  'race-card-lifecycle',
]);

const DIGITAL_TWIN_FIELDS = ['assetId', 'horseId', 'raceId', 'raceCardId', 'facilityId', 'twinId', 'digitalTwinRef'] as const;

function profile(
  entityKind: DataEntryEntityKind,
  overrides: Partial<Omit<DataEntryPipelineProfile, 'entityKind'>> & Pick<DataEntryPipelineProfile, 'domainEventType' | 'artifactType'>,
): DataEntryPipelineProfile {
  const kpiSourceKeys = overrides.kpiSourceKeys ?? (KPI_ENTITY_KINDS.has(entityKind) ? [`kpi-source:${entityKind}`] : []);
  const required = new Set<DataEntryPipelineEmissionKind>([...BASE_REQUIRED, ...(overrides.requiredEmissions ?? [])]);
  const optional = new Set<DataEntryPipelineEmissionKind>(overrides.optionalEmissions ?? []);

  if (kpiSourceKeys.length > 0) required.add('kpi-source-event');
  if (overrides.complianceLinkable) required.add('compliance-evidence-link');
  if (overrides.approvalPolicy === 'composer' || overrides.approvalPolicy === 'always') required.add('approval-request');
  if ((overrides.digitalTwinRefFields?.length ?? 0) > 0) optional.add('digital-twin-update');
  if (overrides.aiReadable) optional.add('ai-readable-artifact');

  return {
    entityKind,
    domainEventType: overrides.domainEventType,
    artifactType: overrides.artifactType,
    requiredEmissions: [...required],
    optionalEmissions: [...optional],
    approvalPolicy: overrides.approvalPolicy ?? 'when-flagged',
    kpiSourceKeys,
    digitalTwinRefFields: overrides.digitalTwinRefFields ?? [...DIGITAL_TWIN_FIELDS],
    aiReadable: overrides.aiReadable ?? false,
    complianceLinkable: overrides.complianceLinkable ?? false,
  };
}

export const dataEntryPipelineProfiles: Record<DataEntryEntityKind, DataEntryPipelineProfile> = {
  horse: profile('horse', { domainEventType: 'data-entry.horse.submitted', artifactType: 'operational.horse-record' }),
  'horse-ownership': profile('horse-ownership', { domainEventType: 'data-entry.horse-ownership.submitted', artifactType: 'operational.horse-ownership' }),
  'stable-assignment': profile('stable-assignment', { domainEventType: 'data-entry.stable-assignment.submitted', artifactType: 'operational.stable-assignment' }),
  'race-eligibility': profile('race-eligibility', { domainEventType: 'data-entry.race-eligibility.submitted', artifactType: 'operational.race-eligibility', kpiSourceKeys: ['kpi-source:equine-eligibility'] }),
  'transport-record': profile('transport-record', { domainEventType: 'data-entry.transport-record.submitted', artifactType: 'operational.transport-record' }),
  'workout-record': profile('workout-record', { domainEventType: 'data-entry.workout-record.submitted', artifactType: 'operational.workout-record', kpiSourceKeys: ['kpi-source:equine-fitness'] }),
  'retirement-record': profile('retirement-record', { domainEventType: 'data-entry.retirement-record.submitted', artifactType: 'operational.retirement-record', approvalPolicy: 'when-flagged' }),
  race: profile('race', { domainEventType: 'data-entry.race.submitted', artifactType: 'operational.race-schedule', kpiSourceKeys: ['kpi-source:race-schedule'] }),
  'race-card': profile('race-card', { domainEventType: 'data-entry.race-card.submitted', artifactType: 'operational.race-card' }),
  'race-card-conditions': profile('race-card-conditions', { domainEventType: 'data-entry.race-card-conditions.submitted', artifactType: 'operational.race-card-conditions' }),
  'race-card-classification': profile('race-card-classification', { domainEventType: 'data-entry.race-card-classification.submitted', artifactType: 'operational.race-card-classification' }),
  'race-card-purse': profile('race-card-purse', { domainEventType: 'data-entry.race-card-purse.submitted', artifactType: 'operational.race-card-purse' }),
  'race-card-entry': profile('race-card-entry', { domainEventType: 'data-entry.race-card-entry.submitted', artifactType: 'operational.race-card-entry' }),
  'race-card-entry-trainer': profile('race-card-entry-trainer', { domainEventType: 'data-entry.race-card-entry-trainer.submitted', artifactType: 'operational.race-card-entry-trainer' }),
  'race-card-post-position': profile('race-card-post-position', { domainEventType: 'data-entry.race-card-post-position.submitted', artifactType: 'operational.race-card-post-position' }),
  'race-card-lifecycle': profile('race-card-lifecycle', { domainEventType: 'data-entry.race-card-lifecycle.submitted', artifactType: 'operational.race-card-lifecycle', approvalPolicy: 'when-flagged' }),
  'unified-incident': profile('unified-incident', { domainEventType: 'data-entry.incident.submitted', artifactType: 'operational.incident-intake', aiReadable: true }),
  incident: profile('incident', { domainEventType: 'data-entry.incident.submitted', artifactType: 'operational.incident', aiReadable: true }),
  approval: profile('approval', { domainEventType: 'data-entry.approval.submitted', artifactType: 'operational.approval-request', approvalPolicy: 'always' }),
  'approval-request-composer': profile('approval-request-composer', { domainEventType: 'data-entry.approval-composer.submitted', artifactType: 'operational.approval-composer', approvalPolicy: 'composer' }),
  'audit-note': profile('audit-note', { domainEventType: 'data-entry.audit-note.submitted', artifactType: 'operational.audit-note' }),
  'operational-note': profile('operational-note', { domainEventType: 'data-entry.operational-note.submitted', artifactType: 'operational.note', aiReadable: true }),
  'veterinary-observation': profile('veterinary-observation', { domainEventType: 'data-entry.veterinary-observation.submitted', artifactType: 'operational.veterinary-observation' }),
  'welfare-observation': profile('welfare-observation', { domainEventType: 'data-entry.welfare-observation.submitted', artifactType: 'operational.welfare-observation', aiReadable: true }),
  'trainer-assignment': profile('trainer-assignment', { domainEventType: 'data-entry.trainer-assignment.submitted', artifactType: 'operational.trainer-assignment' }),
  'jockey-assignment': profile('jockey-assignment', { domainEventType: 'data-entry.jockey-assignment.submitted', artifactType: 'operational.jockey-assignment' }),
  'paddock-record': profile('paddock-record', { domainEventType: 'data-entry.paddock-record.submitted', artifactType: 'operational.paddock-record' }),
  'security-incident': profile('security-incident', { domainEventType: 'data-entry.security-incident.submitted', artifactType: 'operational.security-incident', aiReadable: true }),
  'security-event-entry': profile('security-event-entry', { domainEventType: 'data-entry.security-event.submitted', artifactType: 'operational.security-event', aiReadable: true }),
  'facilities-inspection': profile('facilities-inspection', { domainEventType: 'data-entry.facilities-inspection.submitted', artifactType: 'operational.facilities-inspection' }),
  'facilities-incident': profile('facilities-incident', { domainEventType: 'data-entry.facilities-incident.submitted', artifactType: 'operational.facilities-incident' }),
  'facilities-maintenance': profile('facilities-maintenance', { domainEventType: 'data-entry.facilities-maintenance.submitted', artifactType: 'operational.facilities-maintenance', approvalPolicy: 'when-flagged' }),
  'compliance-evidence': profile('compliance-evidence', {
    domainEventType: 'data-entry.compliance-evidence.submitted',
    artifactType: 'compliance.evidence-record',
    complianceLinkable: true,
    aiReadable: true,
  }),
  'kpi-definition': profile('kpi-definition', { domainEventType: 'data-entry.kpi-definition.submitted', artifactType: 'operational.kpi-definition' }),
  'administrative-record': profile('administrative-record', { domainEventType: 'data-entry.administrative-record.submitted', artifactType: 'operational.administrative-record' }),
  'federation-metadata': profile('federation-metadata', {
    domainEventType: 'data-entry.federation-metadata.submitted',
    artifactType: 'operational.federation-metadata',
    approvalPolicy: 'always',
    complianceLinkable: true,
    kpiSourceKeys: ['kpi-source:federation-metadata'],
  }),
};

export function getDataEntryPipelineProfile(entityKind: DataEntryEntityKind): DataEntryPipelineProfile {
  const resolved = dataEntryPipelineProfiles[entityKind];
  if (!resolved) throw new Error(`No artifact pipeline profile for ${entityKind}`);
  return resolved;
}

function resolveSubjectId(entityKind: DataEntryEntityKind, values: Record<string, unknown>, recordId?: string): string {
  const candidates = [
    recordId,
    values.recordId,
    values.horseId,
    values.raceId,
    values.raceCardId,
    values.incidentId,
    values.assetId,
    values.controlId,
    values.kpiId,
    values.approvalId,
    values.title,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && String(candidate).trim()) return String(candidate);
  }
  return entityKind;
}

function resolveDigitalTwinRefs(profileDef: DataEntryPipelineProfile, values: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  for (const field of profileDef.digitalTwinRefFields) {
    const value = values[field];
    if (typeof value === 'string' && value.trim()) {
      refs.add(value.startsWith('twin:') ? value : `twin:${value}`);
    }
  }
  if (Array.isArray(values.digitalTwinRefs)) {
    for (const entry of values.digitalTwinRefs) refs.add(String(entry));
  }
  return [...refs];
}

function resolveApprovalRequired(profileDef: DataEntryPipelineProfile, values: Record<string, unknown>): boolean {
  if (profileDef.approvalPolicy === 'always' || profileDef.approvalPolicy === 'composer') return true;
  if (profileDef.approvalPolicy === 'when-flagged') {
    return approvalRequirementToBoolean(values.approvalRequired ?? values.requiresApproval);
  }
  return false;
}

export function buildDataEntryPipelinePlan(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  scope: DataEntryScope,
  recordId?: string,
): DataEntryPipelinePlan {
  const definition = getDataEntryFormDefinition(entityKind, mode);
  const profileDef = getDataEntryPipelineProfile(entityKind);
  const approvalRequired = resolveApprovalRequired(profileDef, values);
  const emissions = new Set<DataEntryPipelineEmissionKind>(profileDef.requiredEmissions);
  if (approvalRequired && !emissions.has('approval-request')) emissions.add('approval-request');
  if (resolveDigitalTwinRefs(profileDef, values).length > 0) emissions.add('digital-twin-update');
  if (profileDef.aiReadable && values.classification !== 'restricted' && values.classification !== 'veterinary-confidential') {
    emissions.add('ai-readable-artifact');
  }

  const complianceLinks = profileDef.complianceLinkable
    ? parseComplianceEvidenceLinkTargets(values.linkTargets)
    : [];
  const evidenceRefs = parseComplianceEvidenceUriRefs(values.evidenceRefs ?? values.evidence);

  return {
    schemaVersion: dataEntryArtifactPipelineSchemaVersion,
    entityKind,
    mode,
    auditAction: definition.auditAction,
    domainEventType: profileDef.domainEventType,
    artifactType: profileDef.artifactType,
    subjectId: resolveSubjectId(entityKind, values, recordId),
    correlationId: scope.requestId ?? `data-entry:${entityKind}:${Date.now()}`,
    requiredEmissions: [...profileDef.requiredEmissions],
    emissions: [...emissions],
    approvalRequired,
    kpiSourceKeys: [...profileDef.kpiSourceKeys],
    digitalTwinRefs: resolveDigitalTwinRefs(profileDef, values),
    complianceLinks: complianceLinks.map((link) => ({ targetKind: link.targetKind, targetId: link.targetId, label: link.label })),
    evidenceRefs,
    aiReadableAllowed: profileDef.aiReadable,
    lineageSeed: [],
  };
}

export function assertDataEntryPipelineIntegrity(
  plan: DataEntryPipelinePlan,
  result: DataEntryPipelineResult,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const emitted = new Set(result.emissions.map((entry) => entry.kind));

  for (const required of plan.requiredEmissions) {
    if (!emitted.has(required)) errors.push(`Missing required pipeline emission: ${required}`);
  }
  if (plan.approvalRequired && !result.approvalRequestId) {
    errors.push('Approval required but no approval request was linked');
  }
  if (plan.kpiSourceKeys.length > 0 && result.kpiSourceEventIds.length === 0) {
    errors.push('KPI source mapping required but no KPI source events were recorded');
  }
  if ((plan.complianceLinks.length > 0 || plan.evidenceRefs.length > 0) && result.complianceEvidenceLinkIds.length === 0) {
    errors.push('Compliance evidence links required but none were recorded');
  }
  if (!result.lineageRefs.length) errors.push('Lineage references are required');
  if (!result.complete) errors.push('Pipeline marked incomplete');
  if (result.bypassBlocked !== true) errors.push('Pipeline bypass guard not engaged');

  return { valid: errors.length === 0, errors };
}

export function mergePipelineIntoMutationResult<T extends { auditId: string; eventId?: string; approvalRequestId?: string }>(
  mutation: T,
  pipeline: DataEntryPipelineResult,
): T & { pipeline: DataEntryPipelineResult; artifactId?: string; lineageRefs: string[] } {
  return {
    ...mutation,
    eventId: mutation.eventId ?? pipeline.emissions.find((entry) => entry.kind === 'domain-event')?.eventId ?? mutation.eventId,
    approvalRequestId: mutation.approvalRequestId ?? pipeline.approvalRequestId,
    artifactId: pipeline.artifactId,
    lineageRefs: pipeline.lineageRefs,
    pipeline,
  };
}
