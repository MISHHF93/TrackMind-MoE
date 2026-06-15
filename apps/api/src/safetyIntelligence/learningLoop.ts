import type { RaceDebriefInput, RaceDebriefReport, SafetySeverity } from './types.js';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityPenalty(severity: SafetySeverity): number {
  if (severity === 'critical') return 18;
  if (severity === 'warning') return 9;
  if (severity === 'advisory') return 3;
  return 0;
}

export class PostRaceLearningLoopService {
  createDebrief(input: RaceDebriefInput): RaceDebriefReport {
    const alertPenalty = input.alerts.reduce((sum, alert) => sum + severityPenalty(alert.severity), 0);
    const incidentPenalty = input.incidents.reduce((sum, incident) => sum + severityPenalty(incident.severity), 0);
    const maxLateral = Math.max(0, ...input.telemetryFrames.map((frame) => frame.lateralAccelerationG ?? 0));
    const abruptFrames = input.telemetryFrames.filter((frame) => (frame.accelerationMetersPerSecond2 ?? 0) < -7.5).length;
    const compressionFrames = input.telemetryFrames.filter((frame) => (frame.distanceToNearestSubjectMeters ?? Number.POSITIVE_INFINITY) < 3).length;
    const unsafeFrames = input.telemetryFrames.filter((frame) => frame.trackCondition === 'unsafe').length;

    const safety = clampScore(100 - alertPenalty - incidentPenalty - unsafeFrames * 12);
    const smoothness = clampScore(100 - maxLateral * 45 - abruptFrames * 8);
    const situationalAwareness = clampScore(100 - compressionFrames * 10 - input.alerts.filter((alert) => alert.priority >= 80).length * 6);
    const compliance = clampScore(100 - input.alerts.filter((alert) => alert.approvalRequiredForControlAction).length * 2);
    const driverScore = clampScore((safety * 0.35) + (smoothness * 0.25) + (situationalAwareness * 0.25) + (compliance * 0.15));
    const evidenceLinks = [...new Set([
      ...input.telemetryFrames.flatMap((frame) => frame.evidenceLinks),
      ...input.alerts.flatMap((alert) => alert.evidenceLinks),
      ...input.incidents.flatMap((incident) => incident.evidenceLinks),
    ])];

    return {
      raceId: input.raceId,
      driverId: input.driverId,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      driverScore,
      scoreBreakdown: { safety, smoothness, situationalAwareness, compliance },
      actionPlan: this.actionPlan({ safety, smoothness, situationalAwareness, compliance }, evidenceLinks),
      evidenceLinks,
      approvalRequiredForOperationalChanges: true,
    };
  }

  private actionPlan(scores: RaceDebriefReport['scoreBreakdown'], evidenceLinks: string[]): RaceDebriefReport['actionPlan'] {
    const actions: RaceDebriefReport['actionPlan'] = [];
    if (scores.safety < 85) actions.push({ priority: 'high', action: 'Review safety alerts with steward before next race assignment.', evidenceLinks });
    if (scores.smoothness < 85) actions.push({ priority: 'medium', action: 'Run smoothness drill focused on braking transitions and lateral-load control.', evidenceLinks });
    if (scores.situationalAwareness < 85) actions.push({ priority: 'medium', action: 'Replay compression-risk moments and identify earlier separation cues.', evidenceLinks });
    if (scores.compliance < 95) actions.push({ priority: 'low', action: 'Confirm protected-control escalation workflow and approval evidence handling.', evidenceLinks });
    if (!actions.length) actions.push({ priority: 'low', action: 'Maintain current racecraft plan; continue standard telemetry review.', evidenceLinks });
    return actions;
  }
}
