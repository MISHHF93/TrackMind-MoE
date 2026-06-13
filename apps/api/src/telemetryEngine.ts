export type TelemetrySource = 'sensor' | 'camera' | 'weather' | 'operations' | 'biometric' | 'wagering';

export interface TelemetryEvent<T = Record<string, unknown>> {
  id: string;
  source: TelemetrySource;
  subjectId: string;
  observedAt: string;
  payload: T;
}

export interface TelemetryBatchResult {
  accepted: number;
  rejected: number;
  eventsPerMinuteCapacity: number;
  backpressure: boolean;
  errors: string[];
}

export class TelemetryEngine {
  private readonly minuteBuckets = new Map<string, number>();
  private readonly buffer: TelemetryEvent[] = [];

  constructor(private readonly targetEventsPerMinute = 100_000) {}

  ingest(events: TelemetryEvent[]): TelemetryBatchResult {
    const errors: string[] = [];
    let accepted = 0;
    for (const event of events) {
      if (!event.id || !event.subjectId || Number.isNaN(Date.parse(event.observedAt))) {
        errors.push(`invalid event ${event.id || '<missing>'}`);
        continue;
      }
      const bucket = event.observedAt.slice(0, 16);
      this.minuteBuckets.set(bucket, (this.minuteBuckets.get(bucket) ?? 0) + 1);
      this.buffer.push(event);
      accepted += 1;
    }
    return { accepted, rejected: errors.length, eventsPerMinuteCapacity: this.targetEventsPerMinute, backpressure: accepted > this.targetEventsPerMinute, errors };
  }

  drain(maxEvents = this.buffer.length): TelemetryEvent[] {
    return this.buffer.splice(0, maxEvents);
  }

  throughput(bucket: string): number {
    return this.minuteBuckets.get(bucket) ?? 0;
  }
}
