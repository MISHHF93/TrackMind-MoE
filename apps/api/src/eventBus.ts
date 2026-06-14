import { nexusEventContracts, validateNexusEventEnvelope, type NexusActor, type NexusSubjectReference, type NexusEventContract } from '@trackmind/shared';
import type { RaceDayEventType } from '@trackmind/shared';

export type EventName = RaceDayEventType | (string & {});
export type ComplianceClassification = 'public' | 'internal' | 'confidential' | 'regulated' | 'restricted';
export type DeliveryStatus = 'delivered' | 'failed' | 'dead-lettered';

export interface EventOwner {
  service: string;
  team: string;
  accountableRole: string;
  contact?: string;
}

export interface EventDependency {
  eventType: EventName;
  versionRange: string;
  required: boolean;
}

export interface EventSchema<T = unknown> {
  type: EventName;
  version: number;
  description: string;
  owner: EventOwner;
  payloadFields: readonly string[];
  compliance: ComplianceClassification;
  dependencies?: EventDependency[];
  operationalMetadata?: Record<string, unknown>;
  standards?: EventServiceIntegrationStandard;
  validate?: (payload: T) => boolean | readonly string[];
}

export interface EventContract<T = unknown> extends EventSchema<T> {
  deprecated?: boolean;
  supersededBy?: string;
  examples?: T[];
}

export interface EventDiscoveryFilter {
  ownerService?: string;
  compliance?: ComplianceClassification;
  eventTypePrefix?: string;
  includeDeprecated?: boolean;
}

export interface EventDiscoveryResult {
  events: Array<EventContract & { schemaRef: string; latest: boolean }>;
  producers: EventProducerProfile[];
  consumers: EventConsumerProfile[];
}

export interface EventProducerProfile { name: string; service: string; emits: EventName[]; owner: EventOwner }
export interface EventConsumerProfile { name: string; service: string; consumes: Array<EventName | '*'>; owner?: EventOwner }

export interface EventTraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export type EventContextField =
  | 'tenantId'
  | 'racetrackId'
  | 'correlationId'
  | 'causationId'
  | 'aggregateId'
  | 'actor'
  | 'subject'
  | 'payload'
  | 'evidence'
  | 'auditRef'
  | 'digitalTwinRef'
  | 'approvalRef'
  | 'workflowRef';

export interface EventServiceIntegrationStandard {
  tenantScoped: boolean;
  racetrackScoped?: boolean;
  correlationRequired: boolean;
  auditRequired: boolean;
  digitalTwinReferenceRequired?: boolean;
  approvalReferenceRequired?: boolean;
  workflowReferenceRequired?: boolean;
  replayable: boolean;
  requiredMetadata?: readonly EventContextField[];
  cqrsProjection?: string;
  observabilitySignals?: readonly string[];
  frontendConsumers?: readonly string[];
}

export interface EventBackboneContext {
  tenantId?: string;
  racetrackId?: string;
  actor?: NexusActor;
  subject?: NexusSubjectReference;
  evidence: string[];
  auditRef?: string;
  auditRefs: string[];
  digitalTwinRef?: string;
  digitalTwinRefs: string[];
  approvalRef?: string;
  workflowRef?: string;
  sourceService?: string;
  frontendRoute?: string;
}

export interface EventLineage {
  causationId?: string;
  parentEventIds: string[];
  producer: string;
  aggregateId?: string;
  sequence: number;
}

export interface RaceDayEvent<T = unknown> {
  id: string;
  type: EventName;
  version: number;
  occurredAt: string;
  payload: T;
  correlationId: string;
  schemaRef: string;
  owner: EventOwner;
  compliance: ComplianceClassification;
  lineage: EventLineage;
  trace: EventTraceContext;
  context: EventBackboneContext;
  metadata: Record<string, unknown>;
}

