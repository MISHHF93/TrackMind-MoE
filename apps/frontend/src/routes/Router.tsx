import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { domainServices } from '../api/services';
import { canViewRoute, defaultTenantContext } from '../domain/support';
import { createUnavailableWorkspace, type WorkspaceViewModel } from '../domain/workspaceModel';
import { routeForPathname, type AppRoute } from './routes';
import { currentPathname, currentSearch } from './navigation';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ErrorState } from '../components/ui';

function useRoute(): { route?: AppRoute; pathname: string; search: string; locationKey: string } {
  const [routeState, setRouteState] = useState(() => {
    const pathname = currentPathname();
    const search = currentSearch();
    return { route: routeForPathname(pathname), pathname, search, locationKey: `${pathname}${search}` };
  });

  useEffect(() => {
    const onPopState = () => {
      const pathname = currentPathname();
      const search = currentSearch();
      setRouteState({ route: routeForPathname(pathname), pathname, search, locationKey: `${pathname}${search}` });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return routeState;
}

export function Router(): ReactElement {
  const { route, pathname, locationKey } = useRoute();
  const [state, setState] = useState<{ routeKey: string; loading: boolean; data?: WorkspaceViewModel; error?: string }>({ routeKey: '', loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!route) {
      setState({ routeKey: locationKey, loading: false, error: `No workspace route is registered for ${pathname}.` });
      return () => {
        cancelled = true;
      };
    }
    if (!canViewRoute(route, defaultTenantContext.role)) {
      setState({ routeKey: locationKey, loading: false, error: `Role ${defaultTenantContext.role} cannot view ${route.label}.` });
      return () => {
        cancelled = true;
      };
    }
    setState({ routeKey: locationKey, loading: true });
    domainServices[route.id]
      .load()
      .then((data) => {
        if (!cancelled) setState({ routeKey: locationKey, loading: false, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown route load error';
          setState({ routeKey: locationKey, loading: false, data: createUnavailableWorkspace(route, message), error: message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route, pathname, locationKey]);

  if (!route) {
    return <ErrorState title="Page not found" message={`No TrackMind workspace is registered for ${pathname}.`} detail="Use the navigation menu or topbar shortcuts to open a mapped workspace." />;
  }
  if (!canViewRoute(route, defaultTenantContext.role)) {
    return <ErrorState title="Forbidden" message={`Role ${defaultTenantContext.role} cannot view ${route.label}.`} detail="This workspace is hidden for the current demo role. Backend authorization remains authoritative." />;
  }
  const pageState = state.routeKey === locationKey
    ? state
    : { routeKey: locationKey, loading: true, data: undefined, error: undefined };
  return <WorkspacePage route={route} state={pageState} />;
}
