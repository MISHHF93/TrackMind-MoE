import type { Role } from '@trackmind/shared';
import { isEntityPickerKind, normalizeRole } from '@trackmind/shared';
import type { EntityPickerService } from './entityPickerService.js';

export interface EntityPickerRequestContext {
  tenantId: string;
  racetrackId: string;
  actorId: string;
  role: Role;
  requestId: string;
}

export function entityPickerScopeFromHeaders(
  headers: Record<string, string | undefined>,
  requestId: string,
): EntityPickerRequestContext {
  const roleHeader = headers['x-trackmind-role'] ?? 'read-only-auditor';
  return {
    tenantId: headers['x-trackmind-tenant-id'] ?? 'trackmind',
    racetrackId: headers['x-trackmind-racetrack-id'] ?? 'main-track',
    actorId: headers['x-trackmind-actor-id'] ?? `${roleHeader}-operator`,
    role: normalizeRole(roleHeader) ?? 'read-only-auditor',
    requestId,
  };
}

export function handleEntityPickerRoute(
  service: EntityPickerService,
  method: string,
  path: string,
  scope: EntityPickerRequestContext,
  searchParams?: URLSearchParams,
): { status: number; body: unknown } | undefined {
  if (method === 'GET' && path === '/entity-picker/kinds') {
    return { status: 200, body: service.listKinds(scope.role) };
  }

  if (method === 'GET' && path === '/entity-picker/search') {
    const kindParam = searchParams?.get('kind') ?? '';
    if (!isEntityPickerKind(kindParam)) {
      return { status: 400, body: { ok: false, error: { code: 'unknown_kind', message: `Unknown entity picker kind ${kindParam}` } } };
    }
    const query = searchParams?.get('q') ?? '';
    const limitParam = searchParams?.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;
    const result = service.search({
      kind: kindParam,
      query,
      role: scope.role,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    if (result.permissionDenied) {
      return { status: 403, body: { ok: false, error: { code: 'forbidden', message: `Role ${scope.role} cannot search ${kindParam}` } } };
    }
    return { status: 200, body: result };
  }

  return undefined;
}
