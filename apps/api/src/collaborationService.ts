import type { NexusOperationalActorType } from '@trackmind/shared';
import { ImmutableAuditLog, type AuditLogEntry, type EvidenceReference } from './auditLog.js';
import type { ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type EventName, type RaceDayEvent } from './eventBus.js';

export type CollaborationArtifactKind = 'thread' | 'comment' | 'assignment' | 'decision' | 'handoff' | 'evidence-packet' | 'incident-room';
export type CollaborationActorType = NexusOperationalActorType;
export type CollaborationEventType =
  | 'collaboration.thread.created'
  | 'collaboration.comment.created'
  | 'collaboration.assignment.created'
  | 'collaboration.decision.recorded'
  | 'collaboration.handoff.created'
  | 'collaboration.evidence-packet.created'
  | 'collaboration.incident-room.opened';

export interface CollaborationTargetContext {
  tenantId: string;
  racetrackId: string;
  targetArtifactId: string;
  targetArtifactType: string;
}

export interface CollaborationPrincipal {
  id: string;
  tenantId?: string;
  racetrackId?: string;
  scopes?: string[];
  roles?: string[];
  actorType?: CollaborationActorType;
}

export interface CollaborationCommandOptions {
  now?: string;
  correlationId?: string;
  actorType?: CollaborationActorType;
}

export interface CollaborationAuditEventRefs {
  auditRefs: string[];
  eventRefs: string[];
  latestAuditRef?: string;
  latestEventRef?: string;
}

export interface CollaborationArtifactBase extends CollaborationTargetContext, CollaborationAuditEventRefs {
  id: string;
  schemaVersion: string;
  artifactType: CollaborationArtifactKind;
  createdAt: string;
  createdBy: string;
  correlationId: string;
  evidence: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
  protectedStateMutationAllowed: false;
  operationalMutationAllowed: false;
  mutationPolicy: { localMutationAllowed: false; writeModel: 'collaboration-artifacts-only'; protectedOperationalState: 'never-mutated' };
}

export interface CollaborationThread extends CollaborationArtifactBase {
  artifactType: 'thread';
  title: string;
  status: 'open' | 'resolved' | 'archived';
  participants: string[];
  commentIds: string[];
  assignmentIds: string[];
  decisionIds: string[];
  handoffIds: string[];
  evidencePacketIds: string[];
  incidentRoomIds: string[];
}

export interface CollaborationComment extends CollaborationArtifactBase {
  artifactType: 'comment';
  threadId: string;
  body: string;
  mentions: string[];
  visibility: 'tenant' | 'racetrack' | 'approval-panel' | 'incident-room';
}

export interface CollaborationAssignment extends CollaborationArtifactBase {
  artifactType: 'assignment';
  threadId: string;
  assigneeId: string;
  assignedBy: string;
  role?: string;
  dueAt?: string;
  status: 'open' | 'accepted' | 'completed' | 'cancelled';
  reason?: string;
}

export interface CollaborationDecisionRecord extends CollaborationArtifactBase {
  artifactType: 'decision';
  threadId: string;
  decision: string;
  rationale: string;
  decidedBy: string;
  status: 'proposed' | 'recorded' | 'superseded';
  impactsProtectedState: false;
}

export interface CollaborationHandoff extends CollaborationArtifactBase {
  artifactType: 'handoff';
  threadId: string;
  fromActorId: string;
  toActorId: string;
  summary: string;
  accepted: false;
}

export interface CollaborationEvidencePacket extends CollaborationArtifactBase {
  artifactType: 'evidence-packet';
  threadId: string;
  packetTitle: string;
  evidenceRefs: EvidenceReference[];
  sealed: false;
}

export interface CollaborationIncidentRoom extends CollaborationArtifactBase {
  artifactType: 'incident-room';
  threadId: string;
  roomTitle: string;
  severity: 'info' | 'warning' | 'critical';
  participantIds: string[];
  linkedIncidentId?: string;
}

export type CollaborationArtifact =
  | CollaborationThread
  | CollaborationComment
  | CollaborationAssignment
  | CollaborationDecisionRecord
  | CollaborationHandoff
  | CollaborationEvidencePacket
  | CollaborationIncidentRoom;

