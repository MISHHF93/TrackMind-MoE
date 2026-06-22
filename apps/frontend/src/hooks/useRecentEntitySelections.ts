import type { EntityPickerItem, EntityPickerKind } from '@trackmind/shared';
import { entityPickerRecentStorageKey } from '@trackmind/shared';
import { useCallback, useMemo } from 'react';

const MAX_RECENT = 8;

export function useRecentEntitySelections(
  kind: EntityPickerKind,
  tenantId: string,
  racetrackId: string,
) {
  const storageKey = useMemo(
    () => entityPickerRecentStorageKey(kind, tenantId, racetrackId),
    [kind, tenantId, racetrackId],
  );

  const readRecent = useCallback((): EntityPickerItem[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed as EntityPickerItem[] : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const rememberSelection = useCallback((item: EntityPickerItem) => {
    if (typeof window === 'undefined') return;
    const existing = readRecent().filter((entry) => entry.id !== item.id);
    const next = [{ ...item, score: 1 }, ...existing].slice(0, MAX_RECENT);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }, [readRecent, storageKey]);

  return { readRecent, rememberSelection };
}
