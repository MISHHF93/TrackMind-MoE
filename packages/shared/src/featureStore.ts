export const featureStoreSchemaVersion = 'trackmind.feature-store.v1' as const;

export type FeatureDomain = 'surface' | 'gate' | 'race' | 'horse' | 'security' | 'weather' | 'operations';
export type FeatureScalar = string | number | boolean | null;
export type FeatureVector = Record<string, FeatureScalar>;
export type ScoreVector = Record<string, number>;

export interface FeatureRecordMetadata {
  tenantId: string;
  racetrackId: string;
  domain: FeatureDomain;
  correlationId: string;
  asOf: string;
  source: string;
  assetId?: string;
  subjectId?: string;
}

export interface DataQualityScore {
  score: number;
  completenessScore: number;
  freshnessScore: number;
  outlierScore: number;
  outlierQualityScore: number;
  missingFields: string[];
  staleAfterMinutes: number;
}

export interface FeatureRecord<TFeatures = FeatureVector, TScores = ScoreVector> {
  id: string;
  schemaVersion: typeof featureStoreSchemaVersion;
  metadata: FeatureRecordMetadata;
  features: TFeatures;
  scores: TScores;
  dataQuality: DataQualityScore;
  evidence: string[];
  placeholder: true;
}

export type AnyFeatureRecord = FeatureRecord<unknown, unknown>;

export interface DataQualityInput {
  requiredFields: readonly string[];
  presentFields: readonly string[];
  asOf: string;
  observedAt?: string;
  staleAfterMinutes?: number;
  outlierScore?: number;
}

export interface SurfaceFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  surfaceType?: 'dirt' | 'turf' | 'synthetic';
  moisturePct?: number;
  compactionPsi?: number;
  cushionDepthInches?: number;
  drainageRateMmPerHour?: number;
  temperatureF?: number;
  rainfallMm?: number;
  forecastRainMm?: number;
  maintenanceCompletedAt?: string;
  weatherRisk?: number;
  evidence?: string[];
}

export interface GateFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  currentMetersFromStart?: number;
  targetMetersFromStart?: number;
  gpsAccuracyMeters?: number;
  gpsVerified?: boolean;
  inspectionAt?: string;
  crewAvailablePct?: number;
  weatherRisk?: number;
  evidence?: string[];
}

export interface RaceFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  distanceMeters?: number;
  entries?: number;
  scratches?: number;
  postTime?: string;
  surfaceReadiness?: number;
  gateReadiness?: number;
  vetReadiness?: number;
  stewardReadiness?: number;
  emergencyReadiness?: number;
  securityReadiness?: number;
  weatherReadiness?: number;
  evidence?: string[];
}

export interface HorseFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  workoutCountLast30Days?: number;
  averageWorkoutDistanceFurlongs?: number;
  raceStartsLast90Days?: number;
  historyStarts?: number;
  restDays?: number;
  openVetFlags?: number;
  eligibilityStatus?: 'eligible' | 'watch' | 'ineligible';
  latestWorkoutAt?: string;
  evidence?: string[];
}

export interface SecurityFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  camerasOnline?: number;
  camerasTotal?: number;
  accessDenied?: number;
  accessEvents?: number;
  restrictedAlerts?: number;
  activeIncidents?: number;
  criticalAlerts?: number;
  evidence?: string[];
}

export interface WeatherFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  rainfallMm?: number;
  windMph?: number;
  lightningMiles?: number;
  humidityPct?: number;
  forecastRainMm?: number;
  forecastConfidence?: number;
  evidence?: string[];
}

export interface OperationsFeatureInput {
  metadata: FeatureRecordMetadata;
  observedAt: string;
  scheduledStaff?: number;
  checkedInStaff?: number;
  emergencyResourcesReady?: number;
  emergencyResourcesTotal?: number;
  openIncidents?: number;
  criticalIncidents?: number;
  unresolvedEmergencyTasks?: number;
  evidence?: string[];
}

export interface FeatureStoreBuildInput {
  surfaces?: SurfaceFeatureInput[];
  gates?: GateFeatureInput[];
  races?: RaceFeatureInput[];
  horses?: HorseFeatureInput[];
  security?: SecurityFeatureInput[];
  weather?: WeatherFeatureInput[];
  operations?: OperationsFeatureInput[];
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeRange(value: number, min: number, max: number, invert = false): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0;
  const normalized = clamp01((value - min) / (max - min));
  return round4(invert ? 1 - normalized : normalized);
}

