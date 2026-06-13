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
  private readonly schemas = new Map<string, EventSchema>();

  register<T>(schema: EventSchema<T>): string {
    const key = this.ref(schema.type, schema.version);
    this.schemas.set(key, { ...(schema as EventSchema), dependencies: [...(schema.dependencies ?? [])], operationalMetadata: { ...(schema.operationalMetadata ?? {}) } });
    return key;
  }

  get(type: EventName, version: number): EventSchema {
    const schema = this.schemas.get(this.ref(type, version));
    if (!schema) throw new Error(`event schema not registered: ${String(type)}@v${version}`);
    return schema;
  }

  latest(type: EventName): EventSchema | undefined {
    return [...this.schemas.values()].filter((schema) => schema.type === type).sort((a, b) => b.version - a.version)[0];
  }

  all(): EventSchema[] {
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
  private sequence = 0;

  registerEvent<T>(schema: EventSchema<T>): string {
    const ref = this.schemaRegistry.register(schema);
    this.emit({ name: 'schema.registered', eventType: schema.type, details: { schemaRef: ref, owner: schema.owner, compliance: schema.compliance } });
    return ref;
  }

  subscribe(type: EventName | '*', handler: Handler, options: { name?: string; retry?: Partial<RetryPolicy> } = {}): () => void {
    const subscription = { name: options.name ?? `handler:${String(type)}:${this.subscriptions.length + 1}`, type, handler, retry: { ...defaultRetry, ...(options.retry ?? {}) } };
    this.subscriptions.push(subscription);
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
    const validation = schema.validate?.(input.payload);
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

  governanceCatalog(): Array<EventSchema & { schemaRef: string }> {
    return this.schemaRegistry.all().map((schema) => ({ ...schema, schemaRef: this.schemaRegistry.ref(schema.type, schema.version) }));
  }

  private ensureSchema(type: EventName, version: number, input: PublishInput): EventSchema {
    const existing = this.schemaRegistry.latest(type);
    if (existing && existing.version === version) return existing;
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
}

export class InMemoryEventBus extends UniversalEventBus {}
