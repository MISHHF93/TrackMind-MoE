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
  metadata?: Record<string, unknown>;
}

export type Handler<T = unknown> = (event: RaceDayEvent<T>) => void | Promise<void>;
export type ObservabilityHook = (signal: EventBusSignal) => void;

export interface EventBusSignal {
  name: 'schema.registered' | 'event.published' | 'handler.delivered' | 'handler.failed' | 'event.dead-lettered' | 'event.replayed';
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
}

interface Subscription {
  name: string;
  type: EventName | '*';
  handler: Handler;
  retry: RetryPolicy;
}

const defaultRetry: RetryPolicy = { maxAttempts: 3, backoffMs: 0 };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export class EventSchemaRegistry {
  private readonly schemas = new Map<string, EventContract>();

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
    return `${String(type)}.v${version}`;
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
    const ref = this.schemaRegistry.register(schema);
    this.emit({ name: 'schema.registered', eventType: schema.type, details: { schemaRef: ref, owner: schema.owner, compliance: schema.compliance } });
    return ref;
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
    const missingFields = schema.payloadFields.filter((field) => !(input.payload && typeof input.payload === 'object' && field in (input.payload as Record<string, unknown>)));
    const validation = missingFields.length ? missingFields.map((field) => `missing required payload field: ${field}`) : schema.validate?.(input.payload);
    if (validation === false || (Array.isArray(validation) && validation.length > 0)) throw new Error(`event payload failed schema validation: ${String(input.type)}@v${version}`);
    const traceId = input.trace?.traceId ?? input.correlationId ?? id('trace');
    const event: RaceDayEvent<T> = {
      id: input.id ?? id('evt'),
      type: input.type,
      version,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload: clone(input.payload),
      correlationId: input.correlationId ?? id('corr'),
      schemaRef: this.schemaRegistry.ref(input.type, version),
      owner: clone(schema.owner),
      compliance: schema.compliance,
      lineage: { causationId: input.causationId, parentEventIds: [...(input.parentEventIds ?? [])], producer: input.producer ?? schema.owner.service, aggregateId: input.aggregateId, sequence: ++this.sequence },
      trace: { traceId, spanId: input.trace?.spanId ?? id('span'), parentSpanId: input.trace?.parentSpanId },
      metadata: { ...(schema.operationalMetadata ?? {}), ...(input.metadata ?? {}) },
    };
    this.registerProducer({ name: event.lineage.producer, service: event.lineage.producer, emits: [event.type], owner: event.owner });
    this.eventStore.push(event);
    this.emitEvent('event.published', event);
    await this.deliver(event);
    return clone(event);
  }

  events(filter: { type?: EventName; correlationId?: string; aggregateId?: string } = {}): RaceDayEvent[] {
    return this.eventStore.filter((event) => (!filter.type || event.type === filter.type) && (!filter.correlationId || event.correlationId === filter.correlationId) && (!filter.aggregateId || event.lineage.aggregateId === filter.aggregateId)).map(clone);
  }

  deadLetterQueue(): DeadLetterEntry[] {
    return this.deadLetters.map(clone);
  }

  async replay(filter: { type?: EventName; fromSequence?: number; toSequence?: number } = {}, options: { deliver?: boolean } = {}): Promise<RaceDayEvent[]> {
    const events = this.eventStore.filter((event) => (!filter.type || event.type === filter.type) && (!filter.fromSequence || event.lineage.sequence >= filter.fromSequence) && (!filter.toSequence || event.lineage.sequence <= filter.toSequence));
    for (const event of events) {
      this.emitEvent('event.replayed', event);
      if (options.deliver) await this.deliver(event, true);
    }
    return events.map(clone);
  }

  governanceCatalog(): Array<EventContract & { schemaRef: string }> {
    return this.schemaRegistry.all().map((schema) => ({ ...schema, schemaRef: this.schemaRegistry.ref(schema.type, schema.version) }));
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
    for (const entry of retryable) await this.deliver(entry.event, true);
    return { retried: retryable.length, remaining: this.deadLetters.length };
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
        this.deadLetters.push({ event: clone(event), handlerName: subscription.name, reason, attempts: subscription.retry.maxAttempts, failedAt: new Date().toISOString() });
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
}

export class EventProducer {
  constructor(private readonly bus: UniversalEventBus, private readonly name: string) {}
  publish<T>(input: Omit<PublishInput<T>, 'producer'>): Promise<RaceDayEvent<T>> { return this.bus.publish({ ...input, producer: this.name }); }
}

export class EventConsumer {
  constructor(private readonly bus: UniversalEventBus, private readonly name: string) {}
  subscribe(type: EventName | '*', handler: Handler, retry?: Partial<RetryPolicy>): () => void { return this.bus.subscribe(type, handler, { name: this.name, retry }); }
}

export function bindAuditLogToEvents(bus: UniversalEventBus, auditLog: { append(record: { id: string; type: string; actor: string; timestamp: string; payload: unknown; subjectId?: string; tenantId?: string; correlationId?: string; severity?: string; regulations?: string[] }): unknown }, options: { consumerName?: string; includeTypes?: EventName[]; excludeTypes?: EventName[] } = {}): () => void {
  return bus.subscribe('*', (event) => {
    if (options.includeTypes && !options.includeTypes.includes(event.type)) return;
    if (options.excludeTypes?.includes(event.type)) return;
    auditLog.append({ id: `audit:${event.id}`, type: 'system-event', actor: event.lineage.producer, timestamp: event.occurredAt, payload: { eventId: event.id, eventType: event.type, schemaRef: event.schemaRef, trace: event.trace, metadata: event.metadata }, subjectId: event.lineage.aggregateId, correlationId: event.correlationId, severity: event.compliance === 'restricted' ? 'critical' : event.compliance === 'regulated' ? 'warning' : 'info' });
  }, { name: options.consumerName ?? 'audit-log-event-sink', retry: { maxAttempts: 1 } });
}

export class InMemoryEventBus extends UniversalEventBus {}
