export function mapComplianceControls(frameworks = ['ISO 42001', 'ISO 27001', 'ISO 27701', 'ISO 25010', 'ISO 22301', 'ISO 45001', 'HISA', 'ARCI']) {
  return frameworks.map((framework) => ({ framework, controls: ['policy', 'evidence', 'owner', 'review-cycle'], status: 'mapped' as const }));
}
export function aiEvaluationMetrics(runs: Array<{ hallucinated: boolean; policyCompliant: boolean; evidenceScore: number; explainabilityScore: number; approvalChainOk: boolean }>) {
  const total = Math.max(1, runs.length);
  return { hallucinationRate: runs.filter((r) => r.hallucinated).length / total, policyComplianceRate: runs.filter((r) => r.policyCompliant).length / total, averageEvidenceQuality: runs.reduce((s, r) => s + r.evidenceScore, 0) / total, averageExplainability: runs.reduce((s, r) => s + r.explainabilityScore, 0) / total, approvalChainAdherence: runs.filter((r) => r.approvalChainOk).length / total };
}
export function emergencyCommandPlan(type: 'weather' | 'medical' | 'fire' | 'evacuation' | 'continuity') { return { type, incidentCommander: 'operations-director', checklists: ['assess', 'notify', 'dispatch', 'document', 'recover'] }; }
export function executiveForecast(inputs: { revenue: number; attendance: number; safetyIncidents: number; complianceOpenItems: number; maintenanceRisk: number }) { return { revenueForecast: Math.round(inputs.revenue * 1.03), attendanceForecast: Math.round(inputs.attendance * 1.01), safetyKpi: Math.max(0, 100 - inputs.safetyIncidents * 5), complianceKpi: Math.max(0, 100 - inputs.complianceOpenItems * 3), maintenanceForecast: inputs.maintenanceRisk > 70 ? 'elevated' : 'normal' }; }
export function replayRaceDay(events: Array<{ timestamp: string; type: string }>) { return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((event, index) => ({ step: index + 1, ...event })); }
