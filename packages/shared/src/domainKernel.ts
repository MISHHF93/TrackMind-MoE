export const domainKernelSchemaVersion = 'trackmind.domain-kernel.v1' as const;

type EntityId = string;
type TenantId = string;
type ISODateTime = string;
export type DomainEntityKind =
  | 'racetrack' | 'race' | 'race-day' | 'horse' | 'jockey' | 'trainer' | 'owner' | 'veterinarian' | 'steward'
  | 'track-sector' | 'starting-gate' | 'sensor' | 'facility' | 'vehicle' | 'incident' | 'workflow'
  | 'ai-recommendation' | 'approval' | 'audit-record';
export type LifecycleState = 'proposed' | 'draft' | 'pending-approval' | 'approved' | 'active' | 'suspended' | 'under-review' | 'completed' | 'cancelled' | 'retired' | 'archived';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'regulated';

export interface VersionMetadata { schemaVersion: typeof domainKernelSchemaVersion; entityVersion: number; validFrom: ISODateTime; validTo?: ISODateTime }
export interface AuditMetadata { createdAt: ISODateTime; createdBy: EntityId; updatedAt: ISODateTime; updatedBy: EntityId; correlationId?: string; causationId?: string }
export interface OwnershipMetadata { tenantId: TenantId; ownerId: EntityId; ownerType: 'person' | 'role' | 'department' | 'regulator' | 'system'; stewardRole?: string; jurisdiction?: string }
export interface DomainMetadata { classification: DataClassification; tags: string[]; externalIds: Record<string, string>; sourceSystems: string[]; extensions?: Record<string, unknown> }
export interface EntityReference<K extends DomainEntityKind = DomainEntityKind> { id: EntityId; kind: K; tenantId: TenantId; displayName?: string; version?: number }
export interface DigitalTwinRef { twinId: `twin:${string}:${string}`; modelId: string; entity: EntityReference; sourceSystem: string }
export interface ApprovalRef { approvalId: EntityId; status: 'pending-approval' | 'approved' | 'rejected' | 'expired' | 'overridden'; protectedAction?: string }
export interface EventRef { eventId: EntityId; eventType: string; occurredAt: ISODateTime; streamName?: string }

export interface DomainEntityBase<K extends DomainEntityKind> {
  id: EntityId; kind: K; tenantId: TenantId; displayName: string; lifecycleState: LifecycleState;
  version: VersionMetadata; audit: AuditMetadata; ownership: OwnershipMetadata; metadata: DomainMetadata;
  digitalTwin?: DigitalTwinRef; approvals?: ApprovalRef[]; events?: EventRef[];
}

