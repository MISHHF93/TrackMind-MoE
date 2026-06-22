import type { ProtectedAction, Role } from './accessControl.js';
import { isProtectedAction, roles } from './accessControl.js';
import type { CanonicalApprovalAuditLinkage } from './accessControl.js';
import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';
import { parseEvidenceRefs } from './incidentIntake.js';

export const approvalRequestComposerSchemaVersion = 'trackmind.approval-composer.v1' as const;

export type ApprovalSourceDomain =
  | 'ai-recommendation'
  | 'incident-action'
  | 'race-day-action'
  | 'compliance-action'
  | 'security-action'
  | 'finance-action'
  | 'administrative-change';

export type ApprovalComposeMode = 'quick' | 'full';

export type ApprovalRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApprovalSourceDomainDefinition {
  domain: ApprovalSourceDomain;
  label: string;
  shortLabel: string;
  description: string;
  defaultRiskLevel: ApprovalRiskLevel;
  defaultApproverRole: Role;
  suggestedActions: readonly ProtectedAction[];
}

export const approvalSourceDomains: readonly ApprovalSourceDomainDefinition[] = [
  {
    domain: 'ai-recommendation',
    label: 'AI recommendation',
    shortLabel: 'AI',
    description: 'Human approval for an AI-suggested operational change.',
    defaultRiskLevel: 'medium',
    defaultApproverRole: 'steward',
    suggestedActions: ['surface-harrowing', 'surface-irrigation', 'kpi-threshold-change', 'race-start'],
  },
  {
    domain: 'incident-action',
    label: 'Incident action',
    shortLabel: 'Incident',
    description: 'Follow-up approval tied to a reported incident.',
    defaultRiskLevel: 'high',
    defaultApproverRole: 'steward',
    suggestedActions: ['emergency-action', 'steward-decision', 'safety-critical-control', 'race-stop'],
  },
  {
    domain: 'race-day-action',
    label: 'Race-day action',
    shortLabel: 'Race day',
    description: 'Race office, gate, scratch, or start approvals.',
    defaultRiskLevel: 'high',
    defaultApproverRole: 'horse-operations-coordinator',
    suggestedActions: ['race-start', 'race-stop', 'scratch-horse', 'starting-gate-move', 'race-status-change'],
  },
  {
    domain: 'compliance-action',
    label: 'Compliance action',
    shortLabel: 'Compliance',
    description: 'Regulatory filing, audit exception, or control attestation.',
    defaultRiskLevel: 'medium',
    defaultApproverRole: 'compliance-officer',
    suggestedActions: ['compliance-filing-approval', 'kpi-threshold-change'],
  },
  {
    domain: 'security-action',
    label: 'Security action',
    shortLabel: 'Security',
    description: 'Perimeter, access, or safety-critical security control.',
    defaultRiskLevel: 'high',
    defaultApproverRole: 'security-manager',
    suggestedActions: ['safety-critical-control', 'emergency-action', 'emergency-personnel-override'],
  },
  {
    domain: 'finance-action',
    label: 'Finance action',
    shortLabel: 'Finance',
    description: 'Payout, settlement, or revenue-impacting change.',
    defaultRiskLevel: 'high',
    defaultApproverRole: 'finance-manager',
    suggestedActions: ['payout'],
  },
  {
    domain: 'administrative-change',
    label: 'Administrative change',
    shortLabel: 'Admin',
    description: 'Configuration, policy, or operational record change.',
    defaultRiskLevel: 'medium',
    defaultApproverRole: 'organization-admin',
    suggestedActions: ['race-office-configuration', 'kpi-threshold-change', 'facility-maintenance-execution'],
  },
];

const domainMap = new Map(approvalSourceDomains.map((definition) => [definition.domain, definition]));

export function getApprovalSourceDomain(domain: ApprovalSourceDomain): ApprovalSourceDomainDefinition {
  const definition = domainMap.get(domain);
  if (!definition) throw new Error(`Unknown approval source domain ${domain}`);
  return definition;
}

export function suggestedActionsForDomain(domain: ApprovalSourceDomain): readonly ProtectedAction[] {
  return getApprovalSourceDomain(domain).suggestedActions;
}

export interface ApprovalComposerPayload {
  requestTitle: string;
  sourceDomain: ApprovalSourceDomain;
  requestedAction: ProtectedAction | string;
  reason: string;
  riskLevel: ApprovalRiskLevel;
  supportingEvidence?: string[];
  requestedApproverRole: Role;
  expiresAt?: string;
  relatedEntityKind?: string;
  relatedEntityId?: string;
  relatedIncidentId?: string;
  relatedRecommendationId?: string;
  composeMode: ApprovalComposeMode;
}

export interface ApprovalComposerValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const quickComposeRequiredFields = [
  'requestTitle', 'sourceDomain', 'requestedAction', 'reason', 'riskLevel', 'requestedApproverRole',
] as const;

