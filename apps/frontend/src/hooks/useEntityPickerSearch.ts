import type { EntityPickerKind } from '@trackmind/shared';
import { getEntityPickerKindDefinition } from '@trackmind/shared';
import { useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchEntityPicker } from '@/api/entityPicker';

export function useEntityPickerSearch(
  kind: EntityPickerKind,
  query: string,
  enabled = true,
  limit?: number,
) {
  const definition = getEntityPickerKindDefinition(kind);
  const deferredQuery = useDeferredValue(query.trim());

  const searchQuery = useQuery({
    queryKey: ['entity-picker', kind, deferredQuery, limit ?? definition.browseLimit],
    queryFn: () => searchEntityPicker({
      kind,
      query: deferredQuery,
      limit: limit ?? definition.browseLimit,
    }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    results: searchQuery.data?.results ?? [],
    loading: searchQuery.isFetching,
    error: searchQuery.error instanceof Error ? searchQuery.error.message : undefined,
    permissionDenied: searchQuery.data?.permissionDenied === true,
  };
}
