import { createRaceOperationsService } from './application/raceOperationsService.js';
import { createRaceOperationsHttpServer } from './api/httpServer.js';
import type { RaceOperationsReadPort } from './domain/raceOperationsPort.js';

function emptyReadPort(): RaceOperationsReadPort {
  return {
    raceOfficeWorkspace: (_now, mock = false) => ({
      meets: [],
      raceDays: [],
      cards: [],
      readiness: [],
      approvalControls: [],
      lifecycle: [],
      mock,
    }),
    operationalDashboard: (now) => ({
      generatedAt: now ?? new Date().toISOString(),
      totals: { all: 0, draft: 0, scheduled: 0, 'entries-open': 0, declared: 0, 'post-positions-drawn': 0, ready: 0, running: 0, official: 0, cancelled: 0 },
      byTrack: [],
      upcoming: [],
      resourceExceptions: [],
      staffingExceptions: [],
      executionAlerts: [],
    }),
    listRaces: () => [],
    getRace: (raceId) => ({ id: raceId, status: 'draft' }),
    operationalReport: (raceId) => ({ raceId, status: 'draft', entries: 0 }),
  };
}

const service = createRaceOperationsService({
  readPort: emptyReadPort(),
  tenantId: process.env.TRACKMIND_TENANT_ID ?? 'trackmind',
});
const { listen, address } = createRaceOperationsHttpServer({ service });

listen()
  .then(() => {
    const bound = address();
    const port = typeof bound === 'object' && bound ? bound.port : process.env.PORT ?? 4107;
    console.log(`race-operations-service listening on port ${port}`);
  })
  .catch((error) => {
    console.error('race-operations-service failed to start', error);
    process.exitCode = 1;
  });
