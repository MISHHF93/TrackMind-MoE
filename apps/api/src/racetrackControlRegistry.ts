import type { ExpertDomain, ProtectedAction } from '@trackmind/shared';

export type ControlCategory = 'A_AUTONOMOUS' | 'B_AI_RECOMMENDED' | 'C_HUMAN_CONTROLLED';
export type AssetRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AssetDomain = 'racing' | 'surface' | 'facilities' | 'security' | 'fan-experience' | 'safety' | 'regulatory';

export interface ControlDefinition {
  name: string;
  category: ControlCategory;
  description: string;
  requiresApprovalFrom: string[];
  protectedAction?: ProtectedAction | string;
  executionMode: 'automatic' | 'recommendation-only' | 'human-only';
}

export interface SensorDefinition {
  id: string;
  type: string;
  verifies: string[];
  required: boolean;
}

export interface RegulationDefinition {
  authority: 'HISA' | 'StateRacingCommission' | 'TrackPolicy' | 'OSHA' | 'PCI-DSS' | 'EmergencyManagement' | 'LocalLaw';
  reference: string;
  appliesTo: string[];
}

export interface RacetrackControlAsset<TLocation = Record<string, unknown>, TState = Record<string, unknown>> {
  assetId: string;
  assetType: string;
  domain: AssetDomain;
  ownerAgent: ExpertDomain;
  location: TLocation;
  state: TState;
  controls: ControlDefinition[];
  sensors: SensorDefinition[];
  regulations: RegulationDefinition[];
  riskLevel: AssetRiskLevel;
  approvalPolicy: string;
  lastUpdated: string;
}

export interface GateLocation {
  railPositionMeters: number;
  gps?: { lat: number; lon: number };
}

export interface StartingGateState {
  currentPositionMeters: number;
  targetPositionMeters?: number;
  doors: 'OPEN' | 'CLOSED';
  locked: boolean;
  readinessStatus: 'READY' | 'NOT_READY' | 'INSPECTION_REQUIRED';
  maintenanceStatus: 'OK' | 'DUE' | 'OUT_OF_SERVICE';
  batteryStatus?: number;
  crewAssignment?: string;
  lastInspection: string;
  approvedBy?: string;
}

export interface RaceDistanceSetup {
  raceId: string;
  distanceFurlongs: number;
  requiredGateLocation: { x: number; y: number };
  approvedBy?: string;
}

export const controlCategoryPolicies: Record<ControlCategory, { label: string; defaultApprovalPolicy: string; aiAuthority: string }> = {
  A_AUTONOMOUS: {
    label: 'Autonomous',
    defaultApprovalPolicy: 'AI may execute low-risk digital actions with audit logging.',
    aiAuthority: 'act',
  },
  B_AI_RECOMMENDED: {
    label: 'AI Recommended',
    defaultApprovalPolicy: 'AI may recommend, simulate, and prepare work orders; human approval is required before physical execution.',
    aiAuthority: 'recommend',
  },
  C_HUMAN_CONTROLLED: {
    label: 'Human Controlled',
    defaultApprovalPolicy: 'AI may advise only; authorized officials retain control and final accountability.',
    aiAuthority: 'advise',
  },
};

