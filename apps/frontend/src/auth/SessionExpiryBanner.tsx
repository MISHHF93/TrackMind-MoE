import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { isSignedInSession } from '@/auth/session';
import { Button } from '@/design/components/button';

const WARNING_MS = 15 * 60 * 1000;

export function SessionExpiryBanner(): ReactElement | null {
  const { session } = useTenantSession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresSoon = useMemo(() => {
    if (!isSignedInSession(session) || !session.expiresAt) return false;
    const expiresAt = new Date(session.expiresAt).getTime();
    return expiresAt - now <= WARNING_MS && expiresAt > now;
  }, [now, session]);

  if (!expiresSoon) return null;

  return (
    <div className="border-b border-[var(--status-warning)] bg-[color-mix(in_srgb,var(--status-warning)_12%,var(--card))] px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-[var(--page-max-width)] flex-wrap items-center justify-between gap-2">
        <span>Your platform session expires soon. Re-authenticate to avoid interruption.</span>
        <Button size="sm" variant="outline" asChild>
          <Link to="/login">Re-authenticate</Link>
        </Button>
      </div>
    </div>
  );
}
