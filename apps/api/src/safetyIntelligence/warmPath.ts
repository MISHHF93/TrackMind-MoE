import type { PersonaId, PersonaRecommendation, SafetyAlert, SafetyTelemetryFrame, WarmPathAnalysisResult } from './types.js';

const id = (prefix: string, raceId: string) => `${prefix}-${raceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface WarmPathContext {
  raceId: string;
  frames: SafetyTelemetryFrame[];
  recentAlerts?: SafetyAlert[];
  evidenceLinks: string[];
}

const personaRoles: Record<PersonaId, string> = {
  AJ: 'racecraft and line discipline analyst',
  Ross: 'operations and risk-control analyst',
  Gemini: 'multimodal synthesis analyst',
};

export class SquadWarmPathSafetyAnalyst {
  constructor(private readonly targetLatencyMs = 1500) {}

  analyze(context: WarmPathContext): WarmPathAnalysisResult {
    const personas: PersonaRecommendation[] = [
      this.aj(context),
      this.ross(context),
      this.gemini(context),
    ];
    const highest = [...personas].sort((left, right) => right.confidence - left.confidence)[0];
    const critical = personas.some((persona) => persona.summary.toLowerCase().includes('critical') || persona.confidence >= 0.9);
    const synthesizedAlert: SafetyAlert | undefined = highest ? {
      id: id('alert-warm', context.raceId),
      raceId: context.raceId,
      subjectId: context.frames.at(-1)?.subjectId ?? 'race-field',
      severity: critical ? 'warning' : 'advisory',
      priority: critical ? 70 : 45,
      title: 'Squad safety synthesis',
      unifiedVoice: `TrackMind Safety: ${highest.recommendation}`,
      recommendedAction: highest.recommendation,
      approvalRequiredForControlAction: true,
      confidence: Math.max(...personas.map((persona) => persona.confidence)),
      evidenceLinks: [...new Set([...context.evidenceLinks, ...personas.flatMap((persona) => persona.evidenceLinks)])],
      createdAt: new Date().toISOString(),
      refractoryKey: `${context.raceId}:warm-path:squad-synthesis`,
      source: 'warm-path-cloud',
    } : undefined;

    return {
      targetLatencyMs: this.targetLatencyMs,
      estimatedLatencyMs: 1500,
      personas,
      synthesizedAlert,
      evidenceLinks: [...new Set([...context.evidenceLinks, ...personas.flatMap((persona) => persona.evidenceLinks)])],
    };
  }

  private aj(context: WarmPathContext): PersonaRecommendation {
    const maxLateral = Math.max(0, ...context.frames.map((frame) => frame.lateralAccelerationG ?? 0));
    const tightRailFrames = context.frames.filter((frame) => (frame.distanceToRailMeters ?? Number.POSITIVE_INFINITY) < 1.5).length;
    const concern = maxLateral > 0.45 || tightRailFrames > 0;
    return {
      persona: 'AJ',
      role: personaRoles.AJ,
      summary: concern ? 'Line discipline is under pressure near the rail.' : 'Line discipline looks stable.',
      recommendation: concern ? 'Widen the line when safe and avoid compounding lateral load near the rail.' : 'Maintain current line discipline and continue monitoring.',
      confidence: concern ? 0.84 : 0.68,
      evidenceLinks: [...context.evidenceLinks, `persona://AJ/lateral-g/${maxLateral.toFixed(2)}`],
    };
  }

  private ross(context: WarmPathContext): PersonaRecommendation {
    const severeAlerts = (context.recentAlerts ?? []).filter((alert) => alert.severity === 'critical' || alert.severity === 'warning').length;
    const unsafeFrames = context.frames.filter((frame) => frame.trackCondition === 'unsafe' || frame.trackCondition === 'wet').length;
    const concern = severeAlerts > 0 || unsafeFrames > 0;
    return {
      persona: 'Ross',
      role: personaRoles.Ross,
      summary: concern ? 'Operational risk is elevated and should remain under steward review.' : 'Operational risk is within normal monitoring bounds.',
      recommendation: concern ? 'Keep control actions approval-gated and prepare a steward-reviewed caution package.' : 'Keep monitoring without escalating to control action.',
      confidence: concern ? 0.88 : 0.7,
      evidenceLinks: [...context.evidenceLinks, `persona://Ross/recent-alerts/${severeAlerts}`],
    };
  }

  private gemini(context: WarmPathContext): PersonaRecommendation {
    const closest = Math.min(...context.frames.map((frame) => frame.distanceToNearestSubjectMeters ?? Number.POSITIVE_INFINITY));
    const closing = Math.max(0, ...context.frames.map((frame) => frame.closingSpeedMetersPerSecond ?? 0));
    const concern = closest < 3 || closing > 4;
    return {
      persona: 'Gemini',
      role: personaRoles.Gemini,
      summary: concern ? 'Multimodal telemetry suggests compression risk.' : 'Multimodal telemetry does not show immediate compression risk.',
      recommendation: concern ? 'Prioritize separation messaging and keep the next alert concise for operator load.' : 'Continue normal telemetry watch with low cognitive load.',
      confidence: concern ? 0.91 : 0.66,
      evidenceLinks: [...context.evidenceLinks, `persona://Gemini/closest/${Number.isFinite(closest) ? closest.toFixed(2) : 'unknown'}`],
    };
  }
}
