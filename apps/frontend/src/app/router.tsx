import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/shell/AppShell';
import { RequireRouteAccess } from '@/auth/guards';
import { routes, routeById } from '@/routes/routes';
import { RouteError } from '@/app/RouteError';
import {
  AdminPage,
  ApprovalsPage,
  AuditPage,
  CompliancePage,
  DashboardPage,
  DataHubPage,
  DigitalTwinPage,
  EmergencyPage,
  EquinePage,
  FacilitiesPage,
  FederationPage,
  FinancePage,
  IncidentsPage,
  RaceDayPage,
  SecurityPage,
  SettingsPage,
  StewardingPage,
  SurfacePage,
  TicketingPage,
  WorkforcePage,
} from '@/workspaces/pages';

function guarded(routeId: keyof typeof routeById, element: ReactElement) {
  return <RequireRouteAccess route={routeById[routeId]}>{element}</RequireRouteAccess>;
}

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: guarded('dashboard', <DashboardPage />) },
      { path: 'race-day', element: guarded('raceDay', <RaceDayPage />) },
      { path: 'equine', element: guarded('equine', <EquinePage />) },
      { path: 'stewarding', element: guarded('stewarding', <StewardingPage />) },
      { path: 'surface', element: guarded('surface', <SurfacePage />) },
      { path: 'approvals', element: guarded('approvals', <ApprovalsPage />) },
      { path: 'incidents', element: guarded('incidents', <IncidentsPage />) },
      { path: 'emergency', element: guarded('emergency', <EmergencyPage />) },
      { path: 'compliance', element: guarded('compliance', <CompliancePage />) },
      { path: 'security', element: guarded('security', <SecurityPage />) },
      { path: 'facilities', element: guarded('facilities', <FacilitiesPage />) },
      { path: 'workforce', element: guarded('workforce', <WorkforcePage />) },
      { path: 'digital-twin', element: guarded('digitalTwin', <DigitalTwinPage />) },
      { path: 'ticketing', element: guarded('ticketing', <TicketingPage />) },
      { path: 'finance', element: guarded('finance', <FinancePage />) },
      { path: 'federation', element: guarded('federation', <FederationPage />) },
      { path: 'data-hub', element: guarded('dataHub', <DataHubPage />) },
      { path: 'audit', element: guarded('audit', <AuditPage />) },
      { path: 'admin', element: guarded('admin', <AdminPage />) },
      { path: 'settings', element: guarded('settings', <SettingsPage />) },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export const routeInventory = routes;
