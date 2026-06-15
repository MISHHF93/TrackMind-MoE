import type { ExpertDomain } from '@trackmind/shared';
import {
  ApprovalStore,
  CentralizedApprovalService,
  type ApprovalToken,
  type ControlledAction,
  type ControlledActionRequest,
  type HumanApprovalRecord,
} from './approvals.js';
import { ImmutableAuditLog } from './auditLog.js';
import { type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';
import { controlCategoryPolicies, type AssetDomain, type AssetRiskLevel, type ControlDefinition, type RegulationDefinition, type SensorDefinition } from './racetrackControlRegistry.js';

export type AssetClass = 'physical' | 'digital' | 'biological' | 'operational' | 'regulatory' | 'ai-agent';
export type AssetLifecycleStatus = 'draft' | 'pending-approval' | 'active' | 'inactive' | 'maintenance' | 'retired' | 'archived';
export type MaintenanceStatus = 'ok' | 'due' | 'overdue' | 'out-of-service';
export type AssetRegistryEventType =
  | 'racetrack.asset.created'
  | 'racetrack.asset.updated'
  | 'racetrack.asset.archived'
  | 'racetrack.asset.activated'
  | 'racetrack.asset.deactivated'
  | 'racetrack.asset.assigned'
  | 'racetrack.asset.inspected'
  | 'racetrack.asset.approved'
  | 'racetrack.asset.approval-requested'
  | 'racetrack.asset.lifecycle-changed'
  | 'racetrack.asset.risk-classified'
  | 'racetrack.asset.telemetry-bound'
  | 'racetrack.asset.maintenance-recorded';

export interface AssetPrincipal { id: string; scopes: string[]; tenantId?: string; roles?: string[] }
export interface RegistryLogger { info(message: string, context?: Record<string, unknown>): void; warn?(message: string, context?: Record<string, unknown>): void; error?(message: string, context?: Record<string, unknown>): void }
export interface AssetApprovalPolicy { id: string; name: string; requiredApprovers: string[]; minimumEvidence: number; riskLevels: AssetRiskLevel[]; lifecycleStatuses: AssetLifecycleStatus[]; description: string }
export interface AssetOwnership { ownerAgent: ExpertDomain; ownerUserId?: string; stewardTeam: string; assignedTo?: string; assignedAt?: string }
export interface AssetMaintenance { status: MaintenanceStatus; lastInspectionAt?: string; nextInspectionDueAt?: string; lastInspector?: string; workOrderId?: string; notes?: string }
export interface AssetDigitalTwinLink { twinId: string; graphNodeId?: string; modelVersion?: string; synchronizedAt?: string; relationship: 'represents' | 'observes' | 'controls' }
export interface AssetTelemetryBinding { bindingId: string; sourceId: string; stream: string; schemaRef: string; required: boolean; sensorId?: string; metric?: string; lastObservedAt?: string }
export interface AssetMaintenanceRecord { recordId: string; performedAt: string; performedBy: string; status: MaintenanceStatus; summary: string; evidence: string[]; workOrderId?: string }
export interface AssetComplianceMapping { framework: RegulationDefinition['authority'] | 'ARCI' | 'ISO42001' | 'ISO27001' | 'SOC2' | 'NIST-AI-RMF'; controlId: string; obligation: string; evidenceRefs: string[] }
export interface AssetLifecycleEvent { status: AssetLifecycleStatus; changedAt: string; changedBy: string; reason?: string; approvalRequestId?: string }
export interface AssetRiskAssessment { level: AssetRiskLevel; assessedAt: string; assessedBy: string; rationale: string; safetyCritical: boolean; approvalRequired: boolean; evidence: string[] }
export interface AssetCommandOptions { reason?: string; approvalToken?: ApprovalToken; actorType?: 'human' | 'ai-agent' | 'service' }
export interface RegistryAsset {
  assetId: string;
  tenantId: string;
  externalIds: string[];
  name: string;
  assetClass: AssetClass;
  assetType: string;
  domain: AssetDomain;
  lifecycleStatus: AssetLifecycleStatus;
  riskLevel: AssetRiskLevel;
  safetyCritical: boolean;
  maintenance: AssetMaintenance;
  maintenanceHistory: AssetMaintenanceRecord[];
  ownership: AssetOwnership;
  location: Record<string, unknown>;
  state: Record<string, unknown>;
  controls: ControlDefinition[];
  sensors: SensorDefinition[];
  telemetryBindings: AssetTelemetryBinding[];
  regulations: RegulationDefinition[];
  complianceMappings: AssetComplianceMapping[];
  lifecycleHistory: AssetLifecycleEvent[];
  riskAssessments: AssetRiskAssessment[];
  tags: string[];
  digitalTwin?: AssetDigitalTwinLink;
  approvalPolicyId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  version: number;
  metadata: Record<string, unknown>;
}
export type AssetCreateInput =
  Omit<RegistryAsset, 'assetId' | 'tenantId' | 'createdAt' | 'updatedAt' | 'version' | 'lifecycleStatus' | 'assetClass' | 'safetyCritical' | 'telemetryBindings' | 'maintenanceHistory' | 'complianceMappings' | 'lifecycleHistory' | 'riskAssessments'>
  & Partial<Pick<RegistryAsset, 'assetClass' | 'safetyCritical' | 'telemetryBindings' | 'maintenanceHistory' | 'complianceMappings' | 'lifecycleHistory' | 'riskAssessments'>>
  & { assetId?: string; tenantId?: string; lifecycleStatus?: AssetLifecycleStatus };
export type AssetUpdateInput = Partial<Omit<RegistryAsset, 'assetId' | 'tenantId' | 'createdAt' | 'version'>>;
export interface AssetQuery { tenantId?: string; q?: string; assetIds?: string[]; assetClass?: AssetClass; assetType?: string; domain?: AssetDomain; lifecycleStatus?: AssetLifecycleStatus; riskLevel?: AssetRiskLevel; safetyCritical?: boolean; maintenanceStatus?: MaintenanceStatus; ownerAgent?: ExpertDomain; assignedTo?: string; tag?: string; tagsAll?: string[]; twinId?: string; approvalPolicyId?: string; complianceFramework?: AssetComplianceMapping['framework']; complianceControlId?: string; telemetrySourceId?: string; sensorId?: string; updatedAfter?: string; updatedBefore?: string; limit?: number; offset?: number; sortBy?: 'assetId' | 'updatedAt' | 'riskLevel' | 'maintenanceStatus' }
export interface AssetQueryResult { total: number; assets: RegistryAsset[]; cache: 'hit' | 'miss' }
export interface AssetRepository { save(asset: RegistryAsset): RegistryAsset; get(assetId: string): RegistryAsset | undefined; findByExternalId(externalId: string): RegistryAsset | undefined; all(): RegistryAsset[] }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const eventTypes: AssetRegistryEventType[] = ['racetrack.asset.created', 'racetrack.asset.updated', 'racetrack.asset.archived', 'racetrack.asset.activated', 'racetrack.asset.deactivated', 'racetrack.asset.assigned', 'racetrack.asset.inspected', 'racetrack.asset.approved', 'racetrack.asset.approval-requested', 'racetrack.asset.lifecycle-changed', 'racetrack.asset.risk-classified', 'racetrack.asset.telemetry-bound', 'racetrack.asset.maintenance-recorded'];
const riskRank: Record<AssetRiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const defaultAssetCoverage: Record<AssetClass, string[]> = {
  physical: ['StartingGate', 'IrrigationZone', 'IrrigationSystem', 'TrackSector', 'SurfaceSector', 'LightingSystem', 'Vehicle', 'Ambulance', 'FireTruck', 'Barn', 'Stall'],
  digital: ['Camera', 'Sensor', 'WageringSystem', 'TicketingSystem'],
  biological: ['Horse', 'Jockey', 'Veterinarian', 'Steward'],
  operational: ['RaceEvent', 'Workflow'],
  regulatory: ['RegulatoryRecord', 'ComplianceControl'],
  'ai-agent': ['AIAgent'],
};

export class InMemoryAssetRepository implements AssetRepository {
  private readonly assets = new Map<string, RegistryAsset>();
  private readonly externalIndex = new Map<string, string>();
  save(asset: RegistryAsset): RegistryAsset {
    if (asset.externalIds.some((externalId) => this.externalIndex.has(externalId) && this.externalIndex.get(externalId) !== asset.assetId)) throw new Error('external id must be unique');
    this.assets.set(asset.assetId, clone(asset));
    asset.externalIds.forEach((externalId) => this.externalIndex.set(externalId, asset.assetId));
    return clone(asset);
  }
  get(assetId: string): RegistryAsset | undefined { const asset = this.assets.get(assetId); return asset ? clone(asset) : undefined; }
  findByExternalId(externalId: string): RegistryAsset | undefined { const assetId = this.externalIndex.get(externalId); return assetId ? this.get(assetId) : undefined; }
  all(): RegistryAsset[] { return [...this.assets.values()].map(clone); }
}

export class AssetRegistryCache {
  private readonly byId = new Map<string, RegistryAsset>();
  private readonly queries = new Map<string, AssetQueryResult>();
  getAsset(id: string) { const asset = this.byId.get(id); return asset ? clone(asset) : undefined; }
  putAsset(asset: RegistryAsset) { this.byId.set(asset.assetId, clone(asset)); }
  getQuery(key: string) { const result = this.queries.get(key); return result ? clone(result) : undefined; }
  putQuery(key: string, result: AssetQueryResult) { this.queries.set(key, clone(result)); }
  invalidate() { this.byId.clear(); this.queries.clear(); }
}

export class RacetrackAssetRegistryService {
  private readonly policies = new Map<string, AssetApprovalPolicy>();
  constructor(options: { repository?: AssetRepository; cache?: AssetRegistryCache; eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; approvalStore?: ApprovalStore; approvalService?: CentralizedApprovalService; logger?: RegistryLogger } = {}) {
    this.repository = options.repository ?? new InMemoryAssetRepository();
    this.cache = options.cache ?? new AssetRegistryCache();
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.approvalStore = options.approvalStore ?? new ApprovalStore();
    this.approvalService = options.approvalService ?? new CentralizedApprovalService({ eventBus: this.eventBus, auditLog: this.auditLog });
    this.logger = options.logger ?? { info: () => undefined };
    this.registerEventSchemas();
    this.registerPolicy({ id: 'standard-asset-approval', name: 'Standard Asset Approval', requiredApprovers: ['AssetOwner'], minimumEvidence: 1, riskLevels: ['low', 'medium'], lifecycleStatuses: ['draft', 'inactive', 'maintenance'], description: controlCategoryPolicies.B_AI_RECOMMENDED.defaultApprovalPolicy });
    this.registerPolicy({ id: 'critical-asset-dual-control', name: 'Critical Asset Dual Control', requiredApprovers: ['AssetOwner', 'SafetyOfficer'], minimumEvidence: 2, riskLevels: ['high', 'critical'], lifecycleStatuses: ['draft', 'pending-approval', 'inactive', 'active', 'maintenance', 'retired'], description: controlCategoryPolicies.C_HUMAN_CONTROLLED.defaultApprovalPolicy });
  }
  readonly repository: AssetRepository; readonly cache: AssetRegistryCache; readonly eventBus: UniversalEventBus; readonly auditLog: ImmutableAuditLog; readonly approvalStore: ApprovalStore; readonly approvalService: CentralizedApprovalService; readonly logger: RegistryLogger;

  registerPolicy(policy: AssetApprovalPolicy) { this.policies.set(policy.id, clone(policy)); return clone(policy); }
  async create(input: AssetCreateInput, principal: AssetPrincipal, options: AssetCommandOptions = {}): Promise<RegistryAsset> { this.authorize(principal, 'assets:write'); const tenantId = this.requireTenant(principal, input.tenantId); const now = new Date().toISOString(); const asset = this.normalize({ ...input, tenantId, assetId: input.assetId ?? id('asset'), lifecycleStatus: input.lifecycleStatus ?? 'draft', createdAt: now, updatedAt: now, version: 1 }); if (this.repository.get(asset.assetId)) throw new Error('assetId must be unique'); if (asset.lifecycleStatus !== 'draft') this.assertSafetyApproval(asset, principal, options); return this.persist(asset, principal, 'racetrack.asset.created', { reason: options.reason }); }
  get(assetId: string, principal: AssetPrincipal): RegistryAsset { this.authorize(principal, 'assets:read'); const cached = this.cache.getAsset(assetId); if (cached) { this.assertTenantAccess(cached, principal); return cached; } const asset = this.repository.get(assetId); if (!asset) throw new Error(`asset not found: ${assetId}`); this.assertTenantAccess(asset, principal); this.cache.putAsset(asset); return asset; }
  query(query: AssetQuery, principal: AssetPrincipal): AssetQueryResult { this.authorize(principal, 'assets:read'); const tenantId = this.requireTenant(principal, query.tenantId); const tenantScopedQuery = { ...query, tenantId }; const key = JSON.stringify({ tenantId, query: tenantScopedQuery }); const cached = this.cache.getQuery(key); if (cached) return { ...cached, cache: 'hit' }; let assets = this.repository.all().filter((asset) => matches(asset, tenantScopedQuery)); if (query.sortBy) assets = sortAssets(assets, query.sortBy); const total = assets.length; const offset = query.offset ?? 0; assets = assets.slice(offset, offset + (query.limit ?? 100)); const result = { total, assets, cache: 'miss' as const }; this.cache.putQuery(key, result); return result; }
  async update(assetId: string, update: AssetUpdateInput, principal: AssetPrincipal, options: AssetCommandOptions = {}) { this.authorize(principal, 'assets:write'); const current = this.get(assetId, { ...principal, scopes: [...new Set([...principal.scopes, 'assets:read'])] }); const next = this.normalize({ ...current, ...update, assetId, createdAt: current.createdAt, updatedAt: new Date().toISOString(), version: current.version + 1 }); if (this.safetySensitiveChange(current, update, next)) this.assertSafetyApproval(next, principal, options); return this.persist(next, principal, 'racetrack.asset.updated', { reason: options.reason, approvalRequestId: options.approvalToken?.requestId }); }
  async activate(assetId: string, principal: AssetPrincipal, options: AssetCommandOptions = {}) { return this.transition(assetId, 'active', principal, 'racetrack.asset.activated', options); }
  async deactivate(assetId: string, principal: AssetPrincipal, options: AssetCommandOptions = {}) { return this.transition(assetId, 'inactive', principal, 'racetrack.asset.deactivated', options); }
  async archive(assetId: string, principal: AssetPrincipal, options: AssetCommandOptions = {}) { const asset = await this.transition(assetId, 'archived', principal, 'racetrack.asset.archived', options); return { ...asset, archivedAt: asset.archivedAt }; }
  async changeLifecycle(assetId: string, lifecycleStatus: AssetLifecycleStatus, principal: AssetPrincipal, options: AssetCommandOptions = {}) { return this.transition(assetId, lifecycleStatus, principal, 'racetrack.asset.lifecycle-changed', options); }
  async assign(assetId: string, assignedTo: string, principal: AssetPrincipal, options: AssetCommandOptions = {}) { return this.update(assetId, { ownership: { ...this.get(assetId, principal).ownership, assignedTo, assignedAt: new Date().toISOString() } }, principal, options).then((asset) => this.emitOnly(asset, principal, 'racetrack.asset.assigned', { approvalRequestId: options.approvalToken?.requestId })); }
  async inspect(assetId: string, inspection: { inspector: string; status: MaintenanceStatus; nextInspectionDueAt?: string; notes?: string; workOrderId?: string }, principal: AssetPrincipal, options: AssetCommandOptions = {}) { const current = this.get(assetId, principal); const asset = await this.update(assetId, { maintenance: { ...current.maintenance, status: inspection.status, lastInspectionAt: new Date().toISOString(), lastInspector: inspection.inspector, nextInspectionDueAt: inspection.nextInspectionDueAt, notes: inspection.notes, workOrderId: inspection.workOrderId } }, principal, options); return this.emitOnly(asset, principal, 'racetrack.asset.inspected', { approvalRequestId: options.approvalToken?.requestId }); }
  async approve(assetId: string, approval: Omit<HumanApprovalRecord, 'recommendationId' | 'action'>, principal: AssetPrincipal) { this.authorize(principal, 'assets:approve'); const asset = this.get(assetId, { ...principal, scopes: [...new Set([...principal.scopes, 'assets:read'])] }); const policy = this.policies.get(asset.approvalPolicyId); if (!policy) throw new Error('approval policy not found'); if (approval.evidence.length < policy.minimumEvidence) throw new Error('approval evidence is insufficient'); const record = this.approvalStore.saveApproval({ ...approval, recommendationId: assetId, action: `asset:${asset.lifecycleStatus}:approve` }); await this.emit(asset, principal, 'racetrack.asset.approved', { approvalId: record.id }); return record; }
  async requestSafetyCriticalChange(assetId: string, input: { reason: string; evidence: string[]; action?: ControlledAction; actorType?: 'human' | 'ai-agent' | 'service'; workflowInstanceId?: string }, principal: AssetPrincipal): Promise<ControlledActionRequest> { this.authorize(principal, 'assets:write'); const asset = this.get(assetId, { ...principal, scopes: [...new Set([...principal.scopes, 'assets:read'])] }); const request = this.approvalService.createRequest({ tenantId: asset.tenantId, action: input.action ?? 'safety-critical-control', target: asset.assetId, requestedBy: principal.id, actorType: input.actorType ?? 'human', reason: input.reason, evidence: input.evidence, workflowInstanceId: input.workflowInstanceId }); await this.emit(asset, principal, 'racetrack.asset.approval-requested', { approvalRequestId: request.id, action: request.action, reason: input.reason }); return request; }
  async bindTelemetry(assetId: string, binding: AssetTelemetryBinding, principal: AssetPrincipal, options: AssetCommandOptions = {}) { if (!binding.bindingId || !binding.sourceId || !binding.stream || !binding.schemaRef) throw new Error('telemetry binding requires bindingId, sourceId, stream, and schemaRef'); const current = this.get(assetId, principal); const asset = await this.update(assetId, { telemetryBindings: upsertBy(current.telemetryBindings, binding, 'bindingId') }, principal, options); return this.emitOnly(asset, principal, 'racetrack.asset.telemetry-bound', { bindingId: binding.bindingId, approvalRequestId: options.approvalToken?.requestId }); }
  async recordMaintenance(assetId: string, record: AssetMaintenanceRecord, principal: AssetPrincipal, options: AssetCommandOptions = {}) { if (!record.recordId || !record.performedAt || !record.performedBy || !record.summary) throw new Error('maintenance record requires id, time, performer, and summary'); const current = this.get(assetId, principal); const maintenance = { ...current.maintenance, status: record.status, lastInspectionAt: record.performedAt, lastInspector: record.performedBy, workOrderId: record.workOrderId ?? current.maintenance.workOrderId, notes: record.summary }; const asset = await this.update(assetId, { maintenance, maintenanceHistory: upsertBy(current.maintenanceHistory, { ...record, evidence: [...record.evidence] }, 'recordId') }, principal, options); return this.emitOnly(asset, principal, 'racetrack.asset.maintenance-recorded', { recordId: record.recordId, approvalRequestId: options.approvalToken?.requestId }); }
  async updateRiskClassification(assetId: string, assessment: Omit<AssetRiskAssessment, 'assessedAt' | 'assessedBy'> & Partial<Pick<AssetRiskAssessment, 'assessedAt' | 'assessedBy'>>, principal: AssetPrincipal, options: AssetCommandOptions = {}) { const current = this.get(assetId, principal); const now = assessment.assessedAt ?? new Date().toISOString(); const nextAssessment = { ...assessment, assessedAt: now, assessedBy: assessment.assessedBy ?? principal.id, evidence: [...assessment.evidence] }; const asset = await this.update(assetId, { riskLevel: assessment.level, safetyCritical: assessment.safetyCritical || current.safetyCritical || assessment.level === 'critical', riskAssessments: [...current.riskAssessments, nextAssessment] }, principal, options); return this.emitOnly(asset, principal, 'racetrack.asset.risk-classified', { riskLevel: assessment.level, approvalRequestId: options.approvalToken?.requestId }); }

  apiDefinition(): ApiServiceDefinition { return racetrackAssetRegistryApiDefinition(); }

  private async transition(assetId: string, lifecycleStatus: AssetLifecycleStatus, principal: AssetPrincipal, eventType: AssetRegistryEventType, options: AssetCommandOptions = {}) { const current = this.get(assetId, principal); const now = new Date().toISOString(); if (this.requiresSafetyApproval(current)) this.assertSafetyApproval(current, principal, options); const event = { status: lifecycleStatus, changedAt: now, changedBy: principal.id, reason: options.reason, approvalRequestId: options.approvalToken?.requestId }; return this.persist(this.normalize({ ...current, lifecycleStatus, lifecycleHistory: [...current.lifecycleHistory, event], archivedAt: lifecycleStatus === 'archived' ? now : current.archivedAt, updatedAt: now, version: current.version + 1 }), principal, eventType, { reason: options.reason, approvalRequestId: options.approvalToken?.requestId }); }
  private async persist(asset: RegistryAsset, principal: AssetPrincipal, eventType: AssetRegistryEventType, metadata: Record<string, unknown> = {}) { const saved = this.repository.save(asset); this.cache.invalidate(); this.cache.putAsset(saved); await this.emit(saved, principal, eventType, metadata); return saved; }
  private async emitOnly(asset: RegistryAsset, principal: AssetPrincipal, eventType: AssetRegistryEventType, metadata: Record<string, unknown> = {}) { await this.emit(asset, principal, eventType, metadata); return asset; }
  private async emit(asset: RegistryAsset, principal: AssetPrincipal, type: AssetRegistryEventType, metadata: Record<string, unknown> = {}): Promise<RaceDayEvent> {
    this.logger.info('racetrack asset registry event', { type, assetId: asset.assetId, principalId: principal.id, tenantId: asset.tenantId });
    const regulations = [...new Set([...asset.regulations.map((r) => r.authority), ...asset.complianceMappings.map((mapping) => mapping.framework)])];
    const timestamp = new Date().toISOString();
    const racetrackId = racetrackRef(asset);
    const digitalTwinRef = asset.digitalTwin?.twinId;
    const evidence = assetEvidence(asset, metadata);
    const approvalRef = stringMetadata(metadata.approvalRequestId) ?? stringMetadata(metadata.approvalId);
    const audit = this.auditLog.append({
      id: id('audit'),
      type: type.endsWith('approved') || type.endsWith('approval-requested') ? 'approval' : 'data-change',
      actor: principal.id,
      actorType: metadata.actorType === 'ai-agent' ? 'ai-agent' : metadata.actorType === 'service' ? 'service' : 'human',
      timestamp,
      action: type,
      actionClass: type.endsWith('approved') || type.endsWith('approval-requested') ? 'approval' : 'asset',
      payload: { type, assetId: asset.assetId, assetClass: asset.assetClass, safetyCritical: asset.safetyCritical, digitalTwinRef, approvalRef, metadata },
      subjectId: asset.assetId,
      target: asset.assetId,
      tenantId: asset.tenantId,
      correlationId: approvalRef ?? id('corr'),
      severity: asset.riskLevel === 'critical' || asset.safetyCritical ? 'critical' : asset.riskLevel === 'high' ? 'warning' : 'info',
      regulations,
      evidenceIds: evidence,
    });
    return this.eventBus.publish({
      type,
      payload: { asset: clone(asset), actor: principal.id, tenantId: asset.tenantId, racetrackId, auditRef: audit.id, digitalTwinRef, approvalRef, evidence, ...metadata },
      aggregateId: asset.assetId,
      correlationId: audit.correlationId,
      producer: 'racetrack-asset-registry',
      tenantId: asset.tenantId,
      racetrackId,
      actor: { id: principal.id, type: metadata.actorType === 'ai-agent' ? 'ai-agent' : metadata.actorType === 'service' ? 'service' : 'human' },
      subject: { id: asset.assetId, type: 'asset', tenantId: asset.tenantId },
      evidence,
      auditRef: audit.id,
      digitalTwinRef,
      approvalRef,
      metadata: { tenantId: asset.tenantId, racetrackId, team: 'racetrack-platform', accountableRole: 'asset-registry-owner', compliance: asset.riskLevel === 'critical' || asset.safetyCritical ? 'restricted' : 'internal', regulations },
    });
  }
  private authorize(principal: AssetPrincipal, scope: string) { if (!principal.id) throw new Error('authentication required'); if (!principal.scopes.includes(scope)) throw new Error(`missing scope: ${scope}`); }
  private requireTenant(principal: AssetPrincipal, requestedTenantId?: string): string { if (!principal.tenantId) throw new Error('tenantId is required for asset registry access'); if (requestedTenantId && requestedTenantId !== principal.tenantId) throw new Error('tenant isolation violation'); return principal.tenantId; }
  private assertTenantAccess(asset: RegistryAsset, principal: AssetPrincipal): void { this.requireTenant(principal); if (asset.tenantId !== principal.tenantId) throw new Error('tenant isolation violation'); }
  private normalize(asset: (AssetCreateInput & Partial<RegistryAsset> & { assetId: string; tenantId: string; lifecycleStatus: AssetLifecycleStatus; createdAt: string; updatedAt: string; version: number }) | RegistryAsset): RegistryAsset {
    if (!asset.tenantId) throw new Error('tenantId is required');
    if (!asset.assetId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,}$|^asset-/.test(asset.assetId)) throw new Error('assetId is required and must be stable');
    if (!asset.name) throw new Error('asset name is required');
    if (!this.policies.has(asset.approvalPolicyId)) throw new Error('approvalPolicyId is not registered');
    const updatedAt = asset.updatedAt ?? new Date().toISOString();
    const assetClass = asset.assetClass ?? inferAssetClass(asset.assetType, asset.domain);
    const telemetryBindings = asset.telemetryBindings?.length ? asset.telemetryBindings : asset.sensors.map((sensor) => sensorToTelemetryBinding(asset.tenantId, asset.assetId, sensor));
    const complianceMappings = asset.complianceMappings?.length ? asset.complianceMappings : asset.regulations.map(regulationToComplianceMapping);
    const safetyCritical = asset.safetyCritical ?? inferSafetyCritical(asset.riskLevel, asset.controls);
    const lifecycleHistory = asset.lifecycleHistory?.length ? asset.lifecycleHistory : [{ status: asset.lifecycleStatus, changedAt: updatedAt, changedBy: String(asset.metadata?.createdBy ?? asset.ownership.ownerUserId ?? asset.ownership.stewardTeam), reason: 'asset registered' }];
    const riskAssessments = asset.riskAssessments?.length ? asset.riskAssessments : [{ level: asset.riskLevel, assessedAt: updatedAt, assessedBy: String(asset.metadata?.createdBy ?? asset.ownership.stewardTeam), rationale: 'Initial registry classification', safetyCritical, approvalRequired: safetyCritical || asset.riskLevel === 'critical', evidence: ['asset-registration'] }];
    return { ...clone(asset), assetClass, safetyCritical, externalIds: [...new Set(asset.externalIds ?? [])], telemetryBindings: telemetryBindings.map((binding) => ({ ...binding })), maintenanceHistory: (asset.maintenanceHistory ?? []).map((record) => ({ ...record, evidence: [...record.evidence] })), complianceMappings: complianceMappings.map((mapping) => ({ ...mapping, evidenceRefs: [...mapping.evidenceRefs] })), lifecycleHistory: lifecycleHistory.map((event) => ({ ...event })), riskAssessments: riskAssessments.map((assessment) => ({ ...assessment, evidence: [...assessment.evidence] })), tags: [...new Set((asset.tags ?? []).map((tag) => tag.toLowerCase()))], metadata: { ...(asset.metadata ?? {}) } };
  }
  private requiresSafetyApproval(asset: RegistryAsset): boolean { return asset.safetyCritical || asset.riskLevel === 'critical' || asset.controls.some((control) => control.executionMode === 'human-only' || Boolean(control.protectedAction)); }
  private safetySensitiveChange(current: RegistryAsset, update: AssetUpdateInput, next: RegistryAsset): boolean {
    if (!this.requiresSafetyApproval(current) && !this.requiresSafetyApproval(next)) return false;
    const guardedFields = ['lifecycleStatus', 'riskLevel', 'safetyCritical', 'state', 'controls', 'sensors', 'telemetryBindings', 'maintenance', 'maintenanceHistory', 'ownership', 'location', 'approvalPolicyId'] satisfies Array<keyof AssetUpdateInput>;
    return guardedFields.some((field) => field in update);
  }
  private assertSafetyApproval(asset: RegistryAsset, principal: AssetPrincipal, options: AssetCommandOptions): void { if (!this.requiresSafetyApproval(asset)) return; this.approvalService.assertAuthorized(options.approvalToken, 'safety-critical-control', asset.assetId, asset.tenantId); if (options.actorType === 'ai-agent') throw new Error('AI agents cannot execute safety-critical asset changes'); if (!principal.id) throw new Error('authenticated human or service actor is required for safety-critical asset changes'); }
  private registerEventSchemas() { eventTypes.forEach((type) => this.eventBus.registerEvent({ type, version: 1, description: `Racetrack asset registry ${type.replace('racetrack.asset.', '')} event`, owner: { service: 'racetrack-asset-registry', team: 'racetrack-platform', accountableRole: 'asset-registry-owner' }, payloadFields: ['asset', 'actor', 'tenantId'], compliance: 'internal' })); }
}

