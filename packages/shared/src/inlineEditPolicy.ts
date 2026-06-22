export const inlineEditPolicySchemaVersion = 'trackmind.inline-edit-policy.v1' as const;

export type InlineEditFieldKind =
  | 'status'
  | 'readiness'
  | 'assignment'
  | 'tags'
  | 'notes'
  | 'metadata'
  | 'scheduling';

export type InlineEditEntityScope =
  | 'operational-note'
  | 'compliance-evidence'
  | 'facilities-work-order'
  | 'facilities-inspection'
  | 'security-incident'
  | 'corrective-action'
  | 'race-day-readiness'
  | 'paddock-assignment';

export type InlineEditGovernance = 'inline' | 'confirm-destructive' | 'approval-governed' | 'blocked';

export interface InlineEditFieldPolicy {
  entityScope: InlineEditEntityScope;
  fieldKind: InlineEditFieldKind;
  fieldKey: string;
  governance: InlineEditGovernance;
  auditAction: string;
  label: string;
  blockedReason?: string;
}

/** High-risk domains that must never use inline editing. */
export const inlineEditBlockedEntityScopes = [
  'vet-observation',
  'medical-record',
  'disciplinary-action',
  'steward-ruling',
  'payout',
  'official-result',
  'approval-execution',
] as const;

export type InlineEditBlockedEntityScope = (typeof inlineEditBlockedEntityScopes)[number];

const approvalGovernedValues: Partial<Record<InlineEditEntityScope, Record<string, string[]>>> = {
  'compliance-evidence': {
    reviewStatus: ['approved', 'rejected'],
  },
  'corrective-action': {
    status: ['done', 'closed', 'cancelled'],
  },
  'facilities-work-order': {
    status: ['completed', 'cancelled', 'approval-required'],
  },
  'security-incident': {
    status: ['escalated'],
  },
};

const destructiveValues: Partial<Record<InlineEditEntityScope, Record<string, string[]>>> = {
  'operational-note': {
    followUpRequired: ['false'],
  },
  'compliance-evidence': {
    reviewStatus: ['archived'],
  },
  'facilities-work-order': {
    status: ['cancelled'],
  },
  'security-incident': {
    status: ['resolved'],
  },
};

const fieldCatalog: InlineEditFieldPolicy[] = [
  { entityScope: 'operational-note', fieldKind: 'tags', fieldKey: 'tags', governance: 'inline', auditAction: 'operational-note.metadata-patched', label: 'Tags' },
  { entityScope: 'operational-note', fieldKind: 'metadata', fieldKey: 'followUpRequired', governance: 'inline', auditAction: 'operational-note.metadata-patched', label: 'Follow-up flag' },
  { entityScope: 'operational-note', fieldKind: 'notes', fieldKey: 'body', governance: 'inline', auditAction: 'operational-note.revised', label: 'Note body' },
  { entityScope: 'compliance-evidence', fieldKind: 'status', fieldKey: 'reviewStatus', governance: 'inline', auditAction: 'compliance.evidence.metadata-patched', label: 'Review status' },
  { entityScope: 'compliance-evidence', fieldKind: 'tags', fieldKey: 'tags', governance: 'inline', auditAction: 'compliance.evidence.metadata-patched', label: 'Evidence tags' },
  { entityScope: 'compliance-evidence', fieldKind: 'metadata', fieldKey: 'notes', governance: 'inline', auditAction: 'compliance.evidence.metadata-patched', label: 'Evidence notes' },
  { entityScope: 'facilities-work-order', fieldKind: 'scheduling', fieldKey: 'scheduledFor', governance: 'inline', auditAction: 'facilities.work-order.metadata-patched', label: 'Scheduled for' },
  { entityScope: 'facilities-work-order', fieldKind: 'metadata', fieldKey: 'priority', governance: 'inline', auditAction: 'facilities.work-order.metadata-patched', label: 'Priority' },
  { entityScope: 'facilities-work-order', fieldKind: 'status', fieldKey: 'status', governance: 'confirm-destructive', auditAction: 'facilities.work-order.metadata-patched', label: 'Work order status' },
  { entityScope: 'facilities-inspection', fieldKind: 'readiness', fieldKey: 'status', governance: 'inline', auditAction: 'facilities.inspection.metadata-patched', label: 'Inspection status' },
  { entityScope: 'security-incident', fieldKind: 'assignment', fieldKey: 'assignedTo', governance: 'inline', auditAction: 'security.incident.metadata-patched', label: 'Assignee' },
  { entityScope: 'security-incident', fieldKind: 'status', fieldKey: 'status', governance: 'confirm-destructive', auditAction: 'security.incident.metadata-patched', label: 'Incident status' },
  { entityScope: 'corrective-action', fieldKind: 'assignment', fieldKey: 'ownerId', governance: 'inline', auditAction: 'compliance.corrective-action.metadata-patched', label: 'Owner' },
  { entityScope: 'corrective-action', fieldKind: 'scheduling', fieldKey: 'dueAt', governance: 'inline', auditAction: 'compliance.corrective-action.metadata-patched', label: 'Due date' },
  { entityScope: 'corrective-action', fieldKind: 'status', fieldKey: 'status', governance: 'approval-governed', auditAction: 'compliance.corrective-action.updated', label: 'Action status' },
  { entityScope: 'race-day-readiness', fieldKind: 'readiness', fieldKey: 'readinessStatus', governance: 'inline', auditAction: 'race-day.readiness-patched', label: 'Readiness' },
  { entityScope: 'paddock-assignment', fieldKind: 'assignment', fieldKey: 'assignmentStatus', governance: 'inline', auditAction: 'paddock.assignment-patched', label: 'Assignment status' },
];

