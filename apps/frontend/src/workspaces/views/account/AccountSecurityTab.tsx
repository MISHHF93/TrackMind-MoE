import type { OperatorSessionSummaryDto } from '@trackmind/shared';
import { useEffect, useState, type ReactElement } from 'react';
import { listOperatorSessions, revokeOperatorSessionById, revokeOtherOperatorSessions } from '@/api/identityApi';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { isSignedInSession } from '@/auth/session';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';

export function AccountSecurityTab(): ReactElement {
  const { session, logout } = useTenantSession();
  const [sessions, setSessions] = useState<OperatorSessionSummaryDto[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const signedIn = isSignedInSession(session);

  async function refreshSessions() {
    const result = await listOperatorSessions();
    if (result.status === 'ready' && Array.isArray(result.data)) setSessions(result.data);
  }

  useEffect(() => {
    if (signedIn) void refreshSessions();
  }, [signedIn]);

  async function revokeSession(sessionId: string) {
    const result = await revokeOperatorSessionById(sessionId);
    setMessage(result.status === 'ready' ? result.data?.message : result.message ?? 'Unable to revoke session.');
    await refreshSessions();
  }

  async function revokeOthers() {
    const result = await revokeOtherOperatorSessions();
    setMessage(result.status === 'ready' ? result.data?.message : result.message ?? 'Unable to revoke other sessions.');
    await refreshSessions();
  }

  return (
    <div className="space-y-4">
      <SectionPanel title="Authentication" description="Credentials and MFA are managed by Microsoft Entra ID for organization sign-in. TrackMind stores platform session tokens only.">
        <p className="text-sm text-[var(--muted-foreground)]">
          Password changes, multi-factor enrollment, and conditional access policies are handled in your organization identity portal — not inside TrackMind.
        </p>
      </SectionPanel>

      {signedIn ? (
        <>
          <SectionPanel title="Current session">
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-[var(--muted-foreground)]">Session</dt><dd className="font-mono text-xs">{session.bearerToken}</dd></div>
              <div><dt className="text-[var(--muted-foreground)]">Provider</dt><dd>{session.authProvider}</dd></div>
              {session.issuedAt ? <div><dt className="text-[var(--muted-foreground)]">Issued</dt><dd>{new Date(session.issuedAt).toLocaleString()}</dd></div> : null}
              {session.expiresAt ? <div><dt className="text-[var(--muted-foreground)]">Expires</dt><dd>{new Date(session.expiresAt).toLocaleString()}</dd></div> : null}
            </dl>
          </SectionPanel>

          <SectionPanel title="Active sessions">
            <RecordTable
              columns={[
                { key: 'client', label: 'Client' },
                { key: 'provider', label: 'Provider' },
                { key: 'expires', label: 'Expires' },
                { key: 'current', label: 'Current' },
              ]}
              rows={mapRecords(sessions, (row) => ({
                client: row.clientHint ?? 'Web browser',
                provider: row.authProvider,
                expires: new Date(row.expiresAt).toLocaleString(),
                current: row.current ? 'Yes' : 'No',
              }))}
              emptyLabel="No active sessions returned."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {sessions.filter((row) => !row.current).map((row) => (
                <Button key={row.sessionId} size="sm" variant="outline" onClick={() => void revokeSession(row.sessionId)}>
                  Revoke {row.clientHint ?? 'session'}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => void revokeOthers()}>Sign out all other devices</Button>
            </div>
          </SectionPanel>
        </>
      ) : (
        <SectionPanel title="Demo session" description="You are using a local demo operator profile without a platform bearer session.">
          <p className="text-sm text-[var(--muted-foreground)]">Sign in with your organization account to manage active sessions.</p>
        </SectionPanel>
      )}

      <SectionPanel title="Sign out">
        <Button variant="outline" size="sm" onClick={() => void logout()}>Sign out of TrackMind</Button>
        {message ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{message}</p> : null}
      </SectionPanel>
    </div>
  );
}
