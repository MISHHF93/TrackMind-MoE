import { hasPermission, roles as nexusRoles, type NexusUniversalSchemaCoverageId, type NexusUpgradeStatus, type Permission, type Role, type TrackMindOSComponentId } from '@trackmind/shared';

export type NavSection = 'operations' | 'equine' | 'safety' | 'facilities' | 'governance' | 'intelligence' | 'executive' | 'platform-admin';
export type RouteIconKey = string;
export type RouteDataStateKind = 'mock-live-adapter' | 'live-only';
export type RouteSafetyPostureKind = 'read-only' | 'approval-gated' | 'safety-critical-approval-gated';
export interface RouteRoleVisibility { requiredPermissions: Permission[]; permissions: Permission[]; roles: Role[]; policy: 'authenticated' | 'permission-gated'; personas?: string[]; rationale?: string }
export interface RouteBadgeSource { static: Array<'readiness' | 'data-state'>; dynamic: string[] }
export interface RouteDataState { mode: RouteDataStateKind; eventReady: boolean; mockAllowed: boolean; liveRequired: boolean; safeForDecisioning: false; label: string }
export interface RouteSafetyPosture { posture: RouteSafetyPostureKind; safetyCritical: boolean; protectedControlsLocked: true; autonomousExecutionAllowed: false; label: string }
export interface RouteMetadata {
  osComponentIds: TrackMindOSComponentId[];
  universalSchemaCoverage: NexusUniversalSchemaCoverageId[];
  readinessStatus: NexusUpgradeStatus;
  iconKey: RouteIconKey;
  roleVisibility: RouteRoleVisibility;
  requiredPermissions: Permission[];
  workspaceGroup: NavSection;
  badgeSource: RouteBadgeSource;
  breadcrumbLabel: string;
  dataState: RouteDataState;
  safetyPosture: RouteSafetyPosture;
}
export type NavBadgeTone = 'info' | 'success' | 'warning' | 'critical';
export interface NavBadge { id: string; label: string; value?: string | number; tone: NavBadgeTone; ariaLabel?: string }
export type NavBadgeMap = Partial<Record<string, NavBadge[]>>;
export interface NavDeepLink { id: string; label: string; path: string; keywords: string[] }
export interface NavItem extends RouteMetadata { id:string; label:string; path:string; required?: Permission[]; eventReady:boolean; mockAllowed:boolean; section: NavSection; deepLinks?: NavDeepLink[] }
export interface CanonicalRouteEntry { id: string; label: string; path: string; section: NavSection; breadcrumbLabel: string; aliases: string[]; deepLinks: NavDeepLink[]; requiredPermissions: Permission[]; roleVisibility: RouteRoleVisibility }
export interface NavSectionDefinition { id: NavSection; label: string }
export interface NavGroup { section: NavSectionDefinition; items: NavItem[] }
export interface NavLinkState { active: boolean; ariaCurrent?: 'page'; tabIndex: 0 }
type RouteCoverageMetadata = Pick<RouteMetadata, 'osComponentIds' | 'universalSchemaCoverage' | 'readinessStatus'>;
type BaseNavItem = Omit<NavItem, keyof RouteMetadata> & Pick<RouteMetadata, 'iconKey'> & {
  breadcrumbLabel?: string;
  dynamicBadgeSources?: string[];
  safetyCritical?: boolean;
  safetyPosture?: RouteSafetyPostureKind;
};

export const navSections: NavSectionDefinition[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'equine', label: 'Equine' },
  { id: 'safety', label: 'Safety' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'governance', label: 'Governance' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'executive', label: 'Executive' },
  { id: 'platform-admin', label: 'Platform Admin' },
];

