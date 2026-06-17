import type { ReactElement, ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { hasPermission, type Permission } from '@trackmind/shared';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { canViewRoute, roleDisplayName, type RouteSupportMetadata } from '@/domain/support';
import { routeById } from '@/routes/routes';
import { Button } from '@/design/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design/components/card';

function AccessDenied({ route }: { route: RouteSupportMetadata }): ReactElement {
  const { session } = useTenantSession();

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Access denied</CardTitle>
        <CardDescription>
          Your current role ({roleDisplayName(session.role)}) cannot open {route.label}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
        <p>Required permission: <code>{route.requiredPermission}</code></p>
        <p>Use the role switcher in the command bar to select an authorized operator persona, or return to an available console.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Back to Command Center</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function RequirePermission({ permission, children }: { permission: Permission | 'read:any'; children: ReactNode }): ReactElement {
  const { session } = useTenantSession();
  const location = useLocation();

  if (!hasPermission(session.role, permission)) {
    if (canViewRoute(routeById.dashboard, session.role)) {
      return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
    }
    return <AccessDenied route={routeById.dashboard} />;
  }
  return <>{children}</>;
}

export function RequireRouteAccess({ route, children }: { route: RouteSupportMetadata; children: ReactNode }): ReactElement {
  const { session } = useTenantSession();
  const location = useLocation();

  if (!canViewRoute(route, session.role)) {
    if (route.path === '/dashboard' || !canViewRoute(routeById.dashboard, session.role)) {
      return <AccessDenied route={route} />;
    }
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