export interface PublishInput<T = unknown> {
  id?: string;
  type: EventName;
  version?: number;
  occurredAt?: string;
  payload: T;
  correlationId?: string;
  causationId?: string;
  parentEventIds?: string[];
  aggregateId?: string;
  producer?: string;
  trace?: Partial<EventTraceContext>;
  tenantId?: string;
  racetrackId?: string;
  actor?: NexusActor;
  subject?: NexusSubjectReference;
  evidence?: string[];
  auditRef?: string;
  digitalTwinRef?: string;
  digitalTwinRefs?: string[];
  approvalRef?: string;
  workflowRef?: string;
  context?: Partial<EventBackboneContext>;
  metadata?: Record<string, unknown>;
}

export type Handler<T = unknown> = (event: RaceDayEvent<T>) => void | Promise<void>;
export type ObservabilityHook = (signal: EventBusSignal) => void;

export interface EventBusSignal {
  name: 'schema.registered' | 'event.published' | 'event.validation.failed' | 'handler.delivered' | 'handler.failed' | 'event.dead-lettered' | 'event.replayed' | 'dead-letter.retried';
  timestamp: string;
  eventId?: string;
  eventType?: EventName;
  correlationId?: string;
  traceId?: string;
  handlerName?: string;
  attempt?: number;
  details?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface DeadLetterEntry {
  event: RaceDayEvent;
  handlerName: string;
  reason: string;
  attempts: number;
  failedAt: string;
  correlationId: string;
  eventType: EventName;
  tenantId?: string;
  racetrackId?: string;
  replayable: boolean;
}

export interface EventValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EventReplayFilter {
  type?: EventName;
  types?: EventName[];
  correlationId?: string;
  tenantId?: string;
  racetrackId?: string;
  aggregateId?: string;
  fromSequence?: number;
  toSequence?: number;
  fromOccurredAt?: string;
  toOccurredAt?: string;
}

export interface EventReplayOptions {
  deliver?: boolean;
  replayedBy?: string;
}

interface Subscription {
  name: string;
  type: EventName | '*';
  handler: Handler;
  retry: RetryPolicy;
}

const defaultRetry: RetryPolicy = { maxAttempts: 3, backoffMs: 0 };
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const stringValue = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const arrayOfStrings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

export class EventSchemaRegistry {
  private readonly schemas = new Map<string, EventContract<any>>();

  register<T>(schema: EventContract<T>): string {
    const key = this.ref(schema.type, schema.version);
    this.schemas.set(key, { ...(schema as EventSchema), dependencies: [...(schema.dependencies ?? [])], operationalMetadata: { ...(schema.operationalMetadata ?? {}) } });
    return key;
  }

  get(type: EventName, version: number): EventContract {
    const schema = this.schemas.get(this.ref(type, version));
    if (!schema) throw new Error(`event schema not registered: ${String(type)}@v${version}`);
    return schema;
  }

  latest(type: EventName): EventContract | undefined {
    return [...this.schemas.values()].filter((schema) => schema.type === type).sort((a, b) => b.version - a.version)[0];
  }

  all(): EventContract[] {
    return [...this.schemas.values()].map(clone);
  }

  ref(type: EventName, version: number): string {
    const name = String(type);
    return name.endsWith(`.v${version}`) ? name : `${name}.v${version}`;
  }
}

export class UniversalEventBus {
  readonly schemaRegistry = new EventSchemaRegistry();
  private readonly subscriptions: Subscription[] = [];
  private readonly eventStore: RaceDayEvent[] = [];
  private readonly deadLetters: DeadLetterEntry[] = [];
  private readonly hooks: ObservabilityHook[] = [];
  private readonly producers = new Map<string, EventProducerProfile>();
  private readonly consumers = new Map<string, EventConsumerProfile>();
  private sequence = 0;

  registerEvent<T>(schema: EventContract<T>): string {
    const validation = this.validateContract(schema);
    if (!validation.valid) throw new Error(`event contract invalid: ${validation.errors.join('; ')}`);
    const ref = this.schemaRegistry.register(schema);
    this.emit({ name: 'schema.registered', eventType: schema.type, details: { schemaRef: ref, owner: schema.owner, compliance: schema.compliance } });
    return ref;
  }

  registerCatalog(contracts: readonly EventContract[]): string[] {
    return contracts.map((contract) => this.registerEvent(contract));
  }

