import { roleCapabilityBindings, normalizeRole, type Role, type RoleScope } from '@trackmind/shared';

export class ScopeMismatchError extends Error {
  readonly status = 403;
  readonly code = 'scope_mismatch';

  constructor(message: string) {
    super(message);
    this.name = 'ScopeMismatchError';
  }
}

export interface ScopeContext {
  role: Role;
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
}

export function roleScopeFor(role: Role): RoleScope {
  return roleCapabilityBindings[role]?.scope ?? 'racetrack';
}

/** Racetrack-scoped roles may only access records for their active racetrack. */
export function assertRacetrackScope(
  context: ScopeContext,
  record: { tenantId?: string; racetrackId?: string; organizationId?: string },
): void {
  const scope = roleScopeFor(context.role);
  if (scope === 'platform') return;

  if (record.tenantId && record.tenantId !== context.tenantId) {
    throw new ScopeMismatchError(`Tenant scope mismatch for role ${context.role}`);
  }

  if (scope === 'racetrack' && record.racetrackId && record.racetrackId !== context.racetrackId) {
    throw new ScopeMismatchError(`Racetrack scope mismatch for role ${context.role}`);
  }

  if (scope === 'organization' && record.organizationId && context.organizationId && record.organizationId !== context.organizationId) {
    throw new ScopeMismatchError(`Organization scope mismatch for role ${context.role}`);
  }
}

export function filterByScope<T extends { tenantId?: string; racetrackId?: string; organizationId?: string }>(
  context: ScopeContext,
  items: readonly T[],
): T[] {
  return items.filter((item) => {
    try {
      assertRacetrackScope(context, item);
      return true;
    } catch {
      return false;
    }
  });
}

export function scopeContextFromHeaders(headers: Record<string, string | string[] | undefined>): ScopeContext {
  const value = (key: string) => {
    const raw = headers[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  return {
    role: normalizeRole(value('x-trackmind-role') ?? '') ?? 'staff-limited',
    tenantId: value('x-trackmind-tenant-id') ?? 'trackmind',
    racetrackId: value('x-trackmind-racetrack-id') ?? 'main-track',
    organizationId: value('x-trackmind-organization-id') ?? undefined,
  };
}

export function scopeMismatchResponse(error: ScopeMismatchError): { status: number; body: Record<string, unknown> } {
  return {
    status: error.status,
    body: { error: error.message, code: error.code },
  };
}
