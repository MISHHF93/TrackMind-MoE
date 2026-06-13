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

export interface AuditEvent {
  id: EntityId;
  tenantId: TenantId;
  eventType: string;
  actorId: EntityId;
  actorType: 'human' | 'ai-agent' | 'service' | 'system';
  action: string;
  target: string;
  occurredAt: ISODateTime;
  correlationId: string;
  evidence: string[];
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
  protectedAction: ProtectedAIAutonomyAction;
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

export const aiAllowedActivities = ['recommend', 'simulate', 'summarize', 'classify', 'forecast', 'create-draft-action'] as const;
export type AIAllowedActivity = typeof aiAllowedActivities[number];

export const protectedAIAutonomyActions = [
  'start-race',
  'stop-race',
  'declare-official-results',
  'modify-official-results',
  'scratch-horse',
  'clear-veterinary-flag',
  'issue-steward-ruling',
  'trigger-payout',
  'override-emergency-personnel',
  'execute-safety-critical-control',
] as const;
export type ProtectedAIAutonomyAction = typeof protectedAIAutonomyActions[number];

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
    'clear-veterinary-flag': ['veterinarian'],
    'issue-steward-ruling': ['steward'],
    'trigger-payout': ['finance', 'steward'],
    'override-emergency-personnel': ['emergency-commander'],
    'execute-safety-critical-control': ['operations-admin', 'emergency-commander'],
  };
  return { protectedAction: action, requiredRoles: roleByAction[action], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'reason'] };
}

export function validateAIRecommendation(recommendation: AIRecommendation): SafetyValidationResult {
  if (!aiAllowedActivities.includes(recommendation.activity)) return { allowed: false, reason: 'AI activity is outside the advisory boundary' };
  if (recommendation.confidence < 0 || recommendation.confidence > 1) return { allowed: false, reason: 'AI confidence must be between 0 and 1' };
  if (recommendation.requestedAction && isProtectedAIAutonomyAction(recommendation.requestedAction)) {
    return { allowed: true, reason: 'AI may only create an advisory recommendation or draft for this protected action', requiredApproval: createApprovalRequirement(recommendation.requestedAction) };
  }
  return { allowed: true, reason: 'AI advisory activity is permitted' };
}

export function validateProtectedActionExecution(input: { action: string; recommendationId: string; tenantId: string; target: string; approval?: ApprovalDecision; now?: Date }): SafetyValidationResult {
  if (!isProtectedAIAutonomyAction(input.action)) return { allowed: true, reason: 'Action is not in the protected AI autonomy list' };
  const requiredApproval = createApprovalRequirement(input.action);
  const approval = input.approval;
  if (!approval) return { allowed: false, reason: `Explicit authorized human approval required before AI may execute ${input.action}`, requiredApproval };
  const now = input.now ?? new Date();
  const hasRequiredRole = approval.approverRoles.some((role) => requiredApproval.requiredRoles.includes(role));
  const hasEvidence = requiredApproval.evidenceRequired.every((item) => item === 'reason' ? Boolean(approval.reason) : approval.evidence.includes(item));
  const notExpired = !approval.expiresAt || new Date(approval.expiresAt) > now;
  const matches = approval.status === 'approved' && approval.tenantId === input.tenantId && approval.recommendationId === input.recommendationId && approval.protectedAction === input.action && approval.target === input.target;
  if (!matches) return { allowed: false, reason: 'Approval does not match protected action execution request', requiredApproval };
  if (!approval.approverId || !hasRequiredRole) return { allowed: false, reason: 'Approval must be granted by an authorized human role', requiredApproval };
  if (!hasEvidence) return { allowed: false, reason: 'Approval is missing reason or required evidence', requiredApproval };
  if (!notExpired) return { allowed: false, reason: 'Approval has expired', requiredApproval };
  return { allowed: true, reason: 'Protected action has explicit authorized human approval', approvalId: approval.id };
}
