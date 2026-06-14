import type {
  ArtifactAuditRef,
  ArtifactDigitalTwinRef,
  ArtifactEvidenceRef,
  ArtifactJsonValue,
  UniversalArtifactType,
} from './universalArtifactFramework.js';

export const collaborationSchemaVersion = 'trackmind.collaboration.v1' as const;

export const collaborationObjectTypes = [
  'comment-thread',
  'comment',
  'mention',
  'assignment',
  'decision-record',
  'handoff',
  'evidence-packet',
  'incident-room',
  'approval-discussion',
  'steward-case-discussion',
  'maintenance-discussion',
  'ai-recommendation-discussion',
  'compliance-review-discussion',
] as const;

export type CollaborationObjectType = typeof collaborationObjectTypes[number];
export type CollaborationVisibility = 'tenant' | 'racetrack' | 'participants' | 'private' | 'regulator' | 'public';
export type CollaborationStatus =
  | 'draft'
  | 'open'
  | 'active'
  | 'pending'
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'recorded'
  | 'resolved'
  | 'closed'
  | 'archived';
export type CollaborationActorType = 'human' | 'role' | 'service' | 'ai-agent' | 'regulator' | 'system';
export type CollaborationRetentionDisposition = 'retain' | 'eligible-for-disposal' | 'legal-hold';
export type CollaborationFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface CollaborationValidationRule {
  path: string;
  required?: boolean;
  type?: CollaborationFieldType;
  values?: readonly (string | number | boolean)[];
  min?: number;
  max?: number;
}

export interface CollaborationValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CollaborationParticipant {
  actorId: string;
  actorType: CollaborationActorType;
  tenantId: string;
  racetrackId?: string;
  roles?: string[];
  displayName?: string;
}

export interface CollaborationPermissions {
  canRead: string[];
  canComment: string[];
  canMention: string[];
  canAssign: string[];
  canResolve: string[];
  canArchive: string[];
  canAttachEvidence: string[];
  externalShareAllowed: boolean;
  aiAccessAllowed?: boolean;
}

export interface CollaborationAuditRef extends ArtifactAuditRef {
  tenantId?: string;
  racetrackId?: string;
}

export interface CollaborationEventRef {
  eventId: string;
  eventType: string;
  occurredAt?: string;
  tenantId?: string;
  racetrackId?: string;
}

export interface CollaborationAttachmentRef {
  id: string;
  kind: 'artifact' | 'evidence' | 'document' | 'image' | 'video' | 'telemetry' | 'audit' | 'approval' | 'workflow' | 'external';
  artifactId?: string;
  artifactType?: UniversalArtifactType | string;
  evidenceId?: string;
  uri?: string;
  hash?: string;
  tenantId?: string;
  racetrackId?: string;
  attachedAt?: string;
  attachedBy?: string;
  metadata?: Record<string, ArtifactJsonValue>;
}

export interface CollaborationEvidenceRef extends ArtifactEvidenceRef {
  tenantId?: string;
  racetrackId?: string;
}

export interface CollaborationRetentionPolicy {
  policyId: string;
  retainUntil: string;
  disposition: CollaborationRetentionDisposition;
  legalHold: boolean;
  regulatoryBasis: string[];
}

export interface CollaborationObjectBase<TType extends CollaborationObjectType = CollaborationObjectType, TStatus extends string = CollaborationStatus> {
  schemaVersion: typeof collaborationSchemaVersion;
  objectType: TType;
  id: string;
  tenantId: string;
  racetrackId: string;
  targetArtifactId: string;
  targetArtifactType: UniversalArtifactType | string;
  authorId: string;
  participants: CollaborationParticipant[];
  createdAt: string;
  updatedAt: string;
  status: TStatus;
  visibility: CollaborationVisibility;
  permissions: CollaborationPermissions;
  auditRefs: CollaborationAuditRef[];
  eventRefs: CollaborationEventRef[];
  attachments: CollaborationAttachmentRef[];
  evidenceRefs: CollaborationEvidenceRef[];
  retention: CollaborationRetentionPolicy;
  workflowId?: string;
  approvalId?: string;
  digitalTwinRef?: string | ArtifactDigitalTwinRef;
  correlationId?: string;
  metadata?: Record<string, ArtifactJsonValue>;
}

export interface CommentThread extends CollaborationObjectBase<'comment-thread'> {
  title: string;
  comments: Comment[];
  mentionIds: string[];
  assignmentIds: string[];
  decisionRecordIds: string[];
}

export interface Comment extends CollaborationObjectBase<'comment'> {
  threadId: string;
  body: string;
  parentCommentId?: string;
  mentions: Mention[];
  editedAt?: string;
}

export interface Mention extends CollaborationObjectBase<'mention', 'open' | 'resolved' | 'archived'> {
  mentionedActorId: string;
  threadId?: string;
  commentId?: string;
  resolvedAt?: string;
  context?: string;
}