export interface CollaborationActivityEntry {
  id: string;
  artifactType: CollaborationArtifactKind;
  eventType?: CollaborationEventType;
  tenantId: string;
  racetrackId: string;
  targetArtifactId: string;
  targetArtifactType: string;
  actor: string;
  createdAt: string;
  summary: string;
  auditRefs: string[];
  eventRefs: string[];
  approvalRef?: string;
  threadId?: string;
}

export interface CollaborationThreadQuery extends Partial<CollaborationTargetContext> {
  threadId?: string;
  approvalRef?: string;
  limit?: number;
  offset?: number;
}

export interface CollaborationActivityQuery extends Partial<CollaborationTargetContext> {
  threadId?: string;
  approvalRef?: string;
  limit?: number;
  offset?: number;
}

export interface CollaborationThreadQueryResult {
  total: number;
  threads: CollaborationThread[];
}

export interface CollaborationActivityResult {
  total: number;
  activity: CollaborationActivityEntry[];
}

export interface CollaborationCreateCommentInput extends CollaborationTargetContext {
  threadId?: string;
  title?: string;
  body: string;
  mentions?: string[];
  visibility?: CollaborationComment['visibility'];
  evidence?: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
}

export interface CollaborationCreateAssignmentInput extends CollaborationTargetContext {
  threadId?: string;
  title?: string;
  assigneeId: string;
  role?: string;
  dueAt?: string;
  reason?: string;
  evidence?: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
}

export interface CollaborationCreateDecisionInput extends CollaborationTargetContext {
  threadId?: string;
  title?: string;
  decision: string;
  rationale: string;
  evidence?: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
}

export interface CollaborationCreateHandoffInput extends CollaborationTargetContext {
  threadId?: string;
  title?: string;
  fromActorId: string;
  toActorId: string;
  summary: string;
  evidence?: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
}

export interface CollaborationCreateEvidencePacketInput extends CollaborationTargetContext {
  threadId?: string;
  title?: string;
  packetTitle: string;
  evidenceRefs: EvidenceReference[];
  evidence?: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
}

export interface CollaborationOpenIncidentRoomInput extends CollaborationTargetContext {
  threadId?: string;
  title?: string;
  roomTitle: string;
  severity?: CollaborationIncidentRoom['severity'];
  participantIds?: string[];
  linkedIncidentId?: string;
  evidence?: string[];
  approvalRef?: string;
  workflowRef?: string;
  incidentRef?: string;
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const eventTypes: CollaborationEventType[] = ['collaboration.thread.created', 'collaboration.comment.created', 'collaboration.assignment.created', 'collaboration.decision.recorded', 'collaboration.handoff.created', 'collaboration.evidence-packet.created', 'collaboration.incident-room.opened'];

export class CollaborationService {
  readonly auditLog: ImmutableAuditLog;
  readonly eventBus: UniversalEventBus;
  private readonly threads = new Map<string, CollaborationThread>();
  private readonly comments = new Map<string, CollaborationComment>();
  private readonly assignments = new Map<string, CollaborationAssignment>();
  private readonly decisions = new Map<string, CollaborationDecisionRecord>();
  private readonly handoffs = new Map<string, CollaborationHandoff>();
  private readonly evidencePackets = new Map<string, CollaborationEvidencePacket>();
  private readonly incidentRooms = new Map<string, CollaborationIncidentRoom>();
  private readonly activityLog: CollaborationActivityEntry[] = [];

  constructor(options: { auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus } = {}) {
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.registerEventSchemas();
  }

