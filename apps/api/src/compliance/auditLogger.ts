import { ImmutableAuditLog, type AuditLogEntry } from '../auditLog.js';

export interface RecommendationLogInput {
  recommendationId: string;
  modelId: string;
  inferenceTimestamp: string;
  action: string;
  confidence: number;
  rationale: string;
  evidenceLinks: string[];
  jsonPayload: Record<string, unknown>;
  actorId?: string;
}

export interface OverrideLogInput {
  overrideId: string;
  approvalId: string;
  approverId: string;
  decision: 'approved' | 'rejected' | 'more-info' | 'overridden';
  rationale: string;
  evidenceShown: string[];
  timestamp: string;
}

export interface DriftMetric {
  id: string;
  modelId: string;
  metric: 'confidence-drift' | 'input-drift' | 'outcome-drift' | 'bias-signal' | 'incident-rate';
  value: number;
  threshold: number;
  measuredAt: string;
  status: 'nominal' | 'watch' | 'breach';
  feedbackLoopRef: string;
}

export interface IncidentWorkflowRecord {
  id: string;
  openedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  status: 'open' | 'triaged' | 'remediated' | 'closed';
  correctiveActionRefs: string[];
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export class AIActAuditLogger {
  readonly auditLog: ImmutableAuditLog;
  private readonly recommendations = new Map<string, RecommendationLogInput & { auditId: string }>();
  private readonly overrides = new Map<string, OverrideLogInput & { auditId: string }>();
  private readonly driftMetrics = new Map<string, DriftMetric>();
  private readonly incidents = new Map<string, IncidentWorkflowRecord>();

  constructor(auditLog = new ImmutableAuditLog()) {
    this.auditLog = auditLog;
  }

  logRecommendation(input: RecommendationLogInput): AuditLogEntry {
    const audit = this.auditLog.append({
      id: id('audit-ai-act-rec'),
      type: 'ai-recommendation',
      actor: input.actorId ?? input.modelId,
      actorType: 'ai-agent',
      timestamp: input.inferenceTimestamp,
      action: input.action,
      actionClass: 'ai',
      subjectId: input.recommendationId,
      target: input.recommendationId,
      decision: input.confidence < 0.65 ? 'blocked' : 'observed',
      sourceService: 'ai-act-compliance-logger',
      payload: {
        model_id: input.modelId,
        inference_timestamp: input.inferenceTimestamp,
        confidence: input.confidence,
        rationale: input.rationale,
        evidence_links: input.evidenceLinks,
        json_payload: input.jsonPayload,
      },
      severity: input.confidence < 0.65 ? 'warning' : 'info',
      regulations: ['EU-AI-ACT-ART-12', 'EU-AI-ACT-ART-13'],
      evidenceIds: input.evidenceLinks,
    });
    this.recommendations.set(input.recommendationId, { ...clone(input), auditId: audit.id });
    return audit;
  }

  logOverride(input: OverrideLogInput): AuditLogEntry {
    const audit = this.auditLog.append({
      id: id('audit-ai-act-override'),
      type: 'approval',
      actor: input.approverId,
      actorType: 'human',
      timestamp: input.timestamp,
      action: `human-oversight.${input.decision}`,
      actionClass: 'approval',
      subjectId: input.approvalId,
      target: input.approvalId,
      decision: input.decision === 'approved' ? 'approved' : input.decision === 'rejected' ? 'rejected' : 'observed',
      sourceService: 'ai-act-compliance-logger',
      payload: input,
      severity: 'critical',
      regulations: ['EU-AI-ACT-ART-14'],
      evidenceIds: input.evidenceShown,
    });
    this.overrides.set(input.overrideId, { ...clone(input), auditId: audit.id });
    return audit;
  }

  recordDriftMetric(metric: DriftMetric): DriftMetric {
    const status: DriftMetric['status'] = metric.value >= metric.threshold ? 'breach' : metric.value >= metric.threshold * 0.75 ? 'watch' : 'nominal';
    const next = { ...clone(metric), status };
    this.driftMetrics.set(next.id, next);
    this.auditLog.append({
      id: id('audit-ai-act-drift'),
      type: 'system-event',
      actor: 'post-market-monitor',
      actorType: 'service',
      timestamp: next.measuredAt,
      action: 'post-market.drift-measured',
      actionClass: 'compliance',
      subjectId: next.modelId,
      payload: next,
      severity: status === 'breach' ? 'critical' : status === 'watch' ? 'warning' : 'info',
      regulations: ['EU-AI-ACT-ART-72'],
      evidenceIds: [next.feedbackLoopRef],
    });
    return clone(next);
  }

  openIncident(record: IncidentWorkflowRecord): IncidentWorkflowRecord {
    this.incidents.set(record.id, clone(record));
    this.auditLog.append({
      id: id('audit-ai-act-incident'),
      type: 'regulatory-activity',
      actor: 'post-market-monitor',
      actorType: 'service',
      timestamp: record.openedAt,
      action: 'post-market.incident-opened',
      actionClass: 'incident',
      subjectId: record.id,
      payload: record,
      severity: record.severity === 'critical' || record.severity === 'high' ? 'critical' : 'warning',
      regulations: ['EU-AI-ACT-ART-72'],
      evidenceIds: record.correctiveActionRefs,
    });
    return clone(record);
  }

  report() {
    return {
      automaticLogging: [...this.recommendations.values()].map(clone),
      transparencyRecords: [...this.recommendations.values()].map((record) => ({ recommendationId: record.recommendationId, rationale: record.rationale, jsonPayload: clone(record.jsonPayload), evidenceLinks: [...record.evidenceLinks], auditId: record.auditId })),
      humanOversight: [...this.overrides.values()].map(clone),
      postMarketMonitoring: {
        driftMetrics: [...this.driftMetrics.values()].map(clone),
        incidents: [...this.incidents.values()].map(clone),
        auditVerification: this.auditLog.verify(),
      },
      auditRecords: this.auditLog.all(),
    };
  }
}

export function createAIActAuditLogger() {
  const logger = new AIActAuditLogger();
  logger.logRecommendation({
    recommendationId: 'rec-race-start-readiness',
    modelId: 'model-race-readiness-v1',
    inferenceTimestamp: '2026-06-14T18:00:00.000Z',
    action: 'race_start',
    confidence: 0.91,
    rationale: 'Race start readiness is positive, but far-turn moisture requires explicit steward and veterinarian review.',
    evidenceLinks: ['sensor:surface-live-1', 'rulebook:ARCI-004-105', 'approval:approval-race-start-7'],
    jsonPayload: { action: 'race_start', target: 'race-7', approval_required: true, confidence: 0.91 },
  });
  logger.logOverride({ overrideId: 'override-race-start-7', approvalId: 'approval-race-start-7', approverId: 'steward-1', decision: 'more-info', rationale: 'Request updated surface reading before start.', evidenceShown: ['sensor:surface-live-1', 'rulebook:ARCI-004-105'], timestamp: '2026-06-14T18:00:30.000Z' });
  logger.recordDriftMetric({ id: 'drift-race-readiness-confidence', modelId: 'model-race-readiness-v1', metric: 'confidence-drift', value: 0.11, threshold: 0.2, measuredAt: '2026-06-14T18:05:00.000Z', status: 'nominal', feedbackLoopRef: 'feedback:race-day-review' });
  logger.openIncident({ id: 'pm-incident-approval-latency', openedAt: '2026-06-14T18:06:00.000Z', severity: 'medium', summary: 'Approval latency approached 120 second race-critical window.', status: 'triaged', correctiveActionRefs: ['ca-approval-notification-sla'] });
  return logger;
}
