import type { ReactElement } from 'react';
import { Search } from 'lucide-react';
import { AssignedRolePicker } from '@/auth/AssignedRolePicker';
import { demoAccessEnabled } from '@/auth/entraAuth';
import { OperatorIdentityMenu } from '@/auth/OperatorIdentityMenu';
import { isDemoSession, isSignedInSession } from '@/auth/session';
import { TenantRacetrackScopePicker } from '@/auth/TenantRacetrackScopePicker';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { roleDisplayName } from '@/domain/support';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { PostureBadge } from '@/design/components/badge';
import type { OpsPosture } from '@/design/components/workspace';
import { NotificationCenter } from './NotificationCenter';

export function CommandBar({
  posture,
  postureLabel,
  searchQuery,
  onSearchChange,
  onOpenPalette,
}: {
  posture: OpsPosture;
  postureLabel: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenPalette: () => void;
}): ReactElement {
  const { session } = useTenantSession();
  const { category } = useRoleWorkspace();

  return (
    <header className="sticky top-0 z-30 shell-chrome border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <PostureBadge posture={posture} label={postureLabel} onChrome />
          <div className="hidden md:flex text-xs gap-2">
            {demoAccessEnabled() ? <span className="scope-chip">Demo mode</span> : null}
            {isSignedInSession(session) ? <span className="scope-chip">Signed in</span> : null}
            {isDemoSession(session) ? <span className="scope-chip">Demo operator</span> : null}
            <span className="scope-chip">Role <strong>{roleDisplayName(session.role)}</strong></span>
            <span className="scope-chip capitalize">{category.replace('-', ' ')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 md:flex-none md:min-w-[18rem]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-panel)] py-2 pl-9 pr-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="Search horses, incidents, consoles (Cmd+K)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={onOpenPalette}
            />
          </div>
          <NotificationCenter />
          <TenantRacetrackScopePicker />
          <OperatorIdentityMenu />
          <AssignedRolePicker />
        </div>
      </div>
    </header>
  );
}
