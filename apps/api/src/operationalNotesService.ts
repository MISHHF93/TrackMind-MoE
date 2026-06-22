import type { Role } from '@trackmind/shared';
import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';

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

export interface OperationalNoteEditRevision {
  editedAt: string;
  editedBy: string;
  previousBody: string;
  reason?: string;
}

export interface OperationalNoteRecord {
  id: string;
  subjectKind: OperationalNoteSubjectKind;
  entityId: string;
  entityLabel?: string;
  body: string;
  author: string;
  authoredAt: string;
  tags: string[];
  visibilityScope: OperationalNoteVisibilityScope;
  visibleToRoles?: Role[];
  followUpRequired: boolean;
  auditAware: boolean;
  auditRecordId: string;
  allowsEdit: boolean;
  status: 'active' | 'superseded';
  editHistory: OperationalNoteEditRevision[];
  entryMode: 'flash' | 'full';
  tenantId: string;
  racetrackId: string;
}

export interface OperationalNoteIntakeInput {
  subjectKind: OperationalNoteSubjectKind;
  entityId: string;
  entityLabel?: string;
  body: string;
  author: string;
  authoredAt?: string;
  tags?: string[];
  visibilityScope: OperationalNoteVisibilityScope;
  visibleToRoles?: Role[];
  followUpRequired?: boolean;
  auditAware?: boolean;
  allowsEdit?: boolean;
  reason: string;
  entryMode: 'flash' | 'full';
  tenantId?: string;
  racetrackId?: string;
}

export interface OperationalNoteEditInput {
  body: string;
  editedBy: string;
  editReason?: string;
  tags?: string[];
  followUpRequired?: boolean;
}

export interface OperationalNoteMetadataPatchInput {
  tags?: string[];
  followUpRequired?: boolean;
  editedBy: string;
  reason?: string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class OperationalNotesService {
  private notes = new Map<string, OperationalNoteRecord>();
  private readonly auditLog: ImmutableAuditLog;

  constructor(private clock = () => new Date().toISOString(), auditLog = new ImmutableAuditLog()) {
    this.auditLog = auditLog;
    this.seed();
  }

  recordIntake(input: OperationalNoteIntakeInput): {
    accepted: boolean;
    noteId: string;
    auditId: string;
    auditRecordId: string;
    allowsEdit: boolean;
    message: string;
  } {
    const authoredAt = input.authoredAt ?? this.clock();
    const noteId = `note-${this.notes.size + 1}`;
    const auditRecord = this.appendAudit({
      action: 'operational-note.recorded',
      actor: input.author,
      timestamp: authoredAt,
      subjectId: `${input.subjectKind}:${input.entityId}`,
      tenantId: input.tenantId ?? 'trackmind',
      racetrackId: input.racetrackId ?? 'main-track',
      reason: input.reason,
      payload: {
        noteId,
        subjectKind: input.subjectKind,
        entityId: input.entityId,
        visibilityScope: input.visibilityScope,
        followUpRequired: input.followUpRequired ?? false,
        auditAware: input.auditAware !== false,
        tags: input.tags ?? [],
        entryMode: input.entryMode,
      },
      severity: input.visibilityScope === 'restricted' || input.visibilityScope === 'confidential' ? 'warning' : 'info',
    });

    const record: OperationalNoteRecord = {
      id: noteId,
      subjectKind: input.subjectKind,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      body: input.body.trim(),
      author: input.author,
      authoredAt,
      tags: [...(input.tags ?? [])],
      visibilityScope: input.visibilityScope,
      visibleToRoles: input.visibleToRoles ? [...input.visibleToRoles] : undefined,
      followUpRequired: input.followUpRequired ?? false,
      auditAware: input.auditAware !== false,
      auditRecordId: auditRecord.id,
      allowsEdit: input.allowsEdit ?? true,
      status: 'active',
      editHistory: [],
      entryMode: input.entryMode,
      tenantId: input.tenantId ?? 'trackmind',
      racetrackId: input.racetrackId ?? 'main-track',
    };
    this.notes.set(record.id, record);

    return {
      accepted: true,
      noteId: record.id,
      auditId: auditRecord.id,
      auditRecordId: auditRecord.id,
      allowsEdit: record.allowsEdit,
      message: `Operational note ${record.id} recorded on ${input.subjectKind}:${input.entityId}.`,
    };
  }

  editNote(noteId: string, input: OperationalNoteEditInput): {
    accepted: boolean;
    noteId: string;
    auditId: string;
    revisionCount: number;
    message: string;
  } {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Unknown note ${noteId}`);
    if (!note.allowsEdit) throw new Error(`Note ${noteId} does not allow edits`);
    if (note.status !== 'active') throw new Error(`Note ${noteId} is not active`);

    const editedAt = this.clock();
    note.editHistory.push({
      editedAt,
      editedBy: input.editedBy,
      previousBody: note.body,
      reason: input.editReason,
    });
    note.body = input.body.trim();
    if (input.tags) note.tags = [...input.tags];
    if (input.followUpRequired !== undefined) note.followUpRequired = input.followUpRequired;

    const auditRecord = this.appendAudit({
      action: 'operational-note.revised',
      actor: input.editedBy,
      timestamp: editedAt,
      subjectId: `${note.subjectKind}:${note.entityId}`,
      tenantId: note.tenantId,
      racetrackId: note.racetrackId,
      reason: input.editReason ?? 'Operational note revised',
      payload: {
        noteId: note.id,
        revisionCount: note.editHistory.length,
        previousBodyLength: note.editHistory.at(-1)?.previousBody.length ?? 0,
      },
      severity: 'info',
    });
    note.auditRecordId = auditRecord.id;

    return {
      accepted: true,
      noteId: note.id,
      auditId: auditRecord.id,
      revisionCount: note.editHistory.length,
      message: `Note ${note.id} revised — ${note.editHistory.length} revision(s) on record.`,
    };
  }

  patchNoteMetadata(noteId: string, input: OperationalNoteMetadataPatchInput): {
    accepted: boolean;
    noteId: string;
    auditId: string;
    message: string;
    patchedFields: string[];
  } {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Unknown note ${noteId}`);
    if (!note.allowsEdit) throw new Error(`Note ${noteId} does not allow edits`);
    if (note.status !== 'active') throw new Error(`Note ${noteId} is not active`);

    const patchedAt = this.clock();
    const patchedFields: string[] = [];
    const previous: Record<string, unknown> = {};

    if (input.tags) {
      previous.tags = [...note.tags];
      note.tags = [...input.tags];
      patchedFields.push('tags');
    }
    if (input.followUpRequired !== undefined) {
      previous.followUpRequired = note.followUpRequired;
      note.followUpRequired = input.followUpRequired;
      patchedFields.push('followUpRequired');
    }
    if (patchedFields.length === 0) throw new Error('No metadata fields to patch');

    const auditRecord = this.appendAudit({
      action: 'operational-note.metadata-patched',
      actor: input.editedBy,
      timestamp: patchedAt,
      subjectId: `${note.subjectKind}:${note.entityId}`,
      tenantId: note.tenantId,
      racetrackId: note.racetrackId,
      reason: input.reason ?? 'Operational note metadata patched',
      payload: {
        noteId: note.id,
        patchedFields,
        previous,
      },
      severity: 'info',
    });
    note.auditRecordId = auditRecord.id;

    return {
      accepted: true,
      noteId: note.id,
      auditId: auditRecord.id,
      patchedFields,
      message: `Note ${note.id} metadata updated (${patchedFields.join(', ')}).`,
    };
  }

