import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  Database,
  Gauge,
  Globe2,
  HeartPulse,
  LayoutDashboard,
  Layers,
  Settings,
  Shield,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  Video,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRoute } from '@/routes/routes';
import { OperatorAvatar } from '@/auth/OperatorAvatar';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { roleDisplayName } from '@/domain/support';
import { Button } from '@/design/components/button';
import { FloatingLogo } from '@/design/components/FloatingLogo';
import { cn } from '@/lib/utils';

const iconMap: Record<string, LucideIcon> = {
  'command-center': LayoutDashboard,
  'race-day': Gauge,
  horse: HeartPulse,
  steward: ClipboardCheck,
  surface: Layers,
  approval: ClipboardCheck,
  incident: AlertTriangle,
  emergency: AlertTriangle,
  compliance: Shield,
  security: Shield,
  facility: Building2,
  workforce: Users,
  twin: Waypoints,
  ticket: Ticket,
  finance: BarChart3,
  federation: Globe2,
  'data-hub': Database,
  audit: Activity,
  admin: Activity,
  cctv: Video,
  analytics: TrendingUp,
  fan: Sparkles,
  notifications: Bell,
  account: Users,
  settings: Settings,
};

export function routeIcon(iconKey: string): LucideIcon {
  return iconMap[iconKey] ?? LayoutDashboard;
}

export function Sidebar({
  groups,
  activePath,
  onNavigate,
}: {
  groups: Array<{ group: string; routes: Array<AppRoute & { supportLabel: string }> }>;
  activePath?: string;
  onNavigate: (path: string) => void;
}): React.ReactElement {
  const { session, logout } = useTenantSession();

  return (
    <aside className="shell-sidebar">
      <div className="flex items-center gap-3 border-b border-[var(--border-chrome)] px-4 py-4">
        <FloatingLogo size="sm" />
        <div>
          <p className="font-semibold leading-tight text-[var(--text-on-chrome)]">TrackMind Racetrack</p>
          <p className="text-xs text-[var(--text-on-chrome-muted)]">Horse Racing Operations</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Operating consoles">
        {groups.map(({ group, routes: groupRoutes }) => (
          <div key={group}>
            <p className="px-2 pb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-on-chrome-muted)]">{group}</p>
            <ul className="space-y-1">
              {groupRoutes.map((route) => {
                const Icon = routeIcon(route.iconKey);
                const active = activePath === route.path;
                return (
                  <li key={route.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(route.path)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                        active ? 'nav-item-active' : 'nav-item-idle text-[var(--text-on-chrome)]',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{route.label}</span>
                      <span className="text-[0.62rem] text-[var(--text-on-chrome-muted)]">
                        {route.supportLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <footer className="border-t border-[var(--border-chrome)] px-4 py-3">
        <div className="flex items-center gap-2">
          <OperatorAvatar displayName={session.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-on-chrome)]">{session.displayName ?? 'Operator'}</p>
            <p className="truncate text-xs text-[var(--text-on-chrome-muted)]">{roleDisplayName(session.role)}</p>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" asChild>
            <Link to="/account">My Profile</Link>
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </footer>
    </aside>
  );
}
