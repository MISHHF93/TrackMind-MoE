import { normalizeRole, roles, type Role } from '@trackmind/shared';
import type { IncomingMessage } from 'node:http';
import type { IdentityService } from './identityService.js';
import { seededUserIdForRole } from './identityService.js';

export interface RequestPrincipal {
  userId: string;
  tenantId: string;
  organizationId: string;
  roles: Role[];
  activeRole: Role;
  sessionId?: string;
  displayName?: string;
  email?: string;
}

function headerValue(headers: IncomingMessage['headers'], key: string): string | undefined {
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function bearerToken(headers: IncomingMessage['headers']): string | undefined {
  const authorization = headerValue(headers, 'authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return undefined;
  return authorization.slice(7).trim() || undefined;
}

export function authProviderMode(): string {
  return process.env.TRACKMIND_AUTH_PROVIDER ?? 'header-role';
}

export function resolveRequestPrincipal(
  headers: IncomingMessage['headers'] | undefined,
  identity: IdentityService,
): RequestPrincipal | undefined {
  if (!headers) return undefined;
  const tenantId = headerValue(headers, 'x-trackmind-tenant-id') ?? 'trackmind';
  const token = bearerToken(headers);

  if (token?.startsWith('sess_') || token?.startsWith('noop_')) {
    const session = identity.resolveOperatorSession(token, tenantId);
    if (!session) return undefined;
    const activeRole = normalizeRole(session.activeRole);
    if (!activeRole) return undefined;
    return {
      userId: session.userId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      roles: session.assignedRoles.filter((r): r is Role => roles.includes(r as Role)),
      activeRole,
      sessionId: session.sessionId,
      displayName: session.displayName,
      email: session.email,
    };
  }

  const provider = authProviderMode();
  if (provider === 'header-role') {
    const rawRole = headerValue(headers, 'x-trackmind-role');
    const role = rawRole ? normalizeRole(rawRole) : undefined;
    if (!role) return undefined;
    const userId = headerValue(headers, 'x-trackmind-actor-id') ?? seededUserIdForRole(role) ?? `dev-${role}`;
    return {
      userId,
      tenantId,
      organizationId: headerValue(headers, 'x-trackmind-organization-id') ?? 'org-trackmind-network',
      roles: [role],
      activeRole: role,
    };
  }

  return undefined;
}

export function roleFromPrincipalOrHeader(
  headers: IncomingMessage['headers'] | undefined,
  identity: IdentityService,
): Role | undefined {
  const principal = resolveRequestPrincipal(headers, identity);
  if (principal) return principal.activeRole;
  if (authProviderMode() === 'header-role') {
    const raw = headerValue(headers ?? {}, 'x-trackmind-role');
    return raw ? normalizeRole(raw) : undefined;
  }
  return undefined;
}

export function rejectSpoofedRoleHeader(headers: IncomingMessage['headers'] | undefined): boolean {
  if (authProviderMode() !== 'entra') return false;
  return Boolean(headerValue(headers ?? {}, 'x-trackmind-role'));
}
