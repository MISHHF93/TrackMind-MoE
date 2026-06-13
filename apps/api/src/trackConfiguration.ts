export type RacingSurface = 'dirt' | 'turf' | 'synthetic';
export type ApprovalState = 'draft' | 'pending-approval' | 'approved' | 'rejected' | 'scheduled' | 'synced';
export type TrackModificationKind = 'race-distance' | 'gate-placement' | 'rail-position' | 'turf-configuration' | 'surface-allocation' | 'track-sector' | 'course-layout' | 'race-setup';
export type SectorKind = 'straight' | 'turn' | 'chute' | 'runout' | 'crossing' | 'service-road';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  accuracyMeters?: number;
}

export interface GeoLineString {
  points: GeoPoint[];
}

export interface TrackBoundary {
  id: string;
  name: string;
  surface: RacingSurface;
  polygon: GeoPoint[];
}

export interface TrackSector {
  id: string;
  name: string;
  surface: RacingSurface;
  kind: SectorKind;
  centerline: GeoLineString;
  lengthMeters: number;
  widthMeters: number;
  maxFieldSize?: number;
  restrictions: string[];
}

export interface GatePlacement {
  gateId: string;
  raceId: string;
  distanceMeters: number;
  location: GeoPoint;
  headingDegrees: number;
  runUpMeters?: number;
  segmentId?: string;
}

export interface RailPosition {
  railId: string;
  offsetMeters: number;
  effectiveFrom: string;
  effectiveTo?: string;
  protectedTurns: string[];
}

export interface TurfConfiguration {
  lane: string;
  going: 'firm' | 'good' | 'yielding' | 'soft' | 'heavy';
  irrigationMillimeters: number;
  mowingHeightMillimeters: number;
  resting: boolean;
}

export interface CourseLayout {
  id: string;
  name: string;
  surface: RacingSurface;
  sectors: string[];
  nominalDistanceMeters: number;
  startGateCandidates: GatePlacement[];
  finishLine: GeoLineString;
  regulatoryReferences: string[];
}

export interface SurfaceAllocation {
  surface: RacingSurface;
  purpose: 'racing' | 'training' | 'maintenance' | 'closed';
  start: string;
  end: string;
}

export interface RaceSetupParameters {
  raceId: string;
  distanceMeters: number;
  advertisedDistanceMeters?: number;
  surface: RacingSurface;
  maxFieldSize: number;
  gatePlacement: GatePlacement;
  railPosition?: RailPosition;
  turfConfiguration?: TurfConfiguration;
  surfaceAllocation: SurfaceAllocation;
  courseLayoutId?: string;
  sectorIds?: string[];
  calculations?: RaceDistanceCalculation;
  regulatoryJurisdiction: string;
}

export interface RaceDistanceCalculation {
  advertisedDistanceMeters: number;
  measuredDistanceMeters: number;
  runUpMeters: number;
  railAdjustmentMeters: number;
  gateDeltaMeters: number;
  sectorDistanceMeters: number;
  timingBeamMeters: number;
  varianceMeters: number;
  regulatoryFlags: string[];
  calculationVersion: number;
}

export interface TrackConfigurationChange {
  id: string;
  kind: TrackModificationKind;
  requestedBy: string;
  requestedAt: string;
  raceSetup: RaceSetupParameters;
  evidence: string[];
  reason: string;
  status: ApprovalState;
  approvals: string[];
}

export interface GPSValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  mappedSurface?: RacingSurface;
}

export interface WorkOrder {
  id: string;
  changeId: string;
  crew: 'gate-crew' | 'rail-crew' | 'turf-crew' | 'surface-crew' | 'race-office';
  tasks: string[];
  safetyHoldPoints: string[];
  evidenceRequired: string[];
  dueAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  changeId: string;
  evidence: string[];
}

export interface DigitalTwinSyncRecord {
  twinId: string;
  version: number;
  changeId: string;
  syncedAt: string;
  state: Record<string, unknown>;
}

