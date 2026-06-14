import { TrackMindNexusFoundation } from './trackmindNexus.js';
import type { ApprovalActor, ApprovalToken, ControlledActionRequest } from './approvals.js';

export interface CommandCenterTrackSector { id: string; name: string; startMeters: number; endMeters: number; condition: 'fast' | 'good' | 'muddy' | 'maintenance' }
export interface CommandCenterAsset { id: string; type: 'gate' | 'sensor' | 'camera' | 'vehicle' | 'crew'; label: string; sectorId: string; status: 'online' | 'offline' | 'standby' | 'warning' }
export interface GatePosition { gateId: string; sectorId: string; metersFromStart: number; gpsVerified: boolean; lastApprovedRequestId?: string }
export interface RaceDistanceConfiguration { raceId: string; distanceMeters: number; gateSectorId: string; configuredBy: string; approvedRequestId?: string }
export interface DigitalTwinState { twinId: string; assetId: string; health: string; version: number; lastUpdatedAt: string; state: Record<string, unknown> }
export interface CommandCenterSnapshot { assets: CommandCenterAsset[]; trackSectors: CommandCenterTrackSector[]; gatePosition: GatePosition; raceDistanceConfiguration: RaceDistanceConfiguration; pendingApprovals: ControlledActionRequest[]; auditEvents: ReturnType<TrackMindNexusFoundation['auditLog']['all']>; digitalTwinState: DigitalTwinState[]; mock: boolean }

const now = () => new Date().toISOString();

export class TrackMindCommandCenterV1Service {
  private readonly nexus: TrackMindNexusFoundation;
  private gatePosition: GatePosition = { gateId: 'gate-1', sectorId: 'backstretch', metersFromStart: 0, gpsVerified: true };
  private raceDistanceConfiguration: RaceDistanceConfiguration = { raceId: 'race-7', distanceMeters: 1609, gateSectorId: 'backstretch', configuredBy: 'seed' };
  private twinVersion = 1;
  readonly trackSectors: CommandCenterTrackSector[] = [
    { id: 'chute', name: 'Chute', startMeters: 0, endMeters: 300, condition: 'good' },
    { id: 'backstretch', name: 'Backstretch', startMeters: 300, endMeters: 900, condition: 'fast' },
    { id: 'far-turn', name: 'Far Turn', startMeters: 900, endMeters: 1250, condition: 'maintenance' },
    { id: 'stretch', name: 'Home Stretch', startMeters: 1250, endMeters: 1609, condition: 'good' },
  ];
  readonly assets: CommandCenterAsset[] = [
    { id: 'gate-1', type: 'gate', label: 'Starting Gate', sectorId: 'backstretch', status: 'standby' },
    { id: 'sensor-44', type: 'sensor', label: 'Moisture Sensor 44', sectorId: 'far-turn', status: 'warning' },
    { id: 'camera-clubhouse', type: 'camera', label: 'Clubhouse PTZ', sectorId: 'stretch', status: 'online' },
  ];

  constructor(nexus = new TrackMindNexusFoundation()) { this.nexus = nexus; this.nexus.eventBus.registerEvent({ type: 'digital-twin.state.patch', version: 1, description: 'Command Center approved Digital Twin patch', owner: { service: 'trackmind-command-center-v1', team: 'racetrack-platform', accountableRole: 'operations-commander' }, payloadFields: [], compliance: 'regulated' }); }

  snapshot(): CommandCenterSnapshot {
    return { assets: this.assets, trackSectors: this.trackSectors, gatePosition: this.gatePosition, raceDistanceConfiguration: this.raceDistanceConfiguration, pendingApprovals: this.nexus.approvals.allRequests().filter((request) => request.status === 'pending' || request.status === 'escalated'), auditEvents: this.nexus.auditLog.all(), digitalTwinState: this.digitalTwinState(), mock: false };
  }

