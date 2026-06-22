import { domainKernelSchemaVersion, domainSchemas as nexusDomainSchemas, type DomainEntityKind as NexusDomainEntityKind } from '@trackmind/shared';
export type EnterpriseEntityKind =
  | 'racetrack' | 'race-day' | 'race' | 'horse' | 'jockey' | 'trainer' | 'owner' | 'veterinarian' | 'steward'
  | 'maintenance-crew' | 'security-personnel' | 'facility' | 'asset' | 'sensor' | 'track-sector' | 'betting-system'
  | 'ticketing-system' | 'incident' | 'investigation' | 'compliance-record' | 'ai-recommendation' | 'approval' | 'digital-twin-object' | 'starting-gate' | 'vehicle' | 'workflow' | 'audit-record';
export type EnterpriseLifecycleState = 'proposed' | 'draft' | 'pending-approval' | 'active' | 'suspended' | 'under-review' | 'retired' | 'archived';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'regulated';
export type RelationshipCardinality = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
export type RelationshipStrength = 'canonical' | 'derived' | 'observed' | 'external-reference';

export interface DomainOwnerDefinition { ownerId: string; ownerType: 'person' | 'role' | 'department' | 'regulator' | 'system'; accountableRole: string; stewardshipGroup: string; escalationContact?: string }
export interface SchemaFieldDefinition { name: string; type: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'geojson'; required: boolean; pii?: boolean; description: string; allowedValues?: readonly string[] }
export interface DomainSchemaDefinition { kind: EnterpriseEntityKind; schemaVersion: string; kernelSchemaVersion: typeof domainKernelSchemaVersion; nexusKind?: NexusDomainEntityKind; namespace: string; displayName: string; description: string; classification: DataClassification; lifecycleStates: EnterpriseLifecycleState[]; owner: DomainOwnerDefinition; keyFields: string[]; fields: SchemaFieldDefinition[]; regulatoryTags: string[]; analyticsGrain: string; retentionPolicy: string; integrationAliases: string[] }
export interface EntityLineageLink { sourceEntityId: string; relationship: 'created-from' | 'derived-from' | 'supersedes' | 'merged-from' | 'imported-from' | 'model-generated-from'; evidence: string[]; observedAt: string }
export interface EntityRelationship { relationshipId: string; fromEntityId: string; toEntityId: string; relationshipType: string; cardinality: RelationshipCardinality; strength: RelationshipStrength; validFrom: string; validTo?: string; metadata?: Record<string, unknown> }
export interface EntityAuditEntry { auditId: string; entityId: string; version: number; action: 'create' | 'update' | 'transition' | 'relate' | 'retire'; actorId: string; occurredAt: string; changes: string[]; reason?: string }
export interface MasterDataEntity<T = Record<string, unknown>> { entityId: string; kind: EnterpriseEntityKind; tenantId: string; schemaVersion: string; version: number; name: string; lifecycleState: EnterpriseLifecycleState; owner: DomainOwnerDefinition; metadata: { classification: DataClassification; tags: string[]; externalIds: Record<string, string>; sourceSystems: string[]; qualityScore: number }; lineage: EntityLineageLink[]; attributes: T; createdAt: string; updatedAt: string; updatedBy: string }

const owner = (accountableRole: string, stewardshipGroup: string): DomainOwnerDefinition => ({ ownerId: stewardshipGroup.toLowerCase().replaceAll(' ', '-'), ownerType: 'department', accountableRole, stewardshipGroup });
const commonFields: SchemaFieldDefinition[] = [
  { name: 'entityId', type: 'string', required: true, description: 'Canonical immutable enterprise identifier.' },
  { name: 'tenantId', type: 'string', required: true, description: 'Racetrack or authority tenant partition.' },
  { name: 'lifecycleState', type: 'string', required: true, description: 'Governed lifecycle state.' },
  { name: 'updatedAt', type: 'datetime', required: true, description: 'Last canonical update timestamp.' },
];
const schema = (kind: EnterpriseEntityKind, displayName: string, stewardshipGroup: string, extra: SchemaFieldDefinition[], tags: string[], classification: DataClassification = 'internal'): DomainSchemaDefinition => ({
  kind, schemaVersion: 'edm.v1', kernelSchemaVersion: domainKernelSchemaVersion, nexusKind: kind in nexusDomainSchemas ? kind as NexusDomainEntityKind : undefined, namespace: `trackmind.enterprise.${kind}`, displayName,
  description: `Canonical master-data schema for ${displayName}.`, classification,
  lifecycleStates: ['proposed', 'draft', 'pending-approval', 'active', 'suspended', 'under-review', 'retired', 'archived'],
  owner: owner(`${displayName} Data Owner`, stewardshipGroup), keyFields: ['entityId', 'tenantId'], fields: [...commonFields, ...extra],
  regulatoryTags: tags, analyticsGrain: `one row per ${kind} version`, retentionPolicy: classification === 'regulated' ? 'retain according to racing authority and legal hold policy' : 'retain while active plus enterprise archive window',
  integrationAliases: [],
});

