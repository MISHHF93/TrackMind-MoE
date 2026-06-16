import type { DomainRouteId } from './support';

export interface ContextDegradation {
  path: string;
  label: string;
  message: string;
}

export interface AIExpertModuleSummary {
  id: string;
  name: string;
  owner: string;
  modelVersionId: string;
  restrictedActions: string[];
  allowedActivities: string[];
}

export interface AIOperatingContext {
  policyId: string;
  advisoryOnly: true;
  executionAllowed: false;
  posture: 'routing' | 'blocked' | 'advisory';
  summary: string;
  expertModules: AIExpertModuleSummary[];
  routedExpertIds: string[];
  blockedActionCount: number;
  queuedRecommendationCount: number;
  modelCount: number;
  eventCount: number;
}

const routeExpertKeywords: Partial<Record<DomainRouteId, string[]>> = {
  dashboard: ['executive', 'race-readiness', 'surface', 'security'],
  raceDay: ['surface', 'race-readiness', 'gate', 'weather'],
  equine: ['equine', 'horse'],
  incidents: ['security', 'emergency', 'executive'],
  security: ['security', 'anomaly'],
  facilities: ['maintenance', 'asset'],
  compliance: ['steward', 'executive'],
  finance: ['executive', 'finance'],
  ticketing: ['executive', 'fan'],
  federation: ['executive', 'federation'],
  dataHub: ['executive', 'data'],
  audit: ['steward', 'executive'],
  admin: ['executive', 'platform'],
  settings: ['governor', 'policy'],
  approvals: ['executive', 'steward'],
};

export function expertKeywordsForRoute(routeId: DomainRouteId): string[] {
  return routeExpertKeywords[routeId] ?? ['executive'];
}

export function emptyAIOperatingContext(): AIOperatingContext {
  return {
    policyId: 'trackmind-ai-advisory-only-v1',
    advisoryOnly: true,
    executionAllowed: false,
    posture: 'advisory',
    summary: 'AI operating layer is offline; recommendations and expert routing are unavailable until the control plane reconnects.',
    expertModules: [],
    routedExpertIds: [],
    blockedActionCount: 0,
    queuedRecommendationCount: 0,
    modelCount: 0,
    eventCount: 0,
  };
}