export interface GateMoveRequest {
  gateId: string;
  newDistanceMeters: number;
  newLocation: GeoPoint;
  headingDegrees: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  evidence: string[];
}

export interface TrackConfigurationSnapshot {
  boundaries: TrackBoundary[];
  sectors: TrackSector[];
  courseLayouts: CourseLayout[];
  activeSetups: RaceSetupParameters[];
  generatedAt: string;
}

export interface SimulationResult {
  safe: boolean;
  score: number;
  issues: string[];
  testedScenarios: string[];
}

function isValidCoordinate(point: GeoPoint): boolean {
  return point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

function insideBoundingBox(point: GeoPoint, polygon: GeoPoint[]): boolean {
  const latitudes = polygon.map((p) => p.latitude);
  const longitudes = polygon.map((p) => p.longitude);
  return point.latitude >= Math.min(...latitudes) && point.latitude <= Math.max(...latitudes) && point.longitude >= Math.min(...longitudes) && point.longitude <= Math.max(...longitudes);
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const radius = 6371000;
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function lineLengthMeters(line: GeoLineString): number {
  return line.points.slice(1).reduce((total, point, index) => total + haversineMeters(line.points[index], point), 0);
}

export function validateGpsPlacement(gate: GatePlacement, boundaries: TrackBoundary[]): GPSValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isValidCoordinate(gate.location)) errors.push('gate GPS coordinate is outside latitude/longitude bounds');
  if (gate.headingDegrees < 0 || gate.headingDegrees >= 360) errors.push('gate heading must be between 0 and 359 degrees');
  if (gate.location.accuracyMeters !== undefined && gate.location.accuracyMeters > 0.5) warnings.push('sub-meter GPS accuracy is recommended for regulatory gate placement');
  if (gate.distanceMeters < 200) errors.push('race distance is below supported regulatory minimum');
  const boundary = boundaries.find((candidate) => insideBoundingBox(gate.location, candidate.polygon));
  if (!boundary) errors.push('gate location is outside configured track boundaries');
  if (gate.distanceMeters > 3200) warnings.push('long-distance setup requires steward and racing secretary confirmation');
  return { valid: errors.length === 0, errors, warnings, mappedSurface: boundary?.surface };
}

export function calculateRaceDistance(setup: RaceSetupParameters, sectors: TrackSector[] = [], previous?: RaceDistanceCalculation): RaceDistanceCalculation {
  const selected = sectors.filter((sector) => setup.sectorIds?.includes(sector.id));
  const sectorDistanceMeters = selected.length > 0 ? selected.reduce((total, sector) => total + sector.lengthMeters, 0) : setup.distanceMeters;
  const runUpMeters = setup.gatePlacement.runUpMeters ?? 0;
  const railAdjustmentMeters = setup.railPosition ? Math.round(setup.railPosition.offsetMeters * 2.4 * 100) / 100 : 0;
  const measuredDistanceMeters = setup.gatePlacement.distanceMeters + runUpMeters + railAdjustmentMeters;
  const advertisedDistanceMeters = setup.advertisedDistanceMeters ?? setup.distanceMeters;
  const gateDeltaMeters = previous ? measuredDistanceMeters - previous.measuredDistanceMeters : measuredDistanceMeters - advertisedDistanceMeters;
  const varianceMeters = measuredDistanceMeters - advertisedDistanceMeters;
  const regulatoryFlags: string[] = [];
  if (Math.abs(varianceMeters) > 5) regulatoryFlags.push('distance-variance-review');
  if (Math.abs(gateDeltaMeters) > 0) regulatoryFlags.push('gate-position-changed');
  if (setup.railPosition && setup.railPosition.offsetMeters > 0) regulatoryFlags.push('rail-adjustment-applied');
  if (selected.some((sector) => sector.restrictions.length > 0)) regulatoryFlags.push('sector-restrictions-present');
  return {
    advertisedDistanceMeters,
    measuredDistanceMeters,
    runUpMeters,
    railAdjustmentMeters,
    gateDeltaMeters,
    sectorDistanceMeters,
    timingBeamMeters: measuredDistanceMeters,
    varianceMeters,
    regulatoryFlags,
    calculationVersion: (previous?.calculationVersion ?? 0) + 1,
  };
}

