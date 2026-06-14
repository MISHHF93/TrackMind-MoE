import type { NexusActorType } from '@trackmind/shared';
import { ImmutableAuditLog, type AuditDecision, type AuditLogEntry, type AuditSeverity } from './auditLog.js';
import { UniversalEventBus, type EventContract, type RaceDayEvent } from './eventBus.js';

export const apiHubEventTypes = [
  'ProviderRegistered',
  'IngestionJobStarted',
  'RawPayloadReceived',
  'PayloadValidated',
  'PayloadRejected',
  'CanonicalRecordCreated',
  'CanonicalRecordUpdated',
  'EntityResolutionRequired',
  'EntityResolved',
  'DataQualityReportCreated',
  'LicenseRestrictionDetected',
  'FeatureRecordGenerated',
  'DigitalTwinSyncRequested',
  'ExternalDataAuditCreated',
] as const;

export type ApiHubEventType = typeof apiHubEventTypes[number];
export type ApiHubActorType = NexusActorType;

export interface ApiHubReferenceContext {
  tenantId: string;
  racetrackId: string;
  correlationId: string;
  causationId?: string;
  providerId: string;
  artifactId?: string;
  jobId?: string;
  actorId?: string;
  actorType?: ApiHubActorType;
  subjectId?: string;
  subjectType?: string;
  auditRefs?: string[];
  twinRefs?: string[];
  evidence?: string[];
  occurredAt?: string;
}

export interface ApiHubEventDescriptor<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: 'trackmind.api-hub.event.v1';
  eventType: ApiHubEventType;
  version: 1;
  occurredAt: string;
  tenantId: string;
  racetrackId: string;
  correlationId: string;
  causationId?: string;
  providerId: string;
  artifactId?: string;
  jobId?: string;
  auditRefs: string[];
  twinRefs: string[];
  evidence: string[];
  actor: { id: string; type: ApiHubActorType };
  subject: { id: string; type: string; tenantId: string };
  payload: TPayload & {
    providerId: string;
    tenantId: string;
    racetrackId: string;
    correlationId: string;
    auditRefs: string[];
    twinRefs: string[];
  };
}

export interface ApiHubAuditDescriptor {
  schemaVersion: 'trackmind.api-hub.audit.v1';
  auditId: string;
  eventType: ApiHubEventType;
  action: string;
  decision: AuditDecision;
  severity: AuditSeverity;
  tenantId: string;
  racetrackId: string;
  correlationId: string;
  causationId?: string;
  providerId: string;
  artifactId?: string;
  jobId?: string;
  auditRefs: string[];
  twinRefs: string[];
  evidence: string[];
  actor: { id: string; type: ApiHubActorType };
  subject: { id: string; type: string; tenantId: string };
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface DigitalTwinSyncRequestDescriptor {
  schemaVersion: 'trackmind.api-hub.digital-twin-sync.v1';
  requestId: string;
  tenantId: string;
  racetrackId: string;
  providerId: string;
  artifactId: string;
  correlationId: string;
  causationId?: string;
  auditRefs: string[];
  twinRefs: string[];
  evidence: string[];
  requestedAt: string;
  descriptorOnly: true;
  advisoryOnly: true;
  physicalControlsInvoked: false;
  executionAllowed: false;
  syncTargets: Array<{ twinId: string; operation: 'upsert' | 'patch' | 'link'; patch?: Record<string, unknown> }>;
}

export interface ApiHubPublication<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  descriptor: ApiHubEventDescriptor<TPayload>;
  event: RaceDayEvent<ApiHubEventDescriptor<TPayload>['payload']>;
  audit?: AuditLogEntry;
}

export interface ApiHubPublisherOptions {
  eventBus?: UniversalEventBus;
  auditLog?: ImmutableAuditLog;
  now?: () => string;
}

type PublishAuditOptions = { decision?: AuditDecision; severity?: AuditSeverity; action?: string };

const owner = { service: 'api-hub', team: 'data-platform', accountableRole: 'api-hub-owner' };
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const clean = (value: string) => value.replace(/[^a-zA-Z0-9_.:-]+/g, '-');
const unique = (values: Array<string | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)))];

export function createApiHubEventCatalog(): EventContract[] {
  return apiHubEventTypes.map((type) => ({
    type,
    version: 1,
    description: `Racing Data API Hub ${type} event`,
    owner,
    payloadFields: ['providerId', 'tenantId', 'racetrackId', 'correlationId'],
    compliance: ['LicenseRestrictionDetected', 'ExternalDataAuditCreated'].includes(type) ? 'restricted' : 'regulated',
    operationalMetadata: {
      catalog: 'racing-data-api-hub',
      preserves: ['correlationId', 'causationId', 'providerId', 'artifactId', 'tenantId', 'racetrackId', 'auditRefs', 'twinRefs'],
      descriptorOnlyPhysicalControls: type === 'DigitalTwinSyncRequested',
    },
  }));
}

