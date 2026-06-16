import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { domainServices } from '../api/services';
import { canViewRoute, defaultTenantContext } from '../domain/support';
import { createUnavailableWorkspace, type WorkspaceViewModel } from '../domain/workspaceModel';
import { resolveRoute, type AppRoute } from './routes';
import { currentPathname } from './navigation';
import { WorkspacePage } from '../pages/WorkspacePage';

function useRoute(): AppRoute {
  const [route, setRoute] = useState(() => resolveRoute(currentPathname()));

  useEffect(() => {
    const onPopState = () => setRoute(resolveRoute(currentPathname()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return route;
}

export function Router(): ReactElement {
  const route = useRoute();
  const [state, setState] = useState<{ loading: boolean; data?: WorkspaceViewModel; error?: string }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
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
          setState({ loading: false, data: createUnavailableWorkspace(route, message) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [route]);

  return <WorkspacePage route={route} state={state} />;
}
