import type { NexusActorType } from './foundation.js';

export const domainKernelSchemaVersion = 'trackmind.domain-kernel.v1' as const;

type EntityId = string;
type TenantId = string;
type ISODateTime = string;

export type DomainEntityKind =
  | 'racetrack' | 'race-meet' | 'race-day' | 'race'
  | 'horse' | 'jockey' | 'trainer' | 'owner' | 'veterinarian' | 'steward'
  | 'barn' | 'stall' | 'track-sector' | 'facility' | 'asset' | 'starting-gate' | 'sensor' | 'vehicle'
  | 'incident' | 'workflow' | 'ai-recommendation' | 'approval' | 'audit-event' | 'audit-record';
export type LifecycleState = 'proposed' | 'draft' | 'pending-approval' | 'approved' | 'active' | 'suspended' | 'under-review' | 'executed' | 'completed' | 'cancelled' | 'retired' | 'archived';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'regulated';
export type AssetRiskClassification = 'informational' | 'operational' | 'safety-critical';

export interface VersionMetadata { schemaVersion: typeof domainKernelSchemaVersion; entityVersion: number; validFrom: ISODateTime; validTo?: ISODateTime }
export interface AuditMetadata { createdAt: ISODateTime; createdBy: EntityId; updatedAt: ISODateTime; updatedBy: EntityId; correlationId?: string; causationId?: string }
export interface OwnershipMetadata { tenantId: TenantId; ownerId: EntityId; ownerType: 'person' | 'role' | 'department' | 'regulator' | 'system'; stewardRole?: string; jurisdiction?: string }
export interface DomainMetadata { classification: DataClassification; tags: string[]; externalIds: Record<string, string>; sourceSystems: string[]; extensions?: Record<string, unknown> }
export interface EntityReference<K extends DomainEntityKind = DomainEntityKind> { id: EntityId; kind: K; tenantId: TenantId; displayName?: string; version?: number }
export interface DigitalTwinRef { twinId: `twin:${string}:${string}`; modelId: string; entity: EntityReference; sourceSystem: string; twinClass?: DomainEntityKind | 'control' | 'emergency-asset' | 'ai-agent'; readOnly?: boolean; legalSourceOfTruth?: false; relationship?: 'primary' | 'shadow' | 'sensor-feed' | 'workflow-state' | 'analytics-view' }
export interface ApprovalRef { approvalId: EntityId; status: 'pending-approval' | 'approved' | 'rejected' | 'expired' | 'overridden'; protectedAction?: string; approvedBy?: EntityId; approvedAt?: ISODateTime; evidence?: string[] }
export interface EventRef { eventId: EntityId; eventType: `${string}.${string}.${string}.v${number}` | string; occurredAt: ISODateTime; streamName?: string; auditId?: EntityId; digitalTwinId?: string }
export interface ObservabilityRef { traceId?: string; spanId?: string; metricNames: string[]; logEventIds: string[] }
export interface AIApprovalRequirement { required: boolean; policy: string; requirementId?: string; workflowId?: string }
export interface AIAuditReference { auditIds: string[]; eventIds: string[]; digitalTwinRefs: string[]; approvalReference?: string }

export interface DomainEntityBase<K extends DomainEntityKind> {
  id: EntityId; kind: K; tenantId: TenantId; displayName: string; lifecycleState: LifecycleState;
  version: VersionMetadata; audit: AuditMetadata; ownership: OwnershipMetadata; metadata: DomainMetadata;
  digitalTwin?: DigitalTwinRef; approvals?: ApprovalRef[]; events?: EventRef[]; observability?: ObservabilityRef;
}

