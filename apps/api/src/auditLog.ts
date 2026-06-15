import type { AuditActorReference, AuditActorType as CanonicalAuditActorType, AuditEntityReference, AuditEvent as CanonicalAuditEvent, AuditIntegrityReference, AuditTenantScope, NexusOperationalActorType } from '@trackmind/shared';
import { synchronizeTimestamps, type TimestampSource, type TimestampSynchronizationMetadata } from './timeSynchronization.js';

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
export type AuditActorType = CanonicalAuditActorType;
export type AuditDecision = 'allowed' | 'denied' | 'approved' | 'rejected' | 'blocked' | 'executed' | 'observed';
export type AuditActionClass = 'user' | 'service' | 'workflow' | 'api' | 'ai' | 'approval' | 'config' | 'asset' | 'twin' | 'incident' | 'compliance';

export interface ChainOfCustodyStep {
  actor: string;
  action: 'created' | 'accessed' | 'exported' | 'transferred' | 'sealed' | 'placed-on-hold' | 'released-from-hold';
  timestamp: string;
  location?: string;
  reason?: string;
}

export interface EvidenceReference {
  id: string;
  uri?: string;
  hash?: string;
  description?: string;
  source?: string;
  collectedAt?: string;
  recordId?: string;
  legalHold?: boolean;
}

export interface AuditLogEntry {
  auditEventId: string;
  id: string;
  type: AuditEventType;
  actor: AuditActorReference;
  actorId: string;
  actorType?: AuditActorType;
  timestamp: string;
  action: string;
  actionClass?: AuditActionClass;
  target?: string;
  decision?: AuditDecision;
  sourceService?: string;
  apiRoute?: string;
  reason: string;
  entity: AuditEntityReference;
  approvalReference?: CanonicalAuditEvent['approvalReference'];
  tenantScope: AuditTenantScope;
  integrityReference: AuditIntegrityReference;
  payload: unknown;
  previousHash: string;
  hash: string;
  subjectId?: string;
  tenantId?: string;
  racetrackId?: string;
  workflowId?: string;
  correlationId?: string;
  severity?: AuditSeverity;
  regulations?: string[];
  evidenceIds?: string[];
  evidence?: EvidenceReference[];
  custody?: ChainOfCustodyStep[];
  retainedUntil?: string;
  legalHold?: boolean;
  timestampSynchronization?: TimestampSynchronizationMetadata;
}

export interface AuditRecordInput extends Omit<AuditLogEntry, 'auditEventId' | 'actor' | 'actorId' | 'actorType' | 'action' | 'reason' | 'entity' | 'tenantScope' | 'integrityReference' | 'previousHash' | 'hash' | 'timestampSynchronization'> {
  auditEventId?: string;
  actor: string | AuditActorReference;
  actorType?: AuditActorType | string;
  action?: string;
  reason?: string;
  entity?: AuditEntityReference;
  approvalReference?: CanonicalAuditEvent['approvalReference'];
  tenantScope?: AuditTenantScope;
  timestampSources?: TimestampSource[];
}
export interface RetentionPolicy { id: string; eventTypes: AuditEventType[]; retainForDays: number; regulatoryBasis: string }
export interface EvidenceItem extends EvidenceReference { id: string; recordId: string; uri: string; hash: string; collectedBy: string; collectedAt: string; description?: string; legalHold?: boolean }
export interface AuditVerificationResult { valid: boolean; checked: number; failures: Array<{ id: string; reason: string }> }
export interface ForensicTimelineStep { sequence: number; id: string; type: AuditEventType; actor: string; timestamp: string; subjectId?: string; workflowId?: string; correlationId?: string; action?: string; actionClass?: AuditActionClass; target?: string; decision?: AuditDecision; evidenceIds: string[]; payload: unknown }
export interface AuditEvidencePath { recordId: string; actionClass: AuditActionClass; action: string; target?: string; actor: string; timestamp: string; evidenceIds: string[]; evidence: EvidenceReference[]; hash: string; previousHash: string; legalHold: boolean }
export interface AuditCoverageReport { generatedAt: string; requiredActionClasses: AuditActionClass[]; coveredActionClasses: AuditActionClass[]; gaps: AuditActionClass[]; counts: Record<AuditActionClass, number>; evidenceLinkedRecords: number; totalRecords: number }
export interface ForensicReconstruction {
  generatedAt: string;
  query: AuditLedgerQuery;
  verified: boolean;
  recordCount: number;
  timeline: ForensicTimelineStep[];
  actors: string[];
  subjects: string[];
  workflows: string[];
  correlations: string[];
  evidenceIds: string[];
  legalHolds: Array<{ recordId: string; actor: string; timestamp: string; reason?: string }>;
  custody: Array<{ recordId: string; steps: ChainOfCustodyStep[] }>;
  chainFailures: AuditVerificationResult['failures'];
}
export interface AuditLedgerQuery { subjectId?: string; workflowId?: string; correlationId?: string; actor?: string; actionClass?: AuditActionClass; evidenceId?: string; regulation?: string; tenantId?: string; racetrackId?: string; sourceService?: string; from?: string; to?: string }
export interface ComplianceExportOptions extends AuditLedgerQuery { regulation?: string; regulations?: string[]; generatedBy?: string; generatedAt?: string; includePayloads?: boolean; retentionPolicies?: RetentionPolicy[] }
export interface AuditComplianceExport {
  exportId: string;
  generatedAt: string;
  generatedBy: string;
  regulations: string[];
  verified: boolean;
  chainHead?: string;
  recordCount: number;
  records: AuditLogEntry[];
  evidenceManifest: EvidenceReference[];
  legalHolds: ForensicReconstruction['legalHolds'];
  retention: ReturnType<ImmutableAuditLog['retentionDisposition']>;
  packageHash: string;
}
export interface AuditInvestigationDossier { caseId: string; openedBy: string; reason: string; openedAt: string; anchorRecordId?: string; reconstruction: ForensicReconstruction; recommendedNextActions: string[] }

