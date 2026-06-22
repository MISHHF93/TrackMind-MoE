import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';
import type { IncidentDto } from './platformFoundation.js';

export const incidentIntakeSchemaVersion = 'trackmind.incident-intake.v1' as const;

export type UnifiedIncidentType =
  | 'safety'
  | 'steward'
  | 'equine-welfare'
  | 'facilities'
  | 'security'
  | 'operational-disruption';

export type IncidentIntakeMode = 'triage' | 'full';

export interface UnifiedIncidentTypeDefinition {
  type: UnifiedIncidentType;
  label: string;
  shortLabel: string;
  description: string;
  category: IncidentDto['category'];
  defaultSeverity: IncidentDto['severity'];
}

export const unifiedIncidentTypes: readonly UnifiedIncidentTypeDefinition[] = [
  { type: 'safety', label: 'Safety incident', shortLabel: 'Safety', description: 'Personnel, patron, or on-track safety events.', category: 'safety', defaultSeverity: 'high' },
  { type: 'steward', label: 'Steward incident', shortLabel: 'Steward', description: 'Steward inquiry, rule infraction, or race integrity concern.', category: 'operational', defaultSeverity: 'medium' },
  { type: 'equine-welfare', label: 'Equine welfare incident', shortLabel: 'Welfare', description: 'Horse welfare concern requiring documented follow-up.', category: 'equine', defaultSeverity: 'high' },
  { type: 'facilities', label: 'Facilities incident', shortLabel: 'Facilities', description: 'Building, utility, or infrastructure disruption.', category: 'facility', defaultSeverity: 'medium' },
  { type: 'security', label: 'Security incident', shortLabel: 'Security', description: 'Access control, credential, or perimeter security event.', category: 'security', defaultSeverity: 'high' },
  { type: 'operational-disruption', label: 'Operational disruption', shortLabel: 'Ops', description: 'Race-day or backstretch operational interruption.', category: 'operational', defaultSeverity: 'medium' },
];

const typeMap = new Map(unifiedIncidentTypes.map((definition) => [definition.type, definition]));

export function getUnifiedIncidentType(type: UnifiedIncidentType): UnifiedIncidentTypeDefinition {
  const definition = typeMap.get(type);
  if (!definition) throw new Error(`Unknown incident type ${type}`);
  return definition;
}

export interface InvolvedEntityRef {
  kind: string;
  id: string;
  label?: string;
}

export interface IncidentIntakePayload {
  incidentType: UnifiedIncidentType;
  severity: IncidentDto['severity'];
  location: string;
  summary: string;
  detailedNotes?: string;
  involvedEntities?: InvolvedEntityRef[];
  evidenceRefs?: string[];
  recommendedNextAction?: string;
  approvalRequired?: boolean;
  subjectKind?: string;
  subjectId?: string;
  intakeMode: IncidentIntakeMode;
  reason: string;
}

export interface IncidentIntakeValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const triageRequiredFields = ['incidentType', 'severity', 'location', 'summary', 'reason'] as const;
export const fullRequiredFields = [...triageRequiredFields, 'detailedNotes'] as const;

export function incidentIntakeEntityKind(): DataEntryEntityKind {
  return 'unified-incident';
}

export function validateIncidentIntake(
  values: Record<string, unknown>,
  mode: IncidentIntakeMode = 'triage',
): { valid: boolean; errors: string[]; issues: IncidentIntakeValidationIssue[] } {
  const issues: IncidentIntakeValidationIssue[] = [];
  const required = mode === 'full' ? fullRequiredFields : triageRequiredFields;

  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  const incidentType = String(values.incidentType ?? '');
  if (incidentType && !typeMap.has(incidentType as UnifiedIncidentType)) {
    issues.push({ code: 'invalid-type', message: 'incidentType must be a supported unified incident type', field: 'incidentType' });
  }

  if (values.summary && String(values.summary).length > 0 && String(values.summary).length < 8 && mode === 'triage') {
    issues.push({ code: 'summary-short', message: 'summary must be at least 8 characters for triage', field: 'summary' });
  }

  if (mode === 'full' && values.detailedNotes && String(values.detailedNotes).length < 12) {
    issues.push({ code: 'notes-short', message: 'detailedNotes must be at least 12 characters in full mode', field: 'detailedNotes' });
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function mapIncidentTypeToCategory(type: UnifiedIncidentType): IncidentDto['category'] {
  return getUnifiedIncidentType(type).category;
}

export function buildIncidentTitle(type: UnifiedIncidentType, summary: string): string {
  const label = getUnifiedIncidentType(type).shortLabel;
  const trimmed = summary.trim();
  return trimmed.length > 80 ? `${label}: ${trimmed.slice(0, 77)}…` : `${label}: ${trimmed}`;
}

export function parseInvolvedEntities(value: unknown): InvolvedEntityRef[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'object' && entry && 'kind' in entry && 'id' in entry) {
        const record = entry as InvolvedEntityRef;
        return [{ kind: String(record.kind), id: String(record.id), label: record.label ? String(record.label) : undefined }];
      }
      return [];
    });
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean).flatMap((line) => {
      const [kind, id, ...labelParts] = line.split(':').map((part) => part.trim());
      if (!kind || !id) return [];
      return [{ kind, id, label: labelParts.length ? labelParts.join(':') : undefined }];
    });
  }
  return [];
}

export function parseEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function buildPlatformIncidentFromIntake(
  scope: { tenantId: string; racetrackId: string; actorId: string },
  values: Record<string, unknown>,
  mode: IncidentIntakeMode = 'triage',
): Omit<IncidentDto, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'auditIds' | 'eventIds' | 'mock'> {
  const incidentType = String(values.incidentType ?? 'operational-disruption') as UnifiedIncidentType;
  const summary = String(values.summary ?? '');
  const detailedNotes = values.detailedNotes ? String(values.detailedNotes) : undefined;
  const involvedEntities = parseInvolvedEntities(values.involvedEntities);
  const evidenceRefs = parseEvidenceRefs(values.evidenceRefs);

  return {
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    title: buildIncidentTitle(incidentType, summary),
    description: mode === 'full' && detailedNotes ? detailedNotes : summary,
    severity: (values.severity as IncidentDto['severity']) ?? getUnifiedIncidentType(incidentType).defaultSeverity,
    status: 'reported',
    category: mapIncidentTypeToCategory(incidentType),
    reportedBy: scope.actorId,
    incidentType,
    intakeMode: mode,
    location: String(values.location ?? ''),
    summary,
    detailedNotes,
    involvedEntities,
    evidenceRefs,
    recommendedNextAction: values.recommendedNextAction ? String(values.recommendedNextAction) : undefined,
    approvalRequired: values.approvalRequired === true,
    subjectKind: values.subjectKind ? String(values.subjectKind) : involvedEntities[0]?.kind,
    subjectId: values.subjectId ? String(values.subjectId) : involvedEntities[0]?.id,
  };
}

export function fieldsForIntakeMode(mode: IncidentIntakeMode): string[] {
  if (mode === 'triage') {
    return ['incidentType', 'severity', 'location', 'summary', 'involvedEntities', 'reason'];
  }
  return [
    'incidentType', 'severity', 'location', 'summary', 'detailedNotes', 'involvedEntities',
    'evidenceRefs', 'recommendedNextAction', 'approvalRequired', 'subjectKind', 'subjectId', 'reason',
  ];
}

export function canExecuteEmergencyFromForm(): false {
  return false;
}
