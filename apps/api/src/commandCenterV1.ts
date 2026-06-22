import { TrackMindNexusFoundation } from './trackmindNexus.js';
import { apiContractSchemas, apiEndpointContracts, assertContract, type AIRecommendationDto, type ApprovalDto, type AssetMarkerDto, type AuditEventDto, type DigitalTwinStateDto, type GatePositionDto, type RaceDistanceConfigurationDto, type RaceDto, type SurfaceMeasurementDto } from '@trackmind/shared';
import { canonicalApprovalRequest, defaultApprovalPolicies, type ApprovalActor, type ApprovalToken, type ControlledActionRequest } from './approvals.js';

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

  createGateMoveDraft(input: { tenantId: string; racetrackId: string; targetSectorId: string; targetMetersFromStart: number; requestedBy: string; reason: string; evidence: string[] }): ControlledActionRequest {
    return this.nexus.approvals.createRequest({ tenantId: input.tenantId, racetrackId: input.racetrackId, action: 'starting-gate-move', target: this.gatePosition.gateId, requestedBy: input.requestedBy, actorType: 'human', reason: input.reason, evidence: [...input.evidence, `target-sector:${input.targetSectorId}`, `target-meters:${input.targetMetersFromStart}`] });
  }

  createRaceDistanceDraft(input: { tenantId: string; racetrackId: string; raceId: string; distanceMeters: number; gateSectorId: string; requestedBy: string; reason: string; evidence: string[] }): ControlledActionRequest {
    return this.nexus.approvals.createRequest({ tenantId: input.tenantId, racetrackId: input.racetrackId, action: 'race-distance-configuration', target: input.raceId, requestedBy: input.requestedBy, actorType: 'human', reason: input.reason, evidence: [...input.evidence, `distance:${input.distanceMeters}`, `gate-sector:${input.gateSectorId}`] });
  }

  createRailPositionDraft(input: { tenantId: string; racetrackId: string; raceId: string; railId: string; offsetMeters: number; requestedBy: string; reason: string; evidence: string[] }): ControlledActionRequest {
    return this.nexus.approvals.createRequest({ tenantId: input.tenantId, racetrackId: input.racetrackId, action: 'race-office-configuration', target: input.raceId, requestedBy: input.requestedBy, actorType: 'human', reason: input.reason, evidence: [...input.evidence, `rail:${input.railId}`, `offset-meters:${input.offsetMeters}`, 'draft-only:no-live-actuator-control'] });
  }

  createTurfConfigurationDraft(input: { tenantId: string; racetrackId: string; raceId: string; lane: string; going: string; requestedBy: string; reason: string; evidence: string[] }): ControlledActionRequest {
    return this.nexus.approvals.createRequest({ tenantId: input.tenantId, racetrackId: input.racetrackId, action: 'race-office-configuration', target: input.raceId, requestedBy: input.requestedBy, actorType: 'human', reason: input.reason, evidence: [...input.evidence, `turf-lane:${input.lane}`, `going:${input.going}`, 'draft-only:no-live-actuator-control'] });
  }

  approve(requestId: string, actor: ApprovalActor, reason: string, evidence: string[]) { return this.nexus.approvals.decide(requestId, actor, 'approved', reason, evidence); }
  authorize(requestId: string, action: 'starting-gate-move' | 'race-distance-configuration', target: string, tenantId: string, racetrackId: string, actor: ApprovalActor): ApprovalToken { return this.nexus.approvals.authorizeExecution({ requestId, action, target, tenantId, racetrackId, actor }); }

  applyApprovedGateMove(input: { token: ApprovalToken; sectorId: string; metersFromStart: number; actor: string }): GatePosition {
    if (!input.token) throw new Error('Controlled action starting-gate-move requires approval token');
    this.nexus.approvals.assertAuthorized(input.token, 'starting-gate-move', this.gatePosition.gateId, input.token.tenantId, input.token.racetrackId);
    this.gatePosition = { gateId: this.gatePosition.gateId, sectorId: input.sectorId, metersFromStart: input.metersFromStart, gpsVerified: true, lastApprovedRequestId: input.token.requestId };
    this.twinVersion += 1;
    const timestamp = now();
    const twinId = 'twin:main-track:gate-1';
    const audit = this.nexus.auditLog.append({ id: `audit-gate-${this.twinVersion}`, type: 'configuration-change', actor: input.actor, actorType: 'human', timestamp, action: 'starting-gate.move.approved', actionClass: 'config', subjectId: this.gatePosition.gateId, target: this.gatePosition.gateId, tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, correlationId: input.token.requestId, payload: { ...this.gatePosition, approvalRequestId: input.token.requestId, twinId }, severity: 'warning', regulations: ['HISA', 'ARCI'], evidenceIds: [input.token.requestId, twinId] });
    void this.nexus.eventBus.publish({ type: 'digital-twin.state.patch', payload: { ...this.gatePosition, tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, approvalToken: input.token, approvalRef: input.token.requestId, auditRef: audit.id, digitalTwinRef: twinId, evidence: [input.token.requestId, audit.id] }, aggregateId: twinId, correlationId: input.token.requestId, producer: 'trackmind-command-center-v1', tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, actor: { id: input.actor, type: 'human' }, subject: { id: twinId, type: 'digital-twin', tenantId: input.token.tenantId }, evidence: [input.token.requestId, audit.id], auditRef: audit.id, digitalTwinRef: twinId, approvalRef: input.token.requestId, metadata: { tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'operations-commander', regulations: ['HISA', 'ARCI'] } });
    return this.gatePosition;
  }

  applyApprovedRaceDistance(input: { token: ApprovalToken; raceId: string; distanceMeters: number; gateSectorId: string; actor: string }): RaceDistanceConfiguration {
    if (!input.token) throw new Error('Controlled action race-distance-configuration requires approval token');
    this.nexus.approvals.assertAuthorized(input.token, 'race-distance-configuration', input.raceId, input.token.tenantId, input.token.racetrackId);
    this.raceDistanceConfiguration = { raceId: input.raceId, distanceMeters: input.distanceMeters, gateSectorId: input.gateSectorId, configuredBy: input.actor, approvedRequestId: input.token.requestId };
    this.twinVersion += 1;
    const timestamp = now();
    const twinId = `twin:main-track:${input.raceId}`;
    const audit = this.nexus.auditLog.append({ id: `audit-distance-${this.twinVersion}`, type: 'configuration-change', actor: input.actor, actorType: 'human', timestamp, action: 'race-distance.configuration.approved', actionClass: 'config', subjectId: input.raceId, target: input.raceId, tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, correlationId: input.token.requestId, payload: { ...this.raceDistanceConfiguration, approvalRequestId: input.token.requestId, twinId }, severity: 'warning', regulations: ['HISA', 'ARCI'], evidenceIds: [input.token.requestId, twinId] });
    void this.nexus.eventBus.publish({ type: 'digital-twin.state.patch', payload: { ...this.raceDistanceConfiguration, tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, approvalToken: input.token, approvalRef: input.token.requestId, auditRef: audit.id, digitalTwinRef: twinId, evidence: [input.token.requestId, audit.id] }, aggregateId: twinId, correlationId: input.token.requestId, producer: 'trackmind-command-center-v1', tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, actor: { id: input.actor, type: 'human' }, subject: { id: twinId, type: 'digital-twin', tenantId: input.token.tenantId }, evidence: [input.token.requestId, audit.id], auditRef: audit.id, digitalTwinRef: twinId, approvalRef: input.token.requestId, metadata: { tenantId: input.token.tenantId, racetrackId: input.token.racetrackId, compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'horse-operations-coordinator', regulations: ['HISA', 'ARCI'] } });
    return this.raceDistanceConfiguration;
  }

  private digitalTwinState(): DigitalTwinState[] { return [{ twinId: 'twin:main-track:gate-1', assetId: this.gatePosition.gateId, health: this.assets.find((asset) => asset.id === this.gatePosition.gateId)?.status ?? 'standby', version: this.twinVersion, lastUpdatedAt: now(), state: { gatePosition: this.gatePosition, raceDistanceConfiguration: this.raceDistanceConfiguration } }]; }
}

