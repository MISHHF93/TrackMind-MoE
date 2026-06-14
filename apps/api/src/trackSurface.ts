import type { AuditEventType, AuditLogEntry, ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService, ControlledAction, ControlledActionRequest } from './approvals.js';
import type { DigitalTwinRuntime } from './digitalTwinRuntime.js';
import type { RaceDayEvent, UniversalEventBus } from './eventBus.js';
import type { PlatformObservabilityService, PlatformTelemetrySignal } from './platformObservability.js';

export type SurfaceType = 'dirt' | 'turf' | 'synthetic';
export type SurfaceRiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type HumanApprovalState = 'required' | 'approved';

export interface GeoReading { latitude: number; longitude: number; moisture: number; observedAt: string }
export interface SurfacePhysicsInput { moisture: number; compaction: number; depth: number; temperature: number; rainfall: number; maintenanceHoursAgo: number }

export interface SurfaceTelemetryReading extends GeoReading {
  id: string;
  sectionId: string;
  surfaceType: SurfaceType;
  compaction: number;
  drainageRate: number;
  cushionDepth: number;
  temperature: number;
  rainfall: number;
  sensorHealth?: 'ok' | 'degraded' | 'offline';
}

export interface SurfaceInspection {
  id: string;
  sectionId: string;
  inspectedAt: string;
  inspector: string;
  surfaceType: SurfaceType;
  footingUniformity: number;
  divots: number;
  standingWater: boolean;
  railWear: number;
  observations: string[];
}

export interface WeatherIntegration {
  observedAt: string;
  rainfallMm: number;
  forecastRainMm: number;
  temperature: number;
  windMph: number;
  lightningMiles?: number;
}

export interface MaintenanceRecord {
  id: string;
  sectionId: string;
  completedAt: string;
  action: 'harrow' | 'water' | 'aerate' | 'roll' | 'topdress' | 'repair' | 'drainage-cleanout';
  effectiveness: number;
  notes: string;
}

export interface OperationalObservation {
  id: string;
  sectionId: string;
  observedAt: string;
  role: 'steward' | 'jockey' | 'trainer' | 'maintenance' | 'veterinarian';
  severity: number;
  note: string;
}

export interface SurfaceIntelligenceInput {
  trackId: string;
  generatedAt: string;
  telemetry: SurfaceTelemetryReading[];
  inspections: SurfaceInspection[];
  weather: WeatherIntegration;
  maintenanceRecords: MaintenanceRecord[];
  observations: OperationalObservation[];
  approval?: { approvedBy: string; approvedAt: string; evidence: string[] };
}

export interface SurfaceSectionScore {
  sectionId: string;
  surfaceType: SurfaceType;
  conditionScore: number;
  safetyScore: number;
  consistencyScore: number;
  riskLevel: SurfaceRiskLevel;
  recommendations: string[];
  explanation: Array<{ factor: string; impact: number; evidence: string }>;
}

export function buildMoistureHeatmap(readings: GeoReading[], precision = 4) {
  const cells = new Map<string, { total: number; count: number; latest: string }>();
  for (const reading of readings) {
    const key = `${reading.latitude.toFixed(precision)},${reading.longitude.toFixed(precision)}`;
    const cell = cells.get(key) ?? { total: 0, count: 0, latest: reading.observedAt };
    cell.total += reading.moisture;
    cell.count += 1;
    if (reading.observedAt > cell.latest) cell.latest = reading.observedAt;
    cells.set(key, cell);
  }
  return [...cells.entries()].map(([cell, value]) => ({ cell, averageMoisture: value.total / value.count, samples: value.count, latestObservedAt: value.latest }));
}

export function moistureTrend(readings: GeoReading[]): 'drying' | 'stable' | 'wetting' {
  const ordered = [...readings].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (ordered.length < 2) return 'stable';
  const delta = ordered.at(-1)!.moisture - ordered[0].moisture;
  return delta > 2 ? 'wetting' : delta < -2 ? 'drying' : 'stable';
}

export function scoreTrackSurface(input: SurfacePhysicsInput) {
  const safetyPenalty = Math.abs(input.moisture - 18) * 1.4 + Math.abs(input.compaction - 240) * 0.05 + Math.abs(input.depth - 3.5) * 8 + input.rainfall * 4;
  const consistencyPenalty = Math.abs(input.moisture - 18) + Math.abs(input.compaction - 240) * 0.03 + Math.min(20, input.maintenanceHoursAgo * 0.8);
  return {
    safetyScore: Math.max(0, Math.round(100 - safetyPenalty)),
    consistencyScore: Math.max(0, Math.round(100 - consistencyPenalty)),
    factors: ['moisture', 'compaction', 'depth', 'weather', 'maintenance'],
  };
}

const targets: Record<SurfaceType, { moisture: number; compaction: number; cushionDepth: number; drainageRate: number }> = {
  dirt: { moisture: 18, compaction: 240, cushionDepth: 3.5, drainageRate: 10 },
  turf: { moisture: 22, compaction: 180, cushionDepth: 2.5, drainageRate: 14 },
  synthetic: { moisture: 12, compaction: 210, cushionDepth: 3, drainageRate: 12 },
};

