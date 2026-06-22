import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { demoAccessEnabled } from '@/auth/entraAuth';
import { OperatorAvatar } from '@/auth/OperatorAvatar';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { isDemoSession, isSignedInSession } from '@/auth/session';
import { roleDisplayName } from '@/domain/support';
import { Button } from '@/design/components/button';

export function OperatorIdentityMenu(): ReactElement {
  const { session, logout } = useTenantSession();
  const demo = isDemoSession(session);
  const signedIn = isSignedInSession(session);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2 pl-1.5 pr-2">
          <OperatorAvatar displayName={session.displayName} size="sm" />
          <span className="hidden max-w-[8rem] truncate md:inline">{session.displayName ?? 'Operator'}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[14rem] rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg" align="end">
          <DropdownMenu.Label className="px-2 py-2">
            <p className="text-sm font-medium">{session.displayName ?? 'Operator'}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{session.email ?? '—'}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{roleDisplayName(session.role)}</p>
            {demo ? <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[var(--brand-blue)]">Demo workspace</p> : null}
            {signedIn ? <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[var(--status-nominal)]">Signed in</p> : null}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item asChild className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)]">
            <Link to="/account" className="flex items-center gap-2"><UserRound className="h-4 w-4" /> My Profile</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)]">
            <Link to="/account?tab=preferences" className="flex items-center gap-2"><Settings className="h-4 w-4" /> Preferences</Link>
          </DropdownMenu.Item>
          {demo && demoAccessEnabled() ? (
            <DropdownMenu.Item asChild className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-[var(--muted)]">
              <Link to="/login">Sign in with organization account</Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item
            className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-[var(--status-critical)] outline-none hover:bg-[var(--muted)]"
            onSelect={() => void logout()}
          >
            <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