export const enterpriseDomainSchemas: readonly DomainSchemaDefinition[] = [
  schema('racetrack', 'Racetrack', 'Racing Operations', [{ name: 'timezone', type: 'string', required: true, description: 'Local operating timezone.' }, { name: 'geoBoundary', type: 'geojson', required: true, description: 'Venue boundary.' }], ['licensing', 'venue']),
  schema('race-day', 'Race Day', 'Racing Operations', [{ name: 'raceDate', type: 'datetime', required: true, description: 'Scheduled date.' }, { name: 'status', type: 'string', required: true, description: 'Operational status.' }], ['race-office']),
  schema('race', 'Race', 'Stewarding', [{ name: 'raceNumber', type: 'number', required: true, description: 'Card race number.' }, { name: 'surface', type: 'string', required: true, description: 'Racing surface.' }], ['official-results'], 'regulated'),
  schema('horse', 'Horse', 'Equine Safety', [{ name: 'registrationNumber', type: 'string', required: true, description: 'Registry identifier.' }, { name: 'microchipId', type: 'string', required: false, description: 'Microchip identifier.', pii: false }], ['HISA', 'equine-welfare'], 'regulated'),
  schema('jockey', 'Jockey', 'Racing Office', [{ name: 'licenseId', type: 'string', required: true, description: 'License identifier.' }], ['licensing'], 'regulated'),
  schema('trainer', 'Trainer', 'Racing Office', [{ name: 'licenseId', type: 'string', required: true, description: 'License identifier.' }], ['licensing'], 'regulated'),
  schema('owner', 'Owner', 'Racing Office', [{ name: 'licenseId', type: 'string', required: false, description: 'Ownership license or business identifier.' }], ['licensing'], 'regulated'),
  schema('veterinarian', 'Veterinarian', 'Veterinary Services', [{ name: 'licenseId', type: 'string', required: true, description: 'Veterinary license.' }], ['medical', 'HISA'], 'regulated'),
  schema('steward', 'Steward', 'Stewarding', [{ name: 'jurisdiction', type: 'string', required: true, description: 'Regulatory jurisdiction.' }], ['officials'], 'regulated'),
  schema('maintenance-crew', 'Maintenance Crew', 'Facilities', [{ name: 'shift', type: 'string', required: false, description: 'Crew operating shift.' }], ['workforce']),
  schema('security-personnel', 'Security Personnel', 'Security Operations', [{ name: 'badgeId', type: 'string', required: true, description: 'Badge identifier.' }], ['security-manager'], 'confidential'),
  schema('facility', 'Facility', 'Facilities', [{ name: 'facilityType', type: 'string', required: true, description: 'Barn, grandstand, paddock, etc.' }], ['facility']),
  schema('asset', 'Asset', 'Facilities', [{ name: 'assetTag', type: 'string', required: true, description: 'Asset tag.' }], ['asset-management']),
  schema('sensor', 'Sensor', 'IoT Platform', [{ name: 'streamId', type: 'string', required: true, description: 'Telemetry stream.' }], ['telemetry']),
  schema('track-sector', 'Track Sector', 'Track Surface', [{ name: 'sectorCode', type: 'string', required: true, description: 'Canonical sector code.' }], ['surface-safety']),
  schema('betting-system', 'Betting System', 'Wagering Integrity', [{ name: 'provider', type: 'string', required: true, description: 'System provider.' }], ['wagering', 'PCI-DSS'], 'regulated'),
  schema('ticketing-system', 'Ticketing System', 'Fan Experience', [{ name: 'provider', type: 'string', required: true, description: 'System provider.' }], ['PCI-DSS'], 'regulated'),
  schema('incident', 'Incident', 'Operations Center', [{ name: 'severity', type: 'string', required: true, description: 'Incident severity.' }], ['safety', 'security-manager'], 'regulated'),
  schema('investigation', 'Investigation', 'Integrity', [{ name: 'caseNumber', type: 'string', required: true, description: 'Case number.' }], ['integrity', 'legal-hold'], 'regulated'),
  schema('compliance-record', 'Compliance Record', 'Compliance', [{ name: 'framework', type: 'string', required: true, description: 'Regulatory framework.' }], ['audit-evidence'], 'regulated'),
  schema('ai-recommendation', 'AI Recommendation', 'Responsible AI', [{ name: 'modelId', type: 'string', required: true, description: 'Model or agent version.' }], ['ISO42001', 'NIST-AI-RMF'], 'regulated'),
  schema('approval', 'Approval', 'Governance', [{ name: 'approvalStatus', type: 'string', required: true, description: 'Approval status.' }], ['segregation-of-duties'], 'regulated'),
  schema('digital-twin-object', 'Digital Twin Object', 'Digital Twin Platform', [{ name: 'twinModelId', type: 'string', required: true, description: 'Digital Twin model identifier.' }], ['digital-twin']),
  schema('starting-gate', 'Starting Gate', 'Racing Operations', [{ name: 'stalls', type: 'number', required: true, description: 'Number of gate stalls.' }, { name: 'sectorId', type: 'string', required: true, description: 'Track sector where the gate is positioned.' }], ['race-start', 'safety-critical']),
  schema('vehicle', 'Vehicle', 'Facilities', [{ name: 'vehicleType', type: 'string', required: true, description: 'Ambulance, maintenance, security, or transport vehicle type.' }], ['asset-management', 'emergency-response']),
  schema('workflow', 'Workflow', 'Governance', [{ name: 'workflowType', type: 'string', required: true, description: 'Governed workflow type.' }, { name: 'state', type: 'string', required: true, description: 'Workflow lifecycle state.' }], ['approval-chain'], 'regulated'),
  schema('audit-record', 'Audit Record', 'Compliance', [{ name: 'actorId', type: 'string', required: true, description: 'Actor responsible for the audited action.' }, { name: 'action', type: 'string', required: true, description: 'Audited action.' }], ['audit-evidence', 'legal-hold'], 'regulated'),
];

