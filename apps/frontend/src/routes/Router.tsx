import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { domainServices } from '../api/services';
import { canViewRoute, defaultTenantContext } from '../domain/support';
import { createUnavailableWorkspace, type WorkspaceViewModel } from '../domain/workspaceModel';
import { routeForPathname, type AppRoute } from './routes';
import { currentPathname } from './navigation';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ErrorState } from '../components/ui';

function useRoute(): { route?: AppRoute; pathname: string } {
  const [routeState, setRouteState] = useState(() => {
    const pathname = currentPathname();
    return { route: routeForPathname(pathname), pathname };
  });

  useEffect(() => {
    const onPopState = () => {
      const pathname = currentPathname();
      setRouteState({ route: routeForPathname(pathname), pathname });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return routeState;
}

export function Router(): ReactElement {
  const { route, pathname } = useRoute();
  const [state, setState] = useState<{ loading: boolean; data?: WorkspaceViewModel; error?: string }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!route) {
      setState({ loading: false, error: `No workspace route is registered for ${pathname}.` });
      return () => {
        cancelled = true;
      };
    }
    if (!canViewRoute(route, defaultTenantContext.role)) {
      setState({ loading: false, error: `Role ${defaultTenantContext.role} cannot view ${route.label}.` });
      return () => {
        cancelled = true;
      };
    }
    setState({ loading: true });
    domainServices[route.id]
      .load()
      .then((data) => {
        if (!cancelled) setState({ loading: false, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown route load error';
          setState({ loading: false, data: createUnavailableWorkspace(route, message), error: message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route, pathname]);

  if (!route) {
    return <ErrorState title="Page not found" message={`No TrackMind workspace is registered for ${pathname}.`} detail="Use the navigation menu or topbar shortcuts to open a mapped workspace." />;
  }
  return <WorkspacePage route={route} state={state} />;
}
