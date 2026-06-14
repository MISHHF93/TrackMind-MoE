export const trackMindUniversalSchemaVersion = 'trackmind.tus.v1' as const;

export const tusDeploymentModels = ['racing-operating-system','saas','private-cloud','managed-service','franchise','certified-track'] as const;
export type TusDeploymentModel = typeof tusDeploymentModels[number];

export const tusEntityKinds = [
  'racetrack',
  'meet',
  'race-day',
  'race',
  'horse',
  'jockey',
  'trainer',
  'owner',
  'veterinarian',
  'steward',
  'employee',
  'asset',
  'incident',
  'inspection',
  'workflow',
  'approval',
  'audit-event',
  'audit-record',
  'digital-twin',
  'ai-recommendation',
  'compliance-control',
] as const;
export type TusEntityKind = typeof tusEntityKinds[number];

export type TusLifecycleState = 'proposed' | 'draft' | 'pending-approval' | 'approved' | 'active' | 'suspended' | 'under-review' | 'completed' | 'cancelled' | 'retired' | 'archived';
export type TusActorType = 'human' | 'ai-agent' | 'service' | 'system' | 'organization';
export type TusOwnerType = 'person' | 'role' | 'department' | 'regulator' | 'operator' | 'system';
export type TusFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface TusReference<K extends TusEntityKind = TusEntityKind> {
  id: string;
  globalId?: string;
  kind: K;
  tenantId: string;
  racetrackId: string;
  displayName?: string;
}

export interface TusOwnershipMetadata {
  tenantId: string;
  racetrackId: string;
  ownerId: string;
  ownerType: TusOwnerType;
  custodianId?: string;
  jurisdiction?: string;
}

export interface TusActorMetadata {
  actorId: string;
  actorType: TusActorType;
  tenantId: string;
  racetrackId: string;
  roles?: string[];
  sourceSystem?: string;
}

export interface TusDigitalTwinRef {
  twinId: `twin:${string}:${string}`;
  modelId: string;
  sourceSystem: string;
  entity: TusReference;
  relationship?: 'primary' | 'shadow' | 'sensor-feed' | 'workflow-state' | 'analytics-view';
  legalSourceOfTruth?: false;
}

export interface TusInteroperabilityMetadata {
  deploymentModel: TusDeploymentModel;
  sourceSystem: string;
  sourceEntityType?: string;
  externalIds: Record<string, string>;
  jurisdiction?: string;
  region?: string;
  schemaUri?: string;
  sharedWithRacetrackIds?: string[];
  federationKeys?: Record<string, string>;
}

export interface TusEntityBase<K extends TusEntityKind = TusEntityKind> {
  schemaVersion: typeof trackMindUniversalSchemaVersion;
  kind: K;
  id: string;
  globalId: string;
  tenantId: string;
  racetrackId: string;
  displayName: string;
  lifecycle: TusLifecycleState;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  ownership: TusOwnershipMetadata;
  actor?: TusActorMetadata;
  digitalTwinRef?: TusDigitalTwinRef;
  auditRefs: string[];
  eventRefs: string[];
  complianceRefs: string[];
  interoperability: TusInteroperabilityMetadata;
  tags?: string[];
  extensions?: Record<string, unknown>;
}

