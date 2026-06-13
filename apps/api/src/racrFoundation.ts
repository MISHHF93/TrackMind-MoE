import { InMemoryEventBus, type RaceDayEvent } from './eventBus.js';

export type RacrAssetClass = 'physical' | 'digital' | 'biological' | 'operational' | 'regulatory' | 'ai-agent';
export type RacrLifecycleState = 'draft' | 'pending-approval' | 'active' | 'maintenance' | 'suspended' | 'retired' | 'deleted';
export type RacrRiskClassification = 'low' | 'medium' | 'high' | 'critical';
export type RacrRole = 'registry-admin' | 'asset-owner' | 'steward' | 'veterinarian' | 'track-ops' | 'security-ops' | 'compliance-officer' | 'ai-governance' | 'viewer';
export type RacrAction = 'create' | 'read' | 'update' | 'delete' | 'rollback' | 'approve' | 'bind-telemetry' | 'record-maintenance' | 'change-state';

export interface RacrActor { id: string; roles: RacrRole[]; tenantId?: string }
export interface RacrOwner { ownerId: string; ownerType: 'person' | 'department' | 'tenant' | 'regulator' | 'system'; accountableRole: string }
export interface RacrApprovalRequirement { action: string; requiredRoles: RacrRole[]; minApprovals: number; reason: string }
export interface RacrApprovalRecord { approvalId: string; action: string; approvedBy: string; role: RacrRole; decidedAt: string; decision: 'approved' | 'rejected'; evidence: string[] }
export interface RacrTelemetryBinding { bindingId: string; sourceId: string; stream: string; schemaRef: string; required: boolean; lastObservedAt?: string }
export interface RacrMaintenanceRecord { recordId: string; performedAt: string; performedBy: string; summary: string; evidence: string[] }
export interface RacrDigitalTwinRelationship { twinId: string; relationship: 'represents' | 'depends-on' | 'controls' | 'monitors' | 'part-of' | 'simulates'; since: string }
export interface RacrDigitalTwinRepresentation { twinId: string; modelRef: string; stateTopic: string; commandTopic?: string; simulationProfile?: string; shadowState: Record<string, unknown> }
export interface RacrComplianceMapping { framework: 'HISA' | 'ARCI' | 'OSHA' | 'PCI-DSS' | 'SOC2' | 'ISO27001' | 'ISO42001' | 'NIST-AI-RMF' | 'TrackPolicy' | 'StateRacingCommission'; controlId: string; obligation: string; evidenceRefs: string[] }
export interface RacrLifecycleControl { state: RacrLifecycleState; entryCriteria: string[]; exitCriteria: string[]; approvalRequired: boolean }
export interface RacrOperationalState { status: 'unknown' | 'ready' | 'active' | 'degraded' | 'maintenance' | 'suspended' | 'retired'; healthScore: number; lastObservedAt?: string; activeIncidents: string[] }
export interface RacrApiSurface { name: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; requiredRoles: RacrRole[] }
export interface RacrGovernanceControl { controlId: string; name: string; description: string; enforcedBy: 'rbac' | 'approval-workflow' | 'policy-as-code' | 'audit' | 'segregation-of-duties'; evidence: string[] }
export interface RacrLineageLink { parentAssetId: string; relationship: 'derived-from' | 'replaces' | 'split-from' | 'merged-from' | 'configured-by'; evidence: string[] }

export interface RacrAssetVersion {
  globalId: string;
  version: number;
  assetClass: RacrAssetClass;
  assetType: string;
  tenantId: string;
  name: string;
  metadata: Record<string, unknown>;
  lifecycleState: RacrLifecycleState;
  owner: RacrOwner;
  riskClassification: RacrRiskClassification;
  approvalRequirements: RacrApprovalRequirement[];
  approvals: RacrApprovalRecord[];
  digitalTwin: RacrDigitalTwinRepresentation;
  telemetryBindings: RacrTelemetryBinding[];
  maintenanceHistory: RacrMaintenanceRecord[];
  twinRelationships: RacrDigitalTwinRelationship[];
  operationalState: RacrOperationalState;
  complianceMappings: RacrComplianceMapping[];
  lifecycleControls: RacrLifecycleControl[];
  apiSurface: RacrApiSurface[];
  governanceControls: RacrGovernanceControl[];
  lineage: RacrLineageLink[];
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt?: string;
}

export interface RacrAuditEntry { auditId: string; globalId: string; version: number; action: RacrAction; actorId: string; occurredAt: string; changes: string[]; reason?: string }

