import type { ReactElement } from 'react';
import type { KPIDomain, Role } from '@trackmind/shared';
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
import { AccountPanels } from './accountPanels';

export function WorkspaceDomainPanels({
  routeId,
  results,
  role,
  kpiDomains,
}: {
  routeId: DomainRouteId;
  results: WorkspaceDataResult[];
  role: Role;
  kpiDomains: readonly KPIDomain[];
}): ReactElement {
  const panelProps = { results, role, kpiDomains };
  switch (routeId) {
    case 'dashboard':
      return <CommandCenterPanels {...panelProps} />;
    case 'admin':
      return <AdminPanels {...panelProps} />;
    case 'raceDay':
      return <RaceDayPanels {...panelProps} />;
    case 'surface':
      return <SurfacePanels {...panelProps} />;
    case 'equine':
      return <EquinePanels {...panelProps} />;
    case 'stewarding':
      return <StewardingPanels {...panelProps} />;
    case 'approvals':
      return <ApprovalsWorkspacePanels {...panelProps} />;
    case 'audit':
      return <AuditPanels {...panelProps} />;
    case 'compliance':
      return <CompliancePanels {...panelProps} />;
    case 'security':
      return <SecurityPanels {...panelProps} />;
    case 'incidents':
      return <IncidentPanels {...panelProps} />;
    case 'emergency':
      return <EmergencyPanels {...panelProps} />;
    case 'facilities':
      return <FacilitiesPanels {...panelProps} />;
    case 'workforce':
      return <WorkforcePanels {...panelProps} />;
    case 'digitalTwin':
      return <DigitalTwinPanels {...panelProps} />;
    case 'ticketing':
      return <TicketingPanels {...panelProps} />;
    case 'finance':
      return <FinancePanels {...panelProps} />;
    case 'federation':
      return <FederationPanels {...panelProps} />;
    case 'dataHub':
      return <DataHubPanels {...panelProps} />;
    case 'settings':
      return <SettingsPanels {...panelProps} />;
    case 'analytics':
      return <AnalyticsPanels {...panelProps} />;
    case 'fanExperience':
      return <FanExperiencePanels {...panelProps} />;
    case 'notifications':
      return <NotificationsPanels {...panelProps} />;
    case 'account':
      return <AccountPanels {...panelProps} />;
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
