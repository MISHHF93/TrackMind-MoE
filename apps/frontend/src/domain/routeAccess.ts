import {
  canRoleAccessEntity,
  canRoleEditRoute,
  canRoleViewRoute,
  filterKpisForRole,
  isReadOnlyOperationalRole,
  type EntityDomain,
  type KPIDomain,
  type Role,
} from '@trackmind/shared';
import type { DomainRouteId } from '@/domain/support';
import { useTenantSession } from '@/auth/TenantSessionProvider';

export function useRouteAccess(routeId: DomainRouteId) {
  const { session } = useTenantSession();
  const role = session.role;
  return {
    canView: canRoleViewRoute(role, routeId),
    canEdit: canRoleEditRoute(role, routeId),
    isReadOnly: isReadOnlyOperationalRole(role),
  };
}

export function useEntityAccess(domain: EntityDomain) {
  const { session } = useTenantSession();
  const role = session.role;
  return {
    canView: canRoleAccessEntity(role, domain, 'view'),
    canCreate: canRoleAccessEntity(role, domain, 'create'),
    canEdit: canRoleAccessEntity(role, domain, 'edit'),
  };
}

export function useKpiAccess(domain: KPIDomain): boolean {
  const { session } = useTenantSession();
  return filterKpisForRole(session.role, [domain]).length > 0;
}

export function roleCanMutate(role: Role): boolean {
  return !isReadOnlyOperationalRole(role);
}
