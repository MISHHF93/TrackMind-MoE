import type { AuditEventDto, AuditSearchQueryDto } from '@trackmind/shared';
import type { AuditLogEntry, AuditRecordInput, ImmutableAuditLog } from './auditLog.js';
import { createRepository } from './repository/index.js';

const exportFields = [
  'auditEventId',
  'actor',
  'entity',
  'action',
  'reason',
  'approvalReference',
  'timestamp',
  'tenantScope',
  'integrityReference',
  'id',
  'hash',
  'previousHash',
] as const;

export function auditLogEntryToDto(entry: AuditLogEntry, mock = false): AuditEventDto {
  return {
    auditEventId: entry.auditEventId,
    actor: {
      actorId: entry.actor.actorId,
      actorType: entry.actor.actorType ?? 'service',
      roles: entry.actor.roles,
    },
    entity: entry.entity,
    action: entry.action ?? entry.type,
    reason: entry.reason,
    approvalReference: entry.approvalReference,
    timestamp: entry.timestamp,
    tenantScope: entry.tenantScope,
    integrityReference: entry.integrityReference,
    id: entry.id,
    type: entry.type,
    actorId: entry.actorId,
    subjectId: entry.subjectId,
    severity: entry.severity ?? 'info',
    hash: entry.hash,
    previousHash: entry.previousHash,
    mock,
    correlationId: entry.correlationId,
    workflowId: entry.workflowId,
    affectedAssets: entry.subjectId ? [entry.subjectId] : [],
    evidenceIds: entry.evidenceIds ?? [],
    retainedUntil: entry.retainedUntil,
    exportFields: [...exportFields],
  };
}

function domainHaystack(event: AuditEventDto): string {
  return [
    event.type,
    event.action,
    event.entity?.entityType,
    event.subjectId,
    ...(event.affectedAssets ?? []),
    ...(event.evidenceIds ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
}

export class AuditPersistenceAdapter {
  private persistedEvents: ReturnType<typeof createRepository<AuditEventDto & { id: string }>>;

  constructor(private readonly ledger: ImmutableAuditLog) {
    this.persistedEvents = createRepository([]);
  }

  syncFromLedger(fallbackEvents: AuditEventDto[] = []): void {
    const ledgerEvents = this.ledger.all().map((entry) => auditLogEntryToDto(entry));
    const source = ledgerEvents.length ? ledgerEvents : fallbackEvents;
    for (const event of source) {
      const id = event.auditEventId ?? event.id;
      this.persistedEvents.upsert({ ...event, id });
    }
  }

  search(query: AuditSearchQueryDto, fallbackEvents: AuditEventDto[] = []): AuditEventDto[] {
    if (!this.persistedEvents.list().length) this.syncFromLedger(fallbackEvents);
    let results = this.persistedEvents.list() as AuditEventDto[];
    if (query.actorId) {
      results = results.filter((event) => event.actorId === query.actorId || event.actor?.actorId === query.actorId);
    }
    if (query.domain) {
      const domain = query.domain.toLowerCase();
      results = results.filter((event) => domainHaystack(event).includes(domain));
    }
    if (query.correlationId) {
      results = results.filter((event) => event.correlationId === query.correlationId);
    }
    if (query.from) {
      results = results.filter((event) => event.timestamp >= query.from!);
    }
    if (query.to) {
      results = results.filter((event) => event.timestamp <= query.to!);
    }
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

export interface AuditAppendTarget {
  ledger: ImmutableAuditLog;
  adapter?: AuditPersistenceAdapter;
  mock?: boolean;
}

export function appendAudit(target: AuditAppendTarget, record: AuditRecordInput): AuditEventDto {
  const entry = target.ledger.append(record);
  const dto = auditLogEntryToDto(entry, target.mock ?? false);
  target.adapter?.appendUnified(dto);
  return dto;
}

export function createAuditAppendSink(target: AuditAppendTarget): { append(record: AuditRecordInput): AuditEventDto; appendAudit(record: AuditRecordInput): AuditEventDto } {
  return {
    append: (record) => appendAudit(target, record),
    appendAudit: (record) => appendAudit(target, record),
  };
}
