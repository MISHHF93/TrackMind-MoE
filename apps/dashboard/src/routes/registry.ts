import { hasPermission, type Permission, type Role } from '@trackmind/shared';
import { domainScreens, type DomainScreenDefinition } from '../shell/domains.js';
import { canonicalPathForRoute, canonicalRouteMap, legacyRouteAliases, navItems, navSections, type NavDeepLink, type NavSection, type RouteBadgeSource, type RouteDataState, type RouteIconKey, type RouteSafetyPosture } from '../shell/navigation.js';

export type CanonicalWorkspaceGroup = 'operations' | 'equine' | 'safety' | 'facilities' | 'governance' | 'intelligence' | 'executive' | 'platform-admin';
export type RouteGuardKind = 'authenticated' | 'permission' | 'tenant' | 'feature-flag';
export type RouteRenderIntent = 'workspace' | 'not-found' | 'permission-denied' | 'redirect' | 'quarantined';

export interface BackendDependency {
  id: string;
  kind: 'read' | 'approval' | 'event-stream' | 'audit' | 'mock-fixture';
  path: string;
  required: boolean;
  staleAfterMs?: number;
}

export interface CanonicalRoute {
  id: DomainScreenDefinition['id'];
  path: string;
  title: string;
  icon: RouteIconKey;
  permissions: Permission[];
  roles: Role[];
  breadcrumbs: string[];
  featureFlag: string;
  tenantAware: true;
  racetrackAware: true;
  workspaceGroup: CanonicalWorkspaceGroup;
  workspaceGroupLabel: string;
  aliases: string[];
  deepLinks: NavDeepLink[];
  backendDependencies: BackendDependency[];
  eventStreams: string[];
  badgeSource: RouteBadgeSource;
  dataState: RouteDataState;
  safetyPosture: RouteSafetyPosture;
  approvalActions: DomainScreenDefinition['approvalRequiredActions'];
  personas: DomainScreenDefinition['personas'];
  component: string;
  layout: 'appshell-workspace';
  guards: RouteGuardKind[];
  notFoundBehavior: 'render-shell-not-found';
  permissionDeniedBehavior: 'render-shell-permission-denied';
  tenantValidation: 'tenant-and-racetrack-required';
  source: 'canonical-route-registry';
}

export interface RouteResolution {
  intent: RouteRenderIntent;
  route?: CanonicalRoute;
  canonicalPath: string;
  redirectTo?: string;
  reason?: string;
}

const workspaceGroupOverrides: Partial<Record<CanonicalRoute['id'], CanonicalWorkspaceGroup>> = {
  'digital-twin': 'intelligence',
  'ai-governance': 'governance',
};

const routeComponentById: Record<CanonicalRoute['id'], string> = {
  operations: 'OperationsCommandWorkspace',
  'race-office': 'RaceOfficeWorkspace',
  'track-configuration': 'TrackConfigurationWorkspace',
  'starting-gate': 'StartingGateWorkspace',
  surface: 'SurfaceIntelligenceWorkspace',
  equine: 'EquineIntelligenceWorkspace',
  barns: 'BarnOperationsWorkspace',
  stewards: 'StewardCenterWorkspace',
  safety: 'SafetyCenterWorkspace',
  security: 'SecurityOperationsWorkspace',
  emergency: 'EmergencyOperationsWorkspace',
  assets: 'AssetRegistryWorkspace',
  'digital-twin': 'DigitalTwinWorkspace',
  facilities: 'FacilitiesWorkspace',
  workforce: 'WorkforceWorkspace',
  approvals: 'ApprovalsWorkspace',
  audit: 'AuditLedgerWorkspace',
  compliance: 'ComplianceWorkspace',
  'ai-governance': 'AIGovernanceWorkspace',
  'api-hub': 'ApiHubWorkspace',
  executive: 'ExecutiveCenterWorkspace',
  'platform-health': 'PlatformHealthWorkspace',
};

const navItemById = new Map(navItems.map((item) => [item.id, item]));
const routeMapById = new Map(canonicalRouteMap.map((entry) => [entry.id, entry]));
const sectionLabelById = new Map(navSections.map((section) => [section.id, section.label]));

