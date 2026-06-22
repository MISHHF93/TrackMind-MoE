import type {
  AuthProviderDescriptorDto,
  AuthProviderWorkspaceDto,
  TenantSessionDto,
} from '@trackmind/shared';
import type { Role } from '@trackmind/shared';
import { decodeJwtPayload } from './entraRoleMapping.js';

const now = () => new Date().toISOString();

export interface AuthSessionInput {
  userId: string;
  tenantId: string;
  organizationId: string;
  roles: Role[];
  clientHint?: string;
}

export interface AuthProvider {
  readonly descriptor: AuthProviderDescriptorDto;
  issueSession(input: AuthSessionInput): TenantSessionDto;
  validateSession(sessionId: string, tenantId: string): TenantSessionDto | undefined;
  revokeSession(sessionId: string): boolean;
  listSessionsForUser(userId: string): TenantSessionDto[];
  revokeSessionsForUserExcept(userId: string, exceptSessionId: string): number;
  getSessionClientHint(sessionId: string): string | undefined;
  activeSessionCount(tenantId?: string): number;
  parseAccessToken?(accessToken: string): {
    oid?: string;
    email?: string;
    displayName?: string;
    tenantId?: string;
    groups?: string[];
    roles?: string[];
  } | undefined;
}

export class HeaderRoleAuthProvider implements AuthProvider {
  readonly descriptor: AuthProviderDescriptorDto = {
    providerId: 'header-role',
    mode: 'header-role',
    sessionTtlMinutes: 480,
    summary: 'Development auth provider binding tenant-scoped sessions to x-trackmind-role headers.',
  };

  private sessions = new Map<string, TenantSessionDto>();
  private clientHints = new Map<string, string>();

  issueSession(input: AuthSessionInput): TenantSessionDto {
    const issuedAt = now();
    const expiresAt = new Date(Date.now() + this.descriptor.sessionTtlMinutes * 60_000).toISOString();
    const session: TenantSessionDto = {
      sessionId: `sess_${input.userId}_${Date.now().toString(36)}`,
      userId: input.userId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      roles: [...input.roles],
      issuedAt,
      expiresAt,
      authProvider: this.descriptor.providerId,
    };
    this.sessions.set(session.sessionId, session);
    if (input.clientHint) this.clientHints.set(session.sessionId, input.clientHint);
    return session;
  }

  validateSession(sessionId: string, tenantId: string): TenantSessionDto | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) return undefined;
    if (session.expiresAt <= now()) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return { ...session, roles: [...session.roles] };
  }

  revokeSession(sessionId: string): boolean {
    this.clientHints.delete(sessionId);
    return this.sessions.delete(sessionId);
  }

  listSessionsForUser(userId: string): TenantSessionDto[] {
    return [...this.sessions.values()].filter(
      (session) => session.userId === userId && session.expiresAt > now(),
    );
  }

  revokeSessionsForUserExcept(userId: string, exceptSessionId: string): number {
    let revoked = 0;
    for (const session of this.listSessionsForUser(userId)) {
      if (session.sessionId === exceptSessionId) continue;
      if (this.revokeSession(session.sessionId)) revoked += 1;
    }
    return revoked;
  }

  getSessionClientHint(sessionId: string): string | undefined {
    return this.clientHints.get(sessionId);
  }

  activeSessionCount(tenantId?: string): number {
    const active = [...this.sessions.values()].filter((s) => s.expiresAt > now());
    return tenantId ? active.filter((s) => s.tenantId === tenantId).length : active.length;
  }
}

export class EntraAuthProvider extends HeaderRoleAuthProvider {
  override readonly descriptor: AuthProviderDescriptorDto = {
    providerId: 'entra',
    mode: 'entra',
    sessionTtlMinutes: Number(process.env.TRACKMIND_SESSION_TTL_MINUTES ?? 480),
    summary: 'Entra OIDC auth provider validating access tokens and issuing platform sessions.',
  };

  parseAccessToken(accessToken: string) {
    const claims = decodeJwtPayload(accessToken);
    if (!claims) return undefined;
    const email = claims.email ?? claims.preferred_username;
    if (!email) return undefined;
    if (process.env.TRACKMIND_ENTRA_SKIP_VERIFY !== 'true') {
      const expectedTenant = process.env.TRACKMIND_ENTRA_TENANT_ID;
      if (expectedTenant && claims.tid && claims.tid !== expectedTenant) return undefined;
    }
    return {
      oid: claims.oid ?? claims.sub,
      email,
      displayName: claims.name ?? email,
      tenantId: process.env.TRACKMIND_DEFAULT_TENANT_ID ?? 'trackmind',
      groups: claims.groups ?? [],
      roles: claims.roles ?? [],
    };
  }
}

export class NoopAuthProvider implements AuthProvider {
  readonly descriptor: AuthProviderDescriptorDto = {
    providerId: 'noop',
    mode: 'noop',
    sessionTtlMinutes: 60,
    summary: 'No-op auth provider for contract testing without session persistence.',
  };

  issueSession(input: AuthSessionInput): TenantSessionDto {
    return {
      sessionId: `noop_${input.userId}`,
      userId: input.userId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      roles: [...input.roles],
      issuedAt: now(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      authProvider: this.descriptor.providerId,
    };
  }

  validateSession(): undefined {
    return undefined;
  }

  revokeSession(): boolean {
    return false;
  }

  listSessionsForUser(): TenantSessionDto[] {
    return [];
  }

  revokeSessionsForUserExcept(): number {
    return 0;
  }

  getSessionClientHint(): undefined {
    return undefined;
  }

  activeSessionCount(): number {
    return 0;
  }
}

export function createAuthProvider(): AuthProvider {
  const providerId = process.env.TRACKMIND_AUTH_PROVIDER ?? 'header-role';
  if (providerId === 'noop') return new NoopAuthProvider();
  if (providerId === 'entra') return new EntraAuthProvider();
  return new HeaderRoleAuthProvider();
}

export function authProviderWorkspace(provider: AuthProvider): AuthProviderWorkspaceDto {
  return {
    generatedAt: now(),
    provider: provider.descriptor,
    activeSessions: provider.activeSessionCount(),
    mock: false,
  };
}
