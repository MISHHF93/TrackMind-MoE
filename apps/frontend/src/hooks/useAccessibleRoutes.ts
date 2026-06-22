import { useMemo } from 'react';
import { accessibleRoutesForRole, homePathForAccessibleRole } from '@/domain/accessibleRoutes';
import type { RouteSupportMetadata } from '@/domain/support';
import { useModuleEnablement } from '@/hooks/useModuleEnablement';
import { useTenantSession } from '@/auth/TenantSessionProvider';

export function useAccessibleRoutes(routeList: readonly RouteSupportMetadata[]) {
  const { session } = useTenantSession();
  const { enabledModules, isLoading } = useModuleEnablement();

  const routes = useMemo(
    () => accessibleRoutesForRole(session.role, routeList, enabledModules, isLoading),
    [enabledModules, isLoading, routeList, session.role],
  );

  const homePath = useMemo(
    () => homePathForAccessibleRole(session.role, routeList, enabledModules, isLoading),
    [enabledModules, isLoading, routeList, session.role],
  );

  return { routes, homePath, modulesLoading: isLoading, enabledModules };
}
