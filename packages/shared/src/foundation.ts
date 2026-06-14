export type EntityId = string;
export type ISODateTime = string;
export type TenantId = string;

export interface DomainReference {
  id: EntityId;
  tenantId: TenantId;
  displayName?: string;
}

export interface Racetrack extends DomainReference { timezone: string; commissionName?: string; sectors: TrackSector[]; }
export interface Race extends DomainReference { racetrackId: EntityId; raceDayId: EntityId; raceNumber: number; status: 'scheduled' | 'loading' | 'ready' | 'running' | 'stopped' | 'official' | 'cancelled'; }
export interface Horse extends DomainReference { microchipId?: string; status: 'active' | 'scratched' | 'vet-flagged' | 'retired' | 'inactive'; }
export interface Jockey extends DomainReference { licenseNumber: string; }
export interface Steward extends DomainReference { licenseNumber: string; panelRole?: 'chair' | 'member' | 'alternate'; }
export interface Veterinarian extends DomainReference { licenseNumber: string; authorityScope: 'exam' | 'clearance' | 'regulatory'; }
export interface TrackSector extends DomainReference { racetrackId: EntityId; surface: 'dirt' | 'turf' | 'synthetic' | 'paddock' | 'barn' | 'restricted-zone'; safetyCritical: boolean; }
export interface StartingGate extends DomainReference { racetrackId: EntityId; sectorId: EntityId; stalls: number; controlId?: EntityId; }
export interface Sensor extends DomainReference { assetId: EntityId; sensorType: 'surface' | 'weather' | 'gate' | 'camera' | 'rfid' | 'position' | 'security'; unit?: string; }

export interface DigitalTwinReference extends DomainReference {
  twinId: `twin:${string}:${string}`;
  sourceSystem: string;
  sourceEntityType: string;
  sourceEntityId: EntityId;
}

export type NexusActorType = 'human' | 'ai-agent' | 'service' | 'system';
export type NexusOperationalActorType = NexusActorType | 'workflow' | 'api';

export interface NexusActor {
  id: EntityId;
  type: NexusActorType;
  roles?: string[];
}

export interface NexusSubjectReference {
  id: EntityId;
  type: string;
  tenantId: TenantId;
  displayName?: string;
}

export interface NexusEventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: EntityId;
  eventType: `${string}.${string}.${string}.v${number}`;
  tenantId: TenantId;
  occurredAt: ISODateTime;
  actor: NexusActor;
  correlationId: string;
  subject: NexusSubjectReference;
  payload: TPayload;
  evidence: string[];
}

export interface AuditEvent {
  id: EntityId;
  tenantId: TenantId;
  eventType: string;
  actorId: EntityId;
  actorType: NexusActorType;
  action: string;
  target: string | NexusSubjectReference;
  occurredAt: ISODateTime;
  correlationId: string;
  evidence: string[];
  decision?: 'allowed' | 'denied' | 'approved' | 'rejected' | 'blocked' | 'executed';
  sourceService?: string;
  previousHash?: string;
  hash?: string;
}

export interface ApprovalRequirement {
  protectedAction: ProtectedAIAutonomyAction;
  requiredRoles: string[];
  minimumApprovals: number;
  evidenceRequired: string[];
}

export interface ApprovalDecision {
  id: EntityId;
  tenantId: TenantId;
  recommendationId: EntityId;
  protectedAction: ProtectedAIAutonomyAction | NormalizedProtectedAction;
  target: string;
  status: 'pending-approval' | 'approved' | 'rejected' | 'expired';
  approverId?: EntityId;
  approverRoles: string[];
  reason?: string;
  evidence: string[];
  decidedAt?: ISODateTime;
  expiresAt?: ISODateTime;
}

export interface WorkflowInstance extends DomainReference {
  workflowType: 'race-start' | 'race-stop' | 'official-results' | 'horse-scratch' | 'vet-clearance' | 'steward-ruling' | 'payout' | 'emergency-control' | 'asset-maintenance';
  state: 'draft' | 'pending-approval' | 'approved' | 'rejected' | 'expired' | 'executed' | 'cancelled';
  subject: string;
  approvals: ApprovalDecision[];
}

