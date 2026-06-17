import { useEffect, useState } from 'react';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';

export interface GlobalSearchResult {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  path: string;
  score: number;
}

export function useGlobalSearch(query: string, enabled: boolean): { results: GlobalSearchResult[]; loading: boolean } {
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
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
      void getJson<{ results?: GlobalSearchResult[] }>(`${apiPaths.search.global}?q=${encodeURIComponent(trimmed)}`)
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
