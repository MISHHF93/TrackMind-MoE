import { routeApiPathGroups } from '@/api/paths';
import type { DomainRouteId, NavigationGroup } from '@/domain/support';
import { gatedRouteModules } from '@/routes/routeModules';
import { routes, type AppRoute } from '@/routes/routes';
import {
  apiEndpointContracts,
  assignableRoles,
  frontendRoutePermissionRegistry,
  roleCapabilityBindings,
  roles,
  validateRoleResonanceMatrix,
  viewerRolesForRoute,
} from '@trackmind/shared';

export const navigationGroups = [
  'Command',
  'Race Operations',
  'Safety & Facilities',
  'Governance',
  'Business Controls',
  'Data Governance',
  'Platform',
  'System Status',
] as const satisfies readonly NavigationGroup[];

export const workspacePanelRouteIds = [
  'dashboard',
  'admin',
  'raceDay',
  'surface',
  'equine',
  'stewarding',
  'approvals',
  'audit',
  'compliance',
  'security',
  'incidents',
  'emergency',
  'facilities',
  'workforce',
  'digitalTwin',
  'ticketing',
  'finance',
  'federation',
  'dataHub',
  'settings',
  'analytics',
  'fanExperience',
  'notifications',
] as const satisfies readonly DomainRouteId[];

export const sidebarIconKeys = [
  'command-center',
  'race-day',
  'horse',
  'steward',
  'surface',
  'approval',
  'incident',
  'emergency',
  'compliance',
  'security',
  'facility',
  'workforce',
  'twin',
  'ticket',
  'finance',
  'federation',
  'data-hub',
  'audit',
  'admin',
  'analytics',
  'fan',
  'notifications',
  'settings',
] as const;

export function routePathSegment(route: AppRoute): string {
  return route.path.replace(/^\//, '');
}

export function validateRouteInventory(source: {
  routerPaths: string[];
  panelRouteIds: readonly string[];
  sidebarIconKeys: readonly string[];
}): string[] {
  const errors: string[] = [];
  const routeIds = new Set<string>(routes.map((route) => route.id));
  const routePaths = new Set<string>(routes.map((route) => route.path));

  for (const route of routes) {
    const routeId = route.id;
    if (!route.label.trim()) errors.push(`route ${routeId} missing label`);
    if (!route.dataSource.trim()) errors.push(`route ${routeId} missing dataSource`);
    if (!route.backendPaths.length) errors.push(`route ${routeId} missing backendPaths`);
    if (!(navigationGroups as readonly string[]).includes(route.navigationGroup)) {
      errors.push(`route ${routeId} has unknown navigationGroup: ${route.navigationGroup}`);
    }
    if (!source.sidebarIconKeys.includes(route.iconKey)) {
      errors.push(`route ${routeId} iconKey not registered in sidebar: ${route.iconKey}`);
    }
    const apiPaths = routeApiPathGroups[route.id];
    if (!apiPaths?.length) errors.push(`route ${routeId} missing routeApiPathGroups entry`);
    if (!source.panelRouteIds.includes(route.id)) {
      errors.push(`route ${routeId} missing WorkspaceDomainPanels case`);
    }
    const segment = routePathSegment(route);
    if (!source.routerPaths.includes(segment)) {
      errors.push(`route ${routeId} path /${segment} missing from app router`);
    }
  }

  for (const routerPath of source.routerPaths) {
    const fullPath = `/${routerPath}`;
    if (!routePaths.has(fullPath)) {
      errors.push(`orphaned router path not in routes.ts: /${routerPath}`);
    }
  }

  for (const panelId of source.panelRouteIds) {
    if (!routeIds.has(panelId)) {
      errors.push(`orphaned WorkspaceDomainPanels case: ${panelId}`);
    }
  }

  if (routes.length !== source.panelRouteIds.length) {
    errors.push(`route count mismatch: routes.ts=${routes.length} panels=${source.panelRouteIds.length}`);
  }

  for (const [routeId, moduleKey] of Object.entries(gatedRouteModules)) {
    if (!routeIds.has(routeId)) {
      errors.push(`gated module references unknown route: ${routeId}`);
    }
    if (moduleKey !== routeId) {
      errors.push(`gated module key mismatch for ${routeId}: expected ${routeId}, got ${moduleKey}`);
    }
  }

  return errors;
}

/** Validates role resonance, route permissions, and API contract parity. */
export function validateRoleRouteResonance(): string[] {
  const errors: string[] = [...validateRoleResonanceMatrix()];

  for (const route of routes) {
    const registryPermission = frontendRoutePermissionRegistry[route.id as keyof typeof frontendRoutePermissionRegistry];
    if (registryPermission && registryPermission !== route.requiredPermission) {
      errors.push(`route ${route.id}: requiredPermission mismatch (routes.ts=${route.requiredPermission}, registry=${registryPermission})`);
    }
    const viewers = viewerRolesForRoute(route.id);
    if (viewers.length === 0 && route.id !== 'settings') {
      errors.push(`route ${route.id}: no role has viewer access`);
    }
  }

  for (const contract of apiEndpointContracts) {
    if (!contract.requiredPermission) {
      errors.push(`API ${contract.method} ${contract.path}: missing requiredPermission`);
    }
    if (contract.roles !== 'authenticated' && contract.roles.length === 0) {
      errors.push(`API ${contract.method} ${contract.path}: empty role allowlist`);
    }
  }

  for (const role of assignableRoles) {
    const binding = roleCapabilityBindings[role];
    if (!binding.viewerRoutes.includes(binding.homeRouteId)) {
      errors.push(`${role}: home route ${binding.homeRouteId} not in viewerRoutes`);
    }
  }

  if (assignableRoles.length !== 20) {
    errors.push(`expected 20 assignable roles, found ${assignableRoles.length}`);
  }
  if (roles.length !== 21) {
    errors.push(`expected 21 total roles, found ${roles.length}`);
  }

  return errors;
}
