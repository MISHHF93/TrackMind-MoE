import {
  computeKpiTrend,
  evaluateKpiStatus,
  type KPIArtifact,
  type KPIHistoricalSnapshot,
  type KPIDomain,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

export interface KpiCalculationInput {
  eventCount?: number;
  approvalPendingCount?: number;
  incidentOpenCount?: number;
  readinessScore?: number;
  domainScores?: Partial<Record<KPIDomain, number>>;
  dataQualityScore?: number;
  systemHealthScore?: number;
  eventProjections?: Record<string, number>;
}

export interface KpiEventProjectionSource {
  eventType: string;
  projectedValue: number;
  weight: number;
}

export function consolidateKpiProjectionSources(kpis: KPIArtifact[], input: KpiCalculationInput): KpiEventProjectionSource[] {
  const eventRefs = new Set<string>();
  for (const kpi of kpis) {
    for (const eventRef of kpi.sourceEvents) eventRefs.add(eventRef);
  }
  const sources: KpiEventProjectionSource[] = [];
  for (const eventType of eventRefs) {
    let projectedValue = input.eventProjections?.[eventType];
    if (projectedValue == null) {
      if (/approval/.test(eventType) && input.approvalPendingCount != null) projectedValue = input.approvalPendingCount;
      else if (/incident|emergency|alert/.test(eventType) && input.incidentOpenCount != null) projectedValue = input.incidentOpenCount;
      else if (/readiness|health|quality/.test(eventType) && input.readinessScore != null) projectedValue = input.readinessScore;
      else if (/event/.test(eventType) && input.eventCount != null) projectedValue = input.eventCount;
      else if (/data-quality|quality/.test(eventType) && input.dataQualityScore != null) projectedValue = input.dataQualityScore;
      else if (/platform\.health/.test(eventType) && input.systemHealthScore != null) projectedValue = input.systemHealthScore;
    }
    if (projectedValue != null) {
      sources.push({ eventType, projectedValue, weight: 1 });
    }
  }
  return sources;
}

export class KpiCalculationService {
  calculateFromProjections(kpis: KPIArtifact[], input: KpiCalculationInput): KPIArtifact[] {
    const projectionSources = consolidateKpiProjectionSources(kpis, input);
    const projectionByEvent = new Map(projectionSources.map((source) => [source.eventType, source.projectedValue]));

    return kpis.map((kpi) => {
      let value = kpi.value;
      if (input.domainScores?.[kpi.domain] !== undefined) value = input.domainScores[kpi.domain]!;
      else if (kpi.kpiId.includes('readiness') && input.readinessScore !== undefined) value = input.readinessScore;
      else if (kpi.domain === 'race-day-operations' && input.readinessScore !== undefined) value = input.readinessScore;
      else if (kpi.domain === 'approval-workflows' && input.approvalPendingCount !== undefined) value = input.approvalPendingCount;
      else if (kpi.domain === 'safety-incidents' && input.incidentOpenCount !== undefined) value = input.incidentOpenCount;
      else if (kpi.domain === 'data-quality' && input.dataQualityScore !== undefined) value = input.dataQualityScore;
      else if (kpi.domain === 'system-health' && input.systemHealthScore !== undefined) value = input.systemHealthScore;
      else if (kpi.kpiId.includes('approval') && input.approvalPendingCount !== undefined) value = input.approvalPendingCount;
      else if (kpi.kpiId.includes('incident') && input.incidentOpenCount !== undefined) value = input.incidentOpenCount;
      else {
        const matched = kpi.sourceEvents
          .map((eventRef) => projectionByEvent.get(eventRef))
          .filter((projected): projected is number => projected != null);
        if (matched.length > 0) value = Math.round(matched.reduce((sum, current) => sum + current, 0) / matched.length);
        else if (kpi.kpiId.includes('event') && input.eventCount !== undefined) value = input.eventCount;
      }

      const status = evaluateKpiStatus(value, kpi.threshold, kpi.metricType, kpi.status);
      const trend = computeKpiTrend(kpi.historicalSnapshots ?? [], value);
      const calculationRunId = `run-${Date.now().toString(36)}`;
      const sourceEvents = [...new Set([...kpi.sourceEvents, ...projectionSources.map((source) => source.eventType)])];

      const snapshot: KPIHistoricalSnapshot = {
        snapshotId: `snap-${kpi.kpiId}-${Date.now()}`,
        kpiId: kpi.kpiId,
        value,
        status,
        trend,
        confidence: kpi.confidence,
        dataQualityScore: kpi.dataQualityScore,
        calculatedAt: now(),
        sourceEvents,
        auditReference: {
          auditEventIds: kpi.auditReference.auditEventIds,
          auditIds: kpi.auditReference.auditEventIds,
          eventIds: [...kpi.auditReference.eventIds, ...sourceEvents],
          correlationId: kpi.auditReference.correlationId,
          calculationRunId,
          integrityRef: kpi.auditReference.integrityRef,
        },
      };

      return {
        ...kpi,
        value,
        status,
        trend,
        sourceEvents,
        lastCalculatedAt: now(),
        updatedAt: now(),
        auditReference: snapshot.auditReference,
        historicalSnapshots: [...(kpi.historicalSnapshots ?? []).slice(-9), snapshot],
      };
    });
  }
}

export const kpiCalculationService = new KpiCalculationService();
