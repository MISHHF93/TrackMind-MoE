import { useEffect, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isPathAccessibleForRole } from '@/domain/accessibleRoutes';
import { useAccessibleRoutes } from '@/hooks/useAccessibleRoutes';
import { routes } from '@/routes/routes';
import { useTenantSession } from '@/auth/TenantSessionProvider';

/** Keeps the active URL aligned with the current role and tenant module entitlements. */
export function RouteAccessSync(): ReactElement | null {
  const { session } = useTenantSession();
  const location = useLocation();
  const navigate = useNavigate();
  const { homePath, modulesLoading, enabledModules } = useAccessibleRoutes(routes);

  useEffect(() => {
    if (modulesLoading) return;
    if (isPathAccessibleForRole(location.pathname, session.role, routes, enabledModules, false)) return;
    if (location.pathname === homePath) return;
    navigate(homePath, { replace: true, state: { from: location.pathname } });
  }, [enabledModules, homePath, location.pathname, modulesLoading, navigate, session.role]);

  return null;
}
