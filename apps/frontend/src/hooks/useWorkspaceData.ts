import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson } from '@/api/client';
import { routeApiPathGroups } from '@/api/paths';
import type { DomainRouteId } from '@/domain/support';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { isRecord } from '@/lib/utils';

export interface WorkspaceDataResult {
  path: string;
  status: 'ready' | 'empty' | 'error';
  data?: unknown;
  message?: string;
}

export function workspaceQueryKey(routeId: DomainRouteId, sessionKey: string): readonly [string, DomainRouteId, string] {
  return ['workspace', routeId, sessionKey];
}

async function fetchWorkspacePaths(paths: readonly string[]): Promise<WorkspaceDataResult[]> {
  const results = await Promise.all(
    paths.map(async (path) => {
      const result = await getJson<unknown>(path);
      return {
        path,
        status: result.status === 'ready' ? 'ready' : result.status === 'empty' ? 'empty' : 'error',
        data: result.data,
        message: result.message,
      } satisfies WorkspaceDataResult;
    }),
  );
  return results;
}

export function useWorkspaceData(routeId: DomainRouteId) {
  const { session } = useTenantSession();
  const paths = routeApiPathGroups[routeId];

  return useQuery({
    queryKey: workspaceQueryKey(routeId, session.sessionKey),
    queryFn: () => fetchWorkspacePaths(paths),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useWorkspacePrimary<T>(routeId: DomainRouteId, pathIndex = 0) {
  const query = useWorkspaceData(routeId);
  const primary = query.data?.[pathIndex];
  return { ...query, primary, data: primary?.data as T | undefined };
}

export function useInvalidateWorkspace() {
  const queryClient = useQueryClient();
  const { session } = useTenantSession();
  return (routeId: DomainRouteId) => {
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKey(routeId, session.sessionKey) });
  };
}

export function extractArray<T>(data: unknown, key?: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data) && key && Array.isArray(data[key])) return data[key] as T[];
  if (isRecord(data) && Array.isArray(data.items)) return data.items as T[];
  return [];
}

export function stringField(data: unknown, key: string, fallback = '—'): string {
  if (!isRecord(data)) return fallback;
  const value = data[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}
