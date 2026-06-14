import { createHash } from 'node:crypto';
import type { AuditLogEntry, ImmutableAuditLog } from './auditLog.js';
import type { RaceDayEvent, UniversalEventBus } from './eventBus.js';

export type RawProviderSourceFormat = 'json' | 'csv' | 'xml' | 'text' | 'binary' | 'manual' | (string & {});
export type ConnectorIngestionJobStatus = 'pending' | 'running' | 'validated' | 'normalized' | 'rejected' | 'completed';

export interface ProviderLicenseContext {
  licenseId?: string;
  terms?: string;
  attribution?: string;
  permittedUse?: string[];
  restrictions?: string[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderConnectorIngestInput<TPayload = unknown> {
  payload?: TPayload;
  sourceEndpoint?: string;
  sourceFormat?: RawProviderSourceFormat;
  receivedAt?: string;
  licenseContext?: ProviderLicenseContext;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  tenantId?: string;
  racetrackId?: string;
}

export interface ProviderConnectorRawPayloadDraft<TPayload = unknown> {
  originalPayload: TPayload;
  sourceFormat: RawProviderSourceFormat;
  sourceEndpoint: string;
  receivedAt?: string;
  licenseContext: ProviderLicenseContext;
  providerMetadata: Record<string, unknown>;
}

export interface RawProviderPayloadArtifact<TPayload = unknown> extends ProviderConnectorRawPayloadDraft<TPayload> {
  id: string;
  schemaVersion: 'trackmind.raw-provider-payload.v1';
  artifactType: 'raw-provider-payload';
  providerId: string;
  providerName: string;
  payloadHash: string;
  eventRefs: string[];
  auditRefs: string[];
}

export interface RawLandingCreateInput<TPayload = unknown> extends ProviderConnectorRawPayloadDraft<TPayload> {
  id?: string;
  providerId: string;
  providerName: string;
  eventRefs?: string[];
  auditRefs?: string[];
}

export interface RawLandingService {
  create<TPayload = unknown>(input: RawLandingCreateInput<TPayload>): RawProviderPayloadArtifact<TPayload>;
  recordRefs(id: string, refs: { eventRefs?: string[]; auditRefs?: string[] }): RawProviderPayloadArtifact;
  get(id: string): RawProviderPayloadArtifact | undefined;
  all(): RawProviderPayloadArtifact[];
}

export interface ProviderPayloadValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProviderConnectorAdapter<TPayload = unknown> {
  providerId: string;
  providerName: string;
  sourceFormat: RawProviderSourceFormat;
  sourceEndpoint: string;
  licenseContext: ProviderLicenseContext;
  metadata?: Record<string, unknown>;
  ingest(input?: ProviderConnectorIngestInput<TPayload>): Promise<ProviderConnectorRawPayloadDraft<TPayload>> | ProviderConnectorRawPayloadDraft<TPayload>;
  validate?(artifact: RawProviderPayloadArtifact<TPayload>): ProviderPayloadValidationResult;
}

export interface ConnectorIngestionJobTransition {
  status: ConnectorIngestionJobStatus;
  timestamp: string;
  reason?: string;
}

export interface ConnectorIngestionJob {
  id: string;
  providerId: string;
  status: ConnectorIngestionJobStatus;
  artifactId?: string;
  payloadHash?: string;
  eventRefs: string[];
  auditRefs: string[];
  transitions: ConnectorIngestionJobTransition[];
  validationErrors: string[];
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  tenantId?: string;
  racetrackId?: string;
}

export interface ConnectorRuntimeDeps {
  landingService?: RawLandingService;
  eventBus?: UniversalEventBus;
  auditLog?: ImmutableAuditLog;
  now?: () => string;
  idFactory?: (prefix: string) => string;
}

export interface ConnectorIngestionResult<TPayload = unknown> {
  job: ConnectorIngestionJob;
  artifact?: RawProviderPayloadArtifact<TPayload>;
  eventRefs: string[];
  auditRefs: string[];
}

const RAW_PROVIDER_PAYLOAD_SCHEMA_VERSION = 'trackmind.raw-provider-payload.v1';

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`)
    .join(',')}}`;
}

export function hashRawProviderPayload(payload: unknown): string {
  return `sha256:${createHash('sha256').update(stable(payload)).digest('hex')}`;
}

function defaultId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function validation(valid: boolean, errors: string[] = []): ProviderPayloadValidationResult {
  return { valid, errors };
}

function normalizeMetadata(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  return sources.reduce<Record<string, unknown>>((merged, source) => ({ ...merged, ...(source ?? {}) }), {});
}

export class InMemoryRawLandingService implements RawLandingService {
  private readonly artifacts = new Map<string, RawProviderPayloadArtifact>();

