import { hasPermission, type Permission, type Role, type TenantRacetrackContext } from '@trackmind/shared';

export type BackendSupportStatus = 'live-api' | 'facade-api' | 'documented-stub';
export type DataSourceKind = 'backend-route' | 'shared-contract' | 'database-migration' | 'documented-stub';
export type NavigationGroup = 'Command' | 'Operations' | 'Governance' | 'Enterprise' | 'Administration';
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
  | 'settings';

export interface BackendEvidence {
  source: DataSourceKind;
  reference: string;
  summary: string;
}

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
  sharedTypes: string[];
  databaseSupport: 'durable' | 'partial' | 'none';
  evidence: BackendEvidence[];
  limitations: string[];
}

export const backendSupportLabels: Record<BackendSupportStatus, string> = {
  'live-api': 'API route wired',
  'facade-api': 'Facade-backed',
  'documented-stub': 'Documented plan',
};

export const defaultTenantContext: TenantRacetrackContext = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  organizationId: 'org-trackmind-network',
  role: 'admin' as Role,
  auditMode: 'read-only',
  scopeSource: 'demo-reference-context',
};

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
