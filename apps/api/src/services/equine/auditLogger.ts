import { createHash } from 'node:crypto';

export interface EquineAuditEvent {
  eventId: string;
  horseId: string;
  type: string;
  actorId: string;
  role: string;
  occurredAt: string;
  payload: unknown;
  previousHash: string;
  hash: string;
}

export interface EquineAuditVerification {
  valid: boolean;
  checked: number;
  failures: Array<{ eventId: string; reason: string }>;
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`).join(',')}}`;
}

function digest(value: unknown): string {
  const input = stable(value);
  return `sha256:${createHash('sha256').update(input).digest('hex')}`;
}

export class EquineAuditLogger {
  private readonly events: EquineAuditEvent[] = [];

  append(input: Omit<EquineAuditEvent, 'eventId' | 'previousHash' | 'hash'> & { eventId?: string }): EquineAuditEvent {
    const previousHash = this.events.at(-1)?.hash ?? 'genesis';
    const base = clone({ ...input, eventId: input.eventId ?? id('equine-audit'), previousHash });
    const event = { ...base, hash: digest(base) };
    this.events.push(event);
    return clone(event);
  }

  eventsForHorse(horseId: string): EquineAuditEvent[] {
    return this.events.filter((event) => event.horseId === horseId).map(clone);
  }

  all(): EquineAuditEvent[] {
    return this.events.map(clone);
  }

  verify(): EquineAuditVerification {
    const failures: EquineAuditVerification['failures'] = [];
    this.events.forEach((event, index) => {
      const expectedPrevious = index === 0 ? 'genesis' : this.events[index - 1].hash;
      if (event.previousHash !== expectedPrevious) failures.push({ eventId: event.eventId, reason: 'previous-hash-mismatch' });
      const { hash, ...unsigned } = event;
      if (hash !== digest(unsigned)) failures.push({ eventId: event.eventId, reason: 'hash-mismatch' });
    });
    return { valid: failures.length === 0, checked: this.events.length, failures };
  }
}