export interface TusRacetrack extends TusEntityBase<'racetrack'> { timezone: string; operatingJurisdiction: string; trackCode?: string }
export interface TusMeet extends TusEntityBase<'meet'> { meetCode: string; season: string; opensOn: string; closesOn: string }
export interface TusRaceDay extends TusEntityBase<'race-day'> { raceDate: string; meetRef?: TusReference<'meet'>; raceRefs: TusReference<'race'>[] }
export interface TusRace extends TusEntityBase<'race'> { raceDayRef: TusReference<'race-day'>; raceNumber: number; surface: 'dirt' | 'turf' | 'synthetic'; postTime?: string; horseRefs: TusReference<'horse'>[] }
export interface TusHorse extends TusEntityBase<'horse'> { registrationNumber?: string; microchipId?: string; ownerRefs: TusReference<'owner'>[]; trainerRef?: TusReference<'trainer'>; veterinarianRefs?: TusReference<'veterinarian'>[] }
export interface TusJockey extends TusEntityBase<'jockey'> { licenseNumber: string; licenseJurisdiction: string }
export interface TusTrainer extends TusEntityBase<'trainer'> { licenseNumber: string; licenseJurisdiction: string }
export interface TusOwner extends TusEntityBase<'owner'> { ownershipType: 'individual' | 'partnership' | 'stable' | 'corporation'; licenseNumber?: string }
export interface TusVeterinarian extends TusEntityBase<'veterinarian'> { licenseNumber: string; authorityScope: 'exam' | 'clearance' | 'regulatory'; licenseJurisdiction: string }
export interface TusSteward extends TusEntityBase<'steward'> { licenseNumber: string; jurisdiction: string; panelRole?: 'chair' | 'member' | 'alternate' }
export interface TusEmployee extends TusEntityBase<'employee'> { employeeNumber: string; role: string; employmentStatus: 'active' | 'inactive' | 'suspended' | 'terminated' }
export interface TusAsset extends TusEntityBase<'asset'> { assetType: string; riskClassification: 'informational' | 'operational' | 'safety-critical'; locationRef?: TusReference }
export interface TusIncident extends TusEntityBase<'incident'> { severity: 'low' | 'medium' | 'high' | 'critical'; subjectRef: TusReference; openedAt: string; evidenceRefs: string[] }
export interface TusInspection extends TusEntityBase<'inspection'> { inspectionType: string; inspectedSubjectRef: TusReference; inspectedAt: string; inspectedByRef: TusReference; findings: string[] }
export interface TusWorkflow extends TusEntityBase<'workflow'> { workflowType: string; state: TusLifecycleState; subjectRef: TusReference; approvalRefs: TusReference<'approval'>[] }
export interface TusApproval extends TusEntityBase<'approval'> { protectedAction: string; targetRef: TusReference; requestedBy: TusActorMetadata; approverRefs: TusReference[]; evidenceRefs: string[]; decidedAt?: string; expiresAt?: string }
export interface TusAuditEvent extends TusEntityBase<'audit-event'> { eventType: `${string}.${string}.${string}.v${number}`; action: string; targetRef: TusReference; occurredAt: string; evidenceRefs: string[]; correlationId: string; causationId?: string; previousHash?: string; hash?: string }
export interface TusAuditRecord extends TusEntityBase<'audit-record'> { action: string; targetRef: TusReference; occurredAt: string; evidenceRefs: string[]; previousHash?: string; hash?: string }
export interface TusDigitalTwin extends TusEntityBase<'digital-twin'> { twinId: `twin:${string}:${string}`; modelId: string; sourceEntityRef: TusReference; twinStateRef?: string }
export interface TusAIRecommendation extends TusEntityBase<'ai-recommendation'> { activity: string; targetRef: TusReference; summary: string; confidence: number; evidenceRefs: string[]; advisoryOnly: true; requestedAction?: string; approvalRefs: TusReference<'approval'>[]; modelLineageRefs: string[] }
export interface TusComplianceControl extends TusEntityBase<'compliance-control'> { frameworkIds: string[]; controlStatus: 'draft' | 'implemented' | 'assessing' | 'effective' | 'deficient' | 'retired'; ownerRef: TusReference; evidenceRefs: string[] }

export type TusEntity =
  | TusRacetrack | TusMeet | TusRaceDay | TusRace | TusHorse | TusJockey | TusTrainer | TusOwner | TusVeterinarian | TusSteward
  | TusEmployee | TusAsset | TusIncident | TusInspection | TusWorkflow | TusApproval | TusAuditEvent | TusAuditRecord | TusDigitalTwin
  | TusAIRecommendation | TusComplianceControl;

export interface TusValidationRule {
  path: string;
  required?: true;
  type?: TusFieldType;
  values?: readonly (string | number | boolean)[];
  min?: number;
  max?: number;
}

export interface TusEntityDefinition<K extends TusEntityKind = TusEntityKind> {
  kind: K;
  title: string;
  domain: string;
  description: string;
  schemaVersion: typeof trackMindUniversalSchemaVersion;
  tenantScoped: true;
  racetrackScoped: true;
  globalIdPattern: 'tus:<tenantId>:<racetrackId>:<kind>:<id>';
  lifecycleStates: readonly TusLifecycleState[];
  statusValues: readonly string[];
  requiredFields: readonly string[];
  interoperability: {
    deploymentModels: readonly TusDeploymentModel[];
    requiresExternalIds: boolean;
    supportsCrossTrackExchange: boolean;
  };
  rules: readonly TusValidationRule[];
}

