import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import {
  ConfirmDestructiveDialog,
  InlineEditableText,
  InlineTagEditor,
  InlineToggleChip,
  useInlineMetadataPatch,
} from '@/design/components/inline-edit';
import { postJson } from '@/api/client';
import { assertMutationOk } from '@/api/approvalPayload';
import { apiPaths } from '@/api/paths';
import { useQueryClient } from '@tanstack/react-query';

function OperationalNoteJournalRow({
  note,
  actorId,
  onEditInComposer,
}: {
  note: Record<string, unknown>;
  actorId: string;
  onEditInComposer: () => void;
}): ReactElement {
  const noteId = String(note.id ?? '');
  const editable = note.allowsEdit !== false;
  const queryClient = useQueryClient();
  const {
    saveField,
    pendingDestructive,
    clearPendingDestructive,
    confirmDestructive,
    saving,
  } = useInlineMetadataPatch({
    entityScope: 'operational-note',
    entityId: noteId,
    actorId,
  });

  const tags = Array.isArray(note.tags) ? note.tags.map(String) : [];

  const saveBody = async (nextBody: string) => {
    await postJson(apiPaths.operationalNotes.revisions, {
      noteId,
      body: nextBody,
      editedBy: actorId,
      editReason: 'Inline note edit',
    }).then(assertMutationOk);
    await queryClient.invalidateQueries({ queryKey: ['workspace'] });
  };

  return (
    <tr className="border-t border-[var(--border)] bg-[var(--card)]">
      <td className="px-3 py-2 align-top text-xs text-[var(--muted-foreground)]">
        {String(note.authoredAt ?? '—').slice(0, 16)}
      </td>
      <td className="px-3 py-2 align-top text-sm">{String(note.subjectKind ?? '—')}</td>
      <td className="px-3 py-2 align-top text-sm">{String(note.entityId ?? '—')}</td>
      <td className="max-w-xs px-3 py-2 align-top">
        <InlineEditableText
          value={String(note.body ?? '')}
          onSave={saveBody}
          disabled={!editable}
          multiline
        />
      </td>
      <td className="px-3 py-2 align-top text-sm">{String(note.author ?? '—')}</td>
      <td className="min-w-[8rem] px-3 py-2 align-top">
        <InlineTagEditor
          tags={tags}
          disabled={!editable || saving}
          onChange={(nextTags) => { void saveField('tags', nextTags); }}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <InlineToggleChip
          active={note.followUpRequired === true}
          label="Follow-up"
          activeLabel="Follow-up ✓"
          disabled={!editable || saving}
          onToggle={(next) => { void saveField('followUpRequired', next); }}
        />
      </td>
      <td className="px-3 py-2 align-top text-xs font-mono text-[var(--muted-foreground)]">
        {String(note.auditRecordId ?? '—').slice(0, 12)}
      </td>
      <td className="px-3 py-2 align-top">
        {editable ? (
          <button
            type="button"
            className="text-xs text-[var(--brand-maroon)] hover:underline"
            onClick={onEditInComposer}
          >
            Full edit
          </button>
        ) : null}
      </td>
      <ConfirmDestructiveDialog
        open={pendingDestructive !== null}
        onOpenChange={(open) => {
          if (!open) clearPendingDestructive();
        }}
        title="Confirm metadata change"
        description={`Clear follow-up flag on ${noteId}? This is audit-logged.`}
        onConfirm={() => { void confirmDestructive('Follow-up flag cleared inline'); }}
        confirming={saving}
      />
    </tr>
  );
}

export function OperationalNoteJournalTable({
  notes,
  actorId,
  onEditInComposer,
  className,
}: {
  notes: Record<string, unknown>[];
  actorId: string;
  onEditInComposer: (note: Record<string, unknown>) => void;
  className?: string;
}): ReactElement {
  if (notes.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No operational notes yet.</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md border border-[var(--border)]', className)}>
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Time', 'Subject', 'Entity', 'Note', 'Author', 'Tags', 'Follow-up', 'Audit', ''].map((label) => (
              <th key={label || 'actions'} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notes.slice(0, 12).map((note) => (
            <OperationalNoteJournalRow
              key={String(note.id)}
              note={note}
              actorId={actorId}
              onEditInComposer={() => onEditInComposer(note)}
            />
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        Click note text, tags, or follow-up to edit inline. Medical, payout, and official-result fields remain approval-governed.
      </p>
    </div>
  );
}
