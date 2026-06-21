import type { DomainRouteId } from '@/domain/support';

/** Routes gated by `/platform/modules` (feature flags + entitlements). */
export const gatedRouteModules = {
  dashboard: 'dashboard',
  raceDay: 'raceDay',
  surface: 'surface',
  equine: 'equine',
  analytics: 'analytics',
  finance: 'finance',
  incidents: 'incidents',
  fanExperience: 'fanExperience',
  admin: 'admin',
} as const satisfies Partial<Record<DomainRouteId, string>>;

export type GatedRouteId = keyof typeof gatedRouteModules;

export function routeModuleKey(routeId: DomainRouteId): string | undefined {
  return gatedRouteModules[routeId as GatedRouteId];
}