export function buildApiHubEventDescriptor<TPayload extends Record<string, unknown>>(
  eventType: ApiHubEventType,
  context: ApiHubReferenceContext,
  payload: TPayload,
): ApiHubEventDescriptor<TPayload> {
  const auditRefs = unique(context.auditRefs ?? []);
  const twinRefs = unique(context.twinRefs ?? []);
  const evidence = unique([...(context.evidence ?? []), ...auditRefs, ...twinRefs]);
  const subjectId = context.subjectId ?? context.artifactId ?? context.jobId ?? context.providerId;
  const subjectType = context.subjectType ?? (context.artifactId ? 'api-hub-artifact' : 'api-hub-provider');
  return {
    schemaVersion: 'trackmind.api-hub.event.v1',
    eventType,
    version: 1,
    occurredAt: context.occurredAt ?? new Date().toISOString(),
    tenantId: context.tenantId,
    racetrackId: context.racetrackId,
    correlationId: context.correlationId,
    causationId: context.causationId,
    providerId: context.providerId,
    artifactId: context.artifactId,
    jobId: context.jobId,
    auditRefs,
    twinRefs,
    evidence,
    actor: { id: context.actorId ?? 'api-hub', type: context.actorType ?? 'service' },
    subject: { id: subjectId, type: subjectType, tenantId: context.tenantId },
    payload: {
      ...clone(payload),
      providerId: context.providerId,
      tenantId: context.tenantId,
      racetrackId: context.racetrackId,
      correlationId: context.correlationId,
      ...(context.causationId ? { causationId: context.causationId } : {}),
      ...(context.artifactId ? { artifactId: context.artifactId } : {}),
      ...(context.jobId ? { jobId: context.jobId } : {}),
      auditRefs,
      twinRefs,
    },
  };
}

export function buildExternalDataAuditDescriptor(input: ApiHubReferenceContext & { eventType?: ApiHubEventType; action?: string; decision?: AuditDecision; severity?: AuditSeverity; payload?: Record<string, unknown> }): ApiHubAuditDescriptor {
  const eventType = input.eventType ?? 'ExternalDataAuditCreated';
  const event = buildApiHubEventDescriptor(eventType, input, input.payload ?? {});
  return {
    schemaVersion: 'trackmind.api-hub.audit.v1',
    auditId: `audit:api-hub:${clean(eventType)}:${clean(input.artifactId ?? input.providerId)}:${clean(input.correlationId)}`,
    eventType,
    action: input.action ?? eventType,
    decision: input.decision ?? (eventType === 'LicenseRestrictionDetected' ? 'blocked' : 'observed'),
    severity: input.severity ?? (eventType === 'LicenseRestrictionDetected' ? 'critical' : 'info'),
    tenantId: input.tenantId,
    racetrackId: input.racetrackId,
    correlationId: input.correlationId,
    causationId: input.causationId,
    providerId: input.providerId,
    artifactId: input.artifactId,
    jobId: input.jobId,
    auditRefs: event.auditRefs,
    twinRefs: event.twinRefs,
    evidence: event.evidence,
    actor: event.actor,
    subject: event.subject,
    payload: { eventType, providerId: input.providerId, artifactId: input.artifactId, jobId: input.jobId, tenantId: input.tenantId, racetrackId: input.racetrackId, correlationId: input.correlationId, causationId: input.causationId, auditRefs: event.auditRefs, twinRefs: event.twinRefs, ...(input.payload ?? {}) },
    occurredAt: input.occurredAt ?? event.occurredAt,
  };
}

