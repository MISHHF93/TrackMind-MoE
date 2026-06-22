import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/shell/AppShell';
import { RequireRouteAccess } from '@/auth/guards';
import { RoleHomeRedirect } from '@/auth/RoleHomeRedirect';
import { routes, routeById } from '@/routes/routes';
import { routePathSegment } from '@/routes/validateRoutes';
import { RouteError } from '@/app/RouteError';
import { WorkspacePage } from '@/workspaces/WorkspacePage';
import type { DomainRouteId } from '@/domain/support';

function guarded(routeId: DomainRouteId, element: ReactElement) {
  return <RequireRouteAccess route={routeById[routeId]}>{element}</RequireRouteAccess>;
}

const workspaceRoutes = routes.map((route) => ({
  path: routePathSegment(route),
  element: guarded(route.id, <WorkspacePage routeId={route.id} />),
}));

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <RoleHomeRedirect /> },
      ...workspaceRoutes,
      { path: '*', element: <RoleHomeRedirect /> },
    ],
  },
]);

export const routeInventory = routes;