export const enterpriseRelationshipBlueprints: readonly Omit<EntityRelationship, 'relationshipId' | 'fromEntityId' | 'toEntityId' | 'validFrom'>[] = [
  { relationshipType: 'racetrack-hosts-race-day', cardinality: 'one-to-many', strength: 'canonical' }, { relationshipType: 'race-day-contains-race', cardinality: 'one-to-many', strength: 'canonical' },
  { relationshipType: 'race-has-entry-horse', cardinality: 'many-to-many', strength: 'canonical' }, { relationshipType: 'horse-trained-by-trainer', cardinality: 'many-to-one', strength: 'canonical' },
  { relationshipType: 'horse-owned-by-owner', cardinality: 'many-to-many', strength: 'canonical' }, { relationshipType: 'race-officiated-by-steward', cardinality: 'many-to-many', strength: 'canonical' },
  { relationshipType: 'horse-reviewed-by-veterinarian', cardinality: 'many-to-many', strength: 'observed' }, { relationshipType: 'track-sector-monitored-by-sensor', cardinality: 'one-to-many', strength: 'observed' },
  { relationshipType: 'facility-contains-asset', cardinality: 'one-to-many', strength: 'canonical' }, { relationshipType: 'incident-opens-investigation', cardinality: 'one-to-one', strength: 'canonical' },
  { relationshipType: 'ai-recommendation-requires-approval', cardinality: 'many-to-many', strength: 'canonical' }, { relationshipType: 'digital-twin-object-represents-entity', cardinality: 'one-to-one', strength: 'canonical' },
];

export function getEnterpriseDomainSchema(kind: EnterpriseEntityKind, schemaVersion = 'edm.v1'): DomainSchemaDefinition {
  const found = enterpriseDomainSchemas.find((item) => item.kind === kind && item.schemaVersion === schemaVersion);
  if (!found) throw new Error(`Schema not found for ${kind}@${schemaVersion}`);
  return structuredClone(found);
}

export function validateMasterDataEntity(entity: MasterDataEntity, schemas = enterpriseDomainSchemas): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const definition = schemas.find((item) => item.kind === entity.kind && item.schemaVersion === entity.schemaVersion);
  if (!definition) errors.push(`schema ${entity.kind}@${entity.schemaVersion} is not registered`);
  if (!entity.entityId.startsWith('edm:')) errors.push('entityId must use edm: namespace');
  if (!entity.tenantId) errors.push('tenantId is required');
  if (entity.version < 1) errors.push('version must be positive');
  if (entity.metadata.qualityScore < 0 || entity.metadata.qualityScore > 100) errors.push('qualityScore must be between 0 and 100');
  if (definition && !definition.lifecycleStates.includes(entity.lifecycleState)) errors.push(`invalid lifecycleState ${entity.lifecycleState}`);
  for (const field of definition?.fields ?? []) if (field.required && !(field.name in entity.attributes) && !(field.name in entity)) errors.push(`missing required field ${field.name}`);
  return { valid: errors.length === 0, errors };
}

