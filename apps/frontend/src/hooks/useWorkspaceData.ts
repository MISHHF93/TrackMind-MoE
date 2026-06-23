import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getJson } from '@/api/client';
import { resolveRouteApiPaths } from '@/api/paths';
import type { DomainRouteId } from '@/domain/support';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { isRecord } from '@/lib/utils';

export interface WorkspaceDataResult {
  path: string;
  status: 'ready' | 'empty' | 'error';
  data?: unknown;
  message?: string;
  emptyReason?: string;
}

const workspacePathStaleTimeMs = 30_000;

export function workspaceQueryKey(routeId: DomainRouteId, sessionKey: string): readonly [string, DomainRouteId, string] {
  return ['workspace', routeId, sessionKey];
}

export function workspacePathQueryKey(path: string, sessionKey: string): readonly [string, string, string] {
  return ['workspace-path', path, sessionKey];
}

function toWorkspaceDataResult(path: string, result: Awaited<ReturnType<typeof getJson>>): WorkspaceDataResult {
  return {
    path,
    status: result.status === 'ready' ? 'ready' : result.status === 'empty' ? 'empty' : 'error',
    data: result.data,
    message: result.message,
    emptyReason: result.emptyReason,
  };
}

export async function loadWorkspacePath(path: string): Promise<WorkspaceDataResult> {
  const result = await getJson<unknown>(path);
  return toWorkspaceDataResult(path, result);
}

async function fetchWorkspacePaths(
  queryClient: QueryClient,
  paths: readonly string[],
  sessionKey: string,
): Promise<WorkspaceDataResult[]> {
  const uniquePaths = [...new Set(paths)];
  const loaded = await Promise.all(
    uniquePaths.map((path) =>
      queryClient.fetchQuery({
        queryKey: workspacePathQueryKey(path, sessionKey),
        queryFn: () => loadWorkspacePath(path),
        staleTime: workspacePathStaleTimeMs,
      }),
    ),
  );
  const byPath = new Map(loaded.map((result) => [result.path, result]));
  return paths.map((path) => byPath.get(path) ?? { path, status: 'error', message: 'Workspace path was not loaded.' });
}

export function useWorkspaceData(routeId: DomainRouteId, pathParams?: Record<string, string>) {
  const { session, authReady } = useTenantSession();
  const queryClient = useQueryClient();
  const paths = resolveRouteApiPaths(routeId, pathParams);

  return useQuery({
    queryKey: [...workspaceQueryKey(routeId, session.sessionKey), pathParams ?? {}],
    queryFn: () => fetchWorkspacePaths(queryClient, paths, session.sessionKey),
    staleTime: workspacePathStaleTimeMs,
    retry: 1,
    enabled: authReady
      && (routeId !== 'cctvCameraDetail' || Boolean(pathParams?.cameraId))
      && (routeId !== 'iotDeviceDetail' || Boolean(pathParams?.deviceId)),
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