export function targetDeviationRisk(value: number | undefined, target: number, tolerance: number, severeDeviation: number): number {
  if (!isFiniteNumber(value) || severeDeviation <= tolerance) return 1;
  const deviation = Math.abs(value - target);
  return round4(clamp01((deviation - tolerance) / (severeDeviation - tolerance)));
}

export function freshnessScore(observedAt: string | undefined, asOf: string, staleAfterMinutes = 60): number {
  const observed = observedAt ? Date.parse(observedAt) : Number.NaN;
  const current = Date.parse(asOf);
  if (!Number.isFinite(observed) || !Number.isFinite(current) || staleAfterMinutes <= 0) return 0;
  const ageMinutes = Math.max(0, (current - observed) / 60_000);
  return round4(clamp01(1 - ageMinutes / staleAfterMinutes));
}

export function scoreDataQuality(input: DataQualityInput): DataQualityScore {
  const required = [...input.requiredFields];
  const present = new Set(input.presentFields);
  const missingFields = required.filter((field) => !present.has(field));
  const completenessScore = required.length === 0 ? 1 : round4((required.length - missingFields.length) / required.length);
  const fresh = freshnessScore(input.observedAt, input.asOf, input.staleAfterMinutes ?? 60);
  const outlierScore = round4(clamp01(input.outlierScore ?? 0));
  const outlierQualityScore = round4(1 - outlierScore);
  const score = round4(0.4 * completenessScore + 0.4 * fresh + 0.2 * outlierQualityScore);
  return { score, completenessScore, freshnessScore: fresh, outlierScore, outlierQualityScore, missingFields, staleAfterMinutes: input.staleAfterMinutes ?? 60 };
}

export function calculateSurfaceRisk(input: { moistureRisk: number; compactionRisk: number; cushionDepthRisk: number; weatherRisk: number; maintenanceGapRisk: number }): number {
  return round4(
    0.30 * clamp01(input.moistureRisk) +
    0.25 * clamp01(input.compactionRisk) +
    0.20 * clamp01(input.cushionDepthRisk) +
    0.15 * clamp01(input.weatherRisk) +
    0.10 * clamp01(input.maintenanceGapRisk),
  );
}

export function calculateRaceReadiness(input: { surfaceReadiness: number; gateReadiness: number; vetReadiness: number; stewardReadiness: number; emergencyReadiness: number; securityReadiness: number; weatherReadiness: number }): number {
  return round4(
    0.20 * clamp01(input.surfaceReadiness) +
    0.20 * clamp01(input.gateReadiness) +
    0.20 * clamp01(input.vetReadiness) +
    0.15 * clamp01(input.stewardReadiness) +
    0.10 * clamp01(input.emergencyReadiness) +
    0.10 * clamp01(input.securityReadiness) +
    0.05 * clamp01(input.weatherReadiness),
  );
}

export function calculateGateMoveRisk(input: { distanceChangeRisk: number; gpsUncertainty: number; inspectionAgeRisk: number; weatherRisk: number; crewAvailabilityRisk: number }): number {
  return round4(
    0.35 * clamp01(input.distanceChangeRisk) +
    0.25 * clamp01(input.gpsUncertainty) +
    0.20 * clamp01(input.inspectionAgeRisk) +
    0.10 * clamp01(input.weatherRisk) +
    0.10 * clamp01(input.crewAvailabilityRisk),
  );
}

export function adjustConfidence(input: { modelConfidence: number; dataQualityScore: number; evidenceCompleteness: number; freshnessScore: number }): number {
  return round4(clamp01(input.modelConfidence) * clamp01(input.dataQualityScore) * clamp01(input.evidenceCompleteness) * clamp01(input.freshnessScore));
}

