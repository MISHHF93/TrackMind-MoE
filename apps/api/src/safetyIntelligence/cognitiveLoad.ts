import type { AlertDeliveryResult, SafetyAlert } from './types.js';

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export class CognitiveLoadManager {
  private readonly lastDeliveredByKey = new Map<string, number>();
  private readonly queue: SafetyAlert[] = [];

  constructor(private readonly refractoryPeriodMs = 3000, private readonly maxDeliveredPerTick = 1) {}

  enqueue(alerts: SafetyAlert[], now = Date.now()): AlertDeliveryResult {
    this.queue.push(...alerts.map(clone));
    this.queue.sort((left, right) => right.priority - left.priority || left.createdAt.localeCompare(right.createdAt));

    const delivered: SafetyAlert[] = [];
    const suppressed: AlertDeliveryResult['suppressed'] = [];
    const remaining: SafetyAlert[] = [];

    for (const alert of this.queue) {
      const lastDelivered = this.lastDeliveredByKey.get(alert.refractoryKey);
      const retryAfterMs = lastDelivered === undefined ? 0 : Math.max(0, this.refractoryPeriodMs - (now - lastDelivered));
      if (retryAfterMs > 0) {
        suppressed.push({ alert: clone(alert), reason: 'refractory-period-active', retryAfterMs });
        remaining.push(alert);
        continue;
      }
      if (delivered.length >= this.maxDeliveredPerTick) {
        remaining.push(alert);
        continue;
      }
      delivered.push(clone(alert));
      this.lastDeliveredByKey.set(alert.refractoryKey, now);
    }

    this.queue.length = 0;
    this.queue.push(...remaining);

    return {
      delivered,
      suppressed,
      queued: this.queue.map(clone),
      refractoryPeriodMs: this.refractoryPeriodMs,
      unifiedVoice: delivered[0]?.unifiedVoice ?? suppressed[0]?.alert.unifiedVoice ?? this.queue[0]?.unifiedVoice ?? 'TrackMind Safety: no urgent alert.',
    };
  }

  snapshot(): SafetyAlert[] {
    return this.queue.map(clone);
  }
}
