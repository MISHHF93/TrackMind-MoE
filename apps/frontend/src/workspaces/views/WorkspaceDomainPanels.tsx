import type { ReactElement } from 'react';
import type { DomainRouteId } from '@/domain/support';
import { EmptyState } from '@/design/components/states';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { AdminPanels, CommandCenterPanels } from './commandPanels';
import { RaceDayPanels } from './racePanels';
import { SurfacePanels } from './surfacePanels';
import { EquinePanels } from './equinePanels';
import { StewardingPanels } from './stewardingPanels';
import { ApprovalsWorkspacePanels } from './approvalsPanels';
import { AuditPanels, CompliancePanels } from './governancePanels';
import { SecurityPanels, IncidentPanels, EmergencyPanels } from './securityPanels';
import { FacilitiesPanels, WorkforcePanels, DigitalTwinPanels } from './operationsPanels';
import { FinancePanels, TicketingPanels, FederationPanels, DataHubPanels } from './businessPanels';
import { SettingsPanels } from './settingsPanels';
import { AnalyticsPanels, FanExperiencePanels, NotificationsPanels } from './platformPanels';

export function WorkspaceDomainPanels({
  routeId,
  results,
}: {
  routeId: DomainRouteId;
  results: WorkspaceDataResult[];
}): ReactElement {
  switch (routeId) {
    case 'dashboard':
      return <CommandCenterPanels results={results} />;
    case 'admin':
      return <AdminPanels results={results} />;
    case 'raceDay':
      return <RaceDayPanels results={results} />;
    case 'surface':
      return <SurfacePanels results={results} />;
    case 'equine':
      return <EquinePanels results={results} />;
    case 'stewarding':
      return <StewardingPanels results={results} />;
    case 'approvals':
      return <ApprovalsWorkspacePanels results={results} />;
    case 'audit':
      return <AuditPanels results={results} />;
    case 'compliance':
      return <CompliancePanels results={results} />;
    case 'security':
      return <SecurityPanels results={results} />;
    case 'incidents':
      return <IncidentPanels results={results} />;
    case 'emergency':
      return <EmergencyPanels results={results} />;
    case 'facilities':
      return <FacilitiesPanels results={results} />;
    case 'workforce':
      return <WorkforcePanels results={results} />;
    case 'digitalTwin':
      return <DigitalTwinPanels results={results} />;
    case 'ticketing':
      return <TicketingPanels results={results} />;
    case 'finance':
      return <FinancePanels results={results} />;
    case 'federation':
      return <FederationPanels results={results} />;
    case 'dataHub':
      return <DataHubPanels results={results} />;
    case 'settings':
      return <SettingsPanels results={results} />;
    case 'analytics':
      return <AnalyticsPanels results={results} />;
    case 'fanExperience':
      return <FanExperiencePanels results={results} />;
    case 'notifications':
      return <NotificationsPanels results={results} />;
    default: {
      const unknownRoute: never = routeId;
      return (
        <EmptyState
          title="Workspace panels unavailable"
          description={`No domain panel is registered for route ${String(unknownRoute)}.`}
        />
      );
    }
  }
}
