import {
  collaborationEventNames,
  trackMindCollaborationSchemaVersion,
  validateCollaborationObject,
  type CollaborationEventType as CanonicalCollaborationEventType,
} from './collaborationContracts.js';

export { trackMindCollaborationSchemaVersion };

export const collaborationEventTypes = Object.keys(collaborationEventNames) as CanonicalCollaborationEventType[];
export type CollaborationEventType = CanonicalCollaborationEventType;

export interface CollaborationContext {
  id: string;
  tenantId: string;
  racetrackId: string;
  targetArtifactId: string;
  targetArtifactType: string;
  authorId: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  status: string;
  visibility: string;
  permissions: string[];
  auditRefs: string[];
  eventRefs: string[];
  evidenceRefs: string[];
  retentionPolicy: { policyId: string; retainForDays?: number; legalHold?: boolean; regulatoryBasis?: string };
  workflowId?: string;
  approvalId?: string;
  digitalTwinRef?: string;
}

export interface CollaborationEvent {
  schemaVersion: typeof trackMindCollaborationSchemaVersion;
  eventType: CollaborationEventType;
  eventName: string;
  eventId: string;
  occurredAt: string;
  tenantId: string;
  racetrackId: string;
  actorId: string;
  targetArtifactId: string;
  targetArtifactType: string;
  collaborationObjectId: string;
  auditRefs: string[];
  eventRefs: string[];
  workflowId?: string;
  approvalId?: string;
  digitalTwinRef?: string;
}

const hasStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

export function validateCollaborationContext(value: Partial<CollaborationContext>) {
  const canonicalProbe = {
    schemaVersion: trackMindCollaborationSchemaVersion,
    id: value.id,
    objectType: 'comment-thread',
    tenantId: value.tenantId,
    racetrackId: value.racetrackId,
    targetArtifactId: value.targetArtifactId,
    targetArtifactType: value.targetArtifactType,
    authorId: value.authorId,
    title: value.id ?? 'collaboration',
    status: value.status ?? 'open',
    visibility: value.visibility === 'team' ? 'participants' : value.visibility === 'regulator-package' ? 'regulator' : value.visibility ?? 'tenant',
    participants: (value.participants ?? []).map((actorId) => ({ actorId, actorType: 'human', tenantId: value.tenantId, racetrackId: value.racetrackId })),
    permissions: {
      canRead: value.permissions ?? [],
      canComment: value.permissions ?? [],
      canMention: value.permissions ?? [],
      canAssign: value.permissions ?? [],
      canResolve: value.permissions ?? [],
      canArchive: value.permissions ?? [],
      canAttachEvidence: value.permissions ?? [],
      externalShareAllowed: false,
    },
    auditRefs: (value.auditRefs ?? []).map((auditId) => ({ auditId })),
    eventRefs: (value.eventRefs ?? []).map((eventId) => ({ eventId, eventType: collaborationEventNames.CommentAdded })),
    attachments: [],
    evidenceRefs: (value.evidenceRefs ?? []).map((evidenceId) => ({ evidenceId })),
    retention: {
      policyId: value.retentionPolicy?.policyId ?? '',
      disposition: value.retentionPolicy?.legalHold ? 'legal-hold' : 'retain',
      retainUntil: value.updatedAt,
      legalHold: value.retentionPolicy?.legalHold ?? false,
      regulatoryBasis: value.retentionPolicy?.regulatoryBasis ? [value.retentionPolicy.regulatoryBasis] : [],
    },
    comments: [],
    mentionIds: [],
    assignmentIds: [],
    decisionRecordIds: [],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  const canonical = validateCollaborationObject(canonicalProbe);
  const missing = ['id', 'tenantId', 'racetrackId', 'targetArtifactId', 'targetArtifactType', 'authorId', 'createdAt', 'updatedAt']
    .filter((field) => !value[field as keyof CollaborationContext]);
  const validRefs = hasStrings(value.auditRefs) && hasStrings(value.eventRefs) && hasStrings(value.evidenceRefs);
  return {
    valid: missing.length === 0 && validRefs && Boolean(value.retentionPolicy?.policyId) && canonical.valid,
    missing,
    validRefs,
    attachedToArtifact: Boolean(value.targetArtifactId && value.targetArtifactType),
    tenantScoped: Boolean(value.tenantId && value.racetrackId),
    canonicalErrors: canonical.errors,
  };
}

export function createCollaborationEvent(type: CollaborationEventType, context: CollaborationContext, occurredAt = context.updatedAt): CollaborationEvent {
  return {
    schemaVersion: trackMindCollaborationSchemaVersion,
    eventType: type,
    eventName: collaborationEventNames[type],
    eventId: `collab-event:${context.id}:${type}`,
    occurredAt,
    tenantId: context.tenantId,
    racetrackId: context.racetrackId,
    actorId: context.authorId,
    targetArtifactId: context.targetArtifactId,
    targetArtifactType: context.targetArtifactType,
    collaborationObjectId: context.id,
    auditRefs: [...context.auditRefs],
    eventRefs: [...context.eventRefs],
    workflowId: context.workflowId,
    approvalId: context.approvalId,
    digitalTwinRef: context.digitalTwinRef,
  };
}