export function buildDigitalTwinSyncRequestDescriptor(input: ApiHubReferenceContext & { artifactId: string; syncTargets?: DigitalTwinSyncRequestDescriptor['syncTargets']; patch?: Record<string, unknown> }): DigitalTwinSyncRequestDescriptor {
  const twinRefs = unique(input.twinRefs ?? []);
  const targets = input.syncTargets?.length
    ? input.syncTargets.map((target) => ({ ...target, patch: target.patch ? clone(target.patch) : undefined }))
    : twinRefs.map((twinId) => ({ twinId, operation: 'patch' as const, patch: input.patch ? clone(input.patch) : undefined }));
  return {
    schemaVersion: 'trackmind.api-hub.digital-twin-sync.v1',
    requestId: `twin-sync:${clean(input.artifactId)}:${clean(input.correlationId)}`,
    tenantId: input.tenantId,
    racetrackId: input.racetrackId,
    providerId: input.providerId,
    artifactId: input.artifactId,
    correlationId: input.correlationId,
    causationId: input.causationId,
    auditRefs: unique(input.auditRefs ?? []),
    twinRefs,
    evidence: unique([...(input.evidence ?? []), ...(input.auditRefs ?? []), ...twinRefs]),
    requestedAt: input.occurredAt ?? new Date().toISOString(),
    descriptorOnly: true,
    advisoryOnly: true,
    physicalControlsInvoked: false,
    executionAllowed: false,
    syncTargets: targets,
  };
}

export class InMemoryApiHubPublisher {
  readonly eventBus: UniversalEventBus;
  readonly auditLog: ImmutableAuditLog;

  constructor(private readonly options: ApiHubPublisherOptions = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.registerEventSchemas();
  }

  async publishEvent<TPayload extends Record<string, unknown>>(descriptor: ApiHubEventDescriptor<TPayload>, options: { audit?: boolean } & PublishAuditOptions = {}): Promise<ApiHubPublication<TPayload>> {
    const audit = options.audit ? this.publishAudit(buildExternalDataAuditDescriptor({ ...descriptor, eventType: descriptor.eventType, action: options.action, decision: options.decision, severity: options.severity, payload: descriptor.payload })) : undefined;
    const auditRefs = unique([...(descriptor.auditRefs ?? []), audit?.id]);
    const event = await this.eventBus.publish({
      type: descriptor.eventType,
      version: descriptor.version,
      occurredAt: descriptor.occurredAt,
      payload: { ...descriptor.payload, auditRefs, auditRef: auditRefs[0], twinRefs: descriptor.twinRefs, digitalTwinRefs: descriptor.twinRefs },
      tenantId: descriptor.tenantId,
      racetrackId: descriptor.racetrackId,
      aggregateId: descriptor.artifactId ?? descriptor.jobId ?? descriptor.providerId,
      correlationId: descriptor.correlationId,
      causationId: descriptor.causationId,
      producer: 'api-hub',
      auditRef: auditRefs[0],
      digitalTwinRef: descriptor.twinRefs[0],
      digitalTwinRefs: descriptor.twinRefs,
      actor: descriptor.actor,
      subject: descriptor.subject,
      evidence: unique([...descriptor.evidence, ...auditRefs]),
      metadata: { tenantId: descriptor.tenantId, racetrackId: descriptor.racetrackId, providerId: descriptor.providerId, artifactId: descriptor.artifactId, auditRefs, digitalTwinRefs: descriptor.twinRefs, compliance: descriptor.eventType === 'LicenseRestrictionDetected' ? 'restricted' : 'regulated', team: owner.team, accountableRole: owner.accountableRole },
    });
    return { descriptor: { ...descriptor, auditRefs }, event, audit };
  }

  publishAudit(descriptor: ApiHubAuditDescriptor): AuditLogEntry {
    return this.auditLog.append({
      id: descriptor.auditId,
      type: descriptor.eventType === 'DigitalTwinSyncRequested' ? 'digital-twin-update' : descriptor.eventType === 'LicenseRestrictionDetected' ? 'regulatory-activity' : descriptor.eventType.startsWith('Canonical') ? 'data-change' : 'system-event',
      actor: descriptor.actor.id,
      actorType: descriptor.actor.type,
      timestamp: descriptor.occurredAt,
      action: descriptor.action,
      sourceService: 'api-hub',
      subjectId: descriptor.subject.id,
      tenantId: descriptor.tenantId,
      correlationId: descriptor.correlationId,
      severity: descriptor.severity,
      decision: descriptor.decision,
      regulations: ['SOC-2', 'ISO-27001', 'HISA', 'ARCI'],
      evidenceIds: unique([...descriptor.evidence, ...descriptor.auditRefs, ...descriptor.twinRefs]),
      payload: descriptor.payload,
    });
  }

  private registerEventSchemas(): void {
    for (const contract of createApiHubEventCatalog()) {
      if (!this.eventBus.schemaRegistry.latest(contract.type)) this.eventBus.registerEvent(contract);
    }
  }
}

export class ApiHubIntegrationAdapter {
  readonly publisher: InMemoryApiHubPublisher;

  constructor(options: ApiHubPublisherOptions = {}) {
    this.publisher = new InMemoryApiHubPublisher(options);
  }