export interface RacetrackEntity extends DomainEntityBase<'racetrack'> { timezone: string; commissionName?: string; sectorIds: EntityId[]; facilityIds: EntityId[] }
export interface RaceMeetEntity extends DomainEntityBase<'race-meet'> { racetrackId: EntityId; meetCode?: string; season: string; opensOn: string; closesOn: string; status: 'scheduled' | 'open' | 'closed' | 'cancelled'; raceDayIds: EntityId[]; regulatoryAuthority?: string }
export interface RaceDayEntity extends DomainEntityBase<'race-day'> { racetrackId: EntityId; raceMeetId?: EntityId; raceDate: string; status: 'scheduled' | 'open' | 'closed' | 'cancelled'; raceIds: EntityId[] }
export interface RaceEntity extends DomainEntityBase<'race'> { racetrackId: EntityId; raceDayId: EntityId; raceMeetId?: EntityId; raceNumber: number; surface: 'dirt' | 'turf' | 'synthetic'; status: 'scheduled' | 'loading' | 'ready' | 'running' | 'stopped' | 'official' | 'cancelled'; entryHorseIds: EntityId[]; jockeyIds?: EntityId[]; stewardPanelId?: EntityId }
export interface HorseEntity extends DomainEntityBase<'horse'> { registrationNumber?: string; microchipId?: string; status: 'active' | 'scratched' | 'vet-flagged' | 'retired' | 'inactive'; trainerId?: EntityId; ownerIds: EntityId[]; veterinarianIds?: EntityId[]; barnId?: EntityId; stallId?: EntityId }
export interface JockeyEntity extends DomainEntityBase<'jockey'> { licenseNumber: string; status: 'active' | 'suspended' | 'inactive' }
export interface TrainerEntity extends DomainEntityBase<'trainer'> { licenseNumber: string; status: 'active' | 'suspended' | 'inactive'; barnIds?: EntityId[] }
export interface OwnerEntity extends DomainEntityBase<'owner'> { licenseNumber?: string; ownershipType: 'individual' | 'partnership' | 'stable' | 'corporation'; horseIds?: EntityId[] }
export interface VeterinarianEntity extends DomainEntityBase<'veterinarian'> { licenseNumber: string; authorityScope: 'exam' | 'clearance' | 'regulatory'; status: 'active' | 'suspended' | 'inactive' }
export interface StewardEntity extends DomainEntityBase<'steward'> { licenseNumber: string; panelRole?: 'chair' | 'member' | 'alternate'; jurisdiction: string }
export interface BarnEntity extends DomainEntityBase<'barn'> { racetrackId: EntityId; facilityId?: EntityId; sectorId?: EntityId; status: 'ready' | 'restricted' | 'maintenance' | 'closed'; capacity: number; stallIds: EntityId[]; trainerIds: EntityId[] }
export interface StallEntity extends DomainEntityBase<'stall'> { barnId: EntityId; label: string; status: 'available' | 'occupied' | 'restricted' | 'maintenance'; occupancyHorseId?: EntityId; restrictionIds: EntityId[] }
export interface TrackSectorEntity extends DomainEntityBase<'track-sector'> { racetrackId: EntityId; surface: 'dirt' | 'turf' | 'synthetic' | 'paddock' | 'barn' | 'restricted-zone'; safetyCritical: boolean; startMeters?: number; endMeters?: number; facilityIds?: EntityId[] }
export interface FacilityEntity extends DomainEntityBase<'facility'> { racetrackId: EntityId; facilityType: 'barn' | 'grandstand' | 'paddock' | 'clinic' | 'maintenance' | 'security' | 'parking' | 'stewards-room' | 'veterinary'; sectorId?: EntityId; assetIds?: EntityId[] }
export interface AssetEntity extends DomainEntityBase<'asset'> { racetrackId: EntityId; assetType: 'starting-gate' | 'sensor' | 'camera' | 'vehicle' | 'control' | 'facility-equipment' | 'emergency-equipment' | 'rfid-reader'; riskClassification: AssetRiskClassification; sectorId?: EntityId; facilityId?: EntityId; controlId?: EntityId; status: 'online' | 'offline' | 'standby' | 'warning' | 'maintenance' }
export interface StartingGateEntity extends DomainEntityBase<'starting-gate'> { racetrackId: EntityId; sectorId: EntityId; stalls: number; controlId?: EntityId; assetId?: EntityId }
export interface SensorEntity extends DomainEntityBase<'sensor'> { assetId: EntityId; sensorType: 'surface' | 'weather' | 'gate' | 'camera' | 'rfid' | 'position' | 'security'; unit?: string }
export interface VehicleEntity extends DomainEntityBase<'vehicle'> { racetrackId: EntityId; vehicleType: 'ambulance' | 'starting-gate-tractor' | 'maintenance' | 'security' | 'transport'; callSign?: string; assetId?: EntityId }
export interface IncidentEntity extends DomainEntityBase<'incident'> { severity: 'low' | 'medium' | 'high' | 'critical'; status: 'open' | 'contained' | 'resolved' | 'closed'; subject: EntityReference; evidence: string[] }
export interface WorkflowEntity extends DomainEntityBase<'workflow'> { workflowType: string; state: LifecycleState; subject: EntityReference; approvalRefs: ApprovalRef[]; protectedAction?: string; auditEventRefs?: EntityId[] }
export interface AIRecommendationEntity extends DomainEntityBase<'ai-recommendation'> { activity: string; target: EntityReference; summary: string; recommendationId: string; confidence: number; evidence: string[]; modelVersion: string; generatedAt: ISODateTime; approvalRequirement: AIApprovalRequirement; auditReference: AIAuditReference; requestedAction?: string; requiredApprovals: ApprovalRef[]; advisoryOnly?: true; modelLineage?: string[]; affectedAssets?: EntityReference[] }
export interface ApprovalEntity extends DomainEntityBase<'approval'> { recommendationId?: EntityId; protectedAction: string; target: EntityReference; status: ApprovalRef['status']; approverId?: EntityId; approverRoles: string[]; reason?: string; evidence: string[]; decidedAt?: ISODateTime; expiresAt?: ISODateTime }
export interface AuditEventEntity extends DomainEntityBase<'audit-event'> { eventType: `${string}.${string}.${string}.v${number}`; actorId: EntityId; actorType: NexusActorType; action: string; target: EntityReference; occurredAt: ISODateTime; decision?: 'allowed' | 'denied' | 'approved' | 'rejected' | 'blocked' | 'executed'; evidence: string[]; correlationId: string; sourceService: string; previousHash?: string; hash?: string }
export interface AuditRecordEntity extends DomainEntityBase<'audit-record'> { actorId: EntityId; actorType: NexusActorType; action: string; target: EntityReference; occurredAt: ISODateTime; evidence: string[]; previousHash?: string; hash?: string }
export type DomainEntity = RacetrackEntity | RaceMeetEntity | RaceDayEntity | RaceEntity | HorseEntity | JockeyEntity | TrainerEntity | OwnerEntity | VeterinarianEntity | StewardEntity | BarnEntity | StallEntity | TrackSectorEntity | FacilityEntity | AssetEntity | StartingGateEntity | SensorEntity | VehicleEntity | IncidentEntity | WorkflowEntity | AIRecommendationEntity | ApprovalEntity | AuditEventEntity | AuditRecordEntity;

