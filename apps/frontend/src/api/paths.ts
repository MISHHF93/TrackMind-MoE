import { nexusApiBasePath } from '@trackmind/shared';
import type { DomainRouteId } from '../domain/support';

export const API_BASE_URL = import.meta.env.VITE_TRACKMIND_API_BASE_URL ?? nexusApiBasePath;
export type ApiAdapterSource = 'live-api' | 'facade-api' | 'documented-stub';

export const apiPaths = {
  dashboard: {
    operations: '/operations/command-center',
    platformHealth: '/platform/health',
    aiControlPlaneRecommendations: '/ai-control-plane/recommendations',
    aiGovernanceWorkspace: '/ai-governance/workspace',
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
  },
} as const;

export const routeApiPathGroups = {
  dashboard: [
    apiPaths.dashboard.operations,
    apiPaths.dashboard.platformHealth,
    apiPaths.dashboard.aiControlPlaneRecommendations,
    apiPaths.dashboard.aiGovernanceWorkspace,
    apiPaths.approvals.list,
    apiPaths.audit.events,
    apiPaths.kpis.workspace,
  ],
  raceDay: [
    apiPaths.raceDay.races,
    apiPaths.raceDay.raceOffice,
    apiPaths.raceDay.readiness,
    apiPaths.raceDay.surface,
    apiPaths.raceDay.trackConfiguration,
  ],
  equine: [apiPaths.equine.horse, apiPaths.equine.barnOperations],
  approvals: [apiPaths.approvals.list],
  incidents: [apiPaths.incidents.security, apiPaths.incidents.emergency],
  compliance: [apiPaths.compliance.library],
  security: [apiPaths.security.workspace],
  facilities: [apiPaths.facilities.workspace],
  ticketing: [apiPaths.finance.ticketing],
  finance: [apiPaths.finance.ticketing],
  federation: [apiPaths.federation.workspace],
  dataHub: [apiPaths.dataHub.workspace],
  audit: [apiPaths.audit.events],
  admin: [apiPaths.admin.platformHealth],
  settings: [apiPaths.settings.policy],
} as const satisfies Record<DomainRouteId, readonly string[]>;

const pathSources: Record<string, ApiAdapterSource> = {
  [apiPaths.dashboard.operations]: 'live-api',
  [apiPaths.dashboard.platformHealth]: 'facade-api',
  [apiPaths.dashboard.aiControlPlaneRecommendations]: 'live-api',
  [apiPaths.dashboard.aiGovernanceWorkspace]: 'facade-api',
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
};

export function adapterSourceForPath(path: string): ApiAdapterSource {
  const url = new URL(path, 'https://trackmind.local');
  return pathSources[url.pathname] ?? 'live-api';
}

export function backendContractPathsForRoute(routeId: DomainRouteId): string[] {
  return routeApiPathGroups[routeId].map((path) => `${nexusApiBasePath}${path}`);
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
