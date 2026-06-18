import type { KPIArtifact, KPIHistoricalSnapshot, KPIDomain } from '@trackmind/shared';

const now = () => new Date().toISOString();

export interface KpiCalculationInput {
  eventCount?: number;
  approvalPendingCount?: number;
  incidentOpenCount?: number;
  readinessScore?: number;
  domainScores?: Partial<Record<KPIDomain, number>>;
  dataQualityScore?: number;
  systemHealthScore?: number;
}

export class KpiCalculationService {
  calculateFromProjections(kpis: KPIArtifact[], input: KpiCalculationInput): KPIArtifact[] {
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
      else if (kpi.kpiId.includes('event') && input.eventCount !== undefined) value = input.eventCount;

      const snapshot: KPIHistoricalSnapshot = {
        snapshotId: `snap-${kpi.kpiId}-${Date.now()}`,
        kpiId: kpi.kpiId,
        value,
        status: kpi.status,
        trend: kpi.trend,
        confidence: kpi.confidence,
        dataQualityScore: kpi.dataQualityScore,
        calculatedAt: now(),
        sourceEvents: kpi.sourceEvents,
        auditReference: {
          auditEventIds: kpi.auditReference.auditEventIds,
          auditIds: kpi.auditReference.auditEventIds,
          eventIds: kpi.auditReference.eventIds,
          correlationId: kpi.auditReference.correlationId,
          calculationRunId: `run-${Date.now().toString(36)}`,
          integrityRef: kpi.auditReference.integrityRef,
        },
      };

      return {
        ...kpi,
        value,
        lastCalculatedAt: now(),
        auditReference: snapshot.auditReference,
        historicalSnapshots: [...(kpi.historicalSnapshots ?? []).slice(-9), snapshot],
      };
    });
  }
}

export const kpiCalculationService = new KpiCalculationService();