type ValidationRule = { path: string; required?: true; type?: 'string' | 'number' | 'boolean' | 'array' | 'object'; values?: readonly (string | number | boolean)[]; min?: number; max?: number };
export interface DomainSchema<K extends DomainEntityKind = DomainEntityKind> { kind: K; schemaVersion: typeof domainKernelSchemaVersion; requiredLifecycleStates: readonly LifecycleState[]; rules: readonly ValidationRule[] }
const lifecycleStates: readonly LifecycleState[] = ['proposed','draft','pending-approval','approved','active','suspended','under-review','executed','completed','cancelled','retired','archived'];
const baseRules: ValidationRule[] = [
  { path: 'id', required: true, type: 'string' }, { path: 'kind', required: true, type: 'string' }, { path: 'tenantId', required: true, type: 'string' },
  { path: 'displayName', required: true, type: 'string' }, { path: 'lifecycleState', required: true, type: 'string', values: lifecycleStates }, { path: 'version.schemaVersion', required: true, type: 'string', values: [domainKernelSchemaVersion] },
  { path: 'version.entityVersion', required: true, type: 'number', min: 1 }, { path: 'audit.createdAt', required: true, type: 'string' }, { path: 'audit.updatedAt', required: true, type: 'string' },
  { path: 'ownership.tenantId', required: true, type: 'string' }, { path: 'metadata.classification', required: true, type: 'string' }, { path: 'metadata.tags', required: true, type: 'array' },
];
const schema = <K extends DomainEntityKind>(kind: K, rules: ValidationRule[]): DomainSchema<K> => ({ kind, schemaVersion: domainKernelSchemaVersion, requiredLifecycleStates: lifecycleStates, rules: [...baseRules, { path: 'kind', required: true, type: 'string', values: [kind] }, ...rules] });
export const domainSchemas = {
  racetrack: schema('racetrack', [{ path: 'timezone', required: true, type: 'string' }, { path: 'sectorIds', required: true, type: 'array' }, { path: 'facilityIds', required: true, type: 'array' }]),
  'race-meet': schema('race-meet', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'season', required: true, type: 'string' }, { path: 'opensOn', required: true, type: 'string' }, { path: 'closesOn', required: true, type: 'string' }, { path: 'status', required: true, type: 'string' }, { path: 'raceDayIds', required: true, type: 'array' }]),
  'race-day': schema('race-day', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'raceDate', required: true, type: 'string' }, { path: 'raceIds', required: true, type: 'array' }]),
  race: schema('race', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'raceDayId', required: true, type: 'string' }, { path: 'raceNumber', required: true, type: 'number', min: 1 }, { path: 'entryHorseIds', required: true, type: 'array' }]),
  horse: schema('horse', [{ path: 'status', required: true, type: 'string' }, { path: 'ownerIds', required: true, type: 'array' }]),
  jockey: schema('jockey', [{ path: 'licenseNumber', required: true, type: 'string' }]),
  trainer: schema('trainer', [{ path: 'licenseNumber', required: true, type: 'string' }]),
  owner: schema('owner', [{ path: 'ownershipType', required: true, type: 'string' }]),
  veterinarian: schema('veterinarian', [{ path: 'licenseNumber', required: true, type: 'string' }]),
  steward: schema('steward', [{ path: 'licenseNumber', required: true, type: 'string' }]),
  barn: schema('barn', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'capacity', required: true, type: 'number', min: 0 }, { path: 'stallIds', required: true, type: 'array' }, { path: 'trainerIds', required: true, type: 'array' }]),
  stall: schema('stall', [{ path: 'barnId', required: true, type: 'string' }, { path: 'label', required: true, type: 'string' }, { path: 'status', required: true, type: 'string' }, { path: 'restrictionIds', required: true, type: 'array' }]),
  'track-sector': schema('track-sector', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'safetyCritical', required: true, type: 'boolean' }]),
  facility: schema('facility', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'facilityType', required: true, type: 'string' }]),
  asset: schema('asset', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'assetType', required: true, type: 'string' }, { path: 'riskClassification', required: true, type: 'string', values: ['informational','operational','safety-critical'] }, { path: 'status', required: true, type: 'string' }]),
  'starting-gate': schema('starting-gate', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'sectorId', required: true, type: 'string' }, { path: 'stalls', required: true, type: 'number', min: 1 }]),
  sensor: schema('sensor', [{ path: 'assetId', required: true, type: 'string' }]),
  vehicle: schema('vehicle', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'vehicleType', required: true, type: 'string' }]),
  incident: schema('incident', [{ path: 'severity', required: true, type: 'string' }, { path: 'subject', required: true, type: 'object' }, { path: 'evidence', required: true, type: 'array' }]),
  workflow: schema('workflow', [{ path: 'subject', required: true, type: 'object' }, { path: 'approvalRefs', required: true, type: 'array' }]),
  'ai-recommendation': schema('ai-recommendation', [{ path: 'target', required: true, type: 'object' }, { path: 'summary', required: true, type: 'string' }, { path: 'recommendationId', required: true, type: 'string' }, { path: 'confidence', required: true, type: 'number', min: 0, max: 1 }, { path: 'evidence', required: true, type: 'array' }, { path: 'modelVersion', required: true, type: 'string' }, { path: 'generatedAt', required: true, type: 'string' }, { path: 'approvalRequirement', required: true, type: 'object' }, { path: 'approvalRequirement.required', required: true, type: 'boolean' }, { path: 'approvalRequirement.policy', required: true, type: 'string' }, { path: 'auditReference', required: true, type: 'object' }, { path: 'auditReference.auditIds', required: true, type: 'array' }, { path: 'auditReference.eventIds', required: true, type: 'array' }, { path: 'auditReference.digitalTwinRefs', required: true, type: 'array' }, { path: 'requiredApprovals', required: true, type: 'array' }]),
  approval: schema('approval', [{ path: 'target', required: true, type: 'object' }, { path: 'status', required: true, type: 'string' }, { path: 'approverRoles', required: true, type: 'array' }, { path: 'evidence', required: true, type: 'array' }]),
  'audit-event': schema('audit-event', [{ path: 'eventType', required: true, type: 'string' }, { path: 'actorId', required: true, type: 'string' }, { path: 'target', required: true, type: 'object' }, { path: 'occurredAt', required: true, type: 'string' }, { path: 'evidence', required: true, type: 'array' }, { path: 'correlationId', required: true, type: 'string' }, { path: 'sourceService', required: true, type: 'string' }]),
  'audit-record': schema('audit-record', [{ path: 'actorId', required: true, type: 'string' }, { path: 'target', required: true, type: 'object' }, { path: 'evidence', required: true, type: 'array' }]),
} satisfies Record<DomainEntityKind, DomainSchema>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const get = (obj: unknown, path: string): unknown => path.split('.').reduce<unknown>((acc, key) => (isRecord(acc) ? acc[key] : undefined), obj);
const hasApprovedRef = (refs: readonly ApprovalRef[] | undefined, protectedAction?: string): boolean => Boolean(refs?.some((ref) => ref.status === 'approved' && (!protectedAction || ref.protectedAction === protectedAction)));
const tenantMatches = (entity: DomainEntity, reference?: EntityReference): boolean => !reference || reference.tenantId === entity.tenantId;

