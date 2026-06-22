import { inlineStatusOptionSets } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import {
  ConfirmDestructiveDialog,
  InlineEditableText,
  InlineStatusSelect,
  useInlineMetadataPatch,
} from '@/design/components/inline-edit';

function ComplianceEvidenceRow({
  record,
  actorId,
}: {
  record: Record<string, unknown>;
  actorId: string;
}): ReactElement {
  const evidenceId = String(record.id ?? '');
  const {
    saveField,
    pendingDestructive,
    clearPendingDestructive,
    confirmDestructive,
    saving,
  } = useInlineMetadataPatch({
    entityScope: 'compliance-evidence',
    entityId: evidenceId,
    actorId,
  });

  return (
    <tr className="border-t border-[var(--border)] bg-[var(--card)]">
      <td className="px-3 py-2 align-top text-sm font-medium">{String(record.title ?? evidenceId)}</td>
      <td className="px-3 py-2 align-top text-sm">{String(record.controlId ?? '—')}</td>
      <td className="px-3 py-2 align-top text-sm">{String(record.domain ?? '—')}</td>
      <td className="px-3 py-2 align-top text-sm">{String(record.evidenceType ?? '—')}</td>
      <td className="min-w-[14rem] px-3 py-2 align-top">
        <InlineStatusSelect
          compact
          value={String(record.reviewStatus ?? 'draft')}
          options={inlineStatusOptionSets.complianceEvidenceReviewStatus}
          disabled={saving}
          onChange={(next) => { void saveField('reviewStatus', next); }}
        />
      </td>
      <td className="max-w-xs px-3 py-2 align-top">
        <InlineEditableText
          value={String(record.notes ?? '')}
          onSave={(next) => { void saveField('notes', next); }}
          placeholder="Add notes"
          maxPreviewLength={48}
        />
      </td>
      <td className="px-3 py-2 align-top text-xs font-mono text-[var(--muted-foreground)]">
        {String(record.auditRecordId ?? '—').slice(0, 12)}
      </td>
      <ConfirmDestructiveDialog
        open={pendingDestructive !== null}
        onOpenChange={(open) => {
          if (!open) clearPendingDestructive();
        }}
        title="Archive evidence record?"
        description={`Archiving ${evidenceId} is audit-logged. Approved/rejected outcomes still require review workflow.`}
        onConfirm={() => { void confirmDestructive('Evidence archived inline'); }}
        confirming={saving}
      />
    </tr>
  );
}

export function ComplianceEvidenceRegistryTable({
  records,
  actorId,
  className,
}: {
  records: Record<string, unknown>[];
  actorId: string;
  className?: string;
}): ReactElement {
  if (records.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No structured evidence records yet.</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md border border-[var(--border)]', className)}>
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Title', 'Control', 'Domain', 'Type', 'Review', 'Notes', 'Audit'].map((label) => (
              <th key={label} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.slice(0, 12).map((record) => (
            <ComplianceEvidenceRow key={String(record.id)} record={record} actorId={actorId} />
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        Review status and notes are inline-editable. Approved/rejected outcomes remain approval-governed.
      </p>
    </div>
  );
}
