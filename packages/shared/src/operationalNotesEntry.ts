import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';
import type { Role } from './accessControl.js';

export const operationalNotesEntrySchemaVersion = 'trackmind.operational-notes.v1' as const;

export type OperationalNoteEntryMode = 'flash' | 'full';

export type OperationalNoteSubjectKind =
  | 'horse'
  | 'race'
  | 'incident'
  | 'approval'
  | 'facilities'
  | 'security-event'
  | 'compliance'
  | 'meeting'
  | 'race-day-log';

export type OperationalNoteVisibilityScope =
  | 'team'
  | 'role-scoped'
  | 'internal'
  | 'confidential'
  | 'restricted';

export interface OperationalNoteSubjectDefinition {
  kind: OperationalNoteSubjectKind;
  label: string;
  shortLabel: string;
  description: string;
  exampleEntityId: string;
  allowsEdit: boolean;
}

export const operationalNoteSubjects: readonly OperationalNoteSubjectDefinition[] = [
  { kind: 'horse', label: 'Horse note', shortLabel: 'Horse', description: 'Backstretch, veterinary, or handler observation tied to a horse.', exampleEntityId: 'horse-1', allowsEdit: true },
  { kind: 'race', label: 'Race note', shortLabel: 'Race', description: 'Race office, post time, or card coordination note.', exampleEntityId: 'race-7', allowsEdit: true },
  { kind: 'incident', label: 'Incident note', shortLabel: 'Incident', description: 'Follow-up or context on an open incident.', exampleEntityId: 'inc-1', allowsEdit: true },
  { kind: 'approval', label: 'Approval note', shortLabel: 'Approval', description: 'Context for an approval request without executing it.', exampleEntityId: 'approval-race-start', allowsEdit: false },
  { kind: 'facilities', label: 'Facilities note', shortLabel: 'Facilities', description: 'Walkthrough or maintenance context on an asset.', exampleEntityId: 'GRANDSTAND_HVAC_01', allowsEdit: true },
  { kind: 'security-event', label: 'Security note', shortLabel: 'Security', description: 'Security floor observation or follow-up.', exampleEntityId: 'zone-paddock', allowsEdit: true },
  { kind: 'compliance', label: 'Compliance note', shortLabel: 'Compliance', description: 'Control review or evidence collection context.', exampleEntityId: 'ctrl-security-audit', allowsEdit: false },
  { kind: 'meeting', label: 'Meeting note', shortLabel: 'Meeting', description: 'Ops briefing, steward meeting, or handoff summary.', exampleEntityId: 'meeting-ops-daily', allowsEdit: true },
  { kind: 'race-day-log', label: 'Race-day log', shortLabel: 'Race day', description: 'Chronological race-day journal entry.', exampleEntityId: 'race-day-log-today', allowsEdit: true },
];

export const operationalNoteVisibilityOptions: readonly { value: OperationalNoteVisibilityScope; label: string }[] = [
  { value: 'team', label: 'Team (workspace)' },
  { value: 'role-scoped', label: 'Role-scoped' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
];

const subjectMap = new Map(operationalNoteSubjects.map((definition) => [definition.kind, definition]));

export function getOperationalNoteSubject(kind: OperationalNoteSubjectKind): OperationalNoteSubjectDefinition {
  const definition = subjectMap.get(kind);
  if (!definition) throw new Error(`Unknown operational note subject ${kind}`);
  return definition;
}

export interface OperationalNoteEditRevision {
  editedAt: string;
  editedBy: string;
  previousBody: string;
  reason?: string;
}

export interface OperationalNoteIntakePayload {
  subjectKind: OperationalNoteSubjectKind;
  entityId: string;
  entityLabel?: string;
  body: string;
  author: string;
  authoredAt?: string;
  tags: string[];
  visibilityScope: OperationalNoteVisibilityScope;
  visibleToRoles?: Role[];
  followUpRequired: boolean;
  auditAware: boolean;
  allowsEdit?: boolean;
  reason: string;
  entryMode: OperationalNoteEntryMode;
}

export interface OperationalNoteEntryValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const flashNoteRequiredFields = ['subjectKind', 'entityId', 'body', 'reason'] as const;
export const fullNoteRequiredFields = [...flashNoteRequiredFields, 'visibilityScope'] as const;

export function operationalNoteEntityKind(): DataEntryEntityKind {
  return 'operational-note';
}

export function parseOperationalNoteTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,]+/).map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

export function parseVisibleToRoles(value: unknown): Role[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String) as Role[];
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,]+/).map((role) => role.trim()).filter(Boolean) as Role[];
  }
  return undefined;
}

