import type { OperatorProfileDto, OperatorSessionDto, Role, TenantRacetrackContext } from '@trackmind/shared';
import { assignableRoles, isRole, normalizeRole } from '@trackmind/shared';
import { defaultTenantContext } from '@/domain/support';
import { demoAccessEnabled } from '@/auth/entraAuth';

const storageKey = 'trackmind-operator-session';

export interface SessionState extends TenantRacetrackContext {
  sessionKey: string;
  userId?: string;
  displayName?: string;
  email?: string;
  assignedRoles?: Role[];
  bearerToken?: string;
  authenticated?: boolean;
  issuedAt?: string;
  expiresAt?: string;
  authProvider?: string;
  profile?: OperatorProfileDto;
  userStatus?: 'active' | 'pending' | 'suspended';
  lastLoginAt?: string;
}

function sessionKeyFor(session: TenantRacetrackContext): string {
  return `${session.tenantId}:${session.racetrackId}:${session.role}`;
}

function normalizeSession(parsed: Partial<SessionState>): SessionState {
  const rawRole = parsed.role ? String(parsed.role) : defaultTenantContext.role;
  const role: Role = normalizeRole(rawRole) ?? (isRole(rawRole) ? rawRole : defaultTenantContext.role);
  const assignedRoles = Array.isArray(parsed.assignedRoles)
    ? parsed.assignedRoles.filter((r): r is Role => isRole(String(r)))
    : [role];
  return {
    ...defaultTenantContext,
    ...parsed,
    role,
    tenantId: typeof parsed.tenantId === 'string' ? parsed.tenantId : defaultTenantContext.tenantId,
    racetrackId: typeof parsed.racetrackId === 'string' ? parsed.racetrackId : defaultTenantContext.racetrackId,
    organizationId: typeof parsed.organizationId === 'string' ? parsed.organizationId : defaultTenantContext.organizationId,
    auditMode: parsed.auditMode === 'read-only' || parsed.auditMode === 'write-through' ? parsed.auditMode : defaultTenantContext.auditMode,
    scopeSource: typeof parsed.scopeSource === 'string' ? parsed.scopeSource : defaultTenantContext.scopeSource,
    userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
    displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
    email: typeof parsed.email === 'string' ? parsed.email : undefined,
    assignedRoles,
    bearerToken: typeof parsed.bearerToken === 'string' ? parsed.bearerToken : undefined,
    issuedAt: typeof parsed.issuedAt === 'string' ? parsed.issuedAt : undefined,
    expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined,
    authProvider: typeof parsed.authProvider === 'string' ? parsed.authProvider : undefined,
    profile: parsed.profile && typeof parsed.profile === 'object' ? parsed.profile as OperatorProfileDto : undefined,
    userStatus: parsed.userStatus === 'active' || parsed.userStatus === 'pending' || parsed.userStatus === 'suspended'
      ? parsed.userStatus
      : undefined,
    lastLoginAt: typeof parsed.lastLoginAt === 'string' ? parsed.lastLoginAt : undefined,
    authenticated: Boolean(parsed.authenticated ?? parsed.bearerToken ?? (demoAccessEnabled() && !parsed.bearerToken)),
    sessionKey: sessionKeyFor({ ...defaultTenantContext, ...parsed, role }),
  };
}

/** Header-role demo session for walkthroughs without Entra login. */
export function createDemoBypassSession(role: Role = defaultTenantContext.role): SessionState {
  return normalizeSession({
    ...defaultTenantContext,
    role,
    userId: 'user-admin-1',
    displayName: 'Demo Operator',
    email: 'demo@trackmind.local',
    assignedRoles: [...assignableRoles],
    authenticated: true,
    bearerToken: undefined,
    authProvider: 'demo-bypass',
    scopeSource: 'demo-bypass',
  });
}

export function loadSession(): SessionState {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      if (demoAccessEnabled()) return createDemoBypassSession();
      return normalizeSession(defaultTenantContext);
    }
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    const session = normalizeSession(parsed);
    if (demoAccessEnabled() && !session.bearerToken) {
      return normalizeSession({ ...session, authenticated: true, assignedRoles: [...assignableRoles], authProvider: 'demo-bypass' });
    }
    return session;
  } catch {
    if (demoAccessEnabled()) return createDemoBypassSession();
    return normalizeSession(defaultTenantContext);
  }
}

export function persistSession(session: SessionState): void {
  sessionStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearPersistedSession(): void {
  sessionStorage.removeItem(storageKey);
}

let currentSession = loadSession();

export function getTenantContext(): TenantRacetrackContext {
  return currentSession;
}

export function getBearerToken(): string | undefined {
  return currentSession.bearerToken;
}

export function setCurrentSession(session: SessionState): void {
  currentSession = session;
}

export type SessionScopeUpdate = Partial<Pick<TenantRacetrackContext, 'tenantId' | 'racetrackId' | 'organizationId'>>;

export function applyRole(session: SessionState, role: Role): SessionState {
  return normalizeSession({ ...session, role });
}

export function applyScope(session: SessionState, scope: SessionScopeUpdate): SessionState {
  return normalizeSession({ ...session, ...scope });
}

export function applyOperatorSession(
  session: SessionState,
  operator: Pick<
    OperatorSessionDto,
  'userId' | 'displayName' | 'email' | 'tenantId' | 'organizationId' | 'assignedRoles' | 'activeRole' | 'sessionId' | 'issuedAt' | 'expiresAt' | 'authProvider' | 'profile'
  > & {
    sessionId: string;
    activeRole: Role;
    assignedRoles: Role[];
    userStatus?: SessionState['userStatus'];
    lastLoginAt?: string;
  },
): SessionState {
  return normalizeSession({
    ...session,
    userId: operator.userId,
    displayName: operator.displayName,
    email: operator.email,
    tenantId: operator.tenantId,
    organizationId: operator.organizationId,
    assignedRoles: operator.assignedRoles,
    role: operator.activeRole,
    bearerToken: operator.sessionId,
    authenticated: true,
    issuedAt: operator.issuedAt,
    expiresAt: operator.expiresAt,
    authProvider: operator.authProvider,
    profile: operator.profile,
    userStatus: operator.userStatus,
    lastLoginAt: operator.lastLoginAt,
    scopeSource: 'platform-session',
  });
}

export function clearOperatorSession(): SessionState {
  const session = demoAccessEnabled()
    ? createDemoBypassSession()
    : normalizeSession({ ...defaultTenantContext, authenticated: false, bearerToken: undefined });
  currentSession = session;
  if (demoAccessEnabled()) persistSession(session);
  else clearPersistedSession();
  return session;
}

export function isDemoSession(session: SessionState): boolean {
  return session.authProvider === 'demo-bypass' || (demoAccessEnabled() && !session.bearerToken);
}

export function isSignedInSession(session: SessionState): boolean {
  return Boolean(session.bearerToken && session.authenticated);
}
