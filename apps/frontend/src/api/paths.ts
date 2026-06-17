import { nexusApiBasePath } from '@trackmind/shared';
import type { DomainRouteId } from '@/domain/support';

export function normalizeApiBaseUrl(value: string | undefined): string {
  const baseUrl = (value ?? nexusApiBasePath).trim().replace(/\/+$/, '');
  return baseUrl || nexusApiBasePath;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_TRACKMIND_API_BASE_URL);
export const AGENTS_BASE_URL = (import.meta.env.VITE_TRACKMIND_AGENTS_URL ?? '/agents').replace(/\/+$/, '');

export type ApiAdapterSource = 'live-api' | 'facade-api' | 'documented-stub';

export const apiPaths = {
  dashboard: {
    operations: '/operations/command-center',
    platformHealth: '/platform/health',
    aiControlPlaneRecommendations: '/ai-control-plane/recommendations',
    aiGovernanceWorkspace: '/ai-governance/workspace',
    aiControlPlaneWorkspace: '/ai-control-plane/workspace',
  },
  kpis: { workspace: '/kpis' },
  raceDay: {
    races: '/races',
    raceOffice: '/race-operations/race-office',
    readiness: '/race-day-readiness/dashboard',
    surface: '/surface-intelligence/workspace',
    trackConfiguration: '/track-configuration/map',
    paddock: '/race-operations/paddock',
    schedule: '/race-operations/schedule',
  },
  equine: {
    horse: '/equine-intelligence/horses/horse-1',
    barnOperations: '/barn-operations/workspace',
    horseProfile: '/horses/horse-1/profile',
    eligibility: '/horses/horse-1/eligibility',
  },
  approvals: { list: '/approvals/requests', durable: '/approvals/durable' },
  incidents: {
    security: '/security-operations/workspace',
    emergency: '/emergency-operations/workspace',
    list: '/incidents',
  },
  compliance: { library: '/compliance/control-library' },
  security: { workspace: '/security-operations/workspace', zonesLive: '/security-operations/zones/live' },
  facilities: { workspace: '/facilities-maintenance/workspace' },
  finance: { ticketing: '/services/finance/ticketing', workspace: '/finance/workspace' },
  federation: { workspace: '/federation/workspace', kpiAggregation: '/federation/kpi-aggregation' },
  dataHub: { workspace: '/racing-data' },
  audit: { events: '/audit/events', search: '/audit/search' },
  admin: {
    platformHealth: '/platform/health',
    foundation: '/platform/foundation',
    environment: '/platform/environment',
    featureFlags: '/platform/feature-flags',
    modules: '/platform/modules',
    identity: '/identity/workspace',
  },
  analytics: { workspace: '/analytics/workspace' },
  fanExperience: { workspace: '/fan-experience/workspace' },
  notifications: { inbox: '/notifications/inbox' },
  settings: {
    policy: '/ai-control-plane/policy',
    workspace: '/ai-control-plane/workspace',
    models: '/ai-control-plane/models',
    blockedActions: '/ai-control-plane/blocked-actions',
    events: '/ai-control-plane/events',
    features: '/ai-control-plane/features',
    modelRegistry: '/ai-governance/model-registry',
  },
  stewarding: { inquiries: '/stewarding/inquiries' },
  workforce: { workspace: '/workforce-operations/workspace' },
  digitalTwin: { state: '/digital-twin/state', assets: '/assets' },
  surface: {
    workspace: '/surface-intelligence/workspace',
    measurements: '/track-surface/measurements',
  },
  emergency: { workspace: '/emergency-operations/workspace' },
  events: { stream: '/events/stream' },
  collaboration: {
    threads: '/collaboration/threads',
    activity: '/collaboration/activity',
  },
  search: { global: '/search/global' },
} as const;

export const commonContextApiPaths = [
  apiPaths.approvals.list,
  apiPaths.audit.events,
  apiPaths.dashboard.aiControlPlaneRecommendations,
  apiPaths.dashboard.aiGovernanceWorkspace,
  apiPaths.dashboard.aiControlPlaneWorkspace,
  apiPaths.kpis.workspace,
] as const;

