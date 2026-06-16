import { nexusApiBasePath } from '@trackmind/shared';
import type { DomainRouteId } from '../domain/support';

export function normalizeApiBaseUrl(value: string | undefined): string {
  const baseUrl = (value ?? nexusApiBasePath).trim().replace(/\/+$/, '');
  return baseUrl || nexusApiBasePath;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_TRACKMIND_API_BASE_URL);
export type ApiAdapterSource = 'live-api' | 'facade-api' | 'documented-stub';

export const apiPaths = {
  dashboard: {
    operations: '/operations/command-center',
    platformHealth: '/platform/health',
    aiControlPlaneRecommendations: '/ai-control-plane/recommendations',
    aiGovernanceWorkspace: '/ai-governance/workspace',
    aiControlPlaneWorkspace: '/ai-control-plane/workspace',
    aiControlPlaneModels: '/ai-control-plane/models',
    aiControlPlaneBlockedActions: '/ai-control-plane/blocked-actions',
    aiControlPlaneEvents: '/ai-control-plane/events',
  },
  kpis: {
    workspace: '/kpis',
  },
  raceDay: {
    races: '/races',
    raceOffice: '/race-operations/race-office',
    readiness: '/race-day-readiness/dashboard',
    surface: '/surface-intelligence/workspace',
    trackConfiguration: '/track-configuration/map',
  },
  equine: {
    horse: '/equine-intelligence/horses/horse-1',
    barnOperations: '/barn-operations/workspace',
  },
  approvals: {
    list: '/approvals/requests',
  },
  incidents: {
    security: '/security-operations/workspace',
    emergency: '/emergency-operations/workspace',
  },
  compliance: {
    library: '/compliance/control-library',
  },
  security: {
    workspace: '/security-operations/workspace',
  },
  facilities: {
    workspace: '/facilities-maintenance/workspace',
  },
  finance: {
    ticketing: '/services/finance/ticketing',
  },
  federation: {
    workspace: '/federation/workspace',
  },
  dataHub: {
    workspace: '/racing-data',
  },
  audit: {
    events: '/audit/events',
  },
  admin: {
    platformHealth: '/platform/health',
  },
  settings: {
    policy: '/ai-control-plane/policy',
    workspace: '/ai-control-plane/workspace',
    models: '/ai-control-plane/models',
    blockedActions: '/ai-control-plane/blocked-actions',
    events: '/ai-control-plane/events',
    features: '/ai-control-plane/features',
  },
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
  dashboard: [
    apiPaths.dashboard.operations,
    apiPaths.dashboard.platformHealth,
    ...commonContextApiPaths,
  ],
  raceDay: [
    apiPaths.raceDay.races,
    apiPaths.raceDay.raceOffice,
    apiPaths.raceDay.readiness,
    apiPaths.raceDay.surface,
    apiPaths.raceDay.trackConfiguration,
    ...commonContextApiPaths,
  ],
  equine: [apiPaths.equine.horse, apiPaths.equine.barnOperations, ...commonContextApiPaths],
  approvals: commonContextApiPaths,
  incidents: [apiPaths.incidents.security, apiPaths.incidents.emergency, ...commonContextApiPaths],
  compliance: [apiPaths.compliance.library, ...commonContextApiPaths],
  security: [apiPaths.security.workspace, ...commonContextApiPaths],
  facilities: [apiPaths.facilities.workspace, ...commonContextApiPaths],
  ticketing: [apiPaths.finance.ticketing, ...commonContextApiPaths],
  finance: [apiPaths.finance.ticketing, ...commonContextApiPaths],
  federation: [apiPaths.federation.workspace, ...commonContextApiPaths],
  dataHub: [apiPaths.dataHub.workspace, ...commonContextApiPaths],
  audit: commonContextApiPaths,
  admin: [apiPaths.admin.platformHealth, ...commonContextApiPaths],
  settings: [
    apiPaths.settings.policy,
    apiPaths.settings.workspace,
    apiPaths.settings.models,
    apiPaths.settings.blockedActions,
    apiPaths.settings.events,
    apiPaths.settings.features,
    ...commonContextApiPaths,
  ],
} as const satisfies Record<DomainRouteId, readonly string[]>;

const pathSources: Record<string, ApiAdapterSource> = {
  [apiPaths.dashboard.operations]: 'facade-api',
  [apiPaths.dashboard.platformHealth]: 'facade-api',
  [apiPaths.dashboard.aiControlPlaneRecommendations]: 'live-api',
  [apiPaths.dashboard.aiGovernanceWorkspace]: 'facade-api',
  [apiPaths.dashboard.aiControlPlaneWorkspace]: 'facade-api',
  [apiPaths.dashboard.aiControlPlaneModels]: 'facade-api',
  [apiPaths.dashboard.aiControlPlaneBlockedActions]: 'live-api',
  [apiPaths.dashboard.aiControlPlaneEvents]: 'facade-api',
  [apiPaths.kpis.workspace]: 'live-api',
  [apiPaths.raceDay.races]: 'facade-api',
  [apiPaths.raceDay.raceOffice]: 'facade-api',
  [apiPaths.raceDay.readiness]: 'facade-api',
  [apiPaths.raceDay.surface]: 'facade-api',
  [apiPaths.raceDay.trackConfiguration]: 'facade-api',
  [apiPaths.equine.horse]: 'facade-api',
  [apiPaths.equine.barnOperations]: 'facade-api',
  [apiPaths.approvals.list]: 'live-api',
  [apiPaths.incidents.security]: 'facade-api',
  [apiPaths.incidents.emergency]: 'facade-api',
  [apiPaths.compliance.library]: 'facade-api',
  [apiPaths.facilities.workspace]: 'live-api',
  [apiPaths.finance.ticketing]: 'facade-api',
  [apiPaths.federation.workspace]: 'facade-api',
  [apiPaths.dataHub.workspace]: 'facade-api',
  [apiPaths.audit.events]: 'live-api',
  [apiPaths.settings.policy]: 'facade-api',
  [apiPaths.settings.features]: 'facade-api',
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