function groupForRoute(screen: DomainScreenDefinition): CanonicalWorkspaceGroup {
  return workspaceGroupOverrides[screen.id] ?? screen.workspace.group;
}

function backendDependenciesFor(screen: DomainScreenDefinition): BackendDependency[] {
  const liveApi = screen.liveApi ? [{ id: `${screen.id}:live-api`, kind: 'read' as const, path: screen.liveApi, required: !screen.mockDataState.allowed, staleAfterMs: 5 * 60 * 1000 }] : [];
  const streams = screen.eventStreams.map((stream) => ({ id: `${screen.id}:stream:${stream}`, kind: 'event-stream' as const, path: stream, required: false, staleAfterMs: 5 * 60 * 1000 }));
  const approvals = screen.approvalRequiredActions.map((action) => ({ id: action.id, kind: 'approval' as const, path: action.approvalApi, required: true }));
  const audit = screen.universalSchemaCoverage.includes('audit') ? [{ id: `${screen.id}:audit`, kind: 'audit' as const, path: '/audit/events', required: false }] : [];
  const mock = screen.mockDataState.allowed ? [{ id: `${screen.id}:mock-fixture`, kind: 'mock-fixture' as const, path: `fixtures://${screen.id}`, required: false }] : [];
  return [...liveApi, ...streams, ...approvals, ...audit, ...mock];
}

function routeForScreen(screen: DomainScreenDefinition): CanonicalRoute {
  const navItem = navItemById.get(screen.id);
  const routeMap = routeMapById.get(screen.id);
  if (!navItem || !routeMap) throw new Error(`Missing canonical route inputs for ${screen.id}`);
  const workspaceGroup = groupForRoute(screen);
  const groupLabel = sectionLabelById.get(workspaceGroup as NavSection) ?? workspaceGroup;
  return {
    id: screen.id,
    path: screen.route,
    title: screen.title,
    icon: navItem.iconKey,
    permissions: screen.requiredPermissions,
    roles: screen.roleVisibility.roles,
    breadcrumbs: ['Nexus', groupLabel, screen.breadcrumbLabel],
    featureFlag: `trackmind.workspace.${screen.id}`,
    tenantAware: true,
    racetrackAware: true,
    workspaceGroup,
    workspaceGroupLabel: groupLabel,
    aliases: routeMap.aliases,
    deepLinks: routeMap.deepLinks,
    backendDependencies: backendDependenciesFor(screen),
    eventStreams: screen.eventStreams,
    badgeSource: navItem.badgeSource,
    dataState: screen.dataState,
    safetyPosture: screen.safetyPosture,
    approvalActions: screen.approvalRequiredActions,
    personas: screen.personas,
    component: routeComponentById[screen.id],
    layout: 'appshell-workspace',
    guards: screen.requiredPermissions.length ? ['authenticated', 'permission', 'tenant'] : ['authenticated', 'tenant'],
    notFoundBehavior: 'render-shell-not-found',
    permissionDeniedBehavior: 'render-shell-permission-denied',
    tenantValidation: 'tenant-and-racetrack-required',
    source: 'canonical-route-registry',
  };
}

export const canonicalRoutes: CanonicalRoute[] = domainScreens.map(routeForScreen);
export const canonicalRouteById = Object.fromEntries(canonicalRoutes.map((route) => [route.id, route])) as Record<CanonicalRoute['id'], CanonicalRoute>;
export const canonicalWorkspaceGroups = ['operations', 'equine', 'safety', 'facilities', 'governance', 'intelligence', 'executive', 'platform-admin'] as const satisfies readonly CanonicalWorkspaceGroup[];

export function canAccessCanonicalRoute(route: CanonicalRoute, roles: Role[]) {
  return route.permissions.length === 0 || roles.some((role) => route.permissions.some((permission) => hasPermission(role, permission)));
}

export function visibleCanonicalRoutes(roles: Role[]) {
  return canonicalRoutes.filter((route) => canAccessCanonicalRoute(route, roles));
}

