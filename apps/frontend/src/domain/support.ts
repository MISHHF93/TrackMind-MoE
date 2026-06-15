import { hasPermission, type Permission, type Role } from '@trackmind/shared';

export type BackendSupportStatus = 'live-api' | 'facade-api' | 'documented-stub' | 'mock-adapter';
export type DataSourceKind = 'backend-route' | 'shared-contract' | 'database-migration' | 'documented-stub' | 'explicit-mock';
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
  aliases?: readonly string[];
  label: string;
  navigationGroup: NavigationGroup;
  iconKey: string;
  requiredPermission: Permission | 'read:any';
  requiredRoles: Role[] | 'authenticated';
  supportStatus: BackendSupportStatus;
  dataSource: string;
  pageComponent: string;
  backendPaths: string[];
  sharedTypes: string[];
  databaseSupport: 'durable' | 'partial' | 'none';
  evidence: BackendEvidence[];
  limitations: string[];
}

export const defaultTenantContext = {
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