export function listInlineEditableFields(entityScope: InlineEditEntityScope): InlineEditFieldPolicy[] {
  return fieldCatalog.filter((entry) => entry.entityScope === entityScope);
}

export function resolveInlineEditPolicy(
  entityScope: InlineEditEntityScope | InlineEditBlockedEntityScope,
  fieldKey: string,
  nextValue?: string,
): InlineEditFieldPolicy {
  if ((inlineEditBlockedEntityScopes as readonly string[]).includes(entityScope)) {
    return {
      entityScope: entityScope as InlineEditEntityScope,
      fieldKind: 'metadata',
      fieldKey,
      governance: 'blocked',
      auditAction: 'inline-edit.blocked',
      label: fieldKey,
      blockedReason: `${entityScope} fields require governed workflows — inline editing is not permitted.`,
    };
  }

  const base = fieldCatalog.find((entry) => entry.entityScope === entityScope && entry.fieldKey === fieldKey);
  if (!base) {
    return {
      entityScope: entityScope as InlineEditEntityScope,
      fieldKind: 'metadata',
      fieldKey,
      governance: 'blocked',
      auditAction: 'inline-edit.blocked',
      label: fieldKey,
      blockedReason: `Field ${fieldKey} is not registered for inline editing on ${entityScope}.`,
    };
  }

  if (nextValue === undefined) return { ...base };

  const scopedEntity = entityScope as InlineEditEntityScope;
  const approvalValues = approvalGovernedValues[scopedEntity]?.[fieldKey] ?? [];
  if (approvalValues.includes(nextValue)) {
    return {
      ...base,
      governance: 'approval-governed',
      blockedReason: `Changing ${fieldKey} to "${nextValue}" requires approval workflow.`,
    };
  }

  const destructiveValuesForField = destructiveValues[scopedEntity]?.[fieldKey] ?? [];
  if (destructiveValuesForField.includes(nextValue)) {
    return { ...base, governance: 'confirm-destructive' };
  }

  return { ...base, governance: 'inline' };
}

export function canInlineEdit(
  entityScope: InlineEditEntityScope | InlineEditBlockedEntityScope,
  fieldKey: string,
  nextValue?: string,
): boolean {
  const policy = resolveInlineEditPolicy(entityScope, fieldKey, nextValue);
  return policy.governance === 'inline' || policy.governance === 'confirm-destructive';
}