  create<TPayload = unknown>(input: RawLandingCreateInput<TPayload>): RawProviderPayloadArtifact<TPayload> {
    const artifact: RawProviderPayloadArtifact<TPayload> = {
      id: input.id ?? `raw-provider-payload-${this.artifacts.size + 1}`,
      schemaVersion: RAW_PROVIDER_PAYLOAD_SCHEMA_VERSION,
      artifactType: 'raw-provider-payload',
      providerId: input.providerId,
      providerName: input.providerName,
      originalPayload: clone(input.originalPayload),
      sourceFormat: input.sourceFormat,
      sourceEndpoint: input.sourceEndpoint,
      payloadHash: hashRawProviderPayload(input.originalPayload),
      receivedAt: input.receivedAt ?? new Date().toISOString(),
      licenseContext: clone(input.licenseContext),
      providerMetadata: clone(input.providerMetadata),
      eventRefs: [...(input.eventRefs ?? [])],
      auditRefs: [...(input.auditRefs ?? [])],
    };
    this.artifacts.set(artifact.id, clone(artifact));
    return clone(artifact);
  }

  recordRefs(id: string, refs: { eventRefs?: string[]; auditRefs?: string[] }): RawProviderPayloadArtifact {
    const artifact = this.artifacts.get(id);
    if (!artifact) throw new Error(`raw provider payload not found: ${id}`);
    artifact.eventRefs = [...new Set([...artifact.eventRefs, ...(refs.eventRefs ?? [])])];
    artifact.auditRefs = [...new Set([...artifact.auditRefs, ...(refs.auditRefs ?? [])])];
    this.artifacts.set(id, clone(artifact));
    return clone(artifact);
  }

  get(id: string): RawProviderPayloadArtifact | undefined {
    const artifact = this.artifacts.get(id);
    return artifact ? clone(artifact) : undefined;
  }

  all(): RawProviderPayloadArtifact[] {
    return [...this.artifacts.values()].map(clone);
  }
}

export class ManualPayloadConnectorAdapter<TPayload = unknown> implements ProviderConnectorAdapter<TPayload> {
  readonly providerId: string;
  readonly providerName: string;
  readonly sourceFormat: RawProviderSourceFormat;
  readonly sourceEndpoint: string;
  readonly licenseContext: ProviderLicenseContext;
  readonly metadata?: Record<string, unknown>;

  constructor(options: {
    providerId: string;
    providerName: string;
    sourceFormat?: RawProviderSourceFormat;
    sourceEndpoint?: string;
    licenseContext: ProviderLicenseContext;
    metadata?: Record<string, unknown>;
  }) {
    this.providerId = options.providerId;
    this.providerName = options.providerName;
    this.sourceFormat = options.sourceFormat ?? 'manual';
    this.sourceEndpoint = options.sourceEndpoint ?? 'manual://payload';
    this.licenseContext = clone(options.licenseContext);
    this.metadata = clone(options.metadata);
  }

