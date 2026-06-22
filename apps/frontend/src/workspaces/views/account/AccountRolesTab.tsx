import { assignableRoles, roleRegistry, type Role } from '@trackmind/shared';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createAccessRequest, listMyAccessRequests } from '@/api/identityApi';
import { isSignedInSession, type SessionState } from '@/auth/session';
import type { AccessRequestDto } from '@trackmind/shared';
import { AssignedRolePicker } from '@/auth/AssignedRolePicker';
import { roleDisplayName } from '@/domain/support';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { SectionPanel } from '@/design/components/section-panel';
import { RecordTable } from '@/design/components/record-table';

export function AccountRolesTab({
  session,
  sessionRole,
  assignedRoles,
  resonance,
}: {
  session: SessionState;
  sessionRole: Role;
  assignedRoles: Role[];
  resonance: {
    scope: string;
    category: string;
    viewerRoutes: string[];
    kpiDomains: string[];
    auditRead: boolean;
    auditExport: boolean;
    privacyScopes: string[];
  };
}): ReactElement {
  const [requests, setRequests] = useState<AccessRequestDto[]>([]);
  const [requestedRole, setRequestedRole] = useState('');
  const [justification, setJustification] = useState('');
  const [message, setMessage] = useState<string | undefined>();

  const requestableRoles = useMemo(
    () => assignableRoles.filter((role) => roleRegistry[role]?.assignable && !assignedRoles.includes(role)),
    [assignedRoles],
  );

  const signedIn = isSignedInSession(session);

  useEffect(() => {
    if (!signedIn) return;
    void listMyAccessRequests().then((result) => {
      if (result.status === 'ready' && Array.isArray(result.data)) setRequests(result.data);
    });
  }, [signedIn]);

  async function submitRequest() {
    if (!requestedRole) return;
    const result = await createAccessRequest(requestedRole, justification);
    if (result.status === 'ready' && result.data) {
      setRequests((prev) => [result.data!, ...prev]);
      setMessage('Access request submitted for governance review.');
      setJustification('');
      setRequestedRole('');
      return;
    }
    setMessage(result.message ?? 'Unable to submit access request.');
  }

  return (
    <div className="space-y-4">
      <SectionPanel title="Active persona" description="Switch among roles assigned to your operator profile.">
        <AssignedRolePicker />
        <p className="mt-3 text-sm">Current: <strong>{roleDisplayName(sessionRole)}</strong></p>
        <div className="mt-3 flex flex-wrap gap-2">
          {assignedRoles.map((role) => (
            <Badge key={role} variant={role === sessionRole ? 'default' : 'outline'}>{roleDisplayName(role)}</Badge>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="My roles & access" description={`Resonance for ${roleDisplayName(sessionRole)}`}>
        <ul className="space-y-1 text-sm">
          <li>Scope: {resonance.scope}</li>
          <li>Category: {resonance.category}</li>
          <li>Visible consoles: {resonance.viewerRoutes.join(', ')}</li>
          <li>KPI domains: {resonance.kpiDomains.join(', ') || 'none'}</li>
          <li>Audit read: {resonance.auditRead ? 'yes' : 'no'} · export: {resonance.auditExport ? 'yes' : 'no'}</li>
          <li>Privacy scopes: {resonance.privacyScopes.join(', ') || 'none'}</li>
        </ul>
      </SectionPanel>

      <SectionPanel title="Request access" description="Submit a persona elevation request for compliance review.">
        {!signedIn ? (
          <p className="text-sm text-[var(--muted-foreground)]">Sign in with your organization account to submit access requests.</p>
        ) : (
        <div className="grid gap-3 max-w-lg">
          <label className="grid gap-1 text-sm">
            <span>Requested persona</span>
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              value={requestedRole}
              onChange={(e) => setRequestedRole(e.target.value)}
            >
              <option value="">Select role…</option>
              {requestableRoles.map((role) => (
                <option key={role} value={role}>{roleDisplayName(role)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Business justification</span>
            <textarea
              className="min-h-[5rem] rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why do you need this persona for your duties?"
            />
          </label>
          <Button size="sm" className="w-fit" disabled={!requestedRole} onClick={() => void submitRequest()}>
            Submit access request
          </Button>
          {message ? <p className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
        </div>
        )}
      </SectionPanel>

      <SectionPanel title="My access requests">
        <RecordTable
          columns={[
            { key: 'requestedRole', label: 'Role' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Submitted' },
          ]}
          rows={requests.slice(0, 12).map((row) => ({
            requestedRole: roleDisplayName(row.requestedRole as Role),
            status: String(row.status),
            createdAt: new Date(row.createdAt).toLocaleString(),
          }))}
          emptyLabel="No access requests yet."
        />
      </SectionPanel>
    </div>
  );
}