export interface RacetrackEntity extends DomainEntityBase<'racetrack'> { timezone: string; commissionName?: string; sectorIds: EntityId[]; facilityIds: EntityId[] }
export interface RaceDayEntity extends DomainEntityBase<'race-day'> { racetrackId: EntityId; raceDate: string; status: 'scheduled' | 'open' | 'closed' | 'cancelled'; raceIds: EntityId[] }
export interface RaceEntity extends DomainEntityBase<'race'> { racetrackId: EntityId; raceDayId: EntityId; raceNumber: number; surface: 'dirt' | 'turf' | 'synthetic'; status: 'scheduled' | 'loading' | 'ready' | 'running' | 'stopped' | 'official' | 'cancelled'; entryHorseIds: EntityId[] }
export interface HorseEntity extends DomainEntityBase<'horse'> { registrationNumber?: string; microchipId?: string; status: 'active' | 'scratched' | 'vet-flagged' | 'retired' | 'inactive'; trainerId?: EntityId; ownerIds: EntityId[] }
export interface JockeyEntity extends DomainEntityBase<'jockey'> { licenseNumber: string; status: 'active' | 'suspended' | 'inactive' }
export interface TrainerEntity extends DomainEntityBase<'trainer'> { licenseNumber: string; status: 'active' | 'suspended' | 'inactive' }
export interface OwnerEntity extends DomainEntityBase<'owner'> { licenseNumber?: string; ownershipType: 'individual' | 'partnership' | 'stable' | 'corporation' }
export interface VeterinarianEntity extends DomainEntityBase<'veterinarian'> { licenseNumber: string; authorityScope: 'exam' | 'clearance' | 'regulatory'; status: 'active' | 'suspended' | 'inactive' }
export interface StewardEntity extends DomainEntityBase<'steward'> { licenseNumber: string; panelRole?: 'chair' | 'member' | 'alternate'; jurisdiction: string }
export interface TrackSectorEntity extends DomainEntityBase<'track-sector'> { racetrackId: EntityId; surface: 'dirt' | 'turf' | 'synthetic' | 'paddock' | 'barn' | 'restricted-zone'; safetyCritical: boolean }
export interface StartingGateEntity extends DomainEntityBase<'starting-gate'> { racetrackId: EntityId; sectorId: EntityId; stalls: number; controlId?: EntityId }
export interface SensorEntity extends DomainEntityBase<'sensor'> { assetId: EntityId; sensorType: 'surface' | 'weather' | 'gate' | 'camera' | 'rfid' | 'position' | 'security'; unit?: string }
export interface FacilityEntity extends DomainEntityBase<'facility'> { racetrackId: EntityId; facilityType: 'barn' | 'grandstand' | 'paddock' | 'clinic' | 'maintenance' | 'security' | 'parking'; sectorId?: EntityId }
export interface VehicleEntity extends DomainEntityBase<'vehicle'> { racetrackId: EntityId; vehicleType: 'ambulance' | 'starting-gate-tractor' | 'maintenance' | 'security' | 'transport'; callSign?: string }
export interface IncidentEntity extends DomainEntityBase<'incident'> { severity: 'low' | 'medium' | 'high' | 'critical'; status: 'open' | 'contained' | 'resolved' | 'closed'; subject: EntityReference; evidence: string[] }
export interface WorkflowEntity extends DomainEntityBase<'workflow'> { workflowType: string; state: LifecycleState; subject: EntityReference; approvalRefs: ApprovalRef[] }
export interface AIRecommendationEntity extends DomainEntityBase<'ai-recommendation'> { activity: string; target: EntityReference; summary: string; confidence: number; evidence: string[]; requestedAction?: string; requiredApprovals: ApprovalRef[] }
export interface ApprovalEntity extends DomainEntityBase<'approval'> { recommendationId?: EntityId; protectedAction: string; target: EntityReference; status: ApprovalRef['status']; approverId?: EntityId; approverRoles: string[]; reason?: string; evidence: string[]; decidedAt?: ISODateTime; expiresAt?: ISODateTime }
export interface AuditRecordEntity extends DomainEntityBase<'audit-record'> { actorId: EntityId; actorType: 'human' | 'ai-agent' | 'service' | 'system'; action: string; target: EntityReference; occurredAt: ISODateTime; evidence: string[]; previousHash?: string; hash?: string }
export type DomainEntity = RacetrackEntity | RaceDayEntity | RaceEntity | HorseEntity | JockeyEntity | TrainerEntity | OwnerEntity | VeterinarianEntity | StewardEntity | TrackSectorEntity | StartingGateEntity | SensorEntity | FacilityEntity | VehicleEntity | IncidentEntity | WorkflowEntity | AIRecommendationEntity | ApprovalEntity | AuditRecordEntity;