function average(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function clampScore(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function riskFromScore(score: number): SurfaceRiskLevel { return score < 55 ? 'critical' : score < 70 ? 'high' : score < 85 ? 'moderate' : 'low'; }
function latestIso(values: string[]) { return [...values].sort().at(-1) ?? ''; }

export function summarizeSurfaceSections(input: SurfaceIntelligenceInput): SurfaceSectionAnalytics[] {
  return [...new Set(input.telemetry.map((reading) => reading.sectionId))].map((sectionId) => {
    const telemetry = input.telemetry.filter((reading) => reading.sectionId === sectionId).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    if (telemetry.length === 0) throw new Error(`No telemetry for surface section ${sectionId}`);
    const latest = telemetry.at(-1)!;
    const target = targets[latest.surfaceType];
    const inspections = input.inspections.filter((inspection) => inspection.sectionId === sectionId).sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt));
    const maintenance = input.maintenanceRecords.filter((record) => record.sectionId === sectionId).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const score = analyzeSurfaceSection(sectionId, input);
    const metrics: SurfaceMetricSummary = {
      moisture: Number(average(telemetry.map((reading) => reading.moisture)).toFixed(2)),
      compaction: Number(average(telemetry.map((reading) => reading.compaction)).toFixed(2)),
      cushionDepth: Number(average(telemetry.map((reading) => reading.cushionDepth)).toFixed(2)),
      drainageRate: Number(average(telemetry.map((reading) => reading.drainageRate)).toFixed(2)),
      sampleCount: telemetry.length,
      latestObservedAt: latestIso(telemetry.map((reading) => reading.observedAt)),
      moistureTrend: moistureTrend(telemetry),
    };
    const capacityGap = Number(Math.max(0, target.drainageRate - metrics.drainageRate).toFixed(2));
    const standingWater = inspections.some((inspection) => inspection.standingWater);
    const drainageStatus: SurfaceDrainageAnalysis['status'] = standingWater || capacityGap > 4 ? 'restricted' : capacityGap > 0 || input.weather.forecastRainMm > 10 ? 'watch' : 'normal';
    const irrigation = metrics.moisture < target.moisture - 3 ? { sectionId, waterMm: Number(Math.min(12, (target.moisture - metrics.moisture) * 0.8).toFixed(1)), reason: `Moisture ${metrics.moisture}% is below ${target.moisture}% target`, advisoryOnly: true as const, requiresHumanApproval: true as const, approvalAction: 'surface-irrigation' as const } : undefined;
    return {
      sectionId,
      surfaceType: latest.surfaceType,
      metrics,
      targets: target,
      latestInspectionAt: inspections[0]?.inspectedAt,
      drainage: { status: drainageStatus, capacityGap, forecastRainMm: input.weather.forecastRainMm, standingWater, recommendation: drainageStatus === 'restricted' ? 'draft closure or drainage cleanout review before operations' : drainageStatus === 'watch' ? 'monitor drainage trend and inspect outlets' : 'continue standard drainage monitoring' },
      irrigation,
      maintenance: maintenance.map((record) => ({ ...record, auditEvidence: [`surface-maintenance:${record.id}`, `section:${sectionId}`] })),
      risk: { sectionId, level: score.riskLevel, score: score.conditionScore, drivers: score.explanation.filter((factor) => factor.impact >= 4).map((factor) => factor.factor), explanation: score.explanation, operationalActionsAdvisoryOnly: true },
    };
  });
}

export function analyzeSurfaceSection(sectionId: string, input: SurfaceIntelligenceInput): SurfaceSectionScore {
  const telemetry = input.telemetry.filter((reading) => reading.sectionId === sectionId);
  if (telemetry.length === 0) throw new Error(`No telemetry for surface section ${sectionId}`);
  const surfaceType = telemetry.at(-1)!.surfaceType;
  const target = targets[surfaceType];
  const inspections = input.inspections.filter((inspection) => inspection.sectionId === sectionId);
  const observations = input.observations.filter((observation) => observation.sectionId === sectionId);
  const maintenance = input.maintenanceRecords.filter((record) => record.sectionId === sectionId).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const latestMaintenance = maintenance[0];
  const latestInspection = inspections.sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))[0];

  const metrics = {
    moisture: average(telemetry.map((reading) => reading.moisture)),
    compaction: average(telemetry.map((reading) => reading.compaction)),
    cushionDepth: average(telemetry.map((reading) => reading.cushionDepth)),
    drainageRate: average(telemetry.map((reading) => reading.drainageRate)),
  };

  const explanation = [
    { factor: 'moisture', impact: Math.abs(metrics.moisture - target.moisture) * 1.6, evidence: `Average ${metrics.moisture.toFixed(1)} vs target ${target.moisture}` },
    { factor: 'compaction', impact: Math.abs(metrics.compaction - target.compaction) * 0.06, evidence: `Average ${metrics.compaction.toFixed(1)} vs target ${target.compaction}` },
    { factor: 'drainage', impact: Math.max(0, target.drainageRate - metrics.drainageRate) * 2.8 + input.weather.forecastRainMm * 0.35, evidence: `Drainage ${metrics.drainageRate.toFixed(1)} with forecast rain ${input.weather.forecastRainMm}mm` },
    { factor: 'cushion-depth', impact: Math.abs(metrics.cushionDepth - target.cushionDepth) * 10, evidence: `Average ${metrics.cushionDepth.toFixed(2)} vs target ${target.cushionDepth}` },
    { factor: 'inspection-observations', impact: (latestInspection?.standingWater ? 12 : 0) + average(inspections.map((i) => i.divots + i.railWear)) * 0.8 + average(observations.map((o) => o.severity)) * 3, evidence: `${inspections.length} inspections and ${observations.length} operational observations` },
    { factor: 'maintenance-effectiveness', impact: Math.max(0, 10 - (latestMaintenance?.effectiveness ?? 10)) * 2, evidence: latestMaintenance ? `${latestMaintenance.action} effectiveness ${latestMaintenance.effectiveness}` : 'No recent maintenance record' },
  ];
  const penalty = explanation.reduce((sum, item) => sum + item.impact, 0);
  const conditionScore = clampScore(100 - penalty);
  const safetyScore = clampScore(conditionScore - (input.weather.lightningMiles !== undefined && input.weather.lightningMiles < 8 ? 20 : 0));
  const consistencyScore = clampScore(100 - Math.abs(metrics.moisture - target.moisture) - Math.abs(metrics.compaction - target.compaction) * 0.04 - Math.abs(metrics.cushionDepth - target.cushionDepth) * 8);
  const recommendations = [
    metrics.moisture > target.moisture + 4 ? 'reduce watering and increase drying interval' : undefined,
    metrics.moisture < target.moisture - 4 ? 'draft irrigation recommendation: apply controlled watering before next race window' : undefined,
    metrics.compaction > target.compaction + 25 ? 'draft harrowing recommendation for compacted lane after human approval' : undefined,
    metrics.compaction < target.compaction - 25 ? 'draft rolling recommendation to restore section consistency after human approval' : undefined,
    metrics.drainageRate < target.drainageRate ? 'inspect drains and schedule drainage cleanout' : undefined,
    metrics.cushionDepth < target.cushionDepth - 0.4 ? 'restore cushion depth in affected section' : undefined,
    latestInspection?.standingWater ? 'draft track closure recommendation for affected section until standing water inspection is approved' : undefined,
  ].filter((item): item is string => Boolean(item));
  if (recommendations.length === 0) recommendations.push('continue monitoring under standard inspection cadence');
  return { sectionId, surfaceType, conditionScore, safetyScore, consistencyScore, riskLevel: riskFromScore(Math.min(conditionScore, safetyScore)), recommendations, explanation };
}

