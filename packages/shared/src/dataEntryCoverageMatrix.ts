import type { DataEntryEntityKind, DataEntryFormDefinition } from './dataEntryFramework.js';
import { dataEntryEntityForms, getDataEntryFormDefinition } from './dataEntryFramework.js';
import { getDataEntryPipelineProfile } from './dataEntryArtifactPipeline.js';
import { longFormDraftEntityKinds } from './dataEntryDraftRecovery.js';

export const dataEntryCoverageMatrixSchemaVersion = 'trackmind.data-entry-coverage-matrix.v1' as const;

export type PlatformArtifactDomain =
  | 'horses'
  | 'races'
  | 'race-cards'
  | 'incidents'
  | 'approvals'
  | 'audit-records'
  | 'compliance-evidence'
  | 'veterinary-observations'
  | 'welfare-observations'
  | 'facilities-inspections'
  | 'security-events'
  | 'kpi-definitions'
  | 'federation-metadata'
  | 'admin-records';

export type CoverageDimension =
  | 'createFlow'
  | 'editFlow'
  | 'validation'
  | 'draftSupport'
  | 'auditSupport'
  | 'approvalSupport'
  | 'kpiLinkage'
  | 'searchability'
  | 'rbac'
  | 'tenantScoping'
  | 'mobileUsability'
  | 'accessibility';

export type CoverageLevel = 'full' | 'partial' | 'none' | 'na';

export interface ArtifactCoverageBinding {
  domain: PlatformArtifactDomain;
  label: string;
  primaryEntityKind: DataEntryEntityKind;
  relatedEntityKinds?: readonly DataEntryEntityKind[];
  uiSurfaces: readonly string[];
  searchPickerKinds?: readonly string[];
}

export interface CoverageDimensionResult {
  dimension: CoverageDimension;
  level: CoverageLevel;
  notes?: string;
}

export interface ArtifactCoverageRow {
  domain: PlatformArtifactDomain;
  label: string;
  entityKinds: DataEntryEntityKind[];
  dimensions: Record<CoverageDimension, CoverageDimensionResult>;
}

