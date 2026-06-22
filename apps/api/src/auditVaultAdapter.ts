import { createHash } from 'node:crypto';
import type { AuditEventDto, AuditSearchQueryDto } from '@trackmind/shared';

export interface AuditVaultRecord {
  sequenceNumber: number;
  auditEventId: string;
  sealedAt: string;
  contentHash: string;
  wormPolicy: 'immutable';
  event: AuditEventDto;
}

export interface AuditVaultExportQuery extends AuditSearchQueryDto {
  generatedBy?: string;
  format?: 'json' | 'ndjson';
}

export interface AuditVaultExportDescriptor {
  exportId: string;
  generatedAt: string;
  generatedBy: string;
  recordCount: number;
  contentHash: string;
  format: 'json' | 'ndjson';
  mimeType: string;
  downloadUri: string;
  sealed: true;
  mock: boolean;
  query?: AuditSearchQueryDto;
}

export interface AuditVaultAdapter {
  readonly enabled: boolean;
  readonly mock: boolean;
  appendRecord(event: AuditEventDto): AuditVaultRecord;
  listExports(limit?: number): AuditVaultExportDescriptor[];
  createExport(query: AuditVaultExportQuery, events: AuditEventDto[]): AuditVaultExportDescriptor;
  getExport(exportId: string): AuditVaultExportDescriptor | undefined;
  getExportBlob(exportId: string): { content: string; mimeType: string } | undefined;
  recordCount(): number;
  syncFromEvents(events: AuditEventDto[]): void;
}

export interface AuditVaultAdapterOptions {
  enabled?: boolean;
  mock?: boolean;
  downloadBaseUri?: string;
}

function digest(value: unknown): string {
  const input = JSON.stringify(value);
  return `sha256:${createHash('sha256').update(input).digest('hex')}`;
}

function filterEvents(events: AuditEventDto[], query: AuditSearchQueryDto): AuditEventDto[] {
  let results = [...events];
  if (query.actorId) {
    results = results.filter((event) => event.actorId === query.actorId || event.actor?.actorId === query.actorId);
  }
  if (query.domain) {
    const domain = query.domain.toLowerCase();
    results = results.filter((event) => [
      event.type,
      event.action,
      event.entity?.entityType,
      event.subjectId,
      ...(event.affectedAssets ?? []),
      ...(event.evidenceIds ?? []),
    ].filter(Boolean).join(' ').toLowerCase().includes(domain));
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

class InMemoryWormAuditVault implements AuditVaultAdapter {
  private readonly records: AuditVaultRecord[] = [];
  private readonly exports = new Map<string, { descriptor: AuditVaultExportDescriptor; content: string }>();
  private readonly sealedIds = new Set<string>();

  constructor(
    readonly enabled: boolean,
    readonly mock: boolean,
    private readonly downloadBaseUri: string,
  ) {}

  appendRecord(event: AuditEventDto): AuditVaultRecord {
    if (!this.enabled) {
      throw new Error('Audit vault adapter is disabled.');
    }
    const auditEventId = event.auditEventId ?? event.id;
    if (this.sealedIds.has(auditEventId)) {
      throw new Error(`WORM violation: audit record ${auditEventId} is already sealed and cannot be modified.`);
    }
    const record: AuditVaultRecord = {
      sequenceNumber: this.records.length + 1,
      auditEventId,
      sealedAt: new Date().toISOString(),
      contentHash: digest(event),
      wormPolicy: 'immutable',
      event,
    };
    this.records.push(record);
    this.sealedIds.add(auditEventId);
    return record;
  }

  listExports(limit = 50): AuditVaultExportDescriptor[] {
    return [...this.exports.values()]
      .map((entry) => entry.descriptor)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
      .slice(0, limit);
  }

  createExport(query: AuditVaultExportQuery, events: AuditEventDto[]): AuditVaultExportDescriptor {
    if (!this.enabled) {
      throw new Error('Audit vault adapter is disabled.');
    }
    const format = query.format ?? 'json';
    const filtered = filterEvents(events, query);
    const generatedAt = new Date().toISOString();
    const generatedBy = query.generatedBy ?? 'audit-vault-adapter';
    const exportId = `worm-export-${generatedAt.replace(/[:.]/g, '-')}-${filtered.length}`;
    const content = format === 'ndjson'
      ? filtered.map((event) => JSON.stringify(event)).join('\n')
      : JSON.stringify({ exportId, generatedAt, generatedBy, recordCount: filtered.length, records: filtered }, null, 2);
    const mimeType = format === 'ndjson' ? 'application/x-ndjson' : 'application/json';
    const descriptor: AuditVaultExportDescriptor = {
      exportId,
      generatedAt,
      generatedBy,
      recordCount: filtered.length,
      contentHash: digest(content),
      format,
      mimeType,
      downloadUri: `${this.downloadBaseUri}/${exportId}`,
      sealed: true,
      mock: this.mock,
      query: {
        actorId: query.actorId,
        domain: query.domain,
        correlationId: query.correlationId,
        from: query.from,
        to: query.to,
        limit: query.limit,
        offset: query.offset,
      },
    };
    this.exports.set(exportId, { descriptor, content });
    return descriptor;
  }

  getExport(exportId: string): AuditVaultExportDescriptor | undefined {
    return this.exports.get(exportId)?.descriptor;
  }

  getExportBlob(exportId: string): { content: string; mimeType: string } | undefined {
    const entry = this.exports.get(exportId);
    if (!entry) return undefined;
    return { content: entry.content, mimeType: entry.descriptor.mimeType };
  }

  recordCount(): number {
    return this.records.length;
  }

  syncFromEvents(events: AuditEventDto[]): void {
    if (!this.enabled) return;
    for (const event of events) {
      const auditEventId = event.auditEventId ?? event.id;
      if (this.sealedIds.has(auditEventId)) continue;
      this.appendRecord(event);
    }
  }
}

class DisabledAuditVault implements AuditVaultAdapter {
  readonly enabled = false;
  readonly mock = true;

  appendRecord(): AuditVaultRecord {
    throw new Error('Audit vault adapter is disabled.');
  }

  listExports(): AuditVaultExportDescriptor[] {
    return [];
  }

  createExport(): AuditVaultExportDescriptor {
    throw new Error('Audit vault adapter is disabled.');
  }

  getExport(): undefined {
    return undefined;
  }

  getExportBlob(): undefined {
    return undefined;
  }

  recordCount(): number {
    return 0;
  }

  syncFromEvents(): void {}
}

export function resolveAuditVaultEnabled(): boolean {
  const value = process.env.TRACKMIND_AUDIT_VAULT_ENABLED;
  if (value === undefined) return true;
  return !['0', 'false', 'off', 'disabled'].includes(value.toLowerCase());
}

export function createAuditVaultAdapter(options: AuditVaultAdapterOptions = {}): AuditVaultAdapter {
  const enabled = options.enabled ?? resolveAuditVaultEnabled();
  if (!enabled) return new DisabledAuditVault();
  return new InMemoryWormAuditVault(
    true,
    options.mock ?? true,
    options.downloadBaseUri ?? 'audit-vault://exports',
  );
}