export function buildSurfaceFeatureRecord(input: SurfaceFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const target = surfaceTargets[input.surfaceType ?? 'dirt'];
  const weatherRisk = input.weatherRisk ?? weatherRiskFromValues({ rainfallMm: input.rainfallMm, forecastRainMm: input.forecastRainMm });
  const moistureRisk = targetDeviationRisk(input.moisturePct, target.moisturePct, 3, 15);
  const compactionRisk = targetDeviationRisk(input.compactionPsi, target.compactionPsi, 20, 90);
  const cushionDepthRisk = targetDeviationRisk(input.cushionDepthInches, target.cushionDepthInches, 0.25, 1.5);
  const drainageRisk = isFiniteNumber(input.drainageRateMmPerHour) ? normalizeRange(target.drainageRateMmPerHour - input.drainageRateMmPerHour, 0, target.drainageRateMmPerHour) : 1;
  const temperatureRisk = isFiniteNumber(input.temperatureF) ? normalizeRange(Math.abs(input.temperatureF - 75), 10, 35) : 1;
  const maintenanceGapHours = hoursBetween(input.maintenanceCompletedAt, input.metadata.asOf);
  const maintenanceGapRisk = maintenanceGapHours === undefined ? 1 : normalizeRange(maintenanceGapHours, 12, 72);
  const surfaceRisk = calculateSurfaceRisk({ moistureRisk, compactionRisk, cushionDepthRisk, weatherRisk, maintenanceGapRisk });
  return createFeatureRecord(
    input.metadata,
    {
      surfaceType: input.surfaceType ?? 'dirt',
      moisturePct: input.moisturePct ?? null,
      compactionPsi: input.compactionPsi ?? null,
      cushionDepthInches: input.cushionDepthInches ?? null,
      drainageRateMmPerHour: input.drainageRateMmPerHour ?? null,
      temperatureF: input.temperatureF ?? null,
      rainfallMm: input.rainfallMm ?? null,
      forecastRainMm: input.forecastRainMm ?? null,
      maintenanceGapHours: maintenanceGapHours ?? null,
    },
    { moistureRisk, compactionRisk, cushionDepthRisk, drainageRisk, temperatureRisk, weatherRisk, maintenanceGapRisk, surfaceRisk, surfaceReadiness: round4(1 - surfaceRisk) },
    qualityFor(input, ['observedAt', 'moisturePct', 'compactionPsi', 'cushionDepthInches', 'drainageRateMmPerHour', 'temperatureF', 'maintenanceCompletedAt'], Math.max(surfaceRisk, drainageRisk), 120),
    input.evidence ?? ['surface-telemetry', 'surface-inspection', 'surface-maintenance'],
  );
}

export function buildGateFeatureRecord(input: GateFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const distanceChangeMeters = isFiniteNumber(input.currentMetersFromStart) && isFiniteNumber(input.targetMetersFromStart) ? Math.abs(input.targetMetersFromStart - input.currentMetersFromStart) : undefined;
  const distanceChangeRisk = distanceChangeMeters === undefined ? 1 : normalizeRange(distanceChangeMeters, 0, 150);
  const gpsAccuracyRisk = isFiniteNumber(input.gpsAccuracyMeters) ? normalizeRange(input.gpsAccuracyMeters, 1, 15) : 1;
  const gpsUncertainty = round4(Math.max(gpsAccuracyRisk, input.gpsVerified === false ? 0.65 : 0));
  const inspectionAgeHours = hoursBetween(input.inspectionAt, input.metadata.asOf);
  const inspectionAgeRisk = inspectionAgeHours === undefined ? 1 : normalizeRange(inspectionAgeHours, 1, 24);
  const crewAvailabilityRisk = round4(1 - normalizePercent(input.crewAvailablePct));
  const weatherRisk = clamp01(input.weatherRisk ?? 0);
  const gateMoveRisk = calculateGateMoveRisk({ distanceChangeRisk, gpsUncertainty, inspectionAgeRisk, weatherRisk, crewAvailabilityRisk });
  return createFeatureRecord(
    input.metadata,
    {
      currentMetersFromStart: input.currentMetersFromStart ?? null,
      targetMetersFromStart: input.targetMetersFromStart ?? null,
      distanceChangeMeters: distanceChangeMeters ?? null,
      gpsAccuracyMeters: input.gpsAccuracyMeters ?? null,
      gpsVerified: input.gpsVerified ?? null,
      inspectionAgeHours: inspectionAgeHours ?? null,
      crewAvailablePct: input.crewAvailablePct ?? null,
    },
    { distanceChangeRisk, gpsUncertainty, inspectionAgeRisk, weatherRisk, crewAvailabilityRisk, gateMoveRisk, gateReadiness: round4(1 - gateMoveRisk) },
    qualityFor(input, ['observedAt', 'currentMetersFromStart', 'targetMetersFromStart', 'gpsAccuracyMeters', 'gpsVerified', 'inspectionAt', 'crewAvailablePct'], gateMoveRisk, 60),
    input.evidence ?? ['gate-position', 'gps-verification', 'gate-inspection'],
  );
}

