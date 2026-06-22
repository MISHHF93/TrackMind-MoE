import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { OperatorAvatar } from '@/auth/OperatorAvatar';
import { demoAccessEnabled } from '@/auth/entraAuth';
import { isDemoSession, isSignedInSession, type SessionState } from '@/auth/session';
import { racetrackScopeLabel, tenantScopeLabel } from '@/domain/support';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { SectionPanel } from '@/design/components/section-panel';

function authProviderLabel(session: SessionState): string {
  if (isDemoSession(session)) return 'Demo bypass';
  if (session.authProvider === 'entra') return 'Microsoft Entra';
  if (session.authProvider === 'header-role') return 'Development session';
  return session.authProvider ?? 'Platform session';
}

export function AccountOverviewTab({ session }: { session: SessionState }): ReactElement {
  const demo = isDemoSession(session);
  const signedIn = isSignedInSession(session);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionPanel title="Operator profile">
        <div className="flex items-start gap-4">
          <OperatorAvatar displayName={session.displayName} size="lg" />
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold">{session.displayName ?? '—'}</p>
            <p className="text-[var(--muted-foreground)]">{session.email ?? '—'}</p>
            <div className="flex flex-wrap gap-2">
              {demo ? <Badge variant="outline">Demo operator</Badge> : null}
              {signedIn ? <Badge>Signed in</Badge> : null}
              {session.userStatus ? <Badge variant="outline">{session.userStatus}</Badge> : null}
              <Badge variant="outline">{authProviderLabel(session)}</Badge>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Organization context">
        <dl className="grid gap-2 text-sm">
          <div><dt className="text-[var(--muted-foreground)]">Organization</dt><dd>{session.organizationId}</dd></div>
          <div><dt className="text-[var(--muted-foreground)]">Tenant</dt><dd>{tenantScopeLabel(session.tenantId)}</dd></div>
          <div><dt className="text-[var(--muted-foreground)]">Racetrack scope</dt><dd>{racetrackScopeLabel(session.tenantId, session.racetrackId)}</dd></div>
          {session.lastLoginAt ? (
            <div><dt className="text-[var(--muted-foreground)]">Last login</dt><dd>{new Date(session.lastLoginAt).toLocaleString()}</dd></div>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Tenant and racetrack scope are selected in the command bar and stored locally for this browser session.
        </p>
      </SectionPanel>

      {demo && demoAccessEnabled() && !signedIn ? (
        <SectionPanel title="Organization sign-in" description="Use your organization identity for a full platform session with security controls.">
          <Button asChild size="sm">
            <Link to="/login">Sign in with organization account</Link>
          </Button>
        </SectionPanel>
      ) : null}
    </div>
  );
}