export interface TusManifest {
  schemaVersion: typeof trackMindUniversalSchemaVersion;
  name: 'TrackMind Universal Schema';
  scope: string;
  deploymentModels: readonly TusDeploymentModel[];
  entities: Record<TusEntityKind, TusEntityDefinition>;
}

const lifecycleStates: readonly TusLifecycleState[] = ['proposed','draft','pending-approval','approved','active','suspended','under-review','completed','cancelled','retired','archived'];
const baseRequiredFields = ['schemaVersion','kind','id','globalId','tenantId','racetrackId','displayName','lifecycle','status','version','createdAt','updatedAt','ownership','auditRefs','eventRefs','complianceRefs','interoperability'] as const;
const baseRules: TusValidationRule[] = [
  { path: 'schemaVersion', required: true, type: 'string', values: [trackMindUniversalSchemaVersion] },
  { path: 'kind', required: true, type: 'string' },
  { path: 'id', required: true, type: 'string' },
  { path: 'globalId', required: true, type: 'string' },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'racetrackId', required: true, type: 'string' },
  { path: 'displayName', required: true, type: 'string' },
  { path: 'lifecycle', required: true, type: 'string', values: lifecycleStates },
  { path: 'status', required: true, type: 'string' },
  { path: 'version', required: true, type: 'number', min: 1 },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'ownership', required: true, type: 'object' },
  { path: 'ownership.tenantId', required: true, type: 'string' },
  { path: 'ownership.racetrackId', required: true, type: 'string' },
  { path: 'ownership.ownerId', required: true, type: 'string' },
  { path: 'ownership.ownerType', required: true, type: 'string' },
  { path: 'auditRefs', required: true, type: 'array' },
  { path: 'eventRefs', required: true, type: 'array' },
  { path: 'complianceRefs', required: true, type: 'array' },
  { path: 'interoperability', required: true, type: 'object' },
  { path: 'interoperability.deploymentModel', required: true, type: 'string', values: tusDeploymentModels },
  { path: 'interoperability.sourceSystem', required: true, type: 'string' },
  { path: 'interoperability.externalIds', required: true, type: 'object' },
];

const definition = <K extends TusEntityKind>(kind: K, input: Omit<TusEntityDefinition<K>, 'kind' | 'schemaVersion' | 'tenantScoped' | 'racetrackScoped' | 'globalIdPattern' | 'lifecycleStates' | 'requiredFields' | 'rules'> & { requiredFields: readonly string[]; rules: readonly TusValidationRule[] }): TusEntityDefinition<K> => ({
  kind,
  schemaVersion: trackMindUniversalSchemaVersion,
  tenantScoped: true,
  racetrackScoped: true,
  globalIdPattern: 'tus:<tenantId>:<racetrackId>:<kind>:<id>',
  lifecycleStates,
  requiredFields: [...baseRequiredFields, ...input.requiredFields],
  rules: [...baseRules, { path: 'kind', required: true, type: 'string', values: [kind] }, { path: 'status', required: true, type: 'string', values: input.statusValues }, ...input.rules],
  title: input.title,
  domain: input.domain,
  description: input.description,
  statusValues: input.statusValues,
  interoperability: input.interoperability,
});

const interoperable = { deploymentModels: tusDeploymentModels, requiresExternalIds: true, supportsCrossTrackExchange: true } as const;