export interface Assignment extends CollaborationObjectBase<'assignment', 'open' | 'accepted' | 'declined' | 'resolved' | 'archived'> {
  assigneeId: string;
  assignedBy: string;
  assignmentType: 'review' | 'approval' | 'evidence' | 'handoff' | 'maintenance' | 'compliance' | 'incident-response' | 'follow-up';
  description: string;
  dueAt?: string;
  completedAt?: string;
}

export interface DecisionRecord extends CollaborationObjectBase<'decision-record', 'recorded' | 'archived'> {
  decision: string;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  outcome: 'approved' | 'rejected' | 'deferred' | 'escalated' | 'superseded' | 'informational';
}

export interface Handoff extends CollaborationObjectBase<'handoff', 'requested' | 'accepted' | 'declined' | 'archived'> {
  fromActorId: string;
  toActorId: string;
  reason: string;
  requestedAt: string;
  acceptedAt?: string;
  checklist: Array<{ id: string; label: string; completed: boolean; evidenceRefs: string[] }>;
}

export interface EvidencePacket extends CollaborationObjectBase<'evidence-packet', 'draft' | 'open' | 'closed' | 'archived'> {
  title: string;
  summary: string;
  packetHash: string;
  sealed: boolean;
  sealedAt?: string;
  custodyAuditRefs: string[];
}

export interface IncidentRoom extends CollaborationObjectBase<'incident-room', 'open' | 'active' | 'resolved' | 'closed' | 'archived'> {
  incidentId: string;
  severity: 'info' | 'warning' | 'critical';
  openedAt: string;
  commanderId: string;
  roomMode: 'triage' | 'active-response' | 'post-incident-review';
}

export interface ApprovalDiscussion extends CollaborationObjectBase<'approval-discussion', 'open' | 'pending' | 'resolved' | 'archived'> {
  approvalId: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'expired' | 'escalated';
  protectedAction: string;
  decisionRefs: string[];
}

export interface StewardCaseDiscussion extends CollaborationObjectBase<'steward-case-discussion', 'open' | 'active' | 'resolved' | 'closed' | 'archived'> {
  caseId: string;
  inquiryId?: string;
  stewardPanelIds: string[];
  ruleRefs: string[];
}

export interface MaintenanceDiscussion extends CollaborationObjectBase<'maintenance-discussion', 'open' | 'active' | 'resolved' | 'closed' | 'archived'> {
  maintenanceWorkOrderId: string;
  assetIds: string[];
  maintenanceType: 'surface' | 'facility' | 'gate' | 'barn' | 'sensor' | 'safety-system' | 'other';
}

export interface AIRecommendationDiscussion extends CollaborationObjectBase<'ai-recommendation-discussion', 'open' | 'pending' | 'resolved' | 'archived'> {
  recommendationId: string;
  modelLineageRefs: string[];
  advisoryOnly: true;
  requiresApproval: boolean;
}

