import { useEffect, useMemo, useState } from 'react';
import type { Role } from '@trackmind/shared';
import { loadCommandCenter } from '../App.js';
import { loadDashboardWithFallback } from '../api/typedApi.js';
import { canonicalLocationForRoute } from './navigation.js';
import { DEFAULT_DENSITY_LEVEL, DEFAULT_THEME_MODE, type DensityLevelId, type ThemeModeId } from '../theme/tokens.js';
import { RouteRenderer } from '../routes/RouteRenderer.js';

type CommandCenterData = Awaited<ReturnType<typeof loadCommandCenter>>;
type AppShellStatus = 'loading' | 'ready' | 'degraded' | 'error';

export interface BrowserRuntimeConfig {
  apiBase?: string;
  tenantId?: string;
  racetrackId?: string;
  roles?: Role[] | string;
  authToken?: string;
  authenticated?: boolean;
  theme?: ThemeModeId;
  density?: DensityLevelId;
}

declare global {
  interface Window {
    __TRACKMIND_NEXUS__?: BrowserRuntimeConfig;
  }
}

function runtimeConfig(): BrowserRuntimeConfig {
  return typeof window === 'undefined' ? {} : window.__TRACKMIND_NEXUS__ ?? {};
}

function rolesFromConfig(config: BrowserRuntimeConfig): Role[] {
  if (Array.isArray(config.roles)) return config.roles;
  if (typeof config.roles === 'string') return config.roles.split(',').map((role) => role.trim()).filter(Boolean) as Role[];
  return ['admin'];
}

function currentPath() {
  if (typeof window === 'undefined') return '/operations';
  return canonicalLocationForRoute(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function AppShell({ config = runtimeConfig() }: { config?: BrowserRuntimeConfig }) {
  const roles = useMemo(() => rolesFromConfig(config), [config]);
  const [path, setPath] = useState(currentPath);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [data, setData] = useState<CommandCenterData>();
  const [status, setStatus] = useState<AppShellStatus>('loading');
  const tenantId = config.racetrackId ?? config.tenantId ?? 'saratoga';
  const authenticated = config.authenticated ?? true;

  useEffect(() => {
    document.documentElement.dataset.theme = config.theme ?? DEFAULT_THEME_MODE;
    document.documentElement.dataset.density = config.density ?? DEFAULT_DENSITY_LEVEL;
  }, [config.density, config.theme]);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apiBase = config.apiBase ?? '/api/v1';
    const context = { authToken: config.authToken, tenantId: config.tenantId, racetrackId: config.racetrackId };

    async function load() {
      setStatus('loading');
      try {
        const { data: live } = await loadDashboardWithFallback({ baseUrl: apiBase, context });
        if (!cancelled) {
          setData(live);
          setStatus(live.mode === 'mock' ? 'degraded' : 'ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [config.apiBase, config.authToken, config.racetrackId, config.tenantId]);

  if (!data) {
    return (
      <main className="nexus-shell workspace-layout" aria-label="TrackMind Nexus SPA bootstrap shell" data-state={status}>
        <section className="workspace-content" aria-label="TrackMind Nexus loading content">
          <header className="page-header command-bar" aria-label="Top command bar">
            <h1>TrackMind Nexus</h1>
            <p role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? 'Unable to load the TrackMind Nexus runtime.' : 'Loading TrackMind Nexus command shell...'}</p>
          </header>
        </section>
      </main>
    );
  }

  return (
    <div data-trackmind-spa-root="true" data-runtime-status={status}>
      <RouteRenderer
        data={data}
        roles={roles}
        authenticated={authenticated}
        tenantId={tenantId}
        path={path}
        serviceState={status === 'degraded' ? 'degraded' : 'online'}
        paletteQuery={paletteQuery}
      />
      <form className="sr-only" aria-label="SPA command palette state">
        <label>
          Command palette query
          <input value={paletteQuery} onChange={(event) => setPaletteQuery(event.currentTarget.value)} />
        </label>
      </form>
    </div>
  );
}
