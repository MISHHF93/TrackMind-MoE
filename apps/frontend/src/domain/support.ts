import { hasPermission, roleRegistry, type Permission, type Role, type TenantRacetrackContext } from '@trackmind/shared';

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
  | 'notifications';

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
  role: 'admin' as Role,
  auditMode: 'read-only',
  scopeSource: 'operator-session',
};

export function roleDisplayName(role: Role): string {
  return roleRegistry[role]?.displayName ?? role;
}

export function canViewRoute(route: RouteSupportMetadata, role: Role): boolean {
  const roleAllowed = route.requiredRoles === 'authenticated' || route.requiredRoles.includes(role);
  return roleAllowed && hasPermission(role, route.requiredPermission);
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
