import type { OperationalNoteEntryMode, OperationalNoteSubjectKind } from '@trackmind/shared';
import {
  defaultOperationalNoteSeed,
  getOperationalNoteSubject,
  operationalNoteSubjects,
} from '@trackmind/shared';
import type { KeyboardEvent, ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { OperationalNoteJournalTable } from './OperationalNoteJournalTable';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { postJson } from '@/api/client';
import { assertMutationOk } from '@/api/approvalPayload';
import { apiPaths } from '@/api/paths';
import { useTenantSession } from '@/auth/TenantSessionProvider';

const entryModeLabels: Record<OperationalNoteEntryMode, { label: string; description: string }> = {
  flash: {
    label: 'Flash entry',
    description: 'Type, tag, and submit — Ctrl+Enter saves without leaving the keyboard.',
  },
  full: {
    label: 'Full journal',
    description: 'Visibility scope, audit flags, and timestamps for formal journal records.',
  },
};

export function OperationalNotesConsole({
  notes,
  defaultSubjectKind = 'race-day-log',
  defaultEntityId,
  className,
}: {
  notes: Record<string, unknown>[];
  defaultSubjectKind?: OperationalNoteSubjectKind;
  defaultEntityId?: string;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actorId = `${session.role}-operator`;

  const [entryMode, setEntryMode] = useState<OperationalNoteEntryMode>('flash');
  const [subjectKind, setSubjectKind] = useState<OperationalNoteSubjectKind>(defaultSubjectKind);
  const [entityId, setEntityId] = useState(defaultEntityId ?? getOperationalNoteSubject(defaultSubjectKind).exampleEntityId);
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [reason, setReason] = useState('Race-day operational note');
  const [visibilityScope, setVisibilityScope] = useState<'team' | 'internal'>('team');
  const [auditAware, setAuditAware] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const seed = useMemo(
    () => ({
      ...defaultOperationalNoteSeed(subjectKind, actorId, entityId),
      entryMode,
    }),
    [subjectKind, actorId, entityId, entryMode],
  );

  const submitFlash = useCallback(async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const payload = {
        ...seed,
        body: body.trim(),
        tags,
        followUpRequired,
        auditAware,
        visibilityScope,
        reason: reason.trim() || 'Operational note',
        author: actorId,
        entryMode,
      };
      if (editingNoteId) {
        await postJson(apiPaths.operationalNotes.revisions, {
          noteId: editingNoteId,
          body: body.trim(),
          editedBy: actorId,
          editReason: reason.trim() || 'Note revision',
          tags: tags.split(/[\n,]+/).map((tag) => tag.trim()).filter(Boolean),
          followUpRequired,
        }).then(assertMutationOk);
        setMessage(`Note ${editingNoteId} revised.`);
        setEditingNoteId(null);
      } else {
        await postJson(apiPaths.operationalNotes.intake, payload).then(assertMutationOk);
        setMessage('Note saved.');
      }
      setBody('');
      setTags('');
      setFollowUpRequired(false);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      textareaRef.current?.focus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save note.');
    } finally {
      setSubmitting(false);
    }
  }, [auditAware, body, editingNoteId, entryMode, entityId, followUpRequired, queryClient, reason, seed, submitting, tags, visibilityScope, actorId]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void submitFlash();
    }
  };

  const beginEdit = (note: Record<string, unknown>) => {
    if (note.allowsEdit === false) {
      setMessage('This note does not allow edits.');
      return;
    }
    setEditingNoteId(String(note.id));
    setBody(String(note.body ?? ''));
    setTags(Array.isArray(note.tags) ? note.tags.map(String).join(', ') : '');
    setFollowUpRequired(note.followUpRequired === true);
    setSubjectKind(String(note.subjectKind ?? subjectKind) as OperationalNoteSubjectKind);
    setEntityId(String(note.entityId ?? entityId));
    setReason('Note revision');
    textareaRef.current?.focus();
  };

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Operational notes & journal"
        description="Unified notes for horses, races, incidents, approvals, facilities, security, compliance, meetings, and race-day logs."
      >
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Flash entry: type note → Ctrl+Enter to save. Notes are audit-linked when audit awareness is enabled.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(entryModeLabels) as OperationalNoteEntryMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={entryMode === mode ? 'governance' : 'outline'}
              onClick={() => setEntryMode(mode)}
            >
              {entryModeLabels[mode].label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{entryModeLabels[entryMode].description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {operationalNoteSubjects.map((subject, index) => (
            <Button
              key={subject.kind}
              size="sm"
              variant={subjectKind === subject.kind ? 'default' : 'outline'}
              title={`${subject.description}${index < 9 ? ` · Alt+${index + 1}` : ''}`}
              onClick={() => {
                setSubjectKind(subject.kind);
                setEntityId(subject.exampleEntityId);
              }}
            >
              {subject.shortLabel}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block text-xs text-[var(--muted-foreground)]">
            Related entity
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              placeholder={getOperationalNoteSubject(subjectKind).exampleEntityId}
            />
          </label>
          <label className="block text-xs text-[var(--muted-foreground)]">
            Tags
            <input
              className="mt-1 w-full min-w-[12rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="gate, surface, follow-up"
            />
          </label>
        </div>

        <label className="mt-4 block text-xs text-[var(--muted-foreground)]">
          {editingNoteId ? `Editing ${editingNoteId}` : 'Note body'}
          <textarea
            ref={textareaRef}
            className="mt-1 min-h-[7rem] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono leading-relaxed"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type operational note… Ctrl+Enter to save"
            autoFocus
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--muted-foreground)]">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={followUpRequired} onChange={(event) => setFollowUpRequired(event.target.checked)} />
            Follow-up required
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={auditAware} onChange={(event) => setAuditAware(event.target.checked)} />
            Audit-linked
          </label>
          {entryMode === 'full' ? (
            <label className="inline-flex items-center gap-2">
              Visibility
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                value={visibilityScope}
                onChange={(event) => setVisibilityScope(event.target.value as 'team' | 'internal')}
              >
                <option value="team">Team</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
          ) : null}
        </div>

        <label className="mt-3 block text-xs text-[var(--muted-foreground)]">
          Audit reason
          <input
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="governance" disabled={submitting || !body.trim()} onClick={() => void submitFlash()}>
            {editingNoteId ? 'Save revision (Ctrl+Enter)' : 'Save note (Ctrl+Enter)'}
          </Button>
          {editingNoteId ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingNoteId(null);
                setBody('');
                setReason('Race-day operational note');
              }}
            >
              Cancel edit
            </Button>
          ) : null}
        </div>

        {message ? (
          <div className="mt-3">
            <FormMessage message={message} tone="muted" />
          </div>
        ) : null}

        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Author: {session.role} · Subject: {subjectKind} · Entity: {entityId}
        </p>
      </SectionPanel>

      <SectionPanel title="Journal feed" description="Recent operational notes — inline edit tags, follow-up, and note body where permitted.">
        <OperationalNoteJournalTable
          notes={notes}
          actorId={actorId}
          onEditInComposer={beginEdit}
        />
      </SectionPanel>
    </div>
  );
}