  ingest(input: ProviderConnectorIngestInput<TPayload> = {}): ProviderConnectorRawPayloadDraft<TPayload> {
    if (input.payload === undefined) throw new Error(`manual payload missing for provider ${this.providerId}`);
    return {
      originalPayload: clone(input.payload),
      sourceFormat: input.sourceFormat ?? this.sourceFormat,
      sourceEndpoint: input.sourceEndpoint ?? this.sourceEndpoint,
      receivedAt: input.receivedAt,
      licenseContext: clone(input.licenseContext ?? this.licenseContext),
      providerMetadata: normalizeMetadata(this.metadata, input.metadata, { providerId: this.providerId, adapter: 'manual' }),
    };
  }

  validate(artifact: RawProviderPayloadArtifact<TPayload>): ProviderPayloadValidationResult {
    return validation(
      artifact.originalPayload !== undefined && artifact.originalPayload !== null,
      artifact.originalPayload === undefined || artifact.originalPayload === null ? ['originalPayload is required'] : [],
    );
  }
}

export class MockProviderConnectorAdapter<TPayload = unknown> implements ProviderConnectorAdapter<TPayload> {
  readonly providerId: string;
  readonly providerName: string;
  readonly sourceFormat: RawProviderSourceFormat;
  readonly sourceEndpoint: string;
  readonly licenseContext: ProviderLicenseContext;
  readonly metadata?: Record<string, unknown>;
  private readonly payload: TPayload;

  constructor(options: {
    providerId: string;
    providerName: string;
    payload: TPayload;
    sourceFormat?: RawProviderSourceFormat;
    sourceEndpoint?: string;
    licenseContext: ProviderLicenseContext;
    metadata?: Record<string, unknown>;
  }) {
    this.providerId = options.providerId;
    this.providerName = options.providerName;
    this.payload = clone(options.payload);
    this.sourceFormat = options.sourceFormat ?? 'json';
    this.sourceEndpoint = options.sourceEndpoint ?? `mock://${options.providerId}`;
    this.licenseContext = clone(options.licenseContext);
    this.metadata = clone(options.metadata);
  }

  ingest(input: ProviderConnectorIngestInput<TPayload> = {}): ProviderConnectorRawPayloadDraft<TPayload> {
    const hasInputPayload = Object.prototype.hasOwnProperty.call(input, 'payload');
    return {
      originalPayload: clone(hasInputPayload ? input.payload as TPayload : this.payload),
      sourceFormat: input.sourceFormat ?? this.sourceFormat,
      sourceEndpoint: input.sourceEndpoint ?? this.sourceEndpoint,
      receivedAt: input.receivedAt,
      licenseContext: clone(input.licenseContext ?? this.licenseContext),
      providerMetadata: normalizeMetadata(this.metadata, input.metadata, { providerId: this.providerId, adapter: 'mock' }),
    };
  }

  validate(artifact: RawProviderPayloadArtifact<TPayload>): ProviderPayloadValidationResult {
    return validation(artifact.originalPayload !== undefined && artifact.originalPayload !== null, artifact.originalPayload === undefined || artifact.originalPayload === null ? ['originalPayload is required'] : []);
  }
}

export class ConnectorRuntime {
  private readonly adapters = new Map<string, ProviderConnectorAdapter>();
  private readonly landingService: RawLandingService;
  private readonly jobs = new Map<string, ConnectorIngestionJob>();
  private readonly now: () => string;
  private readonly idFactory: (prefix: string) => string;

  constructor(private readonly deps: ConnectorRuntimeDeps = {}) {
    this.landingService = deps.landingService ?? new InMemoryRawLandingService();
    this.now = deps.now ?? (() => new Date().toISOString());
    this.idFactory = deps.idFactory ?? defaultId;
  }

  registerAdapter<TPayload = unknown>(adapter: ProviderConnectorAdapter<TPayload>): ProviderConnectorAdapter<TPayload> {
    this.adapters.set(adapter.providerId, adapter as ProviderConnectorAdapter);
    return adapter;
  }