export const platformArtifactBindings: readonly ArtifactCoverageBinding[] = [
  { domain: 'horses', label: 'Horses', primaryEntityKind: 'horse', relatedEntityKinds: ['horse-ownership', 'trainer-assignment', 'stable-assignment', 'race-eligibility', 'transport-record', 'workout-record', 'retirement-record'], uiSurfaces: ['HorseDataEntryHub', 'BulkDataEntryConsole:horse-import'], searchPickerKinds: ['horse'] },
  { domain: 'races', label: 'Races', primaryEntityKind: 'race', uiSurfaces: ['racePanels:EntityFormAction', 'RaceDayQuickEntryConsole'], searchPickerKinds: ['race', 'race-day'] },
  { domain: 'race-cards', label: 'Race cards', primaryEntityKind: 'race-card', relatedEntityKinds: ['race-card-conditions', 'race-card-classification', 'race-card-purse', 'race-card-entry', 'race-card-lifecycle', 'jockey-assignment'], uiSurfaces: ['RaceCardWorkflowWizard', 'BulkDataEntryConsole:race-entries'], searchPickerKinds: ['race'] },
  { domain: 'incidents', label: 'Incidents', primaryEntityKind: 'unified-incident', relatedEntityKinds: ['facilities-incident'], uiSurfaces: ['IncidentIntakeConsole', 'RaceDayQuickEntryConsole'], searchPickerKinds: ['incident'] },
  { domain: 'approvals', label: 'Approvals', primaryEntityKind: 'approval-request-composer', relatedEntityKinds: ['approval'], uiSurfaces: ['ApprovalRequestComposer', 'GovernedActionDialog'], searchPickerKinds: ['approval'] },
  { domain: 'audit-records', label: 'Audit records', primaryEntityKind: 'audit-note', uiSurfaces: ['governancePanels:EntityFormAction', 'RaceDayQuickEntryConsole:steward-note'], searchPickerKinds: ['audit-record'] },
  { domain: 'compliance-evidence', label: 'Compliance evidence', primaryEntityKind: 'compliance-evidence', uiSurfaces: ['ComplianceEvidenceEntryConsole', 'governancePanels'], searchPickerKinds: ['compliance-evidence', 'policy'] },
  { domain: 'veterinary-observations', label: 'Veterinary observations', primaryEntityKind: 'veterinary-observation', uiSurfaces: ['EquineObservationConsole'], searchPickerKinds: ['horse'] },
  { domain: 'welfare-observations', label: 'Welfare observations', primaryEntityKind: 'welfare-observation', uiSurfaces: ['EquineObservationConsole'], searchPickerKinds: ['horse'] },
  { domain: 'facilities-inspections', label: 'Facilities inspections', primaryEntityKind: 'facilities-inspection', relatedEntityKinds: ['facilities-maintenance', 'facilities-incident'], uiSurfaces: ['FacilitiesEntryConsole', 'BulkDataEntryConsole:inspection-scheduling'], searchPickerKinds: ['facility'] },
  { domain: 'security-events', label: 'Security events', primaryEntityKind: 'security-event-entry', uiSurfaces: ['SecurityEventEntryConsole'], searchPickerKinds: ['security-event', 'incident'] },
  { domain: 'kpi-definitions', label: 'KPI definitions', primaryEntityKind: 'kpi-definition', uiSurfaces: ['platformPanels:EntityFormAction', 'BulkDataEntryConsole:kpi-thresholds'], searchPickerKinds: ['kpi-definition'] },
  { domain: 'federation-metadata', label: 'Federation metadata', primaryEntityKind: 'federation-metadata', uiSurfaces: ['businessPanels:EntityFormAction'], searchPickerKinds: ['federation-participant', 'policy'] },
  { domain: 'admin-records', label: 'Administrative records', primaryEntityKind: 'administrative-record', uiSurfaces: ['commandPanels:EntityFormAction'], searchPickerKinds: ['user'] },
];

function hasDraftPolicy(definition: DataEntryFormDefinition): boolean {
  return definition.draft?.enabled !== false;
}

function hasAutosave(definition: DataEntryFormDefinition): boolean {
  return definition.autosave?.enabled === true;
}

function hasQuickEntryMode(definition: DataEntryFormDefinition): boolean {
  return definition.fields.some((field) => field.path === 'entryMode' && field.options?.some((option) => ['quick', 'flash', 'triage'].includes(option.value)));
}