export function requiresDestructiveConfirm(
  entityScope: InlineEditEntityScope,
  fieldKey: string,
  nextValue: string,
): boolean {
  return resolveInlineEditPolicy(entityScope, fieldKey, nextValue).governance === 'confirm-destructive';
}

export function isApprovalGovernedInlineEdit(
  entityScope: InlineEditEntityScope,
  fieldKey: string,
  nextValue: string,
): boolean {
  return resolveInlineEditPolicy(entityScope, fieldKey, nextValue).governance === 'approval-governed';
}

export interface InlineMetadataPatchPayload {
  schemaVersion: typeof inlineEditPolicySchemaVersion;
  entityScope: InlineEditEntityScope;
  entityId: string;
  fieldKey: string;
  value: unknown;
  actorId: string;
  reason?: string;
  confirmedDestructive?: boolean;
}

export function buildInlineMetadataPatchPayload(input: {
  entityScope: InlineEditEntityScope;
  entityId: string;
  fieldKey: string;
  value: unknown;
  actorId: string;
  reason?: string;
  confirmedDestructive?: boolean;
}): InlineMetadataPatchPayload {
  return {
    schemaVersion: inlineEditPolicySchemaVersion,
    entityScope: input.entityScope,
    entityId: input.entityId,
    fieldKey: input.fieldKey,
    value: input.value,
    actorId: input.actorId,
    reason: input.reason,
    confirmedDestructive: input.confirmedDestructive,
  };
}

export function validateInlineMetadataPatch(payload: InlineMetadataPatchPayload): {
  valid: boolean;
  policy: InlineEditFieldPolicy;
  errors: string[];
} {
  const errors: string[] = [];
  if (!payload.entityId?.trim()) errors.push('entityId is required');
  if (!payload.fieldKey?.trim()) errors.push('fieldKey is required');
  if (!payload.actorId?.trim()) errors.push('actorId is required');

  const nextValue = payload.value === undefined || payload.value === null
    ? undefined
    : String(payload.value);

  const policy = resolveInlineEditPolicy(payload.entityScope, payload.fieldKey, nextValue);

  if (policy.governance === 'blocked') {
    errors.push(policy.blockedReason ?? 'Inline edit blocked');
  }
  if (policy.governance === 'approval-governed') {
    errors.push(policy.blockedReason ?? 'Approval required');
  }
  if (policy.governance === 'confirm-destructive' && !payload.confirmedDestructive) {
    errors.push(`Destructive change to ${policy.label} requires confirmation`);
  }

  return { valid: errors.length === 0, policy, errors };
}

/** Option sets for inline status/readiness pickers in consoles. */
export const inlineStatusOptionSets = {
  complianceEvidenceReviewStatus: [
    { value: 'draft', label: 'Draft', tone: 'neutral' as const },
    { value: 'submitted', label: 'Submitted', tone: 'watch' as const },
    { value: 'pending-review', label: 'Pending review', tone: 'watch' as const },
    { value: 'approved', label: 'Approved', tone: 'nominal' as const, approvalGoverned: true },
    { value: 'rejected', label: 'Rejected', tone: 'critical' as const, approvalGoverned: true },
    { value: 'archived', label: 'Archived', tone: 'neutral' as const, destructive: true },
  ],
  facilitiesWorkOrderPriority: [
    { value: 'low', label: 'Low', tone: 'neutral' as const },
    { value: 'normal', label: 'Normal', tone: 'nominal' as const },
    { value: 'high', label: 'High', tone: 'warning' as const },
    { value: 'critical', label: 'Critical', tone: 'critical' as const },
  ],
  securityIncidentStatus: [
    { value: 'open', label: 'Open', tone: 'watch' as const },
    { value: 'triaged', label: 'Triaged', tone: 'neutral' as const },
    { value: 'escalated', label: 'Escalated', tone: 'critical' as const, approvalGoverned: true },
    { value: 'resolved', label: 'Resolved', tone: 'nominal' as const, destructive: true },
  ],
} as const;
