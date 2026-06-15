import type { CqrsCommandHandler, CommandHandlingResult } from '../events/index.js';
import { MultiConstellationGnssSynchronizer } from './gnssSynchronizer.js';
import type { RtkIngestionResult, RtkPositionSample, RtkValidationResult, SynchronizedGnssFix } from './rtkTypes.js';

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export interface RtkIngestionOptions {
  targetUpdateRateHz?: number;
  updateRateToleranceHz?: number;
  maxHorizontalAccuracyCm?: number;
  maxVerticalAccuracyCm?: number;
  maxSampleIntervalMs?: number;
  minSampleIntervalMs?: number;
}

export class RtkGpsIngestionService {
  private readonly lastObservedAtByDevice = new Map<string, number>();

  constructor(
    private readonly handler: CqrsCommandHandler,
    private readonly synchronizer = new MultiConstellationGnssSynchronizer(),
    private readonly options: RtkIngestionOptions = {},
  ) {}

  async ingest(sample: RtkPositionSample): Promise<RtkIngestionResult> {
    const validation = this.validate(sample);
    let synchronized: SynchronizedGnssFix | undefined;
    if (validation.valid) {
      try {
        synchronized = this.synchronizer.synchronize(sample);
      } catch (error) {
        validation.valid = false;
        validation.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (!validation.valid) {
      return { accepted: false, blockedReason: validation.errors.join('; '), validation };
    }

    const emitted = await this.emitLocationUpdate(sample, synchronized as SynchronizedGnssFix);
    if (emitted.accepted) this.lastObservedAtByDevice.set(sample.deviceId, Date.parse(sample.observedAt));
    return {
      accepted: emitted.accepted,
      blockedReason: emitted.blockedReason,
      validation,
      synchronized,
      event: emitted.event,
      projection: emitted.projection,
    };
  }

  validate(sample: RtkPositionSample): RtkValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const targetHz = this.options.targetUpdateRateHz ?? 20;
    const toleranceHz = this.options.updateRateToleranceHz ?? 1;
    const maxHorizontal = this.options.maxHorizontalAccuracyCm ?? 2;
    const maxVertical = this.options.maxVerticalAccuracyCm ?? 3;
    const minIntervalMs = this.options.minSampleIntervalMs ?? 45;
    const maxIntervalMs = this.options.maxSampleIntervalMs ?? 55;

    if (!sample.sampleId || !sample.deviceId || !sample.horseId || !sample.raceId) errors.push('sampleId, deviceId, horseId, and raceId are required');
    if (!Number.isFinite(sample.latitude) || sample.latitude < -90 || sample.latitude > 90) errors.push('latitude must be between -90 and 90');
    if (!Number.isFinite(sample.longitude) || sample.longitude < -180 || sample.longitude > 180) errors.push('longitude must be between -180 and 180');
    if (Math.abs(sample.updateRateHz - targetHz) > toleranceHz) errors.push(`updateRateHz must be ${targetHz}Hz +/- ${toleranceHz}Hz`);
    if (sample.horizontalAccuracyCm > maxHorizontal) errors.push(`horizontalAccuracyCm must be <= ${maxHorizontal}cm`);
    if (sample.verticalAccuracyCm > maxVertical) errors.push(`verticalAccuracyCm must be <= ${maxVertical}cm`);
    if (sample.fixType !== 'rtk-fixed') errors.push('RTK ingestion requires rtk-fixed fixType for 1-2 cm race replay');
    if (!sample.evidenceLinks.length) errors.push('RTK samples require evidenceLinks for auditability');
    if (!sample.observations.length) errors.push('GNSS observations are required');

    const observedAt = Date.parse(sample.observedAt);
    if (!Number.isFinite(observedAt)) errors.push('observedAt must be an ISO timestamp');
    const previous = this.lastObservedAtByDevice.get(sample.deviceId);
    if (previous !== undefined && Number.isFinite(observedAt)) {
      const interval = observedAt - previous;
      if (interval < minIntervalMs || interval > maxIntervalMs) warnings.push(`sample interval ${interval}ms outside target 20Hz window ${minIntervalMs}-${maxIntervalMs}ms`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async emitLocationUpdate(sample: RtkPositionSample, synchronized: SynchronizedGnssFix): Promise<CommandHandlingResult> {
    return this.handler.recordMonitoring({
      type: 'location_update',
      aggregateId: sample.horseId,
      tenantId: sample.tenantId,
      racetrackId: sample.racetrackId,
      actorId: sample.deviceId,
      occurredAt: sample.observedAt,
      ai: {
        model_id: 'rtk-gnss-synchronizer-v1',
        confidence: synchronized.qualityScore,
        evidence_links: sample.evidenceLinks,
      },
      payload: {
        horseId: sample.horseId,
        raceId: sample.raceId,
        deviceId: sample.deviceId,
        zoneId: sample.zoneId,
        latitude: sample.latitude,
        longitude: sample.longitude,
        altitudeMeters: sample.altitudeMeters,
        observedAt: sample.observedAt,
        sequence: sample.sequence,
        updateRateHz: sample.updateRateHz,
        horizontalAccuracyCm: sample.horizontalAccuracyCm,
        verticalAccuracyCm: sample.verticalAccuracyCm,
        fixType: sample.fixType,
        correctionSource: sample.correctionSource,
        baseStationId: sample.baseStationId,
        gnss: {
          synchronizedAt: synchronized.synchronizedAt,
          constellations: synchronized.constellations,
          observationCount: synchronized.observationCount,
          maxTimeSkewMs: synchronized.maxTimeSkewMs,
          qualityScore: synchronized.qualityScore,
        },
      },
    });
  }

  observedDevices(): Array<{ deviceId: string; lastObservedAt: string }> {
    return [...this.lastObservedAtByDevice.entries()].map(([deviceId, ms]) => ({ deviceId, lastObservedAt: new Date(ms).toISOString() })).map(clone);
  }
}