  registerNexusCatalog(): string[] {
    return this.registerCatalog(createNexusEventCatalog());
  }

  registerProducer(profile: EventProducerProfile): EventProducerProfile {
    const existing = this.producers.get(profile.name);
    const next = { ...profile, emits: [...new Set([...(existing?.emits ?? []), ...profile.emits])] };
    this.producers.set(profile.name, clone(next));
    for (const eventType of next.emits) this.ensureProducerSchema(eventType, next);
    return clone(next);
  }

  registerConsumer(profile: EventConsumerProfile): EventConsumerProfile {
    const existing = this.consumers.get(profile.name);
    const next = { ...profile, consumes: [...new Set([...(existing?.consumes ?? []), ...profile.consumes])] };
    this.consumers.set(profile.name, clone(next));
    return clone(next);
  }

  producer(name: string): EventProducer { return new EventProducer(this, name); }
  consumer(name: string): EventConsumer { return new EventConsumer(this, name); }

  subscribe(type: EventName | '*', handler: Handler, options: { name?: string; service?: string; owner?: EventOwner; retry?: Partial<RetryPolicy> } = {}): () => void {
    const subscription = { name: options.name ?? `handler:${String(type)}:${this.subscriptions.length + 1}`, type, handler, retry: { ...defaultRetry, ...(options.retry ?? {}) } };
    this.subscriptions.push(subscription);
    this.registerConsumer({ name: subscription.name, service: options.service ?? subscription.name, consumes: [type], owner: options.owner });
    return () => {
      const index = this.subscriptions.indexOf(subscription);
      if (index >= 0) this.subscriptions.splice(index, 1);
    };
  }

  onSignal(hook: ObservabilityHook): () => void {
    this.hooks.push(hook);
    return () => this.hooks.splice(this.hooks.indexOf(hook), 1);
  }

  async publish<T>(input: PublishInput<T>): Promise<RaceDayEvent<T>> {
    const version = input.version ?? this.schemaRegistry.latest(input.type)?.version ?? 1;
    const schema = this.ensureSchema(input.type, version, input);
    const payloadValidation = this.validatePayload(schema, input.payload);
    if (!payloadValidation.valid) {
      this.emit({ name: 'event.validation.failed', eventType: input.type, correlationId: input.correlationId, details: { errors: payloadValidation.errors } });
      throw new Error(`event payload failed schema validation: ${String(input.type)}@v${version}: ${payloadValidation.errors.join('; ')}`);
    }
    const correlationId = input.correlationId ?? stringValue(input.metadata?.correlationId) ?? id('corr');
    const traceId = input.trace?.traceId ?? correlationId ?? id('trace');
    const context = this.deriveContext(input, schema);
    const event: RaceDayEvent<T> = {
      id: input.id ?? id('evt'),
      type: input.type,
      version,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload: clone(input.payload),
      correlationId,
      schemaRef: this.schemaRegistry.ref(input.type, version),
      owner: clone(schema.owner),
      compliance: schema.compliance,
      lineage: { causationId: input.causationId, parentEventIds: [...(input.parentEventIds ?? [])], producer: input.producer ?? schema.owner.service, aggregateId: input.aggregateId, sequence: ++this.sequence },
      trace: { traceId, spanId: input.trace?.spanId ?? id('span'), parentSpanId: input.trace?.parentSpanId },
      context,
      metadata: { ...(schema.operationalMetadata ?? {}), ...(input.metadata ?? {}), tenantId: context.tenantId, racetrackId: context.racetrackId, auditRef: context.auditRef, digitalTwinRef: context.digitalTwinRef, approvalRef: context.approvalRef, workflowRef: context.workflowRef },
    };
    const eventValidation = this.validateEvent(event);
    if (!eventValidation.valid) {
      this.emitEvent('event.validation.failed', event, { details: { errors: eventValidation.errors } });
      throw new Error(`event failed backbone validation: ${String(event.type)}@v${event.version}: ${eventValidation.errors.join('; ')}`);
    }
    this.registerProducer({ name: event.lineage.producer, service: event.lineage.producer, emits: [event.type], owner: event.owner });
    this.eventStore.push(event);
    this.emitEvent('event.published', event);
    await this.deliver(event);
    return clone(event);
  }

