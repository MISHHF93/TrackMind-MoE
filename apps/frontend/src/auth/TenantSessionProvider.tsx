import { createContext, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { Role } from '@trackmind/shared';
import {
  applyRole,
  applyScope,
  loadSession,
  persistSession,
  setCurrentSession,
  type SessionScopeUpdate,
  type SessionState,
} from './session';

interface SessionContextValue {
  session: SessionState;
  setRole: (role: Role) => void;
  setScope: (scope: SessionScopeUpdate) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function TenantSessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [session, setSession] = useState<SessionState>(() => loadSession());

  const value = useMemo<SessionContextValue>(() => ({
    session,
    setRole: (role) => {
      setSession((prev) => {
        const next = applyRole(prev, role);
        setCurrentSession(next);
        persistSession(next);
        return next;
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
  }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useTenantSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useTenantSession must be used within TenantSessionProvider');
  return ctx;
}