  async createComment(input: CollaborationCreateCommentInput, principal: CollaborationPrincipal, options: CollaborationCommandOptions = {}): Promise<{ thread: CollaborationThread; comment: CollaborationComment; audit: AuditLogEntry; event: RaceDayEvent; metadata: CollaborationMutationMetadata }> {
    this.authorize(principal, 'collaboration:write');
    const context = this.requireContext(input, principal);
    const thread = await this.ensureThread(context, principal, input.title, input, options);
    const now = options.now ?? new Date().toISOString();
    if (!input.body) throw new Error('comment body is required');
    const comment: CollaborationComment = this.base('comment', context, principal, now, options, input, input.evidence);
    comment.threadId = thread.id;
    comment.body = input.body;
    comment.mentions = [...new Set(input.mentions ?? [])];
    comment.visibility = input.visibility ?? (input.approvalRef ? 'approval-panel' : 'tenant');
    const saved = await this.persist(comment, 'collaboration.comment.created', principal, options, `Comment added to ${context.targetArtifactId}`);
    this.comments.set(saved.artifact.id, saved.artifact as CollaborationComment);
    this.updateThread(thread.id, (current) => ({ ...current, commentIds: [...new Set([...current.commentIds, comment.id])], participants: [...new Set([...current.participants, principal.id, ...comment.mentions])] }));
    return { thread: this.requireThread(thread.id, principal), comment: this.getComment(comment.id, principal), audit: saved.audit, event: saved.event, metadata: mutationMetadata(saved.audit.id, saved.event.id) };
  }

  async createAssignment(input: CollaborationCreateAssignmentInput, principal: CollaborationPrincipal, options: CollaborationCommandOptions = {}): Promise<{ thread: CollaborationThread; assignment: CollaborationAssignment; audit: AuditLogEntry; event: RaceDayEvent; metadata: CollaborationMutationMetadata }> {
    this.authorize(principal, 'collaboration:write');
    const context = this.requireContext(input, principal);
    const thread = await this.ensureThread(context, principal, input.title, input, options);
    if (!input.assigneeId) throw new Error('assigneeId is required');
    const now = options.now ?? new Date().toISOString();
    const assignment: CollaborationAssignment = { ...this.base('assignment', context, principal, now, options, input, input.evidence), threadId: thread.id, assigneeId: input.assigneeId, assignedBy: principal.id, role: input.role, dueAt: input.dueAt, status: 'open', reason: input.reason };
    const saved = await this.persist(assignment, 'collaboration.assignment.created', principal, options, `Assignment created for ${input.assigneeId}`);
    this.assignments.set(saved.artifact.id, saved.artifact as CollaborationAssignment);
    this.updateThread(thread.id, (current) => ({ ...current, assignmentIds: [...new Set([...current.assignmentIds, assignment.id])], participants: [...new Set([...current.participants, principal.id, input.assigneeId])] }));
    return { thread: this.requireThread(thread.id, principal), assignment: this.getAssignment(assignment.id, principal), audit: saved.audit, event: saved.event, metadata: mutationMetadata(saved.audit.id, saved.event.id) };
  }

  async recordDecision(input: CollaborationCreateDecisionInput, principal: CollaborationPrincipal, options: CollaborationCommandOptions = {}): Promise<{ thread: CollaborationThread; decision: CollaborationDecisionRecord; audit: AuditLogEntry; event: RaceDayEvent; metadata: CollaborationMutationMetadata }> {
    this.authorize(principal, 'collaboration:write');
    const context = this.requireContext(input, principal);
    const thread = await this.ensureThread(context, principal, input.title, input, options);
    if (!input.decision) throw new Error('decision is required');
    if (!input.rationale) throw new Error('rationale is required');
    const now = options.now ?? new Date().toISOString();
    const decision: CollaborationDecisionRecord = { ...this.base('decision', context, principal, now, options, input, input.evidence), threadId: thread.id, decision: input.decision, rationale: input.rationale, decidedBy: principal.id, status: 'recorded', impactsProtectedState: false };
    const saved = await this.persist(decision, 'collaboration.decision.recorded', principal, options, `Decision recorded for ${context.targetArtifactId}`);
    this.decisions.set(saved.artifact.id, saved.artifact as CollaborationDecisionRecord);
    this.updateThread(thread.id, (current) => ({ ...current, decisionIds: [...new Set([...current.decisionIds, decision.id])], participants: [...new Set([...current.participants, principal.id])] }));
    return { thread: this.requireThread(thread.id, principal), decision: this.getDecision(decision.id, principal), audit: saved.audit, event: saved.event, metadata: mutationMetadata(saved.audit.id, saved.event.id) };
  }

