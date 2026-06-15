import type { ReactElement } from 'react';
import { canViewRoute, defaultTenantContext, regulatedActionNames } from '../domain/support';
import { routes } from '../routes/routes';
import { navigate, Router } from '../routes/Router';

export function AppShell(): ReactElement {
  const visibleRoutes = routes.filter((route) => canViewRoute(route, defaultTenantContext.role));

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="TrackMind navigation">
        <div className="brand">
          <span className="brand-mark">TM</span>
          <div>
            <strong>TrackMind Nexus</strong>
            <small>AI Stack Command Center</small>
          </div>
        </div>
        <nav>
          {visibleRoutes.map((route) => (
            <button key={route.path} type="button" onClick={() => navigate(route.path)}>
              <span>{route.iconKey}</span>
              <span>{route.label}</span>
              <small>{route.supportStatus}</small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <div className="switcher">
            <label>
              Tenant
              <select defaultValue={defaultTenantContext.tenantId} aria-label="Tenant switcher" disabled title="Demo reference context; production scope must come from authenticated backend claims.">
                <option value={defaultTenantContext.tenantId}>{defaultTenantContext.tenantId}</option>
              </select>
            </label>
            <label>
              Racetrack
              <select defaultValue={defaultTenantContext.racetrackId} aria-label="Racetrack switcher" disabled title="Demo reference context; production scope must come from authenticated backend claims.">
                <option value={defaultTenantContext.racetrackId}>{defaultTenantContext.racetrackId}</option>
              </select>
            </label>
            <span className="scope-disclaimer">Demo context only; backend auth must enforce scope.</span>
          </div>
          <label className="global-search">
            Search
            <input type="search" placeholder="Search routes, approvals, audit, evidence" disabled title="Search is not wired yet." />
          </label>
          <div className="topbar-actions">
            <button type="button" onClick={() => navigate('/incidents')}>Alerts</button>
            <button type="button" onClick={() => navigate('/approvals')}>Approval queue</button>
            <button type="button" onClick={toggleTheme}>Toggle theme</button>
          </div>
        </header>

        <main className="main-workspace">
          <Router />
        </main>

        <aside className="intelligence-panel" aria-label="Contextual intelligence panel">
          <h2>AI Stack</h2>
          <p>Mixture-of-experts output is advisory by default and bound to evidence, approval, audit, and tenant context.</p>
          <ul>
            <li>Human approval required for regulated actions.</li>
            <li>AI recommendations expose confidence, evidence, model version, risk, and audit references.</li>
            <li>No autonomous control path is rendered in the shell.</li>
          </ul>
          <h3>Blocked Direct Actions</h3>
          <p>{regulatedActionNames.join(', ')}</p>
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

function toggleTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
}
