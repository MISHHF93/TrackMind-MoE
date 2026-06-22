import type { IncidentDto, IncidentTimelineDto, PostIncidentReviewDto } from '@trackmind/shared';
import { SAFETY_KPI_PACK_ID, type SafetyKpiPackSnapshot } from '@trackmind/shared';
import type { AuditAppendTarget } from '../auditAdapter.js';
import { appendAudit } from '../auditAdapter.js';
import type { UniversalEventBus } from '../eventBus.js';
import { createNamespacedRepository, type KeyValueRepository } from '../repository/repositoryAdapter.js';
import { notificationFramework } from './notificationFramework.js';

const now = () => new Date().toISOString();

const seedIncidents = (): Array<IncidentDto & { id: string }> => {
  const ts = now();
  return [
    {
      id: 'inc-1',
      tenantId: 'trackmind',
      racetrackId: 'main-track',
      title: 'Loose horse near paddock',
      description: 'Horse broke halter near paddock gate B.',
      severity: 'high',
      status: 'triaged',
      category: 'safety',
      reportedBy: 'security-officer',
      assignedTo: 'incident-commander',
      timeline: [{ at: ts, action: 'reported', actor: 'security-officer' }],
      auditIds: ['audit-inc-1'],
      eventIds: ['event-inc-1'],
      createdAt: ts,
      updatedAt: ts,
      mock: false,
    },
  ];
};

const INCIDENT_EVENT_TYPES = [
  'incident.reported.v1',
  'incident.updated.v1',
  'incident.triaged.v1',
  'incident.resolved.v1',
  'incident.post-incident-review.submitted.v1',
  'incident.timeline.updated.v1',
] as const;

export type IncidentTimelineStreamListener = (timeline: IncidentTimelineDto) => void;

export interface IncidentServiceDependencies {
  audit?: AuditAppendTarget;
  eventBus?: UniversalEventBus;
}

export interface TriageIncidentInput {
  severity: IncidentDto['severity'];
  assignedTo: string;
  actor: string;
  note?: string;
}

export interface PostIncidentReviewInput {
  findings: Array<{ finding: string; severity: IncidentDto['severity']; owner: string }>;
  submittedBy: string;
  evidence?: string[];
}

export interface SafetyKpiPackInput {
  activeEmergencyWorkflows?: number;
  safetyIntelligenceAlerts?: number;
}

export class IncidentService {
  readonly incidents: KeyValueRepository<IncidentDto & { id: string }>;
  private readonly reviews: KeyValueRepository<PostIncidentReviewDto & { id: string }>;
  private timelineListeners = new Map<string, Set<IncidentTimelineStreamListener>>();

  constructor(private readonly deps: IncidentServiceDependencies = {}) {
    this.incidents = createNamespacedRepository('platform.incidents', seedIncidents());
    this.reviews = createNamespacedRepository('platform.incident-reviews', []);
    this.registerEventSchemas();
  }

  list(): IncidentDto[] {
    return this.incidents.list();
  }

  get(id: string): IncidentDto | undefined {
    return this.incidents.get(id);
  }

