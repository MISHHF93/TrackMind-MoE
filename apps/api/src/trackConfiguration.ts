import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService, ControlledAction, ControlledActionRequest } from './approvals.js';
import type { UniversalEventBus } from './eventBus.js';
import type { WorkflowDefinition, WorkflowInstance, WorkflowOrchestrationEngine } from './workflowEngine.js';

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
  racetrackId?: string;
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
  status?: 'draft' | 'approval-blocked' | 'issued' | 'verification-pending' | 'verified';
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

export interface VerificationTask {
  id: string;
  workOrderId: string;
  label: string;
  requiredEvidence: string[];
  status: 'open' | 'verified';
}

export interface TrackVerificationWorkflow {
  id: string;
  changeId: string;
  status: 'draft' | 'approval-blocked' | 'ready-for-field-verification' | 'verified';
  tasks: VerificationTask[];
  requiredRoles: string[];
  digitalTwinSync: 'blocked-until-approved' | 'blocked-until-verified' | 'ready-for-sync';
  actuatorControlAvailable: false;
}

export interface TrackConfigurationExecutionPlan {
  changeId: string;
  executionMode: 'draft-work-order-verification-only';
  noLiveActuatorControl: true;
  geospatialValidation: GPSValidationResult;
  simulation: SimulationResult;
  approvalRequirements: string[];
  workOrders: WorkOrder[];
  verificationWorkflow: TrackVerificationWorkflow;
  digitalTwinPatchPreview: { twinId: string; patch: Record<string, unknown>; status: 'approval-required' | 'verification-required' | 'ready-for-sync' };
  eventTypes: string[];
  auditActions: string[];
}

export interface TrackConfigurationSubmitOptions {
  tenantId?: string;
  boundaries?: TrackBoundary[];
  startVerificationWorkflow?: boolean;
}

export interface TrackConfigurationPlatformOptions {
  eventBus?: UniversalEventBus;
  auditLog?: ImmutableAuditLog;
  approvals?: CentralizedApprovalService;
  workflow?: WorkflowOrchestrationEngine;
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
      status: change.status === 'approved' ? 'issued' : 'approval-blocked',
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
      status: change.status === 'approved' ? 'issued' : 'approval-blocked',
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
      status: change.status === 'approved' ? 'issued' : 'approval-blocked',
      tasks: [`prepare turf lane ${setup.turfConfiguration.lane}`, `confirm going ${setup.turfConfiguration.going}`],
      safetyHoldPoints: ['course superintendent approval'],
      evidenceRequired: ['going-stick-reading', 'irrigation-log', 'mowing-log'],
      dueAt: setup.surfaceAllocation.start,
    });
  }
  return orders;
}

export function validateTrackConfigurationChange(change: TrackConfigurationChange, boundaries: TrackBoundary[] = [], sectors: TrackSector[] = []): GPSValidationResult {
  const geospatial = boundaries.length ? validateGpsPlacement(change.raceSetup.gatePlacement, boundaries) : { valid: true, errors: [], warnings: ['track boundary validation was not provided'], mappedSurface: undefined };
  const errors = [...geospatial.errors];
  const warnings = [...geospatial.warnings];
  if (geospatial.mappedSurface && geospatial.mappedSurface !== change.raceSetup.surface) errors.push(`gate surface ${geospatial.mappedSurface} does not match race surface ${change.raceSetup.surface}`);
  if (change.raceSetup.railPosition && change.raceSetup.railPosition.offsetMeters < 0) errors.push('rail offset cannot be negative');
  if (change.raceSetup.railPosition && change.raceSetup.railPosition.offsetMeters > 18) warnings.push('rail offset exceeds standard portable rail operating range');
  if (change.raceSetup.surface !== 'turf' && change.raceSetup.turfConfiguration) errors.push('turf configuration can only be applied to turf races');
  if (change.raceSetup.surface === 'turf' && !change.raceSetup.turfConfiguration) warnings.push('turf races should include going, irrigation, mowing, and resting-lane configuration');
  const knownSectors = new Set(sectors.map((sector) => sector.id));
  for (const sectorId of change.raceSetup.sectorIds ?? []) if (!knownSectors.has(sectorId)) errors.push(`unknown sector in race setup: ${sectorId}`);
  if (change.raceSetup.surfaceAllocation.purpose !== 'racing') warnings.push('surface allocation is not marked for racing');
  return { valid: errors.length === 0, errors, warnings, mappedSurface: geospatial.mappedSurface };
}