  publish<TPayload extends Record<string, unknown>>(eventType: ApiHubEventType, context: ApiHubReferenceContext, payload: TPayload): Promise<ApiHubPublication<TPayload>> {
    return this.publisher.publishEvent(buildApiHubEventDescriptor(eventType, context, payload));
  }

  registerProvider(context: ApiHubReferenceContext, provider: Record<string, unknown>) {
    return this.publish('ProviderRegistered', context, provider);
  }

  startIngestionJob(context: ApiHubReferenceContext, job: Record<string, unknown>) {
    return this.publish('IngestionJobStarted', context, job);
  }

  receiveRawPayload(context: ApiHubReferenceContext, payload: { payloadId: string; rawPayloadRef: string; rawPayloadHash: string; contentType?: string }) {
    return this.publish('RawPayloadReceived', { ...context, artifactId: context.artifactId ?? payload.payloadId }, payload);
  }

  validatePayload(context: ApiHubReferenceContext, validation: { payloadId: string; schemaId: string; canonicalType: string; warnings?: string[] }) {
    return this.publish('PayloadValidated', { ...context, artifactId: context.artifactId ?? validation.payloadId }, validation);
  }

  rejectPayload(context: ApiHubReferenceContext, rejection: { payloadId: string; reason: string; errors: string[] }) {
    return this.publish('PayloadRejected', { ...context, artifactId: context.artifactId ?? rejection.payloadId }, rejection);
  }

  createCanonicalRecord(context: ApiHubReferenceContext, record: { canonicalRecordId: string; entityType: string; record: Record<string, unknown> }) {
    return this.publish('CanonicalRecordCreated', { ...context, artifactId: context.artifactId ?? record.canonicalRecordId }, record);
  }

  updateCanonicalRecord(context: ApiHubReferenceContext, record: { canonicalRecordId: string; entityType: string; changedFields: string[]; record: Record<string, unknown> }) {
    return this.publish('CanonicalRecordUpdated', { ...context, artifactId: context.artifactId ?? record.canonicalRecordId }, record);
  }

  requireEntityResolution(context: ApiHubReferenceContext, resolution: { candidateEntityIds: string[]; reason: string }) {
    return this.publish('EntityResolutionRequired', context, resolution);
  }

  resolveEntity(context: ApiHubReferenceContext, resolution: { resolvedEntityId: string; matchedEntityIds: string[]; confidence: number }) {
    return this.publish('EntityResolved', context, resolution);
  }

  createDataQualityReport(context: ApiHubReferenceContext, report: { reportId: string; score: number; issues: string[]; recordCount?: number }) {
    return this.publish('DataQualityReportCreated', { ...context, artifactId: context.artifactId ?? report.reportId }, report);
  }

  detectLicenseRestriction(context: ApiHubReferenceContext, restriction: { licenseId: string; reason: string; restrictedFields: string[]; blockedUse: string }) {
    const descriptor = buildApiHubEventDescriptor('LicenseRestrictionDetected', context, restriction);
    return this.publisher.publishEvent(descriptor, { audit: true, action: 'api-hub.license-restriction.detected', decision: 'blocked', severity: 'critical' });
  }

  generateFeatureRecord(context: ApiHubReferenceContext, featureRecord: { featureRecordId: string; featureSetId: string; featureRecord: Record<string, unknown> }) {
    return this.publish('FeatureRecordGenerated', { ...context, artifactId: context.artifactId ?? featureRecord.featureRecordId }, featureRecord);
  }

  requestDigitalTwinSync(context: ApiHubReferenceContext & { artifactId: string; syncTargets?: DigitalTwinSyncRequestDescriptor['syncTargets']; patch?: Record<string, unknown> }) {
    const descriptor = buildDigitalTwinSyncRequestDescriptor(context);
    return this.publisher.publishEvent(buildApiHubEventDescriptor('DigitalTwinSyncRequested', context, { descriptor }), { audit: true, action: 'api-hub.digital-twin-sync.requested', decision: 'observed', severity: 'info' });
  }

  async createExternalDataAudit(context: ApiHubReferenceContext & { eventType?: ApiHubEventType; action?: string; decision?: AuditDecision; severity?: AuditSeverity; payload?: Record<string, unknown> }) {
    const audit = this.publisher.publishAudit(buildExternalDataAuditDescriptor(context));
    const publication = await this.publisher.publishEvent(buildApiHubEventDescriptor('ExternalDataAuditCreated', { ...context, auditRefs: unique([...(context.auditRefs ?? []), audit.id]) }, { auditId: audit.id, eventType: context.eventType ?? 'ExternalDataAuditCreated' }));
    return { audit, publication };
  }
}
