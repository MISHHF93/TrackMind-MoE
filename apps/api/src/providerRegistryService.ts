import { ImmutableAuditLog, type AuditSeverity } from './auditLog.js';
import { type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';

export type ProviderLicenseStatus = 'licensed' | 'trial' | 'evaluation' | 'pending-review' | 'expired' | 'suspended' | 'unlicensed';
export type ProviderConnectionType = 'official-api' | 'vendor-feed' | 'sftp' | 'webhook' | 'manual-upload' | 'partner-share' | 'data-clean-room';
export type ProviderSyncMode = 'manual' | 'scheduled' | 'webhook' | 'streaming' | 'on-demand';
export type ProviderOperationalStatus = 'configured' | 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
export type ProviderDataClass = 'entries' | 'results' | 'odds' | 'wagering' | 'video' | 'telemetry' | 'weather' | 'surface' | 'equine-health' | 'personnel' | 'regulatory' | 'financial' | 'facility' | (string & {});
export type ProviderRegistryEventType = 'provider.registry.registered' | 'provider.registry.status-updated';

export interface ProviderPrincipal { id: string; tenantId?: string; racetrackId?: string; scopes: string[] }
export interface ProviderLicenseTerms {
  licenseStatus: ProviderLicenseStatus;
  commercialUseAllowed: boolean;
  attributionRequired: boolean;
  redistributionAllowed: boolean;
  piiPresent: boolean;
  allowedUses: string[];
  restrictedUses: string[];
  retentionDays: number;
  rightsHolder?: string;
  attributionText?: string;
  licenseRef?: string;
  expiresAt?: string;
}
export interface ProviderConnectionMetadata {
  connectionType: ProviderConnectionType;
  endpoint?: string;
  authRef?: string;
  format?: string;
  region?: string;
  metadata: Record<string, unknown>;
}
export interface ProviderHealthStatus {
  status: ProviderOperationalStatus;
  checkedAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncAttemptAt?: string;
  latencyMs?: number;
  message?: string;
  errorCode?: string;
}
export interface ProviderUsageControls {
  commercialUseAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  piiPresent: boolean;
  retentionDays: number;
  flags: Array<'commercial-use-restricted' | 'redistribution-restricted' | 'attribution-required' | 'pii-present' | 'retention-required'>;
}
export interface ProviderRegistryRecord {
  providerId: string;
  tenantId: string;
  racetrackId: string;
  displayName: string;
  providerName: string;
  description?: string;
  dataClasses: ProviderDataClass[];
  connection: ProviderConnectionMetadata;
  syncMode: ProviderSyncMode;
  refreshIntervalSeconds?: number;
  license: ProviderLicenseTerms;
  usageControls: ProviderUsageControls;
  status: ProviderHealthStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: Record<string, unknown>;
}
export type ProviderRegistrationInput =
  Omit<ProviderRegistryRecord, 'tenantId' | 'racetrackId' | 'status' | 'usageControls' | 'createdAt' | 'updatedAt' | 'tags' | 'metadata'>
  & Partial<Pick<ProviderRegistryRecord, 'tenantId' | 'racetrackId' | 'status' | 'tags' | 'metadata'>>;
export interface ProviderQuery {
  tenantId?: string;
  racetrackId?: string;
  providerId?: string;
  dataClass?: ProviderDataClass;
  dataClassesAll?: ProviderDataClass[];
  licenseStatus?: ProviderLicenseStatus;
  connectionType?: ProviderConnectionType;
  syncMode?: ProviderSyncMode;
  status?: ProviderOperationalStatus;
  piiPresent?: boolean;
  redistributionAllowed?: boolean;
  commercialUseAllowed?: boolean;
  tag?: string;
}
export interface ProviderListResult { total: number; providers: ProviderRegistryRecord[] }
export interface ProviderRegistrySnapshot { schemaVersion: 'trackmind.provider-registry.v1'; generatedAt: string; tenantId: string; racetrackId: string; providers: ProviderRegistryRecord[] }

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const licensedStatuses: ProviderLicenseStatus[] = ['licensed', 'trial', 'evaluation'];
const eventTypes: ProviderRegistryEventType[] = ['provider.registry.registered', 'provider.registry.status-updated'];
const forbiddenConnectionTypes = new Set(['scrape', 'scraping', 'screen-scrape', 'crawler']);
const secretKeyPattern = /(password|secret|token|api[-_]?key|credential)/i;

export class ProviderRegistryService {
  private readonly providers = new Map<string, ProviderRegistryRecord>();
  readonly eventBus: UniversalEventBus;
  readonly auditLog: ImmutableAuditLog;

  constructor(private readonly options: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog } = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.registerEventSchemas();
  }

  async register(input: ProviderRegistrationInput, principal: ProviderPrincipal, now = new Date().toISOString()): Promise<ProviderRegistryRecord> {
    this.authorize(principal, 'providers:write');
    const tenantId = this.requireTenant(principal, input.tenantId);
    const racetrackId = this.requireRacetrack(principal, input.racetrackId);
    const provider = this.normalize({ ...input, tenantId, racetrackId, createdAt: now, updatedAt: now });
    const key = this.key(tenantId, racetrackId, provider.providerId);
    if (this.providers.has(key)) throw new Error(`provider already registered for tenant and racetrack: ${provider.providerId}`);
    this.providers.set(key, clone(provider));
    await this.emit(provider, principal, 'provider.registry.registered', now);
    return clone(provider);
  }

  get(providerId: string, principal: ProviderPrincipal, query: Pick<ProviderQuery, 'tenantId' | 'racetrackId'> = {}): ProviderRegistryRecord {
    this.authorize(principal, 'providers:read');
    const tenantId = this.requireTenant(principal, query.tenantId);
    const racetrackId = this.requireRacetrack(principal, query.racetrackId);
    const provider = this.providers.get(this.key(tenantId, racetrackId, providerId));
    if (!provider) throw new Error(`provider not found: ${providerId}`);
    return clone(provider);
  }

  getStatus(providerId: string, principal: ProviderPrincipal, query: Pick<ProviderQuery, 'tenantId' | 'racetrackId'> = {}): ProviderHealthStatus {
    return clone(this.get(providerId, principal, query).status);
  }

  list(query: ProviderQuery, principal: ProviderPrincipal): ProviderListResult {
    this.authorize(principal, 'providers:read');
    const tenantId = this.requireTenant(principal, query.tenantId);
    const racetrackId = this.requireRacetrack(principal, query.racetrackId);
    const scopedQuery = { ...query, tenantId, racetrackId };
    const providers = [...this.providers.values()].filter((provider) => matches(provider, scopedQuery)).map(clone);
    return { total: providers.length, providers };
  }

  async updateStatus(providerId: string, status: ProviderHealthStatus, principal: ProviderPrincipal, now = new Date().toISOString(), query: Pick<ProviderQuery, 'tenantId' | 'racetrackId'> = {}): Promise<ProviderRegistryRecord> {
    this.authorizeAny(principal, ['providers:status', 'providers:write']);
    const current = this.get(providerId, { ...principal, scopes: [...new Set([...principal.scopes, 'providers:read'])] }, query);
    const next = this.normalize({ ...current, status: this.normalizeStatus(status, now), updatedAt: now });
    this.providers.set(this.key(next.tenantId, next.racetrackId, next.providerId), clone(next));
    await this.emit(next, principal, 'provider.registry.status-updated', now);
    return clone(next);
  }

  serialize(query: ProviderQuery, principal: ProviderPrincipal, generatedAt = new Date().toISOString()): ProviderRegistrySnapshot {
    const tenantId = this.requireTenant(principal, query.tenantId);
    const racetrackId = this.requireRacetrack(principal, query.racetrackId);
    return { schemaVersion: 'trackmind.provider-registry.v1', generatedAt, tenantId, racetrackId, providers: this.list({ ...query, tenantId, racetrackId }, principal).providers };
  }

  apiDefinition(): ApiServiceDefinition { return providerRegistryApiDefinition(); }

  private normalize(input: ProviderRegistrationInput & { tenantId: string; racetrackId: string; createdAt: string; updatedAt: string }): ProviderRegistryRecord {
    if (!input.providerId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,}$/.test(input.providerId)) throw new Error('providerId is required and must be stable');
    if (!input.displayName) throw new Error('provider displayName is required');
    if (!input.providerName) throw new Error('providerName is required');
    if (!input.dataClasses?.length) throw new Error('provider dataClasses are required');
    const license = this.normalizeLicense(input.license);
    const connection = this.normalizeConnection(input.connection);
    if (input.syncMode === 'scheduled' && !input.refreshIntervalSeconds) throw new Error('scheduled providers require refreshIntervalSeconds');
    if (input.refreshIntervalSeconds !== undefined && (!Number.isInteger(input.refreshIntervalSeconds) || input.refreshIntervalSeconds <= 0)) throw new Error('refreshIntervalSeconds must be a positive integer');
    return {
      ...clone(input),
      providerId: input.providerId,
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
      dataClasses: [...new Set(input.dataClasses)],
      connection,
      license,
      usageControls: usageControlsFor(license),
      status: this.normalizeStatus(input.status ?? { status: 'configured' }, input.updatedAt),
      tags: [...new Set((input.tags ?? []).map((tag) => tag.toLowerCase()))],
      metadata: { ...(input.metadata ?? {}) },
    };
  }

  private normalizeLicense(license: ProviderLicenseTerms): ProviderLicenseTerms {
    if (!license) throw new Error('provider license terms are required');
    if (!licensedStatuses.includes(license.licenseStatus)) throw new Error(`provider licenseStatus must be one of: ${licensedStatuses.join(', ')}`);
    for (const field of ['commercialUseAllowed', 'attributionRequired', 'redistributionAllowed', 'piiPresent'] as const) if (typeof license[field] !== 'boolean') throw new Error(`license.${field} is required`);
    if (!Array.isArray(license.allowedUses) || license.allowedUses.length === 0) throw new Error('license.allowedUses must include at least one permitted use');
    if (!Array.isArray(license.restrictedUses)) throw new Error('license.restrictedUses is required');
    if (!Number.isInteger(license.retentionDays) || license.retentionDays <= 0) throw new Error('license.retentionDays must be a positive integer');
    return { ...clone(license), allowedUses: [...new Set(license.allowedUses)], restrictedUses: [...new Set(license.restrictedUses)] };
  }

  private normalizeConnection(connection: ProviderConnectionMetadata): ProviderConnectionMetadata {
    if (!connection?.connectionType) throw new Error('connection.connectionType is required');
    if (forbiddenConnectionTypes.has(String(connection.connectionType))) throw new Error('scraping connection types are not allowed in provider registry');
    if (connection.metadata && Object.keys(connection.metadata).some((key) => secretKeyPattern.test(key))) throw new Error('connection metadata must reference secrets via authRef, not store credentials');
    return { ...clone(connection), metadata: { ...(connection.metadata ?? {}) } };
  }

  private normalizeStatus(status: ProviderHealthStatus, now: string): ProviderHealthStatus {
    if (!['configured', 'healthy', 'degraded', 'unhealthy', 'disabled'].includes(status.status)) throw new Error('provider status is invalid');
    if (status.latencyMs !== undefined && status.latencyMs < 0) throw new Error('status.latencyMs must be non-negative');
    return { ...clone(status), checkedAt: status.checkedAt ?? now };
  }

  private async emit(provider: ProviderRegistryRecord, principal: ProviderPrincipal, type: ProviderRegistryEventType, now: string): Promise<RaceDayEvent> {
    const severity: AuditSeverity = provider.usageControls.flags.includes('pii-present') || provider.usageControls.flags.includes('redistribution-restricted') ? 'warning' : 'info';
    const audit = this.auditLog.append({ id: id('audit'), type: 'configuration-change', actor: principal.id, actorType: 'service', timestamp: now, action: type, sourceService: 'provider-registry', payload: { type, providerId: provider.providerId, connectionType: provider.connection.connectionType, syncMode: provider.syncMode, license: provider.license, usageControls: provider.usageControls }, subjectId: provider.providerId, tenantId: provider.tenantId, severity, regulations: ['provider-license'] });
    return this.eventBus.publish({ type, payload: { provider: clone(provider), actor: principal.id, tenantId: provider.tenantId, racetrackId: provider.racetrackId, auditRef: audit.id }, tenantId: provider.tenantId, racetrackId: provider.racetrackId, aggregateId: provider.providerId, correlationId: audit.id, auditRef: audit.id, evidence: ['provider-license', audit.id], producer: 'provider-registry', actor: { id: principal.id, type: 'service' }, subject: { id: provider.providerId, type: 'provider', tenantId: provider.tenantId }, metadata: { team: 'data-platform', licenseStatus: provider.license.licenseStatus, usageFlags: provider.usageControls.flags } });
  }

  private registerEventSchemas(): void {
    for (const type of eventTypes) {
      this.eventBus.registerEvent({ type, version: 1, description: `Provider registry ${type.replace('provider.registry.', '')} event`, owner: { service: 'provider-registry', team: 'data-platform', accountableRole: 'Provider Registry Owner' }, payloadFields: ['provider', 'actor', 'tenantId', 'racetrackId', 'auditRef'], compliance: 'regulated', standards: { tenantScoped: true, racetrackScoped: true, correlationRequired: true, auditRequired: true, replayable: true, requiredMetadata: ['tenantId', 'racetrackId', 'correlationId', 'aggregateId', 'actor', 'subject', 'auditRef', 'evidence'] } });
    }
  }

  private key(tenantId: string, racetrackId: string, providerId: string): string { return `${tenantId}:${racetrackId}:${providerId}`; }
  private authorize(principal: ProviderPrincipal, scope: string): void { if (!principal.id) throw new Error('authentication required'); if (!principal.scopes.includes(scope)) throw new Error(`missing scope: ${scope}`); }
  private authorizeAny(principal: ProviderPrincipal, scopes: string[]): void { if (!principal.id) throw new Error('authentication required'); if (!scopes.some((scope) => principal.scopes.includes(scope))) throw new Error(`missing scope: ${scopes.join(' or ')}`); }
  private requireTenant(principal: ProviderPrincipal, requestedTenantId?: string): string { if (!principal.tenantId) throw new Error('tenantId is required for provider registry access'); if (requestedTenantId && requestedTenantId !== principal.tenantId) throw new Error('tenant isolation violation'); return principal.tenantId; }
  private requireRacetrack(principal: ProviderPrincipal, requestedRacetrackId?: string): string { const racetrackId = requestedRacetrackId ?? principal.racetrackId; if (!racetrackId) throw new Error('racetrackId is required for provider registry access'); if (principal.racetrackId && requestedRacetrackId && requestedRacetrackId !== principal.racetrackId) throw new Error('racetrack isolation violation'); return racetrackId; }
}