export function validateDomainEntity(entity: unknown): { valid: boolean; errors: string[] } {
  const kind = get(entity, 'kind') as DomainEntityKind; const rules = domainSchemas[kind]?.rules; const errors: string[] = [];
  if (!rules) return { valid: false, errors: [`schema not registered for kind ${String(kind)}`] };
  for (const rule of rules) {
    const value = get(entity, rule.path);
    if (rule.required && (value === undefined || value === null || value === '')) errors.push(`${rule.path} is required`);
    if (value !== undefined && rule.type) {
      const ok = rule.type === 'array' ? Array.isArray(value) : typeof value === rule.type;
      if (!ok) errors.push(`${rule.path} must be ${rule.type}`);
    }
    if (rule.values && value !== undefined && !rule.values.includes(value as string | number | boolean)) errors.push(`${rule.path} must be one of ${rule.values.join(',')}`);
    if (typeof value === 'number' && rule.min !== undefined && value < rule.min) errors.push(`${rule.path} must be >= ${rule.min}`);
    if (typeof value === 'number' && rule.max !== undefined && value > rule.max) errors.push(`${rule.path} must be <= ${rule.max}`);
  }

  const domainEntity = entity as DomainEntity;
  if (domainEntity.tenantId !== domainEntity.ownership?.tenantId) errors.push('tenantId must match ownership.tenantId');
  if (domainEntity.digitalTwin) {
    if (!domainEntity.digitalTwin.twinId.startsWith('twin:')) errors.push('digitalTwin.twinId must use twin:<context>:<entity-id>');
    if (!tenantMatches(domainEntity, domainEntity.digitalTwin.entity)) errors.push('digitalTwin.entity tenantId must match entity tenantId');
    if ((domainEntity.digitalTwin as { legalSourceOfTruth?: boolean }).legalSourceOfTruth === true) errors.push('Digital Twin references must not be the legal source of truth');
  }
  for (const event of domainEntity.events ?? []) {
    if (!/^([a-z][A-Za-z0-9-]*\.){2,}[a-z][A-Za-z0-9-]*\.v\d+$/.test(event.eventType)) errors.push(`${event.eventId} eventType must follow context.entity.verb.vN naming`);
  }
  if (kind === 'stall' && (domainEntity as StallEntity).status === 'occupied' && !(domainEntity as StallEntity).occupancyHorseId) errors.push('occupied stall requires occupancyHorseId');
  if (kind === 'workflow') {
    const workflow = domainEntity as WorkflowEntity;
    if (workflow.state === 'executed' && workflow.protectedAction && !hasApprovedRef(workflow.approvalRefs, workflow.protectedAction)) errors.push('executed protected workflow requires an approved approvalRef');
  }
  if (kind === 'ai-recommendation') {
    const recommendation = domainEntity as AIRecommendationEntity;
    if (recommendation.recommendationId !== recommendation.id) errors.push('AI recommendation recommendationId must match id');
    if (recommendation.requestedAction && !recommendation.requiredApprovals.length) errors.push('AI recommendation requesting a protected action requires approval refs');
    if (recommendation.requestedAction && recommendation.advisoryOnly !== true) errors.push('AI recommendation requesting protected action must be advisoryOnly');
    if ((recommendation.evidence ?? []).length === 0) errors.push('AI recommendation requires evidence');
    if ((recommendation.auditReference?.auditIds ?? []).length === 0) errors.push('AI recommendation requires auditReference.auditIds');
    if ((recommendation.auditReference?.eventIds ?? []).length === 0) errors.push('AI recommendation requires auditReference.eventIds');
  }
  if (kind === 'approval') {
    const approval = domainEntity as ApprovalEntity;
    if (approval.status === 'approved' && (!approval.approverId || !approval.reason || approval.evidence.length === 0)) errors.push('approved approval requires approverId, reason, and evidence');
  }
  if (kind === 'audit-event') {
    const auditEvent = domainEntity as AuditEventEntity;
    if (!/^([a-z][A-Za-z0-9-]*\.){2,}[a-z][A-Za-z0-9-]*\.v\d+$/.test(auditEvent.eventType)) errors.push('audit-event.eventType must follow context.entity.verb.vN naming');
    if (auditEvent.evidence.length === 0) errors.push('audit-event requires evidence');
  }
  return { valid: errors.length === 0, errors };
}