export function buildGeospatialMap(boundaries: TrackBoundary[], setups: RaceSetupParameters[]) {
  return boundaries.map((boundary) => ({
    boundaryId: boundary.id,
    name: boundary.name,
    surface: boundary.surface,
    activeRaces: setups.filter((setup) => setup.surface === boundary.surface).map((setup) => setup.raceId),
    gatePlacements: setups.filter((setup) => insideBoundingBox(setup.gatePlacement.location, boundary.polygon)).map((setup) => setup.gatePlacement),
  }));
}

export function buildTrackConfigurationSnapshot(boundaries: TrackBoundary[], sectors: TrackSector[], courseLayouts: CourseLayout[], activeSetups: RaceSetupParameters[], generatedAt: string): TrackConfigurationSnapshot {
  return {
    boundaries: boundaries.map((boundary) => ({ ...boundary, polygon: [...boundary.polygon] })),
    sectors: sectors.map((sector) => ({ ...sector, centerline: { points: [...sector.centerline.points] }, restrictions: [...sector.restrictions] })),
    courseLayouts: courseLayouts.map((layout) => ({ ...layout, sectors: [...layout.sectors], startGateCandidates: [...layout.startGateCandidates], finishLine: { points: [...layout.finishLine.points] }, regulatoryReferences: [...layout.regulatoryReferences] })),
    activeSetups: activeSetups.map((setup) => ({ ...setup })),
    generatedAt,
  };
}

export function generateTrackWorkOrders(change: TrackConfigurationChange): WorkOrder[] {
  const setup = change.raceSetup;
  const base = [`verify ${setup.distanceMeters}m race distance`, `place gate ${setup.gatePlacement.gateId}`, `publish setup for ${setup.raceId}`];
  const orders: WorkOrder[] = [
    {
      id: `${change.id}-gate`,
      changeId: change.id,
      crew: 'gate-crew',
      tasks: [...base, 'capture post-placement GPS proof'],
      safetyHoldPoints: ['starter sign-off', 'steward visual inspection', 'timing-beam alignment hold'],
      evidenceRequired: ['gps-fix', 'photo', 'crew-attestation', 'distance-calculation-sheet'],
      dueAt: setup.surfaceAllocation.start,
    },
  ];
  if (setup.railPosition) {
    orders.push({
      id: `${change.id}-rail`,
      changeId: change.id,
      crew: 'rail-crew',
      tasks: [`set rail ${setup.railPosition.railId} to ${setup.railPosition.offsetMeters}m`, 'inspect protected turns'],
      safetyHoldPoints: ['maintenance supervisor sign-off'],
      evidenceRequired: ['rail-measurement', 'inspection-report'],
      dueAt: setup.railPosition.effectiveFrom,
    });
  }
  if (setup.turfConfiguration) {
    orders.push({
      id: `${change.id}-turf`,
      changeId: change.id,
      crew: 'turf-crew',
      tasks: [`prepare turf lane ${setup.turfConfiguration.lane}`, `confirm going ${setup.turfConfiguration.going}`],
      safetyHoldPoints: ['course superintendent approval'],
      evidenceRequired: ['going-stick-reading', 'irrigation-log', 'mowing-log'],
      dueAt: setup.surfaceAllocation.start,
    });
  }
  return orders;
}

