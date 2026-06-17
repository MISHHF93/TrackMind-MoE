import type { DomainRouteId } from '../../routes/routes';
import type { ConsolePayload } from '../../design/opsTypes';
import { loadApprovalsConsole } from './approvals';
import { loadAdminConsole } from './admin';
import { loadAuditConsole } from './audit';
import { loadCommandCenterConsole } from './commandCenter';
import { loadComplianceConsole } from './compliance';
import { loadDataHubConsole } from './dataHub';
import { loadEquineConsole } from './equine';
import { loadFacilitiesConsole } from './facilities';
import { loadFinanceConsole } from './finance';
import { loadFederationConsole } from './federation';
import { loadIncidentsConsole } from './incidents';
import { loadRaceDayConsole } from './raceDay';
import { loadSecurityConsole } from './security';
import { loadSettingsConsole } from './settings';
import { loadTicketingConsole } from './ticketing';

export const consoleLoaders: Record<DomainRouteId, () => Promise<ConsolePayload>> = {
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
