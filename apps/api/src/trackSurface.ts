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
    metrics.moisture < target.moisture - 4 ? 'apply controlled watering before next race window' : undefined,
    metrics.compaction > target.compaction + 25 ? 'harrow or aerate compacted lane after human review' : undefined,
    metrics.drainageRate < target.drainageRate ? 'inspect drains and schedule drainage cleanout' : undefined,
    metrics.cushionDepth < target.cushionDepth - 0.4 ? 'restore cushion depth in affected section' : undefined,
    latestInspection?.standingWater ? 'pause racing in section until standing water inspection is approved' : undefined,
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
    return { ...cell, latitude, longitude, averageCompaction, averageDrainage, riskIndex };
  });
}