function deriveDimension(
  dimension: CoverageDimension,
  entityKinds: DataEntryEntityKind[],
  domain: PlatformArtifactDomain,
): CoverageDimensionResult {
  const definitions = entityKinds.map((kind) => getDataEntryFormDefinition(kind, 'create'));
  const primary = definitions[0];
  const profile = getDataEntryPipelineProfile(entityKinds[0]);

  switch (dimension) {
    case 'createFlow':
      return { dimension, level: 'full' };
    case 'editFlow': {
      const editable = entityKinds.filter((kind) => dataEntryEntityForms[kind]?.modes.includes('edit'));
      if (editable.length === 0) return { dimension, level: 'na', notes: 'Append-only artifact' };
      if (editable.length === entityKinds.length) return { dimension, level: 'full' };
      return { dimension, level: 'partial', notes: `Edit supported for: ${editable.join(', ')}` };
    }
    case 'validation':
      return { dimension, level: entityKinds.some((kind) => kind.includes('incident') || kind.includes('observation') || kind.includes('facilities') || kind.includes('security') || kind.includes('compliance') || kind.includes('approval') || kind === 'federation-metadata' || kind === 'administrative-record') ? 'full' : 'partial' };
    case 'draftSupport': {
      const longForm = entityKinds.some((kind) => (longFormDraftEntityKinds as readonly string[]).includes(kind));
      const draftEnabled = definitions.some(hasDraftPolicy);
      if (!draftEnabled) return { dimension, level: 'none' };
      if (longForm && definitions.some(hasAutosave)) return { dimension, level: 'full' };
      return { dimension, level: 'partial', notes: longForm ? 'Draft without autosave on all kinds' : 'Default draft only' };
    }
    case 'auditSupport':
      return { dimension, level: definitions.every((definition) => Boolean(definition.auditAction)) ? 'full' : 'partial' };
    case 'approvalSupport': {
      const approvalFields = definitions.some((definition) => definition.fields.some((field) => ['approvalRequired', 'requiresApproval', 'startReviewWorkflow'].includes(field.path)));
      const pipelineApproval = profile.approvalPolicy !== 'never';
      if (approvalFields || pipelineApproval) return { dimension, level: pipelineApproval && profile.approvalPolicy === 'always' ? 'full' : 'partial' };
      return { dimension, level: 'na' };
    }
    case 'kpiLinkage': {
      const kpiNotApplicable: PlatformArtifactDomain[] = ['approvals', 'audit-records', 'admin-records'];
      if (kpiNotApplicable.includes(domain)) return { dimension, level: 'na', notes: 'Governance artifact — no KPI emission required' };
      const anyKpi = entityKinds.some((kind) => getDataEntryPipelineProfile(kind).kpiSourceKeys.length > 0);
      if (profile.kpiSourceKeys.length > 0) return { dimension, level: 'full' };
      if (anyKpi) return { dimension, level: 'partial', notes: 'KPI linkage on related entity kinds' };
      return { dimension, level: 'none' };
    }
    case 'searchability':
      return { dimension, level: 'partial', notes: 'Entity picker + workspace list APIs' };
    case 'rbac':
      return { dimension, level: definitions.every((definition) => definition.requiredPermission && definition.allowedRoles?.length) ? 'full' : 'partial' };
    case 'tenantScoping':
      return { dimension, level: 'full', notes: 'enrichPayloadWithScope + assertDataEntryTenantScope' };
    case 'mobileUsability':
      return { dimension, level: hasQuickEntryMode(primary) ? 'full' : primary.autosave?.enabled ? 'partial' : 'partial', notes: 'TrackMindForm responsive + quick entry modes where defined' };
    case 'accessibility':
      return { dimension, level: 'full', notes: 'OperationalFormFieldRenderer + form-field aria contract' };
    default:
      return { dimension, level: 'none' };
  }
}

export function buildArtifactCoverageRow(binding: ArtifactCoverageBinding): ArtifactCoverageRow {
  const entityKinds = [binding.primaryEntityKind, ...(binding.relatedEntityKinds ?? [])];
  const dimensions = Object.fromEntries(
    (['createFlow', 'editFlow', 'validation', 'draftSupport', 'auditSupport', 'approvalSupport', 'kpiLinkage', 'searchability', 'rbac', 'tenantScoping', 'mobileUsability', 'accessibility'] as CoverageDimension[]).map((dimension) => [
      dimension,
      deriveDimension(dimension, entityKinds, binding.domain),
    ]),
  ) as Record<CoverageDimension, CoverageDimensionResult>;

  return {
    domain: binding.domain,
    label: binding.label,
    entityKinds,
    dimensions,
  };
}

export function buildDataEntryCoverageMatrix(): ArtifactCoverageRow[] {
  return platformArtifactBindings.map(buildArtifactCoverageRow);
}

export function coverageGaps(matrix: ArtifactCoverageRow[] = buildDataEntryCoverageMatrix()): string[] {
  const gaps: string[] = [];
  for (const row of matrix) {
    for (const [dimension, result] of Object.entries(row.dimensions) as Array<[CoverageDimension, CoverageDimensionResult]>) {
      if (result.level === 'none') {
        gaps.push(`${row.domain}.${dimension}: missing`);
      }
    }
  }
  for (const binding of platformArtifactBindings) {
    if (!dataEntryEntityForms[binding.primaryEntityKind]) {
      gaps.push(`${binding.domain}: registry missing ${binding.primaryEntityKind}`);
    }
  }
  return gaps;
}
