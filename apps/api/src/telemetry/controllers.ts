import type { CqrsCommandHandler } from '../events/index.js';
import { DigitalTwinRaceReplayProjectionService } from './raceReplayProjection.js';
import { RtkGpsIngestionService } from './rtkIngestionService.js';
import type { RtkPositionSample } from './rtkTypes.js';

export interface TelemetryControllerResponse {
  status: number;
  body: unknown;
}

export class RtkTelemetryController {
  private readonly ingestion: RtkGpsIngestionService;
  private readonly replay = new DigitalTwinRaceReplayProjectionService();

  constructor(private readonly cqrs: CqrsCommandHandler) {
    this.ingestion = new RtkGpsIngestionService(cqrs);
  }

  async handle(method: string, path: string, body?: unknown, params = new URLSearchParams()): Promise<TelemetryControllerResponse | undefined> {
    try {
      if (method === 'POST' && path === '/telemetry/rtk/ingest') {
        const result = await this.ingestion.ingest(body as RtkPositionSample);
        return { status: result.accepted ? 202 : 422, body: result };
      }

      const replayMatch = path.match(/^\/telemetry\/races\/([^/]+)\/replay$/);
      if (method === 'GET' && replayMatch) {
        const raceId = decodeURIComponent(replayMatch[1]);
        const projection = this.replay.build(this.cqrs.events(), raceId);
        const horseId = params.get('horseId');
        return {
          status: 200,
          body: horseId ? { ...projection, historicalTrace: projection.historicalTrace.filter((point) => point.horseId === horseId) } : projection,
        };
      }

      const currentMatch = path.match(/^\/telemetry\/races\/([^/]+)\/current$/);
      if (method === 'GET' && currentMatch) {
        const raceId = decodeURIComponent(currentMatch[1]);
        return { status: 200, body: this.replay.current(this.cqrs.events(), raceId) };
      }

      if (method === 'GET' && path === '/telemetry/rtk/health') {
        return {
          status: 200,
          body: {
            targetUpdateRateHz: 20,
            accuracyTargetCm: 2,
            constellations: ['GPS', 'GLONASS', 'Galileo', 'BeiDou'],
            observedDevices: this.ingestion.observedDevices(),
          },
        };
      }
    } catch (error) {
      return { status: 400, body: { ok: false, error: { code: 'rtk_telemetry_error', message: error instanceof Error ? error.message : String(error) } } };
    }
    return undefined;
  }
}

export function createRtkTelemetryController(cqrs: CqrsCommandHandler) {
  return new RtkTelemetryController(cqrs);
}
