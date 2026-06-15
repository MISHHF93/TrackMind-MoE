import { useEffect } from 'react';
import type { Role } from '@trackmind/shared';
import { CommandCenter, loadCommandCenter } from '../App.js';
import type { ServiceState, UserProfile } from '../shell/experience.js';
import { resolveCanonicalRoute, type RouteResolution } from './registry.js';
import { canonicalLocationForRoute } from '../shell/navigation.js';

type CommandCenterData = Awaited<ReturnType<typeof loadCommandCenter>>;

export interface RouteRendererProps {
  data: CommandCenterData;
  roles: Role[];
  authenticated: boolean;
  tenantId: string;
  path: string;
  serviceState: ServiceState;
  paletteQuery?: string;
  navCollapsed?: boolean;
  mobileNavOpen?: boolean;
  user?: UserProfile;
}

export function routeResolutionForRender(path: string, roles: Role[]): RouteResolution {
  return resolveCanonicalRoute(path, roles);
}

export function RouteRenderer({ path, roles, ...props }: RouteRendererProps) {
  const resolution = routeResolutionForRender(path, roles);
  const renderPath = resolution.redirectTo ?? resolution.canonicalPath;

  useEffect(() => {
    if (resolution.intent !== 'redirect' || typeof window === 'undefined') return;
    const canonicalLocation = canonicalLocationForRoute(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    if (canonicalLocation !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', canonicalLocation);
    }
  }, [resolution.intent, path]);

  return <CommandCenter {...props} roles={roles} path={renderPath} />;
}
