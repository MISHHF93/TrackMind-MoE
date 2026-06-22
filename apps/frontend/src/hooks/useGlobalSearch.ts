import { useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GlobalSearchResponseDto, GlobalSearchResultDto } from '@trackmind/shared';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';

export type GlobalSearchResult = GlobalSearchResultDto;

export function useGlobalSearch(query: string, enabled: boolean): { results: GlobalSearchResultDto[]; loading: boolean } {
  const deferredQuery = useDeferredValue(query.trim());
  const shouldSearch = enabled && deferredQuery.length >= 2;

  const searchQuery = useQuery({
    queryKey: ['global-search', deferredQuery],
    queryFn: async () => {
      const response = await getJson<GlobalSearchResponseDto>(
        `${apiPaths.search.global}?q=${encodeURIComponent(deferredQuery)}`,
      );
      return response.status === 'ready' ? response.data?.results ?? [] : [];
    },
    enabled: shouldSearch,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    results: shouldSearch ? searchQuery.data ?? [] : [],
    loading: shouldSearch && searchQuery.isFetching,
  };
}
