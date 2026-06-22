import type { Role } from './accessControl.js';
import type { KPIArtifact, KPIApprovalSensitivity, KPIMetricType, KPIStatus, KPIThresholdRule, KPITrend, KPIVisibility } from './kpiArtifacts.js';

export const FACILITIES_KPI_PACK_ID = 'facilities-kpi-pack-v1';

export type FacilitiesKpiSlug =
  | 'readiness'
  | 'maintenance-backlog'
  | 'utilities-coverage'
  | 'inventory-coverage'
  | 'incident-pressure';

export interface FacilitiesKpiPackDefinition {
  slug: FacilitiesKpiSlug;
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

export const facilitiesKpiPackDefinitions: FacilitiesKpiPackDefinition[] = [
  {
    slug: 'readiness',
    name: 'Facilities readiness score',
    description: 'Composite readiness from asset health, inspections, and open maintenance pressure.',
    metricType: 'readiness',
    value: 78,
    unit: 'score',
    target: 85,
    status: 'watch',
    trend: 'flat',
    sourceEvents: ['facilities.readiness.evaluated', 'facilities.inspection.recorded'],
    sourceEntities: [{ entityType: 'facilities-workspace', entityId: 'main-track' }],
    calculationMethod: 'Average asset health minus blocked and overdue maintenance penalties.',
  },
  {
    slug: 'maintenance-backlog',
    name: 'Facilities maintenance backlog',
    description: 'Open approval-gated work orders and overdue preventive maintenance plans.',
    metricType: 'count',
    value: 2,
    unit: 'orders',
    target: 0,
    status: 'watch',
    trend: 'up',
    sourceEvents: ['facilities.work-order.requested', 'facilities.preventive-maintenance.scheduled'],
    sourceEntities: [{ entityType: 'work-order', entityId: 'facilities-maintenance' }],
    calculationMethod: 'Count of non-completed work orders plus overdue preventive plans.',
  },
  {
    slug: 'utilities-coverage',
    name: 'Utilities monitoring coverage',
    description: 'Percentage of life-safety utilities with active adapter streams and recent readings.',
    metricType: 'percentage',
    value: 88,
    unit: '%',
    target: 95,
    status: 'watch',
    trend: 'flat',
    sourceEvents: ['facilities.utilities.reading.ingested', 'facilities.utilities.adapter.synced'],
    sourceEntities: [{ entityType: 'utilities-adapter', entityId: 'facilities-utilities' }],
    calculationMethod: 'Connected adapters with readings in the last refresh window over required adapters.',
  },
  {
    slug: 'inventory-coverage',
    name: 'Facility inventory registry coverage',
    description: 'RACR-backed facility assets registered with digital twin references.',
    metricType: 'percentage',
    value: 92,
    unit: '%',
    target: 98,
    status: 'nominal',
    trend: 'flat',
    sourceEvents: ['facilities.asset.seeded', 'facilities.inventory.evaluated'],
    sourceEntities: [{ entityType: 'asset-registry', entityId: 'facilities-domain' }],
    calculationMethod: 'Registered facilities assets with twin refs over control-registry inventory targets.',
  },
  {
    slug: 'incident-pressure',
    name: 'Facility incident pressure',
    description: 'Open facility incidents weighted by severity and operational impact.',
    metricType: 'score',
    value: 18,
    unit: 'pressure',
    target: 15,
    status: 'watch',
    trend: 'up',
    sourceEvents: ['facilities.incident.reported', 'facilities.incident.updated'],
    sourceEntities: [{ entityType: 'facility-incident', entityId: 'facilities-incidents' }],
    calculationMethod: 'Weighted sum of open facility incidents; lower is better.',
  },
];

function thresholdFor(definition: FacilitiesKpiPackDefinition): KPIThresholdRule {
  if (definition.slug === 'maintenance-backlog' || definition.slug === 'incident-pressure') {
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

export function buildFacilitiesKpiArtifact(
  definition: FacilitiesKpiPackDefinition,
  generatedAt: string,
  tenantId: string,
  organizationId: string,
  racetrackId: string,
  ordinal: number,
): KPIArtifact {
  const kpiId = `kpi-facilities-${definition.slug}`;
  const auditReference = {
    auditEventIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    auditIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    eventIds: definition.sourceEvents,
    correlationId: `corr-${kpiId}`,
    calculationRunId: `calc-${kpiId}-v1`,
    integrityRef: `sha256:${kpiId}:v1`,
  };
  const ownerRole: Role = 'facilities-manager';
  const visibility: KPIVisibility = 'tenant-internal';
  const approvalSensitivity: KPIApprovalSensitivity = 'approval-visible';
  return {
    kpiId,
    tenantId,
    organizationId,
    racetrackId,
    domain: 'facilities',
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
    refreshCadence: '15m',
    lastCalculatedAt: generatedAt,
    ownerRole,
    visibility,
    approvalSensitivity,
    requiredPermission: 'track:readings',
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

export function registerFacilitiesKpiPack(input: {
  generatedAt: string;
  tenantId?: string;
  organizationId?: string;
  racetrackId?: string;
}): KPIArtifact[] {
  const generatedAt = input.generatedAt;
  const tenantId = input.tenantId ?? 'trackmind';
  const organizationId = input.organizationId ?? 'org-trackmind-network';
  const racetrackId = input.racetrackId ?? 'main-track';
  return facilitiesKpiPackDefinitions.map((definition, index) =>
    buildFacilitiesKpiArtifact(definition, generatedAt, tenantId, organizationId, racetrackId, index + 1),
  );
}