  async createHandoff(input: CollaborationCreateHandoffInput, principal: CollaborationPrincipal, options: CollaborationCommandOptions = {}): Promise<CollaborationHandoff> {
    this.authorize(principal, 'collaboration:write');
    const context = this.requireContext(input, principal);
    const thread = await this.ensureThread(context, principal, input.title, input, options);
    const handoff: CollaborationHandoff = { ...this.base('handoff', context, principal, options.now ?? new Date().toISOString(), options, input, input.evidence), threadId: thread.id, fromActorId: input.fromActorId, toActorId: input.toActorId, summary: input.summary, accepted: false };
    const saved = await this.persist(handoff, 'collaboration.handoff.created', principal, options, `Handoff created for ${input.toActorId}`);
    this.handoffs.set(saved.artifact.id, saved.artifact as CollaborationHandoff);
    this.updateThread(thread.id, (current) => ({ ...current, handoffIds: [...new Set([...current.handoffIds, handoff.id])], participants: [...new Set([...current.participants, input.fromActorId, input.toActorId])] }));
    return this.getHandoff(handoff.id, principal);
  }

  async createEvidencePacket(input: CollaborationCreateEvidencePacketInput, principal: CollaborationPrincipal, options: CollaborationCommandOptions = {}): Promise<CollaborationEvidencePacket> {
    this.authorize(principal, 'collaboration:write');
    const context = this.requireContext(input, principal);
    const thread = await this.ensureThread(context, principal, input.title, input, options);
    const evidenceRefs = input.evidenceRefs ?? [];
    if (evidenceRefs.length === 0) throw new Error('evidenceRefs are required');
    const packet: CollaborationEvidencePacket = { ...this.base('evidence-packet', context, principal, options.now ?? new Date().toISOString(), options, input, [...(input.evidence ?? []), ...evidenceRefs.map((item) => item.id)]), threadId: thread.id, packetTitle: input.packetTitle, evidenceRefs: evidenceRefs.map((item) => ({ ...item })), sealed: false };
    const saved = await this.persist(packet, 'collaboration.evidence-packet.created', principal, options, `Evidence packet created for ${context.targetArtifactId}`);
    this.evidencePackets.set(saved.artifact.id, saved.artifact as CollaborationEvidencePacket);
    this.updateThread(thread.id, (current) => ({ ...current, evidencePacketIds: [...new Set([...current.evidencePacketIds, packet.id])] }));
    return this.getEvidencePacket(packet.id, principal);
  }

  async openIncidentRoom(input: CollaborationOpenIncidentRoomInput, principal: CollaborationPrincipal, options: CollaborationCommandOptions = {}): Promise<CollaborationIncidentRoom> {
    this.authorize(principal, 'collaboration:write');
    const context = this.requireContext(input, principal);
    const thread = await this.ensureThread(context, principal, input.title, input, options);
    const participantIds = [...new Set([principal.id, ...(input.participantIds ?? [])])];
    const room: CollaborationIncidentRoom = { ...this.base('incident-room', context, principal, options.now ?? new Date().toISOString(), options, input, input.evidence), threadId: thread.id, roomTitle: input.roomTitle, severity: input.severity ?? 'warning', participantIds, linkedIncidentId: input.linkedIncidentId };
    const saved = await this.persist(room, 'collaboration.incident-room.opened', principal, options, `Incident room opened for ${context.targetArtifactId}`);
    this.incidentRooms.set(saved.artifact.id, saved.artifact as CollaborationIncidentRoom);
    this.updateThread(thread.id, (current) => ({ ...current, incidentRoomIds: [...new Set([...current.incidentRoomIds, room.id])], participants: [...new Set([...current.participants, ...participantIds])] }));
    return this.getIncidentRoom(room.id, principal);
  }

  queryThreads(query: CollaborationThreadQuery, principal: CollaborationPrincipal): CollaborationThreadQueryResult {
    this.authorize(principal, 'collaboration:read');
    const scoped = this.scopeQuery(query, principal);
    let threads = [...this.threads.values()].filter((thread) => matchesThread(thread, scoped));
    threads = threads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = threads.length;
    const offset = query.offset ?? 0;
    return { total, threads: threads.slice(offset, offset + (query.limit ?? 100)).map(clone) };
  }

