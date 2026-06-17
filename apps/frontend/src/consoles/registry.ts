import type { DomainRouteId } from '../domain/support';
import type { ConsolePayload } from '../design/opsTypes';
import { loadApprovalsConsole } from '../api/loaders/approvals';
import { loadAdminConsole } from '../api/loaders/admin';
import { loadAuditConsole } from '../api/loaders/audit';
import { loadCommandCenterConsole } from '../api/loaders/commandCenter';
import { loadComplianceConsole } from '../api/loaders/compliance';
import { loadDataHubConsole } from '../api/loaders/dataHub';
import { loadEquineConsole } from '../api/loaders/equine';
import { loadFacilitiesConsole } from '../api/loaders/facilities';
import { loadFinanceConsole } from '../api/loaders/finance';
import { loadFederationConsole } from '../api/loaders/federation';
import { loadIncidentsConsole } from '../api/loaders/incidents';
import { loadRaceDayConsole } from '../api/loaders/raceDay';
import { loadSecurityConsole } from '../api/loaders/security';
import { loadSettingsConsole } from '../api/loaders/settings';
import { loadTicketingConsole } from '../api/loaders/ticketing';

export type ConsoleLoader = () => Promise<ConsolePayload>;

export const consoleRegistry: Record<DomainRouteId, ConsoleLoader> = {
  dashboard: loadCommandCenterConsole,
  raceDay: loadRaceDayConsole,
  equine: loadEquineConsole,
  approvals: loadApprovalsConsole,
  incidents: loadIncidentsConsole,
  compliance: loadComplianceConsole,
  security: loadSecurityConsole,
  facilities: loadFacilitiesConsole,
  ticketing: loadTicketingConsole,
  finance: loadFinanceConsole,
  federation: loadFederationConsole,
  dataHub: loadDataHubConsole,
  audit: loadAuditConsole,
  admin: loadAdminConsole,
  settings: loadSettingsConsole,
};
