import { useMemo } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import {
  functionalCategoryForRole,
  homePathForRole,
  homeRouteForRole,
  navigationGroupOrderForRole,
  notificationChannelsForRole,
  quickActionsForRole,
  visibleKpiDomainsForRole,
  type DomainRouteId,
} from '@trackmind/shared';

export function useRoleWorkspace() {
  const { session } = useTenantSession();
  const role = session.role;

  return useMemo(() => ({
    role,
    homeRouteId: homeRouteForRole(role),
    homePath: homePathForRole(role),
    category: functionalCategoryForRole(role),
    navigationGroupOrder: navigationGroupOrderForRole(role),
    kpiDomains: visibleKpiDomainsForRole(role),
    quickActions: quickActionsForRole(role),
    notificationChannels: notificationChannelsForRole(role),
    canViewRoute: (routeId: DomainRouteId) => visibleKpiDomainsForRole(role).length >= 0, // re-exported via support
  }), [role]);
}