  activity(query: CollaborationActivityQuery, principal: CollaborationPrincipal): CollaborationActivityResult {
    this.authorize(principal, 'collaboration:read');
    const scoped = this.scopeQuery(query, principal);
    let activity = this.activityLog.filter((entry) => matchesActivity(entry, scoped));
    activity = activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = activity.length;
    const offset = query.offset ?? 0;
    return { total, activity: activity.slice(offset, offset + (query.limit ?? 100)).map(clone) };
  }

  apiDefinition(): ApiServiceDefinition {
    return collaborationApiDefinition();
  }

  private async ensureThread(context: CollaborationTargetContext, principal: CollaborationPrincipal, title: string | undefined, refs: { threadId?: string; approvalRef?: string; workflowRef?: string; incidentRef?: string; evidence?: string[] }, options: CollaborationCommandOptions): Promise<CollaborationThread> {
    if (refs.threadId) {
      const thread = this.requireThread(refs.threadId, principal);
      if (thread.tenantId !== context.tenantId || thread.racetrackId !== context.racetrackId || thread.targetArtifactId !== context.targetArtifactId || thread.targetArtifactType !== context.targetArtifactType) throw new Error('thread target context mismatch');
      return thread;
    }
    if (refs.approvalRef) {
      const approvalThread = [...this.threads.values()].find((thread) => thread.tenantId === context.tenantId && thread.racetrackId === context.racetrackId && thread.targetArtifactId === context.targetArtifactId && thread.targetArtifactType === context.targetArtifactType && thread.approvalRef === refs.approvalRef);
      if (approvalThread) return clone(approvalThread);
    }
    const existing = [...this.threads.values()].find((thread) => thread.tenantId === context.tenantId && thread.racetrackId === context.racetrackId && thread.targetArtifactId === context.targetArtifactId && thread.targetArtifactType === context.targetArtifactType && !thread.approvalRef);
    if (existing && !refs.approvalRef) return clone(existing);
    const now = options.now ?? new Date().toISOString();
    const thread: CollaborationThread = { ...this.base('thread', context, principal, now, options, refs, refs.evidence), title: title ?? `Discussion for ${context.targetArtifactType}:${context.targetArtifactId}`, status: 'open', participants: [principal.id], commentIds: [], assignmentIds: [], decisionIds: [], handoffIds: [], evidencePacketIds: [], incidentRoomIds: [] };
    const saved = await this.persist(thread, 'collaboration.thread.created', principal, options, `Thread created for ${context.targetArtifactId}`);
    this.threads.set(saved.artifact.id, saved.artifact as CollaborationThread);
    return this.requireThread(thread.id, principal);
  }

  private base<T extends CollaborationArtifactKind>(artifactType: T, context: CollaborationTargetContext, principal: CollaborationPrincipal, createdAt: string, options: CollaborationCommandOptions, refs: { approvalRef?: string; workflowRef?: string; incidentRef?: string }, evidence: string[] = []): Extract<CollaborationArtifact, { artifactType: T }> {
    return {
      id: id(`collab-${artifactType}`),
      schemaVersion: `trackmind.collaboration.${artifactType}.v1`,
      artifactType,
      tenantId: context.tenantId,
      racetrackId: context.racetrackId,
      targetArtifactId: context.targetArtifactId,
      targetArtifactType: context.targetArtifactType,
      createdAt,
      createdBy: principal.id,
      correlationId: options.correlationId ?? id('corr-collaboration'),
      evidence: [...new Set(evidence)],
      approvalRef: refs.approvalRef,
      workflowRef: refs.workflowRef,
      incidentRef: refs.incidentRef,
      auditRefs: [],
      eventRefs: [],
      protectedStateMutationAllowed: false,
      operationalMutationAllowed: false,
      mutationPolicy: { localMutationAllowed: false, writeModel: 'collaboration-artifacts-only', protectedOperationalState: 'never-mutated' },
    } as unknown as Extract<CollaborationArtifact, { artifactType: T }>;
  }

