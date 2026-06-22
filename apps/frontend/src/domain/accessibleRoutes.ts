import {
  canRoleAccessRoute,
  homeRouteForRole,
  roleCapabilityBindings,
  type Role,
} from '@trackmind/shared';
import { demoAccessEnabled } from '@/auth/entraAuth';
import type { DomainRouteId, RouteSupportMetadata } from '@/domain/support';
import { routeModuleKey } from '@/routes/routeModules';

export function isRouteModuleEnabled(
  routeId: DomainRouteId,
  enabledModules: ReadonlyMap<string, boolean> | undefined,
  moduleKey?: string,
  modulesLoading = false,
): boolean {
  if (!moduleKey) return true;
  if (demoAccessEnabled()) return true;
  if (modulesLoading) return false;
  if (!enabledModules || enabledModules.size === 0) return true;
  if (!enabledModules.has(moduleKey)) return true;
  return enabledModules.get(moduleKey) === true;
}

export function canAccessRoute(
  route: RouteSupportMetadata,
  role: Role,
  enabledModules?: ReadonlyMap<string, boolean>,
  moduleKey?: string,
  modulesLoading = false,
): boolean {
  return canRoleAccessRoute(role, route.id)
    && isRouteModuleEnabled(route.id, enabledModules, moduleKey, modulesLoading);
}

export function accessibleRoutesForRole(
  role: Role,
  routeList: readonly RouteSupportMetadata[],
  enabledModules?: ReadonlyMap<string, boolean>,
  modulesLoading = false,
): RouteSupportMetadata[] {
  return routeList.filter((route) =>
    canAccessRoute(route, role, enabledModules, routeModuleKey(route.id), modulesLoading),
  );
}

export function homePathForAccessibleRole(
  role: Role,
  routeList: readonly RouteSupportMetadata[],
  enabledModules?: ReadonlyMap<string, boolean>,
  modulesLoading = false,
): string {
  const accessible = accessibleRoutesForRole(role, routeList, enabledModules, modulesLoading);
  const accessibleIds = new Set(accessible.map((route) => route.id));
  const preferredId = homeRouteForRole(role);
  if (accessibleIds.has(preferredId)) {
    return accessible.find((route) => route.id === preferredId)?.path ?? '/dashboard';
  }
  const viewerOrder = roleCapabilityBindings[role]?.viewerRoutes ?? [];
  for (const routeId of viewerOrder) {
    if (!accessibleIds.has(routeId)) continue;
    const route = accessible.find((entry) => entry.id === routeId);
    if (route) return route.path;
  }
  return accessible[0]?.path ?? '/dashboard';
}

export function isPathAccessibleForRole(
  pathname: string,
  role: Role,
  routeList: readonly RouteSupportMetadata[],
  enabledModules?: ReadonlyMap<string, boolean>,
  modulesLoading = false,
): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/dashboard';
  const route = routeList.find((entry) => entry.path === normalized);
  if (!route) return true;
  return canAccessRoute(route, role, enabledModules, routeModuleKey(route.id), modulesLoading);
}
