import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { backendSupportLabels, canViewRoute, defaultTenantContext, regulatedActionNames, type NavigationGroup } from '../domain/support';
import { currentPathname, navigate } from '../routes/navigation';
import { resolveRoute, routes } from '../routes/routes';
import { Router } from '../routes/Router';
import { AlertPanel, EmptyState, RenderErrorBoundary, StatusBadge, TagList } from '../components/ui';
import { applyTheme, loadTheme, persistTheme, toggleThemeName, type ThemeName } from '../theme/theme';

const navigationOrder: NavigationGroup[] = ['Command', 'Operations', 'Governance', 'Enterprise', 'Administration'];
const routeIconLabels: Record<string, string> = {
  'command-center': 'CC',
  'race-day': 'RD',
  horse: 'EQ',
  approval: 'AP',
  incident: 'IN',
  compliance: 'CO',
  security: 'SE',
  facility: 'FA',
  ticket: 'TI',
  finance: 'FI',
  federation: 'FE',
  'data-hub': 'DH',
  audit: 'AU',
  admin: 'AD',
  settings: 'ST',
} as const;

export function AppShell(): ReactElement {
  const [activeRouteId, setActiveRouteId] = useState(() => resolveRoute(currentPathname()).id);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<ThemeName>(() => loadTheme());
  const visibleRoutes = routes.filter((route) => canViewRoute(route, defaultTenantContext.role));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchableRoutes = normalizedSearch
    ? visibleRoutes.filter((route) => routeSearchText(route).includes(normalizedSearch))
    : visibleRoutes;
  const groupedRoutes = navigationOrder
    .map((group) => ({ group, routes: searchableRoutes.filter((route) => route.navigationGroup === group) }))
    .filter((entry) => entry.routes.length > 0);

  useEffect(() => {
    const onPopState = () => setActiveRouteId(resolveRoute(currentPathname()).id);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="TrackMind navigation">
        <div className="brand">
          <span className="brand-mark">TM</span>
          <div>
            <strong>TrackMind Nexus</strong>
            <small>Racetrack Operations OS</small>
          </div>
        </div>
        <nav>
          {groupedRoutes.length === 0 ? <EmptyState message={`No routes match "${searchQuery}".`} /> : null}
          {groupedRoutes.map(({ group, routes: groupRoutes }) => (
            <section className="nav-group" key={group} aria-label={`${group} routes`}>
              <h2>{group}</h2>
              {groupRoutes.map((route) => {
                const isActive = route.id === activeRouteId;
                return (
                  <button className={`route-button${isActive ? ' route-button--active' : ''}`} aria-current={isActive ? 'page' : undefined} key={route.path} type="button" onClick={() => navigate(route.path)}>
                    <span className="route-icon" aria-hidden="true">{routeIconLabels[route.iconKey] ?? route.label.slice(0, 2).toUpperCase()}</span>
                    <span>{route.label}</span>
                    <small>{backendSupportLabels[route.supportStatus]}</small>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <div className="switcher">
            <div className="scope-chip" aria-label="Tenant scope">
              <span>Tenant</span>
              <strong>{defaultTenantContext.tenantId}</strong>
            </div>
            <div className="scope-chip" aria-label="Racetrack scope">
              <span>Racetrack</span>
              <strong>{defaultTenantContext.racetrackId}</strong>
            </div>
            <span className="scope-disclaimer">Demo context only; backend auth must enforce scope.</span>
          </div>
          <label className="global-search">
            Search
            <input type="search" placeholder="Search pages and platform areas" value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} />
          </label>
          <div className="topbar-actions" aria-label="Global route shortcuts">
            <button type="button" onClick={() => navigate('/dashboard')}>Command Center</button>
            <button type="button" onClick={() => navigate('/race-day')}>Race Day</button>
            <button type="button" onClick={() => navigate('/approvals')}>Approvals</button>
            <button type="button" onClick={() => navigate('/audit')}>Audit</button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme(toggleThemeName(theme))}>{theme === 'dark' ? 'Use light theme' : 'Use dark theme'}</button>
          </div>
        </header>

        <main className="main-workspace">
          <RenderErrorBoundary title="Workspace render error">
            <Router />
          </RenderErrorBoundary>
        </main>

        <aside className="intelligence-panel" aria-label="Contextual intelligence panel">
          <h2>Platform Assurance</h2>
          <p>Every workspace shows the operating picture, supporting evidence, and the human approval boundary in one governed command surface.</p>
          <div className="intelligence-panel__badges" aria-label="AI governance controls">
            <StatusBadge label="Human approval required" tone="critical" />
            <StatusBadge label="Evidence-bound recommendations" tone="advisory" />
            <StatusBadge label="No autonomous control path" tone="nominal" />
          </div>
          <AlertPanel title="Blocked Direct Actions" tone="critical">
            <TagList label="Protected actions" values={regulatedActionNames} />
          </AlertPanel>
        </aside>

        <footer className="status-footer">
          <span>System health: backend facade monitored</span>
          <span>Sync: event stream read-only</span>
          <span>Role: {defaultTenantContext.role}</span>
          <span>Scope: {defaultTenantContext.scopeSource}</span>
          <span>Route filtering: UX only</span>
          <span>Audit mode: {defaultTenantContext.auditMode}</span>
        </footer>
      </div>
    </div>
  );
}

function routeSearchText(route: (typeof routes)[number]): string {
  return [
    route.label,
    route.path,
    route.navigationGroup,
    route.supportStatus,
    route.dataSource,
    ...route.backendPaths,
    ...route.sharedTypes,
  ].join(' ').toLowerCase();
}