export interface ComplianceReviewDiscussion extends CollaborationObjectBase<'compliance-review-discussion', 'open' | 'active' | 'resolved' | 'closed' | 'archived'> {
  reviewId: string;
  frameworkIds: string[];
  controlIds: string[];
  filingId?: string;
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

export type CommentThreadDto = CommentThread;
export type CommentDto = Comment;
export type MentionDto = Mention;
export type AssignmentDto = Assignment;
export type DecisionRecordDto = DecisionRecord;
export type HandoffDto = Handoff;
export type EvidencePacketDto = EvidencePacket;
export type IncidentRoomDto = IncidentRoom;
export type ApprovalDiscussionDto = ApprovalDiscussion;
export type StewardCaseDiscussionDto = StewardCaseDiscussion;
export type MaintenanceDiscussionDto = MaintenanceDiscussion;
export type AIRecommendationDiscussionDto = AIRecommendationDiscussion;
export type ComplianceReviewDiscussionDto = ComplianceReviewDiscussion;
export type CollaborationObjectDto = CollaborationObject;

export const collaborationEventNames = {
  CommentAdded: 'collaboration.comment.added.v1',
  MentionCreated: 'collaboration.mention.created.v1',
  AssignmentCreated: 'collaboration.assignment.created.v1',
  DecisionRecorded: 'collaboration.decision.recorded.v1',
  HandoffRequested: 'collaboration.handoff.requested.v1',
  EvidencePacketCreated: 'collaboration.evidence-packet.created.v1',
  IncidentRoomOpened: 'collaboration.incident-room.opened.v1',
  ApprovalDiscussionUpdated: 'collaboration.approval-discussion.updated.v1',
  CollaborationArchived: 'collaboration.archived.v1',
} as const;

export type CollaborationEventType = keyof typeof collaborationEventNames;
export type CollaborationEventName = typeof collaborationEventNames[CollaborationEventType];
export type CollaborationEventNameFor<TType extends CollaborationEventType> = typeof collaborationEventNames[TType];

export interface CollaborationEventPayload {
  objectId: string;
  objectType: CollaborationObjectType;
  targetArtifactId: string;
  targetArtifactType: UniversalArtifactType | string;
  authorId: string;
  threadId?: string;
  commentId?: string;
  mentionId?: string;
  assignmentId?: string;
  decisionRecordId?: string;
  handoffId?: string;
  evidencePacketId?: string;
  incidentRoomId?: string;
  approvalDiscussionId?: string;
  archivedAt?: string;
  summary?: string;
  snapshot?: CollaborationObject;
}

export interface CollaborationEvent<TType extends CollaborationEventType = CollaborationEventType> {
  schemaVersion: typeof collaborationSchemaVersion;
  eventId: string;
  eventType: TType;
  eventName: CollaborationEventNameFor<TType>;
  tenantId: string;
  racetrackId: string;
  occurredAt: string;
  actorId: string;
  targetArtifactId: string;
  targetArtifactType: UniversalArtifactType | string;
  collaborationObjectId: string;
  collaborationObjectType: CollaborationObjectType;
  payload: CollaborationEventPayload;
  auditRefs: CollaborationAuditRef[];
  eventRefs: CollaborationEventRef[];
  evidenceRefs: CollaborationEvidenceRef[];
  correlationId: string;
  causationId?: string;
  workflowId?: string;
  approvalId?: string;
  digitalTwinRef?: string | ArtifactDigitalTwinRef;
}

export type CommentAdded = CollaborationEvent<'CommentAdded'>;
export type MentionCreated = CollaborationEvent<'MentionCreated'>;
export type AssignmentCreated = CollaborationEvent<'AssignmentCreated'>;
export type DecisionRecorded = CollaborationEvent<'DecisionRecorded'>;
export type HandoffRequested = CollaborationEvent<'HandoffRequested'>;
export type EvidencePacketCreated = CollaborationEvent<'EvidencePacketCreated'>;
export type IncidentRoomOpened = CollaborationEvent<'IncidentRoomOpened'>;
export type ApprovalDiscussionUpdated = CollaborationEvent<'ApprovalDiscussionUpdated'>;
export type CollaborationArchived = CollaborationEvent<'CollaborationArchived'>;

export interface CollaborationEventContract<TType extends CollaborationEventType = CollaborationEventType> {
  eventType: TType;
  eventName: CollaborationEventNameFor<TType>;
  version: 1;
  description: string;
  tenantScoped: true;
  racetrackScoped: true;
  audited: true;
  replayable: true;
  payloadFields: readonly (keyof CollaborationEventPayload)[];
  requiredMetadata: readonly string[];
}

const baseRequiredFields = [
  'schemaVersion',
  'objectType',
  'id',
  'tenantId',
  'racetrackId',
  'targetArtifactId',
  'targetArtifactType',
  'authorId',
  'participants',
  'createdAt',
  'updatedAt',
  'status',
  'visibility',
  'permissions',
  'auditRefs',
  'eventRefs',
  'attachments',
  'evidenceRefs',
  'retention',
] as const;

const baseRules: readonly CollaborationValidationRule[] = [
  { path: 'schemaVersion', required: true, type: 'string', values: [collaborationSchemaVersion] },
  { path: 'objectType', required: true, type: 'string' },
  { path: 'id', required: true, type: 'string' },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'racetrackId', required: true, type: 'string' },
  { path: 'targetArtifactId', required: true, type: 'string' },
  { path: 'targetArtifactType', required: true, type: 'string' },
  { path: 'authorId', required: true, type: 'string' },
  { path: 'participants', required: true, type: 'array' },
  { path: 'createdAt', required: true, type: 'string' },
  { path: 'updatedAt', required: true, type: 'string' },
  { path: 'status', required: true, type: 'string' },
  { path: 'visibility', required: true, type: 'string', values: ['tenant', 'racetrack', 'participants', 'private', 'regulator', 'public'] },
  { path: 'permissions', required: true, type: 'object' },
  { path: 'permissions.canRead', required: true, type: 'array' },
  { path: 'permissions.canComment', required: true, type: 'array' },
  { path: 'permissions.canMention', required: true, type: 'array' },
  { path: 'permissions.canAssign', required: true, type: 'array' },
  { path: 'permissions.canResolve', required: true, type: 'array' },
  { path: 'permissions.canArchive', required: true, type: 'array' },
  { path: 'permissions.canAttachEvidence', required: true, type: 'array' },
  { path: 'permissions.externalShareAllowed', required: true, type: 'boolean' },
  { path: 'permissions.aiAccessAllowed', type: 'boolean' },
  { path: 'auditRefs', required: true, type: 'array' },
  { path: 'eventRefs', required: true, type: 'array' },
  { path: 'attachments', required: true, type: 'array' },
  { path: 'evidenceRefs', required: true, type: 'array' },
  { path: 'retention', required: true, type: 'object' },
  { path: 'retention.policyId', required: true, type: 'string' },
  { path: 'retention.retainUntil', required: true, type: 'string' },
  { path: 'retention.disposition', required: true, type: 'string', values: ['retain', 'eligible-for-disposal', 'legal-hold'] },
  { path: 'retention.legalHold', required: true, type: 'boolean' },
  { path: 'retention.regulatoryBasis', required: true, type: 'array' },
  { path: 'workflowId', type: 'string' },
  { path: 'approvalId', type: 'string' },
  { path: 'correlationId', type: 'string' },
  { path: 'metadata', type: 'object' },
];

