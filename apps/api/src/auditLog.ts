export type AuditEventType =
  | 'user-action'
  | 'workflow-action'
  | 'ai-recommendation'
  | 'expert-call'
  | 'system-event'
  | 'approval'
  | 'data-change'
  | 'configuration-change'
  | 'security-event'
  | 'digital-twin-update'
  | 'regulatory-activity'
  | 'rulebook-citation';

export type AuditSeverity = 'info' | 'warning' | 'critical';
export type RetentionDisposition = 'retain' | 'eligible-for-disposal' | 'legal-hold';

export interface ChainOfCustodyStep {
  actor: string;
  action: 'created' | 'accessed' | 'exported' | 'transferred' | 'sealed' | 'placed-on-hold' | 'released-from-hold';
  timestamp: string;
  location?: string;
  reason?: string;
}

export interface AuditLogEntry {
  id: string;
  type: AuditEventType;
  actor: string;
  timestamp: string;
  payload: unknown;
  previousHash: string;
  hash: string;
  subjectId?: string;
  tenantId?: string;
  workflowId?: string;
  correlationId?: string;
  severity?: AuditSeverity;
  regulations?: string[];
  evidenceIds?: string[];
  custody?: ChainOfCustodyStep[];
  retainedUntil?: string;
  legalHold?: boolean;
}

export interface AuditRecordInput extends Omit<AuditLogEntry, 'previousHash' | 'hash'> {}
export interface RetentionPolicy { id: string; eventTypes: AuditEventType[]; retainForDays: number; regulatoryBasis: string }
export interface EvidenceItem { id: string; recordId: string; uri: string; hash: string; collectedBy: string; collectedAt: string; description?: string; legalHold?: boolean }
export interface AuditVerificationResult { valid: boolean; checked: number; failures: Array<{ id: string; reason: string }> }
export interface ForensicTimelineStep { sequence: number; id: string; type: AuditEventType; actor: string; timestamp: string; subjectId?: string; workflowId?: string; correlationId?: string; payload: unknown }

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`).join(',')}}`;
}

function digest(value: unknown): string {
  const input = stable(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sha256:${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export class ImmutableAuditLog {
  private readonly logs: Readonly<AuditLogEntry>[] = [];

  append(log: AuditRecordInput): AuditLogEntry {
    const previousHash = this.logs.at(-1)?.hash ?? 'genesis';
    const custody = log.custody?.map((step) => ({ ...step })) ?? [{ actor: log.actor, action: 'created' as const, timestamp: log.timestamp }];
    const unsigned = { ...log, previousHash, custody, evidenceIds: [...(log.evidenceIds ?? [])], regulations: [...(log.regulations ?? [])] };
    const entry = Object.freeze({ ...unsigned, hash: digest(unsigned) });
    this.logs.push(entry);
    return this.clone(entry);
  }

  all(): AuditLogEntry[] { return this.logs.map((entry) => this.clone(entry)); }

  verify(): AuditVerificationResult {
    const failures: AuditVerificationResult['failures'] = [];
    this.logs.forEach((entry, index) => {
      const { hash, ...unsigned } = entry;
      const expectedPrevious = index === 0 ? 'genesis' : this.logs[index - 1].hash;
      if (entry.previousHash !== expectedPrevious) failures.push({ id: entry.id, reason: 'previous-hash-mismatch' });
      if (hash !== digest(unsigned)) failures.push({ id: entry.id, reason: 'record-hash-mismatch' });
    });
    return { valid: failures.length === 0, checked: this.logs.length, failures };
  }

  addCustodyStep(recordId: string, step: ChainOfCustodyStep): AuditLogEntry {
    const current = this.logs.find((entry) => entry.id === recordId);
    if (!current) throw new Error(`Unknown audit record ${recordId}`);
    return this.append({ ...this.clone(current), id: `${recordId}:custody:${(current.custody?.length ?? 0) + 1}`, type: 'system-event', actor: step.actor, timestamp: step.timestamp, payload: { custodyFor: recordId, action: step.action, reason: step.reason }, custody: [...(current.custody ?? []), { ...step }], subjectId: current.subjectId, correlationId: current.correlationId, workflowId: current.workflowId, tenantId: current.tenantId, severity: current.severity, regulations: current.regulations, evidenceIds: current.evidenceIds, retainedUntil: current.retainedUntil, legalHold: current.legalHold || step.action === 'placed-on-hold' });
  }

  placeLegalHold(recordIds: string[], actor: string, timestamp: string, reason: string): AuditLogEntry[] {
    return recordIds.map((recordId) => this.addCustodyStep(recordId, { actor, action: 'placed-on-hold', timestamp, reason }));
  }

  forensicTimeline(filter: { subjectId?: string; workflowId?: string; correlationId?: string; actor?: string }): ForensicTimelineStep[] {
    return this.all().filter((entry) => (!filter.subjectId || entry.subjectId === filter.subjectId) && (!filter.workflowId || entry.workflowId === filter.workflowId) && (!filter.correlationId || entry.correlationId === filter.correlationId) && (!filter.actor || entry.actor === filter.actor)).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((entry, index) => ({ sequence: index + 1, id: entry.id, type: entry.type, actor: entry.actor, timestamp: entry.timestamp, subjectId: entry.subjectId, workflowId: entry.workflowId, correlationId: entry.correlationId, payload: entry.payload }));
  }

  complianceReport(regulation: string) {
    const records = this.all().filter((entry) => entry.regulations?.includes(regulation));
    return { regulation, recordCount: records.length, evidenceIds: [...new Set(records.flatMap((entry) => entry.evidenceIds ?? []))], legalHoldCount: records.filter((entry) => entry.legalHold).length, verified: this.verify().valid };
  }

  retentionDisposition(now: string, policies: RetentionPolicy[]) {
    return this.all().map((entry) => {
      const policy = policies.find((candidate) => candidate.eventTypes.includes(entry.type));
      const retainedUntil = entry.retainedUntil ?? (policy ? new Date(Date.parse(entry.timestamp) + policy.retainForDays * 86_400_000).toISOString().slice(0, 10) : undefined);
      const disposition: RetentionDisposition = entry.legalHold ? 'legal-hold' : retainedUntil && retainedUntil < now.slice(0, 10) ? 'eligible-for-disposal' : 'retain';
      return { id: entry.id, policyId: policy?.id, retainedUntil, disposition, regulatoryBasis: policy?.regulatoryBasis };
    });
  }

  private clone(entry: Readonly<AuditLogEntry>): AuditLogEntry {
    return { ...entry, regulations: [...(entry.regulations ?? [])], evidenceIds: [...(entry.evidenceIds ?? [])], custody: entry.custody?.map((step) => ({ ...step })) };
  }
}

export class AuditEvidenceCollectionVault {
  private readonly items = new Map<string, EvidenceItem>();
  collect(item: Omit<EvidenceItem, 'hash'> & { content: unknown }): EvidenceItem {
    const evidence = { id: item.id, recordId: item.recordId, uri: item.uri, collectedBy: item.collectedBy, collectedAt: item.collectedAt, description: item.description, legalHold: item.legalHold, hash: digest(item.content) };
    this.items.set(evidence.id, evidence);
    return { ...evidence };
  }
  forRecord(recordId: string): EvidenceItem[] { return [...this.items.values()].filter((item) => item.recordId === recordId).map((item) => ({ ...item })); }
}
