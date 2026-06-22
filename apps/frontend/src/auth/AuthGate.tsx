import type { ReactElement, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { demoAccessEnabled } from '@/auth/entraAuth';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { FloatingLogo } from '@/design/components/FloatingLogo';

export function AuthGate({ children }: { children: ReactNode }): ReactElement {
  const { session, authReady } = useTenantSession();
  const location = useLocation();
  const demoAccess = demoAccessEnabled();

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background)]">
        <FloatingLogo size="xl" />
        <p className="text-sm text-[var(--muted-foreground)]">Restoring operator session…</p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--muted)]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--primary)]" />
        </div>
      </div>
    );
  }

  if (!demoAccess && !session.authenticated && !session.bearerToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
