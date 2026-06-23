import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { backendSupportLabels } from '@/domain/support';
import { RouteAccessSync } from '@/auth/RouteAccessSync';
import { SessionExpiryBanner } from '@/auth/SessionExpiryBanner';
import { useAccessibleRoutes } from '@/hooks/useAccessibleRoutes';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { routes, type AppRoute } from '@/routes/routes';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { useWorkspaceContext } from '@/hooks/useWorkspaceContext';
import { useEventStream } from '@/hooks/useEventStream';
import { applyTheme } from '@/lib/theme';
import { Sidebar } from './Sidebar';
import { CommandBar } from './CommandBar';
import { ActionDock } from './ActionDock';
import { LiveStatusBar } from './LiveStatusBar';
import { CommandPalette } from './CommandPalette';
import { MoEChatPanel } from '@/features/assistant/MoEChatPanel';

export function AppShell(): ReactElement {
  const { session } = useTenantSession();
  const { posture, postureLabel, primaryActions } = useWorkspaceContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { status, lastHeartbeat } = useEventStream();
  const { routes: visibleRoutes } = useAccessibleRoutes(routes);
  const { navigationGroupOrder } = useRoleWorkspace();

  const navigationOrder = useMemo(
    () => navigationGroupOrder,
    [navigationGroupOrder],
  );

  const visibleRoutesList = visibleRoutes;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchableRoutes = normalizedSearch
    ? visibleRoutesList.filter((route) => routeSearchText(route).includes(normalizedSearch))
    : visibleRoutesList;

  const groupedRoutes = useMemo(
    () =>
      navigationOrder
        .map((group) => ({
          group,
          routes: searchableRoutes
            .filter((route) => !('navigationHidden' in route && route.navigationHidden))
            .filter((route) => route.navigationGroup === group)
            .map((route) => ({ ...route, supportLabel: backendSupportLabels[route.supportStatus] })),
        }))
        .filter((entry) => entry.routes.length > 0),
    [navigationOrder, searchableRoutes],
  );

  useEffect(() => {
    applyTheme('light');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <RouteAccessSync />
      <SessionExpiryBanner />
      <Sidebar groups={groupedRoutes} activePath={location.pathname} onNavigate={navigate} />
      <div className="shell-body">
        <CommandBar
          posture={posture}
          postureLabel={postureLabel}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="shell-main">
          <Outlet />
        </main>
        <ActionDock actions={primaryActions} />
        <LiveStatusBar status={status} lastHeartbeat={lastHeartbeat} />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} routes={visibleRoutesList} onNavigate={navigate} initialQuery={searchQuery} role={session.role} />
      <MoEChatPanel />
    </div>
  );
}

function routeSearchText(route: AppRoute): string {
  return `${route.label} ${route.path} ${route.navigationGroup} ${route.dataSource}`.toLowerCase();
}
