import type { EventEnvelope } from '../events/index.js';
import type { GnssConstellation, RaceReplayPoint, RaceReplayProjection } from './rtkTypes.js';

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}

function constellationValues(value: unknown): GnssConstellation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is GnssConstellation => item === 'GPS' || item === 'GLONASS' || item === 'Galileo' || item === 'BeiDou');
}

export class DigitalTwinRaceReplayProjectionService {
  build(events: EventEnvelope[], raceId: string): RaceReplayProjection {
    const points = events
      .filter((event) => event.eventType === 'LocationUpdatedEvent')
      .map((event) => this.toReplayPoint(event))
      .filter((point): point is RaceReplayPoint => Boolean(point && point.raceId === raceId))
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.sequence - right.sequence);

    const latest = new Map<string, RaceReplayPoint>();
    for (const point of points) latest.set(point.horseId, point);

    return {
      raceId,
      current: [...latest.values()].sort((left, right) => left.horseId.localeCompare(right.horseId)).map(clone),
      historicalTrace: points.map(clone),
      generatedAt: new Date().toISOString(),
      replayMetadata: {
        sampleCount: points.length,
        updateRateHz: 20,
        accuracyTargetCm: 2,
        source: 'event-sourced-rtk-gnss',
      },
    };
  }

  current(events: EventEnvelope[], raceId: string): RaceReplayPoint[] {
    return this.build(events, raceId).current;
  }

  historicalTrace(events: EventEnvelope[], raceId: string, horseId?: string): RaceReplayPoint[] {
    const projection = this.build(events, raceId);
    return projection.historicalTrace.filter((point) => !horseId || point.horseId === horseId);
  }

  private toReplayPoint(event: EventEnvelope): RaceReplayPoint | undefined {
    const payload = event.payload as Record<string, unknown>;
    const raceId = stringValue(payload.raceId);
    const horseId = stringValue(payload.horseId);
    const deviceId = stringValue(payload.deviceId);
    const zoneId = stringValue(payload.zoneId);
    const latitude = numeric(payload.latitude);
    const longitude = numeric(payload.longitude);
    if (!raceId || !horseId || !deviceId || !zoneId || latitude === undefined || longitude === undefined) return undefined;

    const gnss = (payload.gnss && typeof payload.gnss === 'object' ? payload.gnss : {}) as Record<string, unknown>;
    return {
      raceId,
      horseId,
      deviceId,
      latitude,
      longitude,
      altitudeMeters: numeric(payload.altitudeMeters),
      zoneId,
      observedAt: stringValue(payload.observedAt) ?? event.occurredAt,
      sequence: numeric(payload.sequence) ?? 0,
      horizontalAccuracyCm: numeric(payload.horizontalAccuracyCm) ?? 999,
      verticalAccuracyCm: numeric(payload.verticalAccuracyCm) ?? 999,
      speedMetersPerSecond: numeric(payload.speedMetersPerSecond),
      headingDegrees: numeric(payload.headingDegrees),
      eventId: event.eventId,
      eventHash: event.eventHash,
      constellations: constellationValues(gnss.constellations),
    };
  }
}