export function canonicalRouteForPath(path: string) {
  const canonicalPath = canonicalPathForRoute(path);
  return canonicalRoutes.find((route) => canonicalPath === route.path || canonicalPath.startsWith(`${route.path}/`));
}

export function resolveCanonicalRoute(path: string, roles: Role[]): RouteResolution {
  const alias = legacyRouteAliases.find((entry) => path === entry.from || path.startsWith(`${entry.from}/`));
  if (alias?.status === 'deprecated') {
    return { intent: 'quarantined', canonicalPath: canonicalPathForRoute(path), reason: alias.reason };
  }
  if (alias?.status === 'redirect') {
    return { intent: 'redirect', canonicalPath: canonicalPathForRoute(path), redirectTo: canonicalPathForRoute(path), reason: alias.reason };
  }
  const canonicalPath = canonicalPathForRoute(path);
  const route = canonicalRouteForPath(canonicalPath);
  if (!route) return { intent: 'not-found', canonicalPath };
  if (!canAccessCanonicalRoute(route, roles)) return { intent: 'permission-denied', route, canonicalPath, reason: route.permissionDeniedBehavior };
  return { intent: 'workspace', route, canonicalPath };
}

export function canonicalBreadcrumbsForPath(path: string) {
  const route = canonicalRouteForPath(path);
  if (!route) return ['Nexus', 'Not Found'];
  const canonicalPath = canonicalPathForRoute(path);
  const deepLink = route.deepLinks.find((link) => canonicalPath === link.path || canonicalPath.startsWith(`${link.path}/`));
  return [...route.breadcrumbs, deepLink?.label].filter((crumb, index, crumbs): crumb is string => Boolean(crumb) && (index === 0 || crumb !== crumbs[index - 1]));
}

export function canonicalNavigationGroups(roles: Role[]) {
  const visible = visibleCanonicalRoutes(roles);
  return canonicalWorkspaceGroups
    .map((group) => ({ group, label: sectionLabelById.get(group as NavSection) ?? group, routes: visible.filter((route) => route.workspaceGroup === group) }))
    .filter((group) => group.routes.length > 0);
}

export function canonicalCommandPaletteItems(roles: Role[]) {
  return visibleCanonicalRoutes(roles).flatMap((route) => {
    const base = {
      required: route.permissions,
      iconKey: route.icon,
      workspaceGroup: route.workspaceGroup,
      badgeSource: route.badgeSource,
      breadcrumbLabel: route.breadcrumbs.at(-1) ?? route.title,
      dataState: route.dataState,
      safetyPosture: route.safetyPosture,
    };
    const topLevel = {
      id: `go-${route.id}`,
      label: `Go to ${route.title}`,
      path: route.path,
      keywords: [route.id, route.title.toLowerCase(), route.path, route.icon, route.workspaceGroup, route.featureFlag, ...route.eventStreams],
      ...base,
    };
    const deepLinks = route.deepLinks.map((link) => ({
      id: `go-${route.id}-${link.id}`,
      label: `Go to ${route.title}: ${link.label}`,
      path: link.path,
      keywords: [route.id, route.title.toLowerCase(), link.id, link.label.toLowerCase(), link.path, ...link.keywords.map((keyword) => keyword.toLowerCase())],
      ...base,
    }));
    return [topLevel, ...deepLinks];
  });
}

export function auditCanonicalRouteRegistry() {
  const ids = new Set(canonicalRoutes.map((route) => route.id));
  const paths = new Set(canonicalRoutes.map((route) => route.path));
  return {
    routeCount: canonicalRoutes.length,
    duplicateIds: canonicalRoutes.length - ids.size,
    duplicatePaths: canonicalRoutes.length - paths.size,
    missingBackendMetadata: canonicalRoutes.filter((route) => route.backendDependencies.length === 0).map((route) => route.id),
    nonAppShellRoutes: canonicalRoutes.filter((route) => route.layout !== 'appshell-workspace').map((route) => route.id),
    source: 'canonical-route-registry',
  };
}