function usageControlsFor(license: ProviderLicenseTerms): ProviderUsageControls {
  const flags: ProviderUsageControls['flags'] = [];
  if (!license.commercialUseAllowed) flags.push('commercial-use-restricted');
  if (!license.redistributionAllowed) flags.push('redistribution-restricted');
  if (license.attributionRequired) flags.push('attribution-required');
  if (license.piiPresent) flags.push('pii-present');
  if (license.retentionDays > 0) flags.push('retention-required');
  return { commercialUseAllowed: license.commercialUseAllowed, redistributionAllowed: license.redistributionAllowed, attributionRequired: license.attributionRequired, piiPresent: license.piiPresent, retentionDays: license.retentionDays, flags };
}

function matches(provider: ProviderRegistryRecord, query: ProviderQuery): boolean {
  return (!query.tenantId || provider.tenantId === query.tenantId)
    && (!query.racetrackId || provider.racetrackId === query.racetrackId)
    && (!query.providerId || provider.providerId === query.providerId)
    && (!query.dataClass || provider.dataClasses.includes(query.dataClass))
    && (!query.dataClassesAll || query.dataClassesAll.every((dataClass) => provider.dataClasses.includes(dataClass)))
    && (!query.licenseStatus || provider.license.licenseStatus === query.licenseStatus)
    && (!query.connectionType || provider.connection.connectionType === query.connectionType)
    && (!query.syncMode || provider.syncMode === query.syncMode)
    && (!query.status || provider.status.status === query.status)
    && (query.piiPresent === undefined || provider.license.piiPresent === query.piiPresent)
    && (query.redistributionAllowed === undefined || provider.license.redistributionAllowed === query.redistributionAllowed)
    && (query.commercialUseAllowed === undefined || provider.license.commercialUseAllowed === query.commercialUseAllowed)
    && (!query.tag || provider.tags.includes(query.tag.toLowerCase()));
}

