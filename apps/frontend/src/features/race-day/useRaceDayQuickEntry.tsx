import type { RaceDayQuickAction, RaceDayQuickEntryContext, QuickStatusOption } from '@trackmind/shared';
import { getRaceDayQuickAction } from '@trackmind/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { KeyboardEvent, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { submitRaceDayQuickEntry } from '@/api/raceDayMutations';
import { Input } from '@/design/components/form-field';
import { QuickStatusButton } from './QuickStatusButton';
import { StickySaveBar } from './StickySaveBar';

export function useRaceDayQuickEntry(context: RaceDayQuickEntryContext) {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitRaceDayQuickEntry,
    onSuccess: (result) => {
      setFlash(result.message);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      window.setTimeout(() => setFlash(null), 3500);
    },
  });

  const submit = useCallback((
    action: RaceDayQuickAction,
    status: string,
    options?: { note?: string; optionPayload?: Record<string, unknown> },
  ) => {
    return mutation.mutateAsync({
      action,
      status,
      context,
      note: options?.note,
      optionPayload: options?.optionPayload,
    });
  }, [context, mutation]);

  return { submit, flash, isPending: mutation.isPending, error: mutation.error as Error | null };
}

export function QuickEntryPanel({
  action,
  context,
  onSuccess,
}: {
  action: RaceDayQuickAction;
  context: RaceDayQuickEntryContext;
  onSuccess?: () => void;
}): ReactElement {
  const definition = getRaceDayQuickAction(action);
  const { submit, isPending, error, flash } = useRaceDayQuickEntry(context);
  const [pendingOption, setPendingOption] = useState<QuickStatusOption | null>(null);
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLInputElement>(null);

  const needsHorse = definition.requiresHorse && !context.horseId;
  const needsNoteForPending = Boolean(pendingOption && !pendingOption.oneTap);

  useEffect(() => {
    if (pendingOption && needsNoteForPending) noteRef.current?.focus();
  }, [pendingOption, needsNoteForPending]);

  const runSubmit = async (option: QuickStatusOption) => {
    if (definition.requiresHorse && !context.horseId) return;
    if (!option.oneTap && definition.optionalNote && !note.trim() && action !== 'incident-report') {
      setPendingOption(option);
      return;
    }
    await submit(action, option.value, { note: note.trim() || undefined, optionPayload: option.payload });
    setPendingOption(null);
    setNote('');
    onSuccess?.();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && pendingOption) {
      event.preventDefault();
      void runSubmit(pendingOption);
    }
    if (event.key === 'Escape') {
      setPendingOption(null);
      setNote('');
    }
  };

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <p className="text-xs text-[var(--muted-foreground)]">{definition.description}</p>
      {needsHorse ? (
        <p className="rounded-md border border-[var(--warning-border,var(--border))] bg-[var(--muted)] px-3 py-2 text-sm">
          Select a horse above to continue.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={definition.label}>
        {definition.statusOptions.map((option) => (
          <QuickStatusButton
            key={option.value}
            label={option.label}
            shortLabel={option.shortLabel}
            tone={option.tone}
            selected={pendingOption?.value === option.value}
            disabled={isPending || needsHorse}
            onClick={() => {
              if (option.oneTap && !(action === 'steward-note' || action === 'approval-request')) {
                void runSubmit(option);
              } else {
                setPendingOption(option);
              }
            }}
          />
        ))}
      </div>
      {(definition.optionalNote || pendingOption) && !needsHorse ? (
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--muted-foreground)]">
            {pendingOption ? `Confirm: ${pendingOption.label}` : 'Optional note'}
          </span>
          <Input
            ref={noteRef}
            value={note}
            placeholder={definition.defaultNotePlaceholder}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && pendingOption) {
                event.preventDefault();
                void runSubmit(pendingOption);
              }
            }}
          />
        </label>
      ) : null}
      {flash ? <p role="status" aria-live="polite" className="text-sm text-[var(--status-nominal,#16a34a)]">{flash}</p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--status-critical)]">{error.message}</p> : null}
      <StickySaveBar
        visible={Boolean(pendingOption && (!pendingOption.oneTap || action === 'steward-note' || action === 'approval-request'))}
        saving={isPending}
        error={undefined}
        saveLabel={pendingOption ? `Save ${pendingOption.label}` : 'Save'}
        onCancel={() => { setPendingOption(null); setNote(''); }}
        onSave={() => pendingOption && void runSubmit(pendingOption)}
      />
    </div>
  );
}