export const routeApiPathGroups = {
  dashboard: [apiPaths.dashboard.operations, apiPaths.dashboard.platformHealth, ...commonContextApiPaths],
  raceDay: [
    apiPaths.raceDay.races,
    apiPaths.raceDay.raceOffice,
    apiPaths.raceDay.readiness,
    apiPaths.raceDay.surface,
    apiPaths.raceDay.trackConfiguration,
    apiPaths.raceDay.paddock,
    apiPaths.raceDay.schedule,
    ...commonContextApiPaths,
  ],
  equine: [apiPaths.equine.horse, apiPaths.equine.barnOperations, apiPaths.equine.horseProfile, apiPaths.equine.eligibility, ...commonContextApiPaths],
  approvals: [apiPaths.approvals.list, apiPaths.approvals.durable, ...commonContextApiPaths],
  incidents: [apiPaths.incidents.security, apiPaths.incidents.emergency, apiPaths.incidents.list, ...commonContextApiPaths],
  compliance: [apiPaths.compliance.library, ...commonContextApiPaths],
  security: [apiPaths.security.workspace, apiPaths.security.zonesLive, ...commonContextApiPaths],
  facilities: [apiPaths.facilities.workspace, ...commonContextApiPaths],
  ticketing: [apiPaths.finance.ticketing, ...commonContextApiPaths],
  finance: [apiPaths.finance.workspace, apiPaths.finance.ticketing, ...commonContextApiPaths],
  federation: [apiPaths.federation.workspace, apiPaths.federation.kpiAggregation, ...commonContextApiPaths],
  dataHub: [apiPaths.dataHub.workspace, ...commonContextApiPaths],
  audit: [apiPaths.audit.events, apiPaths.audit.search, ...commonContextApiPaths],
  admin: [
    apiPaths.admin.platformHealth,
    apiPaths.admin.foundation,
    apiPaths.admin.environment,
    apiPaths.admin.featureFlags,
    apiPaths.admin.modules,
    apiPaths.admin.identity,
    ...commonContextApiPaths,
  ],
  analytics: [apiPaths.analytics.workspace, apiPaths.federation.kpiAggregation, ...commonContextApiPaths],
  fanExperience: [apiPaths.fanExperience.workspace, ...commonContextApiPaths],
  notifications: [apiPaths.notifications.inbox, ...commonContextApiPaths],
  settings: [
    apiPaths.settings.policy,
    apiPaths.settings.workspace,
    apiPaths.settings.models,
    apiPaths.settings.blockedActions,
    apiPaths.settings.events,
    apiPaths.settings.features,
    apiPaths.settings.modelRegistry,
    ...commonContextApiPaths,
  ],
  stewarding: [apiPaths.stewarding.inquiries, ...commonContextApiPaths],
  workforce: [apiPaths.workforce.workspace, ...commonContextApiPaths],
  digitalTwin: [apiPaths.digitalTwin.state, apiPaths.digitalTwin.assets, ...commonContextApiPaths],
  surface: [apiPaths.surface.workspace, apiPaths.surface.measurements, ...commonContextApiPaths],
  emergency: [apiPaths.emergency.workspace, ...commonContextApiPaths],
} as const satisfies Record<DomainRouteId, readonly string[]>;

const pathSources: Record<string, ApiAdapterSource> = {
  [apiPaths.dashboard.operations]: 'live-api',
  [apiPaths.dashboard.platformHealth]: 'live-api',
  [apiPaths.approvals.list]: 'live-api',
  [apiPaths.approvals.durable]: 'live-api',
  [apiPaths.facilities.workspace]: 'live-api',
  [apiPaths.audit.events]: 'live-api',
  [apiPaths.audit.search]: 'live-api',
  [apiPaths.admin.foundation]: 'live-api',
  [apiPaths.admin.environment]: 'live-api',
  [apiPaths.analytics.workspace]: 'live-api',
  [apiPaths.fanExperience.workspace]: 'live-api',
  [apiPaths.notifications.inbox]: 'live-api',
  [apiPaths.finance.workspace]: 'live-api',
  [apiPaths.incidents.list]: 'live-api',
  [apiPaths.raceDay.paddock]: 'live-api',
  [apiPaths.raceDay.schedule]: 'live-api',
  [apiPaths.security.zonesLive]: 'live-api',
  [apiPaths.settings.modelRegistry]: 'live-api',
  [apiPaths.federation.kpiAggregation]: 'live-api',
  [apiPaths.search.global]: 'live-api',
  [apiPaths.equine.horseProfile]: 'live-api',
  [apiPaths.equine.eligibility]: 'live-api',
};

export function adapterSourceForPath(path: string): ApiAdapterSource {
  const url = new URL(path, 'https://trackmind.local');
  return pathSources[url.pathname] ?? 'live-api';
}

export function backendContractPathsForRoute(routeId: DomainRouteId): string[] {
  return routeApiPathGroups[routeId].map((path) => `${nexusApiBasePath}${path}`);
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function agentsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${AGENTS_BASE_URL}${normalizedPath}`;
}