export class EnterpriseMasterDataRegistry {
  private readonly versions = new Map<string, MasterDataEntity[]>();
  private readonly relationships: EntityRelationship[] = [];
  private readonly audits: EntityAuditEntry[] = [];
  constructor(readonly schemas: readonly DomainSchemaDefinition[] = enterpriseDomainSchemas) {}
  upsert<T extends Record<string, unknown>>(entity: Omit<MasterDataEntity<T>, 'version' | 'createdAt' | 'updatedAt'> & { version?: number; createdAt?: string; updatedAt?: string }, actorId: string, reason?: string): MasterDataEntity<T> {
    const stream = this.versions.get(entity.entityId) ?? [];
    const current = stream.length ? structuredClone(stream[stream.length - 1]) as MasterDataEntity<T> : undefined;
    const now = entity.updatedAt ?? new Date().toISOString();
    const next: MasterDataEntity<T> = { ...entity, version: current ? current.version + 1 : 1, createdAt: current?.createdAt ?? entity.createdAt ?? now, updatedAt: now, updatedBy: actorId };
    const result = validateMasterDataEntity(next, this.schemas);
    if (!result.valid) throw new Error(result.errors.join('; '));
    this.versions.set(next.entityId, [...(this.versions.get(next.entityId) ?? []), structuredClone(next)]);
    this.audits.push({ auditId: `edm-audit-${this.audits.length + 1}`, entityId: next.entityId, version: next.version, action: current ? 'update' : 'create', actorId, occurredAt: now, changes: current ? Object.keys(entity) : ['entity-created'], reason });
    return structuredClone(next);
  }
  transition(entityId: string, lifecycleState: EnterpriseLifecycleState, actorId: string, reason: string) { const current = this.latest(entityId); return this.upsert({ ...current, lifecycleState }, actorId, reason); }
  relate(relationship: Omit<EntityRelationship, 'relationshipId'>, actorId: string): EntityRelationship { this.latest(relationship.fromEntityId); this.latest(relationship.toEntityId); const next = { ...relationship, relationshipId: `edm-rel-${this.relationships.length + 1}` }; this.relationships.push(structuredClone(next)); this.audits.push({ auditId: `edm-audit-${this.audits.length + 1}`, entityId: relationship.fromEntityId, version: this.latest(relationship.fromEntityId).version, action: 'relate', actorId, occurredAt: relationship.validFrom, changes: [relationship.relationshipType] }); return structuredClone(next); }
  latest<T = Record<string, unknown>>(entityId: string, includeArchived = false): MasterDataEntity<T> { const stream = this.versions.get(entityId); if (!stream?.length) throw new Error('Entity not found'); const current = stream[stream.length - 1] as MasterDataEntity<T>; if (current.lifecycleState === 'archived' && !includeArchived) throw new Error('Entity is archived'); return structuredClone(current); }
  history(entityId: string) { return (this.versions.get(entityId) ?? []).map((item) => structuredClone(item)); }
  relationshipMap(entityId?: string) { return this.relationships.filter((rel) => !entityId || rel.fromEntityId === entityId || rel.toEntityId === entityId).map((rel) => structuredClone(rel)); }
  auditTrail(entityId?: string) { return this.audits.filter((entry) => !entityId || entry.entityId === entityId).map((entry) => structuredClone(entry)); }
}

export function createMasterDataEntityTemplate(kind: EnterpriseEntityKind, input: { entityId: string; tenantId: string; name: string; updatedBy: string; attributes?: Record<string, unknown>; sourceSystem?: string }): MasterDataEntity {
  const definition = getEnterpriseDomainSchema(kind); const now = '2026-06-13T00:00:00Z';
  return { entityId: input.entityId, kind, tenantId: input.tenantId, schemaVersion: definition.schemaVersion, version: 1, name: input.name, lifecycleState: 'draft', owner: definition.owner, metadata: { classification: definition.classification, tags: definition.regulatoryTags, externalIds: {}, sourceSystems: input.sourceSystem ? [input.sourceSystem] : [], qualityScore: 100 }, lineage: [], attributes: { ...(input.attributes ?? {}) }, createdAt: now, updatedAt: now, updatedBy: input.updatedBy };
}
