export const API_BASE_URL = import.meta.env.VITE_TRACKMIND_API_BASE_URL ?? '/api/v1';

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
  },
  equine: {
    horse: '/equine-intelligence/horses/horse-1',
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

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
