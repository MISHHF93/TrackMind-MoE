import type { Role, TenantRacetrackContext } from '@trackmind/shared';
import { isRole, normalizeRole } from '@trackmind/shared';
import { defaultTenantContext } from '@/domain/support';

const storageKey = 'trackmind-operator-session';

export interface SessionState extends TenantRacetrackContext {
  sessionKey: string;
}

function sessionKeyFor(session: TenantRacetrackContext): string {
  return `${session.tenantId}:${session.racetrackId}:${session.role}`;
}

function normalizeSession(parsed: Partial<TenantRacetrackContext>): TenantRacetrackContext {
  const rawRole = parsed.role ? String(parsed.role) : defaultTenantContext.role;
  const role: Role = normalizeRole(rawRole) ?? (isRole(rawRole) ? rawRole : defaultTenantContext.role);
  return {
    ...defaultTenantContext,
    ...parsed,
    role,
    tenantId: typeof parsed.tenantId === 'string' ? parsed.tenantId : defaultTenantContext.tenantId,
    racetrackId: typeof parsed.racetrackId === 'string' ? parsed.racetrackId : defaultTenantContext.racetrackId,
    organizationId: typeof parsed.organizationId === 'string' ? parsed.organizationId : defaultTenantContext.organizationId,
    auditMode: parsed.auditMode === 'read-only' || parsed.auditMode === 'write-through' ? parsed.auditMode : defaultTenantContext.auditMode,
    scopeSource: typeof parsed.scopeSource === 'string' ? parsed.scopeSource : defaultTenantContext.scopeSource,
  };
}

export function loadSession(): SessionState {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      const session = defaultTenantContext;
      return { ...session, sessionKey: sessionKeyFor(session) };
    }
    const parsed = JSON.parse(raw) as Partial<TenantRacetrackContext>;
    const session = normalizeSession(parsed);
    return { ...session, sessionKey: sessionKeyFor(session) };
  } catch {
    const session = defaultTenantContext;
    return { ...session, sessionKey: sessionKeyFor(session) };
  }
}

export function persistSession(session: TenantRacetrackContext): void {
  sessionStorage.setItem(storageKey, JSON.stringify(session));
}

let currentSession = loadSession();

export function getTenantContext(): TenantRacetrackContext {
  return currentSession;
}

export function setCurrentSession(session: SessionState): void {
  currentSession = session;
}

export type SessionScopeUpdate = Partial<Pick<TenantRacetrackContext, 'tenantId' | 'racetrackId' | 'organizationId'>>;

export function applyRole(session: SessionState, role: Role): SessionState {
  return { ...session, role, sessionKey: sessionKeyFor({ ...session, role }) };
}

export function applyScope(session: SessionState, scope: SessionScopeUpdate): SessionState {
  const next = { ...session, ...scope };
  return { ...next, sessionKey: sessionKeyFor(next) };
}
