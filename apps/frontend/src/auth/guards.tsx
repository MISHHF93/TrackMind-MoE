import type { ReactElement, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasPermission, type Permission } from '@trackmind/shared';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { canAccessRoute } from '@/domain/accessibleRoutes';
import { useAccessibleRoutes } from '@/hooks/useAccessibleRoutes';
import { moduleKeyForRoute, routes } from '@/routes/routes';
import type { RouteSupportMetadata } from '@/domain/support';

export function RequirePermission({ permission, children }: { permission: Permission | 'read:any'; children: ReactNode }): ReactElement {
  const { session } = useTenantSession();
  const location = useLocation();
  const { homePath } = useAccessibleRoutes(routes);

  if (!hasPermission(session.role, permission)) {
    return <Navigate to={homePath} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequireRouteAccess({ route, children }: { route: RouteSupportMetadata; children: ReactNode }): ReactElement {
  const { session } = useTenantSession();
  const location = useLocation();
  const { homePath, enabledModules, modulesLoading } = useAccessibleRoutes(routes);
  const moduleKey = moduleKeyForRoute(route.id);

  if (!canAccessRoute(route, session.role, enabledModules, moduleKey, modulesLoading)) {
    const destination = location.pathname === homePath ? '/account' : homePath;
    return <Navigate to={destination} replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
