import type { Role } from './accessControl.js';
import type { KPIArtifact, KPIApprovalSensitivity, KPIMetricType, KPIStatus, KPIThresholdRule, KPITrend, KPIVisibility } from './kpiArtifacts.js';

export const SURVEILLANCE_IOT_KPI_PACK_ID = 'surveillance-iot-kpi-pack-v1';

export type SurveillanceIoTKpiSlug =
  | 'camera-uptime'
  | 'stream-availability'
  | 'device-connectivity-rate'
  | 'alert-volume'
  | 'unresolved-surveillance-alerts'
  | 'gateway-uptime'
  | 'facility-sensor-health'
  | 'zone-coverage-completeness'
  | 'maintenance-backlog'
  | 'incident-linked-evidence-count';

export interface SurveillanceIoTKpiMetricDto {
  kpiId: string;
  slug: SurveillanceIoTKpiSlug;
  value: number;
  label: string;
  unit: string;
  target: number;
  status: KPIStatus;
  trend: KPITrend;
}

export interface SurveillanceIoTKpiPackSummaryDto {
  cameraUptimePct: number;
  streamAvailabilityPct: number;
  deviceConnectivityRatePct: number;
  alertVolume: number;
  unresolvedSurveillanceAlerts: number;
  gatewayUptimePct: number;
  facilitySensorHealthPct: number;
  zoneCoverageCompletenessPct: number;
  maintenanceBacklog: number;
  incidentLinkedEvidenceCount: number;
}

export interface SurveillanceIoTKpiPackDto {
  generatedAt: string;
  kpiPackId: typeof SURVEILLANCE_IOT_KPI_PACK_ID;
  schemaVersion: typeof SURVEILLANCE_IOT_KPI_PACK_ID;
  organizationId: string;
  tenantId: string;
  racetrackId: string;
  summary: SurveillanceIoTKpiPackSummaryDto;
  kpis: SurveillanceIoTKpiMetricDto[];
  mock: boolean;
}

export interface SurveillanceIoTKpiComputedInput {
  slug: SurveillanceIoTKpiSlug;
  value: number;
  status?: KPIStatus;
  trend?: KPITrend;
}

export interface SurveillanceIoTKpiPackDefinition {
  slug: SurveillanceIoTKpiSlug;
  name: string;
  description: string;
  metricType: KPIMetricType;
  unit: string;
  target: number;
  sourceEvents: string[];
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  calculationMethod: string;
  ownerRole: Role;
  domain: 'surveillance-iot' | 'security' | 'facilities';
}

