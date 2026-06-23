import type {
  SensorReadingDto,
  SurveillanceIoTTelemetryIngestRequestDto,
  SurveillanceIoTTelemetryIngestResultDto,
} from '@trackmind/shared';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';
import { auditIds } from '../types.js';
import type { SurveillanceIoTModuleContext } from '../types.js';

export class TelemetryIngestionService {
  private readonly readings = new Map<string, SensorReadingDto[]>();

  ingest(
    ctx: SurveillanceIoTModuleContext,
    adapterRegistry: SurveillanceAdapterRegistry,
    payload: SurveillanceIoTTelemetryIngestRequestDto,
  ): SurveillanceIoTTelemetryIngestResultDto {
    const adapter = adapterRegistry.list().find((entry) => entry.adapterId === payload.adapterId);
    if (!adapter) {
      throw new Error(`Unknown surveillance adapter ${payload.adapterId}`);
    }

    const deviceId = payload.externalDeviceId;
    const envelope = auditIds(ctx.now, `ingest:${deviceId}:${payload.readings.length}`);
    const normalized: SensorReadingDto[] = payload.readings.map((reading, index) => ({
      kind: 'sensor-reading',
      id: `reading:${deviceId}:${ctx.now}:${index}`,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      displayName: `${deviceId} ${reading.metric}`,
      status: 'online',
      health: 'healthy',
      lastSeenAt: reading.observedAt ?? ctx.now,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      domainScope: 'shared',
      deviceId,
      metric: reading.metric,
      value: reading.value,
      unit: reading.unit,
      valueType: typeof reading.value === 'boolean' ? 'boolean' : typeof reading.value === 'number' ? 'numeric' : 'string',
      observedAt: reading.observedAt ?? ctx.now,
      quality: reading.quality ?? 'good',
      evidence: [`adapter:${payload.adapterId}`, `metric:${reading.metric}`],
      audit: envelope.audit,
      mock: false,
    }));

    const existing = this.readings.get(deviceId) ?? [];
    this.readings.set(deviceId, [...normalized, ...existing].slice(0, 100));

    return {
      accepted: true,
      readingCount: normalized.length,
      deviceId,
      adapterId: payload.adapterId,
      auditId: envelope.auditId,
      eventId: envelope.eventId,
      mock: false,
    };
  }

  listRecent(deviceId?: string): SensorReadingDto[] {
    if (deviceId) return [...(this.readings.get(deviceId) ?? [])];
    return [...this.readings.values()].flat().slice(0, 50);
  }
}