export function createDigitalTwinRef(input: { twinId: `twin:${string}:${string}`; modelId: string; entity: EntityReference; sourceSystem: string; twinClass?: DigitalTwinRef['twinClass']; relationship?: DigitalTwinRef['relationship']; readOnly?: boolean }): DigitalTwinRef {
  return { twinId: input.twinId, modelId: input.modelId, entity: input.entity, sourceSystem: input.sourceSystem, twinClass: input.twinClass, relationship: input.relationship ?? 'primary', readOnly: input.readOnly ?? true, legalSourceOfTruth: false };
}

export function validateDomainContractSet(entities: readonly DomainEntity[]): { valid: boolean; errors: string[] } {
  const errors = entities.flatMap((entity) => validateDomainEntity(entity).errors.map((error) => `${entity.kind}:${entity.id} ${error}`));
  const entityKeys = new Set(entities.map((entity) => `${entity.tenantId}:${entity.kind}:${entity.id}`));
  for (const entity of entities) {
    if (entity.digitalTwin && !entityKeys.has(`${entity.tenantId}:${entity.digitalTwin.entity.kind}:${entity.digitalTwin.entity.id}`)) errors.push(`${entity.kind}:${entity.id} digitalTwin.entity must reference an entity in the same contract set`);
    for (const approval of entity.approvals ?? []) if (approval.status === 'approved' && (!approval.approvedBy || !approval.evidence?.length)) errors.push(`${entity.kind}:${entity.id} approved approvalRef requires approvedBy and evidence`);
  }
  return { valid: errors.length === 0, errors };
}