export function generateGateMoveChange(current: TrackConfigurationChange, move: GateMoveRequest, sectors: TrackSector[] = []): TrackConfigurationChange {
  if (move.evidence.length === 0) throw new Error('gate moves require survey and operational evidence');
  const previousCalculation = current.raceSetup.calculations ?? calculateRaceDistance(current.raceSetup, sectors);
  const gatePlacement: GatePlacement = {
    ...current.raceSetup.gatePlacement,
    gateId: move.gateId,
    distanceMeters: move.newDistanceMeters,
    location: move.newLocation,
    headingDegrees: move.headingDegrees,
  };
  const raceSetup = {
    ...current.raceSetup,
    distanceMeters: move.newDistanceMeters,
    gatePlacement,
  };
  const calculations = calculateRaceDistance(raceSetup, sectors, previousCalculation);
  return {
    ...current,
    id: `${current.id}-gate-move-${previousCalculation.calculationVersion + 1}`,
    kind: 'race-distance',
    requestedBy: move.requestedBy,
    requestedAt: move.requestedAt,
    raceSetup: { ...raceSetup, calculations },
    evidence: [...current.evidence, ...move.evidence, `prior-calculation-version:${previousCalculation.calculationVersion}`],
    reason: move.reason,
    status: 'pending-approval',
    approvals: [],
  };
}

export function approveTrackChange(change: TrackConfigurationChange, approverRole: string, evidence: string[], timestamp: string): TrackConfigurationChange {
  if (evidence.length === 0) throw new Error('approval requires evidence');
  const approvals = [...new Set([...change.approvals, approverRole])];
  const required = requiredApprovalsForChange(change);
  const status: ApprovalState = required.every((role) => approvals.includes(role)) ? 'approved' : 'pending-approval';
  return { ...change, approvals, status, evidence: [...change.evidence, ...evidence, `approved:${approverRole}:${timestamp}`] };
}

export function requiredApprovalsForChange(change: TrackConfigurationChange): string[] {
  const required = new Set(['racing-secretary', 'track-superintendent', 'steward']);
  if (change.kind === 'race-distance' || change.kind === 'gate-placement') required.add('timer');
  if (change.raceSetup.surface === 'turf' || change.kind === 'turf-configuration') required.add('course-superintendent');
  if ((change.kind === 'race-distance' || change.kind === 'gate-placement') && change.raceSetup.calculations?.regulatoryFlags.includes('distance-variance-review')) required.add('regulatory-compliance');
  return [...required];
}

export function simulateRaceSetup(setup: RaceSetupParameters): SimulationResult {
  const issues: string[] = [];
  if (setup.maxFieldSize > 14) issues.push('field size exceeds standard gate capacity');
  if (setup.surface === 'turf' && setup.turfConfiguration?.resting) issues.push('selected turf lane is resting');
  if (setup.railPosition && setup.railPosition.offsetMeters > 12) issues.push('rail offset materially changes advertised distance');
  if (setup.calculations && Math.abs(setup.calculations.varianceMeters) > 5) issues.push('calculated distance variance exceeds regulatory tolerance');
  if (new Date(setup.surfaceAllocation.end) <= new Date(setup.surfaceAllocation.start)) issues.push('surface allocation end must be after start');
  return {
    safe: issues.length === 0,
    score: Math.max(0, 100 - issues.length * 25),
    issues,
    testedScenarios: ['gate-load', 'first-turn-runup', 'rail-clearance', 'surface-availability', 'emergency-access'],
  };
}

export class TrackConfigurationPlatform {
  private changes = new Map<string, TrackConfigurationChange>();
  private audits: AuditEntry[] = [];
  private twinVersions = new Map<string, number>();
  private sectors = new Map<string, TrackSector>();
  private courseLayouts = new Map<string, CourseLayout>();

  registerSector(sector: TrackSector): TrackSector {
    const measuredLength = lineLengthMeters(sector.centerline);
    const saved = { ...sector, lengthMeters: sector.lengthMeters || Math.round(measuredLength), restrictions: [...sector.restrictions] };
    this.sectors.set(saved.id, saved);
    this.audit('track-configuration-service', 'register-track-sector', saved.id, new Date(0).toISOString(), [`length:${saved.lengthMeters}`]);
    return saved;
  }

