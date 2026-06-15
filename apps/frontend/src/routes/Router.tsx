import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { domainServices } from '../api/services';
import { canViewRoute, defaultTenantContext } from '../domain/support';
import type { WorkspaceViewModel } from '../domain/workspaceModel';
import { resolveRoute, type AppRoute } from './routes';
import { WorkspacePage } from '../pages/WorkspacePage';

function useRoute(): AppRoute {
  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return route;
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : 'Unknown route load error' });
      });
    return () => {
      cancelled = true;
    };
  }, [route]);

  return <WorkspacePage route={route} state={state} />;
}