export function buildVerificationWorkflow(change: TrackConfigurationChange, workOrders = generateTrackWorkOrders(change)): TrackVerificationWorkflow {
  const approved = change.status === 'approved' || change.status === 'scheduled' || change.status === 'synced';
  const tasks = workOrders.map((order): VerificationTask => ({
    id: `${order.id}-verify`,
    workOrderId: order.id,
    label: `Verify ${order.crew} work order ${order.id}`,
    requiredEvidence: [...new Set([...order.evidenceRequired, ...order.safetyHoldPoints])],
    status: 'open',
  }));
  return {
    id: `${change.id}-verification`,
    changeId: change.id,
    status: approved ? 'ready-for-field-verification' : 'approval-blocked',
    tasks,
    requiredRoles: requiredApprovalsForChange(change),
    digitalTwinSync: approved ? 'blocked-until-verified' : 'blocked-until-approved',
    actuatorControlAvailable: false,
  };
}

export function buildTrackConfigurationExecutionPlan(change: TrackConfigurationChange, boundaries: TrackBoundary[] = [], sectors: TrackSector[] = []): TrackConfigurationExecutionPlan {
  const workOrders = generateTrackWorkOrders(change);
  const verificationWorkflow = buildVerificationWorkflow(change, workOrders);
  const geospatialValidation = validateTrackConfigurationChange(change, boundaries, sectors);
  const approved = change.status === 'approved' || change.status === 'scheduled' || change.status === 'synced';
  return {
    changeId: change.id,
    executionMode: 'draft-work-order-verification-only',
    noLiveActuatorControl: true,
    geospatialValidation,
    simulation: simulateRaceSetup(change.raceSetup),
    approvalRequirements: requiredApprovalsForChange(change),
    workOrders,
    verificationWorkflow,
    digitalTwinPatchPreview: { twinId: `race-setup:${change.raceSetup.raceId}`, patch: { ...change.raceSetup }, status: approved ? 'verification-required' : 'approval-required' },
    eventTypes: ['track.configuration.change.requested', 'track.configuration.approval.required', 'track.configuration.work-order.issued', 'track.configuration.verified', 'track.configuration.digital-twin.sync.requested', 'digital-twin.state.patch'],
    auditActions: ['submit-track-configuration-change', 'approval.requested', 'issue-track-work-orders', 'verify-track-configuration', 'synchronize-track-configuration'],
  };
}