export function buildRaceFeatureRecord(input: RaceFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const entries = Math.max(0, input.entries ?? 0);
  const scratches = Math.max(0, input.scratches ?? 0);
  const scratchRate = entries > 0 ? round4(clamp01(scratches / entries)) : 1;
  const postLeadMinutes = minutesBetween(input.metadata.asOf, input.postTime);
  const postUrgencyRisk = postLeadMinutes === undefined ? 1 : normalizeRange(30 - postLeadMinutes, 0, 30);
  const raceReadiness = calculateRaceReadiness({
    surfaceReadiness: input.surfaceReadiness ?? 0,
    gateReadiness: input.gateReadiness ?? 0,
    vetReadiness: input.vetReadiness ?? 0,
    stewardReadiness: input.stewardReadiness ?? 0,
    emergencyReadiness: input.emergencyReadiness ?? 0,
    securityReadiness: input.securityReadiness ?? 0,
    weatherReadiness: input.weatherReadiness ?? 0,
  });
  const raceRisk = round4(1 - raceReadiness);
  return createFeatureRecord(
    input.metadata,
    {
      distanceMeters: input.distanceMeters ?? null,
      entries,
      scratches,
      scratchRate,
      postLeadMinutes: postLeadMinutes ?? null,
    },
    { scratchRate, postUrgencyRisk, raceReadiness, raceRisk },
    qualityFor(input, ['observedAt', 'distanceMeters', 'entries', 'scratches', 'postTime', 'surfaceReadiness', 'gateReadiness', 'vetReadiness', 'stewardReadiness', 'emergencyReadiness', 'securityReadiness', 'weatherReadiness'], Math.max(raceRisk, scratchRate, postUrgencyRisk), 30),
    input.evidence ?? ['race-office', 'readiness-checks'],
  );
}

export function buildHorseFeatureRecord(input: HorseFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const workoutCoverage = normalizeRange(input.workoutCountLast30Days ?? 0, 0, 3);
  const restDays = input.restDays ?? 0;
  const lowRestRisk = restDays < 7 ? normalizeRange(7 - restDays, 0, 7) : 0;
  const longRestRisk = restDays > 60 ? normalizeRange(restDays, 60, 120) : 0;
  const restRisk = round4(Math.max(lowRestRisk, longRestRisk));
  const vetFlagRisk = normalizeRange(input.openVetFlags ?? 0, 0, 3);
  const eligibilityRisk = input.eligibilityStatus === 'eligible' ? 0 : input.eligibilityStatus === 'watch' ? 0.5 : 1;
  const historyCompleteness = normalizeRange(input.historyStarts ?? 0, 0, 5);
  const horseRisk = round4(0.25 * (1 - workoutCoverage) + 0.25 * restRisk + 0.25 * vetFlagRisk + 0.15 * eligibilityRisk + 0.10 * (1 - historyCompleteness));
  return createFeatureRecord(
    input.metadata,
    {
      workoutCountLast30Days: input.workoutCountLast30Days ?? null,
      averageWorkoutDistanceFurlongs: input.averageWorkoutDistanceFurlongs ?? null,
      raceStartsLast90Days: input.raceStartsLast90Days ?? null,
      historyStarts: input.historyStarts ?? null,
      restDays: input.restDays ?? null,
      openVetFlags: input.openVetFlags ?? null,
      eligibilityStatus: input.eligibilityStatus ?? null,
      latestWorkoutAt: input.latestWorkoutAt ?? null,
    },
    { workoutCoverage, restRisk, vetFlagRisk, eligibilityRisk, historyCompleteness, horseRisk, horseReadiness: round4(1 - horseRisk) },
    qualityFor(input, ['observedAt', 'workoutCountLast30Days', 'raceStartsLast90Days', 'historyStarts', 'restDays', 'openVetFlags', 'eligibilityStatus'], horseRisk, 180),
    input.evidence ?? ['equine-profile', 'workouts', 'veterinary-flags', 'eligibility'],
  );
}

