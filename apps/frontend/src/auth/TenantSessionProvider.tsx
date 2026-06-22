import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { OperatorSessionDto, Role } from '@trackmind/shared';
import { isRole } from '@trackmind/shared';
import { fetchPlatformSession, patchPlatformActiveRole, revokePlatformSession } from '@/api/sessionApi';
import { demoAccessEnabled, logoutEntra } from '@/auth/entraAuth';
import {
  applyOperatorSession,
  applyRole,
  applyScope,
  clearOperatorSession,
  createDemoBypassSession,
  loadSession,
  persistSession,
  setCurrentSession,
  type SessionScopeUpdate,
  type SessionState,
} from './session';

function operatorToSessionState(base: SessionState, operator: OperatorSessionDto): SessionState {
  const activeRole = isRole(operator.activeRole)
    ? operator.activeRole
    : operator.assignedRoles.find((role): role is Role => isRole(role));
  if (!activeRole) return base;
  return applyOperatorSession(base, {
    userId: operator.userId,
    displayName: operator.displayName,
    email: operator.email,
    tenantId: operator.tenantId,
    organizationId: operator.organizationId,
    assignedRoles: operator.assignedRoles.filter((role): role is Role => isRole(role)),
    activeRole,
    sessionId: operator.sessionId,
    issuedAt: operator.issuedAt,
    expiresAt: operator.expiresAt,
    authProvider: operator.authProvider,
    profile: operator.profile,
  });
}

interface SessionContextValue {
  session: SessionState;
  authReady: boolean;
  setRole: (role: Role) => void;
  setScope: (scope: SessionScopeUpdate) => void;
  hydrateFromOperatorSession: (session: SessionState) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function TenantSessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [session, setSession] = useState<SessionState>(() => loadSession());
  const [authReady, setAuthReady] = useState(false);

  const hydrateFromOperatorSession = useCallback((next: SessionState) => {
    setCurrentSession(next);
    persistSession(next);
    setSession(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (demoAccessEnabled() && !session.bearerToken) {
        const demoSession = createDemoBypassSession(session.role);
        hydrateFromOperatorSession(demoSession);
        if (!cancelled) setAuthReady(true);
        return;
      }
      if (!session.bearerToken) {
        if (!cancelled) setAuthReady(true);
        return;
      }
      const result = await fetchPlatformSession();
      if (cancelled) return;
      if (result.status === 'ready' && result.data) {
        hydrateFromOperatorSession(operatorToSessionState(session, result.data));
      } else {
        hydrateFromOperatorSession(clearOperatorSession());
      }
      setAuthReady(true);
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    authReady,
    hydrateFromOperatorSession,
    setRole: (role) => {
      const assigned = session.assignedRoles ?? [session.role];
      if (!assigned.includes(role)) return;
      if (demoAccessEnabled() && !session.bearerToken) {
        setSession((prev) => {
          const next = applyRole(prev, role);
          setCurrentSession(next);
          persistSession(next);
          return next;
        });
        return;
      }
      void patchPlatformActiveRole(role).then((result) => {
        if (result.status === 'ready' && result.data) {
          const operator = result.data;
          const activeRole = isRole(operator.activeRole) ? operator.activeRole : role;
          hydrateFromOperatorSession(operatorToSessionState(session, { ...operator, activeRole }));
          return;
        }
        setSession((prev) => {
          const next = applyRole(prev, role);
          setCurrentSession(next);
          persistSession(next);
          return next;
        });
      });
    },
    setScope: (scope) => {
      setSession((prev) => {
        const next = applyScope(prev, scope);
        setCurrentSession(next);
        persistSession(next);
        return next;
      });
    },
    logout: async () => {
      if (session.authProvider === 'entra') {
        try {
          await logoutEntra();
        } catch {
          /* MSAL popup may be blocked; platform session still revoked */
        }
      }
      if (session.bearerToken) await revokePlatformSession();
      hydrateFromOperatorSession(clearOperatorSession());
      if (demoAccessEnabled()) {
        window.location.assign('/dashboard');
      } else {
        window.location.assign('/login');
      }
    },
  }), [authReady, hydrateFromOperatorSession, session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useTenantSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  const [localSession, setLocalSession] = useState<SessionState>(() => loadSession());
  const [authReady, setAuthReady] = useState(true);

  const fallback = useMemo<SessionContextValue>(() => ({
    session: localSession,
    authReady,
    hydrateFromOperatorSession: (next) => {
      setLocalSession(next);
      setCurrentSession(next);
      persistSession(next);
    },
    setRole: (role) => {
      setLocalSession((prev) => {
        const next = applyRole(prev, role);
        setCurrentSession(next);
        persistSession(next);
        return next;
      });
    },
    setScope: (scope) => {
      setLocalSession((prev) => {
        const next = applyScope(prev, scope);
        setCurrentSession(next);
        persistSession(next);
        return next;
      });
    },
    logout: async () => {
      const cleared = clearOperatorSession();
      setLocalSession(cleared);
    },
  }), [authReady, localSession]);

  return ctx ?? fallback;
}