export const racrSupportedAssetTypes = [
  'StartingGate', 'IrrigationSystem', 'TrackSector', 'SurfaceSector', 'Camera', 'LightingSystem', 'Vehicle', 'Ambulance', 'FireTruck', 'Horse', 'Jockey', 'Veterinarian', 'Steward', 'RaceEvent', 'Workflow', 'WageringSystem', 'TicketingSystem', 'RegulatoryRecord', 'ComplianceControl', 'AIAgent', 'FutureAssetCategory',
] as const;

const permissionMatrix: Record<RacrAction, RacrRole[]> = {
  create: ['registry-admin', 'asset-owner', 'compliance-officer'],
  read: ['registry-admin', 'asset-owner', 'steward', 'veterinarian', 'track-ops', 'security-ops', 'compliance-officer', 'ai-governance', 'viewer'],
  update: ['registry-admin', 'asset-owner', 'track-ops', 'security-ops', 'compliance-officer', 'ai-governance'],
  delete: ['registry-admin', 'compliance-officer'],
  rollback: ['registry-admin', 'compliance-officer'],
  approve: ['registry-admin', 'steward', 'veterinarian', 'compliance-officer', 'ai-governance'],
  'bind-telemetry': ['registry-admin', 'asset-owner', 'track-ops', 'security-ops'],
  'record-maintenance': ['registry-admin', 'asset-owner', 'track-ops'],
  'change-state': ['registry-admin', 'asset-owner', 'track-ops', 'security-ops', 'compliance-officer'],
};

export function authorizeRacrAction(actor: RacrActor, action: RacrAction): boolean {
  return actor.roles.some((role) => permissionMatrix[action].includes(role));
}

export function validateRacrAsset(asset: RacrAssetVersion): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!asset.globalId.startsWith('racr:')) errors.push('globalId must use racr: namespace');
  if (!asset.tenantId) errors.push('tenantId is required');
  if (!asset.name) errors.push('name is required');
  if (!racrSupportedAssetTypes.includes(asset.assetType as typeof racrSupportedAssetTypes[number])) errors.push(`unsupported assetType ${asset.assetType}`);
  if (asset.version < 1) errors.push('version must be positive');
  if (!asset.owner?.ownerId) errors.push('owner is required');
  if (!asset.digitalTwin?.twinId || !asset.digitalTwin.modelRef || !asset.digitalTwin.stateTopic) errors.push('digitalTwin representation requires twinId, modelRef, and stateTopic');
  if (!asset.operationalState?.status) errors.push('operationalState is required');
  if (!asset.lifecycleControls?.length) errors.push('lifecycleControls are required');
  if (!asset.governanceControls?.length) errors.push('governanceControls are required');
  if (asset.riskClassification === 'critical' && asset.approvalRequirements.length === 0) errors.push('critical assets require approval requirements');
  for (const binding of asset.telemetryBindings) {
    if (!binding.bindingId || !binding.sourceId || !binding.stream || !binding.schemaRef) errors.push('telemetry bindings require id, source, stream, and schema');
  }
  return { valid: errors.length === 0, errors };
}

export class RacetrackAssetControlRegistry {
  private readonly versions = new Map<string, RacrAssetVersion[]>();
  private readonly audits: RacrAuditEntry[] = [];
  constructor(private readonly eventBus = new InMemoryEventBus()) {
    this.registerEventSchemas();
  }

  create(asset: Omit<RacrAssetVersion, 'version' | 'createdAt' | 'updatedAt'> & { version?: number; createdAt?: string; updatedAt?: string }, actor: RacrActor): RacrAssetVersion {
    this.require(actor, 'create');
    if (this.versions.has(asset.globalId)) throw new Error('Asset already exists');
    const now = asset.updatedAt ?? asset.createdAt ?? new Date().toISOString();
    const next: RacrAssetVersion = { ...asset, version: 1, createdAt: asset.createdAt ?? now, updatedAt: now };
    this.assertValid(next);
    this.versions.set(next.globalId, [this.clone(next)]);
    this.audit(next, 'create', actor, ['asset-created']);
    void this.publish('RacrAssetCreated', next, ['asset-created']);
    return this.clone(next);
  }

  update(globalId: string, patch: Partial<Omit<RacrAssetVersion, 'globalId' | 'version' | 'createdAt'>>, actor: RacrActor, reason?: string): RacrAssetVersion {
    this.require(actor, 'update');
    const current = this.current(globalId, true);
    const next: RacrAssetVersion = { ...current, ...patch, globalId, version: current.version + 1, createdAt: current.createdAt, updatedAt: patch.updatedAt ?? new Date().toISOString(), updatedBy: actor.id };
    this.assertValid(next);
    this.versions.get(globalId)!.push(this.clone(next));
    this.audit(next, 'update', actor, Object.keys(patch), reason);
    void this.publish('RacrAssetUpdated', next, Object.keys(patch));
    return this.clone(next);
  }