  private async persist<T extends CollaborationArtifact>(artifact: T, eventType: CollaborationEventType, principal: CollaborationPrincipal, options: CollaborationCommandOptions, summary: string): Promise<{ artifact: T; audit: AuditLogEntry; event: RaceDayEvent }> {
    const evidenceIds = artifact.evidence.length ? artifact.evidence : [`collaboration:${artifact.id}`];
    const audit = this.auditLog.append({
      id: id('audit-collaboration'),
      type: 'user-action',
      actor: principal.id,
      actorType: options.actorType ?? principal.actorType ?? 'human',
      timestamp: artifact.createdAt,
      action: eventType,
      actionClass: 'user',
      sourceService: 'collaboration-service',
      apiRoute: '/api/v1/collaboration',
      subjectId: artifact.targetArtifactId,
      tenantId: artifact.tenantId,
      correlationId: artifact.correlationId,
      severity: eventType.includes('incident') ? 'warning' : 'info',
      regulations: ['SOC-2', 'HISA'],
      evidenceIds,
      payload: { artifactId: artifact.id, artifactType: artifact.artifactType, targetArtifactId: artifact.targetArtifactId, targetArtifactType: artifact.targetArtifactType, approvalRef: artifact.approvalRef, operationalMutationAllowed: false },
    });
    const withAudit = withRefs(artifact, audit.id);
    const event = await this.eventBus.publish({
      type: eventType,
      payload: { artifact: withAudit, actor: principal.id, tenantId: artifact.tenantId, racetrackId: artifact.racetrackId, action: eventType, operationalMutationAllowed: false },
      aggregateId: artifact.targetArtifactId,
      producer: 'collaboration-service',
      tenantId: artifact.tenantId,
      racetrackId: artifact.racetrackId,
      correlationId: artifact.correlationId,
      auditRef: audit.id,
      approvalRef: artifact.approvalRef,
      workflowRef: artifact.workflowRef,
      actor: { id: principal.id, type: eventActorType(options.actorType ?? principal.actorType) },
      subject: { id: artifact.targetArtifactId, type: artifact.targetArtifactType, tenantId: artifact.tenantId },
      evidence: evidenceIds,
      metadata: { tenantId: artifact.tenantId, racetrackId: artifact.racetrackId, team: 'collaboration', accountableRole: 'operations-collaboration-owner', compliance: 'regulated', protectedStateMutationAllowed: false },
    });
    const saved = withRefs(withAudit, undefined, event.id);
    this.activityLog.push({ id: `${event.id}:activity`, artifactType: artifact.artifactType, eventType, tenantId: artifact.tenantId, racetrackId: artifact.racetrackId, targetArtifactId: artifact.targetArtifactId, targetArtifactType: artifact.targetArtifactType, actor: principal.id, createdAt: artifact.createdAt, summary, auditRefs: [...saved.auditRefs], eventRefs: [...saved.eventRefs], approvalRef: artifact.approvalRef, threadId: 'threadId' in artifact ? String(artifact.threadId) : artifact.artifactType === 'thread' ? artifact.id : undefined });
    return { artifact: clone(saved), audit, event };
  }

  private registerEventSchemas(): void {
    for (const type of eventTypes) {
      this.eventBus.registerEvent({
        type,
        version: 1,
        description: `Collaboration service ${type.replace('collaboration.', '')} event`,
        owner: { service: 'collaboration-service', team: 'collaboration', accountableRole: 'operations-collaboration-owner' },
        payloadFields: ['artifact', 'actor', 'tenantId', 'racetrackId', 'action', 'operationalMutationAllowed'],
        compliance: 'regulated',
        standards: { tenantScoped: true, racetrackScoped: true, correlationRequired: true, auditRequired: true, replayable: true, requiredMetadata: ['actor', 'subject'] },
      });
    }
  }

  private authorize(principal: CollaborationPrincipal, scope: 'collaboration:read' | 'collaboration:write'): void {
    if (!principal.id) throw new Error('authentication required');
    if (principal.scopes && !principal.scopes.includes(scope)) throw new Error(`missing scope: ${scope}`);
  }

  private requireContext(input: Partial<CollaborationTargetContext>, principal: CollaborationPrincipal): CollaborationTargetContext {
    const tenantId = input.tenantId ?? principal.tenantId;
    const racetrackId = input.racetrackId ?? principal.racetrackId;
    if (!tenantId) throw new Error('tenantId is required');
    if (!racetrackId) throw new Error('racetrackId is required');
    if (principal.tenantId && tenantId !== principal.tenantId) throw new Error('tenant isolation violation');
    if (principal.racetrackId && racetrackId !== principal.racetrackId) throw new Error('racetrack isolation violation');
    if (!input.targetArtifactId) throw new Error('targetArtifactId is required');
    if (!input.targetArtifactType) throw new Error('targetArtifactType is required');
    return { tenantId, racetrackId, targetArtifactId: input.targetArtifactId, targetArtifactType: input.targetArtifactType };
  }

