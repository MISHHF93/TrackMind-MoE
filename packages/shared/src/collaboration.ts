export const trackMindCollaborationSchemaVersion = 'trackmind.collaboration.v1' as const;

export const collaborationTargetArtifactTypes = [
  'Race',
  'RaceCard',
  'RaceEntry',
  'RaceResult',
  'GateMoveRequest',
  'SurfaceRecommendation',
  'Horse',
  'Barn',
  'Asset',
  'DigitalTwin',
  'Incident',
  'Investigation',
  'Approval',
  'Audit',
  'ComplianceControl',
  'AIRecommendation',
  'Workflow',
  'ApiHubIngestionJob',
  'ApiHubProvider',
] as const;

export type CollaborationTargetArtifactType = typeof collaborationTargetArtifactTypes[number] | (string & {});
export type CollaborationVisibility = 'team' | 'tenant' | 'restricted' | 'regulator-package';
export type CollaborationStatus = 'open' | 'resolved' | 'archived' | 'escalated';
export type CollaborationPriority = 'low' | 'medium' | 'high' | 'critical';
export type CommentThreadObjectType = 'CommentThread' | 'ApprovalDiscussion' | 'StewardCaseDiscussion' | 'MaintenanceDiscussion' | 'AIRecommendationDiscussion' | 'ComplianceReviewDiscussion';

export interface CollaborationRetentionPolicy {
  policyId: string;
  retainForDays: number;
  legalHold: boolean;
  regulatoryBasis?: string;
}

export interface CollaborationAttachment {
  attachmentId: string;
  kind: 'evidence' | 'document' | 'image' | 'video' | 'link' | 'audit-ref' | 'event-ref';
  uri?: string;
  evidenceRef?: string;
  hash?: string;
  sensitive?: boolean;
}

export interface CollaborationContext {
  id: string;
  tenantId: string;
  racetrackId: string;
  targetArtifactId: string;
  targetArtifactType: CollaborationTargetArtifactType;
  authorId: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  status: CollaborationStatus;
  visibility: CollaborationVisibility;
  permissions: string[];
  auditRefs: string[];
  eventRefs: string[];
  attachments?: CollaborationAttachment[];
  evidenceRefs: string[];
  retentionPolicy: CollaborationRetentionPolicy;
  workflowId?: string;
  approvalId?: string;
  digitalTwinRef?: string;
}

export interface CommentThread extends CollaborationContext {
  objectType: CommentThreadObjectType;
  title: string;
  comments: Comment[];
  unreadBy?: string[];
}

export interface Comment extends Omit<CollaborationContext, 'attachments'> {
  objectType: 'Comment';
  threadId: string;
  body: string;
  mentions: Mention[];
  attachments: CollaborationAttachment[];
}

export interface Mention {
  objectType: 'Mention';
  mentionId: string;
  tenantId: string;
  racetrackId: string;
  threadId: string;
  commentId?: string;
  actorId: string;
  mentionedActorId: string;
  targetArtifactId: string;
  targetArtifactType: CollaborationTargetArtifactType;
  createdAt: string;
  acknowledgedAt?: string;
  auditRefs: string[];
  eventRefs: string[];
}

export interface Assignment extends CollaborationContext {
  objectType: 'Assignment';
  assigneeId: string;
  assignedBy: string;
  dueAt?: string;
  priority: CollaborationPriority;
  task: string;
}

export interface DecisionRecord extends CollaborationContext {
  objectType: 'DecisionRecord';
  decision: string;
  rationale: string;
  alternativesConsidered: string[];
  outcome: 'accepted' | 'rejected' | 'superseded' | 'pending-review';
}

export interface Handoff extends CollaborationContext {
  objectType: 'Handoff';
  fromActorId: string;
  toActorId: string;
  reason: string;
  acceptedAt?: string;
}

export interface EvidencePacket extends CollaborationContext {
  objectType: 'EvidencePacket';
  packetId: string;
  title: string;
  items: CollaborationAttachment[];
  sealed: boolean;
}