  adapter(providerId: string): ProviderConnectorAdapter | undefined {
    return this.adapters.get(providerId);
  }

  rawLanding(): RawLandingService {
    return this.landingService;
  }

  getJob(id: string): ConnectorIngestionJob | undefined {
    const job = this.jobs.get(id);
    return job ? clone(job) : undefined;
  }

  jobsForProvider(providerId?: string): ConnectorIngestionJob[] {
    return [...this.jobs.values()].filter((job) => !providerId || job.providerId === providerId).map(clone);
  }

  async ingest<TPayload = unknown>(providerId: string, input: ProviderConnectorIngestInput<TPayload> = {}): Promise<ConnectorIngestionResult<TPayload>> {
    const adapter = this.requireAdapter<TPayload>(providerId);
    const createdAt = this.now();
    const job: ConnectorIngestionJob = {
      id: this.idFactory('provider-ingestion-job'),
      providerId,
      status: 'pending',
      eventRefs: [],
      auditRefs: [],
      transitions: [{ status: 'pending', timestamp: createdAt }],
      validationErrors: [],
      createdAt,
      updatedAt: createdAt,
      correlationId: input.correlationId ?? this.idFactory('corr'),
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
    };
    this.jobs.set(job.id, job);
    this.transition(job, 'running');

    try {
      const draft = await adapter.ingest(input);
      const artifact = this.landingService.create<TPayload>({
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        originalPayload: draft.originalPayload,
        sourceFormat: draft.sourceFormat,
        sourceEndpoint: draft.sourceEndpoint,
        receivedAt: draft.receivedAt ?? this.now(),
        licenseContext: draft.licenseContext,
        providerMetadata: {
          ...draft.providerMetadata,
          jobId: job.id,
          correlationId: job.correlationId,
          tenantId: job.tenantId,
          racetrackId: job.racetrackId,
        },
      });
      job.artifactId = artifact.id;
      job.payloadHash = artifact.payloadHash;

      const payloadValidation = adapter.validate?.(artifact) ?? this.validateArtifact(artifact);
      if (!payloadValidation.valid) {
        job.validationErrors = [...payloadValidation.errors];
        await this.recordRejected(job, artifact, payloadValidation.errors);
        return { job: clone(job), artifact, eventRefs: [...job.eventRefs], auditRefs: [...job.auditRefs] };
      }

      this.transition(job, 'validated');
      this.transition(job, 'normalized');
      this.transition(job, 'completed');
      await this.recordCompleted(job, artifact);
      return { job: clone(job), artifact, eventRefs: [...job.eventRefs], auditRefs: [...job.auditRefs] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.validationErrors = [message];
      await this.recordRejected(job, undefined, [message]);
      return { job: clone(job) as ConnectorIngestionJob, eventRefs: [...job.eventRefs], auditRefs: [...job.auditRefs] };
    }
  }

  private requireAdapter<TPayload>(providerId: string): ProviderConnectorAdapter<TPayload> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new Error(`provider connector not registered: ${providerId}`);
    return adapter as ProviderConnectorAdapter<TPayload>;
  }

  private validateArtifact(artifact: RawProviderPayloadArtifact): ProviderPayloadValidationResult {
    const errors = [
      artifact.originalPayload === undefined || artifact.originalPayload === null ? 'originalPayload is required' : undefined,
      artifact.sourceFormat ? undefined : 'sourceFormat is required',
      artifact.sourceEndpoint ? undefined : 'sourceEndpoint is required',
      artifact.payloadHash ? undefined : 'payloadHash is required',
      artifact.receivedAt ? undefined : 'receivedAt is required',
      isRecord(artifact.licenseContext) ? undefined : 'licenseContext is required',
    ].filter((error): error is string => Boolean(error));
    return { valid: errors.length === 0, errors };
  }