  events(filter: EventReplayFilter = {}): RaceDayEvent[] {
    return this.eventStore.filter((event) => this.matchesReplayFilter(event, filter)).map(clone);
  }

  deadLetterQueue(filter: { handlerName?: string; eventType?: EventName; tenantId?: string; correlationId?: string } = {}): DeadLetterEntry[] {
    return this.deadLetters.filter((entry) => (!filter.handlerName || entry.handlerName === filter.handlerName) && (!filter.eventType || entry.eventType === filter.eventType) && (!filter.tenantId || entry.tenantId === filter.tenantId) && (!filter.correlationId || entry.correlationId === filter.correlationId)).map(clone);
  }

  async replay(filter: EventReplayFilter = {}, options: EventReplayOptions = {}): Promise<RaceDayEvent[]> {
    const events = this.eventStore.filter((event) => this.matchesReplayFilter(event, filter));
    for (const event of events) {
      this.emitEvent('event.replayed', event, { details: { replayedBy: options.replayedBy, deliver: Boolean(options.deliver) } });
      if (options.deliver) await this.deliver(event, true);
    }
    return events.map(clone);
  }

  governanceCatalog(): Array<EventContract & { schemaRef: string }> {
    return this.schemaRegistry.all().map((schema) => ({ ...schema, schemaRef: this.schemaRegistry.ref(schema.type, schema.version) }));
  }

  eventCatalog(filter: EventDiscoveryFilter = {}): EventDiscoveryResult {
    return this.discover(filter);
  }

  discover(filter: EventDiscoveryFilter = {}): EventDiscoveryResult {
    const allSchemas = this.schemaRegistry.all();
    const latestByType = new Map<EventName, number>();
    for (const schema of allSchemas) latestByType.set(schema.type, Math.max(latestByType.get(schema.type) ?? 0, schema.version));
    const events = allSchemas
      .filter((schema) => (filter.includeDeprecated || !schema.deprecated) && (!filter.ownerService || schema.owner.service === filter.ownerService) && (!filter.compliance || schema.compliance === filter.compliance) && (!filter.eventTypePrefix || String(schema.type).startsWith(filter.eventTypePrefix)))
      .map((schema) => ({ ...schema, schemaRef: this.schemaRegistry.ref(schema.type, schema.version), latest: latestByType.get(schema.type) === schema.version }));
    return { events, producers: [...this.producers.values()].map(clone), consumers: [...this.consumers.values()].map(clone) };
  }

  async processDeadLetters(filter: { handlerName?: string; eventType?: EventName } = {}): Promise<{ retried: number; remaining: number }> {
    const retryable = this.deadLetters.filter((entry) => (!filter.handlerName || entry.handlerName === filter.handlerName) && (!filter.eventType || entry.event.type === filter.eventType));
    this.deadLetters.splice(0, this.deadLetters.length, ...this.deadLetters.filter((entry) => !retryable.includes(entry)));
    for (const entry of retryable) {
      this.emitEvent('dead-letter.retried', entry.event, { handlerName: entry.handlerName, attempt: entry.attempts, details: { reason: entry.reason } });
      await this.deliver(entry.event, true);
    }
    return { retried: retryable.length, remaining: this.deadLetters.length };
  }

  validateEvent(event: RaceDayEvent): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const schema = (() => { try { return this.schemaRegistry.get(event.type, event.version); } catch { return undefined; } })();
    if (!schema) errors.push(`event schema not registered: ${String(event.type)}@v${event.version}`);
    if (!event.id) errors.push('event id is required');
    if (!event.occurredAt) errors.push('occurredAt is required');
    if (!event.correlationId) errors.push('correlationId is required');
    if (!event.lineage.producer) errors.push('lineage.producer is required');
    if (!event.trace.traceId || !event.trace.spanId) errors.push('traceId and spanId are required');
    if (schema?.standards) errors.push(...this.validateStandards(schema, event));
    return { valid: errors.length === 0, errors, warnings };
  }

