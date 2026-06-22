import type { EquineObservationEntryMode, EquineObservationKind } from '@trackmind/shared';
import {
  defaultObservationSeed,
  fieldsForObservationEntryMode,
  observationTypesForKind,
  redactObservationForRole,
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
import { useTenantSession } from '@/auth/TenantSessionProvider';

const entryModeLabels: Record<EquineObservationEntryMode, { label: string; description: string }> = {
  quick: {
    label: 'Quick note',
    description: 'Horse, type, severity, and notes — optimized for barn and paddock speed.',
  },
  professional: {
    label: 'Professional detail',
    description: 'Adds clearance state, restrictions, privacy scope, and race-day impact linkage.',
  },
};

const kindLabels: Record<EquineObservationKind, { label: string; description: string }> = {
  welfare: {
    label: 'Welfare',
    description: 'Field welfare observation — non-clinical scoring and follow-up flags.',
  },
  veterinary: {
    label: 'Veterinary',
    description: 'Clinical observation — privacy-scoped; restricted details hidden from unauthorized roles.',
  },
};

export function EquineObservationConsole({
  horseId = 'horse-1',
  veterinaryObservations = [],
  welfareObservations = [],
  className,
}: {
  horseId?: string;
  veterinaryObservations?: Record<string, unknown>[];
  welfareObservations?: Record<string, unknown>[];
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [observationKind, setObservationKind] = useState<EquineObservationKind>('welfare');
  const [entryMode, setEntryMode] = useState<EquineObservationEntryMode>('quick');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const actorId = `${session.role}-operator`;
  const seed = useMemo(
    () => ({ ...defaultObservationSeed(observationKind, horseId, actorId, session.role), entryMode }),
    [observationKind, entryMode, horseId, actorId, session.role],
  );

  const entityKind = observationKind === 'veterinary' ? 'veterinary-observation' : 'welfare-observation';
  const typeHint = observationTypesForKind(observationKind).map((type) => type.label).join(', ');
  const fieldHint = fieldsForObservationEntryMode(entryMode, observationKind).join(', ');

  const history = useMemo(() => {
    const merged = [
      ...veterinaryObservations.map((row) => ({ ...row, _kind: 'veterinary' as const })),
      ...welfareObservations.map((row) => ({ ...row, _kind: 'welfare' as const })),
    ]
      .map((row) => redactObservationForRole(row, session.role))
      .sort((a, b) => String(b.observedAt ?? '').localeCompare(String(a.observedAt ?? '')));
    return merged;
  }, [veterinaryObservations, welfareObservations, session.role]);

  const canSeeClinicalNotes = session.role === 'veterinarian' || session.role === 'admin' || session.role === 'compliance-officer';

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Equine observation entry"
        description="Structured veterinary and welfare observations with privacy scope, clearance state, and immutable history."
      >
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Observations are append-only — history cannot be edited. Restricted medical details are filtered for your role ({session.role}).
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(kindLabels) as EquineObservationKind[]).map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={observationKind === kind ? 'default' : 'outline'}
              title={kindLabels[kind].description}
              onClick={() => setObservationKind(kind)}
            >
              {kindLabels[kind].label}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(entryModeLabels) as EquineObservationEntryMode[]).map((mode) => (
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
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Types: {typeHint}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Fields: {fieldHint}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="governance"
            onClick={() => {
              setMessage(null);
              setDialogOpen(true);
            }}
          >
            {entryMode === 'quick' ? 'Quick observation' : 'Professional observation'}
          </Button>
        </div>

        {message ? <div className="mt-3"><FormMessage message={message} tone="muted" /></div> : null}

        {!canSeeClinicalNotes && observationKind === 'veterinary' ? (
          <p className="mt-3 text-xs text-[var(--status-warning)]">
            Clinical notes are hidden from your role — you may still record observations routed to the care team.
          </p>
        ) : null}
      </SectionPanel>

      <SectionPanel title="Observation history" description="Immutable audit-linked records — redacted fields marked when privacy scope excludes your role.">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'kind', label: 'Kind' },
            { key: 'type', label: 'Type' },
            { key: 'severity', label: 'Severity' },
            { key: 'notes', label: 'Notes' },
            { key: 'impact', label: 'Race-day' },
            { key: 'audit', label: 'Audit' },
          ]}
          rows={mapRecords(history, (row) => ({
            time: String(row.observedAt ?? '—'),
            kind: String(row._kind ?? '—'),
            type: String(row.observationType ?? row.category ?? '—'),
            severity: String(row.severity ?? '—'),
            notes: String(row.notes ?? row.summary ?? '—'),
            impact: String(row.raceDayImpact ?? 'none'),
            audit: row.redacted === true ? `${String(row.auditId ?? '—')} (redacted)` : String(row.auditId ?? '—'),
          }))}
          emptyLabel="No observations recorded yet."
        />
      </SectionPanel>

      <TrackMindFormDialog
        entityKind={entityKind}
        mode="create"
        seed={seed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={observationKind === 'veterinary' ? 'Veterinary observation' : 'Welfare observation'}
        description="Submit creates a new immutable observation — prior records are never modified."
        submitLabel="Record observation"
        onSubmitted={(result) => {
          setMessage(result.message ?? 'Observation recorded and audit-linked.');
          void queryClient.invalidateQueries({ queryKey: ['workspace'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