export const racetrackAssetControlRegistry: RacetrackControlAsset[] = [
  {
    assetId: 'START_GATE_01',
    assetType: 'StartingGate',
    domain: 'racing',
    ownerAgent: 'RaceOps',
    location: { railPositionMeters: 1600, gps: { lat: 43, lon: -79 } },
    state: { currentPositionMeters: 1600, doors: 'CLOSED', locked: true, readinessStatus: 'READY', maintenanceStatus: 'OK', batteryStatus: 97, lastInspection: '2026-06-13T08:00:00Z' },
    controls: [
      { name: 'recommend-gate-position', category: 'B_AI_RECOMMENDED', description: 'Calculate required start location from approved race distance.', requiresApprovalFrom: ['RacingSecretary'], executionMode: 'recommendation-only' },
      { name: 'lock-status', category: 'C_HUMAN_CONTROLLED', description: 'Confirm gate lock and release readiness before a race start.', requiresApprovalFrom: ['Starter', 'RacingSecretary'], protectedAction: 'race-start', executionMode: 'human-only' },
      { name: 'maintenance-status', category: 'B_AI_RECOMMENDED', description: 'Recommend inspection, charging, or maintenance holds.', requiresApprovalFrom: ['TrackOps'], executionMode: 'recommendation-only' },
    ],
    sensors: [
      { id: 'gate-gps-01', type: 'gps', verifies: ['currentPositionMeters', 'railPositionMeters'], required: true },
      { id: 'gate-lock-telemetry-01', type: 'lock-status', verifies: ['locked', 'doors'], required: true },
      { id: 'gate-battery-01', type: 'battery', verifies: ['batteryStatus'], required: false },
    ],
    regulations: [
      { authority: 'StateRacingCommission', reference: 'Approved race conditions and start procedures', appliesTo: ['recommend-gate-position', 'lock-status'] },
      { authority: 'TrackPolicy', reference: 'Race office gate move checklist', appliesTo: ['recommend-gate-position', 'maintenance-status'] },
    ],
    riskLevel: 'high',
    approvalPolicy: controlCategoryPolicies.B_AI_RECOMMENDED.defaultApprovalPolicy,
    lastUpdated: '2026-06-13T10:00:00Z',
  },
  {
    assetId: 'IRRIGATION_ZONE_4',
    assetType: 'IrrigationZone',
    domain: 'surface',
    ownerAgent: 'TrackSurface',
    location: { sector: 'TURN_2' },
    state: { waterFlowRate: 250, durationMinutes: 20, mode: 'scheduled', emergencyShutoff: false },
    controls: [
      { name: 'water-volume', category: 'B_AI_RECOMMENDED', description: 'Recommend zone-specific watering based on moisture, forecast, and surface model.', requiresApprovalFrom: ['TrackSuperintendent'], executionMode: 'recommendation-only' },
      { name: 'emergency-shutoff', category: 'C_HUMAN_CONTROLLED', description: 'Manual shutoff remains available and must never be blocked by AI.', requiresApprovalFrom: ['TrackOps'], executionMode: 'human-only' },
    ],
    sensors: [
      { id: 'moisture-turn-2', type: 'moisture', verifies: ['water-volume', 'surface-moisture'], required: true },
      { id: 'flow-meter-zone-4', type: 'flow-meter', verifies: ['waterFlowRate', 'durationMinutes'], required: true },
    ],
    regulations: [{ authority: 'TrackPolicy', reference: 'Surface maintenance and weather response plan', appliesTo: ['water-volume', 'emergency-shutoff'] }],
    riskLevel: 'medium',
    approvalPolicy: controlCategoryPolicies.B_AI_RECOMMENDED.defaultApprovalPolicy,
    lastUpdated: '2026-06-13T10:00:00Z',
  },
  {
    assetId: 'EMERGENCY_ALERT_SYSTEM',
    assetType: 'EmergencyAlertSystem',
    domain: 'safety',
    ownerAgent: 'SecuritySOC',
    location: { coverage: 'property-wide' },
    state: { status: 'READY', lastDrill: '2026-06-01T14:00:00Z' },
    controls: [{ name: 'activate-alert', category: 'C_HUMAN_CONTROLLED', description: 'Humans can activate emergency procedures immediately; AI can enrich context but never block.', requiresApprovalFrom: ['IncidentCommander'], protectedAction: 'emergency-action', executionMode: 'human-only' }],
    sensors: [{ id: 'alert-delivery-monitor', type: 'delivery-receipt', verifies: ['alert-delivery', 'siren-status'], required: true }],
    regulations: [{ authority: 'EmergencyManagement', reference: 'Emergency action plan and evacuation procedures', appliesTo: ['activate-alert'] }],
    riskLevel: 'critical',
    approvalPolicy: controlCategoryPolicies.C_HUMAN_CONTROLLED.defaultApprovalPolicy,
    lastUpdated: '2026-06-13T10:00:00Z',
  },
  {
    assetId: 'GRANDSTAND_HVAC_01',
    assetType: 'HVACSystem',
    domain: 'facilities',
    ownerAgent: 'TrackSurface',
    location: { facility: 'grandstand', zone: 'clubhouse', floor: 'mechanical-penthouse' },
    state: { operatingMode: 'occupied', loadPercent: 82, runtimeHours: 18420, filterDeltaPressure: 68, readinessStatus: 'WATCH', maintenanceStatus: 'DUE', lastInspection: '2026-06-12T13:30:00Z' },
    controls: [
      { name: 'adjust-hvac-setpoint', category: 'B_AI_RECOMMENDED', description: 'Recommend patron-area HVAC setpoint changes; facilities supervisor approval is required before execution.', requiresApprovalFrom: ['FacilitiesSupervisor'], executionMode: 'recommendation-only' },
      { name: 'return-to-service', category: 'C_HUMAN_CONTROLLED', description: 'Return patron-facing HVAC equipment to service after repair and readiness checks.', requiresApprovalFrom: ['FacilitiesSupervisor', 'OperationsDirector'], protectedAction: 'facility-maintenance-execution', executionMode: 'human-only' },
    ],
    sensors: [
      { id: 'hvac-01-load', type: 'power-load', verifies: ['loadPercent', 'runtimeHours'], required: true },
      { id: 'hvac-01-filter', type: 'pressure', verifies: ['filterDeltaPressure'], required: true },
    ],
    regulations: [
      { authority: 'OSHA', reference: 'Mechanical equipment lockout and workplace safety procedure', appliesTo: ['return-to-service'] },
      { authority: 'TrackPolicy', reference: 'Patron-area comfort and race-day readiness checklist', appliesTo: ['adjust-hvac-setpoint', 'return-to-service'] },
    ],
    riskLevel: 'medium',
    approvalPolicy: controlCategoryPolicies.B_AI_RECOMMENDED.defaultApprovalPolicy,
    lastUpdated: '2026-06-13T10:00:00Z',
  },
  {
    assetId: 'BACKUP_GENERATOR_A',
    assetType: 'BackupGenerator',
    domain: 'facilities',
    ownerAgent: 'SecuritySOC',
    location: { facility: 'utilities-yard', circuit: 'life-safety-a' },
    state: { fuelPercent: 74, runtimeHours: 9620, transferSwitchReady: true, readinessStatus: 'READY', maintenanceStatus: 'OK', lastInspection: '2026-06-13T07:15:00Z' },
    controls: [
      { name: 'schedule-load-test', category: 'B_AI_RECOMMENDED', description: 'Recommend generator load-test windows based on event schedule and readiness risk.', requiresApprovalFrom: ['FacilitiesSupervisor'], executionMode: 'recommendation-only' },
      { name: 'life-safety-power-transfer', category: 'C_HUMAN_CONTROLLED', description: 'Human-controlled transfer to life-safety backup power remains approval and audit gated.', requiresApprovalFrom: ['IncidentCommander', 'FacilitiesSupervisor'], protectedAction: 'emergency-action', executionMode: 'human-only' },
    ],
    sensors: [
      { id: 'generator-a-fuel', type: 'fuel-level', verifies: ['fuelPercent'], required: true },
      { id: 'generator-a-switch', type: 'transfer-switch', verifies: ['transferSwitchReady'], required: true },
    ],
    regulations: [
      { authority: 'EmergencyManagement', reference: 'Life-safety power continuity plan', appliesTo: ['life-safety-power-transfer'] },
      { authority: 'OSHA', reference: 'Generator maintenance and lockout procedures', appliesTo: ['schedule-load-test'] },
    ],
    riskLevel: 'high',
    approvalPolicy: controlCategoryPolicies.C_HUMAN_CONTROLLED.defaultApprovalPolicy,
    lastUpdated: '2026-06-13T10:00:00Z',
  },
  {
    assetId: 'PATRON_ELEVATOR_A',
    assetType: 'Elevator',
    domain: 'facilities',
    ownerAgent: 'RaceOps',
    location: { facility: 'grandstand', bank: 'A', floorsServed: ['concourse', 'clubhouse', 'suite-level'] },
    state: { cycleCount: 128400, doorFaults30d: 3, readinessStatus: 'WATCH', maintenanceStatus: 'DUE', lastInspection: '2026-06-10T09:00:00Z' },
    controls: [
      { name: 'create-elevator-work-order', category: 'B_AI_RECOMMENDED', description: 'Recommend elevator preventive maintenance based on door faults and cycle count.', requiresApprovalFrom: ['FacilitiesSupervisor'], executionMode: 'recommendation-only' },
      { name: 'remove-from-service', category: 'C_HUMAN_CONTROLLED', description: 'Taking patron elevator service offline affects operations and requires human approval.', requiresApprovalFrom: ['FacilitiesSupervisor', 'OperationsDirector'], protectedAction: 'facility-maintenance-execution', executionMode: 'human-only' },
    ],
    sensors: [
      { id: 'elevator-a-cycle-counter', type: 'cycle-counter', verifies: ['cycleCount'], required: true },
      { id: 'elevator-a-door-monitor', type: 'door-fault', verifies: ['doorFaults30d'], required: true },
    ],
    regulations: [
      { authority: 'LocalLaw', reference: 'Elevator inspection and public access requirements', appliesTo: ['create-elevator-work-order', 'remove-from-service'] },
      { authority: 'TrackPolicy', reference: 'Accessible patron route readiness policy', appliesTo: ['remove-from-service'] },
    ],
    riskLevel: 'high',
    approvalPolicy: controlCategoryPolicies.C_HUMAN_CONTROLLED.defaultApprovalPolicy,
    lastUpdated: '2026-06-13T10:00:00Z',
  },
];