  private ensureSchema(type: EventName, version: number, input: PublishInput): EventContract {
    const exact = (() => { try { return this.schemaRegistry.get(type, version); } catch { return undefined; } })();
    if (exact) return exact;
    const owner: EventOwner = {
      service: input.producer ?? 'unregistered-producer',
      team: String(input.metadata?.team ?? 'platform'),
      accountableRole: String(input.metadata?.accountableRole ?? 'event-owner'),
      contact: typeof input.metadata?.contact === 'string' ? input.metadata.contact : undefined,
    };
    const payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload as Record<string, unknown> : {};
    this.registerEvent({
      type,
      version,
      description: String(input.metadata?.description ?? `Auto-registered ${String(type)} event`),
      owner,
      payloadFields: Object.keys(payload),
      compliance: (input.metadata?.compliance as ComplianceClassification | undefined) ?? 'internal',
      dependencies: [],
      operationalMetadata: { autoRegistered: true, registeredFrom: 'publish' },
    });
    return this.schemaRegistry.get(type, version);
  }

  private async deliver(event: RaceDayEvent, replay = false): Promise<void> {
    for (const subscription of this.subscriptions.filter((candidate) => candidate.type === '*' || candidate.type === event.type)) {
      let delivered = false;
      let reason = 'unknown';
      for (let attempt = 1; attempt <= subscription.retry.maxAttempts && !delivered; attempt += 1) {
        try {
          await subscription.handler(clone(event));
          delivered = true;
          this.emitEvent('handler.delivered', event, { handlerName: subscription.name, attempt, details: { replay } });
        } catch (error) {
          reason = error instanceof Error ? error.message : String(error);
          this.emitEvent('handler.failed', event, { handlerName: subscription.name, attempt, details: { reason, replay } });
          if (subscription.retry.backoffMs > 0) await new Promise((resolve) => setTimeout(resolve, subscription.retry.backoffMs));
        }
      }
      if (!delivered) {
        this.deadLetters.push({ event: clone(event), handlerName: subscription.name, reason, attempts: subscription.retry.maxAttempts, failedAt: new Date().toISOString(), correlationId: event.correlationId, eventType: event.type, tenantId: event.context.tenantId, racetrackId: event.context.racetrackId, replayable: this.schemaRegistry.latest(event.type)?.standards?.replayable ?? true });
        this.emitEvent('event.dead-lettered', event, { handlerName: subscription.name, attempt: subscription.retry.maxAttempts, details: { reason } });
      }
    }
  }

  private emitEvent(name: EventBusSignal['name'], event: RaceDayEvent, extra: Partial<EventBusSignal> = {}): void {
    this.emit({ name, eventId: event.id, eventType: event.type, correlationId: event.correlationId, traceId: event.trace.traceId, ...extra });
  }

  private emit(signal: Omit<EventBusSignal, 'timestamp'>): void {
    const enriched = { ...signal, timestamp: new Date().toISOString() };
    for (const hook of this.hooks) hook(enriched);
  }

  private ensureProducerSchema(eventType: EventName, profile: EventProducerProfile): void {
    if (this.schemaRegistry.latest(eventType)) return;
    this.registerEvent({ type: eventType, version: 1, description: `Auto-registered ${String(eventType)} producer contract`, owner: profile.owner, payloadFields: [], compliance: 'internal', operationalMetadata: { autoRegistered: true, registeredFrom: 'producer-profile' } });
  }

