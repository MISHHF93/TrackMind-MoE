import { useQuery } from '@tanstack/react-query';
import type { ModuleEnablementDto } from '@trackmind/shared';
import { getJson } from '@/api/client';
import { apiPaths } from '@/api/paths';
import { useTenantSession } from '@/auth/TenantSessionProvider';

function toModuleMap(items: ModuleEnablementDto[]): ReadonlyMap<string, boolean> {
  return new Map(items.map((item) => [item.moduleKey, item.enabled]));
}

export function moduleEnablementQueryKey(sessionKey: string): readonly [string, string] {
  return ['module-enablement', sessionKey];
}

export function useModuleEnablement() {
  const { session } = useTenantSession();

  const query = useQuery({
    queryKey: moduleEnablementQueryKey(session.sessionKey),
    queryFn: async () => {
      const result = await getJson<ModuleEnablementDto[]>(apiPaths.admin.modules);
      if (result.status !== 'ready' || !Array.isArray(result.data)) {
        return new Map<string, boolean>();
      }
      return toModuleMap(result.data);
    },
    staleTime: 60_000,
    retry: 1,
  });

  return {
    ...query,
    enabledModules: query.data,
  };
}
