import type { FacilitiesEntryMode, FacilityAssetCategory } from '@trackmind/shared';
import {
  defaultFacilitiesSeed,
  facilityAssetPresets,
  fieldsForFacilitiesEntryMode,
  getFacilityAssetPreset,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { FacilitiesWorkOrderTable } from './FacilitiesWorkOrderTable';
import { useTenantSession } from '@/auth/TenantSessionProvider';

const entryModeLabels: Record<FacilitiesEntryMode, { label: string; description: string }> = {
  quick: {
    label: 'Quick entry',
    description: 'Asset, rating, notes, and urgency — optimized for walkthroughs.',
  },
  full: {
    label: 'Full entry',
    description: 'Adds photos, next inspection date, maintenance owner, and scheduling detail.',
  },
};

export function FacilitiesEntryConsole({
  assets,
  inspections,
  workOrders,
  selectedAssetId,
  onSelectAsset,
  className,
}: {
  assets: Record<string, unknown>[];
  inspections: Record<string, unknown>[];
  workOrders: Record<string, unknown>[];
  selectedAssetId?: string;
  onSelectAsset?: (assetId: string) => void;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [workflowKind, setWorkflowKind] = useState<'inspection' | 'maintenance'>('inspection');
  const [entryMode, setEntryMode] = useState<FacilitiesEntryMode>('quick');
  const [facilityCategory, setFacilityCategory] = useState<FacilityAssetCategory>('utilities');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const actorId = `${session.role}-operator`;
  const resolvedAssetId = selectedAssetId
    ?? assets[0]?.assetId as string | undefined
    ?? getFacilityAssetPreset(facilityCategory).exampleAssetIds[0]
    ?? 'GRANDSTAND_HVAC_01';

  const seed = useMemo(
    () => ({
      ...defaultFacilitiesSeed(workflowKind, resolvedAssetId, actorId, facilityCategory),
      entryMode,
      assetId: resolvedAssetId,
    }),
    [workflowKind, entryMode, resolvedAssetId, actorId, facilityCategory],
  );

  const entityKind = workflowKind === 'inspection' ? 'facilities-inspection' : 'facilities-maintenance';
  const fieldHint = fieldsForFacilitiesEntryMode(workflowKind, entryMode).join(', ');

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Facilities inspection & maintenance"
        description="Operational entry for barns, paddock, surface, gates, utilities, and venue infrastructure."
      >
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Inspections are append-only. Maintenance schedules with operational impact remain approval-gated.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant={workflowKind === 'inspection' ? 'default' : 'outline'} onClick={() => setWorkflowKind('inspection')}>
            Inspection
          </Button>
          <Button size="sm" variant={workflowKind === 'maintenance' ? 'default' : 'outline'} onClick={() => setWorkflowKind('maintenance')}>
            Maintenance
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {facilityAssetPresets.map((preset) => (
            <Button
              key={preset.category}
              size="sm"
              variant={facilityCategory === preset.category ? 'governance' : 'outline'}
              title={preset.description}
              onClick={() => {
                setFacilityCategory(preset.category);
                onSelectAsset?.(preset.exampleAssetIds[0] ?? resolvedAssetId);
              }}
            >
              {preset.shortLabel}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(entryModeLabels) as FacilitiesEntryMode[]).map((mode) => (
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
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Asset: {resolvedAssetId} · Fields: {fieldHint}
        </p>

        {assets.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {assets.slice(0, 8).map((asset) => (
              <Button
                key={String(asset.assetId)}
                size="sm"
                variant={String(asset.assetId) === resolvedAssetId ? 'default' : 'outline'}
                onClick={() => onSelectAsset?.(String(asset.assetId))}
              >
                {String(asset.name ?? asset.assetId)}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="governance"
            onClick={() => {
              setMessage(null);
              setDialogOpen(true);
            }}
          >
            {workflowKind === 'inspection'
              ? entryMode === 'quick' ? 'Quick inspection' : 'Full inspection'
              : entryMode === 'quick' ? 'Quick maintenance' : 'Schedule maintenance'}
          </Button>
        </div>

        {message ? <div className="mt-3"><FormMessage message={message} tone="muted" /></div> : null}
      </SectionPanel>

      <SectionPanel title="Recent inspections" description="Condition ratings, urgency, and work-order triggers.">
        <RecordTable
          columns={[
            { key: 'asset', label: 'Asset' },
            { key: 'type', label: 'Type' },
            { key: 'score', label: 'Rating' },
            { key: 'status', label: 'Status' },
            { key: 'next', label: 'Next inspection' },
            { key: 'workOrder', label: 'Work order' },
          ]}
          rows={mapRecords(inspections, (row) => ({
            asset: String(row.assetId ?? '—'),
            type: String(row.inspectionType ?? '—'),
            score: row.score != null ? String(row.score) : '—',
            status: String(row.status ?? '—'),
            next: String(row.nextInspectionDueAt ?? '—'),
            workOrder: row.workOrderTriggered === true ? String(row.workOrderId ?? 'triggered') : '—',
          }))}
          emptyLabel="No inspections recorded yet."
        />
      </SectionPanel>

      <SectionPanel title="Open work orders" description="Maintenance backlog — inline priority and scheduling where safe.">
        <FacilitiesWorkOrderTable workOrders={workOrders} actorId={`${session.role}-operator`} />
      </SectionPanel>

      <TrackMindFormDialog
        entityKind={entityKind}
        mode="create"
        seed={seed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={workflowKind === 'inspection' ? 'Record inspection' : 'Maintenance entry'}
        description={workflowKind === 'inspection'
          ? 'Submit creates an immutable inspection record. Enable work-order trigger when issues require follow-up.'
          : 'Submit creates an approval-gated maintenance schedule when operational impact applies.'}
        submitLabel={workflowKind === 'inspection' ? 'Record inspection' : 'Submit maintenance'}
        onSubmitted={(result) => {
          setMessage(result.message ?? (workflowKind === 'inspection' ? 'Inspection recorded.' : 'Maintenance submitted.'));
          void queryClient.invalidateQueries({ queryKey: ['workspace'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
