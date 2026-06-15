import type { NexusOperationalActorType } from '@trackmind/shared';
import { ImmutableAuditLog, type EvidenceReference } from './auditLog.js';
import type { ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';

export type ArtifactRegistryEventType = 'artifact.registry.registered' | 'artifact.registry.metadata-updated';
export type ArtifactActorType = NexusOperationalActorType;

export interface ArtifactRegistryPrincipal {
  id: string;
  scopes: string[];
  tenantId?: string;
  racetrackId?: string;
  actorType?: ArtifactActorType;
  roles?: string[];
}

export interface ArtifactLineage {
  parentArtifactIds: string[];
  sourceEventIds: string[];
  sourceAuditIds: string[];
  relatedTwinIds: string[];
  derivedFrom?: string;
  relationships?: Array<{ artifactId: string; relationship: string; timestamp?: string }>;
}

export interface ArtifactSource {
  system: string;
  id?: string;
  type?: string;
  uri?: string;
  eventId?: string;
  auditRef?: string;
  metadata?: Record<string, unknown>;
}

export interface UniversalArtifactEvidenceRef extends EvidenceReference {
  id: string;
}

export interface ArtifactStorageRef {
  id: string;
  uri: string;
  provider?: string;
  bucket?: string;
  key?: string;
  contentType?: string;
  hash?: string;
  region?: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactUpdateHistoryEntry {
  updatedAt: string;
  updatedBy: string;
  reason?: string;
  metadataKeys: string[];
  evidenceIds: string[];
  storageRefIds: string[];
  auditRef?: string;
  eventRef?: string;
}

export interface UniversalArtifactEntry {
  artifactId: string;
  artifactType: string;
  schemaVersion: string;
  owner: string;
  tenantId: string;
  racetrackId: string;
  createdAt: string;
  updatedAt: string;
  lineage: ArtifactLineage;
  source: ArtifactSource;
  evidence: UniversalArtifactEvidenceRef[];
  storageRefs: ArtifactStorageRef[];
  metadata: Record<string, unknown>;
  version: number;
  auditRefs: string[];
  eventRefs: string[];
  updateHistory: ArtifactUpdateHistoryEntry[];
}

export type ArtifactRegisterInput =
  Omit<UniversalArtifactEntry, 'tenantId' | 'racetrackId' | 'createdAt' | 'updatedAt' | 'lineage' | 'evidence' | 'storageRefs' | 'metadata' | 'version' | 'auditRefs' | 'eventRefs' | 'updateHistory'>
  & Partial<Pick<UniversalArtifactEntry, 'tenantId' | 'racetrackId' | 'createdAt' | 'updatedAt' | 'lineage' | 'evidence' | 'storageRefs' | 'metadata'>>;

export interface ArtifactMetadataUpdateInput {
  metadata?: Record<string, unknown>;
  evidence?: UniversalArtifactEvidenceRef[];
  storageRefs?: ArtifactStorageRef[];
  lineage?: Partial<ArtifactLineage>;
}

export interface ArtifactQuery {
  tenantId?: string;
  racetrackId?: string;
  artifactId?: string;
  artifactIds?: string[];
  artifactType?: string;
  schemaVersion?: string;
  owner?: string;
  source?: string;
  sourceSystem?: string;
  sourceId?: string;
  q?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'artifactId' | 'artifactType' | 'owner' | 'source' | 'updatedAt';
}

export interface ArtifactQueryResult {
  total: number;
  artifacts: UniversalArtifactEntry[];
}

export interface ArtifactRepository {
  save(artifact: UniversalArtifactEntry): UniversalArtifactEntry;
  get(tenantId: string, artifactId: string): UniversalArtifactEntry | undefined;
  findByArtifactId(artifactId: string): UniversalArtifactEntry | undefined;
  all(): UniversalArtifactEntry[];
}

export interface ArtifactRegistryLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface ArtifactCommandOptions {
  reason?: string;
  correlationId?: string;
  actorType?: ArtifactActorType;
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const registryEventTypes: ArtifactRegistryEventType[] = ['artifact.registry.registered', 'artifact.registry.metadata-updated'];
const eventActorType = (actorType: ArtifactActorType | undefined): 'human' | 'service' | 'ai-agent' | 'system' => {
  if (actorType === 'human' || actorType === 'ai-agent' || actorType === 'system') return actorType;
  return 'service';
};

export class InMemoryArtifactRepository implements ArtifactRepository {
  private readonly artifacts = new Map<string, UniversalArtifactEntry>();

  save(artifact: UniversalArtifactEntry): UniversalArtifactEntry {
    this.artifacts.set(this.key(artifact.tenantId, artifact.artifactId), clone(artifact));
    return clone(artifact);
  }

  get(tenantId: string, artifactId: string): UniversalArtifactEntry | undefined {
    const artifact = this.artifacts.get(this.key(tenantId, artifactId));
    return artifact ? clone(artifact) : undefined;
  }

  findByArtifactId(artifactId: string): UniversalArtifactEntry | undefined {
    const artifact = [...this.artifacts.values()].find((item) => item.artifactId === artifactId);
    return artifact ? clone(artifact) : undefined;
  }

  all(): UniversalArtifactEntry[] {
    return [...this.artifacts.values()].map(clone);
  }

  private key(tenantId: string, artifactId: string): string {
    return `${tenantId}::${artifactId}`;
  }
}

export class UniversalArtifactRegistryService {
  readonly repository: ArtifactRepository;
  readonly eventBus: UniversalEventBus;
  readonly auditLog: ImmutableAuditLog;
  readonly logger: ArtifactRegistryLogger;

  constructor(options: { repository?: ArtifactRepository; eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; logger?: ArtifactRegistryLogger } = {}) {
    this.repository = options.repository ?? new InMemoryArtifactRepository();
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.logger = options.logger ?? { info: () => undefined };
    this.registerEventSchemas();
  }

  async register(input: ArtifactRegisterInput, principal: ArtifactRegistryPrincipal, options: ArtifactCommandOptions = {}): Promise<UniversalArtifactEntry> {
    this.authorize(principal, 'artifacts:write');
    const tenantId = this.requireTenant(principal, input.tenantId);
    const racetrackId = this.requireRacetrack(principal, input.racetrackId);
    if (this.repository.get(tenantId, input.artifactId)) throw new Error('artifactId must be unique within tenant');
    const now = input.createdAt ?? new Date().toISOString();
    const artifact = this.normalize({ ...input, tenantId, racetrackId, createdAt: now, updatedAt: input.updatedAt ?? now, version: 1, auditRefs: [], eventRefs: [], updateHistory: [] });
    return this.persist(artifact, principal, 'artifact.registry.registered', options);
  }

  get(artifactId: string, principal: ArtifactRegistryPrincipal): UniversalArtifactEntry {
    this.authorize(principal, 'artifacts:read');
    const tenantId = this.requireTenant(principal);
    const artifact = this.repository.get(tenantId, artifactId);
    if (!artifact) {
      const crossTenant = this.repository.findByArtifactId(artifactId);
      if (crossTenant && crossTenant.tenantId !== tenantId) throw new Error('tenant isolation violation');
      throw new Error(`artifact not found: ${artifactId}`);
    }
    this.assertRacetrackAccess(artifact, principal);
    return artifact;
  }

  query(query: ArtifactQuery, principal: ArtifactRegistryPrincipal): ArtifactQueryResult {
    this.authorize(principal, 'artifacts:read');
    const tenantId = this.requireTenant(principal, query.tenantId);
    const racetrackId = query.racetrackId ? this.requireRacetrack(principal, query.racetrackId) : principal.racetrackId;
    let artifacts = this.repository.all().filter((artifact) => matches(artifact, { ...query, tenantId, racetrackId }));
    if (query.sortBy) artifacts = sortArtifacts(artifacts, query.sortBy);
    const total = artifacts.length;
    const offset = query.offset ?? 0;
    return { total, artifacts: artifacts.slice(offset, offset + (query.limit ?? 100)).map(clone) };
  }

  async updateMetadata(artifactId: string, update: ArtifactMetadataUpdateInput, principal: ArtifactRegistryPrincipal, options: ArtifactCommandOptions = {}): Promise<UniversalArtifactEntry> {
    this.authorize(principal, 'artifacts:write');
    assertMetadataOnly(update);
    const current = this.get(artifactId, { ...principal, scopes: [...new Set([...principal.scopes, 'artifacts:read'])] });
    const now = new Date().toISOString();
    const evidence = mergeById(current.evidence, update.evidence ?? []);
    const storageRefs = mergeById(current.storageRefs, update.storageRefs ?? []);
    const lineage = mergeLineage(current.lineage, update.lineage);
    const historyEntry: ArtifactUpdateHistoryEntry = {
      updatedAt: now,
      updatedBy: principal.id,
      reason: options.reason,
      metadataKeys: Object.keys(update.metadata ?? {}),
      evidenceIds: (update.evidence ?? []).map((item) => item.id),
      storageRefIds: (update.storageRefs ?? []).map((item) => item.id),
    };
    const next = this.normalize({
      ...current,
      metadata: { ...current.metadata, ...(update.metadata ?? {}) },
      evidence,
      storageRefs,
      lineage,
      updatedAt: now,
      version: current.version + 1,
      updateHistory: [...current.updateHistory, historyEntry],
    });
    return this.persist(next, principal, 'artifact.registry.metadata-updated', options);
  }

  apiDefinition(): ApiServiceDefinition {
    return universalArtifactRegistryApiDefinition();
  }

  private normalize(input: ArtifactRegisterInput & Partial<UniversalArtifactEntry> & { tenantId: string; racetrackId: string; createdAt: string; updatedAt: string; version: number }): UniversalArtifactEntry {
    if (!input.artifactId || !/^[A-Z0-9][A-Z0-9._:-]{2,}$/i.test(input.artifactId)) throw new Error('artifactId is required and must be stable');
    if (!input.artifactType) throw new Error('artifactType is required');
    if (!input.schemaVersion) throw new Error('schemaVersion is required');
    if (!input.owner) throw new Error('owner is required');
    if (!input.tenantId) throw new Error('tenantId is required');
    if (!input.racetrackId) throw new Error('racetrackId is required');
    if (!input.source?.system) throw new Error('source.system is required');
    return {
      artifactId: input.artifactId,
      artifactType: input.artifactType,
      schemaVersion: input.schemaVersion,
      owner: input.owner,
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      lineage: normalizeLineage(input.lineage),
      source: { ...input.source, metadata: { ...(input.source.metadata ?? {}) } },
      evidence: mergeById([], input.evidence ?? []),
      storageRefs: mergeById([], input.storageRefs ?? []),
      metadata: { ...(input.metadata ?? {}) },
      version: input.version,
      auditRefs: [...new Set(input.auditRefs ?? [])],
      eventRefs: [...new Set(input.eventRefs ?? [])],
      updateHistory: (input.updateHistory ?? []).map((entry) => ({ ...entry, metadataKeys: [...entry.metadataKeys], evidenceIds: [...entry.evidenceIds], storageRefIds: [...entry.storageRefIds] })),
    };
  }

  private async persist(artifact: UniversalArtifactEntry, principal: ArtifactRegistryPrincipal, eventType: ArtifactRegistryEventType, options: ArtifactCommandOptions): Promise<UniversalArtifactEntry> {
    this.logger.info('universal artifact registry event', { type: eventType, artifactId: artifact.artifactId, tenantId: artifact.tenantId, principalId: principal.id });
    const audit = this.auditLog.append({
      id: id('audit-artifact'),
      type: 'data-change',
      actor: principal.id,
      actorType: options.actorType ?? principal.actorType ?? 'service',
      timestamp: new Date().toISOString(),
      action: eventType,
      actionClass: 'service',
      sourceService: 'universal-artifact-registry',
      subjectId: artifact.artifactId,
      tenantId: artifact.tenantId,
      correlationId: options.correlationId,
      severity: 'info',
      payload: { type: eventType, artifactId: artifact.artifactId, artifactType: artifact.artifactType, schemaVersion: artifact.schemaVersion, owner: artifact.owner, reason: options.reason },
      evidenceIds: artifact.evidence.map((item) => item.id),
      evidence: artifact.evidence.map(toAuditEvidence),
    });
    let saved = this.repository.save(applyLatestRefs(artifact, audit.id));
    const event = await this.emit(saved, principal, eventType, audit.id, options);
    saved = applyLatestRefs(saved, audit.id, event.id);
    saved = withLatestHistoryRefs(saved, audit.id, event.id);
    return this.repository.save(saved);
  }

  private async emit(artifact: UniversalArtifactEntry, principal: ArtifactRegistryPrincipal, eventType: ArtifactRegistryEventType, auditRef: string, options: ArtifactCommandOptions): Promise<RaceDayEvent> {
    return this.eventBus.publish({
      type: eventType,
      payload: { artifact: clone(artifact), actor: principal.id, tenantId: artifact.tenantId, action: eventType },
      aggregateId: artifact.artifactId,
      producer: 'universal-artifact-registry',
      tenantId: artifact.tenantId,
      racetrackId: artifact.racetrackId,
      correlationId: options.correlationId,
      auditRef,
      actor: { id: principal.id, type: eventActorType(options.actorType ?? principal.actorType) },
      subject: { id: artifact.artifactId, type: 'artifact', tenantId: artifact.tenantId },
      evidence: artifact.evidence.map((item) => item.id),
      metadata: { tenantId: artifact.tenantId, racetrackId: artifact.racetrackId, team: 'platform-data', accountableRole: 'artifact-registry-owner', compliance: 'internal' },
    });
  }

  private registerEventSchemas(): void {
    registryEventTypes.forEach((type) => this.eventBus.registerEvent({
      type,
      version: 1,
      description: `Universal artifact registry ${type.replace('artifact.registry.', '')} event`,
      owner: { service: 'universal-artifact-registry', team: 'platform-data', accountableRole: 'artifact-registry-owner' },
      payloadFields: ['artifact', 'actor', 'tenantId', 'action'],
      compliance: 'internal',
    }));
  }

  private authorize(principal: ArtifactRegistryPrincipal, scope: string): void {
    if (!principal.id) throw new Error('authentication required');
    if (!principal.scopes.includes(scope)) throw new Error(`missing scope: ${scope}`);
  }

  private requireTenant(principal: ArtifactRegistryPrincipal, requestedTenantId?: string): string {
    if (!principal.tenantId) throw new Error('tenantId is required for artifact registry access');
    if (requestedTenantId && requestedTenantId !== principal.tenantId) throw new Error('tenant isolation violation');
    return principal.tenantId;
  }

  private requireRacetrack(principal: ArtifactRegistryPrincipal, requestedRacetrackId?: string): string {
    const racetrackId = requestedRacetrackId ?? principal.racetrackId;
    if (!racetrackId) throw new Error('racetrackId is required for artifact registry access');
    if (principal.racetrackId && racetrackId !== principal.racetrackId) throw new Error('racetrack isolation violation');
    return racetrackId;
  }

  private assertRacetrackAccess(artifact: UniversalArtifactEntry, principal: ArtifactRegistryPrincipal): void {
    if (principal.racetrackId && artifact.racetrackId !== principal.racetrackId) throw new Error('racetrack isolation violation');
  }
}

export function universalArtifactRegistryApiDefinition(): ApiServiceDefinition {
  return {
    id: 'universal-artifact-registry',
    name: 'Universal Artifact Registry',
    domain: 'platform-data',
    version: 'v1',
    basePath: '/api/v1/artifacts',
    description: 'Tenant-scoped registry for canonical TrackMind artifacts, lineage, source evidence, storage references, and audit/event references.',
    owner: { team: 'platform-data', productOwner: 'TrackMind Nexus Platform Owner', technicalOwner: 'Artifact Registry Service Owner', supportChannel: '#trackmind-platform' },
    lifecycle: 'active',
    auth: ['jwt', 'oauth2', 'mtls'],
    rateLimit: { requests: 600, perSeconds: 60, burst: 100 },
    tags: ['artifacts', 'lineage', 'evidence', 'audit', 'events', 'tenant-isolation'],
    slo: { availability: 99.95, latencyMs: 200 },
    endpoints: [
      { method: 'POST', path: '/', summary: 'Register a canonical artifact', scopes: ['artifacts:write'] },
      { method: 'GET', path: '/{artifactId}', summary: 'Get a canonical artifact by identifier', scopes: ['artifacts:read'] },
      { method: 'GET', path: '/', summary: 'Query artifacts by tenant, type, owner, source, and lineage metadata', scopes: ['artifacts:read'] },
      { method: 'PATCH', path: '/{artifactId}/metadata', summary: 'Update mutable artifact metadata and supporting references', scopes: ['artifacts:write'] },
    ],
    dependencies: [{ serviceId: 'event-bus', apiId: 'universal-event-bus', version: 'v1', criticality: 'medium' }, { serviceId: 'audit-ledger', apiId: 'immutable-audit-log', version: 'v1', criticality: 'high' }],
  };
}

function normalizeLineage(lineage?: Partial<ArtifactLineage>): ArtifactLineage {
  return {
    parentArtifactIds: [...new Set(lineage?.parentArtifactIds ?? [])],
    sourceEventIds: [...new Set(lineage?.sourceEventIds ?? [])],
    sourceAuditIds: [...new Set(lineage?.sourceAuditIds ?? [])],
    relatedTwinIds: [...new Set(lineage?.relatedTwinIds ?? [])],
    derivedFrom: lineage?.derivedFrom,
    relationships: (lineage?.relationships ?? []).map((item) => ({ ...item })),
  };
}

function mergeLineage(current: ArtifactLineage, patch?: Partial<ArtifactLineage>): ArtifactLineage {
  if (!patch) return normalizeLineage(current);
  return {
    parentArtifactIds: [...new Set([...current.parentArtifactIds, ...(patch.parentArtifactIds ?? [])])],
    sourceEventIds: [...new Set([...current.sourceEventIds, ...(patch.sourceEventIds ?? [])])],
    sourceAuditIds: [...new Set([...current.sourceAuditIds, ...(patch.sourceAuditIds ?? [])])],
    relatedTwinIds: [...new Set([...current.relatedTwinIds, ...(patch.relatedTwinIds ?? [])])],
    derivedFrom: patch.derivedFrom ?? current.derivedFrom,
    relationships: [...(current.relationships ?? []), ...(patch.relationships ?? [])].map((item) => ({ ...item })),
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  [...current, ...incoming].forEach((item) => byId.set(item.id, clone(item)));
  return [...byId.values()];
}

function applyLatestRefs(artifact: UniversalArtifactEntry, auditRef?: string, eventRef?: string): UniversalArtifactEntry {
  return {
    ...artifact,
    auditRefs: [...new Set([...artifact.auditRefs, ...(auditRef ? [auditRef] : [])])],
    eventRefs: [...new Set([...artifact.eventRefs, ...(eventRef ? [eventRef] : [])])],
  };
}

function withLatestHistoryRefs(artifact: UniversalArtifactEntry, auditRef: string, eventRef: string): UniversalArtifactEntry {
  if (artifact.updateHistory.length === 0) return artifact;
  const updateHistory = artifact.updateHistory.map((entry, index) => index === artifact.updateHistory.length - 1 ? { ...entry, auditRef, eventRef } : { ...entry });
  return { ...artifact, updateHistory };
}

function toAuditEvidence(evidence: UniversalArtifactEvidenceRef): EvidenceReference {
  return { ...evidence };
}

function sourceText(source: ArtifactSource): string {
  return [source.system, source.id, source.type, source.uri, source.eventId, source.auditRef].filter(Boolean).join(' ').toLowerCase();
}

function matches(artifact: UniversalArtifactEntry, query: ArtifactQuery): boolean {
  const text = `${artifact.artifactId} ${artifact.artifactType} ${artifact.schemaVersion} ${artifact.owner} ${sourceText(artifact.source)} ${artifact.lineage.parentArtifactIds.join(' ')} ${artifact.lineage.sourceEventIds.join(' ')} ${artifact.lineage.sourceAuditIds.join(' ')} ${artifact.lineage.relatedTwinIds.join(' ')} ${JSON.stringify(artifact.metadata)}`.toLowerCase();
  return (!query.tenantId || artifact.tenantId === query.tenantId)
    && (!query.racetrackId || artifact.racetrackId === query.racetrackId)
    && (!query.artifactId || artifact.artifactId === query.artifactId)
    && (!query.artifactIds || query.artifactIds.includes(artifact.artifactId))
    && (!query.artifactType || artifact.artifactType === query.artifactType)
    && (!query.schemaVersion || artifact.schemaVersion === query.schemaVersion)
    && (!query.owner || artifact.owner === query.owner)
    && (!query.source || sourceText(artifact.source).includes(query.source.toLowerCase()))
    && (!query.sourceSystem || artifact.source.system === query.sourceSystem)
    && (!query.sourceId || artifact.source.id === query.sourceId)
    && (!query.q || text.includes(query.q.toLowerCase()))
    && (!query.updatedAfter || artifact.updatedAt >= query.updatedAfter)
    && (!query.updatedBefore || artifact.updatedAt <= query.updatedBefore);
}

function sortArtifacts(artifacts: UniversalArtifactEntry[], sortBy: NonNullable<ArtifactQuery['sortBy']>): UniversalArtifactEntry[] {
  return [...artifacts].sort((a, b) => {
    const left = sortBy === 'source' ? a.source.system : String(a[sortBy]);
    const right = sortBy === 'source' ? b.source.system : String(b[sortBy]);
    return left.localeCompare(right);
  });
}

function assertMetadataOnly(update: ArtifactMetadataUpdateInput): void {
  const immutableFields = ['artifactId', 'artifactType', 'schemaVersion', 'owner', 'tenantId', 'racetrackId', 'createdAt', 'updatedAt', 'source'];
  for (const field of immutableFields) if (field in update) throw new Error(`immutable artifact field cannot be updated: ${field}`);
}
