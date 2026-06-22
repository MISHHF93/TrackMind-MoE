import type { DataEntryEntityKind, RaceCardLifecycleStatus } from '@trackmind/shared';
import {
  canEditRaceCard,
  getAllowedLifecycleTransitions,
  getRaceCardWorkflowStep,
  raceCardWorkflowSteps,
  validateRaceCardEntryConflicts,
  validateRaceCardReadyForReview,
  type RaceCardWorkflowStep,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { isRecord } from '@/lib/utils';
import { extractArray } from '@/hooks/useWorkspaceData';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { RaceCardLifecycleBadge } from './RaceCardLifecycleBadge';

function asManagedCard(card: Record<string, unknown>): {
  id: string;
  raceNumber: number;
  lifecycleStatus: RaceCardLifecycleStatus;
  conditions: Record<string, unknown>;
  classification: Record<string, unknown>;
  purse: Record<string, unknown>;
  entries: Record<string, unknown>[];
} {
  return {
    id: String(card.id ?? card.raceCardId ?? ''),
    raceNumber: Number(card.raceNumber ?? 0),
    lifecycleStatus: String(card.lifecycleStatus ?? card.status ?? 'draft') as RaceCardLifecycleStatus,
    conditions: isRecord(card.conditions) ? card.conditions : {},
    classification: isRecord(card.classification) ? card.classification : {},
    purse: isRecord(card.purse) ? card.purse : {},
    entries: extractArray(card, 'entries'),
  };
}

export function RaceCardWorkflowWizard({
  raceCards,
  auditTrail,
  defaultRaceDayId,
  className,
}: {
  raceCards: Record<string, unknown>[];
  auditTrail?: Record<string, unknown>[];
  defaultRaceDayId?: string;
  className?: string;
}): ReactElement {
  const queryClient = useQueryClient();
  const cards = useMemo(() => raceCards.map(asManagedCard).filter((card) => card.id), [raceCards]);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(cards[0]?.id);
  const [activeStep, setActiveStep] = useState<RaceCardWorkflowStep>('create');
  const [dialog, setDialog] = useState<{ entityKind: DataEntryEntityKind; seed?: Record<string, unknown>; recordId?: string; mode?: 'create' | 'edit' } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? cards[0];
  const editable = selectedCard ? canEditRaceCard(selectedCard.lifecycleStatus) : true;

  const seed = useMemo(() => ({
    raceCardId: selectedCard?.id,
    raceDayId: defaultRaceDayId ?? 'race-day-1',
    raceDate: new Date().toISOString().slice(0, 10),
    scheduledPostTime: new Date().toISOString().slice(0, 16),
    surface: selectedCard?.conditions.surface ?? 'dirt',
    distanceFurlongs: selectedCard?.conditions.distanceFurlongs ?? 6,
    classLevel: selectedCard?.classification.classLevel ?? 'Open',
    stakesGrade: selectedCard?.classification.stakesGrade ?? 'allowance',
    claimingPrice: selectedCard?.classification.claimingPrice,
    basePurse: selectedCard?.purse.basePurse ?? 0,
    currency: selectedCard?.purse.currency ?? 'USD',
  }), [selectedCard, defaultRaceDayId]);

  const validationIssues = useMemo(() => {
    if (!selectedCard) return [];
    return [
      ...validateRaceCardReadyForReview({
        conditions: {
          surface: String(selectedCard.conditions.surface ?? 'dirt') as 'dirt' | 'turf' | 'synthetic',
          distanceFurlongs: Number(selectedCard.conditions.distanceFurlongs ?? 0),
        },
        classification: {
          classLevel: String(selectedCard.classification.classLevel ?? 'Open'),
          stakesGrade: String(selectedCard.classification.stakesGrade ?? 'allowance') as 'allowance',
          claimingPrice: selectedCard.classification.claimingPrice != null
            ? Number(selectedCard.classification.claimingPrice)
            : undefined,
        },
        purse: { basePurse: Number(selectedCard.purse.basePurse ?? 0) },
        entries: selectedCard.entries.map((entry) => ({
          id: String(entry.id ?? ''),
          horseId: String(entry.horseId ?? ''),
          jockeyId: entry.jockeyId ? String(entry.jockeyId) : undefined,
          postPosition: entry.postPosition != null ? Number(entry.postPosition) : undefined,
          scratched: Boolean(entry.scratched),
          trainerId: String(entry.trainerId ?? ''),
        })),
      }),
      ...validateRaceCardEntryConflicts(selectedCard.entries.map((entry) => ({
        id: String(entry.id ?? ''),
        horseId: String(entry.horseId ?? ''),
        jockeyId: entry.jockeyId ? String(entry.jockeyId) : undefined,
        postPosition: entry.postPosition != null ? Number(entry.postPosition) : undefined,
        scratched: Boolean(entry.scratched),
      }))),
    ];
  }, [selectedCard]);

  const allowedTransitions = selectedCard
    ? getAllowedLifecycleTransitions(selectedCard.lifecycleStatus)
    : [];

  const cardAudit = useMemo(
    () => (auditTrail ?? []).filter((record) => String(record.raceCardId ?? '') === selectedCard?.id).slice(-8),
    [auditTrail, selectedCard?.id],
  );

  const openStepForm = (step: RaceCardWorkflowStep) => {
    const definition = getRaceCardWorkflowStep(step);
    if (!definition.entityKind) return;
    setMessage(null);
    setDialog({
      entityKind: definition.entityKind,
      seed,
      recordId: selectedCard?.id,
      mode: step === 'create' && !selectedCard ? 'create' : 'edit',
    });
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['workspace'] });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Race card entry & editing"
        description="Step-based workflow with draft, approved, and published lifecycle states. All saves are audit-logged."
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--muted-foreground)]">
            Card
            <select
              className="ml-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
              value={selectedCard?.id ?? ''}
              onChange={(event) => setSelectedCardId(event.target.value || undefined)}
            >
              {cards.length === 0 ? <option value="">No race cards</option> : null}
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  Race {card.raceNumber} — {card.id}
                </option>
              ))}
            </select>
          </label>
          {selectedCard ? (
            <RaceCardLifecycleBadge status={selectedCard.lifecycleStatus} showDescription />
          ) : null}
          {!editable && selectedCard ? (
            <span className="text-xs text-[var(--status-warning)]">Published cards are read-only.</span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {raceCardWorkflowSteps.map((stepDef, index) => {
            const isActive = activeStep === stepDef.step;
            const blocked = stepDef.step !== 'create' && !selectedCard;
            return (
              <Button
                key={stepDef.step}
                size="sm"
                variant={isActive ? 'governance' : 'outline'}
                disabled={blocked}
                title={stepDef.description}
                onClick={() => {
                  setActiveStep(stepDef.step);
                  if (stepDef.step !== 'assignments' && stepDef.step !== 'publication') {
                    openStepForm(stepDef.step);
                  }
                }}
              >
                {index + 1}. {stepDef.shortLabel}
              </Button>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => openStepForm('create')}>
            New race card
          </Button>
        </div>

        {validationIssues.length > 0 ? (
          <div className="mt-4 rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-3 py-2">
            <p className="text-sm font-medium text-[var(--status-warning)]">Validation issues</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted-foreground)]">
              {validationIssues.slice(0, 6).map((issue) => (
                <li key={`${issue.code}-${issue.entryId ?? issue.field ?? issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-xs text-[var(--status-nominal)]">No blocking validation issues detected.</p>
        )}

        {activeStep === 'assignments' && selectedCard ? (
          <div className="mt-4 space-y-3">
            <RecordTable
              columns={[
                { key: 'entry', label: 'Entry' },
                { key: 'horse', label: 'Horse' },
                { key: 'trainer', label: 'Trainer' },
                { key: 'jockey', label: 'Jockey' },
                { key: 'post', label: 'Post' },
                { key: 'actions', label: 'Actions' },
              ]}
              rows={mapRecords(selectedCard.entries, (entry) => ({
                entry: String(entry.id ?? '—'),
                horse: String(entry.horseId ?? '—'),
                trainer: String(entry.trainerId ?? '—'),
                jockey: String(entry.jockeyId ?? '—'),
                post: entry.postPosition != null ? String(entry.postPosition) : '—',
                actions: entry.id ? String(entry.id) : '',
              }))}
              emptyLabel="No entries — add horses in the Entries step."
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="governance" disabled={!editable} onClick={() => setDialog({ entityKind: 'race-card-entry', seed, recordId: selectedCard.id })}>
                Add entry
              </Button>
              {selectedCard.entries.slice(0, 6).map((entry) => (
                <div key={String(entry.id)} className="flex flex-wrap gap-1 rounded border border-[var(--border)] p-2">
                  <span className="text-xs text-[var(--muted-foreground)]">{String(entry.horseId)}</span>
                  <Button size="sm" variant="outline" disabled={!editable} onClick={() => setDialog({ entityKind: 'race-card-entry-trainer', seed: { ...seed, entryId: entry.id }, recordId: selectedCard.id })}>
                    Trainer
                  </Button>
                  <Button size="sm" variant="outline" disabled={!editable} onClick={() => setDialog({ entityKind: 'jockey-assignment', seed: { ...seed, entryId: entry.id, jockeyId: '' }, recordId: selectedCard.id })}>
                    Jockey
                  </Button>
                  <Button size="sm" variant="outline" disabled={!editable} onClick={() => setDialog({ entityKind: 'race-card-post-position', seed: { ...seed, entryId: entry.id, postPosition: entry.postPosition ?? 1 }, recordId: selectedCard.id })}>
                    Post
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeStep === 'publication' && selectedCard ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Allowed transitions from {selectedCard.lifecycleStatus}: {allowedTransitions.join(', ') || 'none'}
            </p>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions.map((toStatus) => (
                <Button
                  key={toStatus}
                  size="sm"
                  variant={toStatus === 'published' ? 'governance' : 'outline'}
                  onClick={() => setDialog({
                    entityKind: 'race-card-lifecycle',
                    seed: { ...seed, toStatus, transitionReason: `Transition to ${toStatus} from race card workflow.` },
                    recordId: selectedCard.id,
                  })}
                >
                  → {toStatus}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {message ? <FormMessage message={message} tone="muted" /> : null}
      </SectionPanel>

      {selectedCard && cardAudit.length > 0 ? (
        <SectionPanel title="Race card audit trail" description="Recent changes for the selected card.">
          <RecordTable
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'actor', label: 'Actor' },
              { key: 'time', label: 'Time' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={mapRecords(cardAudit, (record) => ({
              action: String(record.action ?? '—'),
              actor: String(record.actor ?? '—'),
              time: String(record.timestamp ?? '—'),
              detail: String(record.changeSummary ?? '—'),
            }))}
          />
        </SectionPanel>
      ) : null}

      {dialog ? (
        <TrackMindFormDialog
          entityKind={dialog.entityKind}
          mode={dialog.mode ?? 'create'}
          recordId={dialog.recordId}
          seed={dialog.seed}
          open
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          onSubmitted={(result) => {
            setMessage(result.message ?? 'Saved.');
            invalidate();
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
