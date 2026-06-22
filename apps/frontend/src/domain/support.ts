import { canRoleAccessRoute, roleRegistry, homePathForRole, type Permission, type Role, type TenantRacetrackContext } from '@trackmind/shared';

export type BackendSupportStatus = 'live-api' | 'facade-api' | 'documented-stub';
export type NavigationGroup = 'Command' | 'Race Operations' | 'Safety & Facilities' | 'Governance' | 'Business Controls' | 'Data Governance' | 'System Status' | 'Platform';

export type DomainRouteId =
  | 'dashboard'
  | 'raceDay'
  | 'equine'
  | 'approvals'
  | 'incidents'
  | 'compliance'
  | 'security'
  | 'facilities'
  | 'ticketing'
  | 'finance'
  | 'federation'
  | 'dataHub'
  | 'audit'
  | 'admin'
  | 'settings'
  | 'stewarding'
  | 'workforce'
  | 'digitalTwin'
  | 'surface'
  | 'emergency'
  | 'analytics'
  | 'fanExperience'
  | 'notifications'
  | 'account';

export interface RouteSupportMetadata {
  id: DomainRouteId;
  path: string;
  label: string;
  navigationGroup: NavigationGroup;
  iconKey: string;
  requiredPermission: Permission | 'read:any';
  requiredRoles: Role[] | 'authenticated';
  supportStatus: BackendSupportStatus;
  dataSource: string;
  backendPaths: readonly string[];
}

export const backendSupportLabels: Record<BackendSupportStatus, string> = {
  'live-api': 'Live service route',
  'facade-api': 'Reference read model',
  'documented-stub': 'Planned workspace',
};

export const defaultTenantContext: TenantRacetrackContext = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  organizationId: 'org-trackmind-network',
  role: 'platform-super-admin' as Role,
  auditMode: 'read-only',
  scopeSource: 'operator-session',
};

export interface OperatorScopeOption {
  id: string;
  label: string;
  organizationId: string;
}

/** Demo tenant/racetrack options aligned with API tenant seed data. */
export const operatorTenantOptions: OperatorScopeOption[] = [
  { id: 'trackmind', label: 'TrackMind Demo Tenant', organizationId: 'org-trackmind-network' },
];

export const operatorRacetracksByTenant: Record<string, OperatorScopeOption[]> = {
  trackmind: [
    { id: 'main-track', label: 'Laurel Park Main Oval', organizationId: 'org-trackmind-network' },
    { id: 'north-chute', label: 'North Training Chute', organizationId: 'org-trackmind-network' },
  ],
};

export function racetracksForTenant(tenantId: string): OperatorScopeOption[] {
  return operatorRacetracksByTenant[tenantId] ?? [];
}

export function tenantScopeLabel(tenantId: string): string {
  return operatorTenantOptions.find((tenant) => tenant.id === tenantId)?.label ?? tenantId;
}

export function racetrackScopeLabel(tenantId: string, racetrackId: string): string {
  return racetracksForTenant(tenantId).find((racetrack) => racetrack.id === racetrackId)?.label ?? racetrackId;
}

export function roleDisplayName(role: Role): string {
  return roleRegistry[role]?.displayName ?? role;
}

export function canViewRoute(route: RouteSupportMetadata, role: Role): boolean {
  return canRoleAccessRoute(role, route.id);
}

import {
  accessibleRoutesForRole,
  canAccessRoute,
  homePathForAccessibleRole,
  isPathAccessibleForRole,
  isRouteModuleEnabled,
} from '@/domain/accessibleRoutes';

export {
  accessibleRoutesForRole,
  canAccessRoute,
  homePathForAccessibleRole,
  isPathAccessibleForRole,
  isRouteModuleEnabled,
};

export function homePathForSessionRole(
  role: Role,
  routeList?: readonly RouteSupportMetadata[],
  enabledModules?: ReadonlyMap<string, boolean>,
  modulesLoading = false,
): string {
  if (routeList?.length) {
    return homePathForAccessibleRole(role, routeList, enabledModules, modulesLoading);
  }
  return homePathForRole(role);
}

export const regulatedActionNames = [
  'race starts',
  'race stops',
  'official results',
  'scratches',
  'medication decisions',
  'emergency actions',
  'payouts',
  'disciplinary decisions',
  'regulatory enforcement actions',
] as const;