export function fieldsForOperationalNoteEntryMode(mode: OperationalNoteEntryMode): string[] {
  if (mode === 'flash') {
    return ['subjectKind', 'entityId', 'body', 'tags', 'followUpRequired', 'reason'];
  }
  return [
    'subjectKind', 'entityId', 'entityLabel', 'body', 'tags', 'visibilityScope', 'visibleToRoles',
    'followUpRequired', 'auditAware', 'authoredAt', 'reason',
  ];
}

export function validateOperationalNoteEntry(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
  entryMode: OperationalNoteEntryMode = 'flash',
): { valid: boolean; errors: string[]; issues: OperationalNoteEntryValidationIssue[] } {
  const issues: OperationalNoteEntryValidationIssue[] = [];

  if (mode === 'edit') {
    const noteId = String(values.noteId ?? '');
    if (!noteId.trim()) {
      issues.push({ code: 'note-id-required', message: 'noteId is required for edits', field: 'noteId' });
    }
    if (!values.body || (typeof values.body === 'string' && !values.body.trim())) {
      issues.push({ code: 'required', message: 'body is required', field: 'body' });
    }
    const errors = issues.map((issue) => issue.message);
    return { valid: errors.length === 0, errors, issues };
  }

  const required = entryMode === 'full' ? fullNoteRequiredFields : flashNoteRequiredFields;
  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  const subjectKind = String(values.subjectKind ?? '') as OperationalNoteSubjectKind;
  if (subjectKind && !subjectMap.has(subjectKind)) {
    issues.push({ code: 'invalid-subject', message: 'subjectKind must be a supported note subject', field: 'subjectKind' });
  }

  if (values.body && String(values.body).length > 0 && String(values.body).length < 4 && entryMode === 'flash') {
    issues.push({ code: 'body-short', message: 'body must be at least 4 characters', field: 'body' });
  }

  if (entryMode === 'full' && values.body && String(values.body).length < 8) {
    issues.push({ code: 'body-short', message: 'body must be at least 8 characters in full mode', field: 'body' });
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function buildOperationalNoteIntakePayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
  entryMode: OperationalNoteEntryMode = 'flash',
): OperationalNoteIntakePayload {
  const validation = validateOperationalNoteEntry(values, 'create', entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const subjectKind = String(values.subjectKind) as OperationalNoteSubjectKind;
  const subject = getOperationalNoteSubject(subjectKind);

  return {
    subjectKind,
    entityId: String(values.entityId ?? subject.exampleEntityId),
    entityLabel: values.entityLabel ? String(values.entityLabel) : undefined,
    body: String(values.body ?? '').trim(),
    author: String(values.author ?? scope.actorId),
    authoredAt: values.authoredAt ? String(values.authoredAt) : undefined,
    tags: parseOperationalNoteTags(values.tags),
    visibilityScope: (values.visibilityScope
      ? String(values.visibilityScope)
      : entryMode === 'flash' ? 'team' : 'internal') as OperationalNoteVisibilityScope,
    visibleToRoles: parseVisibleToRoles(values.visibleToRoles),
    followUpRequired: values.followUpRequired === true,
    auditAware: values.auditAware !== false,
    allowsEdit: values.allowsEdit === false ? false : subject.allowsEdit,
    reason: String(values.reason ?? 'Operational note recorded'),
    entryMode,
  };
}

export function buildOperationalNoteEditPayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
): Record<string, unknown> {
  const noteId = String(values.noteId ?? '');
  if (!noteId.trim()) throw new Error('noteId is required for note edits');
  return {
    noteId,
    body: String(values.body ?? '').trim(),
    editedBy: String(values.editedBy ?? scope.actorId),
    editReason: values.editReason ? String(values.editReason) : values.reason ? String(values.reason) : 'Note revision',
    tags: parseOperationalNoteTags(values.tags),
    followUpRequired: values.followUpRequired === true,
  };
}

export function defaultOperationalNoteSeed(
  subjectKind: OperationalNoteSubjectKind,
  actorId: string,
  entityId?: string,
): Record<string, unknown> {
  const subject = getOperationalNoteSubject(subjectKind);
  return {
    entryMode: 'flash' as OperationalNoteEntryMode,
    subjectKind,
    entityId: entityId ?? subject.exampleEntityId,
    entityLabel: '',
    body: '',
    author: actorId,
    tags: '',
    visibilityScope: 'team' as OperationalNoteVisibilityScope,
    visibleToRoles: '',
    followUpRequired: false,
    auditAware: true,
    allowsEdit: subject.allowsEdit,
    authoredAt: new Date().toISOString().slice(0, 16),
    reason: '',
  };
}
