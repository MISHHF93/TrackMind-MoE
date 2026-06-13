import type { ExpertDomain } from '@trackmind/shared';
import { ApprovalStore, type HumanApprovalRecord } from './approvals.js';
import { ImmutableAuditLog } from './auditLog.js';
import { type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';
import { controlCategoryPolicies, type AssetDomain, type AssetRiskLevel, type ControlDefinition, type RegulationDefinition, type SensorDefinition } from './racetrackControlRegistry.js';

export type AssetLifecycleStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type MaintenanceStatus = 'ok' | 'due' | 'overdue' | 'out-of-service';
export type AssetRegistryEventType =
  | 'racetrack.asset.created'
  | 'racetrack.asset.updated'
  | 'racetrack.asset.archived'
  | 'racetrack.asset.activated'
  | 'racetrack.asset.deactivated'
  | 'racetrack.asset.assigned'
  | 'racetrack.asset.inspected'
  | 'racetrack.asset.approved';

export interface AssetPrincipal { id: string; scopes: string[]; tenantId?: string; roles?: string[] }
export interface RegistryLogger { info(message: string, context?: Record<string, unknown>): void; warn?(message: string, context?: Record<string, unknown>): void; error?(message: string, context?: Record<string, unknown>): void }
export interface AssetApprovalPolicy { id: string; name: string; requiredApprovers: string[]; minimumEvidence: number; riskLevels: AssetRiskLevel[]; lifecycleStatuses: AssetLifecycleStatus[]; description: string }
export interface AssetOwnership { ownerAgent: ExpertDomain; ownerUserId?: string; stewardTeam: string; assignedTo?: string; assignedAt?: string }
export interface AssetMaintenance { status: MaintenanceStatus; lastInspectionAt?: string; nextInspectionDueAt?: string; lastInspector?: string; workOrderId?: string; notes?: string }
export interface AssetDigitalTwinLink { twinId: string; graphNodeId?: string; modelVersion?: string; synchronizedAt?: string; relationship: 'represents' | 'observes' | 'controls' }
export interface RegistryAsset {
  assetId: string;
  externalIds: string[];
  name: string;
  assetType: string;
  domain: AssetDomain;
  lifecycleStatus: AssetLifecycleStatus;
  riskLevel: AssetRiskLevel;
  maintenance: AssetMaintenance;
  ownership: AssetOwnership;
  location: Record<string, unknown>;
  state: Record<string, unknown>;
  controls: ControlDefinition[];
  sensors: SensorDefinition[];
  regulations: RegulationDefinition[];
  tags: string[];
  digitalTwin?: AssetDigitalTwinLink;
  approvalPolicyId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  version: number;
  metadata: Record<string, unknown>;
}
export type AssetCreateInput = Omit<RegistryAsset, 'assetId' | 'createdAt' | 'updatedAt' | 'version' | 'lifecycleStatus'> & { assetId?: string; lifecycleStatus?: AssetLifecycleStatus };
export type AssetUpdateInput = Partial<Omit<RegistryAsset, 'assetId' | 'createdAt' | 'version'>>;
export interface AssetQuery { q?: string; assetIds?: string[]; assetType?: string; domain?: AssetDomain; lifecycleStatus?: AssetLifecycleStatus; riskLevel?: AssetRiskLevel; maintenanceStatus?: MaintenanceStatus; ownerAgent?: ExpertDomain; assignedTo?: string; tag?: string; tagsAll?: string[]; twinId?: string; approvalPolicyId?: string; updatedAfter?: string; updatedBefore?: string; limit?: number; offset?: number; sortBy?: 'assetId' | 'updatedAt' | 'riskLevel' | 'maintenanceStatus' }
export interface AssetQueryResult { total: number; assets: RegistryAsset[]; cache: 'hit' | 'miss' }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const eventTypes: AssetRegistryEventType[] = ['racetrack.asset.created', 'racetrack.asset.updated', 'racetrack.asset.archived', 'racetrack.asset.activated', 'racetrack.asset.deactivated', 'racetrack.asset.assigned', 'racetrack.asset.inspected', 'racetrack.asset.approved'];
const riskRank: Record<AssetRiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class InMemoryAssetRepository {
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
  constructor(private readonly options: { repository?: InMemoryAssetRepository; cache?: AssetRegistryCache; eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; approvalStore?: ApprovalStore; logger?: RegistryLogger } = {}) {
    this.repository = options.repository ?? new InMemoryAssetRepository();
    this.cache = options.cache ?? new AssetRegistryCache();
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.approvalStore = options.approvalStore ?? new ApprovalStore();
    this.logger = options.logger ?? { info: () => undefined };
    this.registerEventSchemas();
    this.registerPolicy({ id: 'standard-asset-approval', name: 'Standard Asset Approval', requiredApprovers: ['AssetOwner'], minimumEvidence: 1, riskLevels: ['low', 'medium'], lifecycleStatuses: ['draft', 'inactive'], description: controlCategoryPolicies.B_AI_RECOMMENDED.defaultApprovalPolicy });
    this.registerPolicy({ id: 'critical-asset-dual-control', name: 'Critical Asset Dual Control', requiredApprovers: ['AssetOwner', 'SafetyOfficer'], minimumEvidence: 2, riskLevels: ['high', 'critical'], lifecycleStatuses: ['draft', 'inactive', 'active'], description: controlCategoryPolicies.C_HUMAN_CONTROLLED.defaultApprovalPolicy });
  }
  readonly repository: InMemoryAssetRepository; readonly cache: AssetRegistryCache; readonly eventBus: UniversalEventBus; readonly auditLog: ImmutableAuditLog; readonly approvalStore: ApprovalStore; readonly logger: RegistryLogger;

  registerPolicy(policy: AssetApprovalPolicy) { this.policies.set(policy.id, clone(policy)); return clone(policy); }
  async create(input: AssetCreateInput, principal: AssetPrincipal): Promise<RegistryAsset> { this.authorize(principal, 'assets:write'); const now = new Date().toISOString(); const asset = this.normalize({ ...input, assetId: input.assetId ?? id('asset'), lifecycleStatus: input.lifecycleStatus ?? 'draft', createdAt: now, updatedAt: now, version: 1 }); if (this.repository.get(asset.assetId)) throw new Error('assetId must be unique'); return this.persist(asset, principal, 'racetrack.asset.created'); }
  get(assetId: string, principal: AssetPrincipal): RegistryAsset { this.authorize(principal, 'assets:read'); const cached = this.cache.getAsset(assetId); if (cached) return cached; const asset = this.repository.get(assetId); if (!asset) throw new Error(`asset not found: ${assetId}`); this.cache.putAsset(asset); return asset; }
  query(query: AssetQuery, principal: AssetPrincipal): AssetQueryResult { this.authorize(principal, 'assets:read'); const key = JSON.stringify(query); const cached = this.cache.getQuery(key); if (cached) return { ...cached, cache: 'hit' }; let assets = this.repository.all().filter((asset) => matches(asset, query)); if (query.sortBy) assets = sortAssets(assets, query.sortBy); const total = assets.length; const offset = query.offset ?? 0; assets = assets.slice(offset, offset + (query.limit ?? 100)); const result = { total, assets, cache: 'miss' as const }; this.cache.putQuery(key, result); return result; }
  async update(assetId: string, update: AssetUpdateInput, principal: AssetPrincipal) { this.authorize(principal, 'assets:write'); const current = this.get(assetId, { ...principal, scopes: [...new Set([...principal.scopes, 'assets:read'])] }); const next = this.normalize({ ...current, ...update, assetId, createdAt: current.createdAt, updatedAt: new Date().toISOString(), version: current.version + 1 }); return this.persist(next, principal, 'racetrack.asset.updated'); }
  async activate(assetId: string, principal: AssetPrincipal) { return this.transition(assetId, 'active', principal, 'racetrack.asset.activated'); }
  async deactivate(assetId: string, principal: AssetPrincipal) { return this.transition(assetId, 'inactive', principal, 'racetrack.asset.deactivated'); }
  async archive(assetId: string, principal: AssetPrincipal) { const asset = await this.transition(assetId, 'archived', principal, 'racetrack.asset.archived'); return { ...asset, archivedAt: asset.archivedAt }; }
  async assign(assetId: string, assignedTo: string, principal: AssetPrincipal) { return this.update(assetId, { ownership: { ...this.get(assetId, principal).ownership, assignedTo, assignedAt: new Date().toISOString() } }, principal).then((asset) => this.emitOnly(asset, principal, 'racetrack.asset.assigned')); }
  async inspect(assetId: string, inspection: { inspector: string; status: MaintenanceStatus; nextInspectionDueAt?: string; notes?: string; workOrderId?: string }, principal: AssetPrincipal) { const current = this.get(assetId, principal); const asset = await this.update(assetId, { maintenance: { ...current.maintenance, status: inspection.status, lastInspectionAt: new Date().toISOString(), lastInspector: inspection.inspector, nextInspectionDueAt: inspection.nextInspectionDueAt, notes: inspection.notes, workOrderId: inspection.workOrderId } }, principal); return this.emitOnly(asset, principal, 'racetrack.asset.inspected'); }
  async approve(assetId: string, approval: Omit<HumanApprovalRecord, 'recommendationId' | 'action'>, principal: AssetPrincipal) { this.authorize(principal, 'assets:approve'); const asset = this.get(assetId, { ...principal, scopes: [...new Set([...principal.scopes, 'assets:read'])] }); const policy = this.policies.get(asset.approvalPolicyId); if (!policy) throw new Error('approval policy not found'); if (approval.evidence.length < policy.minimumEvidence) throw new Error('approval evidence is insufficient'); const record = this.approvalStore.saveApproval({ ...approval, recommendationId: assetId, action: `asset:${asset.lifecycleStatus}:approve` }); await this.emit(asset, principal, 'racetrack.asset.approved', { approvalId: record.id }); return record; }

  apiDefinition(): ApiServiceDefinition { return racetrackAssetRegistryApiDefinition(); }

  private async transition(assetId: string, lifecycleStatus: AssetLifecycleStatus, principal: AssetPrincipal, eventType: AssetRegistryEventType) { const current = this.get(assetId, principal); return this.persist(this.normalize({ ...current, lifecycleStatus, archivedAt: lifecycleStatus === 'archived' ? new Date().toISOString() : current.archivedAt, updatedAt: new Date().toISOString(), version: current.version + 1 }), principal, eventType); }
  private async persist(asset: RegistryAsset, principal: AssetPrincipal, eventType: AssetRegistryEventType) { const saved = this.repository.save(asset); this.cache.invalidate(); this.cache.putAsset(saved); await this.emit(saved, principal, eventType); return saved; }
  private async emitOnly(asset: RegistryAsset, principal: AssetPrincipal, eventType: AssetRegistryEventType) { await this.emit(asset, principal, eventType); return asset; }
  private async emit(asset: RegistryAsset, principal: AssetPrincipal, type: AssetRegistryEventType, metadata: Record<string, unknown> = {}): Promise<RaceDayEvent> { this.logger.info('racetrack asset registry event', { type, assetId: asset.assetId, principalId: principal.id }); this.auditLog.append({ id: id('audit'), type: type.endsWith('approved') ? 'approval' : 'data-change', actor: principal.id, timestamp: new Date().toISOString(), payload: { type, assetId: asset.assetId, metadata }, subjectId: asset.assetId, tenantId: principal.tenantId, severity: asset.riskLevel === 'critical' ? 'critical' : 'info', regulations: asset.regulations.map((r) => r.authority) }); return this.eventBus.publish({ type, payload: { asset: clone(asset), actor: principal.id, tenantId: principal.tenantId, ...metadata }, aggregateId: asset.assetId, producer: 'racetrack-asset-registry', metadata: { team: 'racetrack-platform', accountableRole: 'asset-registry-owner', compliance: asset.riskLevel === 'critical' ? 'restricted' : 'internal' } }); }
  private authorize(principal: AssetPrincipal, scope: string) { if (!principal.id) throw new Error('authentication required'); if (!principal.scopes.includes(scope)) throw new Error(`missing scope: ${scope}`); }
  private normalize(asset: RegistryAsset): RegistryAsset { if (!asset.assetId || !/^[A-Z0-9][A-Z0-9._:-]{2,}$|^asset-/.test(asset.assetId)) throw new Error('assetId is required and must be stable'); if (!asset.name) throw new Error('asset name is required'); if (!this.policies.has(asset.approvalPolicyId)) throw new Error('approvalPolicyId is not registered'); return { ...clone(asset), externalIds: [...new Set(asset.externalIds ?? [])], tags: [...new Set((asset.tags ?? []).map((tag) => tag.toLowerCase()))], metadata: { ...(asset.metadata ?? {}) } }; }
  private registerEventSchemas() { eventTypes.forEach((type) => this.eventBus.registerEvent({ type, version: 1, description: `Racetrack asset registry ${type.replace('racetrack.asset.', '')} event`, owner: { service: 'racetrack-asset-registry', team: 'racetrack-platform', accountableRole: 'asset-registry-owner' }, payloadFields: ['asset', 'actor', 'tenantId'], compliance: 'internal' })); }
}

function matches(asset: RegistryAsset, query: AssetQuery) { const text = `${asset.assetId} ${asset.name} ${asset.assetType} ${asset.tags.join(' ')} ${asset.externalIds.join(' ')} ${JSON.stringify(asset.location)} ${JSON.stringify(asset.state)}`.toLowerCase(); return (!query.q || text.includes(query.q.toLowerCase())) && (!query.assetIds || query.assetIds.includes(asset.assetId)) && (!query.assetType || asset.assetType === query.assetType) && (!query.domain || asset.domain === query.domain) && (!query.lifecycleStatus || asset.lifecycleStatus === query.lifecycleStatus) && (!query.riskLevel || asset.riskLevel === query.riskLevel) && (!query.maintenanceStatus || asset.maintenance.status === query.maintenanceStatus) && (!query.ownerAgent || asset.ownership.ownerAgent === query.ownerAgent) && (!query.assignedTo || asset.ownership.assignedTo === query.assignedTo) && (!query.tag || asset.tags.includes(query.tag.toLowerCase())) && (!query.tagsAll || query.tagsAll.every((tag) => asset.tags.includes(tag.toLowerCase()))) && (!query.twinId || asset.digitalTwin?.twinId === query.twinId) && (!query.approvalPolicyId || asset.approvalPolicyId === query.approvalPolicyId) && (!query.updatedAfter || asset.updatedAt >= query.updatedAfter) && (!query.updatedBefore || asset.updatedAt <= query.updatedBefore); }
function sortAssets(assets: RegistryAsset[], sortBy: NonNullable<AssetQuery['sortBy']>) { return [...assets].sort((a, b) => sortBy === 'riskLevel' ? riskRank[b.riskLevel] - riskRank[a.riskLevel] : sortBy === 'maintenanceStatus' ? a.maintenance.status.localeCompare(b.maintenance.status) : String(a[sortBy]).localeCompare(String(b[sortBy]))); }

export function racetrackAssetRegistryApiDefinition(): ApiServiceDefinition { return { id: 'racetrack-asset-registry', name: 'Racetrack Asset Registry', domain: 'asset-management', version: 'v1', basePath: '/api/v1/assets', description: 'Authoritative registry for uniquely identifiable racetrack assets, ownership, lifecycle, risk, maintenance, digital twin links, approvals, and search.', owner: { team: 'racetrack-platform', productOwner: 'Director of Operations Technology', technicalOwner: 'Asset Registry Service Owner', supportChannel: '#trackmind-assets' }, lifecycle: 'active', auth: ['jwt', 'oauth2', 'mtls'], rateLimit: { requests: 600, perSeconds: 60, burst: 100 }, tags: ['assets', 'racetrack', 'digital-twin', 'audit'], slo: { availability: 99.95, latencyMs: 250 }, endpoints: [
  { method: 'POST', path: '/', summary: 'Create an asset', scopes: ['assets:write'] },
  { method: 'GET', path: '/{assetId}', summary: 'Get an asset by unique identifier', scopes: ['assets:read'] },
  { method: 'GET', path: '/', summary: 'Search and filter assets', scopes: ['assets:read'] },
  { method: 'PATCH', path: '/{assetId}', summary: 'Update asset metadata, tags, risk, ownership, maintenance, and twin links', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:activate', summary: 'Activate an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:deactivate', summary: 'Deactivate an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:archive', summary: 'Archive an asset', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:assign', summary: 'Assign an asset to an operator or team', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:inspect', summary: 'Record inspection and maintenance status', scopes: ['assets:write'] },
  { method: 'POST', path: '/{assetId}:approve', summary: 'Approve an asset lifecycle or risk policy decision', scopes: ['assets:approve'] },
] }; }
