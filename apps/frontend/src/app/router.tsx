import type { ReactElement } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/shell/AppShell';
import { AuthGate } from '@/auth/AuthGate';
import { LoginPage } from '@/auth/LoginPage';
import { RequireRouteAccess } from '@/auth/guards';
import { RoleHomeRedirect } from '@/auth/RoleHomeRedirect';
import { routes, routeById } from '@/routes/routes';
import { routePathSegment } from '@/routes/validateRoutes';
import { RouteError } from '@/app/RouteError';
import { RootLayout } from '@/app/RootLayout';
import { AppProviders } from '@/app/providers';
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
    element: <RootLayout />,
    errorElement: (
      <AppProviders>
        <RouteError />
      </AppProviders>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: (
          <AuthGate>
            <AppShell />
          </AuthGate>
        ),
        errorElement: (
          <AppProviders>
            <RouteError />
          </AppProviders>
        ),
        children: [
          { index: true, element: <RoleHomeRedirect /> },
          ...workspaceRoutes,
          { path: '*', element: <RoleHomeRedirect /> },
        ],
      },
    ],
  },
]);

export const routeInventory = routes;