  registerCourseLayout(layout: CourseLayout): CourseLayout {
    for (const sectorId of layout.sectors) {
      if (!this.sectors.has(sectorId)) throw new Error(`Unknown track sector ${sectorId}`);
    }
    this.courseLayouts.set(layout.id, { ...layout, sectors: [...layout.sectors], regulatoryReferences: [...layout.regulatoryReferences] });
    this.audit('track-configuration-service', 'register-course-layout', layout.id, new Date(0).toISOString(), layout.regulatoryReferences);
    return layout;
  }

  submit(change: TrackConfigurationChange): TrackConfigurationChange {
    if (change.evidence.length === 0) throw new Error('track configuration changes require evidence');
    const sectorList = [...this.sectors.values()];
    const calculations = change.raceSetup.calculations ?? calculateRaceDistance(change.raceSetup, sectorList);
    const saved = { ...change, raceSetup: { ...change.raceSetup, calculations }, status: change.status === 'draft' ? 'pending-approval' as const : change.status };
    this.changes.set(saved.id, saved);
    this.audit(change.requestedBy, 'submit-track-configuration-change', saved.id, saved.requestedAt, saved.evidence);
    return saved;
  }

  moveGate(changeId: string, move: GateMoveRequest): TrackConfigurationChange {
    const current = this.requireChange(changeId);
    const next = generateGateMoveChange(current, move, [...this.sectors.values()]);
    this.changes.set(next.id, next);
    this.audit(move.requestedBy, 'move-gate-and-recalculate-race-distance', next.id, move.requestedAt, next.evidence);
    return next;
  }

  approve(changeId: string, approverRole: string, evidence: string[], timestamp: string): TrackConfigurationChange {
    const current = this.requireChange(changeId);
    const next = approveTrackChange(current, approverRole, evidence, timestamp);
    this.changes.set(changeId, next);
    this.audit(approverRole, 'approve-track-configuration-change', changeId, timestamp, evidence);
    return next;
  }

  synchronizeDigitalTwin(changeId: string, syncedAt: string): DigitalTwinSyncRecord {
    const current = this.requireChange(changeId);
    if (current.status !== 'approved') throw new Error('only approved track changes can synchronize to the Digital Twin');
    const version = (this.twinVersions.get(current.raceSetup.raceId) ?? 0) + 1;
    this.twinVersions.set(current.raceSetup.raceId, version);
    const record = { twinId: `race-setup:${current.raceSetup.raceId}`, version, changeId, syncedAt, state: { ...current.raceSetup, sectors: current.raceSetup.sectorIds?.map((id) => this.sectors.get(id)), courseLayout: current.raceSetup.courseLayoutId ? this.courseLayouts.get(current.raceSetup.courseLayoutId) : undefined } };
    this.changes.set(changeId, { ...current, status: 'synced' });
    this.audit('digital-twin', 'synchronize-track-configuration', changeId, syncedAt, [`twin-version:${version}`]);
    return record;
  }

  raceOfficeExport(changeId: string) {
    const current = this.requireChange(changeId);
    return {
      raceId: current.raceSetup.raceId,
      distanceMeters: current.raceSetup.distanceMeters,
      surface: current.raceSetup.surface,
      gateId: current.raceSetup.gatePlacement.gateId,
      railOffsetMeters: current.raceSetup.railPosition?.offsetMeters ?? 0,
      jurisdiction: current.raceSetup.regulatoryJurisdiction,
      approvals: current.approvals,
      status: current.status,
    };
  }

  auditTrail(changeId?: string): AuditEntry[] {
    return this.audits.filter((entry) => !changeId || entry.changeId === changeId).map((entry) => ({ ...entry, evidence: [...entry.evidence] }));
  }

  private requireChange(changeId: string): TrackConfigurationChange {
    const current = this.changes.get(changeId);
    if (!current) throw new Error(`Unknown track configuration change ${changeId}`);
    return current;
  }

  private audit(actor: string, action: string, changeId: string, timestamp: string, evidence: string[]): void {
    this.audits.push({ id: `audit-${this.audits.length + 1}`, actor, action, timestamp, changeId, evidence: [...evidence] });
  }
}