  private validateContract<T>(schema: EventContract<T>): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!schema.type) errors.push('event type is required');
    if (!Number.isInteger(schema.version) || schema.version < 1) errors.push('event version must be a positive integer');
    if (!schema.description) errors.push('event description is required');
    if (!schema.owner?.service || !schema.owner.team || !schema.owner.accountableRole) errors.push('event owner service, team, and accountableRole are required');
    if (new Set(schema.payloadFields).size !== schema.payloadFields.length) errors.push('payloadFields must be unique');
    if (schema.standards?.replayable === false) warnings.push('non-replayable events are discouraged in TrackMind Nexus');
    return { valid: errors.length === 0, errors, warnings };
  }

  private validatePayload<T>(schema: EventContract<T>, payload: T): EventValidationResult {
    const errors: string[] = [];
    const payloadRecord = isRecord(payload) ? payload : {};
    for (const field of schema.payloadFields) if (!(field in payloadRecord)) errors.push(`missing required payload field: ${field}`);
    const validation = errors.length ? undefined : schema.validate?.(payload);
    if (validation === false) errors.push('custom validator returned false');
    else if (Array.isArray(validation)) errors.push(...validation);
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  private validateStandards(schema: EventContract, event: RaceDayEvent): string[] {
    const standards = schema.standards;
    if (!standards) return [];
    const errors: string[] = [];
    const required = new Set<EventContextField>(standards.requiredMetadata ?? []);
    if (standards.tenantScoped) required.add('tenantId');
    if (standards.racetrackScoped) required.add('racetrackId');
    if (standards.correlationRequired) required.add('correlationId');
    if (standards.auditRequired) required.add('auditRef');
    if (standards.digitalTwinReferenceRequired) required.add('digitalTwinRef');
    if (standards.approvalReferenceRequired) required.add('approvalRef');
    if (standards.workflowReferenceRequired) required.add('workflowRef');
    for (const field of required) {
      if (field === 'tenantId' && !event.context.tenantId) errors.push('tenantId is required by event standards');
      if (field === 'racetrackId' && !event.context.racetrackId) errors.push('racetrackId is required by event standards');
      if (field === 'correlationId' && !event.correlationId) errors.push('correlationId is required by event standards');
      if (field === 'causationId' && !event.lineage.causationId) errors.push('causationId is required by event standards');
      if (field === 'aggregateId' && !event.lineage.aggregateId) errors.push('aggregateId is required by event standards');
      if (field === 'actor' && !event.context.actor?.id) errors.push('actor is required by event standards');
      if (field === 'subject' && !event.context.subject?.id) errors.push('subject is required by event standards');
      if (field === 'payload' && !event.payload) errors.push('payload is required by event standards');
      if (field === 'evidence' && event.context.evidence.length === 0) errors.push('evidence is required by event standards');
      if (field === 'auditRef' && event.context.auditRefs.length === 0) errors.push('auditRef is required by event standards');
      if (field === 'digitalTwinRef' && event.context.digitalTwinRefs.length === 0) errors.push('digitalTwinRef is required by event standards');
      if (field === 'approvalRef' && !event.context.approvalRef) errors.push('approvalRef is required by event standards');
      if (field === 'workflowRef' && !event.context.workflowRef) errors.push('workflowRef is required by event standards');
    }
    if (event.context.subject?.tenantId && event.context.tenantId && event.context.subject.tenantId !== event.context.tenantId) errors.push('subject tenantId must match event tenantId');
    const eventType = `${String(event.type).replace(/\.v\d+$/, '')}.v${event.version}` as `${string}.${string}.${string}.v${number}`;
    const envelopeValidation = validateNexusEventEnvelope({
      eventId: event.id,
      eventType,
      tenantId: event.context.tenantId ?? '',
      occurredAt: event.occurredAt,
      actor: event.context.actor ?? { id: event.lineage.producer, type: 'service' },
      correlationId: event.correlationId,
      subject: event.context.subject ?? { id: event.lineage.aggregateId ?? event.id, type: 'event', tenantId: event.context.tenantId ?? '' },
      payload: isRecord(event.payload) ? event.payload : { value: event.payload },
      evidence: event.context.evidence,
    });
    if (!envelopeValidation.allowed) errors.push(envelopeValidation.reason);
    return errors;
  }

  private deriveContext<T>(input: PublishInput<T>, schema: EventContract): EventBackboneContext {
    const payload: Record<string, unknown> = isRecord(input.payload) ? input.payload : {};
    const nestedAsset: Record<string, unknown> = isRecord(payload.asset) ? payload.asset : {};
    const metadata = input.metadata ?? {};
    const explicit = input.context ?? {};
    const tenantId = input.tenantId ?? explicit.tenantId ?? stringValue(metadata.tenantId) ?? stringValue(payload.tenantId) ?? stringValue(nestedAsset.tenantId);
    const racetrackId = input.racetrackId ?? explicit.racetrackId ?? stringValue(metadata.racetrackId) ?? stringValue(payload.racetrackId) ?? stringValue(payload.trackId) ?? stringValue(nestedAsset.racetrackId);
    const auditRefs = [...new Set([input.auditRef, explicit.auditRef, stringValue(metadata.auditRef), stringValue(payload.auditRef), ...arrayOfStrings(explicit.auditRefs), ...arrayOfStrings(metadata.auditRefs), ...arrayOfStrings(payload.auditRefs)].filter((item): item is string => Boolean(item)))];
    const digitalTwinRefs = [...new Set([input.digitalTwinRef, explicit.digitalTwinRef, stringValue(metadata.digitalTwinRef), stringValue(payload.digitalTwinRef), stringValue(payload.twinId), stringValue(nestedAsset.digitalTwin && isRecord(nestedAsset.digitalTwin) ? nestedAsset.digitalTwin.twinId : undefined), ...arrayOfStrings(input.digitalTwinRefs), ...arrayOfStrings(explicit.digitalTwinRefs), ...arrayOfStrings(metadata.digitalTwinRefs), ...arrayOfStrings(payload.digitalTwinRefs)].filter((item): item is string => Boolean(item)))];
    const evidence = [...new Set([...(input.evidence ?? []), ...(explicit.evidence ?? []), ...arrayOfStrings(metadata.evidence), ...arrayOfStrings(payload.evidence), ...auditRefs])];
    const actor = input.actor ?? explicit.actor ?? (stringValue(payload.actor) ? { id: stringValue(payload.actor)!, type: 'human' as const } : { id: input.producer ?? schema.owner.service, type: 'service' as const });
    const subject = input.subject ?? explicit.subject ?? (input.aggregateId || stringValue(payload.subjectId) ? { id: input.aggregateId ?? stringValue(payload.subjectId)!, type: stringValue(payload.subjectType) ?? 'aggregate', tenantId: tenantId ?? stringValue(payload.subjectTenantId) ?? 'unknown-tenant' } : undefined);
    return {
      tenantId,
      racetrackId,
      actor,
      subject,
      evidence,
      auditRef: auditRefs[0],
      auditRefs,
      digitalTwinRef: digitalTwinRefs[0],
      digitalTwinRefs,
      approvalRef: input.approvalRef ?? explicit.approvalRef ?? stringValue(metadata.approvalRef) ?? stringValue(payload.approvalRef) ?? stringValue(payload.approvalId),
      workflowRef: input.workflowRef ?? explicit.workflowRef ?? stringValue(metadata.workflowRef) ?? stringValue(payload.workflowRef) ?? stringValue(payload.workflowId),
      sourceService: input.producer ?? explicit.sourceService ?? schema.owner.service,
      frontendRoute: explicit.frontendRoute ?? stringValue(metadata.frontendRoute),
    };
  }

  private matchesReplayFilter(event: RaceDayEvent, filter: EventReplayFilter): boolean {
    return (!filter.type || event.type === filter.type)
      && (!filter.types || filter.types.includes(event.type))
      && (!filter.correlationId || event.correlationId === filter.correlationId)
      && (!filter.tenantId || event.context.tenantId === filter.tenantId)
      && (!filter.racetrackId || event.context.racetrackId === filter.racetrackId)
      && (!filter.aggregateId || event.lineage.aggregateId === filter.aggregateId)
      && (!filter.fromSequence || event.lineage.sequence >= filter.fromSequence)
      && (!filter.toSequence || event.lineage.sequence <= filter.toSequence)
      && (!filter.fromOccurredAt || event.occurredAt >= filter.fromOccurredAt)
      && (!filter.toOccurredAt || event.occurredAt <= filter.toOccurredAt);
  }
}

