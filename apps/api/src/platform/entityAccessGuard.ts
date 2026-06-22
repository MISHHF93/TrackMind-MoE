import {
  canRoleAccessEntity,
  type EntityAction,
  type EntityDomain,
  type Role,
} from '@trackmind/shared';

export class EntityAccessDeniedError extends Error {
  readonly status = 403;
  readonly code = 'entity_access_denied';

  constructor(role: Role, domain: EntityDomain, action: EntityAction) {
    super(`Role ${role} cannot ${action} ${domain} records`);
    this.name = 'EntityAccessDeniedError';
  }
}

export function assertEntityAccess(role: Role, domain: EntityDomain, action: EntityAction): void {
  if (!canRoleAccessEntity(role, domain, action)) {
    throw new EntityAccessDeniedError(role, domain, action);
  }
}

export function filterByEntityAccess<T>(
  role: Role,
  domain: EntityDomain,
  items: readonly T[],
  action: EntityAction,
): T[] {
  if (!canRoleAccessEntity(role, domain, action)) return [];
  return [...items];
}

export function entityAccessDeniedResponse(error: EntityAccessDeniedError): { status: number; body: Record<string, unknown> } {
  return {
    status: error.status,
    body: { error: error.message, code: error.code },
  };
}