export function createTrackMindCommandCenterV1Service() { return new TrackMindCommandCenterV1Service(); }

export interface CommandCenterContractSnapshot { assets: AssetMarkerDto[]; races: RaceDto[]; approvals: ApprovalDto[]; auditEvents: AuditEventDto[]; digitalTwinState: DigitalTwinStateDto[]; surfaceMeasurements: SurfaceMeasurementDto[]; gatePosition: GatePositionDto; raceDistanceConfiguration: RaceDistanceConfigurationDto; aiRecommendations: AIRecommendationDto[]; openApi: { title: string; version: string; endpoints: typeof apiEndpointContracts }; errors: { notAuthorized: { ok: false; error: { code: string; message: string } } } }

let seededCommandCenterContractSnapshot: CommandCenterContractSnapshot | undefined;

function buildCommandCenterContractSnapshot(service: TrackMindCommandCenterV1Service): CommandCenterContractSnapshot {
  const snapshot = service.snapshot();
  const assets = snapshot.assets.map((asset): AssetMarkerDto => assertContract('AssetMarkerDto', { ...asset, twinId: asset.id === 'gate-1' ? 'twin:main-track:gate-1' : `twin:main-track:${asset.id}` }, apiContractSchemas.AssetMarkerDto));
  const approvalPolicies = defaultApprovalPolicies();
  const approvals = snapshot.pendingApprovals.map((request): ApprovalDto => {
    const canonical = canonicalApprovalRequest(request, { policies: approvalPolicies, auditRefs: snapshot.auditEvents.filter((event) => event.payload && JSON.stringify(event.payload).includes(request.id)).map((event) => event.id), correlationId: request.id });
    const approverRoles = [...new Set(canonical.steps.flatMap((step) => step.approverRoles))];
    return assertContract('ApprovalDto', {
    id: request.id,
    approvalRequestId: canonical.approvalRequestId,
    action: request.action,
    target: request.target,
    tenantId: request.tenantId,
    racetrackId: request.racetrackId,
    requestedBy: request.requestedBy,
    status: request.status,
    canonicalStatus: canonical.status,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    evidence: request.evidence,
    mock: false,
    queue: request.action.toString().includes('surface') ? 'surface' : request.action === 'race-start' ? 'race-day' : 'operations',
    priority: request.action === 'race-start' ? 'critical' : 'high',
    affectedAssets: [request.target],
    actor: { id: request.requestedBy, displayName: request.requestedBy, role: request.actorType, actorType: request.actorType },
    requestedByActor: { id: canonical.requestedBy.id, displayName: canonical.requestedBy.displayName ?? canonical.requestedBy.id, role: canonical.requestedBy.roles.join(', ') || canonical.requestedBy.actorType, actorType: canonical.requestedBy.actorType === 'system' ? 'service' : canonical.requestedBy.actorType },
    approverRoles,
    requiredRoles: approverRoles,
    approvalPolicy: String(request.action),
    approvalSteps: canonical.steps,
    escalation: canonical.escalation,
    auditLinkage: canonical.auditLinkage,
    correlationId: request.id,
    workflowId: request.workflowInstanceId,
    auditIds: canonical.auditLinkage.auditIds,
    eventIds: canonical.auditLinkage.eventIds,
    history: request.decisions.map((decision, index) => ({ id: `${request.id}-decision-${index + 1}`, actor: { id: decision.actorId, displayName: decision.actorId, role: decision.roles.join(', '), actorType: 'human' as const }, decision: decision.decision, reason: decision.reason, evidence: decision.evidence, timestamp: decision.decidedAt })),
    exportFields: ['approvalRequestId', 'tenantId', 'racetrackId', 'action', 'target', 'canonicalStatus', 'approverRoles', 'evidence', 'escalation', 'expiresAt', 'auditLinkage', 'correlationId'],
  }, apiContractSchemas.ApprovalDto);
  });
  const auditEvents = snapshot.auditEvents.map((event): AuditEventDto => assertContract('AuditEventDto', {
    auditEventId: event.auditEventId,
    actor: { ...event.actor, id: event.actor.actorId, role: event.actor.roles?.join(', ') ?? event.actor.actorType },
    entity: event.entity,
    action: event.action ?? event.type,
    reason: event.reason,
    approvalReference: event.approvalReference,
    timestamp: event.timestamp,
    tenantScope: event.tenantScope,
    integrityReference: event.integrityReference,
    id: event.id,
    type: event.type,
    actorId: event.actor.actorId,
    subjectId: event.subjectId,
    severity: event.severity ?? 'info',
    hash: event.hash,
    previousHash: event.previousHash,
    mock: false,
    correlationId: event.correlationId,
    workflowId: event.workflowId,
    affectedAssets: event.subjectId ? [event.subjectId] : [],
    evidenceIds: event.evidenceIds ?? [],
    retainedUntil: event.retainedUntil,
    exportFields: ['auditEventId', 'actor', 'entity', 'action', 'reason', 'approvalReference', 'timestamp', 'tenantScope', 'integrityReference', 'id', 'hash', 'previousHash'],
  }, apiContractSchemas.AuditEventDto));
  const digitalTwinState = snapshot.digitalTwinState.map((state): DigitalTwinStateDto => assertContract('DigitalTwinStateDto', { ...state, mock: false }, apiContractSchemas.DigitalTwinStateDto));
  const gatePosition = assertContract('GatePositionDto', { ...snapshot.gatePosition, mock: false }, apiContractSchemas.GatePositionDto);
  const raceDistanceConfiguration = assertContract('RaceDistanceConfigurationDto', { ...snapshot.raceDistanceConfiguration, mock: false }, apiContractSchemas.RaceDistanceConfigurationDto);
  const surfaceMeasurements: SurfaceMeasurementDto[] = [
    { sectorId: 'backstretch', moisture: 18, compaction: 238, measuredAt: now(), eventId: 'evt-surface-backstretch', auditId: 'audit-surface-backstretch' },
    { sectorId: 'far-turn', moisture: 27, compaction: 276, measuredAt: now(), eventId: 'evt-surface-far-turn', auditId: 'audit-surface-far-turn' },
  ].map((measurement) => assertContract('SurfaceMeasurementDto', measurement, apiContractSchemas.SurfaceMeasurementDto));
  const races: RaceDto[] = [
    { raceId: 'race-5', trackId: 'main-track', postTime: '2026-06-22T18:30:00.000Z', score: 94, status: 'ready' as const, warnings: 0, approvals: 0, mock: false },
    { raceId: 'race-6', trackId: 'main-track', postTime: '2026-06-22T19:15:00.000Z', score: 91, status: 'ready' as const, warnings: 0, approvals: 0, mock: false },
    { raceId: 'race-7', trackId: 'main-track', postTime: '2026-06-22T20:00:00.000Z', score: 87, status: 'watch' as const, warnings: 2, approvals: approvals.length, mock: false },
    { raceId: 'race-8', trackId: 'main-track', postTime: '2026-06-22T20:45:00.000Z', score: 89, status: 'ready' as const, warnings: 0, approvals: 0, mock: false },
    { raceId: 'race-9', trackId: 'main-track', postTime: '2026-06-22T21:30:00.000Z', score: 92, status: 'ready' as const, warnings: 0, approvals: 0, mock: false },
  ].map((race) => assertContract('RaceDto', race, apiContractSchemas.RaceDto));
  const recommendationGeneratedAt = now();
  const aiRecommendations: AIRecommendationDto[] = [{
    id: 'ai-1',
    recommendationId: 'ai-1',
    recommendation: 'Dispatch surface crew for one harrow pass before Race 7.',
    confidence: { raw: 0.82, calibrated: 0.78, band: 'medium' as const, drivers: ['surface-telemetry', 'risk:high'] },
    confidenceValue: 0.78,
    evidence: ['surface:far-turn moisture=27', 'asset:sensor-44 warning'],
    evidencePackage: { evidencePackageId: 'evidence-package:ai-1', evidence: [{ evidenceId: 'surface:far-turn moisture=27', kind: 'telemetry' as const, source: 'surface' }], lineage: ['agent:surface', 'model:model-surface-advisor-v2'], hash: 'sha256:ai-1' },
    modelVersion: 'model-surface-advisor-v2',
    generatedAt: recommendationGeneratedAt,
    approvalRequirement: { required: true, policy: 'single-human', requiredApproverRoles: ['facilities-manager'], requirementId: 'approval-ai-1' },
    auditReference: { auditIds: ['audit-ai-1'], eventIds: ['evt-ai-1'], digitalTwinRefs: ['twin:main-track:sensor-44'], approvalReference: 'approval-ai-1', correlationId: 'corr-ai-1', integrityRef: 'evidence-package:ai-1' },
    requiresApproval: true,
    actionPath: '/settings',
    eventId: 'evt-ai-1',
    auditId: 'audit-ai-1',
    digitalTwinRefs: ['twin:main-track:sensor-44'],
    riskLevel: 'high' as const,
    advisoryOnly: true as const,
    executionAllowed: false as const,
    blockedAutonomousExecution: true as const,
    mock: false,
  }].map((rec) => assertContract('AIRecommendationDto', rec, apiContractSchemas.AIRecommendationDto));
  return { assets, races, approvals, auditEvents, digitalTwinState, surfaceMeasurements, gatePosition, raceDistanceConfiguration, aiRecommendations, openApi: { title: 'TrackMind Nexus API', version: '1.0.0', endpoints: apiEndpointContracts }, errors: { notAuthorized: { ok: false, error: { code: 'forbidden', message: 'Actor is not authorized for this TrackMind API operation' } } } };
}

export function createCommandCenterContractSnapshot(service?: TrackMindCommandCenterV1Service): CommandCenterContractSnapshot {
  if (service) return buildCommandCenterContractSnapshot(service);
  if (!seededCommandCenterContractSnapshot) {
    seededCommandCenterContractSnapshot = buildCommandCenterContractSnapshot(new TrackMindCommandCenterV1Service());
  }
  return seededCommandCenterContractSnapshot;
}
