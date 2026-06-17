import type { KPIArtifact, KPIHistoricalSnapshot } from '@trackmind/shared';

const now = () => new Date().toISOString();

export interface KpiCalculationInput {
  eventCount?: number;
  approvalPendingCount?: number;
  incidentOpenCount?: number;
  readinessScore?: number;
}

export class KpiCalculationService {
  calculateFromProjections(kpis: KPIArtifact[], input: KpiCalculationInput): KPIArtifact[] {
    return kpis.map((kpi) => {
      let value = kpi.value;
      if (kpi.kpiId.includes('readiness') && input.readinessScore !== undefined) value = input.readinessScore;
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
          auditEventIds: [],
          eventIds: [],
          correlationId: `kpi-calc-${kpi.kpiId}`,
          calculationRunId: `run-${Date.now().toString(36)}`,
        },
      };

      return {
        ...kpi,
        value,
        lastCalculatedAt: now(),
        historicalSnapshots: [...(kpi.historicalSnapshots ?? []).slice(-9), snapshot],
      };
    });
  }
}

export const kpiCalculationService = new KpiCalculationService();