export const tusEntityRegistry = {
  racetrack: definition('racetrack', { title: 'Racetrack', domain: 'operations', description: 'Canonical track operator, venue, and jurisdiction anchor.', statusValues: ['planned','open','closed','suspended','retired'], requiredFields: ['timezone','operatingJurisdiction'], rules: [{ path: 'timezone', required: true, type: 'string' }, { path: 'operatingJurisdiction', required: true, type: 'string' }], interoperability: interoperable }),
  meet: definition('meet', { title: 'Meet', domain: 'race-office', description: 'Racing meet hosted by a racetrack and exchanged across operators.', statusValues: ['scheduled','open','closed','cancelled'], requiredFields: ['meetCode','season','opensOn','closesOn'], rules: [{ path: 'meetCode', required: true, type: 'string' }, { path: 'season', required: true, type: 'string' }, { path: 'opensOn', required: true, type: 'string' }, { path: 'closesOn', required: true, type: 'string' }], interoperability: interoperable }),
  'race-day': definition('race-day', { title: 'Race Day', domain: 'race-office', description: 'Race-day card, readiness, event, approval, and audit anchor.', statusValues: ['scheduled','open','closed','cancelled'], requiredFields: ['raceDate','raceRefs'], rules: [{ path: 'raceDate', required: true, type: 'string' }, { path: 'raceRefs', required: true, type: 'array' }], interoperability: interoperable }),
  race: definition('race', { title: 'Race', domain: 'race-office', description: 'Individual race and entries with official lifecycle controls.', statusValues: ['scheduled','loading','ready','running','stopped','official','cancelled'], requiredFields: ['raceDayRef','raceNumber','surface','horseRefs'], rules: [{ path: 'raceDayRef', required: true, type: 'object' }, { path: 'raceNumber', required: true, type: 'number', min: 1 }, { path: 'surface', required: true, type: 'string', values: ['dirt','turf','synthetic'] }, { path: 'horseRefs', required: true, type: 'array' }], interoperability: interoperable }),
  horse: definition('horse', { title: 'Horse', domain: 'equine', description: 'Equine identity, ownership, veterinary, and racing interoperability record.', statusValues: ['active','scratched','vet-flagged','retired','inactive'], requiredFields: ['ownerRefs'], rules: [{ path: 'ownerRefs', required: true, type: 'array' }], interoperability: interoperable }),
  jockey: definition('jockey', { title: 'Jockey', domain: 'race-office', description: 'Licensed jockey actor for race assignments and stewarding review.', statusValues: ['active','suspended','inactive'], requiredFields: ['licenseNumber','licenseJurisdiction'], rules: [{ path: 'licenseNumber', required: true, type: 'string' }, { path: 'licenseJurisdiction', required: true, type: 'string' }], interoperability: interoperable }),
  trainer: definition('trainer', { title: 'Trainer', domain: 'equine', description: 'Licensed trainer and barn/equine responsibility record.', statusValues: ['active','suspended','inactive'], requiredFields: ['licenseNumber','licenseJurisdiction'], rules: [{ path: 'licenseNumber', required: true, type: 'string' }, { path: 'licenseJurisdiction', required: true, type: 'string' }], interoperability: interoperable }),
  owner: definition('owner', { title: 'Owner', domain: 'equine', description: 'Horse owner or ownership entity for eligibility and interoperability.', statusValues: ['active','suspended','inactive'], requiredFields: ['ownershipType'], rules: [{ path: 'ownershipType', required: true, type: 'string', values: ['individual','partnership','stable','corporation'] }], interoperability: interoperable }),
  veterinarian: definition('veterinarian', { title: 'Veterinarian', domain: 'equine-safety', description: 'Licensed veterinarian actor for exams, clearances, and regulatory review.', statusValues: ['active','suspended','inactive'], requiredFields: ['licenseNumber','authorityScope','licenseJurisdiction'], rules: [{ path: 'licenseNumber', required: true, type: 'string' }, { path: 'authorityScope', required: true, type: 'string', values: ['exam','clearance','regulatory'] }, { path: 'licenseJurisdiction', required: true, type: 'string' }], interoperability: interoperable }),
  steward: definition('steward', { title: 'Steward', domain: 'stewarding', description: 'Licensed steward actor for rulings, inquiries, and appeals.', statusValues: ['active','suspended','inactive'], requiredFields: ['licenseNumber','jurisdiction'], rules: [{ path: 'licenseNumber', required: true, type: 'string' }, { path: 'jurisdiction', required: true, type: 'string' }], interoperability: interoperable }),
  employee: definition('employee', { title: 'Employee', domain: 'workforce', description: 'Track workforce identity for assignments, approvals, and incident response.', statusValues: ['active','inactive','suspended','terminated'], requiredFields: ['employeeNumber','role','employmentStatus'], rules: [{ path: 'employeeNumber', required: true, type: 'string' }, { path: 'role', required: true, type: 'string' }, { path: 'employmentStatus', required: true, type: 'string', values: ['active','inactive','suspended','terminated'] }], interoperability: interoperable }),
  asset: definition('asset', { title: 'Asset', domain: 'asset-registry', description: 'Physical, digital, safety-critical, and facility asset record.', statusValues: ['online','offline','standby','warning','maintenance','retired'], requiredFields: ['assetType','riskClassification'], rules: [{ path: 'assetType', required: true, type: 'string' }, { path: 'riskClassification', required: true, type: 'string', values: ['informational','operational','safety-critical'] }], interoperability: interoperable }),
  incident: definition('incident', { title: 'Incident', domain: 'safety', description: 'Safety, security, racing, or compliance incident case.', statusValues: ['open','contained','resolved','closed'], requiredFields: ['severity','subjectRef','openedAt','evidenceRefs'], rules: [{ path: 'severity', required: true, type: 'string', values: ['low','medium','high','critical'] }, { path: 'subjectRef', required: true, type: 'object' }, { path: 'openedAt', required: true, type: 'string' }, { path: 'evidenceRefs', required: true, type: 'array' }], interoperability: interoperable }),
  inspection: definition('inspection', { title: 'Inspection', domain: 'safety', description: 'Inspection of track, facility, equine, asset, barn, or compliance subject.', statusValues: ['scheduled','in-progress','passed','failed','requires-follow-up','cancelled'], requiredFields: ['inspectionType','inspectedSubjectRef','inspectedAt','inspectedByRef','findings'], rules: [{ path: 'inspectionType', required: true, type: 'string' }, { path: 'inspectedSubjectRef', required: true, type: 'object' }, { path: 'inspectedAt', required: true, type: 'string' }, { path: 'inspectedByRef', required: true, type: 'object' }, { path: 'findings', required: true, type: 'array' }], interoperability: interoperable }),
  workflow: definition('workflow', { title: 'Workflow', domain: 'workflow', description: 'Approval-aware workflow instance for governed operations.', statusValues: ['draft','pending-approval','approved','rejected','executed','cancelled'], requiredFields: ['workflowType','state','subjectRef','approvalRefs'], rules: [{ path: 'workflowType', required: true, type: 'string' }, { path: 'state', required: true, type: 'string' }, { path: 'subjectRef', required: true, type: 'object' }, { path: 'approvalRefs', required: true, type: 'array' }], interoperability: interoperable }),
  approval: definition('approval', { title: 'Approval', domain: 'governance', description: 'Human approval record for protected actions and regulated filings.', statusValues: ['pending-approval','approved','rejected','expired','overridden'], requiredFields: ['protectedAction','targetRef','requestedBy','approverRefs','evidenceRefs'], rules: [{ path: 'protectedAction', required: true, type: 'string' }, { path: 'targetRef', required: true, type: 'object' }, { path: 'requestedBy', required: true, type: 'object' }, { path: 'approverRefs', required: true, type: 'array' }, { path: 'evidenceRefs', required: true, type: 'array' }], interoperability: interoperable }),
  'audit-event': definition('audit-event', { title: 'Audit Event', domain: 'audit', description: 'Append-only event-level audit fact for forensic replay.', statusValues: ['recorded','sealed','voided'], requiredFields: ['eventType','action','targetRef','occurredAt','evidenceRefs','correlationId'], rules: [{ path: 'eventType', required: true, type: 'string' }, { path: 'action', required: true, type: 'string' }, { path: 'targetRef', required: true, type: 'object' }, { path: 'occurredAt', required: true, type: 'string' }, { path: 'evidenceRefs', required: true, type: 'array' }, { path: 'correlationId', required: true, type: 'string' }], interoperability: interoperable }),
  'audit-record': definition('audit-record', { title: 'Audit Record', domain: 'audit', description: 'Canonical audit ledger record with hash-chain metadata.', statusValues: ['recorded','sealed','voided'], requiredFields: ['action','targetRef','occurredAt','evidenceRefs'], rules: [{ path: 'action', required: true, type: 'string' }, { path: 'targetRef', required: true, type: 'object' }, { path: 'occurredAt', required: true, type: 'string' }, { path: 'evidenceRefs', required: true, type: 'array' }], interoperability: interoperable }),
  'digital-twin': definition('digital-twin', { title: 'Digital Twin', domain: 'digital-twin', description: 'Canonical Digital Twin metadata and source entity mapping.', statusValues: ['provisioned','active','syncing','degraded','retired'], requiredFields: ['twinId','modelId','sourceEntityRef'], rules: [{ path: 'twinId', required: true, type: 'string' }, { path: 'modelId', required: true, type: 'string' }, { path: 'sourceEntityRef', required: true, type: 'object' }], interoperability: interoperable }),
  'ai-recommendation': definition('ai-recommendation', { title: 'AI Recommendation', domain: 'ai-governance', description: 'Advisory AI recommendation with evidence, lineage, approvals, and Digital Twin context.', statusValues: ['draft','review-required','approved','rejected','superseded','archived'], requiredFields: ['activity','targetRef','summary','confidence','evidenceRefs','advisoryOnly','approvalRefs','modelLineageRefs'], rules: [{ path: 'activity', required: true, type: 'string' }, { path: 'targetRef', required: true, type: 'object' }, { path: 'summary', required: true, type: 'string' }, { path: 'confidence', required: true, type: 'number', min: 0, max: 1 }, { path: 'evidenceRefs', required: true, type: 'array' }, { path: 'advisoryOnly', required: true, type: 'boolean', values: [true] }, { path: 'approvalRefs', required: true, type: 'array' }, { path: 'modelLineageRefs', required: true, type: 'array' }], interoperability: interoperable }),
  'compliance-control': definition('compliance-control', { title: 'Compliance Control', domain: 'compliance', description: 'Control mapped to frameworks, obligations, evidence, workflows, approvals, and audits.', statusValues: ['draft','implemented','assessing','effective','deficient','retired'], requiredFields: ['frameworkIds','controlStatus','ownerRef','evidenceRefs'], rules: [{ path: 'frameworkIds', required: true, type: 'array' }, { path: 'controlStatus', required: true, type: 'string', values: ['draft','implemented','assessing','effective','deficient','retired'] }, { path: 'ownerRef', required: true, type: 'object' }, { path: 'evidenceRefs', required: true, type: 'array' }], interoperability: interoperable }),
} satisfies Record<TusEntityKind, TusEntityDefinition>;

