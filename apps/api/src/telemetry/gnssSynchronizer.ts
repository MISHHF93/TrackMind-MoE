import type { GnssConstellation, GnssObservation, RtkPositionSample, SynchronizedGnssFix } from './rtkTypes.js';

const requiredConstellations: GnssConstellation[] = ['GPS', 'GLONASS', 'Galileo', 'BeiDou'];

export interface GnssSynchronizationOptions {
  required?: GnssConstellation[];
  maxTimeSkewMs?: number;
  minCn0DbHz?: number;
}

function timestampMs(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid GNSS timestamp: ${value}`);
  return parsed;
}

export class MultiConstellationGnssSynchronizer {
  constructor(private readonly options: GnssSynchronizationOptions = {}) {}

  synchronize(sample: RtkPositionSample): SynchronizedGnssFix {
    const required = this.options.required ?? requiredConstellations;
    const maxTimeSkewMs = this.options.maxTimeSkewMs ?? 15;
    const minCn0DbHz = this.options.minCn0DbHz ?? 28;
    const byConstellation = new Map<GnssConstellation, GnssObservation[]>();
    for (const observation of sample.observations) {
      const rows = byConstellation.get(observation.constellation) ?? [];
      rows.push(observation);
      byConstellation.set(observation.constellation, rows);
    }

    const missing = required.filter((constellation) => !byConstellation.has(constellation));
    if (missing.length) throw new Error(`Missing GNSS constellations: ${missing.join(', ')}`);

    const times = sample.observations.map((observation) => timestampMs(observation.observedAt));
    const maxObservedAt = Math.max(...times);
    const minObservedAt = Math.min(...times);
    const skew = maxObservedAt - minObservedAt;
    if (skew > maxTimeSkewMs) throw new Error(`GNSS constellation observations exceed synchronization tolerance: ${skew}ms > ${maxTimeSkewMs}ms`);

    const usable = sample.observations.filter((observation) => observation.cn0DbHz >= minCn0DbHz);
    const averageCn0 = usable.reduce((sum, observation) => sum + observation.cn0DbHz, 0) / Math.max(1, usable.length);
    const constellationScore = required.length / requiredConstellations.length;
    const skewScore = Math.max(0, 1 - skew / maxTimeSkewMs);
    const signalScore = Math.min(1, averageCn0 / 45);
    const qualityScore = Math.round((0.45 * constellationScore + 0.25 * skewScore + 0.30 * signalScore) * 1000) / 1000;

    return {
      sample,
      constellations: [...byConstellation.keys()],
      observationCount: sample.observations.length,
      maxTimeSkewMs: skew,
      qualityScore,
      synchronizedAt: new Date(maxObservedAt).toISOString(),
    };
  }
}

export { requiredConstellations };
