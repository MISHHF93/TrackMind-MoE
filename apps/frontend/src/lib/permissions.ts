import { hasPermission, roleRegistry, type Role } from '@trackmind/shared';
import type { BackendSupportStatus, RouteSupportMetadata } from '../domain/support';

export const backendSupportLabels: Record<BackendSupportStatus, string> = {
  'live-api': 'Live service route',
  'facade-api': 'Reference read model',
  'documented-stub': 'Planned workspace',
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
