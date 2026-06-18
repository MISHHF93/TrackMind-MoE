import { useEffect, useState } from 'react';
import type { GlobalSearchResponseDto, GlobalSearchResultDto } from '@trackmind/shared';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';

export type GlobalSearchResult = GlobalSearchResultDto;

export function useGlobalSearch(query: string, enabled: boolean): { results: GlobalSearchResultDto[]; loading: boolean } {
  const [results, setResults] = useState<GlobalSearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      setLoading(true);
      void getJson<GlobalSearchResponseDto>(`${apiPaths.search.global}?q=${encodeURIComponent(trimmed)}`)
        .then((response) => {
          setResults(response.status === 'ready' ? response.data?.results ?? [] : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query, enabled]);

  return { results, loading };
}
