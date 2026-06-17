import { useEffect, useState } from 'react';
import type { Role, TenantRacetrackContext } from '@trackmind/shared';

export const defaultTenantContext: TenantRacetrackContext = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  organizationId: 'org-trackmind-network',
  role: 'admin' satisfies Role,
  auditMode: 'read-only',
  scopeSource: 'operator-session',
};

type SessionListener = () => void;

let activeContext: TenantRacetrackContext = defaultTenantContext;
const listeners = new Set<SessionListener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getTenantContext(): TenantRacetrackContext {
  return activeContext;
}

export function subscribeTenantSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTenantSession(): TenantRacetrackContext {
  const [context, setContext] = useState(() => getTenantContext());
  useEffect(() => subscribeTenantSession(() => setContext(getTenantContext())), []);
  return context;
}
