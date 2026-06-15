import type { EventEnvelope, HorseScratchedPayload, IncidentReportedPayload, LocationUpdatedPayload, RaceStartedPayload } from './definitions.js';

export interface RaceStateProjection {
  raceId: string;
  status: 'scheduled' | 'running' | 'stopped' | 'official' | 'cancelled';
  startedAt?: string;
  stoppedAt?: string;
  activeHorseIds: string[];
  scratchedHorseIds: string[];
  incidentIds: string[];
  lastEventId: string;
  version: number;
}

export interface HorseLocationProjection {
  horseId: string;
  history: Array<{ zoneId: string; latitude?: number; longitude?: number; observedAt: string; eventId: string }>;
}

export interface SecurityZoneOccupancyProjection {
  zoneId: string;
  occupantIds: string[];
  activeIncidentIds: string[];
  lastObservedAt: string;
}

export interface CqrsProjectionState {
  currentRaceState: RaceStateProjection[];
  horseLocationHistory: HorseLocationProjection[];
  securityZoneOccupancy: SecurityZoneOccupancyProjection[];
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export class CqrsProjectionRebuilder {
  private readonly races = new Map<string, RaceStateProjection>();
  private readonly horseLocations = new Map<string, HorseLocationProjection>();
  private readonly zones = new Map<string, SecurityZoneOccupancyProjection>();

  apply(event: EventEnvelope): void {
    if (event.eventType === 'race.lifecycle.started.v1') this.applyRaceStarted(event as EventEnvelope<RaceStartedPayload & Record<string, unknown>>);
    if (event.eventType === 'race.lifecycle.stopped.v1') this.applyRaceStopped(event);
    if (event.eventType === 'horse.status.scratched.v1') this.applyHorseScratched(event as EventEnvelope<HorseScratchedPayload & Record<string, unknown>>);
    if (event.eventType === 'incident.case.reported.v1') this.applyIncidentReported(event as EventEnvelope<IncidentReportedPayload & Record<string, unknown>>);
    if (event.eventType === 'location.position.updated.v1') this.applyLocationUpdated(event as EventEnvelope<LocationUpdatedPayload & Record<string, unknown>>);
    if (event.eventType === 'camera.detection.recorded.v1') this.applyCameraDetection(event);
  }

  rebuild(events: EventEnvelope[]): CqrsProjectionState {
    this.races.clear();
    this.horseLocations.clear();
    this.zones.clear();
    for (const event of events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))) this.apply(event);
    return this.snapshot();
  }

  snapshot(): CqrsProjectionState {
    return {
      currentRaceState: [...this.races.values()].map(clone),
      horseLocationHistory: [...this.horseLocations.values()].map(clone),
      securityZoneOccupancy: [...this.zones.values()].map(clone),
    };
  }

  private race(raceId: string, event: EventEnvelope): RaceStateProjection {
    const existing = this.races.get(raceId);
    if (existing) return existing;
    const created = { raceId, status: 'scheduled' as const, activeHorseIds: [], scratchedHorseIds: [], incidentIds: [], lastEventId: event.eventId, version: 0 };
    this.races.set(raceId, created);
    return created;
  }

  private zone(zoneId: string, event: EventEnvelope): SecurityZoneOccupancyProjection {
    const existing = this.zones.get(zoneId);
    if (existing) return existing;
    const created = { zoneId, occupantIds: [], activeIncidentIds: [], lastObservedAt: event.occurredAt };
    this.zones.set(zoneId, created);
    return created;
  }

  private applyRaceStarted(event: EventEnvelope<RaceStartedPayload & Record<string, unknown>>): void {
    const race = this.race(event.payload.raceId, event);
    race.status = 'running';
    race.startedAt = event.payload.startedAt;
    race.lastEventId = event.eventId;
    race.version += 1;
  }

  private applyRaceStopped(event: EventEnvelope): void {
    const raceId = String(event.payload.raceId ?? event.aggregateId);
    const race = this.race(raceId, event);
    race.status = 'stopped';
    race.stoppedAt = event.occurredAt;
    race.lastEventId = event.eventId;
    race.version += 1;
  }

  private applyHorseScratched(event: EventEnvelope<HorseScratchedPayload & Record<string, unknown>>): void {
    const race = this.race(event.payload.raceId, event);
    race.scratchedHorseIds = [...new Set([...race.scratchedHorseIds, event.payload.horseId])];
    race.activeHorseIds = race.activeHorseIds.filter((horseId) => horseId !== event.payload.horseId);
    race.lastEventId = event.eventId;
    race.version += 1;
  }

  private applyIncidentReported(event: EventEnvelope<IncidentReportedPayload & Record<string, unknown>>): void {
    const raceId = typeof event.payload.raceId === 'string' ? event.payload.raceId : undefined;
    if (raceId) {
      const race = this.race(raceId, event);
      race.incidentIds = [...new Set([...race.incidentIds, event.payload.incidentId])];
      race.lastEventId = event.eventId;
      race.version += 1;
    }
    if (event.payload.zoneId) {
      const zone = this.zone(event.payload.zoneId, event);
      zone.activeIncidentIds = [...new Set([...zone.activeIncidentIds, event.payload.incidentId])];
      zone.lastObservedAt = event.occurredAt;
    }
  }

  private applyLocationUpdated(event: EventEnvelope<LocationUpdatedPayload & Record<string, unknown>>): void {
    const occupantId = event.payload.horseId ?? event.payload.personId;
    if (!occupantId) return;
    const zone = this.zone(event.payload.zoneId, event);
    zone.occupantIds = [...new Set([...zone.occupantIds, occupantId])];
    zone.lastObservedAt = event.occurredAt;
    if (event.payload.horseId) {
      const history = this.horseLocations.get(event.payload.horseId) ?? { horseId: event.payload.horseId, history: [] };
      history.history.push({ zoneId: event.payload.zoneId, latitude: event.payload.latitude, longitude: event.payload.longitude, observedAt: event.occurredAt, eventId: event.eventId });
      this.horseLocations.set(event.payload.horseId, history);
    }
  }

  private applyCameraDetection(event: EventEnvelope): void {
    const zoneId = typeof event.payload.zoneId === 'string' ? event.payload.zoneId : undefined;
    const subjectId = typeof event.payload.subjectId === 'string' ? event.payload.subjectId : undefined;
    if (!zoneId || !subjectId) return;
    const zone = this.zone(zoneId, event);
    zone.occupantIds = [...new Set([...zone.occupantIds, subjectId])];
    zone.lastObservedAt = event.occurredAt;
  }
}
