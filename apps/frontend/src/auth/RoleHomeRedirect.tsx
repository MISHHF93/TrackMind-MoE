import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAccessibleRoutes } from '@/hooks/useAccessibleRoutes';
import { routes } from '@/routes/routes';

export function RoleHomeRedirect(): ReactElement {
  const { homePath } = useAccessibleRoutes(routes);
  return <Navigate to={homePath} replace />;
}