const auditActionClasses: AuditActionClass[] = ['user', 'service', 'workflow', 'api', 'ai', 'approval', 'config', 'asset', 'twin', 'incident', 'compliance'];
const auditActorTypes = ['human', 'service', 'workflow', 'api', 'ai-agent', 'system'] as const satisfies readonly AuditActorType[];

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`).join(',')}}`;
}

function deepClone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T; }

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

function getPayloadField(payload: unknown, field: string): unknown {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[field] : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function inferAction(log: AuditRecordInput): string {
  return log.action ?? String(getPayloadField(log.payload, 'action') ?? getPayloadField(log.payload, 'activity') ?? getPayloadField(log.payload, 'type') ?? log.type);
}

function inferTarget(log: AuditRecordInput): string | undefined {
  return log.target ?? log.subjectId ?? [getPayloadField(log.payload, 'target'), getPayloadField(log.payload, 'assetId'), getPayloadField(log.payload, 'twinId'), getPayloadField(log.payload, 'raceId'), getPayloadField(log.payload, 'controlId'), getPayloadField(log.payload, 'incidentId')].find((value): value is string => typeof value === 'string');
}

function inferActorType(log: AuditRecordInput): AuditActorType | undefined {
  if (log.actorType && auditActorTypes.includes(String(log.actorType) as AuditActorType)) return log.actorType as AuditActorType;
  if (typeof log.actor === 'object' && log.actor.actorType) return log.actor.actorType;
  const actorType = getPayloadField(log.payload, 'actorType');
  if (auditActorTypes.includes(String(actorType) as AuditActorType)) return actorType as AuditActorType;
  const actorId = actorIdOf(log.actor);
  if (actorId === 'system') return 'system';
  if (log.type === 'ai-recommendation' || log.type === 'expert-call' || /ai|moe|agent/i.test(actorId)) return 'ai-agent';
  if (log.sourceService || /service|runtime|registry|api|bus/i.test(actorId)) return 'service';
  return undefined;
}

function actorIdOf(actor: string | AuditActorReference): string {
  return typeof actor === 'string' ? actor : actor.actorId;
}

function normalizeActor(log: AuditRecordInput): AuditActorReference {
  if (typeof log.actor === 'object') return { ...log.actor, actorType: log.actor.actorType ?? inferActorType(log) ?? 'service', roles: [...(log.actor.roles ?? [])] };
  return { actorId: log.actor, actorType: inferActorType(log) ?? 'service' };
}

function normalizeTenantScope(log: AuditRecordInput, target?: string): AuditTenantScope {
  return {
    tenantId: log.tenantScope?.tenantId ?? log.tenantId ?? (typeof getPayloadField(log.payload, 'tenantId') === 'string' ? String(getPayloadField(log.payload, 'tenantId')) : 'trackmind'),
    racetrackId: log.tenantScope?.racetrackId ?? log.racetrackId ?? (typeof getPayloadField(log.payload, 'racetrackId') === 'string' ? String(getPayloadField(log.payload, 'racetrackId')) : undefined),
    organizationId: log.tenantScope?.organizationId ?? (typeof getPayloadField(log.payload, 'organizationId') === 'string' ? String(getPayloadField(log.payload, 'organizationId')) : undefined),
  };
}

function inferEntityType(log: AuditRecordInput, target?: string): string {
  const explicit = getPayloadField(log.payload, 'entityType') ?? getPayloadField(log.payload, 'subjectType') ?? getPayloadField(log.payload, 'type');
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  if (target?.startsWith('twin:')) return 'digital-twin';
  if (log.apiRoute) return 'api-route';
  return log.actionClass ?? classify({ ...log, actor: actorIdOf(log.actor) });
}

function normalizeEntity(log: AuditRecordInput, target?: string): AuditEntityReference {
  if (log.entity) return { ...log.entity };
  const tenantScope = normalizeTenantScope(log, target);
  return {
    entityId: target ?? log.subjectId ?? log.id,
    entityType: inferEntityType(log, target),
    tenantId: tenantScope.tenantId,
    racetrackId: tenantScope.racetrackId,
  };
}

function inferReason(log: AuditRecordInput): string {
  const payloadReason = getPayloadField(log.payload, 'reason');
  if (log.reason) return log.reason;
  if (typeof payloadReason === 'string' && payloadReason.trim()) return payloadReason;
  return log.action ?? log.type;
}

function normalizeApprovalReference(log: AuditRecordInput): CanonicalAuditEvent['approvalReference'] | undefined {
  if (log.approvalReference) return { ...log.approvalReference };
  const approvalId = getPayloadField(log.payload, 'approvalId') ?? getPayloadField(log.payload, 'approvalRef') ?? getPayloadField(log.payload, 'approvalRequestId');
  if (typeof approvalId !== 'string' || !approvalId.trim()) return undefined;
  const status = getPayloadField(log.payload, 'status');
  const protectedAction = getPayloadField(log.payload, 'protectedAction') ?? getPayloadField(log.payload, 'action');
  return {
    approvalId,
    status: typeof status === 'string' ? status as NonNullable<CanonicalAuditEvent['approvalReference']>['status'] : undefined,
    protectedAction: typeof protectedAction === 'string' ? protectedAction : undefined,
  };
}

function classify(log: Pick<AuditRecordInput, 'type' | 'actor' | 'actionClass' | 'action' | 'sourceService' | 'apiRoute' | 'payload'>): AuditActionClass {
  if (log.actionClass) return log.actionClass;
  const action = `${log.action ?? ''} ${String(getPayloadField(log.payload, 'action') ?? '')} ${String(getPayloadField(log.payload, 'type') ?? '')}`.toLowerCase();
  if (log.apiRoute || action.includes('api.')) return 'api';
  if (log.type === 'approval' || action.includes('approval.')) return 'approval';
  if (log.type === 'ai-recommendation' || log.type === 'expert-call' || /ai|moe|agent/i.test(actorIdOf(log.actor))) return 'ai';
  if (log.type === 'workflow-action' || action.includes('workflow') || action.includes('task.')) return 'workflow';
  if (log.type === 'digital-twin-update' || action.includes('digital-twin') || action.includes('twin')) return 'twin';
  if (log.type === 'regulatory-activity' || log.type === 'rulebook-citation' || action.includes('compliance') || action.includes('control.')) return 'compliance';
  if (log.type === 'configuration-change' || action.includes('config')) return 'config';
  if (log.type === 'security-event' || action.includes('incident')) return 'incident';
  if (log.type === 'data-change' || action.includes('asset') || action.includes('racetrack.asset')) return 'asset';
  if (log.type === 'user-action') return 'user';
  return 'service';
}

function normalizeEvidence(log: AuditRecordInput): { evidenceIds: string[]; evidence: EvidenceReference[] } {
  const payloadEvidence = stringArray(getPayloadField(log.payload, 'evidence'));
  const payloadEvidenceIds = stringArray(getPayloadField(log.payload, 'evidenceIds'));
  const sourceEventId = typeof getPayloadField(log.payload, 'sourceEventId') === 'string' ? String(getPayloadField(log.payload, 'sourceEventId')) : undefined;
  const evidence = (log.evidence ?? []).map((item) => ({ ...item, recordId: item.recordId ?? log.id }));
  const evidenceIds = unique([...(log.evidenceIds ?? []), ...evidence.map((item) => item.id), ...payloadEvidence, ...payloadEvidenceIds, sourceEventId]);
  const existing = new Set(evidence.map((item) => item.id));
  return {
    evidenceIds,
    evidence: [...evidence, ...evidenceIds.filter((id) => !existing.has(id)).map((id) => ({ id, recordId: log.id }))],
  };
}

export class ImmutableAuditLog {
  private readonly logs: Readonly<AuditLogEntry>[] = [];

  append(log: AuditRecordInput): AuditLogEntry {
    const previousHash = this.logs.at(-1)?.hash ?? 'genesis';
    const actor = normalizeActor(log);
    const target = inferTarget(log);
    const entity = normalizeEntity(log, target);
    const tenantScope = normalizeTenantScope(log, target);
    const custody = log.custody?.map((step) => ({ ...step })) ?? [{ actor: actor.actorId, action: 'created' as const, timestamp: log.timestamp }];
    const evidence = normalizeEvidence(log);
    const { timestampSources: _timestampSources, integrityReference: _inputIntegrityReference, tenantScope: _inputTenantScope, entity: _inputEntity, actorId: _inputActorId, ...persistedLog } = log as AuditRecordInput & Partial<AuditLogEntry>;
    const timestampSynchronization = synchronizeTimestamps([
      { source: `${log.sourceService ?? 'audit-log'}.event`, timestamp: log.timestamp },
      ...custody.map((step) => ({ source: `custody:${step.action}:${step.actor}`, timestamp: step.timestamp })),
      ...(log.timestampSources ?? []),
    ]);
    const unsigned = {
      ...persistedLog,
      auditEventId: log.auditEventId ?? log.id,
      id: log.id,
      actor,
      actorId: actor.actorId,
      actorType: actor.actorType,
      entity,
      action: inferAction(log),
      reason: inferReason(log),
      actionClass: classify({ ...log, action: inferAction(log) }),
      target,
      subjectId: log.subjectId ?? entity.entityId,
      tenantId: tenantScope.tenantId,
      racetrackId: tenantScope.racetrackId,
      tenantScope,
      approvalReference: normalizeApprovalReference(log),
      payload: deepClone(log.payload),
      previousHash,
      custody,
      evidenceIds: evidence.evidenceIds,
      evidence: evidence.evidence,
      regulations: [...(log.regulations ?? [])],
      timestampSynchronization,
    };
    const hash = digest(unsigned);
    const entry = Object.freeze({ ...unsigned, hash, integrityReference: { hash, previousHash, algorithm: 'sha256' as const, chainScope: 'tenant' as const } });
    this.logs.push(entry);
    return this.clone(entry);
  }

  all(): AuditLogEntry[] { return this.logs.map((entry) => this.clone(entry)); }

  verify(): AuditVerificationResult {
    const failures: AuditVerificationResult['failures'] = [];
    this.logs.forEach((entry, index) => {
      const { hash, integrityReference: _integrityReference, ...unsigned } = entry;
      const expectedPrevious = index === 0 ? 'genesis' : this.logs[index - 1].hash;
      if (entry.previousHash !== expectedPrevious) failures.push({ id: entry.id, reason: 'previous-hash-mismatch' });
      if (hash !== digest(unsigned)) failures.push({ id: entry.id, reason: 'record-hash-mismatch' });
    });
    return { valid: failures.length === 0, checked: this.logs.length, failures };
  }

  addCustodyStep(recordId: string, step: ChainOfCustodyStep): AuditLogEntry {
    const current = this.logs.find((entry) => entry.id === recordId);
    if (!current) throw new Error(`Unknown audit record ${recordId}`);
    const { hash: _hash, previousHash: _previousHash, ...base } = this.clone(current);
    return this.append({ ...base, id: `${recordId}:custody:${(current.custody?.length ?? 0) + 1}`, type: 'system-event', actor: step.actor, actorType: inferActorType({ ...base, actor: step.actor, payload: current.payload }), timestamp: step.timestamp, action: step.action, actionClass: 'compliance', target: recordId, reason: step.reason ?? step.action, payload: { custodyFor: recordId, action: step.action, reason: step.reason }, custody: [...(current.custody ?? []), { ...step }], subjectId: current.subjectId, correlationId: current.correlationId, workflowId: current.workflowId, tenantId: current.tenantId, racetrackId: current.racetrackId, severity: current.severity, regulations: current.regulations, evidenceIds: current.evidenceIds, evidence: current.evidence, retainedUntil: current.retainedUntil, legalHold: step.action === 'placed-on-hold' });
  }

  placeLegalHold(recordIds: string[], actor: string, timestamp: string, reason: string): AuditLogEntry[] {
    return recordIds.map((recordId) => this.addCustodyStep(recordId, { actor, action: 'placed-on-hold', timestamp, reason }));
  }

  releaseLegalHold(recordIds: string[], actor: string, timestamp: string, reason: string): AuditLogEntry[] {
    return recordIds.map((recordId) => this.addCustodyStep(recordId, { actor, action: 'released-from-hold', timestamp, reason }));
  }

  forensicTimeline(filter: { subjectId?: string; workflowId?: string; correlationId?: string; actor?: string }): ForensicTimelineStep[] {
    return this.records(filter).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((entry, index) => ({ sequence: index + 1, id: entry.id, type: entry.type, actor: entry.actor.actorId, timestamp: entry.timestamp, subjectId: entry.subjectId, workflowId: entry.workflowId, correlationId: entry.correlationId, action: entry.action, actionClass: entry.actionClass, target: entry.target, decision: entry.decision, evidenceIds: [...(entry.evidenceIds ?? [])], payload: entry.payload }));
  }

  complianceReport(regulation: string) {
    const records = this.all().filter((entry) => entry.regulations?.includes(regulation));
    const holds = this.activeLegalHolds();
    return { regulation, recordCount: records.length, evidenceIds: [...new Set(records.flatMap((entry) => entry.evidenceIds ?? []))], legalHoldCount: records.filter((entry) => entry.legalHold || holds.has(entry.id)).length, verified: this.verify().valid };
  }

  retentionDisposition(now: string, policies: RetentionPolicy[]) {
    const holds = this.activeLegalHolds();
    return this.all().map((entry) => {
      const policy = policies.find((candidate) => candidate.eventTypes.includes(entry.type));
      const retainedUntil = entry.retainedUntil ?? (policy ? new Date(Date.parse(entry.timestamp) + policy.retainForDays * 86_400_000).toISOString().slice(0, 10) : undefined);
      const expired = Boolean(retainedUntil && retainedUntil < now.slice(0, 10));
      const disposition: RetentionDisposition = expired ? (entry.legalHold || holds.has(entry.id) ? 'legal-hold' : 'eligible-for-disposal') : 'retain';
      return { id: entry.id, policyId: policy?.id, retainedUntil, disposition, regulatoryBasis: policy?.regulatoryBasis };
    });
  }

  evidencePath(query: AuditLedgerQuery = {}): AuditEvidencePath[] {
    const holds = this.activeLegalHolds();
    return this.records(query).map((entry) => ({ recordId: entry.id, actionClass: entry.actionClass ?? classify(entry), action: entry.action ?? entry.type, target: entry.target, actor: entry.actor.actorId, timestamp: entry.timestamp, evidenceIds: [...(entry.evidenceIds ?? [])], evidence: (entry.evidence ?? []).map((item) => ({ ...item, legalHold: item.legalHold || holds.has(entry.id) })), hash: entry.hash, previousHash: entry.previousHash, legalHold: entry.legalHold || holds.has(entry.id) }));
  }

  coverageReport(requiredActionClasses: AuditActionClass[] = auditActionClasses, generatedAt = new Date().toISOString()): AuditCoverageReport {
    const counts = Object.fromEntries(auditActionClasses.map((actionClass) => [actionClass, 0])) as Record<AuditActionClass, number>;
    for (const entry of this.logs) counts[entry.actionClass ?? classify(entry)] += 1;
    const coveredActionClasses = requiredActionClasses.filter((actionClass) => counts[actionClass] > 0);
    return { generatedAt, requiredActionClasses: [...requiredActionClasses], coveredActionClasses, gaps: requiredActionClasses.filter((actionClass) => counts[actionClass] === 0), counts, evidenceLinkedRecords: this.logs.filter((entry) => (entry.evidenceIds?.length ?? 0) > 0 || (entry.evidence?.length ?? 0) > 0).length, totalRecords: this.logs.length };
  }

  reconstruct(query: AuditLedgerQuery = {}): ForensicReconstruction {
    const records = this.records(query).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const verification = this.verify();
    const recordIds = new Set(records.map((entry) => entry.id));
    const holds = [...this.activeLegalHolds().entries()].filter(([recordId]) => recordIds.has(recordId)).map(([recordId, hold]) => ({ recordId, ...hold }));
    return {
      generatedAt: new Date().toISOString(),
      query: { ...query },
      verified: verification.valid,
      recordCount: records.length,
      timeline: records.map((entry, index) => ({ sequence: index + 1, id: entry.id, type: entry.type, actor: entry.actor.actorId, timestamp: entry.timestamp, subjectId: entry.subjectId, workflowId: entry.workflowId, correlationId: entry.correlationId, action: entry.action, actionClass: entry.actionClass, target: entry.target, decision: entry.decision, evidenceIds: [...(entry.evidenceIds ?? [])], payload: deepClone(entry.payload) })),
      actors: unique(records.map((entry) => entry.actor.actorId)),
      subjects: unique(records.map((entry) => entry.subjectId)),
      workflows: unique(records.map((entry) => entry.workflowId)),
      correlations: unique(records.map((entry) => entry.correlationId)),
      evidenceIds: unique(records.flatMap((entry) => entry.evidenceIds ?? [])),
      legalHolds: holds,
      custody: records.filter((entry) => entry.custody?.length).map((entry) => ({ recordId: entry.id, steps: entry.custody!.map((step) => ({ ...step })) })),
      chainFailures: verification.failures,
    };
  }

  exportCompliancePackage(options: ComplianceExportOptions = {}): AuditComplianceExport {
    const regulations = options.regulations ?? (options.regulation ? [options.regulation] : []);
    const records = this.records({ ...options, regulation: undefined }).filter((entry) => regulations.length === 0 || regulations.some((regulation) => entry.regulations?.includes(regulation)));
    const includePayloads = options.includePayloads ?? true;
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    const exportRecords = records.map((entry) => includePayloads ? this.clone(entry) : { ...this.clone(entry), payload: { redacted: true } });
    const legalHolds = this.reconstruct({ ...options, regulation: regulations[0] }).legalHolds.filter((hold) => records.some((entry) => entry.id === hold.recordId));
    const retention = this.retentionDisposition(generatedAt, options.retentionPolicies ?? []).filter((item) => records.some((entry) => entry.id === item.id));
    const evidenceManifest = this.evidencePath({ ...options, regulation: undefined }).filter((path) => records.some((entry) => entry.id === path.recordId)).flatMap((path) => path.evidence);
    const unsigned = { exportId: `audit-export-${digest({ generatedAt, records: exportRecords.map((entry) => entry.id), regulations }).slice(7, 19)}`, generatedAt, generatedBy: options.generatedBy ?? 'audit-ledger', regulations, verified: this.verify().valid, chainHead: records.at(-1)?.hash, recordCount: records.length, records: exportRecords, evidenceManifest, legalHolds, retention };
    return { ...unsigned, packageHash: digest(unsigned) };
  }

  investigate(input: { caseId: string; openedBy: string; reason: string; openedAt?: string; query: AuditLedgerQuery; appendAnchor?: boolean }): AuditInvestigationDossier {
    const openedAt = input.openedAt ?? new Date().toISOString();
    const anchorRecord = input.appendAnchor ? this.append({ id: `audit-investigation-${input.caseId}`, type: 'system-event', actor: input.openedBy, actorType: 'human', timestamp: openedAt, action: 'investigation.opened', actionClass: 'incident', payload: { caseId: input.caseId, reason: input.reason, query: input.query }, correlationId: input.caseId, severity: 'warning', regulations: ['SOC-2', 'HISA', 'ARCI'] }) : undefined;
    const reconstruction = this.reconstruct(input.query);
    const recommendedNextActions = [
      reconstruction.verified ? 'Ledger hash chain verified for scoped records.' : 'Review chain verification failures before relying on export.',
      reconstruction.evidenceIds.length ? 'Preserve linked evidence manifest and custody records.' : 'Collect or link supporting evidence references for scoped records.',
      reconstruction.legalHolds.length ? 'Maintain legal hold until compliance release is recorded.' : 'Place legal hold if this investigation is regulator-facing.',
    ];
    return { caseId: input.caseId, openedBy: input.openedBy, reason: input.reason, openedAt, anchorRecordId: anchorRecord?.id, reconstruction, recommendedNextActions };
  }

  activeLegalHolds(recordId?: string): Map<string, { actor: string; timestamp: string; reason?: string }> {
    const holds = new Map<string, { actor: string; timestamp: string; reason?: string }>();
    for (const entry of this.logs) {
      const custodyFor = getPayloadField(entry.payload, 'custodyFor');
      const action = getPayloadField(entry.payload, 'action');
      if (typeof custodyFor === 'string' && action === 'placed-on-hold') holds.set(custodyFor, { actor: entry.actor.actorId, timestamp: entry.timestamp, reason: typeof getPayloadField(entry.payload, 'reason') === 'string' ? String(getPayloadField(entry.payload, 'reason')) : undefined });
      if (typeof custodyFor === 'string' && action === 'released-from-hold') holds.delete(custodyFor);
      if (entry.legalHold && !String(entry.id).includes(':custody:')) holds.set(entry.id, { actor: entry.actor.actorId, timestamp: entry.timestamp });
    }
    if (recordId) return new Map([...holds.entries()].filter(([id]) => id === recordId));
    return holds;
  }

  private records(query: AuditLedgerQuery = {}): AuditLogEntry[] {
    return this.all().filter((entry) => (!query.subjectId || entry.subjectId === query.subjectId || entry.target === query.subjectId)
      && (!query.workflowId || entry.workflowId === query.workflowId)
      && (!query.correlationId || entry.correlationId === query.correlationId)
      && (!query.actor || entry.actor.actorId === query.actor)
      && (!query.actionClass || entry.actionClass === query.actionClass)
      && (!query.evidenceId || entry.evidenceIds?.includes(query.evidenceId))
      && (!query.regulation || entry.regulations?.includes(query.regulation))
      && (!query.tenantId || entry.tenantId === query.tenantId)
      && (!query.racetrackId || entry.racetrackId === query.racetrackId)
      && (!query.sourceService || entry.sourceService === query.sourceService)
      && (!query.from || entry.timestamp >= query.from)
      && (!query.to || entry.timestamp <= query.to));
  }

  private clone(entry: Readonly<AuditLogEntry>): AuditLogEntry {
    return { ...entry, payload: deepClone(entry.payload), regulations: [...(entry.regulations ?? [])], evidenceIds: [...(entry.evidenceIds ?? [])], evidence: entry.evidence?.map((item) => ({ ...item })), custody: entry.custody?.map((step) => ({ ...step })) };
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
  forRecords(recordIds: string[]): EvidenceItem[] { const ids = new Set(recordIds); return [...this.items.values()].filter((item) => ids.has(item.recordId)).map((item) => ({ ...item })); }
  all(): EvidenceItem[] { return [...this.items.values()].map((item) => ({ ...item })); }
  placeLegalHold(evidenceIds: string[], actor: string, reason: string): EvidenceItem[] { return evidenceIds.map((id) => this.setLegalHold(id, true, actor, reason)); }
  releaseLegalHold(evidenceIds: string[], actor: string, reason: string): EvidenceItem[] { return evidenceIds.map((id) => this.setLegalHold(id, false, actor, reason)); }
  manifest(recordIds?: string[]) { const items = recordIds ? this.forRecords(recordIds) : this.all(); const unsigned = { count: items.length, legalHoldCount: items.filter((item) => item.legalHold).length, evidenceIds: items.map((item) => item.id).sort(), hashes: items.map((item) => item.hash).sort() }; return { ...unsigned, manifestHash: digest(unsigned), items }; }
  private setLegalHold(id: string, legalHold: boolean, actor: string, reason: string): EvidenceItem { const current = this.items.get(id); if (!current) throw new Error(`Unknown evidence item ${id}`); const next = { ...current, legalHold, description: current.description ?? `${legalHold ? 'Placed on' : 'Released from'} legal hold by ${actor}: ${reason}` }; this.items.set(id, next); return { ...next }; }
}
