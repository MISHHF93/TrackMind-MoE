import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { consoleRegistry } from '../consoles/registry';
import { ConsoleSurface, ErrorConsole, LoadingConsole } from '../design/components';
import type { ConsolePayload, ConsoleState } from '../design/opsTypes';
import { canViewRoute } from '../domain/support';
import { useTenantSession } from '../domain/useTenantSession';
import { setActiveConsole } from '../lib/activeConsole';
import { routeForPathname, type AppRoute } from '../routes/routes';
import { currentPathname, currentSearch, navigate } from '../routes/navigation';
import { createUnavailableConsole } from './unavailableConsole';

function useRoute(): { route?: AppRoute; pathname: string; locationKey: string } {
  const [state, setState] = useState(() => {
    const pathname = currentPathname();
    const search = currentSearch();
    return { route: routeForPathname(pathname), pathname, locationKey: `${pathname}${search}` };
  });
  useEffect(() => {
    const onPopState = () => {
      const pathname = currentPathname();
      const search = currentSearch();
      setState({ route: routeForPathname(pathname), pathname, locationKey: `${pathname}${search}` });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return state;
}

export function Router(): ReactElement {
  const tenantSession = useTenantSession();
  const { route, locationKey } = useRoute();
  const sessionKey = `${tenantSession.tenantId}:${tenantSession.racetrackId}:${tenantSession.organizationId}:${tenantSession.role}`;
  const routeKey = `${locationKey}:${sessionKey}`;
  const [state, setState] = useState<ConsoleState>({ routeKey: '', loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!route) {
      setState({ routeKey, loading: false, error: 'Page not found' });
      return () => { cancelled = true; };
    }
    if (!canViewRoute(route, tenantSession.role)) {
      setState({ routeKey, loading: false, error: 'Forbidden' });
      return () => { cancelled = true; };
    }
    setState({ routeKey, loading: true });
    consoleRegistry[route.id]()
      .then((data) => { if (!cancelled) setState({ routeKey, loading: false, data }); })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown load error';
          setState({ routeKey, loading: false, data: createUnavailableConsole(route, message), error: message });
        }
      });
    return () => { cancelled = true; };
  }, [route, routeKey, tenantSession.role]);

  useEffect(() => {
    setActiveConsole(state.data);
  }, [state.data]);

  if (!route) {
    return <ErrorConsole title="Page not found" message="No operating console is registered for this path." detail="Use the navigation menu to open a workspace." />;
  }
  if (!canViewRoute(route, tenantSession.role)) {
    return <ErrorConsole title="Forbidden" message={`Role ${tenantSession.role} cannot view ${route.label}.`} detail="This workspace is not available for your operator role." />;
  }
  if (state.routeKey !== routeKey || state.loading) return <LoadingConsole label={route.label} />;
  if (!state.data) return <ErrorConsole title="Console unavailable" message={state.error ?? 'Unknown error'} />;
  return (
    <ConsoleSurface
      data={state.data}
      onNavigate={navigate}
      footer={<p className="console-footer">Source: {state.data.source} · Generated {state.data.generatedAt ?? 'n/a'} · Protected actions require backend approval.</p>}
    />
  );
}
