import type { RaceDayQuickAction, RaceDayQuickEntryContext } from '@trackmind/shared';
import { raceDayQuickActionList } from '@trackmind/shared';
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionPanel } from '@/design/components/section-panel';
import { cn } from '@/lib/utils';
import { QuickActionChip } from './QuickStatusButton';
import { QuickEntryPanel } from './useRaceDayQuickEntry';

export interface RaceDayHorseOption {
  horseId: string;
  horseName: string;
  raceId: string;
  raceCardId?: string;
  entryId?: string;
  saddleCloth?: number;
  postPosition?: number;
  status?: string;
}

export function RaceDayQuickEntryConsole({
  horses,
  defaultRaceId,
  className,
}: {
  horses: RaceDayHorseOption[];
  defaultRaceId: string;
  className?: string;
}): ReactElement {
  const [activeAction, setActiveAction] = useState<RaceDayQuickAction>('paddock-check-in');
  const [selectedHorseId, setSelectedHorseId] = useState<string | undefined>(horses[0]?.horseId);
  const [filter, setFilter] = useState('');
  const [horseFocusIndex, setHorseFocusIndex] = useState(0);

  const selectedHorse = useMemo(
    () => horses.find((horse) => horse.horseId === selectedHorseId) ?? horses[0],
    [horses, selectedHorseId],
  );

  const context: RaceDayQuickEntryContext = useMemo(() => ({
    horseId: selectedHorse?.horseId,
    horseName: selectedHorse?.horseName,
    raceId: selectedHorse?.raceId ?? defaultRaceId,
    raceCardId: selectedHorse?.raceCardId,
    entryId: selectedHorse?.entryId,
    saddleCloth: selectedHorse?.saddleCloth,
    postPosition: selectedHorse?.postPosition,
  }), [selectedHorse, defaultRaceId]);

  const filteredHorses = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return horses;
    return horses.filter((horse) =>
      horse.horseName.toLowerCase().includes(query)
      || horse.horseId.toLowerCase().includes(query)
      || String(horse.saddleCloth ?? '').includes(query),
    );
  }, [horses, filter]);

  const cycleAction = useCallback((direction: 1 | -1) => {
    const index = raceDayQuickActionList.findIndex((item) => item.action === activeAction);
    const next = raceDayQuickActionList[(index + direction + raceDayQuickActionList.length) % raceDayQuickActionList.length];
    setActiveAction(next.action);
  }, [activeAction]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 9) {
        const match = raceDayQuickActionList.find((item) => item.keyboardShortcut === event.key);
        if (match) {
          event.preventDefault();
          setActiveAction(match.action);
        }
      }
      if (event.key === '[') cycleAction(-1);
      if (event.key === ']') cycleAction(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleAction]);

  const activeDefinition = raceDayQuickActionList.find((item) => item.action === activeAction)!;

  const onHorseListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (filteredHorses.length === 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(horseFocusIndex + 1, filteredHorses.length - 1);
      setHorseFocusIndex(next);
      setSelectedHorseId(filteredHorses[next]?.horseId);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(horseFocusIndex - 1, 0);
      setHorseFocusIndex(next);
      setSelectedHorseId(filteredHorses[next]?.horseId);
    }
  };

  useEffect(() => {
    setHorseFocusIndex(0);
  }, [filter]);

  return (
    <SectionPanel
      title="Race-day quick entry"
      description="Fast operational updates — tap a horse, pick an action, tap a status. Keyboard: 1–9 actions, Enter to save."
      className={className}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find horse (#, name, ID)…"
            className="min-h-11 w-full max-w-xs touch-manipulation rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            aria-label="Filter horses"
          />
          {selectedHorse ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Selected: <span className="font-medium text-[var(--foreground)]">{selectedHorse.horseName}</span>
              {selectedHorse.saddleCloth != null ? ` · #${selectedHorse.saddleCloth}` : ''}
              {selectedHorse.status ? ` · ${selectedHorse.status}` : ''}
            </p>
          ) : null}
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="listbox"
          aria-label="Horses on card"
          aria-activedescendant={filteredHorses[horseFocusIndex] ? `horse-option-${filteredHorses[horseFocusIndex].horseId}` : undefined}
          tabIndex={0}
          onKeyDown={onHorseListKeyDown}
        >
          {filteredHorses.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No horses on card — readiness and gate actions still available.</p>
          ) : (
            filteredHorses.map((horse, index) => (
              <button
                key={`${horse.raceId}-${horse.horseId}`}
                id={`horse-option-${horse.horseId}`}
                type="button"
                role="option"
                aria-selected={selectedHorse?.horseId === horse.horseId}
                onClick={() => {
                  setSelectedHorseId(horse.horseId);
                  setHorseFocusIndex(index);
                }}
                className={cn(
                  'flex min-h-14 min-w-[5.5rem] shrink-0 touch-manipulation flex-col items-center justify-center rounded-lg border px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                  selectedHorse?.horseId === horse.horseId
                    ? 'border-[var(--brand-maroon)] bg-[color-mix(in_srgb,var(--brand-maroon)_12%,var(--card))] ring-1 ring-[var(--brand-maroon)]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]',
                )}
              >
                <span className="text-lg font-semibold leading-none">
                  {horse.saddleCloth != null ? `#${horse.saddleCloth}` : '—'}
                </span>
                <span className="mt-1 max-w-[6rem] truncate text-xs text-[var(--muted-foreground)]">
                  {horse.horseName}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {raceDayQuickActionList.map((item) => (
            <QuickActionChip
              key={item.action}
              label={item.shortLabel}
              shortcut={item.keyboardShortcut}
              active={activeAction === item.action}
              onClick={() => setActiveAction(item.action)}
            />
          ))}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="mb-3 text-sm font-semibold">{activeDefinition.label}</h3>
          <QuickEntryPanel action={activeAction} context={context} />
        </div>
      </div>
    </SectionPanel>
  );
}