export function trackConfigurationWorkflowDefinition(tenantId: string, change: TrackConfigurationChange): WorkflowDefinition {
  const refs = [`race-setup:${change.raceSetup.raceId}`, `starting-gate:${change.raceSetup.gatePlacement.gateId}`];
  return {
    id: `track-configuration-${change.id}`,
    name: `Track Configuration Verification ${change.id}`,
    domain: 'maintenance',
    version: '1.0.0',
    bpmnProcessId: `Process_TrackConfiguration_${change.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
    startStepId: 'approval-gate',
    ownerRole: 'track-superintendent',
    tenantId,
    triggerEvents: ['track.configuration.change.requested'],
    steps: [
      { id: 'approval-gate', name: 'Confirm approvals before field work', type: 'parallelApproval', approvalRoles: requiredApprovalsForChange(change), requiredApprovals: requiredApprovalsForChange(change).length, slaMinutes: 20, digitalTwin: { refs, syncMode: 'read', statePatch: { approvalGate: 'pending' } }, next: ['issue-work-orders'] },
      { id: 'issue-work-orders', name: 'Issue draft work orders', type: 'userTask', role: 'race-office', slaMinutes: 30, digitalTwin: { refs, syncMode: 'read', statePatch: { workOrders: 'drafted' } }, next: ['field-verification'] },
      { id: 'field-verification', name: 'Verify GPS, rail, turf, and timing evidence', type: 'userTask', role: 'track-superintendent', slaMinutes: 30, digitalTwin: { refs, syncMode: 'read', statePatch: { verification: 'pending' } }, next: ['queue-twin-sync'] },
      { id: 'queue-twin-sync', name: 'Queue Digital Twin synchronization', type: 'serviceTask', action: () => ({ trackConfigurationTwinSync: 'queued-after-verification', noLiveActuatorControl: true }), digitalTwin: { refs, syncMode: 'write', statePatch: { trackConfiguration: 'verified' } }, next: ['done'] },
      { id: 'done', name: 'Track configuration verification complete', type: 'endEvent' },
    ],
  };
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
  if (approverRole === 'ai-agent' || approverRole === 'service' || approverRole.startsWith('ai-')) throw new Error('track configuration approvals require authorized human roles');
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
  private workOrderRecords = new Map<string, WorkOrder[]>();
  private verificationRecords = new Map<string, TrackVerificationWorkflow>();
  private approvalRequestRecords = new Map<string, ControlledActionRequest[]>();
  private workflowInstances = new Map<string, WorkflowInstance>();

  constructor(private readonly options: TrackConfigurationPlatformOptions = {}) {
    this.registerEventContracts();
  }

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

  submit(change: TrackConfigurationChange, options: TrackConfigurationSubmitOptions = {}): TrackConfigurationChange {
    if (change.evidence.length === 0) throw new Error('track configuration changes require evidence');
    const sectorList = [...this.sectors.values()];
    const calculations = change.raceSetup.calculations ?? calculateRaceDistance(change.raceSetup, sectorList);
    const saved = { ...change, raceSetup: { ...change.raceSetup, calculations }, status: change.status === 'draft' ? 'pending-approval' as const : change.status };
    const geospatial = validateTrackConfigurationChange(saved, options.boundaries ?? [], sectorList);
    if (!geospatial.valid) throw new Error(`track configuration failed geospatial validation: ${geospatial.errors.join('; ')}`);
    this.changes.set(saved.id, saved);
    this.workOrderRecords.set(saved.id, generateTrackWorkOrders(saved));
    this.verificationRecords.set(saved.id, buildVerificationWorkflow(saved, this.workOrderRecords.get(saved.id)));
    if (options.tenantId && this.options.approvals) this.approvalRequestRecords.set(saved.id, this.createApprovalRequests(saved, options.tenantId));
    if (options.tenantId && options.startVerificationWorkflow && this.options.workflow) this.workflowInstances.set(saved.id, this.startVerificationWorkflow(saved, options.tenantId));
    this.audit(change.requestedBy, 'submit-track-configuration-change', saved.id, saved.requestedAt, saved.evidence);
    void this.publish('track.configuration.change.requested', { changeId: saved.id, raceId: saved.raceSetup.raceId, status: saved.status, requiredApprovals: requiredApprovalsForChange(saved), noLiveActuatorControl: true }, saved.id);
    void this.publish('track.configuration.approval.required', { changeId: saved.id, requiredApprovals: requiredApprovalsForChange(saved), approvalRequestIds: this.approvalRequests(saved.id).map((request) => request.id) }, saved.id);
    return saved;
  }

  moveGate(changeId: string, move: GateMoveRequest): TrackConfigurationChange {
    if (move.requestedBy === 'ai-agent' || move.requestedBy.startsWith('ai-')) throw new Error('AI cannot move starting gates; it may only draft recommendations for human approval');
    const current = this.requireChange(changeId);
    const next = generateGateMoveChange(current, move, [...this.sectors.values()]);
    this.changes.set(next.id, next);
    this.workOrderRecords.set(next.id, generateTrackWorkOrders(next));
    this.verificationRecords.set(next.id, buildVerificationWorkflow(next, this.workOrderRecords.get(next.id)));
    this.audit(move.requestedBy, 'move-gate-and-recalculate-race-distance', next.id, move.requestedAt, next.evidence);
    void this.publish('track.configuration.change.requested', { changeId: next.id, raceId: next.raceSetup.raceId, status: next.status, requiredApprovals: requiredApprovalsForChange(next), noLiveActuatorControl: true }, next.id);
    return next;
  }

  approve(changeId: string, approverRole: string, evidence: string[], timestamp: string): TrackConfigurationChange {
    const current = this.requireChange(changeId);
    const next = approveTrackChange(current, approverRole, evidence, timestamp);
    this.changes.set(changeId, next);
    this.workOrderRecords.set(changeId, generateTrackWorkOrders(next));
    this.verificationRecords.set(changeId, buildVerificationWorkflow(next, this.workOrderRecords.get(changeId)));
    this.audit(approverRole, 'approve-track-configuration-change', changeId, timestamp, evidence);
    void this.publish('track.configuration.approval.recorded', { changeId, approverRole, status: next.status, approvals: next.approvals }, changeId);
    return next;
  }

  executionPlan(changeId: string, boundaries: TrackBoundary[] = []): TrackConfigurationExecutionPlan {
    return buildTrackConfigurationExecutionPlan(this.requireChange(changeId), boundaries, [...this.sectors.values()]);
  }

  approvalRequests(changeId: string): ControlledActionRequest[] {
    return (this.approvalRequestRecords.get(changeId) ?? []).map((request) => structuredClone(request));
  }

  verificationWorkflow(changeId: string): TrackVerificationWorkflow {
    const workflow = this.verificationRecords.get(changeId) ?? buildVerificationWorkflow(this.requireChange(changeId), this.workOrders(changeId));
    return structuredClone(workflow);
  }

  workflowInstance(changeId: string): WorkflowInstance | undefined {
    const instance = this.workflowInstances.get(changeId);
    return instance ? structuredClone(instance) : undefined;
  }

  workOrders(changeId: string): WorkOrder[] {
    const orders = this.workOrderRecords.get(changeId) ?? generateTrackWorkOrders(this.requireChange(changeId));
    return orders.map((order) => ({ ...order, tasks: [...order.tasks], safetyHoldPoints: [...order.safetyHoldPoints], evidenceRequired: [...order.evidenceRequired] }));
  }

  issueWorkOrders(changeId: string, actor: string, issuedAt: string): WorkOrder[] {
    const current = this.requireChange(changeId);
    if (current.status !== 'approved') throw new Error('work orders can only be issued after track configuration approval');
    if (actor === 'ai-agent' || actor.startsWith('ai-')) throw new Error('AI cannot issue track configuration work orders');
    const orders = generateTrackWorkOrders(current).map((order) => ({ ...order, status: 'issued' as const }));
    this.workOrderRecords.set(changeId, orders);
    this.verificationRecords.set(changeId, buildVerificationWorkflow(current, orders));
    this.audit(actor, 'issue-track-work-orders', changeId, issuedAt, orders.map((order) => order.id));
    void this.publish('track.configuration.work-order.issued', { changeId, workOrders: orders, noLiveActuatorControl: true }, changeId);
    return this.workOrders(changeId);
  }

  recordVerification(changeId: string, input: { verifiedBy: string; verifiedAt: string; evidence: string[] }): TrackVerificationWorkflow {
    const current = this.requireChange(changeId);
    if (current.status !== 'approved') throw new Error('field verification requires approved track configuration');
    if (input.verifiedBy === 'ai-agent' || input.verifiedBy.startsWith('ai-')) throw new Error('track configuration verification requires authorized human evidence');
    if (input.evidence.length === 0) throw new Error('verification requires evidence');
    const orders = this.workOrders(changeId);
    const requiredEvidence = [...new Set(orders.flatMap((order) => order.evidenceRequired))];
    const missing = requiredEvidence.filter((item) => !input.evidence.includes(item));
    if (missing.length) throw new Error(`verification evidence missing: ${missing.join(', ')}`);
    const workflow: TrackVerificationWorkflow = {
      id: `${changeId}-verification`,
      changeId,
      status: 'verified',
      tasks: orders.map((order) => ({ id: `${order.id}-verify`, workOrderId: order.id, label: `Verified ${order.crew} work order ${order.id}`, requiredEvidence: [...new Set([...order.evidenceRequired, ...order.safetyHoldPoints])], status: 'verified' })),
      requiredRoles: requiredApprovalsForChange(current),
      digitalTwinSync: 'ready-for-sync',
      actuatorControlAvailable: false,
    };
    this.verificationRecords.set(changeId, workflow);
    this.workOrderRecords.set(changeId, orders.map((order) => ({ ...order, status: 'verified' })));
    this.audit(input.verifiedBy, 'verify-track-configuration', changeId, input.verifiedAt, input.evidence);
    void this.publish('track.configuration.verified', { changeId, verification: workflow, noLiveActuatorControl: true }, changeId);
    return this.verificationWorkflow(changeId);
  }

  synchronizeDigitalTwin(changeId: string, syncedAt: string): DigitalTwinSyncRecord {
    const current = this.requireChange(changeId);
    if (current.status !== 'approved') throw new Error('only approved track changes can synchronize to the Digital Twin');
    const verification = this.verificationRecords.get(changeId);
    if (verification && verification.status !== 'verified') throw new Error('track configuration requires field verification before Digital Twin sync');
    const version = (this.twinVersions.get(current.raceSetup.raceId) ?? 0) + 1;
    this.twinVersions.set(current.raceSetup.raceId, version);
    const record = { twinId: `race-setup:${current.raceSetup.raceId}`, version, changeId, syncedAt, state: { ...current.raceSetup, sectors: current.raceSetup.sectorIds?.map((id) => this.sectors.get(id)), courseLayout: current.raceSetup.courseLayoutId ? this.courseLayouts.get(current.raceSetup.courseLayoutId) : undefined } };
    this.changes.set(changeId, { ...current, status: 'synced' });
    this.audit('digital-twin', 'synchronize-track-configuration', changeId, syncedAt, [`twin-version:${version}`]);
    void this.publish('track.configuration.digital-twin.sync.requested', { changeId, twinId: record.twinId, version, verified: true }, changeId);
    void this.publish('digital-twin.state.patch', { twinId: record.twinId, patch: record.state, actor: 'track-configuration-platform', observedAt: syncedAt }, record.twinId);
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
    const entry = { id: `audit-${this.audits.length + 1}`, actor, action, timestamp, changeId, evidence: [...evidence] };
    this.audits.push(entry);
    const change = this.changes.get(changeId);
    this.options.auditLog?.append({ id: `audit-track-config-${this.audits.length}`, type: action.includes('approve') ? 'approval' : 'configuration-change', actor, timestamp, payload: { action, changeId, evidence }, subjectId: changeId, racetrackId: change?.raceSetup.racetrackId ?? change?.raceSetup.raceId, severity: 'warning', regulations: ['HISA', 'ARCI', 'StateRacingCommission'], evidenceIds: evidence });
  }

  private createApprovalRequests(change: TrackConfigurationChange, tenantId: string): ControlledActionRequest[] {
    const actions = this.controlledActionsFor(change);
    return actions.map((action) => this.options.approvals!.createRequest({
      tenantId,
      racetrackId: change.raceSetup.racetrackId ?? change.raceSetup.raceId,
      action,
      target: change.id,
      requestedBy: change.requestedBy,
      actorType: change.requestedBy.startsWith('ai-') ? 'ai-agent' : 'human',
      reason: change.reason,
      evidence: [...change.evidence, `race:${change.raceSetup.raceId}`, `approval-roles:${requiredApprovalsForChange(change).join('|')}`],
      workflowInstanceId: this.workflowInstances.get(change.id)?.id,
    }));
  }

  private controlledActionsFor(change: TrackConfigurationChange): ControlledAction[] {
    const actions = new Set<ControlledAction>(['race-office-configuration']);
    if (change.kind === 'race-distance' || change.kind === 'gate-placement' || change.kind === 'race-setup') actions.add('race-distance-configuration');
    if (change.kind === 'gate-placement' || change.kind === 'race-distance') actions.add('starting-gate-move');
    return [...actions];
  }

  private startVerificationWorkflow(change: TrackConfigurationChange, tenantId: string): WorkflowInstance {
    const definition = trackConfigurationWorkflowDefinition(tenantId, change);
    this.options.workflow!.register(definition);
    return this.options.workflow!.start(definition.id, { tenantId, priority: 'high', digitalTwinRefs: [`race-setup:${change.raceSetup.raceId}`, `starting-gate:${change.raceSetup.gatePlacement.gateId}`], payload: { changeId: change.id, raceId: change.raceSetup.raceId, noLiveActuatorControl: true } }, change.requestedBy, change.requestedAt);
  }

  private registerEventContracts(): void {
    for (const type of ['track.configuration.change.requested', 'track.configuration.approval.required', 'track.configuration.approval.recorded', 'track.configuration.work-order.issued', 'track.configuration.verified', 'track.configuration.digital-twin.sync.requested']) {
      this.options.eventBus?.registerEvent({ type, version: 1, description: `Track configuration ${type}`, owner: { service: 'track-configuration-platform', team: 'racetrack-platform', accountableRole: 'track-superintendent' }, payloadFields: ['changeId'], compliance: 'regulated' });
    }
  }

  private async publish(type: string, payload: Record<string, unknown>, aggregateId: string): Promise<void> {
    await this.options.eventBus?.publish({ type, payload, aggregateId, producer: 'track-configuration-platform', metadata: { compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'track-superintendent' } });
  }
}
