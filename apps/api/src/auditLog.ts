export type AuditEventType = 'user-action' | 'ai-recommendation' | 'expert-call' | 'approval' | 'data-change' | 'security-event' | 'rulebook-citation';

export interface AuditLogEntry {
  id: string;
  type: AuditEventType;
  actor: string;
  timestamp: string;
  payload: unknown;
  previousHash: string;
  hash: string;
}

export class ImmutableAuditLog {
  private readonly logs: Readonly<AuditLogEntry>[] = [];

  append(log: Omit<AuditLogEntry, 'previousHash' | 'hash'>): AuditLogEntry {
    const previousHash = this.logs.at(-1)?.hash ?? 'genesis';
    const hash = `${previousHash}:${log.id}:${JSON.stringify(log.payload).length}`;
    const entry = Object.freeze({ ...log, previousHash, hash });
    this.logs.push(entry);
    return entry;
  }

  all(): AuditLogEntry[] {
    return this.logs.map((entry) => ({ ...entry }));
  }
}
