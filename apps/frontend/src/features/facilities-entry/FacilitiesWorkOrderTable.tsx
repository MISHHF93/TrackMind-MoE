import { inlineStatusOptionSets } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import {
  ConfirmDestructiveDialog,
  InlineSchedulingField,
  InlineStatusSelect,
  useInlineMetadataPatch,
} from '@/design/components/inline-edit';

function FacilitiesWorkOrderRow({
  order,
  actorId,
}: {
  order: Record<string, unknown>;
  actorId: string;
}): ReactElement {
  const workOrderId = String(order.id ?? '');
  const {
    saveField,
    pendingDestructive,
    clearPendingDestructive,
    confirmDestructive,
    saving,
  } = useInlineMetadataPatch({
    entityScope: 'facilities-work-order',
    entityId: workOrderId,
    actorId,
  });

  return (
    <tr className="border-t border-[var(--border)] bg-[var(--card)]">
      <td className="px-3 py-2 align-top text-sm">{String(order.title ?? workOrderId)}</td>
      <td className="px-3 py-2 align-top text-sm">{String(order.assetId ?? '—')}</td>
      <td className="min-w-[10rem] px-3 py-2 align-top">
        <InlineStatusSelect
          compact
          value={String(order.priority ?? 'normal')}
          options={inlineStatusOptionSets.facilitiesWorkOrderPriority}
          disabled={saving}
          onChange={(next) => { void saveField('priority', next); }}
        />
      </td>
      <td className="px-3 py-2 align-top text-sm">{String(order.status ?? '—')}</td>
      <td className="px-3 py-2 align-top">
        <InlineSchedulingField
          value={order.scheduledFor ? String(order.scheduledFor) : undefined}
          disabled={saving}
          onSave={(next) => { void saveField('scheduledFor', next); }}
        />
      </td>
      <ConfirmDestructiveDialog
        open={pendingDestructive !== null}
        onOpenChange={(open) => {
          if (!open) clearPendingDestructive();
        }}
        title="Confirm work order change"
        description={`Apply destructive change to ${workOrderId}? Completion and cancellation remain approval-governed.`}
        onConfirm={() => { void confirmDestructive('Work order metadata patched inline'); }}
        confirming={saving}
      />
    </tr>
  );
}

export function FacilitiesWorkOrderTable({
  workOrders,
  actorId,
  className,
}: {
  workOrders: Record<string, unknown>[];
  actorId: string;
  className?: string;
}): ReactElement {
  if (workOrders.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No work orders open.</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md border border-[var(--border)]', className)}>
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Order', 'Asset', 'Priority', 'Status', 'Scheduled'].map((label) => (
              <th key={label} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workOrders.slice(0, 12).map((order) => (
            <FacilitiesWorkOrderRow key={String(order.id)} order={order} actorId={actorId} />
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        Priority and scheduling are inline-editable. Work order completion requires governed workflow.
      </p>
    </div>
  );
}