export function runSurfaceIntelligenceSystem(input: SurfaceIntelligenceInput) {
  const sections = [...new Set(input.telemetry.map((reading) => reading.sectionId))].map((sectionId) => analyzeSurfaceSection(sectionId, input));
  const overallScore = clampScore(average(sections.map((section) => section.conditionScore)));
  const approvalState: HumanApprovalState = input.approval && input.approval.evidence.length > 0 ? 'approved' : 'required';
  return {
    trackId: input.trackId,
    generatedAt: input.generatedAt,
    overallScore,
    approvalState,
    humanApprovalRequired: approvalState === 'required',
    sections,
    maintenanceRecommendations: sections.flatMap((section) => section.recommendations.map((recommendation) => ({ sectionId: section.sectionId, recommendation, requiresHumanApproval: true }))),
    riskForecast: sections.map((section) => ({ sectionId: section.sectionId, next6Hours: section.riskLevel, next24Hours: riskFromScore(section.conditionScore - input.weather.forecastRainMm), drivers: section.explanation.filter((item) => item.impact >= 6).map((item) => item.factor) })),
    geospatialHeatmap: buildSurfaceHeatmap(input.telemetry),
    digitalTwinUpdates: sections.map((section) => ({ twinId: `${input.trackId}:${section.sectionId}`, type: 'racing-surface', patch: { surfaceType: section.surfaceType, conditionScore: section.conditionScore, riskLevel: section.riskLevel, approvalState }, observedAt: input.generatedAt })),
    explainableAnalytics: sections.map((section) => ({ sectionId: section.sectionId, model: 'deterministic-surface-intelligence-v1', factors: section.explanation, evidence: ['telemetry', 'inspection', 'weather', 'maintenance', 'operations'], humanApprovalRequired: true })),
  };
}

export function buildSurfaceHeatmap(readings: SurfaceTelemetryReading[], precision = 4) {
  return buildMoistureHeatmap(readings, precision).map((cell) => {
    const [latitude, longitude] = cell.cell.split(',').map(Number);
    const matching = readings.filter((reading) => reading.latitude.toFixed(precision) === latitude.toFixed(precision) && reading.longitude.toFixed(precision) === longitude.toFixed(precision));
    const averageCompaction = average(matching.map((reading) => reading.compaction));
    const averageDrainage = average(matching.map((reading) => reading.drainageRate));
    const riskIndex = clampScore(Math.abs(cell.averageMoisture - 18) * 3 + Math.max(0, 220 - averageDrainage * 12) + Math.max(0, averageCompaction - 250) * 0.5);
    return { ...cell, sectorId: matching[0]?.sectionId ?? 'track', latitude, longitude, averageCompaction, averageDrainage, riskIndex };
  });
}

export type SurfaceMeasurementKind = 'moisture' | 'compaction' | 'cushion-depth' | 'weather' | 'drainage' | 'maintenance-activity' | 'inspection' | 'manual-observation';
export type SurfaceRecommendationType = 'maintenance' | 'irrigation' | 'inspection' | 'drainage' | 'race-readiness';
export type SurfaceExecutionState = 'approval-required' | 'approved-for-execution';

export interface SurfaceMeasurementEnvelope<T = unknown> {
  id: string;
  kind: SurfaceMeasurementKind;
  trackId: string;
  sectionId?: string;
  observedAt: string;
  source: string;
  payload: T;
  qualityScore: number;
  normalized: boolean;
  event: SurfaceDomainEvent;
  auditRecord: SurfaceAuditRecord;
}

export interface SurfaceDomainEvent<T = unknown> { id: string; type: string; occurredAt: string; aggregateId: string; payload: T; requiresHumanApproval?: boolean }
export interface SurfaceAuditRecord<T = unknown> { id: string; type: 'measurement' | 'anomaly' | 'recommendation' | 'digital-twin-sync' | 'approval-gate'; actor: string; timestamp: string; subjectId: string; payload: T }
export interface SurfaceRecommendation { id: string; type: SurfaceRecommendationType; trackId: string; sectionId: string; priority: SurfaceRiskLevel; recommendation: string; rationale: string[]; requiresHumanApproval: true; executionState: SurfaceExecutionState; event: SurfaceDomainEvent; auditRecord: SurfaceAuditRecord }
export interface SurfaceAnomaly { id: string; sectionId: string; metric: string; severity: SurfaceRiskLevel; observedValue: number; expectedValue: number; message: string; event: SurfaceDomainEvent; auditRecord: SurfaceAuditRecord }
export interface SurfaceForecast { sectionId: string; horizonHours: number; predictedMoisture: number; predictedCompaction: number; predictedCushionDepth: number; predictedDrainageRate: number; predictedRisk: SurfaceRiskLevel; confidence: number; drivers: string[]; advisoryOnly: true }
export interface SurfaceDigitalTwinSyncRecord { twinId: string; syncedAt: string; patch: Record<string, unknown>; status: 'queued-for-human-approved-sync' | 'synced'; event: SurfaceDomainEvent; auditRecord: SurfaceAuditRecord }
export interface SurfaceMetricSummary { moisture: number; compaction: number; cushionDepth: number; drainageRate: number; sampleCount: number; latestObservedAt: string; moistureTrend: ReturnType<typeof moistureTrend> }
export interface SurfaceDrainageAnalysis { status: 'normal' | 'watch' | 'restricted'; capacityGap: number; forecastRainMm: number; standingWater: boolean; recommendation: string }
export interface SurfaceIrrigationRecommendation { sectionId: string; waterMm: number; reason: string; advisoryOnly: true; requiresHumanApproval: true; approvalAction: 'surface-irrigation' }
export interface SurfaceMaintenanceRecordView { id: string; sectionId: string; completedAt: string; action: MaintenanceRecord['action']; effectiveness: number; notes: string; auditEvidence: string[] }
export interface SurfaceRiskAnalysis { sectionId: string; level: SurfaceRiskLevel; score: number; drivers: string[]; explanation: SurfaceSectionScore['explanation']; operationalActionsAdvisoryOnly: true }
export interface SurfaceSectionAnalytics { sectionId: string; surfaceType: SurfaceType; metrics: SurfaceMetricSummary; targets: (typeof targets)[SurfaceType]; latestInspectionAt?: string; drainage: SurfaceDrainageAnalysis; irrigation?: SurfaceIrrigationRecommendation; maintenance: SurfaceMaintenanceRecordView[]; risk: SurfaceRiskAnalysis }

