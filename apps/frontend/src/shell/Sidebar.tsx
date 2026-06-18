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
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRoute } from '@/routes/routes';
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
  analytics: TrendingUp,
  fan: Sparkles,
  notifications: Bell,
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
  return (
    <aside className="shell-sidebar">
      <div className="flex items-center gap-3 border-b border-[var(--border-chrome)] px-4 py-4">
        <div className="brand-mark" aria-hidden>TM</div>
        <div>
          <p className="font-semibold leading-tight text-[var(--text-on-chrome)]">TrackMind Nexus</p>
          <p className="text-xs text-[var(--text-on-chrome-muted)]">Race Day Operations</p>
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
                      <span className="text-[0.62rem] text-[var(--text-on-chrome-muted)]">{route.supportStatus === 'live-api' ? 'live' : 'ref'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <footer className="border-t border-[var(--border-chrome)] px-4 py-3 text-xs text-[var(--text-on-chrome-muted)]">Steward control surface</footer>
    </aside>
  );
}
