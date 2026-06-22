import { useTenantSession } from '@/auth/TenantSessionProvider';
import { homePathForRole } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

/** Redirects to the role-resonant home workspace for the active session. */
export function RoleHomeRedirect(): ReactElement {
  const { session } = useTenantSession();
  return <Navigate to={homePathForRole(session.role)} replace />;
}