export const surveillanceIoTKpiPackDefinitions: SurveillanceIoTKpiPackDefinition[] = [
  {
    slug: 'camera-uptime',
    name: 'Camera uptime',
    description: 'Percentage of registered cameras reporting online or degraded-but-streaming posture.',
    metricType: 'percentage',
    unit: '%',
    target: 98,
    sourceEvents: ['surveillance.camera.health.updated', 'surveillance.telemetry.ingested'],
    sourceEntities: [{ entityType: 'camera-fleet', entityId: 'surveillance-iot' }],
    calculationMethod: 'Online cameras divided by total registered cameras in the canonical surveillance IoT projection.',
    ownerRole: 'security-manager',
    domain: 'surveillance-iot',
  },
  {
    slug: 'stream-availability',
    name: 'Stream availability',
    description: 'Percentage of video streams in live or buffering state across the monitoring layer.',
    metricType: 'percentage',
    unit: '%',
    target: 97,
    sourceEvents: ['surveillance.stream.health.updated'],
    sourceEntities: [{ entityType: 'video-stream', entityId: 'surveillance-monitoring' }],
    calculationMethod: 'Live or buffering streams over total projected stream endpoints.',
    ownerRole: 'security-manager',
    domain: 'surveillance-iot',
  },
  {
    slug: 'device-connectivity-rate',
    name: 'Device connectivity rate',
    description: 'Combined camera and IoT device online rate across the canonical fleet projection.',
    metricType: 'percentage',
    unit: '%',
    target: 96,
    sourceEvents: ['surveillance.device-registry.updated', 'surveillance.telemetry.ingested'],
    sourceEntities: [{ entityType: 'device-fleet', entityId: 'surveillance-iot' }],
    calculationMethod: 'Online devices divided by cameras plus IoT devices in workspace coverage.',
    ownerRole: 'platform-super-admin',
    domain: 'surveillance-iot',
  },
  {
    slug: 'alert-volume',
    name: 'Surveillance alert volume',
    description: 'Count of open and acknowledged device alerts in the surveillance alerting layer.',
    metricType: 'count',
    unit: 'alerts',
    target: 5,
    sourceEvents: ['surveillance.alert.raised', 'surveillance.alert.acknowledged'],
    sourceEntities: [{ entityType: 'alert-pipeline', entityId: 'surveillance-alerting' }],
    calculationMethod: 'Non-resolved alerts in openAlerts projection.',
    ownerRole: 'security-manager',
    domain: 'security',
  },
  {
    slug: 'unresolved-surveillance-alerts',
    name: 'Unresolved surveillance alerts',
    description: 'Open alerts requiring triage — excludes resolved and suppressed items.',
    metricType: 'count',
    unit: 'alerts',
    target: 2,
    sourceEvents: ['surveillance.alert.raised'],
    sourceEntities: [{ entityType: 'alert-pipeline', entityId: 'surveillance-alerting' }],
    calculationMethod: 'Alerts with status open or acknowledged and not yet resolved.',
    ownerRole: 'security-manager',
    domain: 'security',
  },
  {
    slug: 'gateway-uptime',
    name: 'Gateway uptime',
    description: 'Percentage of device gateways online with ready integration posture.',
    metricType: 'percentage',
    unit: '%',
    target: 99,
    sourceEvents: ['surveillance.gateway.heartbeat'],
    sourceEntities: [{ entityType: 'device-gateway', entityId: 'surveillance-iot' }],
    calculationMethod: 'Online gateways divided by total gateways in readiness projection.',
    ownerRole: 'platform-super-admin',
    domain: 'surveillance-iot',
  },
  {
    slug: 'facility-sensor-health',
    name: 'Facility sensor health',
    description: 'Healthy or degraded-but-operational IoT sensors assigned to facilities-iot domain scope.',
    metricType: 'percentage',
    unit: '%',
    target: 95,
    sourceEvents: ['surveillance.telemetry.ingested', 'facilities.utilities.reading.ingested'],
    sourceEntities: [{ entityType: 'iot-device', entityId: 'facilities-iot' }],
    calculationMethod: 'Facilities-scoped sensors not offline or critical over facilities IoT device count.',
    ownerRole: 'facilities-manager',
    domain: 'facilities',
  },
  {
    slug: 'zone-coverage-completeness',
    name: 'Zone coverage completeness',
    description: 'Operational zones with at least one assigned camera or IoT device.',
    metricType: 'percentage',
    unit: '%',
    target: 90,
    sourceEvents: ['surveillance.mapping.updated', 'surveillance.mapping.read'],
    sourceEntities: [{ entityType: 'operational-zone', entityId: 'zone-mapping' }],
    calculationMethod: 'Zones with non-zero device assignments divided by operational zone catalog size.',
    ownerRole: 'racetrack-admin',
    domain: 'surveillance-iot',
  },
  {
    slug: 'maintenance-backlog',
    name: 'Monitored device maintenance backlog',
    description: 'Scheduled and in-progress maintenance records for cameras, sensors, and gateways.',
    metricType: 'count',
    unit: 'records',
    target: 3,
    sourceEvents: ['surveillance.maintenance.changed', 'facilities.work-order.requested'],
    sourceEntities: [{ entityType: 'maintenance-record', entityId: 'surveillance-iot' }],
    calculationMethod: 'Count of maintenance records in scheduled or in-progress status.',
    ownerRole: 'facilities-manager',
    domain: 'facilities',
  },
  {
    slug: 'incident-linked-evidence-count',
    name: 'Incident-linked surveillance evidence',
    description: 'Surveillance and IoT evidence references linked to incident command records.',
    metricType: 'count',
    unit: 'links',
    target: 0,
    sourceEvents: ['surveillance.evidence.linked', 'incident.surveillance-context.read'],
    sourceEntities: [{ entityType: 'incident-evidence', entityId: 'surveillance-evidence' }],
    calculationMethod: 'Count of incidentReferences and linked evidence clips in surveillance workspace.',
    ownerRole: 'security-manager',
    domain: 'security',
  },
];

