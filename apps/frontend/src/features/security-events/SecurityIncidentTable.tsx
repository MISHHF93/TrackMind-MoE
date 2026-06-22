import { inlineStatusOptionSets } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import {
  ConfirmDestructiveDialog,
  InlineEditableText,
  InlineStatusSelect,
  useInlineMetadataPatch,
} from '@/design/components/inline-edit';

function SecurityIncidentRow({
  incident,
  actorId,
}: {
  incident: Record<string, unknown>;
  actorId: string;
}): ReactElement {
  const incidentId = String(incident.id ?? '');
  const {
    saveField,
    pendingDestructive,
    clearPendingDestructive,
    confirmDestructive,
    saving,
  } = useInlineMetadataPatch({
    entityScope: 'security-incident',
    entityId: incidentId,
    actorId,
  });

  return (
    <tr className="border-t border-[var(--border)] bg-[var(--card)]">
      <td className="px-3 py-2 align-top text-sm font-medium">{String(incident.title ?? incidentId)}</td>
      <td className="px-3 py-2 align-top text-sm">{String(incident.severity ?? '—')}</td>
      <td className="min-w-[12rem] px-3 py-2 align-top">
        <InlineStatusSelect
          compact
          value={String(incident.status ?? 'open')}
          options={inlineStatusOptionSets.securityIncidentStatus}
          disabled={saving}
          onChange={(next) => { void saveField('status', next); }}
        />
      </td>
      <td className="px-3 py-2 align-top text-sm">{String(incident.zoneId ?? '—')}</td>
      <td className="min-w-[8rem] px-3 py-2 align-top">
        <InlineEditableText
          value={String(incident.assignedTo ?? '')}
          onSave={(next) => { void saveField('assignedTo', next); }}
          placeholder="Assign owner"
        />
      </td>
      <ConfirmDestructiveDialog
        open={pendingDestructive !== null}
        onOpenChange={(open) => {
          if (!open) clearPendingDestructive();
        }}
        title="Resolve security incident?"
        description={`Mark ${incidentId} resolved? Escalation and official outcomes remain approval-governed.`}
        onConfirm={() => { void confirmDestructive('Incident resolved inline'); }}
        confirming={saving}
      />
    </tr>
  );
}

export function SecurityIncidentTable({
  incidents,
  actorId,
  className,
}: {
  incidents: Record<string, unknown>[];
  actorId: string;
  className?: string;
}): ReactElement {
  if (incidents.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No open security incidents.</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md border border-[var(--border)]', className)}>
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Incident', 'Severity', 'Status', 'Zone', 'Assignee'].map((label) => (
              <th key={label} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.slice(0, 8).map((incident) => (
            <SecurityIncidentRow key={String(incident.id)} incident={incident} actorId={actorId} />
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        Assignee and triage status are inline-editable. Escalation and resolution of regulated outcomes require approval.
      </p>
    </div>
  );
}
