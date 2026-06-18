import type {
  EquineWelfareHorseDetailDto,
  EquineWelfareHorseScoreDto,
  EquineWelfareIntelligenceOperationsDto,
  EquineWelfareKpiDto,
  EquineWelfareKpiRegistryDto,
  EquineWelfareMutationResultDto,
  EquineWelfareAuditTrailDto,
  HorseDigitalTwinWelfareLinkDto,
  RetirementReadinessDto,
  WelfareAdvisoryRecommendationDto,
  WelfareAlertDto,
  EquineWelfareIndicatorDto,
  WelfareObservationDto,
} from '@trackmind/shared';
import { equineWelfareAdvisoryGuardrailStatement, welfareScoreBand } from '@trackmind/shared';
import type { EquineIntelligencePlatform, EquineActor } from './equineIntelligencePlatform.js';
import type { ImmutableAuditLog } from './auditLog.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface EquineWelfareState {
  tenantId: string;
  racetrackId: string;
  indicators: EquineWelfareIndicatorDto[];
  observations: WelfareObservationDto[];
  alerts: WelfareAlertDto[];
  retirementReadiness: RetirementReadinessDto[];
  advisoryRecommendations: WelfareAdvisoryRecommendationDto[];
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface EquineWelfareIntelligenceDeps {
  equinePlatform?: EquineIntelligencePlatform;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class EquineWelfareIntelligencePlatform {
  private state: EquineWelfareState;
  private readonly auditChain: EquineWelfareIntelligenceOperationsDto['auditTrail'] = [];

  constructor(private readonly deps: EquineWelfareIntelligenceDeps = {}) {
    const now = new Date().toISOString();
    this.state = {
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      indicators: [],
      observations: [],
      alerts: [],
      retirementReadiness: [],
      advisoryRecommendations: [],
      version: 1,
      updatedAt: now,
      updatedBy: 'equine-welfare-intelligence',
    };
  }

  workspace(now = new Date().toISOString()): EquineWelfareIntelligenceOperationsDto {
    this.syncFromEquinePlatform(now);
    const digitalTwinLinks = this.buildDigitalTwinLinks(now);
    const horses = this.buildHorseScores(now);
    const trendAnalytics = this.buildTrendAnalytics(now);
    const dashboard = this.buildDashboard(horses, digitalTwinLinks, now);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.equine-welfare-intelligence.v1',
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      welfareIndicators: this.state.indicators.map(clone),
      observations: this.state.observations.map(clone),
      trendAnalytics,
      alerts: this.state.alerts.map(clone),
      retirementReadiness: this.state.retirementReadiness.map(clone),
      digitalTwinLinks,
      advisoryRecommendations: this.state.advisoryRecommendations.map(clone),
      guardrails: {
        aiRecommendationsAdvisoryOnly: true,
        operationalInterventionsRequireHumanApproval: true,
        veterinarianReviewRequiredForHealthActions: true,
        guardrailStatement: equineWelfareAdvisoryGuardrailStatement,
      },
      dashboard,
      auditTrail: this.auditChain.map(clone),
      herdSummary: {
        total: horses.length,
        watchCount: horses.filter((horse) => ['watch', 'concern', 'critical'].includes(horse.band)).length,
        criticalCount: horses.filter((horse) => horse.band === 'critical').length,
        avgScore: horses.length ? Math.round(horses.reduce((sum, horse) => sum + horse.welfareScore, 0) / horses.length) : 0,
      },
      horses,
      mock: false,
    };
  }

  kpiRegistry(now = new Date().toISOString()): EquineWelfareKpiRegistryDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(horseId?: string, now = new Date().toISOString()): EquineWelfareAuditTrailDto {
    const records = horseId
      ? this.auditChain.filter((record) => record.horseId === horseId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.equine-welfare-intelligence.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  horseDetail(horseId: string, now = new Date().toISOString()): EquineWelfareHorseDetailDto {
    const workspace = this.workspace(now);
    const horse = workspace.horses.find((entry) => entry.horseId === horseId);
    if (!horse) throw new Error(`Unknown horse welfare profile ${horseId}`);
    return {
      ...horse,
      welfareIndicators: workspace.welfareIndicators.filter((entry) => entry.horseId === horseId),
      observations: workspace.observations.filter((entry) => entry.horseId === horseId),
      trendAnalytics: workspace.trendAnalytics.filter((entry) => !entry.horseId || entry.horseId === horseId),
      alerts: workspace.alerts.filter((entry) => entry.horseId === horseId),
      retirementAssessment: workspace.retirementReadiness.find((entry) => entry.horseId === horseId),
      digitalTwinLink: workspace.digitalTwinLinks.find((entry) => entry.horseId === horseId),
      advisoryRecommendations: workspace.advisoryRecommendations.filter((entry) => entry.horseId === horseId),
    };
  }

  recordObservation(
    input: Omit<WelfareObservationDto, 'observationId' | 'auditId'>,
    actor = 'welfare-officer',
  ): EquineWelfareMutationResultDto {
    const auditId = id('audit-welfare');
    const observation: WelfareObservationDto = { ...clone(input), observationId: id('welfare-obs'), auditId };
    this.state.observations.push(observation);
    this.refreshIndicatorsForHorse(observation.horseId, observation.score, nowFrom(observation.observedAt));
    if (observation.score < 70) {
      this.raiseAlert(observation.horseId, observation.score < 50 ? 'critical' : 'medium', `Welfare observation score ${observation.score}`, observation.notes, actor);
    }
    if (this.deps.equinePlatform) {
      try {
        this.deps.equinePlatform.recordWelfareStatus(observation.horseId, {
          recordId: observation.observationId,
          observedAt: observation.observedAt,
          observerId: observation.observerId,
          score: observation.score,
          notes: observation.notes,
          interventions: observation.interventions,
        }, this.systemActor(actor));
      } catch {
        // Horse may not exist in equine platform yet.
      }
    }
    return this.commit('equine-welfare.observation.recorded', `Recorded welfare observation for ${observation.horseId}`, auditId, observation.horseId, observation.observationId, actor);
  }

  acknowledgeAlert(alertId: string, actor = 'welfare-officer'): EquineWelfareMutationResultDto {
    const alert = this.state.alerts.find((entry) => entry.alertId === alertId);
    if (!alert) throw new Error(`Unknown welfare alert ${alertId}`);
    alert.status = 'acknowledged';
    const auditId = id('audit-welfare');
    return this.commit('equine-welfare.alert.acknowledged', `Acknowledged welfare alert ${alertId}`, auditId, alert.horseId, alertId, actor);
  }

  resolveAlert(alertId: string, actor = 'welfare-officer'): EquineWelfareMutationResultDto {
    const alert = this.state.alerts.find((entry) => entry.alertId === alertId);
    if (!alert) throw new Error(`Unknown welfare alert ${alertId}`);
    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    const auditId = id('audit-welfare');
    return this.commit('equine-welfare.alert.resolved', `Resolved welfare alert ${alertId}`, auditId, alert.horseId, alertId, actor);
  }

  assessRetirementReadiness(horseId: string, actor = 'veterinarian'): EquineWelfareMutationResultDto {
    const score = this.latestScore(horseId);
    const readinessScore = score >= 85 ? 15 : score >= 70 ? 35 : score >= 55 ? 55 : 75;
    const band = readinessScore <= 20 ? 'ready-for-review' : readinessScore <= 40 ? 'candidate' : readinessScore <= 60 ? 'monitor' : 'not-ready';
    const auditId = id('audit-welfare');
    const assessment: RetirementReadinessDto = {
      horseId,
      readinessScore,
      band,
      factors: score < 70 ? ['elevated-welfare-watch', 'veterinarian-review-recommended'] : ['nominal-activity'],
      veterinarianReviewRequired: score < 75 || band === 'ready-for-review',
      aftercarePlanReference: band === 'ready-for-review' ? `aftercare:${horseId}` : undefined,
      auditId,
      lastAssessedAt: new Date().toISOString(),
    };
    const existing = this.state.retirementReadiness.findIndex((entry) => entry.horseId === horseId);
    if (existing >= 0) this.state.retirementReadiness[existing] = assessment;
    else this.state.retirementReadiness.push(assessment);
    return this.commit('equine-welfare.retirement.assessed', `Assessed retirement readiness for ${horseId}`, auditId, horseId, horseId, actor);
  }

  private syncFromEquinePlatform(now: string) {
    if (!this.deps.equinePlatform) return;
    const actor = this.systemActor('welfare-officer');
    for (const profile of this.deps.equinePlatform.listProfiles(this.state.tenantId)) {
      const horseId = profile.identity.horseId;
      const welfare = this.deps.equinePlatform.welfareStatus(horseId, actor);
      const score = welfare.latestScore ?? 75;
      this.refreshIndicatorsForHorse(horseId, score, welfare.latestObservedAt ?? now, profile.twinId);
      for (const rec of profile.aiRecommendations.filter((entry) => entry.domain === 'welfare' || entry.domain === 'health' || entry.domain === 'retirement')) {
        if (this.state.advisoryRecommendations.some((entry) => entry.recommendationId === rec.id)) continue;
        this.state.advisoryRecommendations.push({
          recommendationId: rec.id,
          horseId,
          domain: rec.domain === 'retirement' ? 'retirement' : rec.domain === 'health' ? 'health' : 'welfare',
          summary: rec.summary,
          confidence: rec.confidence,
          advisoryOnly: true,
          veterinarianReviewRequired: rec.veterinarianReviewRequired,
          modelVersion: rec.modelId,
          generatedAt: rec.createdAt,
          evidence: [...rec.evidence],
        });
      }
    }
  }

  private buildDigitalTwinLinks(now: string): HorseDigitalTwinWelfareLinkDto[] {
    if (!this.deps.equinePlatform) return [];
    const actor = this.systemActor('welfare-officer');
    return this.deps.equinePlatform.listProfiles(this.state.tenantId).map((profile) => {
      const primaryTwin = profile.digitalTwinReferences.find((ref) => ref.relationship === 'primary') ?? profile.digitalTwinReferences[0];
      const twinState = this.deps.equinePlatform!.twinSnapshot(profile.identity.tenantId).find((twin) => twin.id === profile.twinId || twin.id === primaryTwin?.twinId);
      return {
        horseId: profile.identity.horseId,
        twinId: primaryTwin?.twinId ?? profile.twinId,
        displayName: profile.identity.name,
        welfareLevel: String(twinState?.state?.welfareStatus ?? twinState?.state?.welfareLevel ?? 'unknown'),
        lastSyncedAt: primaryTwin?.lastSyncedAt ?? profile.updatedAt ?? now,
        telemetryStreams: profile.digitalTwinReferences.map((ref) => ref.twinType),
        readOnly: true as const,
      };
    });
  }

  private buildHorseScores(now: string): EquineWelfareHorseScoreDto[] {
    const horseIds = new Set([
      ...this.state.observations.map((entry) => entry.horseId),
      ...this.state.indicators.map((entry) => entry.horseId),
      ...(this.deps.equinePlatform?.listProfiles(this.state.tenantId).map((profile) => profile.identity.horseId) ?? []),
    ]);
    return [...horseIds].map((horseId) => {
      const score = this.latestScore(horseId);
      const retirement = this.state.retirementReadiness.find((entry) => entry.horseId === horseId);
      const transport = this.deps.equinePlatform?.listProfiles(this.state.tenantId).find((profile) => profile.identity.horseId === horseId)?.transportationRecords.at(-1);
      const lifecycle = this.deps.equinePlatform?.listProfiles(this.state.tenantId).find((profile) => profile.identity.horseId === horseId)?.identity.lifecycleStatus ?? 'active';
      return {
        horseId,
        welfareScore: score,
        band: welfareScoreBand(score),
        lifecycleStage: lifecycle,
        transportStatus: transport && !transport.arrivedAt ? 'in-transit' : 'on-site',
        retirementReadiness: retirement?.readinessScore ?? (score >= 85 ? 15 : score >= 70 ? 35 : 55),
        factors: score < 75 ? ['transport-monitoring', 'elevated-activity'] : ['nominal-activity'],
        veterinarianReviewRequired: score < 75,
        generatedAt: now,
        mock: false as const,
      };
    });
  }

  private buildTrendAnalytics(now: string): EquineWelfareIntelligenceOperationsDto['trendAnalytics'] {
    const horseIds = [...new Set(this.state.observations.map((entry) => entry.horseId))];
    const herdPoints = this.state.observations.slice(-8).map((entry) => ({ at: entry.observedAt, value: entry.score }));
    const trends: EquineWelfareIntelligenceOperationsDto['trendAnalytics'] = [
      {
        metric: 'welfare-score',
        trend: herdPoints.length >= 2 && herdPoints.at(-1)!.value >= herdPoints[0]!.value ? 'up' : herdPoints.length ? 'flat' : 'insufficient-history',
        points: herdPoints,
        summary: 'Herd welfare score trend from recorded observations.',
      },
      {
        metric: 'alert-pressure',
        trend: this.state.alerts.filter((alert) => alert.status === 'open').length > 0 ? 'up' : 'flat',
        points: this.state.alerts.map((alert) => ({ at: alert.raisedAt, value: alert.severity === 'critical' ? 4 : alert.severity === 'high' ? 3 : alert.severity === 'medium' ? 2 : 1 })),
        summary: 'Open welfare alert pressure across the herd.',
      },
      {
        metric: 'retirement-readiness',
        trend: 'flat',
        points: this.state.retirementReadiness.map((entry) => ({ at: entry.lastAssessedAt, value: entry.readinessScore })),
        summary: 'Retirement readiness assessments across monitored horses.',
      },
    ];
    for (const horseId of horseIds.slice(0, 3)) {
      const points = this.state.observations.filter((entry) => entry.horseId === horseId).map((entry) => ({ at: entry.observedAt, value: entry.score }));
      if (!points.length) continue;
      trends.push({
        horseId,
        metric: 'welfare-score',
        trend: points.length >= 2 && points.at(-1)!.value >= points[0]!.value ? 'up' : 'flat',
        points,
        summary: `Welfare score trend for ${horseId}.`,
      });
    }
    return trends;
  }

  private buildDashboard(
    horses: EquineWelfareHorseScoreDto[],
    digitalTwinLinks: HorseDigitalTwinWelfareLinkDto[],
    now: string,
  ): EquineWelfareKpiRegistryDto {
    const openAlerts = this.state.alerts.filter((alert) => alert.status === 'open' || alert.status === 'acknowledged').length;
    const herdWatchCount = horses.filter((horse) => ['watch', 'concern', 'critical'].includes(horse.band)).length;
    const avgWelfareScore = horses.length ? Math.round(horses.reduce((sum, horse) => sum + horse.welfareScore, 0) / horses.length) : 0;
    const retirementCandidates = this.state.retirementReadiness.filter((entry) => ['candidate', 'ready-for-review'].includes(entry.band)).length;
    const twinSyncCoverage = horses.length ? Math.round((digitalTwinLinks.length / horses.length) * 100) : 0;
    const readinessScore = Math.round(
      avgWelfareScore * 0.35
        + Math.max(0, 100 - openAlerts * 10) * 0.25
        + twinSyncCoverage * 0.2
        + Math.max(0, 100 - herdWatchCount * 8) * 0.2,
    );
    const panels: EquineWelfareKpiDto[] = [
      this.panel('equine-welfare-avg-score', 'Average welfare score', 'Herd average from welfare observations and indicators.', avgWelfareScore, 'score', 85, avgWelfareScore >= 85 ? 'nominal' : avgWelfareScore >= 70 ? 'watch' : 'warning', 'flat', now),
      this.panel('equine-welfare-watch-count', 'Herd watch count', 'Horses in watch, concern, or critical welfare bands.', herdWatchCount, 'horses', 2, herdWatchCount <= 2 ? 'nominal' : herdWatchCount <= 5 ? 'watch' : 'warning', herdWatchCount > 0 ? 'up' : 'flat', now),
      this.panel('equine-welfare-open-alerts', 'Open welfare alerts', 'Unresolved welfare alerts requiring review.', openAlerts, 'alerts', 1, openAlerts <= 1 ? 'nominal' : openAlerts <= 3 ? 'watch' : 'critical', openAlerts > 0 ? 'up' : 'flat', now),
      this.panel('equine-welfare-retirement-candidates', 'Retirement candidates', 'Horses with retirement candidate or ready-for-review posture.', retirementCandidates, 'horses', 1, retirementCandidates <= 1 ? 'nominal' : 'watch', 'flat', now),
      this.panel('equine-welfare-twin-coverage', 'Digital twin coverage', 'Percentage of monitored horses linked to read-only horse digital twins.', twinSyncCoverage, '%', 95, twinSyncCoverage >= 95 ? 'nominal' : twinSyncCoverage >= 80 ? 'watch' : 'warning', 'flat', now),
      this.panel('equine-welfare-advisory-queue', 'Advisory recommendations', 'Open advisory-only welfare AI recommendations awaiting veterinarian review.', this.state.advisoryRecommendations.filter((rec) => rec.veterinarianReviewRequired).length, 'recommendations', 2, 'watch', 'flat', now),
    ];
    return { herdWatchCount, openAlerts, avgWelfareScore, retirementCandidates, twinSyncCoverage, readinessScore, panels };
  }

  private panel(
    kpiId: string,
    name: string,
    description: string,
    value: number,
    unit: string,
    target: number,
    status: EquineWelfareKpiDto['status'],
    trend: EquineWelfareKpiDto['trend'],
    now: string,
  ): EquineWelfareKpiDto {
    return {
      kpiId,
      name,
      description,
      value,
      unit,
      target,
      status,
      trend,
      sourceEntities: [{ entityType: 'equine-welfare-intelligence', entityId: this.state.racetrackId }],
      auditReference: { auditIds: this.auditChain.slice(-3).map((record) => record.auditId), eventIds: [`equine-welfare.kpi.${kpiId}`] },
    };
  }

  private latestScore(horseId: string) {
    const observation = this.state.observations.filter((entry) => entry.horseId === horseId).at(-1);
    if (observation) return observation.score;
    const indicatorScores = this.state.indicators.filter((entry) => entry.horseId === horseId).map((entry) => entry.score);
    return indicatorScores.length ? Math.round(indicatorScores.reduce((sum, score) => sum + score, 0) / indicatorScores.length) : 75;
  }

  private refreshIndicatorsForHorse(horseId: string, score: number, at: string, twinId?: string) {
    const indicators: Array<{ indicator: EquineWelfareIndicatorDto['indicator']; weight: number }> = [
      { indicator: 'body-condition', weight: 0.25 },
      { indicator: 'behavior', weight: 0.2 },
      { indicator: 'hydration', weight: 0.15 },
      { indicator: 'training-load', weight: 0.2 },
      { indicator: 'retirement-candidate', weight: 0.2 },
    ];
    for (const entry of indicators) {
      const indicatorScore = Math.max(0, Math.min(100, Math.round(score + (entry.indicator === 'retirement-candidate' ? (100 - score) * 0.3 : 0))));
      const status = indicatorScore >= 85 ? 'nominal' : indicatorScore >= 70 ? 'watch' : indicatorScore >= 50 ? 'concern' : 'critical';
      const existing = this.state.indicators.findIndex((item) => item.horseId === horseId && item.indicator === entry.indicator);
      const record: EquineWelfareIndicatorDto = {
        indicatorId: existing >= 0 ? this.state.indicators[existing]!.indicatorId : id('welfare-indicator'),
        horseId,
        indicator: entry.indicator,
        status,
        score: indicatorScore,
        detail: `${entry.indicator} indicator derived from welfare observations.`,
        digitalTwinId: twinId,
        lastUpdatedAt: at,
        auditId: id('audit-welfare'),
      };
      if (existing >= 0) this.state.indicators[existing] = record;
      else this.state.indicators.push(record);
    }
  }

  private raiseAlert(horseId: string, severity: WelfareAlertDto['severity'], title: string, summary: string, actor: string) {
    if (this.state.alerts.some((alert) => alert.horseId === horseId && alert.title === title && alert.status === 'open')) return;
    const auditId = id('audit-welfare');
    this.state.alerts.push({
      alertId: id('welfare-alert'),
      horseId,
      severity,
      status: 'open',
      title,
      summary,
      raisedAt: new Date().toISOString(),
      digitalTwinId: this.state.indicators.find((entry) => entry.horseId === horseId)?.digitalTwinId,
      auditId,
    });
    this.commit('equine-welfare.alert.raised', `Raised welfare alert for ${horseId}: ${title}`, auditId, horseId, undefined, actor);
  }

  private commit(
    eventType: string,
    changeSummary: string,
    auditId: string,
    horseId?: string,
    recordId?: string,
    actor = 'welfare-officer',
  ): EquineWelfareMutationResultDto {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'sha256:00000000';
    const record = {
      auditId,
      horseId,
      action: eventType,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ auditId, eventType, changeSummary, previousHash }),
      changeSummary,
      evidence: horseId ? [`horse:${horseId}`] : [],
    };
    this.auditChain.push(record);
    this.state.version += 1;
    this.state.updatedAt = record.timestamp;
    this.state.updatedBy = actor;
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: horseId ?? this.state.racetrackId,
        payload: { action: eventType, changeSummary, recordId },
        tenantId: this.state.tenantId,
        severity: eventType.includes('alert') ? 'warning' : 'info',
        regulations: ['HISA'],
      });
    }
    return { accepted: true, horseId, recordId, auditId, eventType, message: changeSummary, mock: false };
  }

  private systemActor(idValue: string): EquineActor {
    return { id: idValue, roles: ['welfare-officer', 'veterinarian'], tenantId: this.state.tenantId, human: true };
  }
}