export function providerRegistryApiDefinition(): ApiServiceDefinition {
  return {
    id: 'provider-registry',
    name: 'Provider Registry',
    domain: 'data-platform',
    version: 'v1',
    basePath: '/api/v1/providers',
    description: 'Tenant- and racetrack-scoped registry for licensed data provider configurations, connection metadata, license terms, usage restrictions, health status, and serialization snapshots. The registry stores provider metadata only and does not authorize scraping or redistribution by default.',
    owner: { team: 'data-platform', productOwner: 'Director of Data Partnerships', technicalOwner: 'Provider Registry Service Owner', supportChannel: '#trackmind-data-platform' },
    lifecycle: 'active',
    auth: ['jwt', 'oauth2', 'mtls'],
    rateLimit: { requests: 600, perSeconds: 60, burst: 100 },
    tags: ['providers', 'licensing', 'tenant-isolation', 'racetrack-isolation', 'audit'],
    slo: { availability: 99.9, latencyMs: 250 },
    endpoints: [
      { method: 'POST', path: '/', summary: 'Register licensed provider configuration metadata', scopes: ['providers:write'] },
      { method: 'GET', path: '/', summary: 'List tenant and racetrack scoped provider configurations', scopes: ['providers:read'] },
      { method: 'GET', path: '/{providerId}', summary: 'Get a provider configuration and license status', scopes: ['providers:read'] },
      { method: 'GET', path: '/{providerId}/status', summary: 'Get provider health and sync status', scopes: ['providers:read'] },
      { method: 'PATCH', path: '/{providerId}/status', summary: 'Update provider health and sync status', scopes: ['providers:status'] },
      { method: 'GET', path: '/snapshot', summary: 'Serialize a provider registry snapshot for audit and frontend reads', scopes: ['providers:read'] },
    ],
    dependencies: [{ serviceId: 'trackmind-nexus-governance', apiId: 'audit-ledger', version: 'v1', criticality: 'high' }],
  };
}