export const aiAllowedActivities = ['recommend', 'simulate', 'summarize', 'classify', 'prioritize', 'forecast', 'create-draft-action', 'detect-anomaly', 'draft-work-order', 'create-recommendation', 'notify-humans', 'generate-report', 'update-dashboard'] as const;
export type AIAllowedActivity = typeof aiAllowedActivities[number];

export const protectedAIAutonomyActions = [
  'start-race',
  'stop-race',
  'declare-official-results',
  'modify-official-results',
  'scratch-horse',
  'make-medication-decision',
  'clear-veterinary-flag',
  'issue-steward-ruling',
  'issue-disciplinary-decision',
  'trigger-payout',
  'execute-gate-move',
  'close-track',
  'reopen-track',
  'declare-winner',
  'modify-result',
  'execute-emergency-action',
  'override-emergency-personnel',
  'execute-safety-critical-control',
  'approve-compliance-filing',
] as const;
export type ProtectedAIAutonomyAction = typeof protectedAIAutonomyActions[number];

export const protectedActionIntentMap = {
  'start-race': 'race-start',
  'stop-race': 'race-stop',
  'declare-official-results': 'official-results',
  'modify-official-results': 'modify-official-results',
  'scratch-horse': 'scratch-horse',
  'make-medication-decision': 'medication-decision',
  'clear-veterinary-flag': 'clear-vet-flag',
  'issue-steward-ruling': 'steward-ruling',
  'issue-disciplinary-decision': 'disciplinary-decision',
  'trigger-payout': 'payout',
  'execute-gate-move': 'starting-gate-move',
  'close-track': 'track-closure',
  'reopen-track': 'track-reopen',
  'declare-winner': 'official-results',
  'modify-result': 'modify-official-results',
  'execute-emergency-action': 'emergency-action',
  'override-emergency-personnel': 'emergency-personnel-override',
  'execute-safety-critical-control': 'safety-critical-control',
  'approve-compliance-filing': 'compliance-filing-approval',
} as const;
export type ProtectedActionIntent = keyof typeof protectedActionIntentMap;
export type NormalizedProtectedAction = typeof protectedActionIntentMap[ProtectedActionIntent];

export function normalizeProtectedActionIntent(action: string): ProtectedAIAutonomyAction | NormalizedProtectedAction | string {
  return (protectedActionIntentMap as Record<string, NormalizedProtectedAction>)[action] ?? action;
}

export function isProtectedActionIntent(action: string): action is ProtectedActionIntent {
  return action in protectedActionIntentMap;
}

export interface AIRecommendation {
  id: EntityId;
  tenantId: TenantId;
  activity: AIAllowedActivity;
  requestedAction?: ProtectedAIAutonomyAction | string;
  target: string;
  summary: string;
  confidence: number;
  evidence: string[];
  createdAt: ISODateTime;
  createdBy: EntityId;
  requiredApprovals: ApprovalRequirement[];
}

export interface SafetyValidationResult { allowed: boolean; reason: string; requiredApproval?: ApprovalRequirement; approvalId?: string; }

export function isProtectedAIAutonomyAction(action: string): action is ProtectedAIAutonomyAction {
  return (protectedAIAutonomyActions as readonly string[]).includes(action);
}

export function createApprovalRequirement(action: ProtectedAIAutonomyAction): ApprovalRequirement {
  const roleByAction: Record<ProtectedAIAutonomyAction, string[]> = {
    'start-race': ['steward', 'racing-secretary'],
    'stop-race': ['steward', 'emergency-commander'],
    'declare-official-results': ['steward'],
    'modify-official-results': ['steward'],
    'scratch-horse': ['steward', 'racing-secretary', 'veterinarian'],
    'make-medication-decision': ['veterinarian'],
    'clear-veterinary-flag': ['veterinarian'],
    'issue-steward-ruling': ['steward'],
    'issue-disciplinary-decision': ['steward'],
    'trigger-payout': ['finance', 'steward'],
    'execute-gate-move': ['steward', 'racing-secretary', 'track-superintendent'],
    'close-track': ['steward', 'track-superintendent'],
    'reopen-track': ['steward', 'track-superintendent'],
    'declare-winner': ['steward'],
    'modify-result': ['steward'],
    'execute-emergency-action': ['emergency-commander'],
    'override-emergency-personnel': ['emergency-commander'],
    'execute-safety-critical-control': ['operations-admin', 'emergency-commander'],
    'approve-compliance-filing': ['compliance-officer'],
  };
  return { protectedAction: action, requiredRoles: roleByAction[action], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'reason'] };
}