export class EventProducer {
  constructor(private readonly bus: UniversalEventBus, private readonly name: string) {}
  publish<T>(input: Omit<PublishInput<T>, 'producer'>): Promise<RaceDayEvent<T>> { return this.bus.publish({ ...input, producer: this.name }); }
}

export class EventConsumer {
  constructor(private readonly bus: UniversalEventBus, private readonly name: string) {}
  subscribe(type: EventName | '*', handler: Handler, retry?: Partial<RetryPolicy>): () => void { return this.bus.subscribe(type, handler, { name: this.name, retry }); }
}

export function bindAuditLogToEvents(bus: UniversalEventBus, auditLog: { append(record: { id: string; type: string; actor: string; actorType?: string; timestamp: string; action?: string; sourceService?: string; payload: unknown; subjectId?: string; tenantId?: string; workflowId?: string; correlationId?: string; severity?: string; regulations?: string[]; evidenceIds?: string[] }): unknown }, options: { consumerName?: string; includeTypes?: EventName[]; excludeTypes?: EventName[] } = {}): () => void {
  return bus.subscribe('*', (event) => {
    if (options.includeTypes && !options.includeTypes.includes(event.type)) return;
    if (options.excludeTypes?.includes(event.type)) return;
    auditLog.append({ id: `audit:${event.id}`, type: 'system-event', actor: event.context.actor?.id ?? event.lineage.producer, actorType: event.context.actor?.type ?? 'service', timestamp: event.occurredAt, action: String(event.type), sourceService: event.lineage.producer, payload: { eventId: event.id, eventType: event.type, schemaRef: event.schemaRef, trace: event.trace, lineage: event.lineage, context: event.context, metadata: event.metadata, payload: event.payload }, subjectId: event.context.subject?.id ?? event.lineage.aggregateId, tenantId: event.context.tenantId, workflowId: event.context.workflowRef, correlationId: event.correlationId, severity: event.compliance === 'restricted' ? 'critical' : event.compliance === 'regulated' ? 'warning' : 'info', regulations: arrayOfStrings(event.metadata.regulations), evidenceIds: event.context.evidence });
  }, { name: options.consumerName ?? 'audit-log-event-sink', retry: { maxAttempts: 1 } });
}