  softDelete(globalId: string, actor: RacrActor, reason: string): RacrAssetVersion {
    this.require(actor, 'delete');
    return this.update(globalId, { lifecycleState: 'deleted', deletedAt: new Date().toISOString() }, actor, reason);
  }

  rollback(globalId: string, targetVersion: number, actor: RacrActor, reason: string): RacrAssetVersion {
    this.require(actor, 'rollback');
    const target = this.history(globalId).find((item) => item.version === targetVersion);
    if (!target) throw new Error('Target version not found');
    const { globalId: _globalId, version: _version, createdAt: _createdAt, ...rollbackPatch } = target;
    return this.update(globalId, { ...rollbackPatch, updatedBy: actor.id }, actor, reason);
  }

  bindTelemetry(globalId: string, binding: RacrTelemetryBinding, actor: RacrActor): RacrAssetVersion {
    this.require(actor, 'bind-telemetry');
    const current = this.current(globalId, true);
    return this.update(globalId, { telemetryBindings: [...current.telemetryBindings, binding] }, actor, 'telemetry-binding-added');
  }

  recordMaintenance(globalId: string, record: RacrMaintenanceRecord, actor: RacrActor): RacrAssetVersion {
    this.require(actor, 'record-maintenance');
    const current = this.current(globalId, true);
    return this.update(globalId, { maintenanceHistory: [...current.maintenanceHistory, record] }, actor, 'maintenance-recorded');
  }

  changeOperationalState(globalId: string, operationalState: RacrOperationalState, actor: RacrActor, reason?: string): RacrAssetVersion {
    this.require(actor, 'change-state');
    return this.update(globalId, { operationalState }, actor, reason ?? 'operational-state-changed');
  }

  approve(globalId: string, approval: RacrApprovalRecord, actor: RacrActor): RacrAssetVersion {
    this.require(actor, 'approve');
    const current = this.current(globalId, true);
    return this.update(globalId, { approvals: [...current.approvals, approval] }, actor, 'approval-recorded');
  }

  query(filter: Partial<Pick<RacrAssetVersion, 'tenantId' | 'assetClass' | 'assetType' | 'riskClassification' | 'lifecycleState'>> = {}): RacrAssetVersion[] {
    return [...this.versions.keys()].map((id) => this.current(id, true)).filter((asset) => Object.entries(filter).every(([key, value]) => asset[key as keyof RacrAssetVersion] === value));
  }

  apiCatalog(): RacrApiSurface[] {
    const base: RacrApiSurface[] = [
      { name: 'List assets', method: 'GET', path: '/racr/assets', requiredRoles: ['viewer'] },
      { name: 'Create asset', method: 'POST', path: '/racr/assets', requiredRoles: ['registry-admin', 'asset-owner'] },
      { name: 'Update asset', method: 'PATCH', path: '/racr/assets/{globalId}', requiredRoles: ['registry-admin', 'asset-owner'] },
      { name: 'Bind telemetry', method: 'POST', path: '/racr/assets/{globalId}/telemetry-bindings', requiredRoles: ['registry-admin', 'track-ops'] },
      { name: 'Record maintenance', method: 'POST', path: '/racr/assets/{globalId}/maintenance', requiredRoles: ['registry-admin', 'track-ops'] },
    ];
    return base.map((api) => ({ ...api, requiredRoles: [...api.requiredRoles] }));
  }

  current(globalId: string, includeDeleted = false): RacrAssetVersion {
    const stream = this.versions.get(globalId);
    if (!stream?.length) throw new Error('Asset not found');
    const current = stream[stream.length - 1];
    if (current.lifecycleState === 'deleted' && !includeDeleted) throw new Error('Asset is deleted');
    return this.clone(current);
  }

  history(globalId: string): RacrAssetVersion[] { return (this.versions.get(globalId) ?? []).map((item) => this.clone(item)); }
  auditTrail(globalId?: string): RacrAuditEntry[] { return this.audits.filter((entry) => !globalId || entry.globalId === globalId).map((entry) => ({ ...entry, changes: [...entry.changes] })); }
  events(): RaceDayEvent[] { return this.eventBus.events(); }
  eventGovernanceCatalog() { return this.eventBus.governanceCatalog(); }