  private transition(job: ConnectorIngestionJob, status: ConnectorIngestionJobStatus, reason?: string): void {
    const timestamp = this.now();
    job.status = status;
    job.updatedAt = timestamp;
    job.transitions.push({ status, timestamp, reason });
  }

  private async recordCompleted(job: ConnectorIngestionJob, artifact: RawProviderPayloadArtifact): Promise<void> {
    const auditId = this.recordAudit(job, artifact, 'completed');
    if (auditId) job.auditRefs.push(auditId);
    const eventId = await this.emitEvent(job, artifact, 'provider.ingestion.completed');
    if (eventId) job.eventRefs.push(eventId);
    artifact.auditRefs.push(...job.auditRefs);
    artifact.eventRefs.push(...job.eventRefs);
    this.landingService.recordRefs(artifact.id, { eventRefs: job.eventRefs, auditRefs: job.auditRefs });
  }

  private async recordRejected(job: ConnectorIngestionJob, artifact: RawProviderPayloadArtifact | undefined, errors: string[]): Promise<void> {
    this.transition(job, 'rejected', errors.join('; '));
    const auditId = this.recordAudit(job, artifact, 'rejected', errors);
    if (auditId) job.auditRefs.push(auditId);
    const eventId = await this.emitEvent(job, artifact, 'provider.ingestion.rejected', errors);
    if (eventId) job.eventRefs.push(eventId);
    if (artifact) {
      artifact.auditRefs.push(...job.auditRefs);
      artifact.eventRefs.push(...job.eventRefs);
      this.landingService.recordRefs(artifact.id, { eventRefs: job.eventRefs, auditRefs: job.auditRefs });
    }
  }

  private recordAudit(job: ConnectorIngestionJob, artifact: RawProviderPayloadArtifact | undefined, outcome: 'completed' | 'rejected', errors: string[] = []): string | undefined {
    const id = `audit:${job.id}:${outcome}`;
    if (!this.deps.auditLog) return id;
    const entry: AuditLogEntry = this.deps.auditLog.append({
      id,
      type: outcome === 'completed' ? 'data-change' : 'system-event',
      actor: 'connector-runtime',
      actorType: 'service',
      timestamp: this.now(),
      action: `provider.ingestion.${outcome}`,
      actionClass: 'service',
      subjectId: artifact?.id ?? job.id,
      tenantId: job.tenantId,
      correlationId: job.correlationId,
      sourceService: 'connector-runtime',
      severity: outcome === 'completed' ? 'info' : 'warning',
      evidenceIds: artifact ? [artifact.id, artifact.payloadHash] : [job.id],
      payload: {
        jobId: job.id,
        providerId: job.providerId,
        artifactId: artifact?.id,
        payloadHash: artifact?.payloadHash,
        outcome,
        errors,
      },
    });
    return entry.id;
  }

  private async emitEvent(job: ConnectorIngestionJob, artifact: RawProviderPayloadArtifact | undefined, type: string, errors: string[] = []): Promise<string | undefined> {
    const id = `event:${job.id}:${type}`;
    if (!this.deps.eventBus) return id;
    const event: RaceDayEvent = await this.deps.eventBus.publish({
      id,
      type,
      occurredAt: this.now(),
      payload: {
        jobId: job.id,
        providerId: job.providerId,
        artifactId: artifact?.id,
        payloadHash: artifact?.payloadHash,
        status: job.status,
        errors,
      },
      tenantId: job.tenantId,
      racetrackId: job.racetrackId,
      aggregateId: artifact?.id ?? job.id,
      correlationId: job.correlationId,
      auditRef: job.auditRefs.at(-1),
      producer: 'connector-runtime',
      metadata: {
        compliance: artifact?.licenseContext.restrictions?.length ? 'regulated' : 'internal',
        team: 'data-platform',
        accountableRole: 'data-ingestion-owner',
      },
    });
    return event.id;
  }
}
