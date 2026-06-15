import { eventCategoryFor, eventTypeFor, type CqrsCommand, type DomainEventType, type EventEnvelope } from './definitions.js';
import { synchronizeTimestamps } from '../timeSynchronization.js';

export interface EventHubPublishRecord {
  namespace: string;
  hubName: string;
  partitionKey: string;
  eventId: string;
  eventType: DomainEventType;
  body: EventEnvelope;
}

export interface EventHubPublisher {
  publish(event: EventEnvelope): Promise<EventHubPublishRecord>;
}

export interface HashChainVerificationResult {
  valid: boolean;
  checked: number;
  failures: Array<{ eventId: string; reason: string }>;
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`).join(',')}}`;
}

export function eventDigest(value: unknown): string {
  const input = stable(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sha256:${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export class InMemoryEventHubPublisher implements EventHubPublisher {
  private readonly records: EventHubPublishRecord[] = [];

  constructor(private readonly namespace = 'trackmind-eventhubs', private readonly hubName = 'trackmind-domain-events') {}

  async publish(event: EventEnvelope): Promise<EventHubPublishRecord> {
    const record = { namespace: this.namespace, hubName: this.hubName, partitionKey: event.aggregateId, eventId: event.eventId, eventType: event.eventType, body: clone(event) };
    this.records.push(record);
    return clone(record);
  }

  published(): EventHubPublishRecord[] {
    return this.records.map(clone);
  }
}

export class EventSourcedStore {
  private readonly events: EventEnvelope[] = [];

  constructor(private readonly publisher: EventHubPublisher = new InMemoryEventHubPublisher(), private readonly eventHub = { namespace: 'trackmind-eventhubs', hubName: 'trackmind-domain-events' }) {}

  async append<TPayload extends Record<string, unknown>>(command: CqrsCommand<TPayload>): Promise<EventEnvelope<TPayload>> {
    const previousEventHash = this.events.at(-1)?.eventHash ?? 'genesis';
    const occurredAt = command.occurredAt ?? new Date().toISOString();
    const timestampSynchronization = synchronizeTimestamps([
      { source: 'command.occurredAt', timestamp: occurredAt },
      ...(command.approvalTimestamp ? [{ source: 'approval.timestamp', timestamp: command.approvalTimestamp }] : []),
      { source: 'event-store.append', timestamp: new Date().toISOString() },
      ...(command.sourceTimestamps ?? []),
    ]);
    const base = {
      eventId: id('evt-cqrs'),
      eventType: eventTypeFor(command.type),
      category: eventCategoryFor(command.type),
      aggregateId: command.aggregateId,
      tenantId: command.tenantId,
      racetrackId: command.racetrackId,
      commandId: command.id,
      occurredAt,
      version: 1,
      payload: clone(command.payload),
      previousEventHash,
      ai: {
        model_id: command.ai?.model_id,
        confidence: command.ai?.confidence,
        evidence_links: [...(command.ai?.evidence_links ?? [])],
        annex_iv_uri: command.ai?.annex_iv_uri,
      },
      governance: {
        approval_id: command.approvalId,
        approver_id: command.approverId,
        approval_timestamp: command.approvalTimestamp,
      },
      timestampSynchronization,
      eventHub: {
        namespace: this.eventHub.namespace,
        hubName: this.eventHub.hubName,
        partitionKey: command.aggregateId,
      },
    } satisfies Omit<EventEnvelope<TPayload>, 'eventHash'>;
    const persistedBase = clone(base);
    const event = { ...persistedBase, eventHash: eventDigest(persistedBase) } satisfies EventEnvelope<TPayload>;
    this.events.push(clone(event));
    await this.publisher.publish(event);
    return clone(event);
  }

  all(): EventEnvelope[] {
    return this.events.map(clone);
  }

  stream(aggregateId: string): EventEnvelope[] {
    return this.events.filter((event) => event.aggregateId === aggregateId).map(clone);
  }

  verifyHashChain(): HashChainVerificationResult {
    const failures: HashChainVerificationResult['failures'] = [];
    this.events.forEach((event, index) => {
      const expectedPrevious = index === 0 ? 'genesis' : this.events[index - 1].eventHash;
      if (event.previousEventHash !== expectedPrevious) failures.push({ eventId: event.eventId, reason: 'previous-hash-mismatch' });
      const { eventHash, ...unsigned } = event;
      if (eventHash !== eventDigest(unsigned)) failures.push({ eventId: event.eventId, reason: 'event-hash-mismatch' });
    });
    return { valid: failures.length === 0, checked: this.events.length, failures };
  }
}