  getNote(noteId: string): OperationalNoteRecord {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Unknown note ${noteId}`);
    return clone(note);
  }

  queryJournal(filters: {
    subjectKind?: OperationalNoteSubjectKind;
    entityId?: string;
    author?: string;
    followUpRequired?: boolean;
    tag?: string;
    limit?: number;
  } = {}): { generatedAt: string; notes: OperationalNoteRecord[]; total: number } {
    const limit = filters.limit ?? 50;
    let notes = [...this.notes.values()].filter((note) => note.status === 'active');
    if (filters.subjectKind) notes = notes.filter((note) => note.subjectKind === filters.subjectKind);
    if (filters.entityId) notes = notes.filter((note) => note.entityId === filters.entityId);
    if (filters.author) notes = notes.filter((note) => note.author === filters.author);
    if (filters.followUpRequired === true) notes = notes.filter((note) => note.followUpRequired);
    if (filters.tag) notes = notes.filter((note) => note.tags.includes(filters.tag!));
    notes.sort((left, right) => Date.parse(right.authoredAt) - Date.parse(left.authoredAt));
    return {
      generatedAt: this.clock(),
      total: notes.length,
      notes: notes.slice(0, limit).map(clone),
    };
  }

  workspace(): { notes: OperationalNoteRecord[]; followUpCount: number; auditLinkedCount: number } {
    const notes = [...this.notes.values()].filter((note) => note.status === 'active').map(clone);
    return {
      notes,
      followUpCount: notes.filter((note) => note.followUpRequired).length,
      auditLinkedCount: notes.filter((note) => note.auditAware).length,
    };
  }

  private appendAudit(input: {
    action: string;
    actor: string;
    timestamp: string;
    subjectId: string;
    tenantId: string;
    racetrackId: string;
    reason: string;
    payload: Record<string, unknown>;
    severity: 'info' | 'warning' | 'critical';
  }): AuditLogEntry {
    return this.auditLog.append({
      id: `audit-note-${this.auditLog.all().length + 1}`,
      type: 'user-action',
      actor: input.actor,
      timestamp: input.timestamp,
      action: input.action,
      reason: input.reason,
      actionClass: 'api',
      subjectId: input.subjectId,
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
      severity: input.severity,
      payload: input.payload,
      regulations: ['TrackPolicy'],
      evidenceIds: [`operational-note:${input.payload.noteId ?? input.subjectId}`],
    });
  }

  private seed(): void {
    this.recordIntake({
      subjectKind: 'race-day-log',
      entityId: 'race-day-log-today',
      body: 'Morning ops briefing complete — surface firm, gate telemetry nominal.',
      author: 'operations-admin-operator',
      tags: ['briefing', 'surface', 'gate'],
      visibilityScope: 'team',
      followUpRequired: false,
      auditAware: true,
      allowsEdit: true,
      reason: 'Seeded race-day journal entry',
      entryMode: 'flash',
    });
    this.recordIntake({
      subjectKind: 'horse',
      entityId: 'horse-1',
      entityLabel: 'Sample horse',
      body: 'Handler reports normal appetite and movement during morning walk.',
      author: 'trainer-operator',
      tags: ['handler', 'morning-walk'],
      visibilityScope: 'internal',
      followUpRequired: false,
      auditAware: true,
      reason: 'Seeded horse observation',
      entryMode: 'full',
    });
  }
}

export function createOperationalNotesService(clock?: () => string): OperationalNotesService {
  return new OperationalNotesService(clock);
}