export const trackMindUniversalSchemaManifest: TusManifest = {
  schemaVersion: trackMindUniversalSchemaVersion,
  name: 'TrackMind Universal Schema',
  scope: 'Canonical contracts for entities, events, workflows, approvals, Digital Twins, AI recommendations, audit records, and compliance controls across TrackMind Nexus deployment models.',
  deploymentModels: tusDeploymentModels,
  entities: tusEntityRegistry,
};

const get = (obj: unknown, path: string): unknown => path.split('.').reduce((acc: any, key) => acc?.[key], obj as any);
const eventTypePattern = /^([a-z][A-Za-z0-9-]*\.){2,}[a-z][A-Za-z0-9-]*\.v\d+$/;
const stablePart = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';

export function createTusGlobalId(input: { tenantId: string; racetrackId: string; kind: TusEntityKind; id: string }): string {
  return `tus:${stablePart(input.tenantId)}:${stablePart(input.racetrackId)}:${input.kind}:${stablePart(input.id)}`;
}

export function createTusReference<K extends TusEntityKind>(input: { id: string; kind: K; tenantId: string; racetrackId: string; displayName?: string }): TusReference<K> {
  return { ...input, globalId: createTusGlobalId(input) };
}

export function createTusEntityBase<K extends TusEntityKind>(kind: K, input: { id: string; tenantId: string; racetrackId: string; displayName: string; status: string; ownerId: string; ownerType?: TusOwnerType; lifecycle?: TusLifecycleState; now?: string; deploymentModel?: TusDeploymentModel; sourceSystem?: string; externalIds?: Record<string, string>; actor?: Omit<TusActorMetadata, 'tenantId' | 'racetrackId'> }): TusEntityBase<K> {
  const now = input.now ?? new Date().toISOString();
  return {
    schemaVersion: trackMindUniversalSchemaVersion,
    kind,
    id: input.id,
    globalId: createTusGlobalId({ tenantId: input.tenantId, racetrackId: input.racetrackId, kind, id: input.id }),
    tenantId: input.tenantId,
    racetrackId: input.racetrackId,
    displayName: input.displayName,
    lifecycle: input.lifecycle ?? 'active',
    status: input.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ownership: { tenantId: input.tenantId, racetrackId: input.racetrackId, ownerId: input.ownerId, ownerType: input.ownerType ?? 'department' },
    actor: input.actor ? { ...input.actor, tenantId: input.tenantId, racetrackId: input.racetrackId } : undefined,
    auditRefs: [],
    eventRefs: [],
    complianceRefs: [],
    interoperability: { deploymentModel: input.deploymentModel ?? 'racing-operating-system', sourceSystem: input.sourceSystem ?? 'trackmind-nexus', externalIds: input.externalIds ?? {} },
  };
}