  private require(actor: RacrActor, action: RacrAction) { if (!authorizeRacrAction(actor, action)) throw new Error(`Actor ${actor.id} is not authorized for ${action}`); }
  private assertValid(asset: RacrAssetVersion) { const result = validateRacrAsset(asset); if (!result.valid) throw new Error(result.errors.join('; ')); }
  private audit(asset: RacrAssetVersion, action: RacrAction, actor: RacrActor, changes: string[], reason?: string) { this.audits.push({ auditId: `audit-${this.audits.length + 1}`, globalId: asset.globalId, version: asset.version, action, actorId: actor.id, occurredAt: asset.updatedAt, changes, reason }); }
  private registerEventSchemas() {
    const owner = { service: 'racetrack-asset-control-registry', team: 'platform-governance', accountableRole: 'RACR Service Owner' };
    for (const type of ['RacrAssetCreated', 'RacrAssetUpdated'] as const) {
      this.eventBus.registerEvent({
        type,
        version: 1,
        description: `${type} authoritative inventory event emitted by the Racetrack Asset and Control Registry`,
        owner,
        payloadFields: ['globalId', 'tenantId', 'assetType', 'assetClass', 'version', 'lifecycleState', 'riskClassification', 'digitalTwinId', 'changedFields'],
        compliance: 'regulated',
        operationalMetadata: { domain: 'asset-management', authoritativeSource: 'RACR', digitalTwinSync: true, auditRequired: true },
        validate: (payload: { globalId?: string; tenantId?: string; version?: number; digitalTwinId?: string }) => Boolean(payload.globalId?.startsWith('racr:') && payload.tenantId && payload.version && payload.version > 0 && payload.digitalTwinId),
      });
    }
  }

  private async publish(type: 'RacrAssetCreated' | 'RacrAssetUpdated', asset: RacrAssetVersion, changedFields: string[] = []) {
    await this.eventBus.publish({
      id: `${asset.globalId}:v${asset.version}`,
      type,
      version: 1,
      occurredAt: asset.updatedAt,
      correlationId: asset.globalId,
      aggregateId: asset.globalId,
      producer: 'racetrack-asset-control-registry',
      payload: { globalId: asset.globalId, tenantId: asset.tenantId, assetType: asset.assetType, assetClass: asset.assetClass, version: asset.version, lifecycleState: asset.lifecycleState, riskClassification: asset.riskClassification, digitalTwinId: asset.digitalTwin.twinId, changedFields },
      metadata: { tenantId: asset.tenantId, compliance: 'regulated', team: 'platform-governance', accountableRole: 'RACR Service Owner' },
    });
  }
  private clone(asset: RacrAssetVersion): RacrAssetVersion { return structuredClone(asset); }
}

export function createRacrAssetTemplate(input: { globalId: string; assetType: typeof racrSupportedAssetTypes[number]; assetClass: RacrAssetClass; tenantId: string; name: string; owner: RacrOwner; riskClassification: RacrRiskClassification; updatedBy: string }): RacrAssetVersion {
  const now = '2026-06-13T00:00:00Z';
  const slug = input.globalId.replaceAll(':', '.');
  return {
    ...input,
    version: 1,
    metadata: {},
    lifecycleState: 'draft',
    approvalRequirements: input.riskClassification === 'critical' ? [{ action: 'activate', requiredRoles: ['compliance-officer'], minApprovals: 1, reason: 'Critical asset activation requires accountable approval' }] : [],
    approvals: [],
    digitalTwin: { twinId: `twin:${slug}`, modelRef: `dtmi:trackmind:${input.assetType};1`, stateTopic: `racr/${input.tenantId}/${slug}/state`, commandTopic: `racr/${input.tenantId}/${slug}/commands`, shadowState: {} },
    telemetryBindings: [],
    maintenanceHistory: [],
    twinRelationships: [],
    operationalState: { status: 'unknown', healthScore: 100, activeIncidents: [] },
    complianceMappings: [{ framework: 'TrackPolicy', controlId: 'RACR-BASELINE', obligation: 'Maintain authoritative inventory, ownership, lifecycle, and audit evidence', evidenceRefs: [] }],
    lifecycleControls: [
      { state: 'draft', entryCriteria: ['registered by authorized actor'], exitCriteria: ['required metadata complete'], approvalRequired: false },
      { state: 'active', entryCriteria: ['owner assigned', 'risk classified', 'approval requirements satisfied'], exitCriteria: ['retirement or suspension approved'], approvalRequired: input.riskClassification !== 'low' },
      { state: 'retired', entryCriteria: ['decommission evidence attached'], exitCriteria: [], approvalRequired: true },
    ],
    apiSurface: [],
    governanceControls: [
      { controlId: 'RACR-RBAC', name: 'Role-based command authorization', description: 'Registry mutations require an authorized actor role.', enforcedBy: 'rbac', evidence: [] },
      { controlId: 'RACR-AUDIT', name: 'Immutable audit and event trail', description: 'Accepted commands append versioned history, audit records, and event stream messages.', enforcedBy: 'audit', evidence: [] },
    ],
    lineage: [],
    schemaVersion: 'racr.asset.v1',
    createdAt: now,
    updatedAt: now,
  };
}