export function buildSecurityFeatureRecord(input: SecurityFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const cameraOnlineRatio = ratio(input.camerasOnline, input.camerasTotal);
  const accessDeniedRate = ratio(input.accessDenied, input.accessEvents);
  const restrictedAlertRisk = normalizeRange(input.restrictedAlerts ?? 0, 0, 5);
  const incidentRisk = normalizeRange((input.activeIncidents ?? 0) + 2 * (input.criticalAlerts ?? 0), 0, 8);
  const securityRisk = round4(0.30 * (1 - cameraOnlineRatio) + 0.25 * accessDeniedRate + 0.25 * restrictedAlertRisk + 0.20 * incidentRisk);
  return createFeatureRecord(
    input.metadata,
    {
      camerasOnline: input.camerasOnline ?? null,
      camerasTotal: input.camerasTotal ?? null,
      cameraOnlineRatio,
      accessDenied: input.accessDenied ?? null,
      accessEvents: input.accessEvents ?? null,
      restrictedAlerts: input.restrictedAlerts ?? null,
      activeIncidents: input.activeIncidents ?? null,
      criticalAlerts: input.criticalAlerts ?? null,
    },
    { cameraOnlineRatio, accessDeniedRate, restrictedAlertRisk, incidentRisk, securityRisk, securityReadiness: round4(1 - securityRisk) },
    qualityFor(input, ['observedAt', 'camerasOnline', 'camerasTotal', 'accessDenied', 'accessEvents', 'restrictedAlerts', 'activeIncidents'], securityRisk, 30),
    input.evidence ?? ['camera-health', 'access-control', 'restricted-zone-alerts'],
  );
}

export function buildWeatherFeatureRecord(input: WeatherFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const rainfallRisk = normalizeRange(input.rainfallMm ?? 0, 0, 20);
  const forecastRisk = normalizeRange(input.forecastRainMm ?? 0, 0, 30);
  const windRisk = normalizeRange(input.windMph ?? 0, 10, 45);
  const lightningRisk = lightningRiskFromDistance(input.lightningMiles);
  const humidityRisk = normalizeRange(input.humidityPct ?? 50, 60, 100);
  const weatherRisk = weatherRiskFromValues(input);
  return createFeatureRecord(
    input.metadata,
    {
      rainfallMm: input.rainfallMm ?? null,
      windMph: input.windMph ?? null,
      lightningMiles: input.lightningMiles ?? null,
      humidityPct: input.humidityPct ?? null,
      forecastRainMm: input.forecastRainMm ?? null,
      forecastConfidence: input.forecastConfidence ?? null,
    },
    { rainfallRisk, forecastRisk, windRisk, lightningRisk, humidityRisk, weatherRisk, weatherReadiness: round4(1 - weatherRisk) },
    qualityFor(input, ['observedAt', 'rainfallMm', 'windMph', 'lightningMiles', 'humidityPct', 'forecastRainMm'], weatherRisk, 20),
    input.evidence ?? ['weather-observation', 'weather-forecast'],
  );
}

export function buildOperationsFeatureRecord(input: OperationsFeatureInput): FeatureRecord<FeatureVector, ScoreVector> {
  const staffCoverage = ratio(input.checkedInStaff, input.scheduledStaff);
  const emergencyResourceCoverage = ratio(input.emergencyResourcesReady, input.emergencyResourcesTotal);
  const incidentRisk = normalizeRange((input.openIncidents ?? 0) + 2 * (input.criticalIncidents ?? 0), 0, 10);
  const emergencyTaskRisk = normalizeRange(input.unresolvedEmergencyTasks ?? 0, 0, 8);
  const operationsRisk = round4(0.35 * (1 - staffCoverage) + 0.25 * (1 - emergencyResourceCoverage) + 0.25 * incidentRisk + 0.15 * emergencyTaskRisk);
  return createFeatureRecord(
    input.metadata,
    {
      scheduledStaff: input.scheduledStaff ?? null,
      checkedInStaff: input.checkedInStaff ?? null,
      staffCoverage,
      emergencyResourcesReady: input.emergencyResourcesReady ?? null,
      emergencyResourcesTotal: input.emergencyResourcesTotal ?? null,
      emergencyResourceCoverage,
      openIncidents: input.openIncidents ?? null,
      criticalIncidents: input.criticalIncidents ?? null,
      unresolvedEmergencyTasks: input.unresolvedEmergencyTasks ?? null,
    },
    { staffCoverage, emergencyResourceCoverage, incidentRisk, emergencyTaskRisk, operationsRisk, emergencyReadiness: round4(1 - operationsRisk) },
    qualityFor(input, ['observedAt', 'scheduledStaff', 'checkedInStaff', 'emergencyResourcesReady', 'emergencyResourcesTotal', 'openIncidents', 'criticalIncidents'], operationsRisk, 60),
    input.evidence ?? ['workforce-readiness', 'emergency-resources', 'incident-log'],
  );
}

