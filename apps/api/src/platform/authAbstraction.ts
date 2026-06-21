import type {
  AuthProviderDescriptorDto,
  AuthProviderWorkspaceDto,
  TenantSessionDto,
} from '@trackmind/shared';
import type { Role } from '@trackmind/shared';

const now = () => new Date().toISOString();

export interface AuthSessionInput {
  userId: string;
  tenantId: string;
  organizationId: string;
  roles: Role[];
}

export interface AuthProvider {
  readonly descriptor: AuthProviderDescriptorDto;
  issueSession(input: AuthSessionInput): TenantSessionDto;
  validateSession(sessionId: string, tenantId: string): TenantSessionDto | undefined;
  revokeSession(sessionId: string): boolean;
  activeSessionCount(tenantId?: string): number;
}

export class HeaderRoleAuthProvider implements AuthProvider {
  readonly descriptor: AuthProviderDescriptorDto = {
    providerId: 'header-role',
    mode: 'header-role',
    sessionTtlMinutes: 480,
    summary: 'Development auth provider binding tenant-scoped sessions to x-trackmind-role headers.',
  };

  private sessions = new Map<string, TenantSessionDto>();

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
    return this.sessions.delete(sessionId);
  }

  activeSessionCount(tenantId?: string): number {
    const active = [...this.sessions.values()].filter((s) => s.expiresAt > now());
    return tenantId ? active.filter((s) => s.tenantId === tenantId).length : active.length;
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

  activeSessionCount(): number {
    return 0;
  }
}

export function createAuthProvider(): AuthProvider {
  const providerId = process.env.TRACKMIND_AUTH_PROVIDER ?? 'header-role';
  if (providerId === 'noop') return new NoopAuthProvider();
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