export function getTusEntityDefinition(kind: TusEntityKind): TusEntityDefinition {
  return tusEntityRegistry[kind];
}

export function validateTusManifest(manifest: TusManifest = trackMindUniversalSchemaManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (manifest.schemaVersion !== trackMindUniversalSchemaVersion) errors.push('manifest schemaVersion must match TrackMind Universal Schema v1');
  for (const model of tusDeploymentModels) if (!manifest.deploymentModels.includes(model)) errors.push(`deployment model missing: ${model}`);
  for (const kind of tusEntityKinds) {
    const entity = manifest.entities[kind];
    if (!entity) {
      errors.push(`TUS entity definition missing: ${kind}`);
      continue;
    }
    if (entity.kind !== kind) errors.push(`${kind} definition kind mismatch`);
    if (!entity.tenantScoped || !entity.racetrackScoped) errors.push(`${kind} must be tenant and racetrack scoped`);
    for (const field of baseRequiredFields) if (!entity.requiredFields.includes(field)) errors.push(`${kind} missing base field ${field}`);
    for (const model of tusDeploymentModels) if (!entity.interoperability.deploymentModels.includes(model)) errors.push(`${kind} missing deployment model ${model}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateTusEntity(entity: unknown): { valid: boolean; errors: string[] } {
  const kind = get(entity, 'kind') as TusEntityKind;
  const definition = tusEntityRegistry[kind];
  const errors: string[] = [];
  if (!definition) return { valid: false, errors: [`TUS entity schema not registered for kind ${String(kind)}`] };

  for (const rule of definition.rules) {
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

  const tusEntity = entity as TusEntity;
  const expectedGlobalId = createTusGlobalId({ tenantId: String(tusEntity.tenantId ?? ''), racetrackId: String(tusEntity.racetrackId ?? ''), kind, id: String(tusEntity.id ?? '') });
  if (tusEntity.globalId !== expectedGlobalId) errors.push(`globalId must equal ${expectedGlobalId}`);
  if (tusEntity.ownership?.tenantId !== tusEntity.tenantId) errors.push('tenantId must match ownership.tenantId');
  if (tusEntity.ownership?.racetrackId !== tusEntity.racetrackId) errors.push('racetrackId must match ownership.racetrackId');
  if (tusEntity.actor && tusEntity.actor.tenantId !== tusEntity.tenantId) errors.push('actor.tenantId must match entity tenantId');
  if (tusEntity.actor && tusEntity.actor.racetrackId !== tusEntity.racetrackId) errors.push('actor.racetrackId must match entity racetrackId');
  if (tusEntity.digitalTwinRef) {
    if (!tusEntity.digitalTwinRef.twinId.startsWith('twin:')) errors.push('digitalTwinRef.twinId must use twin:<context>:<entity-id>');
    if (tusEntity.digitalTwinRef.entity.tenantId !== tusEntity.tenantId) errors.push('digitalTwinRef.entity tenantId must match entity tenantId');
    if (tusEntity.digitalTwinRef.entity.racetrackId !== tusEntity.racetrackId) errors.push('digitalTwinRef.entity racetrackId must match entity racetrackId');
    if ((tusEntity.digitalTwinRef as { legalSourceOfTruth?: boolean }).legalSourceOfTruth === true) errors.push('Digital Twin references must not be the legal source of truth');
  }
  if (kind === 'audit-event' && !eventTypePattern.test((tusEntity as TusAuditEvent).eventType)) errors.push('audit-event.eventType must follow context.entity.verb.vN naming');
  if (kind === 'ai-recommendation' && (tusEntity as TusAIRecommendation).evidenceRefs.length === 0) errors.push('ai-recommendation requires evidenceRefs');
  if (kind === 'approval' && tusEntity.status === 'approved' && ((tusEntity as TusApproval).approverRefs.length === 0 || (tusEntity as TusApproval).evidenceRefs.length === 0)) errors.push('approved approval requires approverRefs and evidenceRefs');

  return { valid: errors.length === 0, errors };
}

export function validateTusEntitySet(entities: readonly TusEntity[]): { valid: boolean; errors: string[] } {
  const errors = entities.flatMap((entity) => validateTusEntity(entity).errors.map((error) => `${entity.kind}:${entity.id} ${error}`));
  const globalIds = new Set<string>();
  for (const entity of entities) {
    if (globalIds.has(entity.globalId)) errors.push(`${entity.kind}:${entity.id} duplicate globalId ${entity.globalId}`);
    globalIds.add(entity.globalId);
  }
  return { valid: errors.length === 0, errors };
}
