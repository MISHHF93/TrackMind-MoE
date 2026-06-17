import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { backendSupportLabels, canViewRoute, regulatedActionNames, roleDisplayName, type NavigationGroup } from '../domain/support';
import { useTenantSession } from '../domain/useTenantSession';
import { useActiveConsole } from '../lib/activeConsole';
import { currentPathname, currentSearch, navigate } from '../routes/navigation';
import { defaultRoute, routeForPathname, routeById, routes, type AppRoute } from '../routes/routes';
import { Router } from '../routes/Router';
import { RenderErrorBoundary } from '../components/ui';
import { ActionDock, CommandBar, SidebarNavGroups } from '../design/components';
import { applyTheme, loadTheme, persistTheme, toggleThemeName, type ThemeName } from '../theme/theme';

const navigationOrder: NavigationGroup[] = ['Command', 'Race Operations', 'Safety & Facilities', 'Governance', 'Business Controls', 'Data Governance', 'System Status'];
const topbarShortcutRouteIds: AppRoute['id'][] = ['dashboard', 'raceDay', 'incidents', 'approvals'];

export function AppShell(): ReactElement {
  const tenantSession = useTenantSession();
  const activeConsole = useActiveConsole();
  const [activeRouteKey, setActiveRouteKey] = useState(() => `${currentPathname()}${currentSearch()}`);
  const activeRouteId = routeForPathname(currentPathname())?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<ThemeName>(() => loadTheme());
  const visibleRoutes = routes.filter((route) => canViewRoute(route, tenantSession.role));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchableRoutes = normalizedSearch ? visibleRoutes.filter((route) => routeSearchText(route).includes(normalizedSearch)) : visibleRoutes;
  const topbarShortcuts = topbarShortcutRouteIds.map((id) => routeById[id]).filter((route) => canViewRoute(route, tenantSession.role));
  const groupedRoutes = navigationOrder
    .map((group) => ({
      group,
      routes: searchableRoutes
        .filter((route) => route.navigationGroup === group)
        .map((route) => ({
          id: route.id,
          path: route.path,
          label: route.label,
          iconKey: route.iconKey,
          supportLabel: backendSupportLabels[route.supportStatus],
        })),
    }))
    .filter((entry) => entry.routes.length > 0);

  useEffect(() => {
    if (currentPathname() === '/') {
      navigate(defaultRoute.path);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setActiveRouteKey(`${currentPathname()}${currentSearch()}`);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const shellPosture = activeConsole?.posture ?? 'ready';
  const shellPostureLabel = activeConsole?.postureLabel ?? 'Select an operating console';
  const dockActions = activeConsole?.primaryActions ?? [
    { label: 'Command center', path: '/dashboard', detail: 'Open the operations command center.' },
    { label: 'Race day', path: '/race-day', detail: 'Review race office lifecycle and readiness.' },
    { label: 'Approvals', path: '/approvals', detail: 'Review human approval workflow queue.' },
  ];

  return (
    <div className="app-shell">
      <SidebarNavGroups
        groups={groupedRoutes}
        activeRouteId={activeRouteId}
        onNavigate={navigate}
        emptyMessage={normalizedSearch ? `No routes match "${searchQuery}".` : undefined}
      />

      <div className="shell-body">
        <CommandBar
          posture={shellPosture}
          postureLabel={shellPostureLabel}
          session={tenantSession}
          roleLabel={roleDisplayName(tenantSession.role)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          shortcuts={topbarShortcuts.map((route) => ({ id: route.id, label: route.label, path: route.path }))}
          onNavigate={navigate}
          themeToggle={(
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme(toggleThemeName(theme))}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          )}
        />

        <main className="main-workspace">
          <RenderErrorBoundary title="Console render error" resetKey={activeRouteKey}>
            <Router />
          </RenderErrorBoundary>
        </main>

        <ActionDock
          title={activeConsole?.title ?? 'Operator action dock'}
          description={activeConsole?.mission ?? 'Navigate to an operating console to load lifecycle lanes and escalation queues from the backend.'}
          actions={dockActions}
          protectedActions={regulatedActionNames}
          onNavigate={navigate}
        />

        <footer className="status-footer">
          <span>TrackMind Control Surface</span>
          <span>Role: {roleDisplayName(tenantSession.role)}</span>
          <span>Audit: {tenantSession.auditMode ?? 'read-only'}</span>
          <span>{activeConsole?.source ?? 'Backend-enforced'}</span>
        </footer>
      </div>
    </div>
  );
}

function routeSearchText(route: (typeof routes)[number]): string {
  return [route.label, route.path, route.navigationGroup, route.dataSource, ...route.backendPaths].join(' ').toLowerCase();
}