  private scopeQuery<T extends CollaborationThreadQuery | CollaborationActivityQuery>(query: T, principal: CollaborationPrincipal): T {
    const tenantId = query.tenantId ?? principal.tenantId;
    const racetrackId = query.racetrackId ?? principal.racetrackId;
    if (!tenantId) throw new Error('tenantId is required');
    if (!racetrackId) throw new Error('racetrackId is required');
    if (principal.tenantId && tenantId !== principal.tenantId) throw new Error('tenant isolation violation');
    if (principal.racetrackId && racetrackId !== principal.racetrackId) throw new Error('racetrack isolation violation');
    if (!query.targetArtifactId) throw new Error('targetArtifactId is required');
    if (!query.targetArtifactType) throw new Error('targetArtifactType is required');
    return { ...query, tenantId, racetrackId };
  }

  private requireThread(threadId: string, principal: CollaborationPrincipal): CollaborationThread {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error(`collaboration thread not found: ${threadId}`);
    this.assertAccess(thread, principal);
    return clone(thread);
  }

  private getComment(id: string, principal: CollaborationPrincipal): CollaborationComment {
    const artifact = this.comments.get(id);
    if (!artifact) throw new Error(`collaboration comment not found: ${id}`);
    this.assertAccess(artifact, principal);
    return clone(artifact);
  }

  private getAssignment(id: string, principal: CollaborationPrincipal): CollaborationAssignment {
    const artifact = this.assignments.get(id);
    if (!artifact) throw new Error(`collaboration assignment not found: ${id}`);
    this.assertAccess(artifact, principal);
    return clone(artifact);
  }

  private getDecision(id: string, principal: CollaborationPrincipal): CollaborationDecisionRecord {
    const artifact = this.decisions.get(id);
    if (!artifact) throw new Error(`collaboration decision not found: ${id}`);
    this.assertAccess(artifact, principal);
    return clone(artifact);
  }

  private getHandoff(id: string, principal: CollaborationPrincipal): CollaborationHandoff {
    const artifact = this.handoffs.get(id);
    if (!artifact) throw new Error(`collaboration handoff not found: ${id}`);
    this.assertAccess(artifact, principal);
    return clone(artifact);
  }

  private getEvidencePacket(id: string, principal: CollaborationPrincipal): CollaborationEvidencePacket {
    const artifact = this.evidencePackets.get(id);
    if (!artifact) throw new Error(`collaboration evidence packet not found: ${id}`);
    this.assertAccess(artifact, principal);
    return clone(artifact);
  }

  private getIncidentRoom(id: string, principal: CollaborationPrincipal): CollaborationIncidentRoom {
    const artifact = this.incidentRooms.get(id);
    if (!artifact) throw new Error(`collaboration incident room not found: ${id}`);
    this.assertAccess(artifact, principal);
    return clone(artifact);
  }

  private updateThread(threadId: string, update: (thread: CollaborationThread) => CollaborationThread): void {
    const current = this.threads.get(threadId);
    if (!current) throw new Error(`collaboration thread not found: ${threadId}`);
    this.threads.set(threadId, clone(update(current)));
  }