function thresholdFor(definition: SurveillanceIoTKpiPackDefinition): KPIThresholdRule {
  if (
    definition.slug === 'alert-volume'
    || definition.slug === 'unresolved-surveillance-alerts'
    || definition.slug === 'maintenance-backlog'
  ) {
    return {
      warning: definition.target,
      critical: definition.target * 2,
      targetDirection: 'below',
      description: `${definition.name} should stay at or below target unless human review is recorded.`,
    };
  }
  return {
    warning: definition.target * 0.9,
    critical: definition.target * 0.75,
    targetDirection: 'above',
    description: `${definition.name} should meet or exceed target.`,
  };
}

function statusFor(definition: SurveillanceIoTKpiPackDefinition, value: number, override?: KPIStatus): KPIStatus {
  if (override) return override;
  const threshold = thresholdFor(definition);
  if (threshold.targetDirection === 'below') {
    if (value > (threshold.critical ?? threshold.warning ?? definition.target)) return 'critical';
    if (value > (threshold.warning ?? definition.target)) return 'watch';
    return 'nominal';
  }
  if (value < (threshold.critical ?? threshold.warning ?? definition.target * 0.75)) return 'critical';
  if (value < (threshold.warning ?? definition.target * 0.9)) return 'watch';
  return 'nominal';
}

export function buildSurveillanceIoTKpiArtifact(
  definition: SurveillanceIoTKpiPackDefinition,
  generatedAt: string,
  tenantId: string,
  organizationId: string,
  racetrackId: string,
  value: number,
  ordinal: number,
  trend: KPITrend = 'flat',
  statusOverride?: KPIStatus,
): KPIArtifact {
  const kpiId = `kpi-surveillance-iot-${definition.slug}`;
  const auditReference = {
    auditEventIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    auditIds: [`audit-${kpiId}-definition`, `audit-${kpiId}-calculation`],
    eventIds: definition.sourceEvents,
    correlationId: `corr-${kpiId}`,
    calculationRunId: `calc-${kpiId}-live`,
    integrityRef: `sha256:${kpiId}:v1`,
  };
  const status = statusFor(definition, value, statusOverride);
  return {
    kpiId,
    tenantId,
    organizationId,
    racetrackId,
    domain: 'surveillance-iot',
    name: definition.name,
    description: definition.description,
    artifactType: 'KPI',
    metricType: definition.metricType,
    value,
    unit: definition.unit,
    target: definition.target,
    threshold: thresholdFor(definition),
    status,
    trend,
    confidence: 0.88,
    dataQualityScore: 0.86,
    sourceEvents: definition.sourceEvents,
    sourceEntities: definition.sourceEntities,
    calculationMethod: definition.calculationMethod,
    refreshCadence: '5m',
    lastCalculatedAt: generatedAt,
    ownerRole: definition.ownerRole,
    visibility: 'tenant-internal',
    approvalSensitivity: definition.slug === 'alert-volume' || definition.slug === 'unresolved-surveillance-alerts'
      ? 'approval-visible'
      : 'none',
    requiredPermission: definition.domain === 'facilities' ? 'surveillance:facility-read' : 'surveillance:health-read',
    auditReference,
    modelReadable: true,
    version: `1.0.${ordinal}`,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    historicalSnapshots: [{
      snapshotId: `snapshot-${kpiId}-live`,
      kpiId,
      value,
      status,
      trend,
      confidence: 0.88,
      dataQualityScore: 0.86,
      calculatedAt: generatedAt,
      sourceEvents: definition.sourceEvents,
      auditReference,
    }],
  };
}

