import { createTrackMindTenantUxBoundaryMetadata, hasPermission, type Permission, type Role, type TrackMindTenantUxBoundaryMetadata } from '@trackmind/shared';
import { activeNavItem, canonicalPathForRoute, navItems, navSections, type NavDeepLink, type NavItem, type NavSection, type RouteBadgeSource, type RouteDataState, type RouteIconKey, type RouteSafetyPosture } from './navigation.js';

export interface TenantOption {
  id: string;
  name: string;
  timezone: string;
  status: TrackMindTenantUxBoundaryMetadata['configuration']['raceDayStatus'];
  saasBoundary: TrackMindTenantUxBoundaryMetadata;
}
export interface UserProfile { name: string; title: string; roles: Role[] }
export type ServiceState = 'online' | 'offline' | 'degraded';

export interface CommandPaletteItem { id: string; label: string; path: string; keywords: string[]; required?: Permission[]; iconKey: RouteIconKey; workspaceGroup: NavSection; badgeSource: RouteBadgeSource; breadcrumbLabel: string; dataState: RouteDataState; safetyPosture: RouteSafetyPosture }

export const tenantBoundaryMetadata = createTrackMindTenantUxBoundaryMetadata();

export const tenants: TenantOption[] = tenantBoundaryMetadata.map((boundary) => ({
  id: boundary.racetrackId,
  name: boundary.racetrackName,
  timezone: boundary.configuration.timezone,
  status: boundary.configuration.raceDayStatus,
  saasBoundary: boundary,
}));

export function selectTenant(tenantId: string, options: TenantOption[] = tenants): TenantOption {
  return options.find((tenant) => tenant.id === tenantId) ?? options[0];
}

export function breadcrumbForPath(path: string, items: NavItem[] = navItems): string[] {
  const match = activeNavItem(path, items);
  if (!match) return ['Nexus', 'Not Found'];
  const section = navSections.find((candidate) => candidate.id === match.section);
  const current = canonicalPathForRoute(path);
  const deepLink = match.deepLinks?.find((link) => current === link.path || current.startsWith(`${link.path}/`));
  return ['Nexus', section?.label ?? 'Operations', match.breadcrumbLabel, deepLink?.label].filter((crumb, index, crumbs): crumb is string => Boolean(crumb) && (index === 0 || crumb !== crumbs[index - 1]));
}

function paletteItemsForNavItem(item: NavItem): CommandPaletteItem[] {
  const base = {
    iconKey: item.iconKey,
    workspaceGroup: item.workspaceGroup,
    badgeSource: item.badgeSource,
    breadcrumbLabel: item.breadcrumbLabel,
    dataState: item.dataState,
    safetyPosture: item.safetyPosture,
  };
  const topLevel = { id: `go-${item.id}`, label: `Go to ${item.label}`, path: item.path, keywords: [item.id, item.label.toLowerCase(), item.path, item.iconKey, item.workspaceGroup, item.breadcrumbLabel.toLowerCase(), item.dataState.mode, item.safetyPosture.posture], required: item.required, ...base };
  const deepLinks = (item.deepLinks ?? []).map((link: NavDeepLink) => ({
    id: `go-${item.id}-${link.id}`,
    label: `Go to ${item.label}: ${link.label}`,
    path: link.path,
    keywords: [item.id, item.label.toLowerCase(), item.iconKey, item.workspaceGroup, item.breadcrumbLabel.toLowerCase(), link.id, link.label.toLowerCase(), link.path, item.dataState.mode, item.safetyPosture.posture, ...link.keywords.map((keyword) => keyword.toLowerCase())],
    required: item.required,
    ...base,
  }));
  return [topLevel, ...deepLinks];
}

export function commandPaletteItems(roles: Role[]): CommandPaletteItem[] {
  return navItems
    .filter((item) => !item.required?.length || roles.some((role) => item.required!.some((permission) => hasPermission(role, permission))))
    .flatMap((item) => paletteItemsForNavItem(item));
}

export function filterCommandPalette(query: string, roles: Role[]): CommandPaletteItem[] {
  const normalized = query.trim().toLowerCase();
  const items = commandPaletteItems(roles);
  if (!normalized) return items;
  return items.filter((item) => item.keywords.some((keyword) => keyword.includes(normalized)) || item.label.toLowerCase().includes(normalized));
}

export function serviceBanner(state: ServiceState, mockMode: boolean): { tone: 'ok' | 'warning' | 'critical'; message: string } {
  if (state === 'offline') return { tone: 'critical', message: 'Offline mode: live telemetry and approvals are unavailable. Safety-critical controls remain locked.' };
  if (state === 'degraded') return { tone: 'warning', message: 'Degraded service: some live feeds are delayed. Confirm conditions by radio before action.' };
  if (mockMode) return { tone: 'warning', message: 'Mock data warning: this environment is using placeholder operational data.' };
  return { tone: 'ok', message: 'All command-center services are online.' };
}
