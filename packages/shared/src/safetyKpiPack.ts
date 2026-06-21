import type { Role } from './accessControl.js';
import type { KPIArtifact, KPIApprovalSensitivity, KPIMetricType, KPIStatus, KPIThresholdRule, KPITrend, KPIVisibility } from './kpiArtifacts.js';

export const SAFETY_KPI_PACK_ID = 'safety-kpi-pack-v1';

export type SafetyKpiSlug =
  | 'incident-pressure'
  | 'triage-coverage'
  | 'emergency-readiness'
  | 'post-incident-review-coverage'
  | 'safety-intelligence-alerts';

export interface SafetyKpiPackDefinition {
  slug: SafetyKpiSlug;
  name: string;
  description: string;
  metricType: KPIMetricType;
  value: number;
  unit: string;
  target: number;
  status: KPIStatus;
  trend: KPITrend;
  sourceEvents: string[];
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  calculationMethod: string;
}

export interface SafetyKpiPackSnapshot {
  generatedAt: string;
  kpiPackId: typeof SAFETY_KPI_PACK_ID;
  openIncidents: number;
  triagedIncidents: number;
  activeEmergencyWorkflows: number;
  pendingPostIncidentReviews: number;
  safetyIntelligenceAlerts: number;
  kpis: Array<{ kpiId: string; label: string; value: number; unit: string; status: string }>;
  mock: boolean;
}

export const safetyKpiPackDefinitions: SafetyKpiPackDefinition[] = [
  {
    slug: 'incident-pressure',
    name: 'Open safety incident pressure',
    description: 'Weighted count of open incident signals from reporting, triage, and emergency workflows.',
    metricType: 'score',
    value: 18,
    unit: 'pressure',
    target: 25,
    status: 'watch',
    trend: 'up',
    sourceEvents: ['incident.reported.v1', 'incident.updated.v1', 'emergency.alert.raised'],
    sourceEntities: [{ entityType: 'incident', entityId: 'safety-incidents' }],
    calculationMethod: 'Weighted sum of open incidents by severity; lower is better.',
  },
  {
    slug: 'triage-coverage',
    name: 'Incident triage coverage',
    description: 'Percentage of reported incidents triaged within SLA with severity classification recorded.',
    metricType: 'percentage',
    value: 92,
    unit: '%',
    target: 95,
    status: 'watch',
    trend: 'flat',
    sourceEvents: ['incident.reported.v1', 'incident.triaged.v1'],
    sourceEntities: [{ entityType: 'incident', entityId: 'safety-triage' }],
    calculationMethod: 'Triaged incidents over reported incidents in the current refresh window.',
  },
  {
    slug: 'emergency-readiness',
    name: 'Emergency workflow readiness',
    description: 'Readiness score from active emergency plans, command roles, and drill completion metadata.',
    metricType: 'score',
    value: 86,
    unit: 'score',
    target: 90,
    status: 'watch',
    trend: 'flat',
    sourceEvents: ['emergency.workflow.activated', 'emergency.drill.completed'],
    sourceEntities: [{ entityType: 'emergency-workflow', entityId: 'emergency-operations' }],
    calculationMethod: 'Composite readiness from emergency plans, active workflows, and drill evidence.',
  },
  {
    slug: 'post-incident-review-coverage',
    name: 'Post-incident review coverage',
    description: 'Percentage of resolved incidents with submitted post-incident review and corrective actions.',
    metricType: 'percentage',
    value: 78,
    unit: '%',
    target: 90,
    status: 'watch',
    trend: 'up',
    sourceEvents: ['incident.resolved.v1', 'incident.post-incident-review.submitted.v1'],
    sourceEntities: [{ entityType: 'post-incident-review', entityId: 'safety-reviews' }],
    calculationMethod: 'Resolved incidents with submitted post-incident review over resolved incidents.',
  },
  {
    slug: 'safety-intelligence-alerts',
    name: 'Safety intelligence alert pressure',
    description: 'Count-style pressure from hot-path and warm-path safety intelligence alerts awaiting human review.',
    metricType: 'count',
    value: 2,
    unit: 'alerts',
    target: 0,
    status: 'watch',
    trend: 'flat',
    sourceEvents: ['safety-intelligence.alert.raised', 'safety-intelligence.debrief.created'],
    sourceEntities: [{ entityType: 'safety-intelligence', entityId: 'safety-intelligence' }],
    calculationMethod: 'Open safety intelligence alerts requiring human review; lower is better.',
  },
];

function thresholdFor(definition: SafetyKpiPackDefinition): KPIThresholdRule {
  if (definition.slug === 'incident-pressure' || definition.slug === 'safety-intelligence-alerts') {
    return {
      warning: definition.target,
      critical: definition.target * 1.5,
      targetDirection: 'below',
      description: `${definition.name} should stay at or below target unless human review is recorded.`,
    };
  }
  return {
    warning: definition.target * 0.85,
    critical: definition.target * 0.65,
    targetDirection: 'above',
    description: `${definition.name} should meet or exceed target.`,
  };
}

export function buildSafetyKpiArtifact(
  definition: SafetyKpiPackDefinition,
  generatedAt: string,
  tenantId: string,
  organizationId: string,
  racetrackId: string,
  ordinal: number,
): KPIArtifact {
  const kpiId = `kpi-safety-incidents-${definition.slug}`;
  const auditReference = {
    auditEventIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    auditIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    eventIds: definition.sourceEvents,
    correlationId: `corr-${kpiId}`,
    calculationRunId: `calc-${kpiId}-v1`,
    integrityRef: `sha256:${kpiId}:v1`,
  };
  const ownerRole: Role = 'security';
  const visibility: KPIVisibility = 'tenant-internal';
  const approvalSensitivity: KPIApprovalSensitivity = 'approval-visible';
  return {
    kpiId,
    tenantId,
    organizationId,
    racetrackId,
    domain: 'safety-incidents',
    name: definition.name,
    description: definition.description,
    artifactType: 'KPI',
    metricType: definition.metricType,
    value: definition.value,
    unit: definition.unit,
    target: definition.target,
    threshold: thresholdFor(definition),
    status: definition.status,
    trend: definition.trend,
    confidence: 0.84,
    dataQualityScore: 0.8,
    sourceEvents: definition.sourceEvents,
    sourceEntities: definition.sourceEntities,
    calculationMethod: definition.calculationMethod,
    refreshCadence: '5m',
    lastCalculatedAt: generatedAt,
    ownerRole,
    visibility,
    approvalSensitivity,
    requiredPermission: 'incident:manage',
    auditReference,
    modelReadable: true,
    version: `1.0.${ordinal}`,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    historicalSnapshots: [{
      snapshotId: `snapshot-${kpiId}-seed`,
      kpiId,
      value: definition.value,
      status: definition.status,
      trend: definition.trend,
      confidence: 0.84,
      dataQualityScore: 0.8,
      calculatedAt: generatedAt,
      sourceEvents: definition.sourceEvents,
      auditReference,
    }],
  };
}

export function registerSafetyKpiPack(input: {
  generatedAt: string;
  tenantId?: string;
  organizationId?: string;
  racetrackId?: string;
}): KPIArtifact[] {
  const generatedAt = input.generatedAt;
  const tenantId = input.tenantId ?? 'trackmind';
  const organizationId = input.organizationId ?? 'org-trackmind-network';
  const racetrackId = input.racetrackId ?? 'main-track';
  return safetyKpiPackDefinitions.map((definition, index) =>
    buildSafetyKpiArtifact(definition, generatedAt, tenantId, organizationId, racetrackId, index + 1),
  );
}