export function buildSurveillanceIoTKpiPackDto(input: {
  generatedAt: string;
  organizationId: string;
  tenantId: string;
  racetrackId: string;
  metrics: SurveillanceIoTKpiComputedInput[];
  mock?: boolean;
}): SurveillanceIoTKpiPackDto {
  const metricMap = new Map(input.metrics.map((metric) => [metric.slug, metric]));
  const kpis: SurveillanceIoTKpiMetricDto[] = surveillanceIoTKpiPackDefinitions.map((definition) => {
    const computed = metricMap.get(definition.slug);
    const value = computed?.value ?? 0;
    const status = statusFor(definition, value, computed?.status);
    return {
      kpiId: `kpi-surveillance-iot-${definition.slug}`,
      slug: definition.slug,
      value,
      label: definition.name,
      unit: definition.unit,
      target: definition.target,
      status,
      trend: computed?.trend ?? 'flat',
    };
  });

  const summary: SurveillanceIoTKpiPackSummaryDto = {
    cameraUptimePct: metricMap.get('camera-uptime')?.value ?? 0,
    streamAvailabilityPct: metricMap.get('stream-availability')?.value ?? 0,
    deviceConnectivityRatePct: metricMap.get('device-connectivity-rate')?.value ?? 0,
    alertVolume: metricMap.get('alert-volume')?.value ?? 0,
    unresolvedSurveillanceAlerts: metricMap.get('unresolved-surveillance-alerts')?.value ?? 0,
    gatewayUptimePct: metricMap.get('gateway-uptime')?.value ?? 0,
    facilitySensorHealthPct: metricMap.get('facility-sensor-health')?.value ?? 0,
    zoneCoverageCompletenessPct: metricMap.get('zone-coverage-completeness')?.value ?? 0,
    maintenanceBacklog: metricMap.get('maintenance-backlog')?.value ?? 0,
    incidentLinkedEvidenceCount: metricMap.get('incident-linked-evidence-count')?.value ?? 0,
  };

  return {
    generatedAt: input.generatedAt,
    kpiPackId: SURVEILLANCE_IOT_KPI_PACK_ID,
    schemaVersion: SURVEILLANCE_IOT_KPI_PACK_ID,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    racetrackId: input.racetrackId,
    summary,
    kpis,
    mock: input.mock ?? false,
  };
}

/** Seed metrics for the global KPI workspace registry; live values come from GET /surveillance-iot/kpi-pack. */
export const surveillanceIoTKpiSeedMetrics: SurveillanceIoTKpiComputedInput[] = [
  { slug: 'camera-uptime', value: 96, trend: 'flat' },
  { slug: 'stream-availability', value: 94, trend: 'flat' },
  { slug: 'device-connectivity-rate', value: 95, trend: 'flat' },
  { slug: 'alert-volume', value: 3, trend: 'flat' },
  { slug: 'unresolved-surveillance-alerts', value: 1, trend: 'flat' },
  { slug: 'gateway-uptime', value: 98, trend: 'flat' },
  { slug: 'facility-sensor-health', value: 92, trend: 'flat' },
  { slug: 'zone-coverage-completeness', value: 88, trend: 'flat' },
  { slug: 'maintenance-backlog', value: 2, trend: 'flat' },
  { slug: 'incident-linked-evidence-count', value: 4, trend: 'flat' },
];

export function registerSurveillanceIoTKpiPack(input: {
  generatedAt: string;
  tenantId?: string;
  organizationId?: string;
  racetrackId?: string;
  metrics: SurveillanceIoTKpiComputedInput[];
}): KPIArtifact[] {
  const tenantId = input.tenantId ?? 'trackmind';
  const organizationId = input.organizationId ?? 'org-trackmind-network';
  const racetrackId = input.racetrackId ?? 'main-track';
  const metricMap = new Map(input.metrics.map((metric) => [metric.slug, metric]));
  return surveillanceIoTKpiPackDefinitions.map((definition, index) =>
    buildSurveillanceIoTKpiArtifact(
      definition,
      input.generatedAt,
      tenantId,
      organizationId,
      racetrackId,
      metricMap.get(definition.slug)?.value ?? 0,
      index + 1,
      metricMap.get(definition.slug)?.trend ?? 'flat',
      metricMap.get(definition.slug)?.status,
    ),
  );
}

export const surveillanceIoTKpiPackContractSchemas = {
  SurveillanceIoTKpiPackDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'kpiPackId', required: true, type: 'string', values: [SURVEILLANCE_IOT_KPI_PACK_ID] },
    { path: 'schemaVersion', required: true, type: 'string', values: [SURVEILLANCE_IOT_KPI_PACK_ID] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'object' },
    { path: 'kpis', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