  getTimeline(id: string, since?: string): IncidentTimelineDto | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    const entries = since
      ? incident.timeline.filter((entry) => entry.at > since)
      : [...incident.timeline];
    return {
      incidentId: id,
      generatedAt: now(),
      revision: incident.timeline.length,
      updatedAt: incident.updatedAt,
      status: incident.status,
      entries,
      since: since ?? null,
      hasMore: false,
      mock: false,
    };
  }

  subscribeTimeline(incidentId: string, listener: IncidentTimelineStreamListener): () => void {
    const listeners = this.timelineListeners.get(incidentId) ?? new Set<IncidentTimelineStreamListener>();
    listeners.add(listener);
    this.timelineListeners.set(incidentId, listeners);
    return () => listeners.delete(listener);
  }

  buildTimelineStreamBody(incidentId: string): string | undefined {
    const timeline = this.getTimeline(incidentId);
    if (!timeline) return undefined;
    return this.formatTimelineStreamBody(timeline);
  }

  private formatTimelineStreamBody(timeline: IncidentTimelineDto): string {
    const payload = JSON.stringify(timeline);
    const heartbeat = JSON.stringify({
      time: timeline.generatedAt,
      incidentId: timeline.incidentId,
      revision: timeline.revision,
    });
    return `event: snapshot\ndata: ${payload}\n\nevent: heartbeat\ndata: ${heartbeat}\n\n`;
  }

  private emitTimelineUpdate(incidentId: string, actor: string, auditId: string): void {
    const timeline = this.getTimeline(incidentId);
    if (!timeline) return;
    for (const listener of this.timelineListeners.get(incidentId) ?? []) {
      listener(timeline);
    }
    const eventId = `event-${incidentId}-timeline-${Date.now().toString(36)}`;
    this.publishEvent(
      'incident.timeline.updated.v1',
      incidentId,
      actor,
      { revision: timeline.revision, status: timeline.status, entryCount: timeline.entries.length },
      auditId,
      eventId,
    );
  }

  create(input: Omit<IncidentDto, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'auditIds' | 'eventIds' | 'mock'>): IncidentDto {
    const id = `inc-${Date.now().toString(36)}`;
    const auditId = `audit-${id}`;
    const eventId = `event-${id}`;
    const record: IncidentDto = {
      ...input,
      id,
      timeline: [{ at: now(), action: 'reported', actor: input.reportedBy }],
      auditIds: [auditId],
      eventIds: [eventId],
      createdAt: now(),
      updatedAt: now(),
      mock: false,
    };
    this.incidents.upsert({ ...record, id });
    this.recordAudit('incident.reported', input.reportedBy, id, { severity: input.severity, title: input.title }, auditId);
    this.publishEvent('incident.reported.v1', id, input.reportedBy, { severity: input.severity, category: input.category, status: 'reported' }, auditId, eventId);
    this.dispatchIncidentNotification('reported', record, input.reportedBy);
    this.emitTimelineUpdate(id, input.reportedBy, auditId);
    return record;
  }

  update(id: string, patch: Partial<Pick<IncidentDto,
    'status' | 'severity' | 'assignedTo' | 'description' | 'incidentType' | 'intakeMode' | 'location'
    | 'summary' | 'detailedNotes' | 'involvedEntities' | 'evidenceRefs' | 'recommendedNextAction'
    | 'approvalRequired' | 'subjectKind' | 'subjectId'
  >> & { note?: string; actor?: string }): IncidentDto {
    const existing = this.incidents.get(id);
    if (!existing) throw new Error(`Incident not found: ${id}`);
    const actor = patch.actor ?? 'system';
    const timeline = [...existing.timeline];
    if (patch.status) timeline.push({ at: now(), action: `status:${patch.status}`, actor, note: patch.note });
    const auditId = `audit-${id}-update-${Date.now().toString(36)}`;
    const eventId = `event-${id}-update-${Date.now().toString(36)}`;
    const updated: IncidentDto = {
      ...existing,
      ...patch,
      timeline,
      auditIds: [...existing.auditIds, auditId],
      eventIds: [...existing.eventIds, eventId],
      updatedAt: now(),
    };
    this.incidents.upsert({ ...updated, id });
    this.recordAudit('incident.updated', actor, id, { status: updated.status, severity: updated.severity }, auditId);
    this.publishEvent('incident.updated.v1', id, actor, { status: updated.status, severity: updated.severity }, auditId, eventId);
    if (patch.status && ['resolved', 'closed'].includes(patch.status)) {
      this.publishEvent('incident.resolved.v1', id, actor, { status: updated.status, severity: updated.severity }, auditId, `event-${id}-resolved-${Date.now().toString(36)}`);
      this.dispatchIncidentNotification('resolved', updated, actor);
    }
    this.emitTimelineUpdate(id, actor, auditId);
    return updated;
  }

  triage(id: string, input: TriageIncidentInput): IncidentDto {
    const updated = this.update(id, {
      status: 'triaged',
      severity: input.severity,
      assignedTo: input.assignedTo,
      note: input.note ?? `Triaged as ${input.severity}`,
      actor: input.actor,
    });
    const auditId = `audit-${id}-triage-${Date.now().toString(36)}`;
    const eventId = `event-${id}-triaged-${Date.now().toString(36)}`;
    this.recordAudit('incident.triaged', input.actor, id, { severity: input.severity, assignedTo: input.assignedTo }, auditId);
    this.publishEvent('incident.triaged.v1', id, input.actor, { severity: input.severity, assignedTo: input.assignedTo, status: 'triaged' }, auditId, eventId);
    this.dispatchIncidentNotification('triaged', updated, input.actor);
    const triaged: IncidentDto = {
      ...updated,
      auditIds: [...updated.auditIds, auditId],
      eventIds: [...updated.eventIds, eventId],
      updatedAt: now(),
    };
    this.incidents.upsert({ ...triaged, id });
    return triaged;
  }

  submitPostIncidentReview(id: string, input: PostIncidentReviewInput): { incident: IncidentDto; review: PostIncidentReviewDto } {
    const existing = this.incidents.get(id);
    if (!existing) throw new Error(`Incident not found: ${id}`);
    const reviewId = `review-${id}-${Date.now().toString(36)}`;
    const auditId = `audit-${reviewId}`;
    const eventId = `event-${reviewId}`;
    const review: PostIncidentReviewDto = {
      id: reviewId,
      incidentId: id,
      findings: input.findings,
      correctiveActions: input.findings.map((finding, index) => ({
        id: `${reviewId}-ca-${index + 1}`,
        action: `Resolve: ${finding.finding}`,
        owner: finding.owner,
        dueDays: finding.severity === 'critical' ? 7 : 30,
      })),
      evidencePackage: [...(input.evidence ?? []), 'command-log', 'communications-transcript', auditId],
      auditIds: [auditId],
      eventIds: [eventId],
      status: 'submitted',
      submittedBy: input.submittedBy,
      submittedAt: now(),
      mock: false,
    };
    this.reviews.upsert({ ...review, id: reviewId });
    const timeline = [...existing.timeline, { at: now(), action: 'post-incident-review:submitted', actor: input.submittedBy }];
    const incident: IncidentDto = {
      ...existing,
      status: existing.status === 'closed' ? 'closed' : 'resolved',
      timeline,
      auditIds: [...existing.auditIds, auditId],
      eventIds: [...existing.eventIds, eventId],
      updatedAt: now(),
    };
    this.incidents.upsert({ ...incident, id });
    this.recordAudit('incident.post-incident-review.submitted', input.submittedBy, id, { reviewId, findings: input.findings.length }, auditId);
    this.publishEvent('incident.post-incident-review.submitted.v1', id, input.submittedBy, { reviewId, status: incident.status, severity: incident.severity }, auditId, eventId);
    this.emitTimelineUpdate(id, input.submittedBy, auditId);
    return { incident, review };
  }

  listPostIncidentReviews(incidentId?: string): PostIncidentReviewDto[] {
    const reviews = this.reviews.list();
    return incidentId ? reviews.filter((review) => review.incidentId === incidentId) : reviews;
  }

  computeSafetyKpiPack(input: SafetyKpiPackInput = {}): SafetyKpiPackSnapshot {
    const incidents = this.list();
    const openIncidents = incidents.filter((incident) => !['resolved', 'closed'].includes(incident.status)).length;
    const triagedIncidents = incidents.filter((incident) => incident.status !== 'reported').length;
    const resolvedIncidents = incidents.filter((incident) => ['resolved', 'closed'].includes(incident.status)).length;
    const reviews = this.listPostIncidentReviews();
    const pendingPostIncidentReviews = Math.max(0, resolvedIncidents - reviews.length);
    const triageCoverage = incidents.length ? Math.round((triagedIncidents / incidents.length) * 100) : 100;
    const reviewCoverage = resolvedIncidents ? Math.round((reviews.length / resolvedIncidents) * 100) : 100;
    const incidentPressure = openIncidents * 6 + incidents.filter((incident) => incident.severity === 'critical').length * 4;
    const generatedAt = now();
    return {
      generatedAt,
      kpiPackId: SAFETY_KPI_PACK_ID,
      openIncidents,
      triagedIncidents,
      activeEmergencyWorkflows: input.activeEmergencyWorkflows ?? 0,
      pendingPostIncidentReviews,
      safetyIntelligenceAlerts: input.safetyIntelligenceAlerts ?? 0,
      kpis: [
        { kpiId: 'kpi-safety-incidents-incident-pressure', label: 'Open safety incident pressure', value: incidentPressure, unit: 'pressure', status: incidentPressure > 25 ? 'warning' : 'watch' },
        { kpiId: 'kpi-safety-incidents-triage-coverage', label: 'Incident triage coverage', value: triageCoverage, unit: '%', status: triageCoverage >= 95 ? 'nominal' : 'watch' },
        { kpiId: 'kpi-safety-incidents-emergency-readiness', label: 'Emergency workflow readiness', value: input.activeEmergencyWorkflows ? 82 : 86, unit: 'score', status: 'watch' },
        { kpiId: 'kpi-safety-incidents-post-incident-review-coverage', label: 'Post-incident review coverage', value: reviewCoverage, unit: '%', status: reviewCoverage >= 90 ? 'nominal' : 'watch' },
        { kpiId: 'kpi-safety-incidents-safety-intelligence-alerts', label: 'Safety intelligence alert pressure', value: input.safetyIntelligenceAlerts ?? 0, unit: 'alerts', status: (input.safetyIntelligenceAlerts ?? 0) > 0 ? 'watch' : 'nominal' },
      ],
      mock: false,
    };
  }

  private dispatchIncidentNotification(phase: 'reported' | 'triaged' | 'resolved', incident: IncidentDto, actor: string): void {
    const severity = incident.severity === 'critical' || incident.severity === 'high'
      ? 'critical'
      : incident.severity === 'medium'
        ? 'warning'
        : 'info';
    const titles: Record<typeof phase, string> = {
      reported: `Incident reported: ${incident.title}`,
      triaged: `Incident triaged: ${incident.title}`,
      resolved: `Incident resolved: ${incident.title}`,
    };
    notificationFramework.dispatch({
      category: 'incident',
      title: titles[phase],
      message: `${incident.description} (actor: ${actor}, status: ${incident.status})`,
      targetRoles: ['security', 'steward', 'incident-commander', 'admin'],
      severity,
      correlationId: incident.id,
    });
  }

  private registerEventSchemas(): void {
    if (!this.deps.eventBus) return;
    const owner = { service: 'incident-service', team: 'safety-operations', accountableRole: 'incident-commander' };
    INCIDENT_EVENT_TYPES.forEach((type) => {
      this.deps.eventBus?.registerEvent({
        type,
        version: 1,
        description: `Incident lifecycle ${type}`,
        owner,
        payloadFields: ['subjectId', 'auditId'],
        compliance: 'regulated',
        operationalMetadata: { humanAuthority: true, aiMayBlock: false },
      });
    });
  }

  private recordAudit(action: string, actor: string, subjectId: string, payload: Record<string, unknown>, auditId: string) {
    if (!this.deps.audit) return;
    appendAudit(this.deps.audit, {
      id: auditId,
      type: 'security-event',
      actor,
      actorType: 'human',
      timestamp: now(),
      action,
      actionClass: 'incident',
      subjectId,
      payload,
      correlationId: subjectId,
      tenantId: 'trackmind',
      racetrackId: 'main-track',
      severity: payload.severity === 'critical' ? 'critical' : 'warning',
      regulations: ['HISA', 'NIMS/ICS'],
      evidence: [{ id: auditId, uri: `audit://incidents/${subjectId}`, description: action }],
    });
  }

  private publishEvent(eventType: string, subjectId: string, actor: string, payload: Record<string, unknown>, auditId: string, eventId: string) {
    void this.deps.eventBus?.publish({
      id: eventId,
      type: eventType,
      tenantId: 'trackmind',
      racetrackId: 'main-track',
      actor: { id: actor, type: 'human' },
      subject: { id: subjectId, type: 'incident', tenantId: 'trackmind' },
      evidence: [auditId],
      auditRef: auditId,
      payload: { subjectId, auditId, ...payload },
      aggregateId: subjectId,
      producer: 'incident-service',
      correlationId: auditId,
      metadata: { team: 'safety-operations', accountableRole: 'incident-commander', compliance: 'regulated' },
    });
  }
}