const schema = (
  objectType: CollaborationObjectType,
  requiredFields: readonly string[],
  rules: readonly CollaborationValidationRule[],
): readonly CollaborationValidationRule[] => [
  ...baseRules,
  { path: 'objectType', required: true, type: 'string', values: [objectType] },
  ...requiredFields.map((field) => ({ path: field, required: true } satisfies CollaborationValidationRule)),
  ...rules,
];

export const collaborationObjectSchemas = {
  'comment-thread': schema('comment-thread', ['title', 'comments', 'mentionIds', 'assignmentIds', 'decisionRecordIds'], [
    { path: 'title', required: true, type: 'string' },
    { path: 'comments', required: true, type: 'array' },
    { path: 'mentionIds', required: true, type: 'array' },
    { path: 'assignmentIds', required: true, type: 'array' },
    { path: 'decisionRecordIds', required: true, type: 'array' },
  ]),
  comment: schema('comment', ['threadId', 'body', 'mentions'], [
    { path: 'threadId', required: true, type: 'string' },
    { path: 'body', required: true, type: 'string' },
    { path: 'mentions', required: true, type: 'array' },
    { path: 'parentCommentId', type: 'string' },
    { path: 'editedAt', type: 'string' },
  ]),
  mention: schema('mention', ['mentionedActorId'], [
    { path: 'mentionedActorId', required: true, type: 'string' },
    { path: 'threadId', type: 'string' },
    { path: 'commentId', type: 'string' },
    { path: 'resolvedAt', type: 'string' },
    { path: 'context', type: 'string' },
  ]),
  assignment: schema('assignment', ['assigneeId', 'assignedBy', 'assignmentType', 'description'], [
    { path: 'assigneeId', required: true, type: 'string' },
    { path: 'assignedBy', required: true, type: 'string' },
    { path: 'assignmentType', required: true, type: 'string', values: ['review', 'approval', 'evidence', 'handoff', 'maintenance', 'compliance', 'incident-response', 'follow-up'] },
    { path: 'description', required: true, type: 'string' },
    { path: 'dueAt', type: 'string' },
    { path: 'completedAt', type: 'string' },
  ]),
  'decision-record': schema('decision-record', ['decision', 'rationale', 'decidedBy', 'decidedAt', 'outcome'], [
    { path: 'decision', required: true, type: 'string' },
    { path: 'rationale', required: true, type: 'string' },
    { path: 'decidedBy', required: true, type: 'string' },
    { path: 'decidedAt', required: true, type: 'string' },
    { path: 'outcome', required: true, type: 'string', values: ['approved', 'rejected', 'deferred', 'escalated', 'superseded', 'informational'] },
  ]),
  handoff: schema('handoff', ['fromActorId', 'toActorId', 'reason', 'requestedAt', 'checklist'], [
    { path: 'fromActorId', required: true, type: 'string' },
    { path: 'toActorId', required: true, type: 'string' },
    { path: 'reason', required: true, type: 'string' },
    { path: 'requestedAt', required: true, type: 'string' },
    { path: 'acceptedAt', type: 'string' },
    { path: 'checklist', required: true, type: 'array' },
  ]),
  'evidence-packet': schema('evidence-packet', ['title', 'summary', 'packetHash', 'sealed', 'custodyAuditRefs'], [
    { path: 'title', required: true, type: 'string' },
    { path: 'summary', required: true, type: 'string' },
    { path: 'packetHash', required: true, type: 'string' },
    { path: 'sealed', required: true, type: 'boolean' },
    { path: 'sealedAt', type: 'string' },
    { path: 'custodyAuditRefs', required: true, type: 'array' },
  ]),
  'incident-room': schema('incident-room', ['incidentId', 'severity', 'openedAt', 'commanderId', 'roomMode', 'workflowId'], [
    { path: 'incidentId', required: true, type: 'string' },
    { path: 'severity', required: true, type: 'string', values: ['info', 'warning', 'critical'] },
    { path: 'openedAt', required: true, type: 'string' },
    { path: 'commanderId', required: true, type: 'string' },
    { path: 'roomMode', required: true, type: 'string', values: ['triage', 'active-response', 'post-incident-review'] },
    { path: 'workflowId', required: true, type: 'string' },
  ]),
  'approval-discussion': schema('approval-discussion', ['approvalId', 'approvalStatus', 'protectedAction', 'decisionRefs'], [
    { path: 'approvalId', required: true, type: 'string' },
    { path: 'approvalStatus', required: true, type: 'string', values: ['pending', 'approved', 'rejected', 'expired', 'escalated'] },
    { path: 'protectedAction', required: true, type: 'string' },
    { path: 'decisionRefs', required: true, type: 'array' },
  ]),
  'steward-case-discussion': schema('steward-case-discussion', ['caseId', 'stewardPanelIds', 'ruleRefs'], [
    { path: 'caseId', required: true, type: 'string' },
    { path: 'inquiryId', type: 'string' },
    { path: 'stewardPanelIds', required: true, type: 'array' },
    { path: 'ruleRefs', required: true, type: 'array' },
  ]),
  'maintenance-discussion': schema('maintenance-discussion', ['maintenanceWorkOrderId', 'assetIds', 'maintenanceType', 'workflowId'], [
    { path: 'maintenanceWorkOrderId', required: true, type: 'string' },
    { path: 'assetIds', required: true, type: 'array' },
    { path: 'maintenanceType', required: true, type: 'string', values: ['surface', 'facility', 'gate', 'barn', 'sensor', 'safety-system', 'other'] },
    { path: 'workflowId', required: true, type: 'string' },
  ]),
  'ai-recommendation-discussion': schema('ai-recommendation-discussion', ['recommendationId', 'modelLineageRefs', 'advisoryOnly', 'requiresApproval'], [
    { path: 'recommendationId', required: true, type: 'string' },
    { path: 'modelLineageRefs', required: true, type: 'array' },
    { path: 'advisoryOnly', required: true, type: 'boolean', values: [true] },
    { path: 'requiresApproval', required: true, type: 'boolean' },
  ]),
  'compliance-review-discussion': schema('compliance-review-discussion', ['reviewId', 'frameworkIds', 'controlIds', 'workflowId'], [
    { path: 'reviewId', required: true, type: 'string' },
    { path: 'frameworkIds', required: true, type: 'array' },
    { path: 'controlIds', required: true, type: 'array' },
    { path: 'filingId', type: 'string' },
    { path: 'workflowId', required: true, type: 'string' },
  ]),
} as const satisfies Record<CollaborationObjectType, readonly CollaborationValidationRule[]>;