function matches(asset: RegistryAsset, query: AssetQuery) { const text = `${asset.assetId} ${asset.name} ${asset.assetClass} ${asset.assetType} ${asset.tags.join(' ')} ${asset.externalIds.join(' ')} ${asset.ownership.ownerAgent} ${asset.ownership.stewardTeam} ${asset.complianceMappings.map((m) => `${m.framework} ${m.controlId} ${m.obligation}`).join(' ')} ${asset.telemetryBindings.map((b) => `${b.sourceId} ${b.sensorId ?? ''} ${b.stream}`).join(' ')} ${asset.maintenanceHistory.map((m) => `${m.summary} ${m.workOrderId ?? ''}`).join(' ')} ${JSON.stringify(asset.location)} ${JSON.stringify(asset.state)}`.toLowerCase(); return (!query.tenantId || asset.tenantId === query.tenantId) && (!query.q || text.includes(query.q.toLowerCase())) && (!query.assetIds || query.assetIds.includes(asset.assetId)) && (!query.assetClass || asset.assetClass === query.assetClass) && (!query.assetType || asset.assetType === query.assetType) && (!query.domain || asset.domain === query.domain) && (!query.lifecycleStatus || asset.lifecycleStatus === query.lifecycleStatus) && (!query.riskLevel || asset.riskLevel === query.riskLevel) && (query.safetyCritical === undefined || asset.safetyCritical === query.safetyCritical) && (!query.maintenanceStatus || asset.maintenance.status === query.maintenanceStatus) && (!query.ownerAgent || asset.ownership.ownerAgent === query.ownerAgent) && (!query.assignedTo || asset.ownership.assignedTo === query.assignedTo) && (!query.tag || asset.tags.includes(query.tag.toLowerCase())) && (!query.tagsAll || query.tagsAll.every((tag) => asset.tags.includes(tag.toLowerCase()))) && (!query.twinId || asset.digitalTwin?.twinId === query.twinId) && (!query.approvalPolicyId || asset.approvalPolicyId === query.approvalPolicyId) && (!query.complianceFramework || asset.complianceMappings.some((mapping) => mapping.framework === query.complianceFramework)) && (!query.complianceControlId || asset.complianceMappings.some((mapping) => mapping.controlId === query.complianceControlId)) && (!query.telemetrySourceId || asset.telemetryBindings.some((binding) => binding.sourceId === query.telemetrySourceId)) && (!query.sensorId || asset.sensors.some((sensor) => sensor.id === query.sensorId) || asset.telemetryBindings.some((binding) => binding.sensorId === query.sensorId)) && (!query.updatedAfter || asset.updatedAt >= query.updatedAfter) && (!query.updatedBefore || asset.updatedAt <= query.updatedBefore); }
function sortAssets(assets: RegistryAsset[], sortBy: NonNullable<AssetQuery['sortBy']>) { return [...assets].sort((a, b) => sortBy === 'riskLevel' ? riskRank[b.riskLevel] - riskRank[a.riskLevel] : sortBy === 'maintenanceStatus' ? a.maintenance.status.localeCompare(b.maintenance.status) : String(a[sortBy]).localeCompare(String(b[sortBy]))); }