export function findControlAsset(assetId: string): RacetrackControlAsset | undefined {
  const asset = racetrackAssetControlRegistry.find((item) => item.assetId === assetId);
  return asset ? cloneAsset(asset) : undefined;
}

export function controlsRequiringApproval(asset: RacetrackControlAsset): ControlDefinition[] {
  return asset.controls.filter((control) => control.category !== 'A_AUTONOMOUS' || control.requiresApprovalFrom.length > 0).map((control) => ({ ...control, requiresApprovalFrom: [...control.requiresApprovalFrom] }));
}

export function validateRaceDistanceSetup(setup: RaceDistanceSetup): { valid: boolean; requiredApprovals: string[]; reasons: string[] } {
  const reasons: string[] = [];
  if (setup.distanceFurlongs <= 0) reasons.push('distance must be positive');
  if (!Number.isFinite(setup.requiredGateLocation.x) || !Number.isFinite(setup.requiredGateLocation.y)) reasons.push('required gate location must be finite');
  const requiredApprovals = setup.approvedBy ? [] : ['RacingSecretary'];
  return { valid: reasons.length === 0 && requiredApprovals.length === 0, requiredApprovals, reasons };
}

export function buildStartingGateMoveRecommendation(asset: RacetrackControlAsset<GateLocation, StartingGateState>, setup: RaceDistanceSetup) {
  const approval = validateRaceDistanceSetup(setup);
  return {
    assetId: asset.assetId,
    raceId: setup.raceId,
    currentPositionMeters: asset.state.currentPositionMeters,
    targetPositionMeters: setup.requiredGateLocation.x,
    status: approval.valid ? 'ready-for-work-order' : 'approval-required',
    requiredApprovals: approval.requiredApprovals,
    sensorsToVerify: asset.sensors.filter((sensor) => sensor.required).map((sensor) => sensor.id),
    ownerAgent: asset.ownerAgent,
    controlCategory: 'B_AI_RECOMMENDED' as const,
  };
}

function cloneAsset(asset: RacetrackControlAsset): RacetrackControlAsset {
  return {
    ...asset,
    location: { ...asset.location },
    state: { ...asset.state },
    controls: asset.controls.map((control) => ({ ...control, requiresApprovalFrom: [...control.requiresApprovalFrom] })),
    sensors: asset.sensors.map((sensor) => ({ ...sensor, verifies: [...sensor.verifies] })),
    regulations: asset.regulations.map((regulation) => ({ ...regulation, appliesTo: [...regulation.appliesTo] })),
  };
}
