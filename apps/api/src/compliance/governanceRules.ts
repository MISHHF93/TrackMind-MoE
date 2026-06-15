import type { CqrsCommand, CqrsCommandType } from '../events/definitions.js';

export interface SafetyCriticalGovernanceRule {
  commandType: CqrsCommandType;
  protectedAction: string;
  requiredApprovalRoles: string[];
  requiredEvidence: string[];
  regulations: string[];
}

export interface GovernanceRuleEvaluation {
  allowed: boolean;
  rule?: SafetyCriticalGovernanceRule;
  violations: string[];
  machineReadable: true;
}

export const safetyCriticalGovernanceRules: SafetyCriticalGovernanceRule[] = [
  { commandType: 'race_start', protectedAction: 'race-start', requiredApprovalRoles: ['racing-secretary', 'steward', 'veterinarian'], requiredEvidence: ['approval_id', 'approver_id', 'approval_timestamp'], regulations: ['HISA', 'ARCI', 'TRUSTWORTHY_C1'] },
  { commandType: 'race_stop', protectedAction: 'race-stop', requiredApprovalRoles: ['steward', 'security'], requiredEvidence: ['approval_id', 'approver_id', 'approval_timestamp'], regulations: ['HISA', 'ARCI', 'TRUSTWORTHY_C1'] },
  { commandType: 'scratch_decision', protectedAction: 'scratch-horse', requiredApprovalRoles: ['veterinarian', 'steward'], requiredEvidence: ['approval_id', 'approver_id', 'approval_timestamp'], regulations: ['HISA', 'TRUSTWORTHY_C1'] },
  { commandType: 'medication_admin', protectedAction: 'medication-decision', requiredApprovalRoles: ['veterinarian', 'steward'], requiredEvidence: ['approval_id', 'approver_id', 'approval_timestamp'], regulations: ['HISA', 'TRUSTWORTHY_C1'] },
  { commandType: 'emergency_action', protectedAction: 'emergency-action', requiredApprovalRoles: ['security'], requiredEvidence: ['approval_id', 'approver_id', 'approval_timestamp'], regulations: ['HISA', 'ARCI', 'TRUSTWORTHY_C1'] },
];

export function evaluateSafetyCriticalGovernance(command: CqrsCommand): GovernanceRuleEvaluation {
  const rule = safetyCriticalGovernanceRules.find((item) => item.commandType === command.type);
  if (!rule) return { allowed: true, violations: [], machineReadable: true };
  const violations = [
    command.approvalRequired === true ? '' : 'approval_required_true',
    command.approvalId ? '' : 'approval_id',
    command.approverId ? '' : 'approver_id',
    command.approvalTimestamp ? '' : 'approval_timestamp',
  ].filter(Boolean);
  const ai = command.ai;
  if (ai !== undefined && (ai.model_id || ai.confidence !== undefined || (ai.evidence_links?.length ?? 0) > 0)) {
    if (ai.confidence === undefined || ai.confidence < 0 || ai.confidence > 1) violations.push('ai_confidence');
    if (!ai.evidence_links?.length) violations.push('ai_evidence_links');
  }
  return { allowed: violations.length === 0, rule, violations, machineReadable: true };
}
