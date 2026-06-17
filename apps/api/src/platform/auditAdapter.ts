import type { AuditEventDto, AuditSearchQueryDto } from '@trackmind/shared';
import type { ImmutableAuditLog } from '../auditLog.js';
import { createRepository } from '../repository/index.js';

export class AuditPersistenceAdapter {
  private persistedEvents: ReturnType<typeof createRepository<AuditEventDto & { id: string }>>;

  constructor(private ledger: ImmutableAuditLog) {
    this.persistedEvents = createRepository([]);
  }

  syncFromLedger(events: AuditEventDto[]): void {
    for (const event of events) {
      const id = event.auditEventId ?? event.id;
      this.persistedEvents.upsert({ ...event, id });
    }
  }

  search(query: AuditSearchQueryDto, fallbackEvents: AuditEventDto[] = []): AuditEventDto[] {
    const source = this.persistedEvents.list().length ? this.persistedEvents.list() : fallbackEvents.map((e) => ({ ...e, id: e.auditEventId ?? e.id }));
    let results = source as AuditEventDto[];
    if (query.actorId) results = results.filter((e) => e.actorId === query.actorId || e.actor?.actorId === query.actorId);
    if (query.domain) results = results.filter((e) => e.type?.includes(query.domain!) || e.action?.includes(query.domain!));
    if (query.correlationId) results = results.filter((e) => e.correlationId === query.correlationId);
    if (query.from) results = results.filter((e) => e.timestamp >= query.from!);
    if (query.to) results = results.filter((e) => e.timestamp <= query.to!);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  appendUnified(event: AuditEventDto): AuditEventDto {
    const id = event.auditEventId ?? event.id;
    this.persistedEvents.upsert({ ...event, id });
    return event;
  }
}

export function createAuditPersistenceAdapter(ledger: ImmutableAuditLog): AuditPersistenceAdapter {
  return new AuditPersistenceAdapter(ledger);
}