const eventBasePayloadFields = ['objectId', 'objectType', 'targetArtifactId', 'targetArtifactType', 'authorId'] as const;

const eventContract = <TType extends CollaborationEventType>(
  eventType: TType,
  description: string,
  payloadFields: readonly (keyof CollaborationEventPayload)[],
): CollaborationEventContract<TType> => ({
  eventType,
  eventName: collaborationEventNames[eventType],
  version: 1,
  description,
  tenantScoped: true,
  racetrackScoped: true,
  audited: true,
  replayable: true,
  payloadFields: [...eventBasePayloadFields, ...payloadFields],
  requiredMetadata: ['tenantId', 'racetrackId', 'correlationId', 'auditRefs', 'targetArtifactId', 'targetArtifactType'],
});

export const collaborationEventContracts = [
  eventContract('CommentAdded', 'A comment was added to an artifact-bound collaboration thread.', ['threadId', 'commentId']),
  eventContract('MentionCreated', 'A participant was mentioned from an artifact-bound collaboration object.', ['threadId', 'commentId', 'mentionId']),
  eventContract('AssignmentCreated', 'A collaboration assignment was created for an artifact target.', ['assignmentId']),
  eventContract('DecisionRecorded', 'A decision record was captured with audit and evidence context.', ['decisionRecordId']),
  eventContract('HandoffRequested', 'A handoff was requested between accountable participants.', ['handoffId']),
  eventContract('EvidencePacketCreated', 'An evidence packet was created and linked to its target artifact.', ['evidencePacketId']),
  eventContract('IncidentRoomOpened', 'An incident room was opened for coordinated response.', ['incidentRoomId']),
  eventContract('ApprovalDiscussionUpdated', 'An approval discussion changed in the collaboration workspace.', ['approvalDiscussionId']),
  eventContract('CollaborationArchived', 'A collaboration object was archived with retained lineage.', ['archivedAt']),
] as const satisfies readonly CollaborationEventContract[];

const objectTypeSet = new Set<string>(collaborationObjectTypes);
const eventTypeSet = new Set<string>(Object.keys(collaborationEventNames));
const collaborationEventNameSet = new Set<string>(Object.values(collaborationEventNames));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function get(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, value);
}

function matchesType(value: unknown, type: CollaborationFieldType): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function validateRules(name: string, value: unknown, rules: readonly CollaborationValidationRule[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const field = get(value, rule.path);
    if (rule.required && (field === undefined || field === null || field === '')) errors.push(`${name}.${rule.path} is required`);
    if (field !== undefined && rule.type && !matchesType(field, rule.type)) errors.push(`${name}.${rule.path} must be ${rule.type}`);
    if (rule.values && field !== undefined && !rule.values.includes(field as string | number | boolean)) errors.push(`${name}.${rule.path} must be one of ${rule.values.join(',')}`);
    if (typeof field === 'number' && rule.min !== undefined && field < rule.min) errors.push(`${name}.${rule.path} must be >= ${rule.min}`);
    if (typeof field === 'number' && rule.max !== undefined && field > rule.max) errors.push(`${name}.${rule.path} must be <= ${rule.max}`);
  }
  return errors;
}