  createGateMoveDraft(input: { tenantId: string; targetSectorId: string; targetMetersFromStart: number; requestedBy: string; reason: string; evidence: string[] }): ControlledActionRequest {
    return this.nexus.approvals.createRequest({ tenantId: input.tenantId, action: 'starting-gate-move', target: this.gatePosition.gateId, requestedBy: input.requestedBy, actorType: 'human', reason: input.reason, evidence: [...input.evidence, `target-sector:${input.targetSectorId}`, `target-meters:${input.targetMetersFromStart}`] });
  }

  createRaceDistanceDraft(input: { tenantId: string; raceId: string; distanceMeters: number; gateSectorId: string; requestedBy: string; reason: string; evidence: string[] }): ControlledActionRequest {
    return this.nexus.approvals.createRequest({ tenantId: input.tenantId, action: 'race-distance-configuration', target: input.raceId, requestedBy: input.requestedBy, actorType: 'human', reason: input.reason, evidence: [...input.evidence, `distance:${input.distanceMeters}`, `gate-sector:${input.gateSectorId}`] });
  }

  approve(requestId: string, actor: ApprovalActor, reason: string, evidence: string[]) { return this.nexus.approvals.decide(requestId, actor, 'approved', reason, evidence); }
  authorize(requestId: string, action: 'starting-gate-move' | 'race-distance-configuration', target: string, tenantId: string, actor: ApprovalActor): ApprovalToken { return this.nexus.approvals.authorizeExecution({ requestId, action, target, tenantId, actor }); }

  applyApprovedGateMove(input: { token: ApprovalToken; sectorId: string; metersFromStart: number; actor: string }): GatePosition {
    if (!input.token) throw new Error('Controlled action starting-gate-move requires approval token');
    this.nexus.approvals.assertAuthorized(input.token, 'starting-gate-move', this.gatePosition.gateId, input.token.tenantId);
    this.gatePosition = { gateId: this.gatePosition.gateId, sectorId: input.sectorId, metersFromStart: input.metersFromStart, gpsVerified: true, lastApprovedRequestId: input.token.requestId };
    this.twinVersion += 1;
    void this.nexus.eventBus.publish({ type: 'digital-twin.state.patch', payload: this.gatePosition, producer: 'trackmind-command-center-v1', metadata: { compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'operations-commander' } });
    this.nexus.auditLog.append({ id: `audit-gate-${this.twinVersion}`, type: 'configuration-change', actor: input.actor, timestamp: now(), payload: this.gatePosition, severity: 'warning', regulations: ['HISA', 'ARCI'] });
    return this.gatePosition;
  }

  applyApprovedRaceDistance(input: { token: ApprovalToken; raceId: string; distanceMeters: number; gateSectorId: string; actor: string }): RaceDistanceConfiguration {
    if (!input.token) throw new Error('Controlled action race-distance-configuration requires approval token');
    this.nexus.approvals.assertAuthorized(input.token, 'race-distance-configuration', input.raceId, input.token.tenantId);
    this.raceDistanceConfiguration = { raceId: input.raceId, distanceMeters: input.distanceMeters, gateSectorId: input.gateSectorId, configuredBy: input.actor, approvedRequestId: input.token.requestId };
    this.twinVersion += 1;
    void this.nexus.eventBus.publish({ type: 'digital-twin.state.patch', payload: this.raceDistanceConfiguration, producer: 'trackmind-command-center-v1', metadata: { compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'racing-secretary' } });
    this.nexus.auditLog.append({ id: `audit-distance-${this.twinVersion}`, type: 'configuration-change', actor: input.actor, timestamp: now(), payload: this.raceDistanceConfiguration, severity: 'warning', regulations: ['HISA', 'ARCI'] });
    return this.raceDistanceConfiguration;
  }

  private digitalTwinState(): DigitalTwinState[] { return [{ twinId: 'twin:main-track:gate-1', assetId: this.gatePosition.gateId, health: this.assets.find((asset) => asset.id === this.gatePosition.gateId)?.status ?? 'standby', version: this.twinVersion, lastUpdatedAt: now(), state: { gatePosition: this.gatePosition, raceDistanceConfiguration: this.raceDistanceConfiguration } }]; }
}

export function createTrackMindCommandCenterV1Service() { return new TrackMindCommandCenterV1Service(); }