  private assertAccess(artifact: CollaborationArtifact | CollaborationThread, principal: CollaborationPrincipal): void {
    if (principal.tenantId && artifact.tenantId !== principal.tenantId) throw new Error('tenant isolation violation');
    if (principal.racetrackId && artifact.racetrackId !== principal.racetrackId) throw new Error('racetrack isolation violation');
  }
}

export interface CollaborationMutationMetadata {
  audited: true;
  eventPublished: true;
  auditRefs: string[];
  eventRefs: string[];
  executionAllowed: false;
  operationalMutationAllowed: false;
  protectedStateMutationAllowed: false;
  message: string;
}

export function collaborationApiDefinition(): ApiServiceDefinition {
  return {
    id: 'collaboration-service',
    name: 'Collaboration Service',
    domain: 'collaboration',
    version: 'v1',
    basePath: '/api/v1/collaboration',
    description: 'Tenant-aware collaboration artifacts for threads, comments, assignments, decisions, handoffs, evidence packets, and incident rooms attached to TrackMind target artifacts.',
    owner: { team: 'collaboration', productOwner: 'Director of Racing Operations', technicalOwner: 'Collaboration Service Owner', supportChannel: '#trackmind-collaboration' },
    lifecycle: 'active',
    auth: ['jwt', 'oauth2', 'mtls'],
    rateLimit: { requests: 600, perSeconds: 60, burst: 100 },
    tags: ['collaboration', 'audit', 'events', 'tenant-isolation', 'approvals'],
    slo: { availability: 99.9, latencyMs: 200 },
    endpoints: [
      { method: 'GET', path: '/threads', summary: 'List collaboration threads attached to a target artifact', scopes: ['collaboration:read'] },
      { method: 'POST', path: '/comments', summary: 'Create a comment artifact without mutating operational state', scopes: ['collaboration:write'] },
      { method: 'POST', path: '/assignments', summary: 'Create an assignment artifact without mutating operational state', scopes: ['collaboration:write'] },
      { method: 'POST', path: '/decisions', summary: 'Record a collaboration decision artifact without executing protected actions', scopes: ['collaboration:write'] },
      { method: 'GET', path: '/activity', summary: 'List collaboration audit/event activity for a target artifact', scopes: ['collaboration:read'] },
    ],
    dependencies: [{ serviceId: 'audit-ledger', apiId: 'immutable-audit-log', version: 'v1', criticality: 'high' }, { serviceId: 'event-bus', apiId: 'universal-event-bus', version: 'v1', criticality: 'high' }, { serviceId: 'approvals', apiId: 'centralized-approval-service', version: 'v1', criticality: 'medium' }],
  };
}

function withRefs<T extends CollaborationArtifact>(artifact: T, auditRef?: string, eventRef?: string): T {
  return clone({ ...artifact, auditRefs: [...new Set([...artifact.auditRefs, ...(auditRef ? [auditRef] : [])])], eventRefs: [...new Set([...artifact.eventRefs, ...(eventRef ? [eventRef] : [])])], latestAuditRef: auditRef ?? artifact.latestAuditRef, latestEventRef: eventRef ?? artifact.latestEventRef });
}

function eventActorType(actorType: CollaborationActorType | undefined): 'human' | 'service' | 'ai-agent' | 'system' {
  if (actorType === 'human' || actorType === 'ai-agent' || actorType === 'system') return actorType;
  return 'service';
}

function mutationMetadata(auditRef: string, eventRef: string): CollaborationMutationMetadata {
  return {
    audited: true,
    eventPublished: true,
    auditRefs: [auditRef],
    eventRefs: [eventRef],
    executionAllowed: false,
    operationalMutationAllowed: false,
    protectedStateMutationAllowed: false,
    message: 'Collaboration artifact created and referenced by audit/event metadata only; protected operational state was not mutated.',
  };
}

function matchesThread(thread: CollaborationThread, query: CollaborationThreadQuery): boolean {
  return (!query.tenantId || thread.tenantId === query.tenantId)
    && (!query.racetrackId || thread.racetrackId === query.racetrackId)
    && (!query.targetArtifactId || thread.targetArtifactId === query.targetArtifactId)
    && (!query.targetArtifactType || thread.targetArtifactType === query.targetArtifactType)
    && (!query.threadId || thread.id === query.threadId)
    && (!query.approvalRef || thread.approvalRef === query.approvalRef);
}

function matchesActivity(entry: CollaborationActivityEntry, query: CollaborationActivityQuery): boolean {
  return (!query.tenantId || entry.tenantId === query.tenantId)
    && (!query.racetrackId || entry.racetrackId === query.racetrackId)
    && (!query.targetArtifactId || entry.targetArtifactId === query.targetArtifactId)
    && (!query.targetArtifactType || entry.targetArtifactType === query.targetArtifactType)
    && (!query.threadId || entry.threadId === query.threadId)
    && (!query.approvalRef || entry.approvalRef === query.approvalRef);
}