const surfaceId = (prefix: string, seed: string) => `${prefix}-${seed.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;

function measurementEnvelope<T>(kind: SurfaceMeasurementKind, input: { trackId: string; sectionId?: string; observedAt: string; source: string; payload: T; qualityScore?: number }): SurfaceMeasurementEnvelope<T> {
  const id = surfaceId(`surface-${kind}`, `${input.trackId}-${input.sectionId ?? 'track'}-${input.observedAt}-${JSON.stringify(input.payload).slice(0, 40)}`);
  const aggregateId = `${input.trackId}:${input.sectionId ?? 'track'}`;
  const event: SurfaceDomainEvent<T> = { id: `${id}:event`, type: `surface.${kind}.ingested`, occurredAt: input.observedAt, aggregateId, payload: input.payload };
  const auditRecord: SurfaceAuditRecord<T> = { id: `${id}:audit`, type: 'measurement', actor: input.source, timestamp: input.observedAt, subjectId: aggregateId, payload: input.payload };
  return { id, kind, trackId: input.trackId, sectionId: input.sectionId, observedAt: input.observedAt, source: input.source, payload: input.payload, qualityScore: input.qualityScore ?? 100, normalized: true, event, auditRecord };
}

export function ingestMoistureMeasurements(trackId: string, readings: GeoReading[], source = 'moisture-sensor'): SurfaceMeasurementEnvelope<GeoReading>[] { return readings.map((payload) => measurementEnvelope('moisture', { trackId, sectionId: 'sectionId' in payload ? String((payload as { sectionId?: string }).sectionId) : undefined, observedAt: payload.observedAt, source, payload, qualityScore: payload.moisture >= 0 && payload.moisture <= 60 ? 100 : 60 })); }
export function ingestCompactionMeasurements(trackId: string, readings: SurfaceTelemetryReading[], source = 'compaction-sensor') { return readings.map((payload) => measurementEnvelope('compaction', { trackId, sectionId: payload.sectionId, observedAt: payload.observedAt, source, payload, qualityScore: payload.compaction > 0 ? 100 : 50 })); }
export function ingestCushionDepthMeasurements(trackId: string, readings: SurfaceTelemetryReading[], source = 'depth-probe') { return readings.map((payload) => measurementEnvelope('cushion-depth', { trackId, sectionId: payload.sectionId, observedAt: payload.observedAt, source, payload, qualityScore: payload.cushionDepth > 0 ? 100 : 50 })); }
export function ingestWeatherMeasurements(trackId: string, weather: WeatherIntegration, source = 'weather-integration') { return [measurementEnvelope('weather', { trackId, observedAt: weather.observedAt, source, payload: weather, qualityScore: 100 })]; }
export function ingestDrainageMeasurements(trackId: string, readings: SurfaceTelemetryReading[], source = 'drainage-sensor') { return readings.map((payload) => measurementEnvelope('drainage', { trackId, sectionId: payload.sectionId, observedAt: payload.observedAt, source, payload, qualityScore: payload.drainageRate >= 0 ? 100 : 50 })); }
export function ingestMaintenanceActivities(trackId: string, records: MaintenanceRecord[], source = 'maintenance-system') { return records.map((payload) => measurementEnvelope('maintenance-activity', { trackId, sectionId: payload.sectionId, observedAt: payload.completedAt, source, payload, qualityScore: Math.max(50, Math.min(100, payload.effectiveness * 10)) })); }
export function ingestSurfaceInspections(trackId: string, inspections: SurfaceInspection[], source = 'inspection-workflow') { return inspections.map((payload) => measurementEnvelope('inspection', { trackId, sectionId: payload.sectionId, observedAt: payload.inspectedAt, source: payload.inspector || source, payload, qualityScore: payload.footingUniformity })); }
export function ingestManualObservations(trackId: string, observations: OperationalObservation[], source = 'operations-console') { return observations.map((payload) => measurementEnvelope('manual-observation', { trackId, sectionId: payload.sectionId, observedAt: payload.observedAt, source: `${source}:${payload.role}`, payload, qualityScore: Math.max(40, 100 - payload.severity * 10) })); }

export function buildSurfaceIngestionPipeline(input: SurfaceIntelligenceInput): SurfaceMeasurementEnvelope[] {
  return [
    ...ingestMoistureMeasurements(input.trackId, input.telemetry),
    ...ingestCompactionMeasurements(input.trackId, input.telemetry),
    ...ingestCushionDepthMeasurements(input.trackId, input.telemetry),
    ...ingestWeatherMeasurements(input.trackId, input.weather),
    ...ingestDrainageMeasurements(input.trackId, input.telemetry),
    ...ingestMaintenanceActivities(input.trackId, input.maintenanceRecords),
    ...ingestSurfaceInspections(input.trackId, input.inspections),
    ...ingestManualObservations(input.trackId, input.observations),
  ];
}

export function detectSurfaceAnomalies(input: SurfaceIntelligenceInput): SurfaceAnomaly[] {
  return input.telemetry.flatMap((reading) => {
    const target = targets[reading.surfaceType];
    const checks = [
      ['moisture', reading.moisture, target.moisture, 8], ['compaction', reading.compaction, target.compaction, 45], ['cushionDepth', reading.cushionDepth, target.cushionDepth, 0.8], ['drainageRate', reading.drainageRate, target.drainageRate, 5],
    ] as const;
    return checks.filter(([, value, expected, tolerance]) => Math.abs(value - expected) > tolerance).map(([metric, value, expected]) => {
      const severity = riskFromScore(100 - Math.abs(value - expected) * (metric === 'compaction' ? 1 : 8));
      const id = surfaceId('surface-anomaly', `${reading.id}-${metric}`);
      const payload = { sectionId: reading.sectionId, metric, severity, observedValue: value, expectedValue: expected, message: `${metric} ${value} outside expected ${expected}` };
      const event: SurfaceDomainEvent<typeof payload> = { id: `${id}:event`, type: 'surface.anomaly.detected', occurredAt: reading.observedAt, aggregateId: `${input.trackId}:${reading.sectionId}`, payload, requiresHumanApproval: severity === 'high' || severity === 'critical' };
      const auditRecord: SurfaceAuditRecord<typeof payload> = { id: `${id}:audit`, type: 'anomaly', actor: 'surface-anomaly-detector', timestamp: reading.observedAt, subjectId: `${input.trackId}:${reading.sectionId}`, payload };
      return { id, ...payload, event, auditRecord };
    });
  });
}

export function forecastSurfaceRisk(input: SurfaceIntelligenceInput, horizons = [6, 24, 48]): SurfaceForecast[] {
  const sections = [...new Set(input.telemetry.map((r) => r.sectionId))];
  return sections.flatMap((sectionId) => {
    const readings = input.telemetry.filter((r) => r.sectionId === sectionId).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const latest = readings.at(-1)!; const trend = moistureTrend(readings); const target = targets[latest.surfaceType];
    return horizons.map((horizonHours) => {
      const rainLoad = input.weather.forecastRainMm * (horizonHours / 24); const drying = input.weather.temperature > 80 ? horizonHours * 0.08 : horizonHours * 0.04;
      const predictedMoisture = Math.max(0, latest.moisture + rainLoad * 0.35 - drying + (trend === 'wetting' ? 1 : trend === 'drying' ? -1 : 0));
      const compactionDrift = input.weather.forecastRainMm > 10 ? horizonHours * 0.25 : horizonHours * 0.08;
      const predictedCompaction = latest.compaction + compactionDrift - (latest.cushionDepth > target.cushionDepth ? 2 : 0);
      const predictedCushionDepth = Math.max(0, latest.cushionDepth - (latest.compaction > target.compaction ? horizonHours * 0.003 : horizonHours * 0.001));
      const predictedDrainageRate = Math.max(0, latest.drainageRate - rainLoad * 0.08);
      const score = 100 - Math.abs(predictedMoisture - target.moisture) * 4 - Math.max(0, target.drainageRate - predictedDrainageRate) * 3 - Math.max(0, predictedCompaction - target.compaction) * 0.05 - Math.abs(predictedCushionDepth - target.cushionDepth) * 4;
      return { sectionId, horizonHours, predictedMoisture: Number(predictedMoisture.toFixed(2)), predictedCompaction: Number(predictedCompaction.toFixed(2)), predictedCushionDepth: Number(predictedCushionDepth.toFixed(2)), predictedDrainageRate: Number(predictedDrainageRate.toFixed(2)), predictedRisk: riskFromScore(score), confidence: readings.length > 2 ? 0.82 : 0.68, drivers: ['moisture-trend', 'forecast-rain', 'drainage-capacity', 'compaction-drift', 'cushion-depth'], advisoryOnly: true as const };
    });
  });
}

export function generateSurfaceRecommendations(input: SurfaceIntelligenceInput): SurfaceRecommendation[] {
  const analysis = runSurfaceIntelligenceSystem(input);
  return analysis.sections.flatMap((section) => section.recommendations.map((recommendation, index) => {
    const id = surfaceId('surface-rec', `${input.trackId}-${section.sectionId}-${index}-${recommendation}`);
    const payload = { recommendation, sectionId: section.sectionId, riskLevel: section.riskLevel };
    const event = { id: `${id}:event`, type: 'surface.recommendation.generated', occurredAt: input.generatedAt, aggregateId: `${input.trackId}:${section.sectionId}`, payload, requiresHumanApproval: true };
    const auditRecord = { id: `${id}:audit`, type: 'recommendation' as const, actor: 'surface-management-domain', timestamp: input.generatedAt, subjectId: `${input.trackId}:${section.sectionId}`, payload };
    const type: SurfaceRecommendationType = recommendation.includes('irrigation') || recommendation.includes('water') ? 'irrigation' : recommendation.includes('closure') ? 'race-readiness' : recommendation.includes('drain') ? 'drainage' : recommendation.includes('inspection') || recommendation.includes('pause') ? 'inspection' : 'maintenance';
    return { id, type, trackId: input.trackId, sectionId: section.sectionId, priority: section.riskLevel, recommendation, rationale: section.explanation.filter((e) => e.impact >= 4).map((e) => e.evidence), requiresHumanApproval: true, executionState: 'approval-required' as const, event, auditRecord };
  }));
}

export function synchronizeSurfaceDigitalTwin(input: SurfaceIntelligenceInput, approved = false): SurfaceDigitalTwinSyncRecord[] {
  const report = runSurfaceIntelligenceSystem(input);
  return report.digitalTwinUpdates.map((update) => {
    const id = surfaceId('surface-twin-sync', `${update.twinId}-${input.generatedAt}`);
    const event = { id: `${id}:event`, type: 'surface.digital-twin.sync-requested', occurredAt: input.generatedAt, aggregateId: update.twinId, payload: update.patch, requiresHumanApproval: !approved };
    const auditRecord = { id: `${id}:audit`, type: 'digital-twin-sync' as const, actor: 'surface-management-domain', timestamp: input.generatedAt, subjectId: update.twinId, payload: update.patch };
    return { twinId: update.twinId, syncedAt: input.generatedAt, patch: update.patch, status: approved ? 'synced' as const : 'queued-for-human-approved-sync' as const, event, auditRecord };
  });
}

export function runSurfaceManagementDomain(input: SurfaceIntelligenceInput) {
  const measurements = buildSurfaceIngestionPipeline(input);
  const analytics = runSurfaceIntelligenceSystem(input);
  const anomalies = detectSurfaceAnomalies(input);
  const forecasts = forecastSurfaceRisk(input);
  const recommendations = generateSurfaceRecommendations(input);
  const digitalTwinSync = synchronizeSurfaceDigitalTwin(input, Boolean(input.approval?.evidence.length));
  const events = [...measurements.map((m) => m.event), ...anomalies.map((a) => a.event), ...recommendations.map((r) => r.event), ...digitalTwinSync.map((s) => s.event)];
  const auditRecords = [...measurements.map((m) => m.auditRecord), ...anomalies.map((a) => a.auditRecord), ...recommendations.map((r) => r.auditRecord), ...digitalTwinSync.map((s) => s.auditRecord), { id: surfaceId('surface-approval-gate', `${input.trackId}-${input.generatedAt}`), type: 'approval-gate' as const, actor: 'surface-management-domain', timestamp: input.generatedAt, subjectId: input.trackId, payload: { operationalActionsRequireHumanApproval: true, approvalState: analytics.approvalState } }];
  return { trackId: input.trackId, generatedAt: input.generatedAt, measurements, analytics, sectionAnalytics: summarizeSurfaceSections(input), riskScores: analytics.sections, maintenanceRecommendations: recommendations.filter((r) => r.type !== 'irrigation'), irrigationRecommendations: recommendations.filter((r) => r.type === 'irrigation'), geospatialHeatmaps: analytics.geospatialHeatmap, anomalies, forecasts, digitalTwinSync, events, auditRecords, operationalActionsRequireHumanApproval: true, approvalState: analytics.approvalState };
}

export type SurfaceOperationalActionType = 'irrigation' | 'harrowing' | 'rolling' | 'track-closure-recommendation' | 'surface-configuration-change';
export interface SurfaceOperationalActionDraft { id: string; action: SurfaceOperationalActionType; trackId: string; sectionId: string; requestedBy: string; reason: string; payload: Record<string, unknown>; approvalState: 'approval-required'; executionAllowed: false; event: SurfaceDomainEvent; auditRecord: SurfaceAuditRecord }

export function requestSurfaceOperationalAction(input: { action: SurfaceOperationalActionType; trackId: string; sectionId: string; requestedBy: string; reason: string; payload?: Record<string, unknown>; requestedAt: string }): SurfaceOperationalActionDraft {
  const id = surfaceId('surface-action-approval', `${input.trackId}-${input.sectionId}-${input.action}-${input.requestedAt}`);
  const payload = { action: input.action, reason: input.reason, payload: input.payload ?? {}, approvalState: 'approval-required' as const, executionAllowed: false as const };
  const event: SurfaceDomainEvent = { id: `${id}:event`, type: 'surface.operational-action.approval-requested', occurredAt: input.requestedAt, aggregateId: `${input.trackId}:${input.sectionId}`, payload, requiresHumanApproval: true };
  const auditRecord: SurfaceAuditRecord = { id: `${id}:audit`, type: 'approval-gate', actor: input.requestedBy, timestamp: input.requestedAt, subjectId: `${input.trackId}:${input.sectionId}`, payload };
  return { id, action: input.action, trackId: input.trackId, sectionId: input.sectionId, requestedBy: input.requestedBy, reason: input.reason, payload: input.payload ?? {}, approvalState: 'approval-required', executionAllowed: false, event, auditRecord };
}

export function buildSurfaceIntelligenceWorkspace(input: SurfaceIntelligenceInput) {
  const domain = runSurfaceManagementDomain(input);
  const sectionAnalytics = new Map(domain.sectionAnalytics.map((section) => [section.sectionId, section]));
  const inspectionEvidence = new Map(domain.measurements.filter((measurement): measurement is SurfaceMeasurementEnvelope<SurfaceInspection> => measurement.kind === 'inspection').map((measurement) => [measurement.payload.id, measurement]));
  return {
    trackId: domain.trackId,
    generatedAt: domain.generatedAt,
    overallScore: domain.analytics.overallScore,
    approvalState: domain.approvalState,
    operationalActionsRequireHumanApproval: true as const,
    statusCards: [
      { label: 'Surface score', value: String(domain.analytics.overallScore), tone: domain.analytics.overallScore < 70 ? 'warning' as const : 'nominal' as const, detail: `${domain.riskScores.length} sectors scored` },
      { label: 'Measurements', value: String(domain.measurements.length), tone: 'advisory' as const, detail: 'Moisture, compaction, cushion depth, drainage, weather, inspections, maintenance, and observations ingested' },
      { label: 'Recommendations', value: String(domain.maintenanceRecommendations.length + domain.irrigationRecommendations.length), tone: 'warning' as const, detail: 'Operational recommendations are approval-gated' },
      { label: 'Digital Twin sync', value: String(domain.digitalTwinSync.length), tone: 'advisory' as const, detail: 'Twin patches remain queued until approved' },
    ],
    conditionScorecards: domain.riskScores.map((section) => ({ id: `score-${section.sectionId}`, label: section.sectionId, score: section.conditionScore, riskLevel: section.riskLevel, status: section.riskLevel === 'critical' ? 'closed' as const : section.riskLevel === 'high' ? 'watch' as const : 'open' as const, detail: `${section.surfaceType} surface scored with ${section.explanation.length} explainable factors`, drivers: section.explanation.filter((factor) => factor.impact >= 4).map((factor) => factor.factor) })),
    metricPanels: domain.sectionAnalytics.flatMap((section) => [
      { id: `${section.sectionId}-moisture`, factor: 'moisture' as const, label: `${section.sectionId} moisture`, value: `${section.metrics.moisture}%`, target: `${section.targets.moisture}%`, status: Math.abs(section.metrics.moisture - section.targets.moisture) > 4 ? 'warning' as const : 'nominal' as const, sectorId: section.sectionId, detail: `${section.metrics.sampleCount} samples`, trend: section.metrics.moistureTrend },
      { id: `${section.sectionId}-compaction`, factor: 'compaction' as const, label: `${section.sectionId} compaction`, value: String(section.metrics.compaction), target: String(section.targets.compaction), status: Math.abs(section.metrics.compaction - section.targets.compaction) > 25 ? 'warning' as const : 'nominal' as const, sectorId: section.sectionId, detail: 'Compaction monitoring from normalized surface telemetry', trend: 'latest-window' },
      { id: `${section.sectionId}-cushion-depth`, factor: 'cushion-depth' as const, label: `${section.sectionId} cushion depth`, value: String(section.metrics.cushionDepth), target: String(section.targets.cushionDepth), status: Math.abs(section.metrics.cushionDepth - section.targets.cushionDepth) > 0.4 ? 'warning' as const : 'nominal' as const, sectorId: section.sectionId, detail: 'Cushion-depth tracking from depth probes', trend: 'latest-window' },
      { id: `${section.sectionId}-drainage`, factor: 'drainage' as const, label: `${section.sectionId} drainage`, value: String(section.metrics.drainageRate), target: String(section.targets.drainageRate), status: section.drainage.status === 'restricted' ? 'critical' as const : section.drainage.status === 'watch' ? 'warning' as const : 'nominal' as const, sectorId: section.sectionId, detail: section.drainage.recommendation, trend: `${section.drainage.forecastRainMm}mm forecast rain` },
    ]),
    sectors: domain.riskScores.map((section) => {
      const details = sectionAnalytics.get(section.sectionId)!;
      return { id: section.sectionId, name: section.sectionId, surfaceType: section.surfaceType, status: section.riskLevel === 'critical' ? 'closed' as const : section.riskLevel === 'high' ? 'watch' as const : 'open' as const, conditionScore: section.conditionScore, safetyScore: section.safetyScore, consistencyScore: section.consistencyScore, riskLevel: section.riskLevel, moisture: details.metrics.moisture, compaction: details.metrics.compaction, cushionDepth: details.metrics.cushionDepth, drainageRate: details.metrics.drainageRate, latestInspectionAt: details.latestInspectionAt ?? details.metrics.latestObservedAt, recommendations: section.recommendations };
    }),
    timeline: domain.measurements.map((measurement) => ({ id: measurement.id, sectorId: measurement.sectionId ?? 'track', kind: measurement.kind, observedAt: measurement.observedAt, label: measurement.kind.replace(/-/g, ' '), value: `${measurement.qualityScore}% quality`, source: measurement.source, eventId: measurement.event.id, auditId: measurement.auditRecord.id, qualityScore: measurement.qualityScore })),
    inspectionTimeline: input.inspections.map((inspection) => { const evidence = inspectionEvidence.get(inspection.id); return { id: inspection.id, sectorId: inspection.sectionId, inspectedAt: inspection.inspectedAt, inspector: inspection.inspector, score: inspection.footingUniformity, summary: inspection.standingWater ? 'Standing water requires follow-up' : 'Inspection completed', findings: inspection.observations, requiresFollowUp: inspection.standingWater || inspection.divots > 3 || inspection.railWear > 3, eventId: evidence?.event.id ?? surfaceId('surface-inspection-event', `${inspection.id}-${inspection.inspectedAt}`), auditId: evidence?.auditRecord.id ?? surfaceId('surface-inspection-audit', `${inspection.id}-${inspection.inspectedAt}`) }; }),
    heatmap: domain.geospatialHeatmaps.map((cell) => ({ id: surfaceId('surface-heatmap-cell', `${cell.latitude}-${cell.longitude}`), ...cell })),
    heatmapSectors: domain.sectionAnalytics.map((section) => { const cells = domain.geospatialHeatmaps.filter((cell) => cell.sectorId === section.sectionId); return { sectorId: section.sectionId, label: section.sectionId, riskLevel: section.risk.level, riskIndex: clampScore(average(cells.map((cell) => cell.riskIndex))), cellIds: cells.map((cell) => surfaceId('surface-heatmap-cell', `${cell.latitude}-${cell.longitude}`)), coordinates: cells.map((cell) => ({ latitude: cell.latitude, longitude: cell.longitude })), metrics: { moisture: section.metrics.moisture, compaction: section.metrics.compaction, drainage: section.metrics.drainageRate } }; }),
    recommendations: [...domain.maintenanceRecommendations, ...domain.irrigationRecommendations].map((recommendation) => ({ id: recommendation.id, type: recommendation.type, sectorId: recommendation.sectionId, priority: recommendation.priority, recommendation: recommendation.recommendation, requiresHumanApproval: recommendation.requiresHumanApproval, executionState: recommendation.executionState, eventId: recommendation.event.id, auditId: recommendation.auditRecord.id })),
    riskBadges: domain.riskScores.map((section) => ({ sectorId: section.sectionId, level: section.riskLevel, drivers: section.explanation.filter((factor) => factor.impact >= 4).map((factor) => factor.factor) })),
    drainageAnalysis: domain.sectionAnalytics.map((section) => ({ sectionId: section.sectionId, ...section.drainage })),
    maintenanceRecords: domain.sectionAnalytics.flatMap((section) => section.maintenance),
    irrigationRecommendations: domain.sectionAnalytics.flatMap((section) => section.irrigation ? [section.irrigation] : []),
    forecasts: domain.forecasts,
    anomalies: domain.anomalies.map((anomaly) => ({ id: anomaly.id, sectionId: anomaly.sectionId, metric: anomaly.metric, severity: anomaly.severity, observedValue: anomaly.observedValue, expectedValue: anomaly.expectedValue, message: anomaly.message, eventId: anomaly.event.id, auditId: anomaly.auditRecord.id })),
    surfaceRiskAnalysis: domain.sectionAnalytics.map((section) => section.risk),
    weatherObservation: input.weather,
    digitalTwinSync: domain.digitalTwinSync.map((sync) => ({ twinId: sync.twinId, status: sync.status, patch: sync.patch, eventId: sync.event.id, auditId: sync.auditRecord.id })),
    approvalActions: [
      { id: 'surface-irrigation', label: 'Request irrigation approval', detail: 'Draft irrigation changes only until approved', approvalApi: '/api/v1/approvals/controlled-actions', locked: true as const },
      { id: 'surface-harrowing', label: 'Request harrowing approval', detail: 'Draft harrowing passes only until approved', approvalApi: '/api/v1/approvals/controlled-actions', locked: true as const },
      { id: 'surface-rolling', label: 'Request rolling approval', detail: 'Draft rolling changes only until approved', approvalApi: '/api/v1/approvals/controlled-actions', locked: true as const },
      { id: 'surface-track-closure-recommendation', label: 'Request closure recommendation approval', detail: 'Closure recommendations are advisory until approved by humans', approvalApi: '/api/v1/approvals/controlled-actions', locked: true as const },
      { id: 'surface-configuration-change', label: 'Request surface configuration approval', detail: 'Configuration changes remain locked pending authorization', approvalApi: '/api/v1/approvals/controlled-actions', locked: true as const },
    ],
    events: domain.events,
    auditRecords: domain.auditRecords,
  };
}

export interface SurfacePlatformIntegrationDeps { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; approvals?: CentralizedApprovalService; twins?: DigitalTwinRuntime; observability?: PlatformObservabilityService; tenantId?: string; requestedBy?: string }
export interface SurfacePlatformIntegrationResult { domain: ReturnType<typeof runSurfaceManagementDomain>; publishedEvents: RaceDayEvent[]; auditEntries: AuditLogEntry[]; approvalRequests: ControlledActionRequest[]; twinUpdates: Array<{ twinId: string; status: 'queued' | 'synced' | 'failed'; reason?: string }>; observabilitySignals: PlatformTelemetrySignal[]; unresolvedDependencies: string[] }

function auditType(type: SurfaceAuditRecord['type']): AuditEventType { return type === 'measurement' || type === 'anomaly' ? 'data-change' : type === 'recommendation' ? 'ai-recommendation' : type === 'digital-twin-sync' ? 'digital-twin-update' : 'approval'; }
function actionForRecommendation(recommendation: SurfaceRecommendation): ControlledAction {
  if (recommendation.type === 'irrigation') return 'surface-irrigation';
  if (recommendation.type === 'race-readiness') return 'surface-track-closure-recommendation';
  if (/roll/i.test(recommendation.recommendation)) return 'surface-rolling';
  if (/harrow|aerate/i.test(recommendation.recommendation)) return 'surface-harrowing';
  return 'safety-critical-control';
}

export async function runIntegratedSurfaceIntelligence(input: SurfaceIntelligenceInput, deps: SurfacePlatformIntegrationDeps = {}): Promise<SurfacePlatformIntegrationResult> {
  const domain = runSurfaceManagementDomain(input);
  const publishedEvents: RaceDayEvent[] = [];
  const auditEntries: AuditLogEntry[] = [];
  const approvalRequests: ControlledActionRequest[] = [];
  const twinUpdates: SurfacePlatformIntegrationResult['twinUpdates'] = [];
  const observabilitySignals: PlatformTelemetrySignal[] = [];
  const unresolvedDependencies: string[] = [];
  const requestedBy = deps.requestedBy ?? 'surface-intelligence-service';
  const tenantId = deps.tenantId ?? input.trackId;

  if (!deps.eventBus) unresolvedDependencies.push('eventBus');
  else {
    for (const event of domain.events) {
      publishedEvents.push(await deps.eventBus.publish({ id: event.id, type: event.type, occurredAt: event.occurredAt, payload: event.payload, aggregateId: event.aggregateId, producer: requestedBy, metadata: { team: 'surface-operations', accountableRole: 'track-superintendent', compliance: event.requiresHumanApproval ? 'regulated' : 'internal', requiresHumanApproval: Boolean(event.requiresHumanApproval) } }));
    }
  }

  if (!deps.auditLog) unresolvedDependencies.push('auditLog');
  else {
    for (const record of domain.auditRecords) {
      auditEntries.push(deps.auditLog.append({ id: record.id, type: auditType(record.type), actor: record.actor, timestamp: record.timestamp, payload: record.payload, subjectId: record.subjectId, tenantId, severity: record.type === 'approval-gate' || record.type === 'recommendation' ? 'warning' : 'info', regulations: ['HISA', 'ARCI'], evidenceIds: record.type === 'recommendation' ? ['surface-telemetry', 'surface-inspection', 'surface-weather'] : [] }));
    }
  }

  if (!deps.approvals) unresolvedDependencies.push('approvals');
  else {
    for (const recommendation of [...domain.maintenanceRecommendations, ...domain.irrigationRecommendations]) {
      approvalRequests.push(deps.approvals.createRequest({ id: `${recommendation.id}:approval`, tenantId, action: actionForRecommendation(recommendation), target: `${input.trackId}:${recommendation.sectionId}`, requestedBy, actorType: 'service', reason: recommendation.recommendation, evidence: ['human-approval-record', ...recommendation.rationale, recommendation.event.id, recommendation.auditRecord.id], now: input.generatedAt }));
    }
  }

  if (!deps.twins) unresolvedDependencies.push('digitalTwinRuntime');
  for (const sync of domain.digitalTwinSync) {
    if (sync.status !== 'synced') { twinUpdates.push({ twinId: sync.twinId, status: 'queued', reason: 'surface action approval required before twin mutation' }); continue; }
    if (!deps.twins) { twinUpdates.push({ twinId: sync.twinId, status: 'failed', reason: 'digitalTwinRuntime dependency missing' }); continue; }
    try {
      deps.twins.updateState({ twinId: sync.twinId, patch: sync.patch, actor: requestedBy, observedAt: sync.syncedAt, sourceEventId: sync.event.id });
      twinUpdates.push({ twinId: sync.twinId, status: 'synced' });
    } catch (error) {
      twinUpdates.push({ twinId: sync.twinId, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!deps.observability) unresolvedDependencies.push('platformObservability');
  else observabilitySignals.push(deps.observability.recordApiLatency('surface-intelligence', '/api/v1/surface-intelligence/workspace', Math.max(25, domain.measurements.length)));

  return { domain, publishedEvents, auditEntries, approvalRequests, twinUpdates, observabilitySignals, unresolvedDependencies };
}