export function racetrackAssetRegistryApiDefinition(): ApiServiceDefinition { return { id: 'racetrack-asset-registry', name: 'Racetrack Asset Registry', domain: 'asset-management', version: 'v1', basePath: '/api/v1/assets', description: 'Tenant-scoped authoritative registry for uniquely identifiable racetrack assets, ownership, lifecycle, risk, maintenance, digital twin links, approvals, and search.', owner: { team: 'racetrack-platform', productOwner: 'Director of Operations Technology', technicalOwner: 'Asset Registry Service Owner', supportChannel: '#trackmind-assets' }, lifecycle: 'active', auth: ['jwt', 'oauth2', 'mtls'], rateLimit: { requests: 600, perSeconds: 60, burst: 100 }, tags: ['assets', 'racetrack', 'digital-twin', 'audit', 'tenant-isolation'], slo: { availability: 99.95, latencyMs: 250 }, endpoints: [
  { method: 'POST', path: '/', summary: 'Create an asset', scopes: ['assets:write'] },
  { method: 'GET', path: '/{assetId}', summary: 'Get an asset by unique identifier', scopes: ['assets:read'] },
  { method: 'GET', path: '/', summary: 'Search and filter assets', scopes: ['assets:read'] },
  { method: 'PATCH', path: '/{assetId}', summary: 'Update asset metadata, tags, risk, ownership, maintenance, and twin links', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}/approval-requests', summary: 'Request approval for safety-critical asset changes', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}/lifecycle', summary: 'Change asset lifecycle state with approval enforcement when required', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}/risk-classification', summary: 'Record a risk classification and evidence package', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:activate', summary: 'Activate an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:deactivate', summary: 'Deactivate an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:archive', summary: 'Archive an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:assign', summary: 'Assign an asset to an operator or team', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:inspect', summary: 'Record inspection and maintenance status', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}/telemetry-bindings', summary: 'Bind a telemetry source or stream to an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}/maintenance-history', summary: 'Append maintenance work-order evidence', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:approve', summary: 'Approve an asset lifecycle or risk policy decision', scopes: ['assets:approve'] },
] , dependencies: [{ serviceId: 'digital-twin-runtime', apiId: 'digital-twin-runtime', version: 'v1', criticality: 'high' }, { serviceId: 'trackmind-nexus-governance', apiId: 'approval-service', version: 'v1', criticality: 'critical' }] }; }