function objectTypeFrom(value: unknown): CollaborationObjectType | null {
  return typeof value === 'string' && objectTypeSet.has(value) ? value as CollaborationObjectType : null;
}

function eventTypeFrom(value: unknown): CollaborationEventType | null {
  return typeof value === 'string' && eventTypeSet.has(value) ? value as CollaborationEventType : null;
}

function validateStringArray(name: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${name} must be array`];
  return value.flatMap((item, index) => typeof item === 'string' ? [] : [`${name}[${index}] must be string`]);
}

function validateParticipants(value: CollaborationObjectBase): string[] {
  const errors: string[] = [];
  if (!Array.isArray(value.participants) || value.participants.length === 0) {
    errors.push('CollaborationObject.participants must include at least one participant');
    return errors;
  }

  let authorFound = false;
  value.participants.forEach((participant, index) => {
    if (!isRecord(participant)) {
      errors.push(`CollaborationObject.participants[${index}] must be object`);
      return;
    }
    if (typeof participant.actorId !== 'string' || participant.actorId === '') errors.push(`CollaborationObject.participants[${index}].actorId is required`);
    const actorType = participant.actorType as unknown;
    if (typeof actorType !== 'string' || actorType === '') errors.push(`CollaborationObject.participants[${index}].actorType is required`);
    if (participant.actorId === value.authorId) authorFound = true;
    if (participant.tenantId !== value.tenantId) errors.push(`CollaborationObject.participants[${index}].tenantId must match collaboration tenantId`);
    if (participant.racetrackId !== undefined && participant.racetrackId !== value.racetrackId) errors.push(`CollaborationObject.participants[${index}].racetrackId must match collaboration racetrackId`);
  });
  if (!authorFound) errors.push('CollaborationObject.authorId must be included in participants');
  return errors;
}

function validateScopedRefs(name: string, refs: unknown, tenantId: string, racetrackId: string): string[] {
  if (!Array.isArray(refs)) return [];
  return refs.flatMap((ref, index) => {
    if (!isRecord(ref)) return [`${name}[${index}] must be object`];
    const errors: string[] = [];
    if (ref.tenantId !== undefined && ref.tenantId !== tenantId) errors.push(`${name}[${index}].tenantId must match collaboration tenantId`);
    if (ref.racetrackId !== undefined && ref.racetrackId !== racetrackId) errors.push(`${name}[${index}].racetrackId must match collaboration racetrackId`);
    return errors;
  });
}

function validateRefShapes(value: CollaborationObjectBase): string[] {
  const errors: string[] = [];
  value.auditRefs?.forEach((ref, index) => {
    if (!ref.auditId) errors.push(`CollaborationObject.auditRefs[${index}].auditId is required`);
  });
  value.eventRefs?.forEach((ref, index) => {
    if (!ref.eventId) errors.push(`CollaborationObject.eventRefs[${index}].eventId is required`);
    if (!ref.eventType) errors.push(`CollaborationObject.eventRefs[${index}].eventType is required`);
  });
  value.evidenceRefs?.forEach((ref, index) => {
    if (!ref.evidenceId) errors.push(`CollaborationObject.evidenceRefs[${index}].evidenceId is required`);
  });
  value.attachments?.forEach((ref, index) => {
    if (!ref.id) errors.push(`CollaborationObject.attachments[${index}].id is required`);
    if (!ref.kind) errors.push(`CollaborationObject.attachments[${index}].kind is required`);
    if (!ref.artifactId && !ref.evidenceId && !ref.uri) errors.push(`CollaborationObject.attachments[${index}] must reference an artifactId, evidenceId, or uri`);
  });
  return errors;
}

function validateNestedThreadObjects(thread: CommentThread): string[] {
  return thread.comments.flatMap((comment, index) => {
    const errors = validateCollaborationObject(comment).errors.map((error) => `CollaborationObject.comments[${index}] ${error}`);
    if (comment.tenantId !== thread.tenantId) errors.push(`CollaborationObject.comments[${index}].tenantId must match thread tenantId`);
    if (comment.racetrackId !== thread.racetrackId) errors.push(`CollaborationObject.comments[${index}].racetrackId must match thread racetrackId`);
    if (comment.targetArtifactId !== thread.targetArtifactId) errors.push(`CollaborationObject.comments[${index}].targetArtifactId must match thread targetArtifactId`);
    if (comment.targetArtifactType !== thread.targetArtifactType) errors.push(`CollaborationObject.comments[${index}].targetArtifactType must match thread targetArtifactType`);
    return errors;
  });
}

function validateTypeSpecificObject(value: CollaborationObjectBase, objectType: CollaborationObjectType): string[] {
  const errors: string[] = [];
  if (objectType === 'mention' && !(isNonEmptyString((value as Mention).threadId) || isNonEmptyString((value as Mention).commentId))) errors.push('CollaborationObject.mention requires threadId or commentId');
  if (objectType === 'evidence-packet' && (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length === 0)) errors.push('CollaborationObject.evidence-packet requires at least one evidenceRef');
  if (objectType === 'maintenance-discussion' && !value.digitalTwinRef) errors.push('CollaborationObject.maintenance-discussion requires digitalTwinRef');
  if (objectType === 'ai-recommendation-discussion' && (value as AIRecommendationDiscussion).requiresApproval && !value.approvalId) errors.push('CollaborationObject.ai-recommendation-discussion requires approvalId when requiresApproval is true');
  if (objectType === 'comment-thread') errors.push(...validateNestedThreadObjects(value as CommentThread));
  return errors;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function validateCollaborationObject(value: unknown): CollaborationValidationResult {
  if (!isRecord(value)) return { valid: false, errors: ['CollaborationObject must be object'] };
  const objectType = objectTypeFrom(value.objectType);
  if (!objectType) return { valid: false, errors: [`CollaborationObject.objectType must be one of ${collaborationObjectTypes.join(',')}`] };

  const errors = validateRules('CollaborationObject', value, collaborationObjectSchemas[objectType]);
  const object = value as unknown as CollaborationObjectBase;
  if (!object.targetArtifactId || !object.targetArtifactType) errors.push('CollaborationObject must be attached to a target artifact');
  errors.push(...validateParticipants(object));
  errors.push(...validateScopedRefs('CollaborationObject.auditRefs', object.auditRefs, object.tenantId, object.racetrackId));
  errors.push(...validateScopedRefs('CollaborationObject.eventRefs', object.eventRefs, object.tenantId, object.racetrackId));
  errors.push(...validateScopedRefs('CollaborationObject.evidenceRefs', object.evidenceRefs, object.tenantId, object.racetrackId));
  errors.push(...validateScopedRefs('CollaborationObject.attachments', object.attachments, object.tenantId, object.racetrackId));
  errors.push(...validateRefShapes(object));
  errors.push(...validateStringArray('CollaborationObject.retention.regulatoryBasis', get(value, 'retention.regulatoryBasis')));
  errors.push(...validateTypeSpecificObject(object, objectType));
  if (!isCollaborationJsonSerializable(value)) errors.push('CollaborationObject must be JSON-serializable');
  return { valid: errors.length === 0, errors };
}

export function validateCollaborationObjectSet(objects: readonly CollaborationObject[]): CollaborationValidationResult {
  const errors = objects.flatMap((object) => validateCollaborationObject(object).errors.map((error) => `${object.objectType}:${object.id} ${error}`));
  const keys = new Set<string>();
  for (const object of objects) {
    const key = `${object.tenantId}:${object.racetrackId}:${object.objectType}:${object.id}`;
    if (keys.has(key)) errors.push(`${object.objectType}:${object.id} duplicate collaboration id in tenant/racetrack scope`);
    keys.add(key);
  }
  return { valid: errors.length === 0, errors };
}

export function validateCollaborationEvent(value: unknown): CollaborationValidationResult {
  if (!isRecord(value)) return { valid: false, errors: ['CollaborationEvent must be object'] };
  const errors = validateRules('CollaborationEvent', value, [
    { path: 'schemaVersion', required: true, type: 'string', values: [collaborationSchemaVersion] },
    { path: 'eventId', required: true, type: 'string' },
    { path: 'eventType', required: true, type: 'string' },
    { path: 'eventName', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'occurredAt', required: true, type: 'string' },
    { path: 'actorId', required: true, type: 'string' },
    { path: 'targetArtifactId', required: true, type: 'string' },
    { path: 'targetArtifactType', required: true, type: 'string' },
    { path: 'collaborationObjectId', required: true, type: 'string' },
    { path: 'collaborationObjectType', required: true, type: 'string' },
    { path: 'payload', required: true, type: 'object' },
    { path: 'payload.objectId', required: true, type: 'string' },
    { path: 'payload.objectType', required: true, type: 'string' },
    { path: 'payload.targetArtifactId', required: true, type: 'string' },
    { path: 'payload.targetArtifactType', required: true, type: 'string' },
    { path: 'payload.authorId', required: true, type: 'string' },
    { path: 'auditRefs', required: true, type: 'array' },
    { path: 'eventRefs', required: true, type: 'array' },
    { path: 'evidenceRefs', required: true, type: 'array' },
    { path: 'correlationId', required: true, type: 'string' },
  ]);
  const eventType = eventTypeFrom(value.eventType);
  if (!eventType) errors.push(`CollaborationEvent.eventType must be one of ${Object.keys(collaborationEventNames).join(',')}`);
  if (typeof value.eventName === 'string' && !collaborationEventNameSet.has(value.eventName)) errors.push(`CollaborationEvent.eventName must be one of ${Object.values(collaborationEventNames).join(',')}`);
  if (eventType && value.eventName !== collaborationEventNames[eventType]) errors.push(`CollaborationEvent.eventName must be ${collaborationEventNames[eventType]} for ${eventType}`);
  const objectType = objectTypeFrom(value.collaborationObjectType);
  if (!objectType) errors.push(`CollaborationEvent.collaborationObjectType must be one of ${collaborationObjectTypes.join(',')}`);

  const payload = isRecord(value.payload) ? value.payload : {};
  if (payload.objectId !== value.collaborationObjectId) errors.push('CollaborationEvent.payload.objectId must match collaborationObjectId');
  if (payload.objectType !== value.collaborationObjectType) errors.push('CollaborationEvent.payload.objectType must match collaborationObjectType');
  if (payload.targetArtifactId !== value.targetArtifactId) errors.push('CollaborationEvent.payload.targetArtifactId must match targetArtifactId');
  if (payload.targetArtifactType !== value.targetArtifactType) errors.push('CollaborationEvent.payload.targetArtifactType must match targetArtifactType');

  const event = value as unknown as CollaborationEvent;
  errors.push(...validateScopedRefs('CollaborationEvent.auditRefs', event.auditRefs, event.tenantId, event.racetrackId));
  errors.push(...validateScopedRefs('CollaborationEvent.eventRefs', event.eventRefs, event.tenantId, event.racetrackId));
  errors.push(...validateScopedRefs('CollaborationEvent.evidenceRefs', event.evidenceRefs, event.tenantId, event.racetrackId));
  if (!isCollaborationJsonSerializable(value)) errors.push('CollaborationEvent must be JSON-serializable');
  return { valid: errors.length === 0, errors };
}

export function isCollaborationObject(value: unknown): value is CollaborationObject {
  return validateCollaborationObject(value).valid;
}

export function isCollaborationObjectOfType<TType extends CollaborationObjectType>(value: unknown, objectType: TType): value is Extract<CollaborationObject, { objectType: TType }> {
  return isCollaborationObject(value) && value.objectType === objectType;
}

export function isCommentThread(value: unknown): value is CommentThread { return isCollaborationObjectOfType(value, 'comment-thread'); }
export function isComment(value: unknown): value is Comment { return isCollaborationObjectOfType(value, 'comment'); }
export function isMention(value: unknown): value is Mention { return isCollaborationObjectOfType(value, 'mention'); }
export function isAssignment(value: unknown): value is Assignment { return isCollaborationObjectOfType(value, 'assignment'); }
export function isDecisionRecord(value: unknown): value is DecisionRecord { return isCollaborationObjectOfType(value, 'decision-record'); }
export function isHandoff(value: unknown): value is Handoff { return isCollaborationObjectOfType(value, 'handoff'); }
export function isEvidencePacket(value: unknown): value is EvidencePacket { return isCollaborationObjectOfType(value, 'evidence-packet'); }
export function isIncidentRoom(value: unknown): value is IncidentRoom { return isCollaborationObjectOfType(value, 'incident-room'); }
export function isApprovalDiscussion(value: unknown): value is ApprovalDiscussion { return isCollaborationObjectOfType(value, 'approval-discussion'); }
export function isStewardCaseDiscussion(value: unknown): value is StewardCaseDiscussion { return isCollaborationObjectOfType(value, 'steward-case-discussion'); }
export function isMaintenanceDiscussion(value: unknown): value is MaintenanceDiscussion { return isCollaborationObjectOfType(value, 'maintenance-discussion'); }
export function isAIRecommendationDiscussion(value: unknown): value is AIRecommendationDiscussion { return isCollaborationObjectOfType(value, 'ai-recommendation-discussion'); }
export function isComplianceReviewDiscussion(value: unknown): value is ComplianceReviewDiscussion { return isCollaborationObjectOfType(value, 'compliance-review-discussion'); }

export function isCollaborationEvent(value: unknown): value is CollaborationEvent {
  return validateCollaborationEvent(value).valid;
}

export function serializeCollaborationObject<TObject extends CollaborationObject>(object: TObject): string {
  const result = validateCollaborationObject(object);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return JSON.stringify(object);
}

export function deserializeCollaborationObject<TObject extends CollaborationObject = CollaborationObject>(payload: string): TObject {
  const object = JSON.parse(payload) as TObject;
  const result = validateCollaborationObject(object);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return object;
}

export function serializeCollaborationEvent<TEvent extends CollaborationEvent>(event: TEvent): string {
  const result = validateCollaborationEvent(event);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return JSON.stringify(event);
}

export function deserializeCollaborationEvent<TEvent extends CollaborationEvent = CollaborationEvent>(payload: string): TEvent {
  const event = JSON.parse(payload) as TEvent;
  const result = validateCollaborationEvent(event);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return event;
}

export function isCollaborationJsonSerializable(value: unknown): value is ArtifactJsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isCollaborationJsonSerializable);
  if (typeof value !== 'object' || !isPlainObject(value)) return false;
  return Object.values(value).every(isCollaborationJsonSerializable);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export const trackMindCollaborationSchemaVersion = collaborationSchemaVersion;