export interface IncidentRoom extends CollaborationContext {
  objectType: 'IncidentRoom';
  incidentId: string;
  severity: CollaborationPriority;
  activeParticipants: string[];
  commandLeadId: string;
}

export interface ApprovalDiscussion extends Omit<CommentThread, 'objectType'> {
  objectType: 'ApprovalDiscussion';
  approvalId: string;
}

export interface StewardCaseDiscussion extends Omit<CommentThread, 'objectType'> {
  objectType: 'StewardCaseDiscussion';
  caseId: string;
  officialRulingAllowed: false;
}

export interface MaintenanceDiscussion extends Omit<CommentThread, 'objectType'> {
  objectType: 'MaintenanceDiscussion';
  workOrderId?: string;
}

export interface AIRecommendationDiscussion extends Omit<CommentThread, 'objectType'> {
  objectType: 'AIRecommendationDiscussion';
  recommendationId: string;
  aiGenerated: true;
  confidence: number;
  approvalRequired: true;
}

export interface ComplianceReviewDiscussion extends Omit<CommentThread, 'objectType'> {
  objectType: 'ComplianceReviewDiscussion';
  controlId: string;
  framework: string;
}

export type CollaborationObject =
  | CommentThread
  | Comment
  | Mention
  | Assignment
  | DecisionRecord
  | Handoff
  | EvidencePacket
  | IncidentRoom
  | ApprovalDiscussion
  | StewardCaseDiscussion
  | MaintenanceDiscussion
  | AIRecommendationDiscussion
  | ComplianceReviewDiscussion;

export const collaborationEventTypes = [
  'CommentAdded',
  'MentionCreated',
  'AssignmentCreated',
  'DecisionRecorded',
  'HandoffRequested',
  'EvidencePacketCreated',
  'IncidentRoomOpened',
  'ApprovalDiscussionUpdated',
  'CollaborationArchived',
] as const;

export type CollaborationEventType = typeof collaborationEventTypes[number];

export interface CollaborationEvent {
  schemaVersion: typeof trackMindCollaborationSchemaVersion;
  eventType: CollaborationEventType;
  eventId: string;
  occurredAt: string;
  tenantId: string;
  racetrackId: string;
  actorId: string;
  targetArtifactId: string;
  targetArtifactType: CollaborationTargetArtifactType;
  collaborationObjectId: string;
  auditRefs: string[];
  eventRefs: string[];
  workflowId?: string;
  approvalId?: string;
  digitalTwinRef?: string;
}

function hasStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateCollaborationContext(value: Partial<CollaborationContext>) {
  const missing = ['id', 'tenantId', 'racetrackId', 'targetArtifactId', 'targetArtifactType', 'authorId', 'createdAt', 'updatedAt']
    .filter((field) => !value[field as keyof CollaborationContext]);
  const validRefs = hasStrings(value.auditRefs) && hasStrings(value.eventRefs) && hasStrings(value.evidenceRefs);
  return {
    valid: missing.length === 0 && validRefs && Boolean(value.retentionPolicy?.policyId),
    missing,
    validRefs,
    attachedToArtifact: Boolean(value.targetArtifactId && value.targetArtifactType),
    tenantScoped: Boolean(value.tenantId && value.racetrackId),
  };
}

export function createCollaborationEvent(type: CollaborationEventType, context: CollaborationContext, occurredAt = context.updatedAt): CollaborationEvent {
  return {
    schemaVersion: trackMindCollaborationSchemaVersion,
    eventType: type,
    eventId: `collab-event:${context.id}:${type}`,
    occurredAt,
    tenantId: context.tenantId,
    racetrackId: context.racetrackId,
    actorId: context.authorId,
    targetArtifactId: context.targetArtifactId,
    targetArtifactType: context.targetArtifactType,
    collaborationObjectId: context.id,
    auditRefs: context.auditRefs,
    eventRefs: context.eventRefs,
    workflowId: context.workflowId,
    approvalId: context.approvalId,
    digitalTwinRef: context.digitalTwinRef,
  };
}