function inferAssetClass(assetType: string, domain: AssetDomain): AssetClass {
  for (const [assetClass, types] of Object.entries(defaultAssetCoverage) as Array<[AssetClass, string[]]>) if (types.includes(assetType)) return assetClass;
  if (domain === 'regulatory') return 'regulatory';
  if (['racing', 'surface', 'facilities', 'safety', 'security'].includes(domain)) return 'physical';
  return 'operational';
}
function inferSafetyCritical(riskLevel: AssetRiskLevel, controls: ControlDefinition[]): boolean { return riskLevel === 'critical' || controls.some((control) => control.executionMode === 'human-only' || Boolean(control.protectedAction)); }
function sensorToTelemetryBinding(tenantId: string, assetId: string, sensor: SensorDefinition): AssetTelemetryBinding { return { bindingId: `binding:${assetId}:${sensor.id}`, sourceId: sensor.id, sensorId: sensor.id, stream: `telemetry.${tenantId}.${sensor.type}`, schemaRef: `telemetry.${sensor.type}.v1`, required: sensor.required, metric: sensor.verifies[0] ?? sensor.type }; }
function regulationToComplianceMapping(regulation: RegulationDefinition): AssetComplianceMapping { return { framework: regulation.authority, controlId: regulation.reference, obligation: `Comply with ${regulation.reference}`, evidenceRefs: regulation.appliesTo.map((item) => `control:${item}`) }; }
function upsertBy<T extends Record<K, string>, K extends keyof T>(items: T[], item: T, key: K): T[] { return [...items.filter((existing) => existing[key] !== item[key]), item].map(clone); }
function stringMetadata(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function racetrackRef(asset: RegistryAsset): string {
  return stringMetadata(asset.location.racetrackId) ?? stringMetadata(asset.location.trackId) ?? stringMetadata(asset.location.track) ?? asset.tenantId;
}
function assetEvidence(asset: RegistryAsset, metadata: Record<string, unknown>): string[] {
  return [...new Set([
    ...asset.regulations.map((regulation) => `${regulation.authority}:${regulation.reference}`),
    ...asset.complianceMappings.flatMap((mapping) => mapping.evidenceRefs),
    ...asset.riskAssessments.flatMap((assessment) => assessment.evidence),
    ...asset.maintenanceHistory.flatMap((record) => record.evidence),
    ...(Array.isArray(metadata.evidence) ? metadata.evidence.filter((item): item is string => typeof item === 'string') : []),
    stringMetadata(metadata.approvalRequestId),
    stringMetadata(metadata.approvalId),
  ].filter((item): item is string => Boolean(item)))];
}