export const fullComposeRequiredFields = [
  ...quickComposeRequiredFields,
  'supportingEvidence',
] as const;

export function approvalRequestComposerEntityKind(): DataEntryEntityKind {
  return 'approval-request-composer';
}

export function validateApprovalComposer(
  values: Record<string, unknown>,
  mode: ApprovalComposeMode = 'quick',
): { valid: boolean; errors: string[]; issues: ApprovalComposerValidationIssue[] } {
  const issues: ApprovalComposerValidationIssue[] = [];
  const required = mode === 'full' ? fullComposeRequiredFields : quickComposeRequiredFields;

  for (const field of required) {
    const value = values[field];
    if (field === 'supportingEvidence') {
      const evidence = parseSupportingEvidence(value);
      if (evidence.length === 0) {
        issues.push({ code: 'required', message: 'supportingEvidence requires at least one reference in full mode', field });
      }
      continue;
    }
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  const sourceDomain = String(values.sourceDomain ?? '');
  if (sourceDomain && !domainMap.has(sourceDomain as ApprovalSourceDomain)) {
    issues.push({ code: 'invalid-domain', message: 'sourceDomain must be a supported approval source domain', field: 'sourceDomain' });
  }

  const action = String(values.requestedAction ?? '');
  if (action && !isProtectedAction(action)) {
    issues.push({ code: 'invalid-action', message: 'requestedAction must be a registered protected action', field: 'requestedAction' });
  }

  const riskLevel = String(values.riskLevel ?? '');
  if (riskLevel && !['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
    issues.push({ code: 'invalid-risk', message: 'riskLevel must be low, medium, high, or critical', field: 'riskLevel' });
  }

  const approverRole = String(values.requestedApproverRole ?? '');
  if (approverRole && !(roles as readonly string[]).includes(approverRole)) {
    issues.push({ code: 'invalid-role', message: 'requestedApproverRole must be a valid role', field: 'requestedApproverRole' });
  }

  if (values.requestTitle && String(values.requestTitle).length > 0 && String(values.requestTitle).length < 6) {
    issues.push({ code: 'title-short', message: 'requestTitle must be at least 6 characters', field: 'requestTitle' });
  }

  if (values.reason && String(values.reason).length > 0 && String(values.reason).length < 12) {
    issues.push({ code: 'reason-short', message: 'reason must be at least 12 characters', field: 'reason' });
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function parseSupportingEvidence(value: unknown): string[] {
  return parseEvidenceRefs(value);
}

export function resolveComposerTarget(values: Record<string, unknown>): string {
  const relatedEntityId = values.relatedEntityId ? String(values.relatedEntityId).trim() : '';
  if (relatedEntityId) {
    const kind = values.relatedEntityKind ? String(values.relatedEntityKind).trim() : 'entity';
    return `${kind}:${relatedEntityId}`;
  }
  const incidentId = values.relatedIncidentId ? String(values.relatedIncidentId).trim() : '';
  if (incidentId) return `incident:${incidentId}`;
  const recommendationId = values.relatedRecommendationId ? String(values.relatedRecommendationId).trim() : '';
  if (recommendationId) return `recommendation:${recommendationId}`;
  const domain = String(values.sourceDomain ?? 'approval');
  const title = String(values.requestTitle ?? 'request').slice(0, 32).replace(/\s+/g, '-').toLowerCase();
  return `${domain}:${title}`;
}

export function buildComposerEvidence(values: Record<string, unknown>): string[] {
  const supporting = parseSupportingEvidence(values.supportingEvidence);
  const tags = [
    'approval-request-composer',
    'human-approval-record',
    `composer:domain:${String(values.sourceDomain ?? 'unknown')}`,
    `composer:title:${String(values.requestTitle ?? 'untitled')}`,
    `composer:risk:${String(values.riskLevel ?? 'medium')}`,
    `composer:approver-role:${String(values.requestedApproverRole ?? 'steward')}`,
    `composer:mode:${String(values.composeMode ?? 'quick')}`,
  ];
  if (values.relatedEntityKind && values.relatedEntityId) {
    tags.push(`composer:related-entity:${String(values.relatedEntityKind)}:${String(values.relatedEntityId)}`);
  }
  if (values.relatedIncidentId) tags.push(`composer:incident:${String(values.relatedIncidentId)}`);
  if (values.relatedRecommendationId) tags.push(`composer:recommendation:${String(values.relatedRecommendationId)}`);
  return [...new Set([...tags, ...supporting])];
}

export function buildControlledActionFromComposer(
  scope: { tenantId: string; racetrackId: string; actorId: string; actorType?: 'human' | 'ai-agent' | 'service' },
  values: Record<string, unknown>,
  mode: ApprovalComposeMode = 'quick',
): {
  tenantId: string;
  racetrackId: string;
  action: ProtectedAction;
  target: string;
  requestedBy: string;
  actorType: 'human' | 'ai-agent' | 'service';
  reason: string;
  evidence: string[];
  expiresAt?: string;
} {
  const validation = validateApprovalComposer(values, mode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const action = String(values.requestedAction) as ProtectedAction;
  const title = String(values.requestTitle ?? '').trim();
  const reasonBase = String(values.reason ?? '').trim();
  const reason = title ? `[${title}] ${reasonBase}` : reasonBase;

  return {
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    action,
    target: resolveComposerTarget(values),
    requestedBy: scope.actorId,
    actorType: scope.actorType ?? 'human',
    reason,
    evidence: buildComposerEvidence(values),
    expiresAt: values.expiresAt ? String(values.expiresAt) : undefined,
  };
}

export function buildApprovalComposerSubmitPayload(
  values: Record<string, unknown>,
  role: Role,
): Record<string, unknown> {
  return {
    composeMode: values.composeMode ?? 'quick',
    sourceDomain: values.sourceDomain,
    requestTitle: values.requestTitle,
    requestedAction: values.requestedAction,
    reason: values.reason,
    riskLevel: values.riskLevel,
    requestedApproverRole: values.requestedApproverRole,
    supportingEvidence: parseSupportingEvidence(values.supportingEvidence),
    expiresAt: values.expiresAt ? String(values.expiresAt) : undefined,
    relatedEntityKind: values.relatedEntityKind ? String(values.relatedEntityKind) : undefined,
    relatedEntityId: values.relatedEntityId ? String(values.relatedEntityId) : undefined,
    relatedIncidentId: values.relatedIncidentId ? String(values.relatedIncidentId) : undefined,
    relatedRecommendationId: values.relatedRecommendationId ? String(values.relatedRecommendationId) : undefined,
    actorType: 'human',
    roles: [role],
  };
}

export interface ApprovalControlledActionPayload {
  tenantId: string;
  racetrackId: string;
  action: string;
  target: string;
  reason: string;
  evidence: string[];
  actor: string;
  actorType: 'human';
  roles: Role[];
}

export function buildApprovalControlledActionPayload(
  scope: { tenantId: string; racetrackId: string; actorId: string; role: Role },
  values: Record<string, unknown>,
): ApprovalControlledActionPayload {
  const action = String(values.protectedAction ?? values.action ?? '');
  const target = String(values.target ?? '');
  const reason = String(values.reason ?? '');
  if (!action.trim()) throw new Error('protectedAction is required');
  if (!target.trim()) throw new Error('target is required');
  if (!reason.trim()) throw new Error('reason is required');

  const evidence = parseSupportingEvidence(values.evidence);
  return {
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    action,
    target,
    reason,
    evidence: evidence.length ? [...new Set(['human-approval-record', ...evidence])] : ['human-approval-record'],
    actor: scope.actorId,
    actorType: 'human',
    roles: [scope.role],
  };
}

export function fieldsForComposeMode(mode: ApprovalComposeMode): string[] {
  if (mode === 'quick') {
    return ['sourceDomain', 'requestTitle', 'requestedAction', 'reason', 'riskLevel', 'requestedApproverRole'];
  }
  return [
    'sourceDomain', 'requestTitle', 'requestedAction', 'reason', 'riskLevel', 'requestedApproverRole',
    'supportingEvidence', 'expiresAt', 'relatedEntityKind', 'relatedEntityId', 'relatedIncidentId', 'relatedRecommendationId',
  ];
}

export interface ApprovalComposerResultDto {
  accepted: true;
  approvalId: string;
  approvalRequestId: string;
  requestTitle: string;
  sourceDomain: ApprovalSourceDomain;
  requestedAction: string;
  target: string;
  status: string;
  expiresAt: string;
  riskLevel: ApprovalRiskLevel;
  requestedApproverRole: Role;
  relatedEntity?: { kind: string; id: string };
  relatedIncidentId?: string;
  relatedRecommendationId?: string;
  auditLinkage: CanonicalApprovalAuditLinkage;
  message: string;
  mock: false;
}

export function composerPreview(values: Record<string, unknown>): {
  title: string;
  domain: string;
  action: string;
  target: string;
  riskLevel: string;
  approverRole: string;
} {
  return {
    title: String(values.requestTitle ?? '—'),
    domain: String(values.sourceDomain ?? '—'),
    action: String(values.requestedAction ?? '—'),
    target: resolveComposerTarget(values),
    riskLevel: String(values.riskLevel ?? 'medium'),
    approverRole: String(values.requestedApproverRole ?? '—'),
  };
}

export function canExecuteFromComposerForm(): false {
  return false;
}

export function defaultSeedForDomain(domain: ApprovalSourceDomain): Record<string, unknown> {
  const definition = getApprovalSourceDomain(domain);
  return {
    sourceDomain: domain,
    requestedAction: definition.suggestedActions[0],
    riskLevel: definition.defaultRiskLevel,
    requestedApproverRole: definition.defaultApproverRole,
  };
}

export function approvalComposerFormModes(): DataEntryFormMode[] {
  return ['create'];
}