export function serializeDomainEntity<T extends DomainEntity>(entity: T): string { const result = validateDomainEntity(entity); if (!result.valid) throw new Error(result.errors.join('; ')); return JSON.stringify(entity); }
export function deserializeDomainEntity<T extends DomainEntity = DomainEntity>(payload: string): T { const parsed = JSON.parse(payload) as T; const result = validateDomainEntity(parsed); if (!result.valid) throw new Error(result.errors.join('; ')); return parsed; }
export function createDomainEntityBase<K extends DomainEntityKind>(kind: K, input: { id: EntityId; tenantId: TenantId; displayName: string; ownerId: EntityId; createdBy: EntityId; now?: ISODateTime; lifecycleState?: LifecycleState; classification?: DataClassification }): DomainEntityBase<K> { const now = input.now ?? new Date().toISOString(); return { id: input.id, kind, tenantId: input.tenantId, displayName: input.displayName, lifecycleState: input.lifecycleState ?? 'draft', version: { schemaVersion: domainKernelSchemaVersion, entityVersion: 1, validFrom: now }, audit: { createdAt: now, createdBy: input.createdBy, updatedAt: now, updatedBy: input.createdBy }, ownership: { tenantId: input.tenantId, ownerId: input.ownerId, ownerType: 'department' }, metadata: { classification: input.classification ?? 'internal', tags: [], externalIds: {}, sourceSystems: [] } }; }