type ValidationRule = { path: string; required?: true; type?: 'string' | 'number' | 'boolean' | 'array' | 'object'; values?: readonly string[]; min?: number; max?: number };
export interface DomainSchema<K extends DomainEntityKind = DomainEntityKind> { kind: K; schemaVersion: typeof domainKernelSchemaVersion; requiredLifecycleStates: readonly LifecycleState[]; rules: readonly ValidationRule[] }
const baseRules: ValidationRule[] = [
  { path: 'id', required: true, type: 'string' }, { path: 'kind', required: true, type: 'string' }, { path: 'tenantId', required: true, type: 'string' },
  { path: 'displayName', required: true, type: 'string' }, { path: 'lifecycleState', required: true, type: 'string' }, { path: 'version.schemaVersion', required: true, type: 'string', values: [domainKernelSchemaVersion] },
  { path: 'version.entityVersion', required: true, type: 'number', min: 1 }, { path: 'audit.createdAt', required: true, type: 'string' }, { path: 'audit.updatedAt', required: true, type: 'string' },
  { path: 'ownership.tenantId', required: true, type: 'string' }, { path: 'metadata.classification', required: true, type: 'string' }, { path: 'metadata.tags', required: true, type: 'array' },
];
const schema = <K extends DomainEntityKind>(kind: K, rules: ValidationRule[]): DomainSchema<K> => ({ kind, schemaVersion: domainKernelSchemaVersion, requiredLifecycleStates: ['proposed','draft','pending-approval','approved','active','suspended','under-review','completed','cancelled','retired','archived'], rules: [...baseRules, { path: 'kind', required: true, type: 'string', values: [kind] }, ...rules] });
export const domainSchemas = {
  racetrack: schema('racetrack', [{ path: 'timezone', required: true, type: 'string' }, { path: 'sectorIds', required: true, type: 'array' }]),
  'race-day': schema('race-day', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'raceDate', required: true, type: 'string' }, { path: 'raceIds', required: true, type: 'array' }]),
  race: schema('race', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'raceNumber', required: true, type: 'number', min: 1 }, { path: 'entryHorseIds', required: true, type: 'array' }]),
  horse: schema('horse', [{ path: 'status', required: true, type: 'string' }, { path: 'ownerIds', required: true, type: 'array' }]),
  jockey: schema('jockey', [{ path: 'licenseNumber', required: true, type: 'string' }]), trainer: schema('trainer', [{ path: 'licenseNumber', required: true, type: 'string' }]), owner: schema('owner', [{ path: 'ownershipType', required: true, type: 'string' }]),
  veterinarian: schema('veterinarian', [{ path: 'licenseNumber', required: true, type: 'string' }]), steward: schema('steward', [{ path: 'licenseNumber', required: true, type: 'string' }]),
  'track-sector': schema('track-sector', [{ path: 'racetrackId', required: true, type: 'string' }, { path: 'safetyCritical', required: true, type: 'boolean' }]), 'starting-gate': schema('starting-gate', [{ path: 'stalls', required: true, type: 'number', min: 1 }]),
  sensor: schema('sensor', [{ path: 'assetId', required: true, type: 'string' }]), facility: schema('facility', [{ path: 'facilityType', required: true, type: 'string' }]), vehicle: schema('vehicle', [{ path: 'vehicleType', required: true, type: 'string' }]),
  incident: schema('incident', [{ path: 'severity', required: true, type: 'string' }, { path: 'subject', required: true, type: 'object' }]), workflow: schema('workflow', [{ path: 'subject', required: true, type: 'object' }, { path: 'approvalRefs', required: true, type: 'array' }]),
  'ai-recommendation': schema('ai-recommendation', [{ path: 'target', required: true, type: 'object' }, { path: 'confidence', required: true, type: 'number', min: 0, max: 1 }]), approval: schema('approval', [{ path: 'target', required: true, type: 'object' }, { path: 'status', required: true, type: 'string' }]),
  'audit-record': schema('audit-record', [{ path: 'actorId', required: true, type: 'string' }, { path: 'target', required: true, type: 'object' }]),
} satisfies Record<DomainEntityKind, DomainSchema>;
const get = (obj: unknown, path: string): unknown => path.split('.').reduce((acc: any, key) => acc?.[key], obj as any);
export function validateDomainEntity(entity: unknown): { valid: boolean; errors: string[] } {
  const kind = get(entity, 'kind') as DomainEntityKind; const rules = domainSchemas[kind]?.rules; const errors: string[] = [];
  if (!rules) return { valid: false, errors: [`schema not registered for kind ${String(kind)}`] };
  for (const rule of rules) { const value = get(entity, rule.path); if (rule.required && (value === undefined || value === null || value === '')) errors.push(`${rule.path} is required`); if (value !== undefined && rule.type) { const ok = rule.type === 'array' ? Array.isArray(value) : typeof value === rule.type; if (!ok) errors.push(`${rule.path} must be ${rule.type}`); } if (rule.values && !rule.values.includes(value as string)) errors.push(`${rule.path} must be one of ${rule.values.join(',')}`); if (typeof value === 'number' && rule.min !== undefined && value < rule.min) errors.push(`${rule.path} must be >= ${rule.min}`); if (typeof value === 'number' && rule.max !== undefined && value > rule.max) errors.push(`${rule.path} must be <= ${rule.max}`); }
  if ((entity as DomainEntity).tenantId !== (entity as DomainEntity).ownership?.tenantId) errors.push('tenantId must match ownership.tenantId');
  return { valid: errors.length === 0, errors };
}
export function serializeDomainEntity<T extends DomainEntity>(entity: T): string { const result = validateDomainEntity(entity); if (!result.valid) throw new Error(result.errors.join('; ')); return JSON.stringify(entity); }
export function deserializeDomainEntity<T extends DomainEntity = DomainEntity>(payload: string): T { const parsed = JSON.parse(payload) as T; const result = validateDomainEntity(parsed); if (!result.valid) throw new Error(result.errors.join('; ')); return parsed; }
export function createDomainEntityBase<K extends DomainEntityKind>(kind: K, input: { id: EntityId; tenantId: TenantId; displayName: string; ownerId: EntityId; createdBy: EntityId; now?: ISODateTime; lifecycleState?: LifecycleState; classification?: DataClassification }): DomainEntityBase<K> { const now = input.now ?? new Date().toISOString(); return { id: input.id, kind, tenantId: input.tenantId, displayName: input.displayName, lifecycleState: input.lifecycleState ?? 'draft', version: { schemaVersion: domainKernelSchemaVersion, entityVersion: 1, validFrom: now }, audit: { createdAt: now, createdBy: input.createdBy, updatedAt: now, updatedBy: input.createdBy }, ownership: { tenantId: input.tenantId, ownerId: input.ownerId, ownerType: 'department' }, metadata: { classification: input.classification ?? 'internal', tags: [], externalIds: {}, sourceSystems: [] } }; }
