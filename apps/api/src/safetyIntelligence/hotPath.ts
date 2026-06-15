import type { HotPathResult, SafetyAlert, SafetyTelemetryFrame } from './types.js';

const id = (prefix: string, frameId: string) => `${prefix}-${frameId}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

export class EdgeHotPathSafetyEngine {
  constructor(private readonly targetLatencyMs = 10) {}

  evaluate(frame: SafetyTelemetryFrame): HotPathResult {
    const started = performance.now();
    const alerts: SafetyAlert[] = [];

    if (frame.trackCondition === 'unsafe') {
      alerts.push(this.alert(frame, 'critical', 100, 'Unsafe track condition', 'Hold position and await human safety steward clearance.', ['track-condition:unsafe']));
    }
    if ((frame.distanceToNearestSubjectMeters ?? Number.POSITIVE_INFINITY) < 2.5 && (frame.closingSpeedMetersPerSecond ?? 0) > 4) {
      alerts.push(this.alert(frame, 'critical', 98, 'Closing-distance collision risk', 'Increase separation now; safety steward approval required for any control override.', ['proximity:<2.5m', 'closing-speed:>4mps']));
    }
    if ((frame.distanceToRailMeters ?? Number.POSITIVE_INFINITY) < 1.2 && (frame.lateralAccelerationG ?? 0) > 0.45) {
      alerts.push(this.alert(frame, 'warning', 82, 'Rail proximity under lateral load', 'Reduce lateral load and widen line when safe.', ['rail-distance:<1.2m', 'lateral-g:>0.45']));
    }
    if ((frame.accelerationMetersPerSecond2 ?? 0) < -7.5) {
      alerts.push(this.alert(frame, 'warning', 75, 'Abrupt deceleration detected', 'Check for stumble, traffic compression, or equipment issue.', ['deceleration:<-7.5mps2']));
    }

    const measuredLatencyMs = Math.round((performance.now() - started) * 1000) / 1000;
    return {
      accepted: true,
      targetLatencyMs: this.targetLatencyMs,
      measuredLatencyMs,
      withinBudget: measuredLatencyMs <= this.targetLatencyMs,
      alerts,
      evidenceLinks: frame.evidenceLinks,
    };
  }

  private alert(frame: SafetyTelemetryFrame, severity: SafetyAlert['severity'], priority: number, title: string, recommendedAction: string, evidence: string[]): SafetyAlert {
    return {
      id: id('alert-hot', frame.frameId),
      raceId: frame.raceId,
      subjectId: frame.subjectId,
      severity,
      priority,
      title,
      unifiedVoice: `TrackMind Safety: ${title}. ${recommendedAction}`,
      recommendedAction,
      approvalRequiredForControlAction: true,
      confidence: Math.min(1, Math.max(0, frame.confidence)),
      evidenceLinks: [...frame.evidenceLinks, ...evidence],
      createdAt: nowIso(),
      refractoryKey: `${frame.raceId}:${frame.subjectId}:${title}`,
      source: 'hot-path-edge',
    };
  }
}