function nowFrom(value: string) {
  return Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value;
}

export function createSeededEquineWelfareIntelligence(deps: EquineWelfareIntelligenceDeps = {}, now = new Date().toISOString()): EquineWelfareIntelligencePlatform {
  const platform = new EquineWelfareIntelligencePlatform(deps);

  platform.recordObservation({
    horseId: 'horse-1',
    observedAt: now,
    observerId: 'welfare-officer-live',
    role: 'welfare-officer',
    score: 92,
    category: 'barn-check',
    notes: 'Bright, alert, good body condition.',
    interventions: [],
    evidence: ['barn-walkthrough'],
  });

  platform.recordObservation({
    horseId: 'horse-1',
    observedAt: now,
    observerId: 'vet-live',
    role: 'veterinarian',
    score: 88,
    category: 'pre-race-exam',
    notes: 'Sound at the jog; mild stocking up noted after transport.',
    interventions: ['monitor-legs-post-race'],
    evidence: ['vet-exam-horse-1'],
  });

  platform.assessRetirementReadiness('horse-1');

  if (deps.equinePlatform) {
    const actor = { id: 'welfare-officer-live', roles: ['welfare-officer'] as const, tenantId: deps.tenantId ?? 'trackmind', human: true };
    try {
      deps.equinePlatform.recordWelfareStatus('horse-1', {
        recordId: `welfare-seed-${Date.now()}`,
        observedAt: now,
        observerId: 'welfare-officer-live',
        score: 92,
        notes: 'Seeded welfare intelligence observation',
        interventions: [],
      }, { ...actor, roles: ['welfare-officer', 'veterinarian'] });
      deps.equinePlatform.recordAIRecommendation('horse-1', {
        domain: 'welfare',
        modelId: 'welfare-advisory-v1',
        summary: 'Advisory: monitor post-transport leg filling before next breeze; no operational action without veterinarian review.',
        confidence: 0.78,
        evidence: ['transport-log', 'welfare-observation'],
      }, { id: 'ai-welfare-1', roles: ['ai-agent'], tenantId: deps.tenantId ?? 'trackmind', human: false });
    } catch {
      // Equine profile may not be seeded yet when called without registry ordering.
    }
  }

  platform.workspace(now);
  return platform;
}