export function buildFeatureStoreRecords(input: FeatureStoreBuildInput): AnyFeatureRecord[] {
  return [
    ...(input.surfaces ?? []).map(buildSurfaceFeatureRecord),
    ...(input.gates ?? []).map(buildGateFeatureRecord),
    ...(input.races ?? []).map(buildRaceFeatureRecord),
    ...(input.horses ?? []).map(buildHorseFeatureRecord),
    ...(input.security ?? []).map(buildSecurityFeatureRecord),
    ...(input.weather ?? []).map(buildWeatherFeatureRecord),
    ...(input.operations ?? []).map(buildOperationsFeatureRecord),
  ];
}

function createFeatureRecord<TFeatures, TScores>(
  metadata: FeatureRecordMetadata,
  features: TFeatures,
  scores: TScores,
  dataQuality: DataQualityScore,
  evidence: string[],
): FeatureRecord<TFeatures, TScores> {
  const subject = metadata.subjectId ?? metadata.assetId ?? metadata.racetrackId;
  return {
    id: `feature:${metadata.domain}:${metadata.tenantId}:${subject}:${metadata.correlationId}`,
    schemaVersion: featureStoreSchemaVersion,
    metadata,
    features,
    scores,
    dataQuality,
    evidence: [...evidence],
    placeholder: true,
  };
}

const surfaceTargets = {
  dirt: { moisturePct: 18, compactionPsi: 240, cushionDepthInches: 3.5, drainageRateMmPerHour: 10 },
  turf: { moisturePct: 22, compactionPsi: 180, cushionDepthInches: 2.5, drainageRateMmPerHour: 14 },
  synthetic: { moisturePct: 12, compactionPsi: 210, cushionDepthInches: 3, drainageRateMmPerHour: 12 },
} as const;

function qualityFor(input: { metadata: FeatureRecordMetadata; observedAt?: string }, requiredFields: readonly string[], outlierScore: number, staleAfterMinutes: number): DataQualityScore {
  return scoreDataQuality({
    requiredFields,
    presentFields: presentFields(input, requiredFields),
    observedAt: input.observedAt,
    asOf: input.metadata.asOf,
    staleAfterMinutes,
    outlierScore,
  });
}

function presentFields(input: Record<string, unknown>, requiredFields: readonly string[]): string[] {
  return requiredFields.filter((field) => hasValue(input[field]));
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && !(typeof value === 'number' && !Number.isFinite(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePercent(value: number | undefined): number {
  if (!isFiniteNumber(value)) return 0;
  return clamp01(value > 1 ? value / 100 : value);
}

function ratio(numerator: number | undefined, denominator: number | undefined): number {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator <= 0) return 0;
  return round4(clamp01(numerator / denominator));
}

function weatherRiskFromValues(input: Pick<WeatherFeatureInput, 'rainfallMm' | 'forecastRainMm' | 'windMph' | 'lightningMiles' | 'humidityPct'>): number {
  return round4(
    0.25 * normalizeRange(input.rainfallMm ?? 0, 0, 20) +
    0.20 * normalizeRange(input.forecastRainMm ?? 0, 0, 30) +
    0.20 * normalizeRange(input.windMph ?? 0, 10, 45) +
    0.25 * lightningRiskFromDistance(input.lightningMiles) +
    0.10 * normalizeRange(input.humidityPct ?? 50, 60, 100),
  );
}

function lightningRiskFromDistance(lightningMiles: number | undefined): number {
  if (!isFiniteNumber(lightningMiles)) return 0.2;
  if (lightningMiles <= 2) return 1;
  if (lightningMiles >= 15) return 0;
  return normalizeRange(15 - lightningMiles, 0, 13);
}

function hoursBetween(earlierIso: string | undefined, laterIso: string): number | undefined {
  const minutes = minutesBetween(earlierIso, laterIso);
  return minutes === undefined ? undefined : round4(minutes / 60);
}

function minutesBetween(earlierIso: string | undefined, laterIso: string | undefined): number | undefined {
  const earlier = earlierIso ? Date.parse(earlierIso) : Number.NaN;
  const later = laterIso ? Date.parse(laterIso) : Number.NaN;
  if (!Number.isFinite(earlier) || !Number.isFinite(later)) return undefined;
  return Math.max(0, (later - earlier) / 60_000);
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}