const routeCoverageById: Record<string, RouteCoverageMetadata> = {
  operations: { osComponentIds: ['operations-os','command-center-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], readinessStatus: 'partial' },
  'race-office': { osComponentIds: ['operations-os','safety-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  'track-configuration': { osComponentIds: ['operations-os','digital-twin-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  'starting-gate': { osComponentIds: ['safety-os','digital-twin-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  surface: { osComponentIds: ['safety-os','digital-twin-os','racing-intelligence-network'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], readinessStatus: 'partial' },
  equine: { osComponentIds: ['safety-os','digital-twin-os','racing-intelligence-network'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], readinessStatus: 'partial' },
  barns: { osComponentIds: ['safety-os','digital-twin-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  stewards: { osComponentIds: ['safety-os','racing-intelligence-network'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], readinessStatus: 'partial' },
  safety: { osComponentIds: ['safety-os','command-center-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit','compliance'], readinessStatus: 'partial' },
  security: { osComponentIds: ['safety-os','command-center-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  emergency: { osComponentIds: ['safety-os','command-center-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  assets: { osComponentIds: ['digital-twin-os','operations-os'], universalSchemaCoverage: ['entity','event','approval','twin','audit'], readinessStatus: 'implemented' },
  'digital-twin': { osComponentIds: ['digital-twin-os','ai-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit'], readinessStatus: 'implemented' },
  facilities: { osComponentIds: ['operations-os','digital-twin-os','safety-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'implemented' },
  workforce: { osComponentIds: ['operations-os','safety-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','audit'], readinessStatus: 'partial' },
  approvals: { osComponentIds: ['compliance-os','ai-os','command-center-os'], universalSchemaCoverage: ['workflow','approval','ai','audit','compliance'], readinessStatus: 'implemented' },
  audit: { osComponentIds: ['compliance-os','ai-os'], universalSchemaCoverage: ['event','approval','ai','audit','compliance'], readinessStatus: 'implemented' },
  compliance: { osComponentIds: ['compliance-os','accreditation-os','multi-track-federation-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit','compliance'], readinessStatus: 'partial' },
  'ai-governance': { osComponentIds: ['ai-os','compliance-os','racing-intelligence-network','accreditation-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit','compliance'], readinessStatus: 'partial' },
  'api-hub': { osComponentIds: ['racing-intelligence-network','compliance-os','ai-os','digital-twin-os'], universalSchemaCoverage: ['entity','event','workflow','approval','twin','ai','audit','compliance'], readinessStatus: 'implemented' },
  executive: { osComponentIds: ['command-center-os','operations-os','multi-track-federation-os','racing-intelligence-network'], universalSchemaCoverage: ['entity','event','approval','twin','ai','audit','compliance'], readinessStatus: 'partial' },
  'platform-health': { osComponentIds: ['command-center-os','ai-os','accreditation-os','multi-track-federation-os','racing-intelligence-network'], universalSchemaCoverage: ['event','workflow','approval','twin','ai','audit','compliance'], readinessStatus: 'implemented' },
};

export const apiHubDeepLinks: NavDeepLink[] = [
  { id: 'providers', label: 'Providers', path: '/api-hub/providers', keywords: ['api hub providers', 'provider registry', 'connector status'] },
  { id: 'ingestion-jobs', label: 'Ingestion Jobs', path: '/api-hub/ingestion-jobs', keywords: ['api hub ingestion jobs', 'sync jobs', 'batch stream status'] },
  { id: 'raw-payload-review', label: 'Raw Payload Review', path: '/api-hub/raw-payload-review', keywords: ['api hub raw payload review', 'raw provider payloads', 'payload quarantine'] },
  { id: 'canonical-data-explorer', label: 'Canonical Data Explorer', path: '/api-hub/canonical-data-explorer', keywords: ['api hub canonical data explorer', 'canonical envelopes', 'normalized racing data'] },
  { id: 'entity-resolution', label: 'Entity Resolution', path: '/api-hub/entity-resolution', keywords: ['api hub entity resolution', 'horse participant identity matching', 'dedupe'] },
  { id: 'quality', label: 'Quality', path: '/api-hub/quality', keywords: ['api hub quality', 'quality rules', 'validation exceptions'] },
  { id: 'lineage', label: 'Lineage', path: '/api-hub/lineage', keywords: ['api hub lineage', 'source lineage', 'audit evidence'] },
  { id: 'license-policy', label: 'License Policy', path: '/api-hub/license-policy', keywords: ['api hub license policy', 'commercial use', 'redistribution attribution pii'] },
  { id: 'feature-exports', label: 'Feature Exports', path: '/api-hub/feature-exports', keywords: ['api hub feature exports', 'feature store', 'ai training exports'] },
  { id: 'data-lake-exports', label: 'Data Lake Exports', path: '/api-hub/data-lake-exports', keywords: ['api hub data lake exports', 'lakehouse export', 'retention exports'] },
];

const baseNavItems: BaseNavItem[] = [
  { id: 'operations', label: 'Operations Command', path: '/operations', iconKey: 'operations-command', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'operations', dynamicBadgeSources: ['operations:alerts'], safetyCritical: true },
  { id: 'race-office', label: 'Race Office', path: '/race-office', iconKey: 'race-office', required: ['race:request-start'], eventReady: true, mockAllowed: true, section: 'operations', safetyCritical: true },
  { id: 'track-configuration', label: 'Track Configuration', path: '/track-configuration', iconKey: 'track-configuration', required: ['track:readings'], eventReady: true, mockAllowed: true, section: 'operations', safetyCritical: true },
  { id: 'starting-gate', label: 'Starting Gate Control', path: '/starting-gate', iconKey: 'starting-gate', required: ['race:request-start'], eventReady: true, mockAllowed: true, section: 'operations', safetyCritical: true },
  { id: 'surface', label: 'Surface Intelligence', path: '/surface', iconKey: 'surface-intelligence', required: ['track:readings'], eventReady: true, mockAllowed: true, section: 'intelligence', safetyCritical: true },
  { id: 'equine', label: 'Equine Intelligence', path: '/equine', iconKey: 'equine-intelligence', required: ['vet:review'], eventReady: true, mockAllowed: true, section: 'equine', dynamicBadgeSources: ['equine:reviews'], safetyCritical: true },
  { id: 'barns', label: 'Barn Operations', path: '/barns', iconKey: 'barn-operations', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'equine', safetyCritical: true },
  { id: 'stewards', label: 'Steward Center', path: '/stewards', iconKey: 'steward-center', required: ['discipline:issue'], eventReady: true, mockAllowed: true, section: 'safety', dynamicBadgeSources: ['stewards:open'], safetyCritical: true },
  { id: 'safety', label: 'Safety Center', path: '/safety', iconKey: 'safety-center', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'safety', safetyCritical: true },
  { id: 'security', label: 'Security', path: '/security', iconKey: 'security-operations', required: ['security:manage'], eventReady: true, mockAllowed: true, section: 'safety', dynamicBadgeSources: ['security:alerts'], safetyCritical: true },
  { id: 'emergency', label: 'Emergency Ops', path: '/emergency', iconKey: 'emergency-ops', required: ['incident:manage'], eventReady: true, mockAllowed: true, section: 'safety', dynamicBadgeSources: ['emergency:events'], safetyCritical: true },
  { id: 'assets', label: 'Asset Registry', path: '/assets', iconKey: 'asset-registry', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'facilities', safetyCritical: true },
  { id: 'digital-twin', label: 'Digital Twin View', path: '/digital-twin', iconKey: 'digital-twin', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'facilities', safetyCritical: true },
  { id: 'facilities', label: 'Facilities', path: '/facilities', iconKey: 'facilities', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'facilities', safetyCritical: true },
  { id: 'workforce', label: 'Workforce', path: '/workforce', iconKey: 'workforce', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'facilities', safetyCritical: true },
  { id: 'approvals', label: 'Approvals', path: '/approvals', iconKey: 'approvals', required: ['ai:approve'], eventReady: true, mockAllowed: false, section: 'governance', dynamicBadgeSources: ['approvals:pending'], safetyPosture: 'approval-gated' },
  { id: 'audit', label: 'Audit Ledger', path: '/audit', iconKey: 'audit-ledger', required: ['compliance:audit'], eventReady: true, mockAllowed: false, section: 'governance', safetyPosture: 'read-only' },
  { id: 'compliance', label: 'Compliance', path: '/compliance', iconKey: 'compliance', required: ['compliance:audit'], eventReady: true, mockAllowed: true, section: 'governance', safetyCritical: true },
  { id: 'ai-governance', label: 'AI Governance', path: '/ai-governance', iconKey: 'ai-governance', required: ['ai:approve'], eventReady: true, mockAllowed: true, section: 'intelligence', safetyCritical: true },
  { id: 'api-hub', label: 'Racing Data API Hub', path: '/api-hub', iconKey: 'api-hub', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'platform-admin', deepLinks: apiHubDeepLinks, safetyPosture: 'read-only' },
  { id: 'executive', label: 'Executive Center', path: '/executive', iconKey: 'executive-center', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'executive', safetyPosture: 'read-only' },
  { id: 'platform-health', label: 'Platform Health', path: '/platform-health', iconKey: 'platform-health', required: ['read:any'], eventReady: true, mockAllowed: true, section: 'platform-admin', dynamicBadgeSources: ['platform-health:frontend'], safetyPosture: 'read-only' },
];

function roleVisibilityForPermissions(required?: Permission[]): RouteRoleVisibility {
  const requiredPermissions = required ?? [];
  return {
    requiredPermissions,
    permissions: requiredPermissions,
    roles: requiredPermissions.length ? nexusRoles.filter((role) => requiredPermissions.some((permission) => hasPermission(role, permission))) : [...nexusRoles],
    policy: requiredPermissions.length ? 'permission-gated' : 'authenticated',
  };
}

function routeDataState(item: BaseNavItem): RouteDataState {
  return {
    mode: item.mockAllowed ? 'mock-live-adapter' : 'live-only',
    eventReady: item.eventReady,
    mockAllowed: item.mockAllowed,
    liveRequired: !item.mockAllowed,
    safeForDecisioning: false,
    label: item.mockAllowed ? 'Approved mock/live adapter with labelled read-only fallback' : 'Live governed data only; mock fallback blocked',
  };
}

function routeSafetyPosture(item: BaseNavItem): RouteSafetyPosture {
  const posture = item.safetyPosture ?? (item.safetyCritical ? 'safety-critical-approval-gated' : 'approval-gated');
  return {
    posture,
    safetyCritical: posture === 'safety-critical-approval-gated',
    protectedControlsLocked: true,
    autonomousExecutionAllowed: false,
    label: posture === 'read-only' ? 'Read-only workspace; no direct state-changing controls' : posture === 'approval-gated' ? 'State-changing controls require governed approval evidence' : 'Safety-critical controls are locked behind human approval and live backend evidence',
  };
}

function routeMetadataForBaseItem(item: BaseNavItem): RouteMetadata {
  const coverage = routeCoverageById[item.id];
  if (!coverage) throw new Error(`Missing route coverage metadata for ${item.id}`);
  const roleVisibility = roleVisibilityForPermissions(item.required);
  return {
    ...coverage,
    iconKey: item.iconKey,
    roleVisibility,
    requiredPermissions: roleVisibility.requiredPermissions,
    workspaceGroup: item.section,
    badgeSource: { static: ['readiness', 'data-state'], dynamic: item.dynamicBadgeSources ?? [] },
    breadcrumbLabel: item.breadcrumbLabel ?? item.label,
    dataState: routeDataState(item),
    safetyPosture: routeSafetyPosture(item),
  };
}

export const routeMetadataById = Object.fromEntries(baseNavItems.map((item) => [item.id, routeMetadataForBaseItem(item)])) as Record<string, RouteMetadata>;

export const navItems: NavItem[] = baseNavItems.map(({ dynamicBadgeSources, safetyCritical, safetyPosture, breadcrumbLabel, ...item }) => ({ ...item, ...routeMetadataById[item.id] }));

export type LegacyRouteAlias =
  | { from: string; to: string; status: 'redirect'; reason: string }
  | { from: string; status: 'deprecated'; reason: string };
export const legacyRouteAliases: LegacyRouteAlias[] = [
  { from: '/', to: '/operations', status: 'redirect', reason: 'Root now enters the unified command-center shell.' },
  { from: '/command-center', to: '/operations', status: 'redirect', reason: 'Operations Command replaced the standalone command-center route.' },
  { from: '/operations-command', to: '/operations', status: 'redirect', reason: 'Operations Command now uses the canonical /operations route.' },
  { from: '/operations-command-center', to: '/operations', status: 'redirect', reason: 'Operations Command now uses the canonical /operations route.' },
  { from: '/race-day', to: '/race-office', status: 'redirect', reason: 'Race-day card operations live inside Race Office.' },
  { from: '/race-operations', to: '/race-office', status: 'redirect', reason: 'Race operations were consolidated into Race Office.' },
  { from: '/track-map', to: '/track-configuration', status: 'redirect', reason: 'Track map controls live under Track Configuration and Digital Twin View.' },
  { from: '/track-config', to: '/track-configuration', status: 'redirect', reason: 'Track Configuration is the canonical route.' },
  { from: '/gate-control', to: '/starting-gate', status: 'redirect', reason: 'Starting Gate Control is the canonical route.' },
  { from: '/starting-gate-control', to: '/starting-gate', status: 'redirect', reason: 'Starting Gate Control is the canonical route.' },
  { from: '/surface-intelligence', to: '/surface', status: 'redirect', reason: 'Surface Intelligence is available in the command-center shell.' },
  { from: '/equine-intelligence', to: '/equine', status: 'redirect', reason: 'Equine Intelligence is available in the command-center shell.' },
  { from: '/barn-operations', to: '/barns', status: 'redirect', reason: 'Barn Operations is available in the command-center shell.' },
  { from: '/steward-center', to: '/stewards', status: 'redirect', reason: 'Steward Center is available in the command-center shell.' },
  { from: '/stewarding', to: '/stewards', status: 'redirect', reason: 'Steward Center is available in the command-center shell.' },
  { from: '/safety-center', to: '/safety', status: 'redirect', reason: 'Safety Center is a first-class command-center workspace.' },
  { from: '/safety-command', to: '/safety', status: 'redirect', reason: 'Safety Center is a first-class command-center workspace.' },
  { from: '/security-operations', to: '/security', status: 'redirect', reason: 'Security is the canonical command-center workspace.' },
  { from: '/emergency-ops', to: '/emergency', status: 'redirect', reason: 'Emergency Ops is the canonical command-center workspace.' },
  { from: '/emergency-operations', to: '/emergency', status: 'redirect', reason: 'Emergency Ops is the canonical command-center workspace.' },
  { from: '/asset-registry', to: '/assets', status: 'redirect', reason: 'Asset Registry uses the canonical /assets route.' },
  { from: '/digital-twin-view', to: '/digital-twin', status: 'redirect', reason: 'Digital Twin View uses the canonical /digital-twin route.' },
  { from: '/facilities-maintenance', to: '/facilities', status: 'redirect', reason: 'Facilities uses the canonical /facilities route.' },
  { from: '/workforce-operations', to: '/workforce', status: 'redirect', reason: 'Workforce is a first-class command-center workspace.' },
  { from: '/approvals-center', to: '/approvals', status: 'redirect', reason: 'Approvals uses the canonical /approvals route.' },
  { from: '/audit-ledger', to: '/audit', status: 'redirect', reason: 'Audit Ledger uses the canonical /audit route.' },
  { from: '/compliance-center', to: '/compliance', status: 'redirect', reason: 'Compliance uses the canonical /compliance route.' },
  { from: '/ai-command-center', to: '/ai-governance', status: 'redirect', reason: 'AI Control Plane owns governed AI inputs, feature metadata, recommendations, approvals, and observability.' },
  { from: '/responsible-ai', to: '/ai-governance', status: 'redirect', reason: 'AI Control Plane owns responsible AI controls.' },
  { from: '/executive-center', to: '/executive', status: 'redirect', reason: 'Executive Center uses the canonical /executive route.' },
  { from: '/executive-intelligence', to: '/executive', status: 'redirect', reason: 'Executive Center uses the canonical /executive route.' },
  { from: '/platform-observability', to: '/platform-health', status: 'redirect', reason: 'Platform Health owns observability and frontend degraded state.' },
  { from: '/racing-data-api-hub', to: '/api-hub', status: 'redirect', reason: 'API Hub uses the canonical /api-hub route.' },
  { from: '/data-api-hub', to: '/api-hub', status: 'redirect', reason: 'API Hub uses the canonical /api-hub route.' },
  { from: '/api-hub-dashboard', to: '/api-hub', status: 'redirect', reason: 'API Hub dashboard is a subview of the canonical /api-hub route.' },
  { from: '/mobile-command-surface', to: '/operations', status: 'redirect', reason: 'Mobile command surface is a responsive mode of Operations Command.' },
  { from: '/legacy-one-page-dashboard', status: 'deprecated', reason: 'The legacy one-page dashboard is quarantined and must not fall back to Operations.' },
  { from: '/nexus-operational-workspace-blueprint', status: 'deprecated', reason: 'The old workspace blueprint is quarantined and must not be restored as a routable page.' },
];

export const canonicalRouteMap: CanonicalRouteEntry[] = navItems.map((item) => ({
  id: item.id,
  label: item.label,
  path: item.path,
  section: item.section,
  breadcrumbLabel: item.breadcrumbLabel,
  aliases: legacyRouteAliases.filter((alias) => alias.status === 'redirect' && alias.to === item.path).map((alias) => alias.from),
  deepLinks: item.deepLinks ?? [],
  requiredPermissions: item.requiredPermissions,
  roleVisibility: item.roleVisibility,
}));

export function routeAliasForPath(path: string): LegacyRouteAlias | undefined {
  const current = normalizedPath(path);
  return legacyRouteAliases.find((alias) => current === alias.from || current.startsWith(`${alias.from}/`));
}

export function canonicalPathForRoute(path: string): string {
  const current = normalizedPath(path);
  const alias = routeAliasForPath(current);
  if (!alias || alias.status !== 'redirect') return current;
  return `${alias.to}${current.slice(alias.from.length)}`;
}

export function canViewNavItem(roles: Role[], item: NavItem): boolean {
  return !item.required?.length || roles.some((role) => item.required!.some((permission) => hasPermission(role, permission)));
}

export function visibleNavItems(roles: Role[]): NavItem[] {
  return navItems.filter((item) => canViewNavItem(roles, item));
}

export function groupedVisibleNavItems(roles: Role[]): NavGroup[] {
  const visible = visibleNavItems(roles);
  return navSections.map((section) => ({ section, items: visible.filter((item) => item.section === section.id) })).filter((group) => group.items.length > 0);
}

function normalizedPath(path: string): string {
  const withoutHash = path.split('#')[0] ?? '';
  const withoutQuery = withoutHash.split('?')[0] ?? '';
  const normalized = withoutQuery === '/' ? '/' : withoutQuery.replace(/\/+$/, '');
  return normalized || '/operations';
}

export function isNavItemActive(path: string, item: NavItem): boolean {
  const current = canonicalPathForRoute(path);
  return current === item.path || current.startsWith(`${item.path}/`);
}

export function activeNavItem(path: string, items: NavItem[] = navItems): NavItem | undefined {
  return items.find((item) => isNavItemActive(path, item));
}

export function isKnownRoutePath(path: string, items: NavItem[] = navItems): boolean {
  return activeNavItem(path, items) !== undefined;
}

export function groupHasActiveItem(path: string, group: NavGroup): boolean {
  return group.items.some((item) => isNavItemActive(path, item));
}

export function navLinkState(path: string, item: NavItem): NavLinkState {
  const active = isNavItemActive(path, item);
  return { active, ariaCurrent: active ? 'page' : undefined, tabIndex: 0 };
}

function readinessBadge(item: NavItem): NavBadge {
  if (item.readinessStatus === 'implemented') return { id: `${item.id}:readiness`, label: 'Ready', tone: 'success', ariaLabel: `${item.label} route is implemented` };
  if (item.readinessStatus === 'partial') return { id: `${item.id}:readiness`, label: 'Partial', tone: 'warning', ariaLabel: `${item.label} route is partially implemented` };
  if (item.readinessStatus === 'placeholder') return { id: `${item.id}:readiness`, label: 'Placeholder', tone: 'warning', ariaLabel: `${item.label} route is a placeholder` };
  return { id: `${item.id}:readiness`, label: 'Metadata', tone: 'info', ariaLabel: `${item.label} route has readiness metadata` };
}

function sourceBadge(item: NavItem): NavBadge {
  return item.mockAllowed
    ? { id: `${item.id}:source`, label: 'Mock OK', tone: 'info', ariaLabel: `${item.label} allows approved mock fallback data` }
    : { id: `${item.id}:source`, label: 'Live only', tone: 'warning', ariaLabel: `${item.label} requires live governed data` };
}

export function routeBadgesForItem(item: NavItem, dynamicBadges: NavBadgeMap = {}): NavBadge[] {
  return [...(dynamicBadges[item.id] ?? []), readinessBadge(item), sourceBadge(item)];
}
