export type RacingSurface = 'dirt' | 'turf' | 'synthetic';
export type ApprovalState = 'draft' | 'pending-approval' | 'approved' | 'rejected' | 'scheduled' | 'synced';
export type TrackModificationKind = 'race-distance' | 'gate-placement' | 'rail-position' | 'turf-configuration' | 'surface-allocation' | 'race-setup';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface TrackBoundary {
  id: string;
  name: string;
  surface: RacingSurface;
  polygon: GeoPoint[];
}

export interface GatePlacement {
  gateId: string;
  raceId: string;
  distanceMeters: number;
  location: GeoPoint;
  headingDegrees: number;
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

export interface SurfaceAllocation {
  surface: RacingSurface;
  purpose: 'racing' | 'training' | 'maintenance' | 'closed';
  start: string;
  end: string;
}

export interface RaceSetupParameters {
  raceId: string;
  distanceMeters: number;
  surface: RacingSurface;
  maxFieldSize: number;
  gatePlacement: GatePlacement;
  railPosition?: RailPosition;
  turfConfiguration?: TurfConfiguration;
  surfaceAllocation: SurfaceAllocation;
  regulatoryJurisdiction: string;
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

export function validateGpsPlacement(gate: GatePlacement, boundaries: TrackBoundary[]): GPSValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isValidCoordinate(gate.location)) errors.push('gate GPS coordinate is outside latitude/longitude bounds');
  if (gate.headingDegrees < 0 || gate.headingDegrees >= 360) errors.push('gate heading must be between 0 and 359 degrees');
  if (gate.distanceMeters < 200) errors.push('race distance is below supported regulatory minimum');
  const boundary = boundaries.find((candidate) => insideBoundingBox(gate.location, candidate.polygon));
  if (!boundary) errors.push('gate location is outside configured track boundaries');
  if (gate.distanceMeters > 3200) warnings.push('long-distance setup requires steward and racing secretary confirmation');
  return { valid: errors.length === 0, errors, warnings, mappedSurface: boundary?.surface };
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

export function generateTrackWorkOrders(change: TrackConfigurationChange): WorkOrder[] {
  const setup = change.raceSetup;
  const base = [`verify ${setup.distanceMeters}m race distance`, `place gate ${setup.gatePlacement.gateId}`, `publish setup for ${setup.raceId}`];
  const orders: WorkOrder[] = [
    {
      id: `${change.id}-gate`,
      changeId: change.id,
      crew: 'gate-crew',
      tasks: [...base, 'capture post-placement GPS proof'],
      safetyHoldPoints: ['starter sign-off', 'steward visual inspection'],
      evidenceRequired: ['gps-fix', 'photo', 'crew-attestation'],
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

export function approveTrackChange(change: TrackConfigurationChange, approverRole: string, evidence: string[], timestamp: string): TrackConfigurationChange {
  if (evidence.length === 0) throw new Error('approval requires evidence');
  const approvals = [...new Set([...change.approvals, approverRole])];
  const required = ['racing-secretary', 'track-superintendent', 'steward'];
  const status: ApprovalState = required.every((role) => approvals.includes(role)) ? 'approved' : 'pending-approval';
  return { ...change, approvals, status, evidence: [...change.evidence, ...evidence, `approved:${approverRole}:${timestamp}`] };
}

export function simulateRaceSetup(setup: RaceSetupParameters): SimulationResult {
  const issues: string[] = [];
  if (setup.maxFieldSize > 14) issues.push('field size exceeds standard gate capacity');
  if (setup.surface === 'turf' && setup.turfConfiguration?.resting) issues.push('selected turf lane is resting');
  if (setup.railPosition && setup.railPosition.offsetMeters > 12) issues.push('rail offset materially changes advertised distance');
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

  submit(change: TrackConfigurationChange): TrackConfigurationChange {
    if (change.evidence.length === 0) throw new Error('track configuration changes require evidence');
    const saved = { ...change, status: change.status === 'draft' ? 'pending-approval' as const : change.status };
    this.changes.set(saved.id, saved);
    this.audit(change.requestedBy, 'submit-track-configuration-change', saved.id, saved.requestedAt, saved.evidence);
    return saved;
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
    const record = { twinId: `race-setup:${current.raceSetup.raceId}`, version, changeId, syncedAt, state: { ...current.raceSetup } };
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