export class InMemoryEventBus extends UniversalEventBus {}

export function createNexusEventCatalog(contracts: readonly NexusEventContract[] = nexusEventContracts): EventContract[] {
  return contracts.map((contract) => ({
    type: contract.eventType,
    version: contract.version,
    description: contract.name,
    owner: { service: `nexus-${contract.aggregate.toLowerCase()}-service`, team: 'racetrack-platform', accountableRole: `${contract.aggregate} event owner` },
    payloadFields: contract.payloadFields,
    compliance: contract.auditRequired ? 'regulated' : 'internal',
    operationalMetadata: { aggregate: contract.aggregate, requiredMetadata: [...contract.requiredMetadata], catalog: 'trackmind-nexus', auditRequired: contract.auditRequired, digitalTwinReferenceRequired: contract.digitalTwinReferenceRequired },
    standards: {
      tenantScoped: contract.requiredMetadata.includes('tenantId'),
      racetrackScoped: contract.requiredMetadata.includes('racetrackId'),
      correlationRequired: contract.requiredMetadata.includes('correlationId'),
      auditRequired: contract.auditRequired,
      digitalTwinReferenceRequired: contract.digitalTwinReferenceRequired,
      replayable: contract.replayable,
      requiredMetadata: ['tenantId', 'racetrackId', 'correlationId', 'aggregateId', 'actor', 'subject', 'payload', 'auditRef', ...(contract.digitalTwinReferenceRequired ? ['digitalTwinRef' as const] : []), 'evidence'],
      cqrsProjection: `${contract.aggregate.toLowerCase()}.read-model`,
      observabilitySignals: ['event.published', 'handler.delivered', 'event.dead-lettered', 'event.replayed'],
      frontendConsumers: ['operations-command', 'platform-health'],
    },
    examples: [],
  }));
}

export function registerNexusEventCatalog(bus: UniversalEventBus): string[] {
  return bus.registerCatalog(createNexusEventCatalog());
}