export function validateAIRecommendation(recommendation: AIRecommendation): SafetyValidationResult {
  if (!aiAllowedActivities.includes(recommendation.activity)) return { allowed: false, reason: 'AI activity is outside the advisory boundary' };
  if (recommendation.confidence < 0 || recommendation.confidence > 1) return { allowed: false, reason: 'AI confidence must be between 0 and 1' };
  const protectedAction = recommendation.requestedAction ? canonicalProtectedAutonomyAction(recommendation.requestedAction) : undefined;
  if (protectedAction) {
    return { allowed: true, reason: 'AI may only create an advisory recommendation or draft for this protected action', requiredApproval: createApprovalRequirement(protectedAction) };
  }
  return { allowed: true, reason: 'AI advisory activity is permitted' };
}

export function validateProtectedActionExecution(input: { action: string; recommendationId: string; tenantId: string; target: string; approval?: ApprovalDecision; now?: Date }): SafetyValidationResult {
  const canonicalAction = canonicalProtectedAutonomyAction(input.action);
  if (!canonicalAction) return { allowed: true, reason: 'Action is not in the protected AI autonomy list' };
  const requiredApproval = createApprovalRequirement(canonicalAction);
  const approval = input.approval;
  if (!approval) return { allowed: false, reason: `Explicit authorized human approval required before AI may execute ${input.action}`, requiredApproval };
  const now = input.now ?? new Date();
  const hasRequiredRole = approval.approverRoles.some((role) => requiredApproval.requiredRoles.includes(role));
  const hasEvidence = requiredApproval.evidenceRequired.every((item) => item === 'reason' ? Boolean(approval.reason) : approval.evidence.includes(item));
  const notExpired = !approval.expiresAt || new Date(approval.expiresAt) > now;
  const approvalAction = canonicalProtectedAutonomyAction(approval.protectedAction) ?? approval.protectedAction;
  const matches = approval.status === 'approved' && approval.tenantId === input.tenantId && approval.recommendationId === input.recommendationId && approvalAction === canonicalAction && approval.target === input.target;
  if (!matches) return { allowed: false, reason: 'Approval does not match protected action execution request', requiredApproval };
  if (!approval.approverId || isNonHumanApprovalActor(approval.approverId) || !hasRequiredRole) return { allowed: false, reason: 'Approval must be granted by an authorized human role', requiredApproval };
  if (!hasEvidence) return { allowed: false, reason: 'Approval is missing reason or required evidence', requiredApproval };
  if (!notExpired) return { allowed: false, reason: 'Approval has expired', requiredApproval };
  return { allowed: true, reason: 'Protected action has explicit authorized human approval', approvalId: approval.id };
}

export function canonicalProtectedAutonomyAction(action: string): ProtectedAIAutonomyAction | undefined {
  if (isProtectedAIAutonomyAction(action)) return action;
  const match = Object.entries(protectedActionIntentMap).find(([, normalized]) => normalized === action);
  return match?.[0] as ProtectedAIAutonomyAction | undefined;
}

function isNonHumanApprovalActor(actorId: string): boolean {
  return /^(ai|bot|service|system)(-|:|$)/i.test(actorId) || /(-|:)(ai|bot|service)$/i.test(actorId);
}

export function validateNexusEventEnvelope(event: NexusEventEnvelope): SafetyValidationResult {
  if (!event.eventId || !event.tenantId || !event.occurredAt || !event.correlationId) return { allowed: false, reason: 'Event envelope is missing required identity, tenant, timestamp, or correlation fields' };
  if (!/^([a-z][A-Za-z0-9-]*\.){2,}[a-z][A-Za-z0-9-]*\.v\d+$/.test(event.eventType)) return { allowed: false, reason: 'Event type must follow context.entity.verb.vN naming' };
  if (!event.actor?.id || !event.actor.type) return { allowed: false, reason: 'Event actor is required' };
  if (!event.subject?.id || !event.subject.tenantId || event.subject.tenantId !== event.tenantId) return { allowed: false, reason: 'Event subject must be tenant-scoped and match the envelope tenant' };
  if (!Array.isArray(event.evidence)) return { allowed: false, reason: 'Event evidence references are required as an array' };
  return { allowed: true, reason: 'Event envelope satisfies TrackMind Nexus contract' };
}

