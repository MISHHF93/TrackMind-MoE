import { isRole, type Role } from '@trackmind/shared';
import { useState, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPlatformSession } from '@/api/sessionApi';
import { applyOperatorSession, clearOperatorSession } from '@/auth/session';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { demoAccessEnabled, devHeaderRoleEnabled, entraAuthEnabled, loginWithEntra } from '@/auth/entraAuth';
import { Button } from '@/design/components/button';
import { FloatingLogo } from '@/design/components/FloatingLogo';

const devPersonas: Array<{ userId: string; label: string }> = [
  { userId: 'user-steward-1', label: 'Chief Steward' },
  { userId: 'user-vet-1', label: 'Track Veterinarian' },
  { userId: 'user-race-day-1', label: 'Race Day Manager' },
  { userId: 'user-facilities-1', label: 'Facilities Manager' },
  { userId: 'user-finance-1', label: 'Finance Manager' },
  { userId: 'user-auditor-1', label: 'Read-Only Auditor' },
  { userId: 'user-admin-1', label: 'Platform Super Admin' },
];

export function LoginPage(): ReactElement {
  const { hydrateFromOperatorSession } = useTenantSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  async function completeLogin(result: Awaited<ReturnType<typeof createPlatformSession>>) {
    if (result.status !== 'ready' || !result.data) {
      setError(result.message ?? 'Unable to establish platform session');
      return;
    }
    const operator = result.data;
    const activeRole = isRole(operator.activeRole)
      ? operator.activeRole
      : operator.assignedRoles.find((r): r is Role => isRole(r));
    if (!activeRole) {
      setError('Session did not include a valid active role');
      return;
    }
    const session = applyOperatorSession(clearOperatorSession(), {
      userId: operator.userId,
      displayName: operator.displayName,
      email: operator.email,
      tenantId: operator.tenantId,
      organizationId: operator.organizationId,
      assignedRoles: operator.assignedRoles.filter((r): r is Role => isRole(r)),
      activeRole,
      sessionId: operator.sessionId,
      issuedAt: operator.issuedAt,
      expiresAt: operator.expiresAt,
      authProvider: operator.authProvider,
      profile: operator.profile,
    });
    hydrateFromOperatorSession(session);
    navigate(redirectTo, { replace: true });
  }

  async function handleEntraSignIn() {
    setLoading(true);
    setError(undefined);
    try {
      const entraResult = await loginWithEntra();
      if (!entraResult?.accessToken) {
        setError('Entra sign-in did not return an access token');
        return;
      }
      await completeLogin(await createPlatformSession({ accessToken: entraResult.accessToken }));
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Entra sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin(userId: string) {
    setLoading(true);
    setError(undefined);
    try {
      await completeLogin(await createPlatformSession({ userId, tenantId: 'trackmind' }));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Dev login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside className="hidden w-[42%] flex-col justify-between border-r border-[var(--border)] bg-[var(--brand-navy)] p-10 text-white lg:flex">
        <div>
          <FloatingLogo size="xl" className="mb-8" />
          <p className="text-sm uppercase tracking-[0.2em] text-white/70">TrackMind Racetrack</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight">Horse racing operations, governed by persona.</h1>
          <p className="mt-4 max-w-md text-sm text-white/80">
            Sign in with your organization identity. Assigned personas control which consoles, approvals, and KPIs resonate for your shift.
          </p>
        </div>
        <p className="text-xs text-white/60">Demo walkthroughs can continue without sign-in when demo mode is enabled.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="mb-6 flex justify-center lg:hidden">
            <FloatingLogo size="lg" />
          </div>
          <h2 className="text-xl font-semibold">Operator sign-in</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Authenticate to open a platform session with security and profile controls.
          </p>

          {loading ? (
            <div className="mt-6 space-y-2" aria-live="polite">
              <div className="h-10 animate-pulse rounded-md bg-[var(--muted)]" />
              <p className="text-sm text-[var(--muted-foreground)]">Establishing platform session…</p>
            </div>
          ) : null}

          {!loading && entraAuthEnabled() ? (
            <Button className="mt-6 w-full" onClick={() => void handleEntraSignIn()}>
              Sign in with Microsoft Entra
            </Button>
          ) : null}

          {!loading && devHeaderRoleEnabled() ? (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Development personas</p>
              {devPersonas.map((persona) => (
                <Button
                  key={persona.userId}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => void handleDevLogin(persona.userId)}
                >
                  {persona.label}
                </Button>
              ))}
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          {demoAccessEnabled() ? (
            <Button className="mt-6 w-full" variant="secondary" asChild>
              <Link to="/dashboard">Continue in demo mode</Link>
            </Button>
          ) : null}

          <p className="mt-6 text-xs text-[var(--muted-foreground)]">
            After sign-in, manage personas, notifications, and security from My Profile.
          </p>
        </div>
      </main>
    </div>
  );
}
